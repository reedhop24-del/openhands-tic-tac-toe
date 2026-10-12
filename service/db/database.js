import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const MAX_RETRIES = 10;

const gameKey = (id) => `game:${id}`;
const versionsKey = (id) => `versions:${id}`;

const parse = (raw) => (raw ? JSON.parse(raw) : null);

const conflictError = () =>
  Object.assign(new Error('Concurrent update conflict, please retry'), { status: 409 });

const execOrThrow = async (tx) => {
  const results = await tx.exec();
  if (results === null) return false;
  const failed = results.find(([err]) => err);
  if (failed) throw failed[0];
  return true;
};

export const find = async (id) => parse(await redis.get(gameKey(id)));

export const findVersions = async (id) => {
  const raw = await redis.lrange(versionsKey(id), 0, -1);
  return raw.map((item) => JSON.parse(item));
};

// Writes the game and its first version together.
export const insertGame = async (game, version) => {
  const written = await execOrThrow(
    redis
      .multi()
      .set(gameKey(game.id), JSON.stringify(game))
      .rpush(versionsKey(game.id), JSON.stringify(version)),
  );
  if (!written) throw conflictError();
  return game;
};

// Optimistic locking: WATCH the keys, read, let `update` compute the new state,
// then write game + version in one MULTI/EXEC. If another writer touched the
// keys in between, EXEC aborts and we re-read and re-run `update`.
// WATCH is per-connection, so each attempt uses its own connection.
export const updateGame = async (id, update) => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const conn = redis.duplicate();
    try {
      await conn.watch(gameKey(id), versionsKey(id));
      const game = parse(await conn.get(gameKey(id)));
      const lastVersion = parse(await conn.lindex(versionsKey(id), -1));

      const { game: updated, version } = update({ game, lastVersion });

      const written = await execOrThrow(
        conn
          .multi()
          .set(gameKey(id), JSON.stringify(updated))
          .rpush(versionsKey(id), JSON.stringify(version)),
      );
      if (written) return updated;
    } finally {
      conn.disconnect();
    }
  }
  throw conflictError();
};

export const disconnect = () => redis.quit();
