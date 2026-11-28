// 剣の巻物（ピクロス）：数字・解く道具・生成・試しの6問（判定表 第13回 B）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runsOf, countsOf, clueOf, makePuzzle, solveNono, nonoDifficulty, generateNono, linesOf } from '../src/core/nonogram.js';
import { SWORD_TRIAL } from '../src/data/sword.js';
import { createGame, feed, advance } from '../src/core/game.js';
import { rankValue } from '../src/core/rank.js';

test('数字：続けて塗る長さ。色の巻物は色ごとの塊（違う色はくっついてよい）。合計は塗る数だけ', () => {
  assert.deepEqual(runsOf([1, 1, 0, 1, 0]), [{ len: 2, color: 1 }, { len: 1, color: 1 }]);
  assert.deepEqual(runsOf([1, 2, 2, 0, 1]), [{ len: 1, color: 1 }, { len: 2, color: 2 }, { len: 1, color: 1 }]);
  assert.deepEqual(runsOf([0, 0, 0]), []);
  assert.deepEqual(countsOf([1, 2, 2, 0, 1], 2), [2, 2]);
  assert.deepEqual(clueOf([1, 0, 1], 1, true), { kind: 'sum', counts: [2] });
});

test('解く道具：1列ずつで解ける盤は手1・2だけ。答えが2つある盤は解けない', () => {
  // 十字の絵：どの線も数字だけで決まる
  const plus = [0, 1, 0, 1, 1, 1, 0, 1, 0];
  const r = solveNono(makePuzzle(3, 3, [], plus));
  assert.ok(r.solved);
  assert.deepEqual(r.know, plus);
  assert.ok(nonoDifficulty(r).max <= 2);
  // 斜めの2マス（答えが2つ：左上と右下、右上と左下）
  const diag = [1, 0, 0, 1];
  assert.equal(solveNono(makePuzzle(2, 2, [], diag)).solved, false);
});

test('鏡：左右対称を使って解ける。合計の線でも答えは1つ', () => {
  const sol = [1, 0, 1, 0, 1, 0, 1, 1, 1];
  const p = makePuzzle(3, 3, ['mirror'], sol);
  const r = solveNono(p);
  assert.ok(r.solved);
  assert.deepEqual(r.know, sol);
  const q = makePuzzle(3, 3, ['sum'], [1, 1, 0, 0, 1, 0, 0, 1, 1], [0]);
  assert.equal(q.clues.rows[0].kind, 'sum');
  const rq = solveNono(q);
  if (rq.solved) assert.deepEqual(rq.know, q.solution);
});

test('生成：種が同じなら同じ盤。答えは1つで、難しさの条件を守る', () => {
  for (const spec of [
    { w: 5, h: 5, rules: [], seed: 3, maxLevel: 2 },
    { w: 7, h: 7, rules: ['color'], seed: 5, maxLevel: 2, minRounds: 3 },
    { w: 7, h: 7, rules: ['sum', 'mirror'], seed: 2, maxLevel: 3, minLevel: 3, maxGlobal: 1 },
  ]) {
    const a = generateNono(spec);
    const b = generateNono(spec);
    assert.ok(a, `作れる：${JSON.stringify(spec)}`);
    assert.deepEqual(a.puzzle.solution, b.puzzle.solution);
    const r = solveNono(a.puzzle);
    assert.ok(r.solved);
    assert.deepEqual(r.know, a.puzzle.solution);
    const d = nonoDifficulty(a.result);
    assert.ok(d.max <= spec.maxLevel);
    if (spec.minLevel) assert.ok(d.max >= spec.minLevel);
    if (spec.maxGlobal !== undefined) assert.ok(d.by[3] <= spec.maxGlobal);
    if (spec.minRounds) assert.ok(d.by[2] >= spec.minRounds);
    if (spec.rules.includes('mirror')) {
      const { w, h, solution } = a.puzzle;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) assert.equal(solution[y * w + x], solution[y * w + (w - 1 - x)]);
    }
    if (spec.rules.includes('color')) assert.ok(a.puzzle.solution.includes(1) && a.puzzle.solution.includes(2));
  }
});

test('試しの6問：全部作れて、1枚0.3秒以内', () => {
  for (const t of SWORD_TRIAL) {
    const t0 = performance.now();
    const g = generateNono(t);
    const ms = performance.now() - t0;
    assert.ok(g, t.name);
    assert.ok(ms < 300, `${t.name} ${ms.toFixed(0)}ms`);
    assert.equal(linesOf(t.w, t.h).length, t.w + t.h);
  }
});

test('帳簿：あふれて支度に入った分を数える（判定表 第13回 D1）', () => {
  let s = createGame();
  s.board.cells = s.board.cells.map(() => ({ kind: 'iron', rank: 2 }));
  s.run.prep = 1e9;
  s.run.hp = 1e9;
  // 盤がいっぱいのまま敵を倒すと、落とし物はあふれる
  let r = { state: s, events: [] };
  for (let i = 0; i < 20000 && !r.events.some((e) => e.type === 'overflow'); i++) r = advance(r.state, 1);
  const ev = r.events.find((e) => e.type === 'overflow');
  assert.ok(ev);
  assert.equal(r.state.stats.fed.overflow.prep, rankValue(ev.item.rank));
  assert.ok(feed(r.state, 0, 'grow').ok);
});
