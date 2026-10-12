import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStatus, calculateWinner, isGameOver, STATUS } from '../services/gameRules.js';

const board = (cells) => cells.split('').map((c) => (c === '-' ? null : c));

test('empty board is in progress', () => {
  assert.equal(calculateStatus(board('---------')), STATUS.IN_PROGRESS);
});

test('partially filled board with no line is in progress', () => {
  assert.equal(calculateStatus(board('XO-X-----')), STATUS.IN_PROGRESS);
});

test('detects every winning line for X', () => {
  const wins = [
    'XXX------', '---XXX---', '------XXX',
    'X--X--X--', '-X--X--X-', '--X--X--X',
    'X---X---X', '--X-X-X--',
  ];
  for (const cells of wins) {
    assert.equal(calculateStatus(board(cells)), STATUS.X_WON, cells);
  }
});

test('detects every winning line for O', () => {
  const wins = [
    'OOO------', '---OOO---', '------OOO',
    'O--O--O--', '-O--O--O-', '--O--O--O',
    'O---O---O', '--O-O-O--',
  ];
  for (const cells of wins) {
    assert.equal(calculateStatus(board(cells)), STATUS.O_WON, cells);
  }
});

test('full board with no line is a draw', () => {
  assert.equal(calculateStatus(board('XOXXOOOXX')), STATUS.DRAW);
});

test('a win on the last space is a win, not a draw', () => {
  assert.equal(calculateStatus(board('XOXOXOOXX')), STATUS.X_WON);
});

test('two in a row with the third taken by the opponent is not a win', () => {
  assert.equal(calculateStatus(board('XXO------')), STATUS.IN_PROGRESS);
});

test('calculateWinner returns the winning mark', () => {
  assert.equal(calculateWinner(board('XXX------')), 'X');
  assert.equal(calculateWinner(board('--O-O-O--')), 'O');
  assert.equal(calculateWinner(board('XOXOXOOXX')), 'X');
});

test('calculateWinner returns null for in-progress and draw boards', () => {
  assert.equal(calculateWinner(board('---------')), null);
  assert.equal(calculateWinner(board('XO-X-----')), null);
  assert.equal(calculateWinner(board('XOXXOOOXX')), null);
});

test('isGameOver is false only while in progress', () => {
  assert.equal(isGameOver(STATUS.IN_PROGRESS), false);
  assert.equal(isGameOver(STATUS.X_WON), true);
  assert.equal(isGameOver(STATUS.O_WON), true);
  assert.equal(isGameOver(STATUS.DRAW), true);
});
