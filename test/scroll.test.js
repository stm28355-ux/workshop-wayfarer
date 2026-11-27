import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOf, numberAt, rulesHold, solve, generate, difficulty, rng } from '../src/core/scroll.js';
import { TRIAL, skillGain } from '../src/data/dojo.js';

test('数えるマス：土台はまわり8マス、十字は上下左右2マスずつ', () => {
  assert.deepEqual(areaOf(5, 5, [], 0).sort((a, b) => a - b), [1, 5, 6]);
  assert.equal(areaOf(5, 5, [], 12).length, 8);
  assert.deepEqual(areaOf(5, 5, ['cross'], 12).sort((a, b) => a - b), [2, 7, 10, 11, 13, 14, 17, 22]);
  assert.deepEqual(areaOf(5, 5, ['cross'], 0).sort((a, b) => a - b), [1, 2, 5, 10]);
});

test('変えルール：連結はつながっているか、組は2つずつで組どうし接しないか', () => {
  const m = (cells) => { const a = Array(9).fill(false); cells.forEach((i) => { a[i] = true; }); return a; };
  assert.equal(rulesHold(3, 3, ['connect'], m([0, 1, 4])), true);
  assert.equal(rulesHold(3, 3, ['connect'], m([0, 8])), false);
  assert.equal(rulesHold(3, 3, ['pair'], m([0, 1, 6, 7])), true);
  assert.equal(rulesHold(3, 3, ['pair'], m([0, 1, 2])), false, '3つ並びは組でない');
  assert.equal(rulesHold(3, 3, ['pair'], m([0, 1, 4, 5])), false, '組どうしが接している（1と4）');
});

test('手で作った盤を推理だけで解く。数字1つで決まる手は段1', () => {
  // 3×3、罠は右下だけ。左上の0を開けると、まわりが全部安全と分かる
  const mines = Array(9).fill(false);
  mines[8] = true;
  const p = { w: 3, h: 3, rules: [], count: 1, mines, shown: [0] };
  assert.equal(numberAt(p, 0), 0);
  const r = solve(p);
  assert.equal(r.solved, true);
  assert.equal(r.steps[0].level, 1);
  assert.deepEqual(r.steps[0].safe.sort(), [1, 3, 4]);
});

test('同じ種なら同じ盤、乱数も同じ並び', () => {
  const a = rng(5), b = rng(5);
  assert.equal(a(), b());
  const s = { w: 5, h: 5, count: 5, rules: [], seed: 3 };
  assert.equal(JSON.stringify(generate(s).puzzle), JSON.stringify(generate(s).puzzle));
});

test('試しの6問は、推理だけで全部解ける（答えが1つ）', () => {
  for (const t of TRIAL) {
    const g = generate(t);
    assert.ok(g, `${t.name} が作れない`);
    const r = solve(g.puzzle);
    assert.ok(r.solved, `${t.name} が解けない`);
    assert.ok(difficulty(r).max <= t.maxLevel);
    assert.ok(rulesHold(t.w, t.h, t.rules, g.puzzle.mines));
    assert.equal(g.puzzle.mines.filter(Boolean).length, t.count);
  }
});

test('連結と組は両立しないので作れない', () => {
  assert.equal(generate({ w: 6, h: 6, count: 10, rules: ['connect', 'pair'], seed: 1 }), null);
});

test('熟練：解くと3、ミス1回につき −1、最低1', () => {
  assert.equal(skillGain(0), 3);
  assert.equal(skillGain(1), 2);
  assert.equal(skillGain(5), 1);
});
