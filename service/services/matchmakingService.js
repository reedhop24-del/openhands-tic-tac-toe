import { matchFromQueue, findGameIdBySession, findPlayers, find } from '../db/database.js';
import { buildNewGame } from './gameService.js';

// The oldest token in the queue plays X, the next plays O.
export const matchPlayers = () =>
  matchFromQueue(([x, o]) => ({ ...buildNewGame(), players: { X: x, O: o } }));

// Resolves to the game the session was matched to plus the mark that session plays
// ({ ...game, player: 'X' | 'O' }), or null if it hasn't been matched.
export const findGameForSession = async (token) => {
  const gameId = await findGameIdBySession(token);
  if (!gameId) return null;
  const game = await find(gameId);
  if (!game) return null;
  const players = await findPlayers(gameId);
  const player = Object.keys(players).find((mark) => players[mark] === token) ?? null;
  return { ...game, player };
};
