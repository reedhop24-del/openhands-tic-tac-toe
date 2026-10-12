import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WORKER_PATH = fileURLToPath(new URL('./matchmaker.js', import.meta.url));
const RESTART_DELAY_MS = 1000;

// Forks the matchmaker as a child process and restarts it if it dies unexpectedly.
// `stop()` terminates it for good and resolves once it has exited.
export const startMatchmaker = () => {
  let child;
  let stopped = false;

  const spawn = () => {
    if (stopped) return;
    child = fork(WORKER_PATH);
    child.on('exit', (code, signal) => {
      if (stopped) return;
      console.error(`Matchmaker exited (code ${code}, signal ${signal}), restarting`);
      setTimeout(spawn, RESTART_DELAY_MS);
    });
  };

  const stop = () =>
    new Promise((resolve) => {
      stopped = true;
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      child.once('exit', resolve);
      child.kill('SIGTERM');
    });

  spawn();
  return { stop, getPid: () => child.pid };
};
