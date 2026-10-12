import { useCallback, useEffect, useRef, useState } from 'react';
import { getToken, getGameByToken, getGame } from '../api/gameApi.js';

const POLL_MS = 2000;

// Requests a session token, polls until the worker matches it with another user,
// then keeps polling the game itself so the opponent's moves show up.
export default function useMatchedGame() {
  const [token, setToken] = useState(null);
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  // Kept across StrictMode's dev-only effect re-run so one visit requests one token.
  const tokenRequest = useRef(null);

  // Ignore stale poll results that arrive after a newer version (e.g. our own move).
  const updateGame = useCallback((next) => {
    setGame((prev) => (!prev || next.version >= prev.version ? next : prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;

    // Phase 1: poll by token until matched. Phase 2: poll the game by id for updates.
    let gameId = null;

    const poll = async (sessionToken) => {
      try {
        const found = gameId ? await getGame(gameId) : await getGameByToken(sessionToken);
        if (cancelled) return;
        if (found) {
          if (!gameId) setPlayer(found.player);
          gameId = found.id;
          updateGame(found);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
      }
      timer = setTimeout(() => poll(sessionToken), POLL_MS);
    };

    tokenRequest.current ??= getToken();
    tokenRequest.current
      .then(({ token: sessionToken }) => {
        if (cancelled) return;
        setToken(sessionToken);
        poll(sessionToken);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [attempt, updateGame]);

  const restart = useCallback(() => {
    tokenRequest.current = null;
    setToken(null);
    setGame(null);
    setPlayer(null);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { token, game, player, updateGame, error, restart };
}
