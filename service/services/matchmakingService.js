import { matchFromQueue, findGameIdBySession, find } from '../db/database.js';
import { buildNewGame } from './gameService.js';

// The oldest token in the queue plays X, the next plays O.
export const matchPlayers = () =>
  matchFromQueue(([x, o]) => ({ ...buildNewGame(), players: { X: x, O: o } }));

// Resolves to the game the session was matched to, or null if it hasn't been matched.
export const findGameForSession = async (token) => {
  const gameId = await findGameIdBySession(token);
  return gameId ? find(gameId) : null;
};
