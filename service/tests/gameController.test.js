import { randomUUID } from 'node:crypto';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { matchPlayers } from '../services/matchmakingService.js';
import { disconnect } from '../db/database.js';
import { clearQueue, pushRaw, closeTestRedis } from './helpers/redis.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

beforeEach(clearQueue);

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await clearQueue();
  await disconnect();
  await closeTestRedis();
});

const getJson = async (path) => {
  const res = await fetch(`${baseUrl}${path}`);
  return { status: res.status, body: await res.json() };
};

const matchPair = async () => {
  const [x, o] = [randomUUID(), randomUUID()];
  await pushRaw(x, o);
  const game = await matchPlayers();
  return { x, o, game };
};

test('GET /games?token returns 200 and the matched game for the X session', async () => {
  const { x, game } = await matchPair();
  const { status, body } = await getJson(`/games?token=${x}`);
  assert.equal(status, 200);
  assert.deepEqual(body, game);
});

test('GET /games?token returns the same game for the O session', async () => {
  const { x, o, game } = await matchPair();
  const forX = await getJson(`/games?token=${x}`);
  const forO = await getJson(`/games?token=${o}`);
  assert.equal(forO.status, 200);
  assert.equal(forO.body.id, game.id);
  assert.deepEqual(forO.body, forX.body);
});

test('GET /games?token matches GET /games/:id for the same game', async () => {
  const { x, game } = await matchPair();
  const byToken = await getJson(`/games?token=${x}`);
  const byId = await getJson(`/games/${game.id}`);
  assert.deepEqual(byToken.body, byId.body);
});

test('GET /games?token returns 404 for an unknown token', async () => {
  const { status, body } = await getJson(`/games?token=${randomUUID()}`);
  assert.equal(status, 404);
  assert.equal(body.error, 'No game found for token');
});

test('GET /games?token returns 404 for a token that is queued but not matched', async () => {
  const waiting = randomUUID();
  await pushRaw(waiting);
  const { status } = await getJson(`/games?token=${waiting}`);
  assert.equal(status, 404);
});

test('GET /games without a token returns 400', async () => {
  const { status, body } = await getJson('/games');
  assert.equal(status, 400);
  assert.equal(body.error, 'token query param is required');
});

test('GET /games with an empty token returns 400', async () => {
  const { status } = await getJson('/games?token=');
  assert.equal(status, 400);
});

test('GET /games with a repeated token param returns 400', async () => {
  const { status } = await getJson('/games?token=a&token=b');
  assert.equal(status, 400);
});

test('GET /games?token does not expose session tokens in the response', async () => {
  const { x, o } = await matchPair();
  const { body } = await getJson(`/games?token=${x}`);
  const text = JSON.stringify(body);
  assert.ok(!text.includes(x));
  assert.ok(!text.includes(o));
});

test('GET /games/:id still returns 404 for an unknown id', async () => {
  const { status } = await getJson('/games/does-not-exist');
  assert.equal(status, 404);
});

test('the game found by token reflects moves made afterwards', async () => {
  const { x, game } = await matchPair();
  const move = await fetch(`${baseUrl}/games/${game.id}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player: 'X', move: 4 }),
  });
  assert.equal(move.status, 201);
  const { body } = await getJson(`/games?token=${x}`);
  assert.equal(body.board[4], 'X');
  assert.equal(body.version, 2);
});
