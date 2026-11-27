import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANK_MAX, rankValue, merge, mergeGain } from '../src/core/rank.js';

test('ランクごとに価値は3倍、ランク7は729', () => {
  assert.equal(rankValue(1), 1);
  assert.equal(rankValue(2), 3);
  assert.equal(rankValue(RANK_MAX), 729);
});

test('範囲の外のランクは受け付けない', () => {
  assert.throws(() => rankValue(0), RangeError);
  assert.throws(() => rankValue(8), RangeError);
  assert.throws(() => rankValue(1.5), RangeError);
});

test('3個で上のランク1個、5個で上のランク2個', () => {
  assert.deepEqual(merge(1, 3), { rank: 2, count: 1 });
  assert.deepEqual(merge(4, 5), { rank: 5, count: 2 });
});

test('3と5以外の数や、一番上のランクは合わせられない', () => {
  assert.equal(merge(1, 2), null);
  assert.equal(merge(1, 4), null);
  assert.equal(merge(RANK_MAX, 3), null);
});

test('3個合わせは損得なし、5個合わせは2割の得（判定表 第1回 D3）', () => {
  assert.equal(mergeGain(3), 1);
  assert.equal(mergeGain(5), 1.2);
  for (let r = 1; r < RANK_MAX; r++) {
    const m3 = merge(r, 3);
    assert.equal(m3.count * rankValue(m3.rank), 3 * rankValue(r));
    const m5 = merge(r, 5);
    assert.ok(m5.count * rankValue(m5.rank) > 5 * rankValue(r));
  }
});

test('同じ入力なら同じ結果', () => {
  assert.deepEqual(merge(3, 5), merge(3, 5));
});
