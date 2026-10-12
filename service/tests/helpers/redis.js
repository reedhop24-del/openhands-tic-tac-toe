import Redis from 'ioredis';

// Tests use their own queue key (set by `npm test`) so they never touch the real queue.
const TOKEN_QUEUE_KEY = process.env.TOKEN_QUEUE_KEY;
if (!TOKEN_QUEUE_KEY || TOKEN_QUEUE_KEY === 'tokens:queue') {
  throw new Error('Run tests with npm test (TOKEN_QUEUE_KEY must be a test-only key)');
}

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export const clearQueue = () => redis.del(TOKEN_QUEUE_KEY);
export const queued = () => redis.lrange(TOKEN_QUEUE_KEY, 0, -1);
export const pushRaw = (...tokens) => redis.rpush(TOKEN_QUEUE_KEY, ...tokens);
export const getPlayers = (gameId) => redis.hgetall(`players:${gameId}`);
export const getRawSession = (token) => redis.get(`session:${token}`);
export const closeTestRedis = () => redis.quit();
