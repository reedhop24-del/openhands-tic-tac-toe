const store = new Map();

export const save = async (key, value) => {
  store.set(key, value);
  return value;
};

export const find = async (key) => store.get(key) ?? null;
