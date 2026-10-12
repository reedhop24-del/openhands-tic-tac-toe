export const STATUS = {
  IN_PROGRESS: 'in_progress',
  X_WON: 'X_won',
  O_WON: 'O_won',
  DRAW: 'draw',
};

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const calculateWinner = (board) => {
  const line = WIN_LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
  return line ? board[line[0]] : null;
};

export const calculateStatus = (board) => {
  const winner = calculateWinner(board);
  if (winner) return `${winner}_won`;
  return board.every(Boolean) ? STATUS.DRAW : STATUS.IN_PROGRESS;
};

export const isGameOver = (status) => status !== STATUS.IN_PROGRESS;
