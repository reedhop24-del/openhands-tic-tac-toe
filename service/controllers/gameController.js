import * as gameService from '../services/gameService.js';
import * as matchmakingService from '../services/matchmakingService.js';

// Handles HTTP concerns only; business logic lives in the services.
export const create = async (req, res) => {
  const game = await gameService.createGame();
  res.status(201).json(game);
};

export const get = async (req, res) => {
  const game = await gameService.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
};

export const getBySession = async (req, res) => {
  const { token } = req.query;
  if (typeof token !== 'string' || token.trim() === '') {
    return res.status(400).json({ error: 'token query param is required' });
  }
  const game = await matchmakingService.findGameForSession(token);
  if (!game) return res.status(404).json({ error: 'No game found for token' });
  res.json(game);
};

export const move = async (req, res) => {
  try {
    const game = await gameService.makeMove(req.params.gameId, req.body ?? {});
    res.status(201).json(game);
  } catch (err) {
    if (!err.status) throw err;
    res.status(err.status).json({ error: err.message });
  }
};
