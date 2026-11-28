// 剣の流派（工程7a 後半）：15節・ピクロスの巻物・修行中の技・札・出血・群れ。判定表 第13回・第14回。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, region, enemyAt } from '../src/core/game.js';
import { startScroll, scrollPaint, scrollMark, scrollTech, scrollCheck, isNodeOpen, levelOf, scrollSpec, nodeOf, shapeKey, discipleTarget, nodeStats } from '../src/core/dojo.js';
import { heroStats } from '../src/core/gear.js';
import { newLine, heroAct, enemyAct, tickFight, recastTicks, availableCards, slotCount, runDummy } from '../src/core/lineup.js';
import { SWORD_TREE } from '../src/data/sword.js';
import { CARDS, STATES } from '../src/data/cards.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

function opened(withSword = true) {
  const s = createGame();
  s.open.unlocks.push('stage:dojo', 'school:guard');
  if (withSword) s.open.unlocks.push('school:sword');
  s.run.prep = 1e12;
  return s;
}

// ピクロスの巻物を答えどおりに塗って解く。
function solveNono(s) {
  let st = s;
  const sol = st.dojo.scroll.puzzle.solution;
  for (let i = 0; i < sol.length && st.dojo.scroll; i++) if (sol[i]) st = scrollPaint(st, i, sol[i]).state;
  return st;
}

test('剣は15節。流派が開くまで閉じていて、根から開く。剣盾は守りの盾打ちと十字斬りで開く', () => {
  assert.equal(SWORD_TREE.length, 15);
  const closed = opened(false);
  assert.equal(isNodeOpen(closed, 'nigiri'), false);
  assert.match(scrollCheck(closed, 'nigiri').reason, /剣/);
  const s = opened();
  assert.equal(isNodeOpen(s, 'nigiri'), true);
  assert.equal(isNodeOpen(s, 'suburi'), false);
  s.dojo.nodes.nigiri = { skill: 2 };
  assert.ok(['suburi', 'rikimi', 'togi'].every((id) => isNodeOpen(s, id)));
  s.dojo.nodes.jujigiri = { skill: 2 };
  assert.equal(isNodeOpen(s, 'kenjun'), false);
  s.dojo.nodes.tateuchi = { skill: 2 };
  assert.equal(isNodeOpen(s, 'kenjun'), true);
  s.dojo.nodes.renda = { skill: 2 };
  assert.equal(isNodeOpen(s, 'issen'), true, '奥義は3つの技のうち2つ');
});

test('剣の巻物の形：下の段は 5×5、3/5 から 7×7。4/5 から変え2つ、5/5 は盤全体の手が1回まで', () => {
  const renda = nodeOf('renda');
  assert.deepEqual([0, 1, 2, 3, 4].map((lv) => `${scrollSpec(renda, lv).w}:${scrollSpec(renda, lv).rules.join('+')}`), ['5:color', '5:color', '7:color', '7:color+mirror', '7:color+mirror']);
  assert.equal(scrollSpec(renda, 4).maxGlobal, 1);
  assert.equal(scrollSpec(renda, 2).maxRounds, 3, '7×7 は3回りまで（第14回）');
  assert.equal(scrollSpec(nodeOf('nigiri'), 0).kind, 'nono');
});

test('剣の巻物：塗る・×・×のマスは塗れない・塗り間違いはミス。解くと熟練と形を覚える', () => {
  let s = startScroll(opened(), 'nigiri').state;
  const sc = s.dojo.scroll;
  assert.equal(sc.kind, 'nono');
  const sol = sc.puzzle.solution;
  const filled = sol.findIndex((v) => v);
  const empty = sol.findIndex((v) => !v);
  // ×を付けたマスは塗れない（第14回 Q1）
  s = scrollMark(s, filled, true).state;
  assert.equal(scrollPaint(s, filled, 1).ok, false);
  s = scrollMark(s, filled, false).state;
  // 塗らないマスを塗るとミス
  const r = scrollPaint(s, empty, 1);
  assert.equal(r.state.dojo.scroll.mistakes, 1);
  assert.equal(r.events[0].type, 'miss');
  s = solveNono(r.state);
  assert.equal(s.dojo.scroll, null);
  assert.equal(s.dojo.nodes.nigiri.skill, 2, 'ミス1回で熟練2');
  assert.deepEqual(s.dojo.shapes, ['nono/base:5x5']);
});

test('剣の修行中の技：十字斬り・連撃・一閃は答えを見せ、出血の刃は数を見せる', () => {
  const s = opened();
  s.dojo.nodes.nigiri = { skill: 2 };
  s.dojo.nodes.rikimi = { skill: 2 };
  s.dojo.nodes.togi = { skill: 2 };
  s.dojo.nodes.shukketsu = { skill: 2 };
  s.dojo.nodes.renda = { skill: 2 };
  let st = startScroll(s, 'jujigiri').state;
  const sc = st.dojo.scroll;
  assert.deepEqual(sc.techs, { renda: 1, jujigiri: 1, shukketsu: 1 }, '同じ流派の技だけ');
  const p = sc.puzzle;
  const mid = Math.floor(p.h / 2) * p.w + Math.floor(p.w / 2);
  st = scrollTech(st, 'jujigiri', mid).state;
  const t = st.dojo.scroll;
  for (const c of [mid, mid - 1, mid + 1, mid - p.w, mid + p.w]) {
    if (p.solution[c]) assert.equal(t.paint[c], p.solution[c]);
    else assert.ok(t.sureX.includes(c));
  }
  st = scrollTech(st, 'shukketsu', 0).state;
  const h = st.dojo.scroll.hints.at(-1);
  assert.equal(h.value, [1, p.w, p.w + 1].filter((c) => p.solution[c]).length);
  assert.equal(scrollTech(st, 'shukketsu', 0).ok, false, '回数を使い切った');
});

test('門下生：剣の巻物も、人が解いた形だけ。枝「速さ」なら剣の根も入る', () => {
  const s = opened();
  s.open.unlocks.push('disciple');
  s.dojo.shapes = ['nono/base:5x5'];
  s.dojo.disciple = { branch: '速さ', node: null, cd: 0 };
  assert.equal(discipleTarget(s), 'nigiri');
  s.dojo.nodes.nigiri = { skill: 2 };
  assert.equal(discipleTarget(s), 'suburi');
  assert.equal(shapeKey(scrollSpec(nodeOf('suburi'), 0)), 'nono/base:5x5');
});

test('剣の小さい節：血の匂いは出血のダメージを伸ばす。枠は剣の技・札の節でも増える', () => {
  const s = opened();
  s.dojo.nodes.chi = { skill: 4 };
  assert.ok(Math.abs(nodeStats(s).bleed - 0.2) < 1e-9);
  for (const n of SWORD_TREE) if (['tech', 'card'].includes(n.kind)) s.dojo.nodes[n.id] = { skill: 6 };
  assert.equal(slotCount(s), 3 + 6);
  assert.ok(availableCards(s).includes('nidan'));
});

// 決まった敵に戦う
function fight(state, cards, ticks, enemy = {}) {
  const hero = heroStats(state);
  const f = { hp: 1e9, maxHp: 1e9, atk: 0, enemyTicks: 10, heroCd: 1, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, bleed: 0, ...enemy };
  const ctx = { tick: 0, hero, cards, levels: Object.fromEntries(cards.map((id) => [id, 1])), recast: recastTicks(state), line: newLine(), f, run: { hp: hero.maxHp }, events: [] };
  let dealt = 0;
  for (let t = 0; t < ticks; t++) {
    ctx.tick = t;
    dealt += tickFight(ctx);
    f.heroCd -= 1;
    if (f.heroCd <= 0) dealt += heroAct(ctx);
    f.enemyCd -= 1;
    if (f.enemyCd <= 0) enemyAct(ctx);
  }
  return { dealt, ctx, hero };
}

test('連撃は盾を早く剥がし、十字斬りは殻を無視する', () => {
  const s = createGame();
  const atk = heroStats(s).atk;
  // 盾3：連撃1枚で3つとも剥がれる
  const a = fight(s, ['renda'], 2, { shieldHits: 3 });
  assert.equal(a.ctx.f.shieldHits, 0);
  // 殻：十字斬りは ×2.5 がそのまま入る
  const b = fight(s, ['jujigiri'], 2, { shell: atk });
  assert.ok(Math.abs(b.dealt - atk * 2.5) < 1e-6);
});

test('出血：1重ごとに毎秒 攻撃×0.1。5重で弾けて攻撃×3', () => {
  const s = createGame();
  const atk = heroStats(s).atk;
  const r = fight(s, ['shukketsu'], 1, {});
  assert.equal(r.ctx.f.bleed, 1);
  const before = r.ctx.f.hp;
  tickFight(r.ctx);
  assert.ok(Math.abs(before - r.ctx.f.hp - (atk * STATES.bleedPer) / TICKS_PER_SEC) < 1e-5);
  const f = { hp: 1e9, maxHp: 1e9, atk: 0, enemyTicks: 10, heroCd: 1, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, bleed: 4 };
  const ctx = { tick: 0, hero: heroStats(s), cards: ['shukketsu'], levels: { shukketsu: 1 }, recast: 30, line: newLine(), f, run: { hp: 100 }, events: [] };
  const d = heroAct(ctx);
  assert.equal(f.bleed, 0);
  assert.ok(ctx.events.some((e) => e.type === 'burst'));
  assert.ok(Math.abs(d - atk * (0.8 + STATES.bleedBurst)) < 1e-6);
});

test('群れ：坑道の敵は3体。一閃と範囲化した技は3体に当たる', () => {
  assert.equal(enemyAt(2, 0).traits.swarm, 3);
  assert.deepEqual(region(2).boss.traits, {}, '女王は1体');
  const s = createGame();
  const atk = heroStats(s).atk;
  const one = fight(s, ['issen'], 1, {}).dealt;
  const three = fight(s, ['issen'], 1, { swarm: 3 }).dealt;
  assert.ok(Math.abs(three - one * 3) < 1e-6);
  const plain = fight(s, ['hanika', 'strong'], 40, { swarm: 3 });
  const noArea = fight(s, ['strong'], 40, { swarm: 3 });
  assert.ok(plain.dealt > noArea.dealt, '範囲化した強斬りは3体に当たる');
  assert.ok(atk > 0);
});

test('二段：次の2枚を同時に使い、時間は長い方。居合は戦いの最初の3秒だけ次を使う', () => {
  const s = createGame();
  const hero = heroStats(s);
  const f = { hp: 1e9, maxHp: 1e9, atk: 0, enemyTicks: 10, heroCd: 1, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, bleed: 0 };
  const ctx = { tick: 0, hero, cards: ['nidan', 'strong', 'tateuchi'], levels: {}, recast: 30, line: newLine(), f, run: { hp: hero.maxHp }, events: [] };
  f.heroCd = 0;
  const d = heroAct(ctx);
  assert.ok(Math.abs(d - hero.atk * (CARDS.strong.damage + CARDS.tateuchi.damage)) < 1e-6);
  assert.equal(f.heroCd, CARDS.strong.swings * hero.attackTicks, '強斬りの2振り');
  assert.ok(ctx.line.recast > 0, '最後まで使ったので積み直し');
  // 居合：最初の3秒なら次（強斬り）を使い、過ぎたら飛ばす
  const early = { ...ctx, tick: 10, f: { ...f, heroCd: 0, start: 0 }, line: newLine(), cards: ['iai', 'strong'], events: [] };
  heroAct(early);
  assert.ok(early.events.some((e) => e.id === 'strong'));
  const late = { ...ctx, tick: 100, f: { ...f, heroCd: 0, start: 0 }, line: newLine(), cards: ['iai', 'strong'], events: [] };
  heroAct(late);
  assert.ok(!late.events.some((e) => e.id === 'strong'));
});

test('木人：群れの木人は3体で、範囲の技が効く。出血の削りも毎秒に入る', () => {
  const s = opened();
  for (const n of SWORD_TREE) s.dojo.nodes[n.id] = { skill: 2 };
  const swarmIssen = runDummy(s, ['issen'], 'swarm', 30).dps;
  const plainIssen = runDummy(s, ['issen'], 'plain', 30).dps;
  assert.ok(swarmIssen > plainIssen * 1.3);
  const bleed = runDummy(s, ['shukketsu'], 'plain', 30).dps;
  const none = runDummy(s, [], 'plain', 30).dps;
  assert.ok(bleed > none);
  assert.ok(levelOf(s, 'issen') === 1);
});

test('ゲームの坑道で、一閃の並びは群れを速く倒す', () => {
  const base = opened();
  base.cleared.push(1);
  base.open.regions.push(2);
  base.nextRegion = 2;
  base.hero.level = 12;
  base.dojo.nodes.renda = { skill: 2 };
  base.dojo.nodes.jujigiri = { skill: 2 };
  base.dojo.nodes.issen = { skill: 2 };
  const kills = (lineup) => {
    const s = structuredClone(base);
    s.lineup = { byRegion: { 2: lineup } };
    s.run = { ...s.run, region: 2 };
    s.run.prep = 1e12;
    s.run.hp = heroStats(s).maxHp;
    const r = advance(s, 600);
    return r.events.filter((e) => e.type === 'kill').length;
  };
  assert.ok(kills(['issen']) >= kills([]));
});
