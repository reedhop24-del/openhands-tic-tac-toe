import { randomUUID } from 'node:crypto';
import { save, find } from '../db/database.js';

export const createGame = async () => {
  const game = {
    id: randomUUID(),
    board: Array(9).fill(null),
    currentPlayer: 'X',
    status: 'in_progress',
  };
  return save(game.id, game);
};

export const getGame = async (id) => find(id);
