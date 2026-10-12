import { matchPlayers } from '../services/matchmakingService.js';
import { disconnect } from '../db/database.js';

const INTERVAL_MS = 5000;

let timer;
let stopping = false;

// Schedules the next run only after the current one finishes, so runs never overlap.
const tick = async () => {
  try {
    const game = await matchPlayers();
    if (game) console.log(`Matched 2 players into game ${game.id}`);
  } catch (err) {
    console.error('Matchmaking failed:', err);
  }
  if (!stopping) timer = setTimeout(tick, INTERVAL_MS);
};

const shutdown = async () => {
  stopping = true;
  clearTimeout(timer);
  await disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Only fires when forked: exit if the parent process goes away.
process.on('disconnect', shutdown);

console.log(`Matchmaker running every ${INTERVAL_MS / 1000}s`);
tick();
