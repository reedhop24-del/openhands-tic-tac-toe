import { useEffect, useState } from 'react';
import Board from './components/Board.jsx';
import { createGame, makeMove } from './api/gameApi.js';

export default function App() {
  const [game, setGame] = useState(null);
  const [player, setPlayer] = useState('X');
  const [error, setError] = useState(null);

  const startGame = async () => {
    setError(null);
    setPlayer('X');
    setGame(await createGame());
  };

  useEffect(() => {
    startGame().catch((err) => setError(err.message));
  }, []);

  // No client-side validation: the service decides if a move is legal.
  const handleSquareClick = async (index) => {
    try {
      setGame(await makeMove(game.id, player, index));
      setPlayer((p) => (p === 'X' ? 'O' : 'X'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Tic Tac Toe</h1>
      {game && (
        <>
          <p>Next click plays as: {player}</p>
          <Board board={game.board} onSquareClick={handleSquareClick} />
          <p>
            Status: {game.status} | Winner: {game.winner ?? 'none'} | Server current player:{' '}
            {game.currentPlayer} | Version: {game.version}
          </p>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}
      <button onClick={() => startGame().catch((err) => setError(err.message))}>New game</button>
    </main>
  );
}
