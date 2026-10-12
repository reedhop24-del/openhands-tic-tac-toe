import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { startMatchmaker } from '../worker/spawnMatchmaker.js';
import { clearQueue, queued, pushRaw, closeTestRedis } from './helpers/redis.js';

beforeEach(clearQueue);
after(async () => {
  await clearQueue();
  await closeTestRedis();
});

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitFor = async (condition, timeoutMs = 8000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return true;
    await sleep(100);
  }
  return false;
};

test('starts a separate child process', async () => {
  const { stop, getPid } = startMatchmaker();
  try {
    const pid = getPid();
    assert.ok(pid);
    assert.notEqual(pid, process.pid);
    assert.ok(alive(pid));
  } finally {
    await stop();
  }
});

test('the forked worker consumes two queued tokens', async () => {
  await pushRaw('a', 'b');
  const { stop } = startMatchmaker();
  try {
    assert.ok(await waitFor(async () => (await queued()).length === 0));
  } finally {
    await stop();
  }
});

test('the forked worker leaves a lone token queued', async () => {
  await pushRaw('a');
  const { stop } = startMatchmaker();
  try {
    await sleep(1500);
    assert.deepEqual(await queued(), ['a']);
  } finally {
    await stop();
  }
});

test('stop terminates the child process', async () => {
  const { stop, getPid } = startMatchmaker();
  const pid = getPid();
  await stop();
  assert.equal(alive(pid), false);
});

test('the worker is restarted if it is killed unexpectedly', async () => {
  const { stop, getPid } = startMatchmaker();
  try {
    const firstPid = getPid();
    process.kill(firstPid, 'SIGKILL');
    assert.ok(await waitFor(() => getPid() !== firstPid && alive(getPid())));
    assert.equal(alive(firstPid), false);
  } finally {
    await stop();
  }
});

test('the worker is not restarted after stop', async () => {
  const { stop, getPid } = startMatchmaker();
  const pid = getPid();
  await stop();
  await sleep(1500);
  assert.equal(getPid(), pid);
  assert.equal(alive(pid), false);
});
