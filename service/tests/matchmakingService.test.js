import { randomUUID } from 'node:crypto';
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { matchPlayers, findGameForSession } from '../services/matchmakingService.js';
import { getGame } from '../services/gameService.js';
import { findVersions, disconnect } from '../db/database.js';
import {
  clearQueue,
  queued,
  pushRaw,
  getPlayers,
  getRawSession,
  closeTestRedis,
} from './helpers/redis.js';

beforeEach(clearQueue);
after(async () => {
  await clearQueue();
  await disconnect();
  await closeTestRedis();
});

test('returns null and changes nothing when the queue is empty', async () => {
  assert.equal(await matchPlayers(), null);
  assert.deepEqual(await queued(), []);
});

test('returns null and leaves the token queued when only one is waiting', async () => {
  await pushRaw('a');
  assert.equal(await matchPlayers(), null);
  assert.deepEqual(await queued(), ['a']);
});

test('creates a new in-progress game from the two oldest tokens', async () => {
  await pushRaw('a', 'b', 'c');
  const game = await matchPlayers();
  assert.ok(game.id);
  assert.deepEqual(game.board, Array(9).fill(null));
  assert.equal(game.status, 'in_progress');
  assert.equal(game.winner, null);
  assert.equal(game.version, 1);
  assert.equal(game.currentPlayer, 'X');
});

test('removes exactly the two matched tokens from the head of the queue', async () => {
  await pushRaw('a', 'b', 'c');
  await matchPlayers();
  assert.deepEqual(await queued(), ['c']);
});

test('assigns the oldest token to X and the next to O', async () => {
  await pushRaw('a', 'b');
  const game = await matchPlayers();
  assert.deepEqual(await getPlayers(game.id), { X: 'a', O: 'b' });
});

test('the created game is stored and has its initial version', async () => {
  await pushRaw('a', 'b');
  const game = await matchPlayers();
  assert.deepEqual(await getGame(game.id), game);
  assert.equal((await findVersions(game.id)).length, 1);
});

test('tokens are not exposed in the game object', async () => {
  await pushRaw('secret-a', 'secret-b');
  const game = await matchPlayers();
  assert.ok(!JSON.stringify(game).includes('secret-'));
  assert.ok(!JSON.stringify(await getGame(game.id)).includes('secret-'));
});

test('successive runs pair tokens in FIFO order', async () => {
  await pushRaw('t1', 't2', 't3', 't4');
  const first = await matchPlayers();
  const second = await matchPlayers();
  assert.deepEqual(await getPlayers(first.id), { X: 't1', O: 't2' });
  assert.deepEqual(await getPlayers(second.id), { X: 't3', O: 't4' });
  assert.deepEqual(await queued(), []);
  assert.equal(await matchPlayers(), null);
});

test('each run creates a distinct game', async () => {
  await pushRaw('t1', 't2', 't3', 't4');
  const first = await matchPlayers();
  const second = await matchPlayers();
  assert.notEqual(first.id, second.id);
});

test('both matched sessions are stored pointing at the game id', async () => {
  const [x, o] = [randomUUID(), randomUUID()];
  await pushRaw(x, o);
  const game = await matchPlayers();
  assert.equal(await getRawSession(x), game.id);
  assert.equal(await getRawSession(o), game.id);
});

test('a session that is still queued has no game stored', async () => {
  const [x, o, waiting] = [randomUUID(), randomUUID(), randomUUID()];
  await pushRaw(x, o, waiting);
  await matchPlayers();
  assert.equal(await getRawSession(waiting), null);
  assert.equal(await findGameForSession(waiting), null);
});

test('no sessions are stored when there is no match', async () => {
  const lone = randomUUID();
  await pushRaw(lone);
  await matchPlayers();
  assert.equal(await getRawSession(lone), null);
});

test('findGameForSession returns the matched game for both players', async () => {
  const [x, o] = [randomUUID(), randomUUID()];
  await pushRaw(x, o);
  const game = await matchPlayers();
  assert.deepEqual(await findGameForSession(x), { ...game, player: 'X' });
  assert.deepEqual(await findGameForSession(o), { ...game, player: 'O' });
});

test('findGameForSession reports the mark each session plays', async () => {
  const [first, second, third, fourth] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await pushRaw(first, second, third, fourth);
  await matchPlayers();
  await matchPlayers();
  assert.equal((await findGameForSession(first)).player, 'X');
  assert.equal((await findGameForSession(second)).player, 'O');
  assert.equal((await findGameForSession(third)).player, 'X');
  assert.equal((await findGameForSession(fourth)).player, 'O');
});

test('a session keeps the same mark across repeated lookups', async () => {
  const [x, o] = [randomUUID(), randomUUID()];
  await pushRaw(x, o);
  await matchPlayers();
  for (let i = 0; i < 3; i += 1) {
    assert.equal((await findGameForSession(x)).player, 'X');
    assert.equal((await findGameForSession(o)).player, 'O');
  }
});

test('findGameForSession returns null for an unknown session', async () => {
  assert.equal(await findGameForSession(randomUUID()), null);
});

test('each pair of sessions maps to its own game', async () => {
  const [a, b, c, d] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await pushRaw(a, b, c, d);
  const first = await matchPlayers();
  const second = await matchPlayers();
  assert.equal(await getRawSession(a), first.id);
  assert.equal(await getRawSession(b), first.id);
  assert.equal(await getRawSession(c), second.id);
  assert.equal(await getRawSession(d), second.id);
});

test('session lookups stay consistent with players under concurrent matching', async () => {
  const tokens = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await pushRaw(...tokens);
  const games = await Promise.all([matchPlayers(), matchPlayers()]);
  for (const game of games) {
    const players = Object.values(await getPlayers(game.id));
    for (const token of players) {
      assert.equal(await getRawSession(token), game.id);
    }
  }
  for (const token of tokens) {
    assert.ok(await getRawSession(token));
  }
});

test('two simultaneous runs with exactly two tokens: one game, one null', async () => {
  await pushRaw('a', 'b');
  const results = await Promise.all([matchPlayers(), matchPlayers()]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(await queued(), []);
});

test('two simultaneous runs with four tokens: two games, no token reused', async () => {
  await pushRaw('t1', 't2', 't3', 't4');
  const games = await Promise.all([matchPlayers(), matchPlayers()]);
  assert.ok(games.every(Boolean));
  const used = (await Promise.all(games.map((g) => getPlayers(g.id)))).flatMap(Object.values);
  assert.deepEqual([...used].sort(), ['t1', 't2', 't3', 't4']);
  assert.deepEqual(await queued(), []);
});
