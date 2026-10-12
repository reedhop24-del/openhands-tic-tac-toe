import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createToken } from '../services/tokenService.js';
import { disconnect } from '../db/database.js';
import { clearQueue, queued, closeTestRedis } from './helpers/redis.js';

beforeEach(clearQueue);
after(async () => {
  await clearQueue();
  await disconnect();
  await closeTestRedis();
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('createToken returns a UUID', async () => {
  assert.match(await createToken(), UUID_V4);
});

test('createToken adds the token to the queue', async () => {
  const token = await createToken();
  assert.deepEqual(await queued(), [token]);
});

test('tokens are unique', async () => {
  const tokens = await Promise.all([createToken(), createToken(), createToken()]);
  assert.equal(new Set(tokens).size, 3);
});

test('queue is FIFO: tokens are appended at the tail in creation order', async () => {
  const first = await createToken();
  const second = await createToken();
  const third = await createToken();
  assert.deepEqual(await queued(), [first, second, third]);
});

test('each call grows the queue by exactly one', async () => {
  await createToken();
  assert.equal((await queued()).length, 1);
  await createToken();
  assert.equal((await queued()).length, 2);
});
