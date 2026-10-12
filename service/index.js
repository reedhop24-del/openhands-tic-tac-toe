import app from './app.js';
import { startMatchmaker } from './worker/spawnMatchmaker.js';

const PORT = 3000;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

const matchmaker = startMatchmaker();

const shutdown = async () => {
  server.close();
  await matchmaker.stop();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
