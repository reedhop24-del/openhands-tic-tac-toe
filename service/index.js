import express from 'express';
import * as gameController from './controllers/gameController.js';

const app = express();
const PORT = 3000;

app.use(express.json());

app.post('/games', gameController.create);
app.get('/games/:id', gameController.get);
app.post('/games/:gameId/moves', gameController.move);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
