import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getGame, makeMove } from '../services/gameService.js';
import { findVersions } from '../db/database.js';

test('makeMove places the player mark on the board', async () => {
  const { id } = await createGame();
  const game = await makeMove(id, { player: 'X', move: 4 });
  assert.equal(game.board[4], 'X');
  assert.equal(game.board.filter(Boolean).length, 1);
});

test('makeMove increments the version on each move', async () => {
  const { id, version } = await createGame();
  const first = await makeMove(id, { player: 'X', move: 0 });
  assert.equal(first.version, version + 1);
  const second = await makeMove(id, { player: 'O', move: 1 });
  assert.equal(second.version, version + 2);
});

test('makeMove persists the mutated game', async () => {
  const { id } = await createGame();
  await makeMove(id, { player: 'X', move: 2 });
  const stored = await getGame(id);
  assert.equal(stored.board[2], 'X');
  assert.equal(stored.version, 2);
});

test('createGame stores an initial version with no player', async () => {
  const { id } = await createGame();
  const versions = await findVersions(id);
  assert.equal(versions.length, 1);
  assert.deepEqual(versions[0], {
    version: 1,
    board: Array(9).fill(null),
    player: null,
    move: null,
  });
});

test('makeMove appends a board snapshot per version, keyed by gameId', async () => {
  const { id } = await createGame();
  const other = await createGame();
  await makeMove(id, { player: 'X', move: 0 });
  await makeMove(id, { player: 'O', move: 8 });

  const versions = await findVersions(id);
  assert.deepEqual(
    versions.map(({ version, player, move }) => ({ version, player, move })),
    [
      { version: 1, player: null, move: null },
      { version: 2, player: 'X', move: 0 },
      { version: 3, player: 'O', move: 8 },
    ],
  );
  assert.equal(versions[1].board[0], 'X');
  assert.equal(versions[1].board[8], null);
  assert.equal(versions[2].board[8], 'O');
  assert.equal((await findVersions(other.id)).length, 1);
});

test('makeMove accepts a numeric string index', async () => {
  const { id } = await createGame();
  const game = await makeMove(id, { player: 'X', move: '3' });
  assert.equal(game.board[3], 'X');
  assert.equal((await findVersions(id)).at(-1).move, 3);
});

test('makeMove rejects an unknown game with 404', async () => {
  await assert.rejects(makeMove('missing', { player: 'X', move: 0 }), { status: 404 });
});

test('makeMove rejects an invalid player with 400', async () => {
  const { id } = await createGame();
  await assert.rejects(makeMove(id, { player: 'Z', move: 0 }), { status: 400 });
  await assert.rejects(makeMove(id, { move: 0 }), { status: 400 });
});

test('makeMove rejects out-of-range or non-integer moves with 400', async () => {
  const { id } = await createGame();
  for (const move of [-1, 9, 1.5, 'abc', '', null, undefined]) {
    await assert.rejects(makeMove(id, { player: 'X', move }), { status: 400 }, `move=${move}`);
  }
});

test('makeMove rejects an occupied space with 409 and leaves state untouched', async () => {
  const { id } = await createGame();
  await makeMove(id, { player: 'X', move: 5 });
  await assert.rejects(makeMove(id, { player: 'O', move: 5 }), { status: 409 });
  const stored = await getGame(id);
  assert.equal(stored.board[5], 'X');
  assert.equal(stored.version, 2);
  assert.equal((await findVersions(id)).length, 2);
});

test('first move must be X', async () => {
  const { id } = await createGame();
  await assert.rejects(makeMove(id, { player: 'O', move: 0 }), {
    status: 409,
    message: 'Not your turn: X plays next',
  });
  const stored = await getGame(id);
  assert.equal(stored.version, 1);
  assert.equal(stored.board[0], null);
});

test('the same player cannot move twice in a row', async () => {
  const { id } = await createGame();
  await makeMove(id, { player: 'X', move: 0 });
  await assert.rejects(makeMove(id, { player: 'X', move: 1 }), {
    status: 409,
    message: 'Not your turn: O plays next',
  });
  const stored = await getGame(id);
  assert.equal(stored.board[1], null);
  assert.equal(stored.version, 2);
  assert.equal((await findVersions(id)).length, 2);
});

test('players alternate X, O, X across several moves', async () => {
  const { id } = await createGame();
  await makeMove(id, { player: 'X', move: 0 });
  await makeMove(id, { player: 'O', move: 1 });
  const game = await makeMove(id, { player: 'X', move: 2 });
  assert.deepEqual(game.board.slice(0, 3), ['X', 'O', 'X']);
  assert.equal(game.version, 4);
});

test('currentPlayer starts as X and flips after each accepted move', async () => {
  const created = await createGame();
  assert.equal(created.currentPlayer, 'X');
  const afterX = await makeMove(created.id, { player: 'X', move: 0 });
  assert.equal(afterX.currentPlayer, 'O');
  const afterO = await makeMove(created.id, { player: 'O', move: 1 });
  assert.equal(afterO.currentPlayer, 'X');
  assert.equal((await getGame(created.id)).currentPlayer, 'X');
});

test('currentPlayer is unchanged after a rejected move', async () => {
  const { id } = await createGame();
  await makeMove(id, { player: 'X', move: 0 });
  await assert.rejects(makeMove(id, { player: 'X', move: 1 }), { status: 409 });
  await assert.rejects(makeMove(id, { player: 'O', move: 0 }), { status: 409 });
  assert.equal((await getGame(id)).currentPlayer, 'O');
});

test('currentPlayer always matches the player the versions store expects next', async () => {
  const { id } = await createGame();
  for (const [player, move] of [['X', 0], ['O', 1], ['X', 2]]) {
    const game = await makeMove(id, { player, move });
    const next = player === 'X' ? 'O' : 'X';
    assert.equal(game.currentPlayer, next);
    await assert.rejects(makeMove(id, { player, move: 8 }), { status: 409 });
  }
});

const play = async (id, moves) => {
  let game;
  for (const [player, move] of moves) game = await makeMove(id, { player, move });
  return game;
};

test('status stays in_progress while no one has won', async () => {
  const { id } = await createGame();
  const game = await play(id, [['X', 0], ['O', 1]]);
  assert.equal(game.status, 'in_progress');
});

test('X completing a line sets status X_won, visible via getGame', async () => {
  const { id } = await createGame();
  const game = await play(id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 2]]);
  assert.equal(game.status, 'X_won');
  assert.equal((await getGame(id)).status, 'X_won');
});

test('O completing a line sets status O_won', async () => {
  const { id } = await createGame();
  const game = await play(id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 8], ['O', 5]]);
  assert.equal(game.status, 'O_won');
  assert.equal((await getGame(id)).status, 'O_won');
});

test('filling the board with no line sets status draw', async () => {
  const { id } = await createGame();
  // X O X / X O O / O X X
  const game = await play(id, [
    ['X', 0], ['O', 1], ['X', 2],
    ['O', 4], ['X', 3], ['O', 5],
    ['X', 7], ['O', 6], ['X', 8],
  ]);
  assert.equal(game.status, 'draw');
  assert.equal((await getGame(id)).status, 'draw');
});

test('winner is null on a new game and while in progress', async () => {
  const created = await createGame();
  assert.equal(created.winner, null);
  const game = await makeMove(created.id, { player: 'X', move: 0 });
  assert.equal(game.winner, null);
});

test('winner is X when X wins, visible via getGame', async () => {
  const { id } = await createGame();
  const game = await play(id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 2]]);
  assert.equal(game.winner, 'X');
  assert.equal((await getGame(id)).winner, 'X');
});

test('winner is O when O wins', async () => {
  const { id } = await createGame();
  const game = await play(id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 8], ['O', 5]]);
  assert.equal(game.winner, 'O');
  assert.equal((await getGame(id)).winner, 'O');
});

test('winner is null on a draw', async () => {
  const { id } = await createGame();
  const game = await play(id, [
    ['X', 0], ['O', 1], ['X', 2],
    ['O', 4], ['X', 3], ['O', 5],
    ['X', 7], ['O', 6], ['X', 8],
  ]);
  assert.equal(game.status, 'draw');
  assert.equal(game.winner, null);
});

test('moves after a win are rejected with 400 and change nothing', async () => {
  const { id } = await createGame();
  await play(id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 2]]);
  const before = await getGame(id);
  const versions = (await findVersions(id)).length;
  await assert.rejects(makeMove(id, { player: 'O', move: 8 }), {
    status: 400,
    message: 'Game is over: X_won',
  });
  const after = await getGame(id);
  assert.equal(after.version, before.version);
  assert.equal(after.board[8], null);
  assert.equal((await findVersions(id)).length, versions);
});

test('moves after a draw are rejected with 400', async () => {
  const { id } = await createGame();
  await play(id, [
    ['X', 0], ['O', 1], ['X', 2],
    ['O', 4], ['X', 3], ['O', 5],
    ['X', 7], ['O', 6], ['X', 8],
  ]);
  await assert.rejects(makeMove(id, { player: 'O', move: 0 }), {
    status: 400,
    message: 'Game is over: draw',
  });
});

test('game-over check applies per game', async () => {
  const done = await createGame();
  const live = await createGame();
  await play(done.id, [['X', 0], ['O', 3], ['X', 1], ['O', 4], ['X', 2]]);
  const game = await makeMove(live.id, { player: 'X', move: 0 });
  assert.equal(game.status, 'in_progress');
});

test('turn order is tracked per game', async () => {
  const a = await createGame();
  const b = await createGame();
  await makeMove(a.id, { player: 'X', move: 0 });
  const game = await makeMove(b.id, { player: 'X', move: 0 });
  assert.equal(game.board[0], 'X');
});
