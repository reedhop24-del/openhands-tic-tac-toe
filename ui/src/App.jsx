import { useState } from 'react';
import Board from './components/Board.jsx';
import useMatchedGame from './hooks/useMatchedGame.js';
import { makeMove } from './api/gameApi.js';

export default function App() {
  const { token, game, updateGame, error, restart } = useMatchedGame();
  const [moveError, setMoveError] = useState(null);

  // No client-side validation: the service decides if a move is legal.
  // The UI plays as whoever the server says is up next.
  const handleSquareClick = async (index) => {
    try {
      updateGame(await makeMove(game.id, game.currentPlayer, index));
      setMoveError(null);
    } catch (err) {
      setMoveError(err.message);
    }
  };

  const handleNewGame = () => {
    setMoveError(null);
    restart();
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Tic Tac Toe</h1>
      {!token && !error && <p>Requesting session...</p>}
      {token && !game && <p>Waiting for an opponent...</p>}
      {token && <p style={{ fontSize: 12, color: '#666' }}>Session: {token}</p>}
      {game && (
        <>
          <p>Next to play: {game.currentPlayer}</p>
          <Board board={game.board} onSquareClick={handleSquareClick} />
          <p>
            Status: {game.status} | Winner: {game.winner ?? 'none'} | Version: {game.version}
          </p>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      {moveError && <p style={{ color: 'crimson' }}>Move error: {moveError}</p>}
      <button onClick={handleNewGame}>New game</button>
    </main>
  );
}
