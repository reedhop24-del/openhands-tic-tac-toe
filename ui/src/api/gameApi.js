const request = async (url, options) => {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(`${res.status}: ${body.error}`), { status: res.status });
  }
  return body;
};

export const getToken = () => request('/token');

// Resolves to the matched game, or null while the session is still waiting for a match.
export const getGameByToken = async (token) => {
  try {
    return await request(`/games?token=${encodeURIComponent(token)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
};

export const getGame = (gameId) => request(`/games/${gameId}`);

export const makeMove = (gameId, player, move) =>
  request(`/games/${gameId}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, move }),
  });
