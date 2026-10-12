import * as tokenService from '../services/tokenService.js';

// Handles HTTP concerns only; token creation and queueing live in tokenService.
export const get = async (req, res) => {
  const token = await tokenService.createToken();
  res.json({ token });
};
