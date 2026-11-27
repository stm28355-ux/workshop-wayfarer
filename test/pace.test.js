// 釣り合いの物差し（判定表 第1回 C1）を数値の表が守っているかを確かめる。
// 数値を直したらここも見直す。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance } from '../src/core/game.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

// 判定表 第5回で歩く速さを2倍にしたので、1分ほど → 40〜80秒に広げた（今は45秒ほど）。
test('手を出さないと、地域1では1分弱（40〜80秒）で盤があふれ始める', () => {
  let s = createGame();
  let first = null;
  for (let t = 0; t < 200 * TICKS_PER_SEC && first === null; t++) {
    const r = advance(s, 1);
    s = r.state;
    if (r.events.some((e) => e.type === 'overflow')) first = s.tick / TICKS_PER_SEC;
  }
  assert.ok(first !== null && first >= 40 && first <= 80, `最初のあふれ ${first} 秒`);
});
