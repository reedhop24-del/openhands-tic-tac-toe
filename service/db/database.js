const store = new Map();
const versionsStore = new Map();

export const save = async (key, value) => {
  store.set(key, value);
  return value;
};

export const find = async (key) => store.get(key) ?? null;

export const saveVersion = async (gameId, version) => {
  const versions = versionsStore.get(gameId) ?? [];
  versions.push(version);
  versionsStore.set(gameId, versions);
  return version;
};

export const findVersions = async (gameId) => versionsStore.get(gameId) ?? [];

export const findLastVersion = async (gameId) => (await findVersions(gameId)).at(-1) ?? null;
