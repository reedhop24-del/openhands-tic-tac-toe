import { randomUUID } from 'node:crypto';
import { save, find, saveVersion, findLastVersion } from '../db/database.js';
import { STATUS, calculateStatus, calculateWinner, isGameOver } from './gameRules.js';

const PLAYERS = ['X', 'O'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

const snapshot = (game, player, move) => ({
  version: game.version,
  board: [...game.board],
  player,
  move,
});

const nextPlayer = (lastVersion) =>
  lastVersion?.player ? PLAYERS.find((p) => p !== lastVersion.player) : PLAYERS[0];

export const createGame = async () => {
  const game = {
    id: randomUUID(),
    board: Array(9).fill(null),
    currentPlayer: 'X',
    status: STATUS.IN_PROGRESS,
    winner: null,
    version: 1,
  };
  await saveVersion(game.id, snapshot(game, null, null));
  return save(game.id, game);
};

export const getGame = async (id) => find(id);

export const makeMove = async (gameId, { player, move }) => {
  const game = await find(gameId);
  if (!game) throw httpError(404, 'Game not found');
  if (isGameOver(game.status)) throw httpError(400, `Game is over: ${game.status}`);
  if (!PLAYERS.includes(player)) throw httpError(400, 'player must be X or O');

  const index = typeof move === 'string' && move.trim() !== '' ? Number(move) : move;
  if (!Number.isInteger(index) || index < 0 || index > 8) {
    throw httpError(400, 'move must be an integer between 0 and 8');
  }

  const expected = nextPlayer(await findLastVersion(gameId));
  if (player !== expected) throw httpError(409, `Not your turn: ${expected} plays next`);
  if (game.board[index] !== null) throw httpError(409, 'Space already taken');

  game.board[index] = player;
  game.currentPlayer = PLAYERS.find((p) => p !== player);
  game.status = calculateStatus(game.board);
  game.winner = calculateWinner(game.board);
  game.version += 1;
  await saveVersion(gameId, snapshot(game, player, index));
  return save(gameId, game);
};
