const request = async (url, options) => {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${body.error}`);
  return body;
};

export const createGame = () => request('/games', { method: 'POST' });

export const makeMove = (gameId, player, move) =>
  request(`/games/${gameId}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, move }),
  });
