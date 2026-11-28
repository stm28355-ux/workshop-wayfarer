// 工程7c：魔法の巻物（属性の数独）・弓の巻物（鏡で光を通す）・2つの15節。判定表 第18回。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import {
  startScroll, scrollPlace, scrollNote, scrollMirror, scrollMark, scrollTech, scrollCheck, isNodeOpen, levelOf,
  shapeKey, shapeName, shapeOf, beamCells, sudoLeft, beamLeft, DISCIPLE_BRANCHES,
} from '../src/core/dojo.js';
import {
  generateSudo, countSolutions, checkSolution, solveSudo, reacts, nextInCycle, edgesOf, makeSudo,
} from '../src/core/sudoku.js';
import { generateBeams, countBeams, checkBeams, trace, makeBeams, SLASH, BACK, ROCK, EMPTY } from '../src/core/mirrors.js';
import { MAGIC_TREE, magicSpec } from '../src/data/magic.js';
import { BOW_TREE, bowSpec } from '../src/data/bow.js';
import { SCHOOLS } from '../src/data/schools.js';

function opened() {
  const s = createGame();
  s.open.unlocks.push('stage:dojo', 'school:guard', 'school:sword', 'school:magic', 'school:bow');
  return s;
}

test('属性の数独：反応する組と巡りの順（火→水→氷→雷→火）', () => {
  assert.ok(reacts(4, 1, 3) && reacts(4, 3, 1) && reacts(4, 1, 2) && reacts(4, 0, 2));
  assert.ok(!reacts(4, 0, 1) && !reacts(4, 0, 3) && !reacts(4, 2, 3));
  assert.ok(reacts(6, 0, 4) && reacts(6, 1, 5) && !reacts(4, 0, 4));
  assert.deepEqual([0, 1, 2, 3, 4].map(nextInCycle), [1, 2, 3, 0, -1]);
});

test('属性の数独：作った盤は答えが1つで、決めた手だけで解ける', () => {
  const specs = [
    { n: 4, rules: [], maxLevel: 1 },
    { n: 4, rules: ['react'], maxLevel: 2 },
    { n: 6, rules: ['cycle'], maxLevel: 2 },
    { n: 6, rules: ['cage'], maxLevel: 2 },
    { n: 6, rules: ['react', 'cage'], maxLevel: 3, maxGlobal: 1 },
  ];
  for (const sp of specs) {
    const g = generateSudo({ ...sp, seed: 7 });
    assert.ok(g, JSON.stringify(sp));
    const p = g.puzzle;
    assert.equal(countSolutions(p, 2), 1);
    assert.ok(checkSolution(p, p.solution));
    const r = solveSudo(p, { maxLevel: sp.maxLevel });
    assert.ok(r.solved);
    assert.ok(r.by[3] <= (sp.maxGlobal ?? 0));
    if (sp.rules.includes('react')) {
      // 印は反応する組の所に全部あり、それ以外にはない
      const marked = new Set(p.marks.map(([a, b]) => `${a},${b}`));
      for (const [a, b] of edgesOf(p.n)) assert.equal(marked.has(`${a},${b}`), reacts(p.n, p.solution[a], p.solution[b]));
    }
    if (sp.rules.includes('cycle')) {
      for (const line of p.lines) for (let k = 0; k + 1 < line.length; k++) assert.equal(p.solution[line[k + 1]], nextInCycle(p.solution[line[k]]));
    }
    if (sp.rules.includes('cage')) {
      for (const cage of p.cages) assert.equal(new Set(cage.map((c) => p.solution[c])).size, cage.length);
    }
  }
});

test('属性の数独：同じ行に同じ属性があれば答えではない', () => {
  const sol = [0, 1, 2, 3, 2, 3, 0, 1, 1, 0, 3, 2, 3, 2, 1, 0];
  const p = makeSudo(4, [], sol);
  assert.ok(checkSolution(p, sol));
  const bad = sol.slice();
  [bad[0], bad[1]] = [bad[1], bad[0]];
  assert.equal(checkSolution(p, bad), false);
});

test('鏡：／ と ＼ で光が曲がり、岩で止まる', () => {
  // 3×3。左の段1から入って、真ん中の ／ で上へ曲がり、上の列1から出る
  const cells = [0, 0, 0, 0, SLASH, 0, 0, 0, 0];
  const r = trace(3, 3, cells, { side: 'left', at: 1 });
  assert.deepEqual(r.out, { side: 'top', at: 1 });
  assert.deepEqual(r.hits, [4]);
  const r2 = trace(3, 3, [0, 0, 0, 0, BACK, 0, 0, 0, 0], { side: 'left', at: 1 });
  assert.deepEqual(r2.out, { side: 'bottom', at: 1 });
  const r3 = trace(3, 3, [0, 0, 0, 0, ROCK, 0, 0, 0, 0], { side: 'left', at: 1 });
  assert.equal(r3.stop, 'rock');
});

test('鏡：作った盤は答えが1つで、答えは決まりを満たす。行と列の鏡の数がいつも出る', () => {
  for (const rules of [[], ['color'], ['break'], ['label']]) {
    const g = generateBeams({ w: 5, h: 5, rules, seed: 3 });
    assert.ok(g, rules.join());
    const p = g.puzzle;
    assert.ok(checkBeams(p, p.solution));
    assert.equal(countBeams(p, 2), 1);
    assert.equal(p.rowCounts.length, 5);
    const mirrors = p.solution.filter((v) => v === SLASH || v === BACK).length;
    assert.equal(p.rowCounts.reduce((a, b) => a + b, 0), mirrors);
    if (rules.includes('color')) assert.ok(p.bows.every((b) => b.color));
    if (rules.includes('label')) assert.ok(p.bows.every((b) => b.label) && p.targets.every((t) => t.label));
  }
});

test('鏡：置いた鏡に光が当たらない盤は答えではない', () => {
  const g = generateBeams({ w: 5, h: 5, rules: [], seed: 5 });
  const p = g.puzzle;
  const extra = p.solution.slice();
  const free = extra.findIndex((v, i) => v === EMPTY && !trace(5, 5, p.solution, p.bows[0]).cells.includes(i) && p.bows.every((b) => !trace(5, 5, p.solution, b).cells.includes(i)));
  if (free >= 0) {
    extra[free] = SLASH;
    const q = makeBeams(5, 5, ['nocount'], p.solution, p.bows, p.targets, []);
    assert.equal(checkBeams(q, extra), false);
  }
});

test('魔法と弓は15節ずつ。奥義は技の節2つが 3/5、合流は別の流派の技と', () => {
  assert.equal(MAGIC_TREE.length, 15);
  assert.equal(BOW_TREE.length, 15);
  assert.deepEqual(Object.keys(SCHOOLS), ['guard', 'sword', 'magic', 'bow']);
  const closed = createGame();
  closed.open.unlocks.push('stage:dojo');
  assert.match(scrollCheck(closed, 'eishou').reason, /魔法/);
  const s = opened();
  assert.ok(isNodeOpen(s, 'eishou') && isNodeOpen(s, 'tsuru'));
  s.dojo.nodes.kakyu = { skill: 6 };
  s.dojo.nodes.hyoso = { skill: 4 };
  assert.equal(isNodeOpen(s, 'inseki'), false);
  s.dojo.nodes.hyoso = { skill: 6 };
  assert.equal(isNodeOpen(s, 'inseki'), true);
  s.dojo.nodes.raigeki = { skill: 2 };
  assert.equal(isNodeOpen(s, 'mahouken'), false, '剣の十字斬りも要る');
  s.dojo.nodes.jujigiri = { skill: 2 };
  assert.equal(isNodeOpen(s, 'mahouken'), true);
  s.dojo.nodes.neraiuchi = { skill: 2 };
  assert.equal(isNodeOpen(s, 'kooriya'), true, '氷の矢は狙い撃ちと氷の槍');
  for (const b of ['炎', '水氷', '雷', '速射', '狙い', '風']) assert.ok(DISCIPLE_BRANCHES.includes(b));
});

test('巻物の形：魔法は 2/5 まで 4×4、3/5 から 6×6。弓は 5×5 と 7×7。形の名前', () => {
  const kakyu = MAGIC_TREE.find((n) => n.id === 'kakyu');
  assert.deepEqual([magicSpec(kakyu, 0).n, magicSpec(kakyu, 2).n], [4, 6]);
  assert.deepEqual(magicSpec(kakyu, 3).rules, ['react', 'cycle']);
  const rensha = BOW_TREE.find((n) => n.id === 'rensha');
  assert.deepEqual([bowSpec(rensha, 1).w, bowSpec(rensha, 2).w], [5, 7]);
  const k = shapeKey(magicSpec(kakyu, 0));
  assert.equal(k, 'sudo/react:4x4');
  assert.equal(shapeName(k), '魔法 反応 4×4');
  assert.equal(shapeName(shapeKey(bowSpec(rensha, 3))), '弓 割れる鏡＋色 7×7');
});

test('魔法の巻物：置く・候補の印・置き間違いはミスで正しい属性に直る。解くと熟練と形を覚える', () => {
  let s = startScroll(opened(), 'eishou').state;
  const sc = s.dojo.scroll;
  assert.equal(sc.kind, 'sudo');
  const p = sc.puzzle;
  const empties = p.solution.map((_, i) => i).filter((i) => !p.givens.includes(i));
  const first = empties[0];
  // 候補の印（ミスにならない）
  s = scrollNote(s, first, 1).state;
  assert.deepEqual(s.dojo.scroll.notes[first], [1]);
  // 間違い
  const wrongV = (p.solution[first] + 1) % p.n;
  s = scrollPlace(s, first, wrongV).state;
  assert.equal(s.dojo.scroll.mistakes, 1);
  assert.equal(s.dojo.scroll.values[first], p.solution[first]);
  assert.equal(s.dojo.scroll.notes[first], undefined);
  assert.equal(scrollPlace(s, first, p.solution[first]).ok, false, 'もう入っているマスには置けない');
  // 残りを正しく置く
  for (const i of empties.slice(1)) if (s.dojo.scroll) s = scrollPlace(s, i, p.solution[i]).state;
  assert.equal(s.dojo.scroll, null);
  assert.equal(levelOf(s, 'eishou'), 1, 'ミス1回で熟練2＝1段');
  assert.ok(s.dojo.shapes.includes('sudo/base:4x4'));
});

test('弓の巻物：鏡を置く・×・置き間違いはミス。光の通る盤を描ける。解くと熟練', () => {
  let s = startScroll(opened(), 'tsuru').state;
  const sc = s.dojo.scroll;
  assert.equal(sc.kind, 'beam');
  const p = sc.puzzle;
  const mirrors = p.solution.map((v, i) => [v, i]).filter(([v, i]) => (v === SLASH || v === BACK) && !p.shown.includes(i));
  assert.equal(beamLeft(sc), mirrors.length);
  // 空きのマスに鏡を置くとミスで、確かな空きになる
  const empty = p.solution.findIndex((v, i) => v === EMPTY && !p.shown.includes(i));
  s = scrollMirror(s, empty, SLASH).state;
  assert.equal(s.dojo.scroll.mistakes, 1);
  assert.ok(s.dojo.scroll.sureX.includes(empty));
  // × は自分の印
  const other = p.solution.findIndex((v, i) => v === EMPTY && !p.shown.includes(i) && i !== empty);
  if (other >= 0) {
    s = scrollMark(s, other).state;
    assert.ok(s.dojo.scroll.xs.includes(other));
    assert.equal(scrollMirror(s, other, SLASH).ok, false, '×のマスには置けない');
  }
  for (const [v, i] of mirrors) if (s.dojo.scroll) s = scrollMirror(s, i, v).state;
  assert.equal(s.dojo.scroll, null);
  assert.equal(levelOf(s, 'tsuru'), 1);
});

test('光の盤：置いた鏡と見えている鏡で光をたどれる', () => {
  const s = startScroll(opened(), 'tsuru').state;
  const sc = s.dojo.scroll;
  const cells = beamCells(sc);
  assert.equal(cells.length, sc.puzzle.w * sc.puzzle.h);
  for (const [i, v] of sc.puzzle.solution.entries()) if (v === ROCK) assert.equal(cells[i], ROCK);
});

test('魔法と弓の修行中の技は答えを見せる', () => {
  const s0 = opened();
  s0.dojo.nodes = { eishou: { skill: 2 }, hinokokoro: { skill: 2 } };
  let s = startScroll(s0, 'kakyu').state;
  const p = s.dojo.scroll.puzzle;
  assert.equal(s.dojo.scroll.techs.kakyu, 1);
  const before = sudoLeft(s.dojo.scroll);
  const at = p.solution.findIndex((_, i) => !p.givens.includes(i) && (i % p.n) < p.n - 1 && !p.givens.includes(i + 1));
  s = scrollTech(s, 'kakyu', at).state;
  assert.equal(sudoLeft(s.dojo.scroll), before - 2);
  assert.equal(s.dojo.scroll.values[at], p.solution[at]);
  const b0 = opened();
  b0.dojo.nodes = { tsuru: { skill: 2 }, me: { skill: 2 } };
  let b = startScroll(b0, 'neraiuchi').state;
  b = scrollTech(b, 'neraiuchi', 12).state;
  assert.equal(b.dojo.scroll.hints[0].tech, 'neraiuchi');
  assert.equal(typeof b.dojo.scroll.hints[0].value, 'number');
  void shapeOf;
});

// ───── 属性と状態（判定表 第18回 D） ─────
import { newLine, heroAct, enemyAct, tickFight, isFrozen, compareDummy } from '../src/core/lineup.js';
import { ELEMENT_STATES as ES } from '../src/data/cards.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

function ctxOf(cards, f = {}) {
  const hero = { atk: 10, attackTicks: 10, maxHp: 100, guard: 0, taken: 1, cast: 1 };
  const fight = { hp: 1e9, maxHp: 1e9, atk: 5, enemyTicks: 10, heroCd: 0, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, ...f };
  return { tick: 0, hero, cards, levels: {}, recast: 20, line: newLine(), f: fight, run: { hp: 100 }, events: [] };
}

test('燃焼：火球で付き、3秒ごとに攻撃×0.3 を5回。濡れていると火は半分で燃焼は付かない', () => {
  const c = ctxOf(['kakyu']);
  const d = heroAct(c);
  assert.ok(Math.abs(d - 15) < 1e-9);
  assert.equal(c.f.burn.left, ES.burnTimes);
  let burn = 0;
  for (let t = 1; t <= 15 * TICKS_PER_SEC; t++) { c.tick = t; burn += tickFight(c); }
  assert.ok(Math.abs(burn - 10 * 0.3 * 5) < 1e-9);
  const w = ctxOf(['kakyu'], { wetUntil: 100 });
  assert.ok(Math.abs(heroAct(w) - 7.5) < 1e-9);
  assert.equal(w.f.burn, undefined);
});

test('凍結：氷は2回で凍る。濡れていれば1回。凍っている間は敵が動かず、打撃は3倍で解ける', () => {
  const c = ctxOf(['hyoso', 'hyoso']);
  heroAct(c);
  assert.equal(isFrozen(c.f, c.tick), false);
  c.f.heroCd = 0;
  heroAct(c);
  assert.ok(isFrozen(c.f, c.tick));
  c.f.enemyCd = 0;
  assert.equal(enemyAct(c), 0, '凍っている敵は攻撃しない');
  const wet = ctxOf(['matou', 'hyoso']);
  heroAct(wet);
  wet.f.heroCd = 0;
  heroAct(wet);
  assert.ok(isFrozen(wet.f, wet.tick), '水をまとった氷の槍は1回で凍る');
  const s = ctxOf(['strong'], { frozenUntil: 50 });
  assert.ok(Math.abs(heroAct(s) - 10 * 3 * 3) < 1e-9);
  assert.equal(isFrozen(s.f, 0), false);
});

test('感電：雷撃で盾を1枚はがし、次の3回の普通の攻撃が群れの隣にも。濡れていれば全員', () => {
  const c = ctxOf(['raigeki'], { shieldHits: 3, swarm: 3 });
  heroAct(c);
  assert.equal(c.f.shieldHits, 1, '1枚はがして、雷撃の一撃が1枚に防がれる');
  assert.equal(c.f.shock, ES.shockHits);
  const n = ctxOf([], { swarm: 3, shock: 3 });
  assert.equal(heroAct(n), 20);
  const w = ctxOf([], { swarm: 3, shock: 3, wetUntil: 100 });
  assert.equal(heroAct(w), 30);
});

test('印：受けるダメージ＋20%。条件「印があれば」。連射は盾を5回削る', () => {
  const c = ctxOf(['neraiuchi', 'shirushi', 'strong']);
  heroAct(c);
  assert.ok(c.f.markUntil > 0);
  c.f.heroCd = 0;
  const d = heroAct(c);
  assert.ok(Math.abs(d - 10 * 3 * 1.2) < 1e-9, '印があるので強斬りを使い、＋20%');
  const r = ctxOf(['rensha'], { shieldHits: 3 });
  heroAct(r);
  assert.equal(r.f.shieldHits, 0);
});

test('二重詠唱は次の技を2回、風の矢は燃焼を群れに広げ、追い撃ちは倒したら次の札を時間なしで', () => {
  const c = ctxOf(['nijuu', 'kakyu']);
  heroAct(c);
  c.f.heroCd = 0;
  assert.ok(Math.abs(heroAct(c) - 30) < 1e-9);
  const k = ctxOf(['kakyu', 'kazeya'], { swarm: 3 });
  heroAct(k);
  k.f.heroCd = 0;
  heroAct(k);
  assert.ok(k.f.burnSpread);
  const o = ctxOf(['oiuchi', 'neraiuchi', 'strong'], { hp: 15 });
  heroAct(o);
  assert.ok(o.f.hp <= 0);
  assert.ok(o.line.free, '倒したので次の札は時間なし');
});

test('木人に盾が増えた：連射の並びは盾の木人に強い', () => {
  const s = opened();
  s.dojo.nodes = { tsuru: { skill: 2 }, hayate: { skill: 2 }, rensha: { skill: 2 } };
  const r = compareDummy(s, ['rensha', 'rensha'], 'shield', 30);
  assert.ok(r.ratio > 1.5, String(r.ratio));
});
