import * as gameService from '../services/gameService.js';

// Handles HTTP concerns only; business logic lives in gameService.
export const create = async (req, res) => {
  const game = await gameService.createGame();
  res.status(201).json(game);
};

export const get = async (req, res) => {
  const game = await gameService.getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
};
