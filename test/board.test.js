import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoard, place, move, mergeAt, groupAt, takeAt, widen, emptyCount } from '../src/core/board.js';

const I1 = { kind: 'iron', rank: 1 };
const F1 = { kind: 'fire', rank: 1 };

// 文字で盤を作る。'.' は空き、'i' は鉄鉱1、'f' は炎の欠片1、'I' は鉄鉱2。
function board(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const b = createBoard(w, h);
  const map = { i: I1, f: F1, I: { kind: 'iron', rank: 2 } };
  rows.join('').split('').forEach((ch, i) => { b.cells[i] = map[ch] ? { ...map[ch] } : null; });
  return b;
}
function show(b) {
  const out = [];
  for (let y = 0; y < b.h; y++) {
    out.push(b.cells.slice(y * b.w, (y + 1) * b.w).map((c) => {
      if (!c) return '.';
      const ch = c.kind === 'iron' ? 'i' : 'f';
      return c.rank === 1 ? ch : c.rank === 2 ? ch.toUpperCase() : String(c.rank);
    }).join(''));
  }
  return out;
}

test('拾った物は左上から読む順の空きに置く。空きがなければあふれ', () => {
  let b = board(['i.', '..']);
  b = place(b, F1).board;
  assert.deepEqual(show(b), ['if', '..']);
  const full = board(['ii', 'ii']);
  const r = place(full, F1);
  assert.equal(r.index, null);
  assert.equal(r.board, full);
});

test('拾って3個そろっても勝手には合わせない', () => {
  let b = board(['ii...']);
  b = place(b, I1).board;
  assert.deepEqual(show(b), ['iii..']);
});

test('動かした先で3個つながると、動かした先に上のランク1個', () => {
  const b = board(['ii.', '..i']);
  const r = move(b, 5, 2);
  assert.deepEqual(show(r.board), ['..I', '...']);
  assert.equal(r.merged.used, 3);
  assert.equal(r.merged.made, 1);
});

test('5個つながると上のランク2個（動かした先と、その次に近いマス）', () => {
  const b = board(['iiii.', '....i']);
  const r = move(b, 9, 4);
  assert.equal(r.merged.used, 5);
  assert.equal(r.merged.made, 2);
  assert.deepEqual(r.merged.at, [4, 3]);
  assert.deepEqual(show(r.board), ['...II', '.....']);
});

test('4個は3個だけ使い、1個残る', () => {
  const b = board(['iii.', '...i']);
  const r = move(b, 7, 3);
  assert.equal(r.merged.used, 3);
  assert.equal(r.board.cells.filter((c) => c && c.rank === 1).length, 1);
  assert.equal(r.board.cells.filter((c) => c && c.rank === 2).length, 1);
});

test('違う種類は合わない', () => {
  const b = board(['ii.', 'f..']);
  const r = move(b, 3, 2);
  assert.equal(r.merged, null);
  assert.deepEqual(show(r.board), ['iif', '...']);
});

test('物の上に動かすと入れ替わり、そろえば合わせる', () => {
  const b = board(['iif', 'i..']);
  const r = move(b, 3, 2);
  // 右上に鉄鉱が来て左の2個とつながる。炎の欠片は鉄鉱の元の場所へ
  assert.equal(r.merged.used, 3);
  assert.deepEqual(show(r.board), ['..I', 'f..']);
});

test('つながりは上下左右だけ（斜めは数えない）', () => {
  const b = board(['i.', '.i']);
  assert.deepEqual(groupAt(b, 0), [0]);
});

test('mergeAt は2個以下や一番上のランクでは何もしない', () => {
  const b = board(['ii.']);
  assert.equal(mergeAt(b, 0).merged, null);
  const top = createBoard(3, 1);
  top.cells = [{ kind: 'iron', rank: 7 }, { kind: 'iron', rank: 7 }, { kind: 'iron', rank: 7 }];
  assert.equal(mergeAt(top, 0).merged, null);
});

test('元の盤は変えない（純粋な関数）', () => {
  const b = board(['ii.', '..i']);
  const before = JSON.stringify(b);
  move(b, 5, 2);
  place(b, F1);
  takeAt(b, 0);
  assert.equal(JSON.stringify(b), before);
});

test('取り出すと空く', () => {
  const r = takeAt(board(['if']), 1);
  assert.deepEqual(r.item, F1);
  assert.equal(emptyCount(r.board), 1);
});

test('広げても物は同じ場所に残る', () => {
  const b = widen(board(['if', 'f.']), 3, 3);
  assert.deepEqual(show(b), ['if.', 'f..', '...']);
  assert.throws(() => widen(b, 2, 3), RangeError);
});
