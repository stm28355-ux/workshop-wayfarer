import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crafterMerge } from '../src/core/crafter.js';
import { createBoard } from '../src/core/board.js';
import { createGame, advance, buyUpgrade, upgradeCheck, upgradeCost, mergeCrafterTicks, mergeCrafterRank } from '../src/core/game.js';

const I1 = { kind: 'iron', rank: 1 };
const F1 = { kind: 'fire', rank: 1 };
const I2 = { kind: 'iron', rank: 2 };

function board(cells) {
  const b = createBoard(5, 4);
  cells.forEach((c, i) => { b.cells[i] = c; });
  return b;
}

test('隣り合っていなくても3個集めて合わせ、左上に置く', () => {
  const b = board([I1, null, null, F1, null, null, null, I1, null, null, null, null, null, null, I1]);
  const r = crafterMerge(b, 1);
  assert.deepEqual(r.merged, { kind: 'iron', from: 1, rank: 2, used: 3, made: 1, at: [0] });
  assert.deepEqual(r.board.cells[0], I2);
  assert.equal(r.board.cells[7], null);
  assert.equal(r.board.cells[14], null);
});

test('5個あれば5個で2個作る', () => {
  const b = board([I1, I1, F1, I1, I1, I1]);
  const r = crafterMerge(b, 1);
  assert.equal(r.merged.used, 5);
  assert.deepEqual(r.board.cells.slice(0, 6), [I2, I2, F1, null, null, null]);
});

test('低いランクから。腕より上のランクは合わせない', () => {
  const b = board([I2, I2, I2, F1, F1, F1]);
  assert.equal(crafterMerge(b, 1).merged.kind, 'fire');
  const only2 = board([I2, I2, I2]);
  assert.equal(crafterMerge(only2, 1).merged, null);
  assert.equal(crafterMerge(only2, 2).merged.rank, 3);
});

test('人が触っているマスは数えない', () => {
  const b = board([I1, I1, I1]);
  assert.equal(crafterMerge(b, 1, [2]).merged, null);
});

test('マージの職人は地域2のボスの後、3秒に1回', () => {
  let s = createGame();
  s.board.cells[0] = I1; s.board.cells[5] = I1; s.board.cells[9] = I1;
  s.run.prep = 1e9;
  assert.equal(advance(s, 40).events.filter((e) => e.type === 'crafterMerge').length, 0, 'まだ来ていない');
  s.open.unlocks.push('crafter:merge');
  const r = advance(s, 30);
  assert.equal(r.events.filter((e) => e.type === 'crafterMerge').length, 1);
  assert.equal(r.state.stats.crafterMerges, 1);
  assert.equal(mergeCrafterTicks(s), 30);
});

test('工房：盤を広げる（列と段を交互に7×6まで）、職人の腕と速さ', () => {
  let s = createGame();
  assert.equal(upgradeCheck(s, 'widen').ok, false, '工房はまだ');
  s.open.exits.push('workshop');
  s.stock.workshop = 10000;
  const sizes = [];
  for (let i = 0; i < 4; i++) {
    assert.equal(upgradeCost(s, 'widen'), 50 * 2 ** i);
    s = buyUpgrade(s, 'widen').state;
    sizes.push(`${s.board.w}x${s.board.h}`);
  }
  assert.deepEqual(sizes, ['6x4', '6x5', '7x5', '7x6']);
  assert.equal(upgradeCheck(s, 'widen').ok, false, 'もう一番広い');
  assert.equal(upgradeCheck(s, 'arm').ok, false, 'マージの職人がまだ');
  s.open.unlocks.push('crafter:merge');
  assert.equal(upgradeCost(s, 'arm'), 30);
  s = buyUpgrade(s, 'arm').state;
  assert.equal(upgradeCost(s, 'arm'), 90);
  assert.equal(mergeCrafterRank(s), 2);
  s = buyUpgrade(s, 'speed').state;
  assert.equal(mergeCrafterTicks(s), 24);
  assert.equal(s.stock.workshop, 10000 - (50 + 100 + 200 + 400) - 30 - 20);
});
