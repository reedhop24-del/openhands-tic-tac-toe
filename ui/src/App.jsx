import { useState } from 'react';
import Board from './components/Board.jsx';
import useMatchedGame from './hooks/useMatchedGame.js';
import { makeMove } from './api/gameApi.js';

export default function App() {
  const { token, game, player, updateGame, error, restart } = useMatchedGame();
  const [moveError, setMoveError] = useState(null);

  // Each session plays one fixed mark; the board is locked unless it is our turn.
  // Beyond that the service decides if a move is legal.
  const handleSquareClick = async (index) => {
    try {
      updateGame(await makeMove(game.id, player, index));
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
          <p>
            You are: {player} | Next to play: {game.currentPlayer}
          </p>
          <Board
            board={game.board}
            onSquareClick={handleSquareClick}
            disabled={game.currentPlayer !== player}
          />
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
