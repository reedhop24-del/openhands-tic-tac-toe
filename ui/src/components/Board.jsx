const cellStyle = {
  width: 80,
  height: 80,
  fontSize: 32,
  cursor: 'pointer',
};

export default function Board({ board, onSquareClick, disabled = false }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gap: 4 }}>
      {board.map((value, index) => (
        <button
          key={index}
          style={cellStyle}
          disabled={disabled}
          onClick={() => onSquareClick(index)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
