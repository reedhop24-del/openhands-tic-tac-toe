import express from 'express';
import * as gameController from './controllers/gameController.js';
import * as tokenController from './controllers/tokenController.js';

const app = express();

app.use(express.json());

app.get('/token', tokenController.get);
app.post('/games', gameController.create);
app.get('/games', gameController.getBySession);
app.get('/games/:id', gameController.get);
app.post('/games/:gameId/moves', gameController.move);

export default app;
