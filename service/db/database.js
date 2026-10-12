import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const MAX_RETRIES = 10;
const TOKEN_QUEUE_KEY = process.env.TOKEN_QUEUE_KEY ?? 'tokens:queue';

const gameKey = (id) => `game:${id}`;
const versionsKey = (id) => `versions:${id}`;
const playersKey = (id) => `players:${id}`;
const sessionKey = (token) => `session:${token}`;

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

const writeGame = (tx, game, version) =>
  tx
    .set(gameKey(game.id), JSON.stringify(game))
    .rpush(versionsKey(game.id), JSON.stringify(version));

export const find = async (id) => parse(await redis.get(gameKey(id)));

export const findVersions = async (id) => {
  const raw = await redis.lrange(versionsKey(id), 0, -1);
  return raw.map((item) => JSON.parse(item));
};

// Writes the game and its first version together.
export const insertGame = async (game, version) => {
  const written = await execOrThrow(writeGame(redis.multi(), game, version));
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

      if (await execOrThrow(writeGame(conn.multi(), updated, version))) return updated;
    } finally {
      conn.disconnect();
    }
  }
  throw conflictError();
};

// FIFO queue: enqueue at the tail with RPUSH, take from the head.
export const enqueueToken = async (token) => {
  await redis.rpush(TOKEN_QUEUE_KEY, token);
  return token;
};

// Takes the 2 oldest tokens and creates a game for them in one MULTI/EXEC, so a
// token is never lost or used twice. `build(tokens)` returns { game, version, players }.
// Resolves to the new game, or null when fewer than 2 tokens are queued.
export const matchFromQueue = async (build) => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const conn = redis.duplicate();
    try {
      await conn.watch(TOKEN_QUEUE_KEY);
      const tokens = await conn.lrange(TOKEN_QUEUE_KEY, 0, 1);
      if (tokens.length < 2) return null;

      const { game, version, players } = build(tokens);

      const tx = writeGame(conn.multi().ltrim(TOKEN_QUEUE_KEY, 2, -1), game, version).hset(
        playersKey(game.id),
        players,
      );
      Object.values(players).forEach((token) => tx.set(sessionKey(token), game.id));
      if (await execOrThrow(tx)) return game;
    } finally {
      conn.disconnect();
    }
  }
  throw conflictError();
};

export const findGameIdBySession = (token) => redis.get(sessionKey(token));

export const findPlayers = (gameId) => redis.hgetall(playersKey(gameId));

export const disconnect = () => redis.quit();
