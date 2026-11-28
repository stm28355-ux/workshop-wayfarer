// 工程6：門下生・振り分け・職人の「5個を待つ」・帳簿の数（判定表 第11回）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, feed, migrate, setSplit, nudgeSplit, splitExit, setCrafterWait, buyUpgrade, upgradeCheck } from '../src/core/game.js';
import { crafterMerge } from '../src/core/crafter.js';
import { createBoard } from '../src/core/board.js';
import { startScroll, scrollOpen, levelOf, shapeKey, shapeName, shapeOf, discipleTarget, discipleTicks, setDiscipleBranch, shapesFromLevels, scrollSpec, nodeOf } from '../src/core/dojo.js';
import { rankValue } from '../src/core/rank.js';
import { TICKS_PER_SEC, SPLIT } from '../src/data/balance.js';
import { DISCIPLE } from '../src/data/dojo.js';

function opened(...keys) {
  const s = createGame();
  s.open.unlocks.push(...keys);
  if (!s.open.exits.includes('workshop')) s.open.exits.push('workshop');
  s.run.prep = 1e12;
  return s;
}

// 巻物を罠を踏まずに解く。
function solve(s) {
  let st = s;
  const p = st.dojo.scroll.puzzle;
  for (let i = 0; i < p.mines.length && st.dojo.scroll; i++) {
    if (!p.mines[i] && !st.dojo.scroll.opened.includes(i)) st = scrollOpen(st, i).state;
  }
  return st;
}

test('巻物の形：変えルールの組み合わせと盤の大きさ。人が解くと覚える', () => {
  assert.equal(shapeKey({ rules: ['pair', 'cross'], w: 6, h: 6 }), 'cross+pair:6x6');
  assert.equal(shapeName('base:5x5'), '土台 5×5');
  assert.equal(shapeName('cross+pair:6x6'), '十字＋組 6×6');
  let s = opened('stage:dojo');
  s = startScroll(s, 'kamae').state;
  s = solve(s);
  assert.deepEqual(s.dojo.shapes, ['base:5x5']);
  assert.equal(levelOf(s, 'kamae'), 1);
});

test('門下生：人が解いた形だけ、段の低い節から、90秒に1枚・熟練2', () => {
  let s = opened('stage:dojo', 'disciple');
  assert.equal(discipleTarget(s), null, '形を知らなければ解かない');
  s.dojo.shapes = ['base:5x5'];
  // 構え 1/5 にすると、受けの型・返しの型・息吹（どれも土台 5×5）が開く
  s.dojo.nodes.kamae = { skill: 2 };
  // 段が一番低い節（0/5）のうち、根に近く表の前の方：受けの型
  assert.equal(discipleTarget(s), 'uke');
  assert.equal(discipleTicks(s), DISCIPLE.everySec * TICKS_PER_SEC);
  let r = advance(s, discipleTicks(s) + TICKS_PER_SEC);
  const ev = r.events.find((e) => e.type === 'disciple');
  assert.ok(ev, '解いた');
  assert.equal(ev.node, 'uke');
  assert.equal(r.state.dojo.nodes.uke.skill, DISCIPLE.gain);
  assert.equal(r.state.stats.discipleScrolls, 1);
  // 枝を選ぶ：息吹だけ
  s = setDiscipleBranch(s, '息吹').state;
  assert.equal(discipleTarget(s), 'ibuki');
  // 人が解いている節は取らない（A5）
  s = startScroll(s, 'ibuki').state;
  assert.notEqual(discipleTarget(s), 'ibuki');
});

test('門下生：段が上がって知らない形になった節は飛ばす。工房で速くなる', () => {
  const s = opened('stage:dojo', 'disciple');
  s.dojo.nodes.kamae = { skill: 4 }; // 2/5：次は 6×6
  s.dojo.shapes = ['base:5x5'];
  assert.equal(shapeOf(s, 'kamae'), 'base:6x6');
  assert.equal(discipleTarget(s), 'uke');
  s.dojo.nodes.uke = { skill: 10 };
  s.dojo.nodes.kaeshi = { skill: 10 };
  s.dojo.nodes.ibuki = { skill: 10 };
  // 技の節（十字などの形）を知らないので、解ける節がない
  assert.equal(discipleTarget(s), null);
  s.stock.workshop = 1000;
  const c = upgradeCheck(s, 'disciple');
  assert.equal(c.cost, 40);
  const t = buyUpgrade(s, 'disciple').state;
  assert.equal(discipleTicks(t), Math.round(DISCIPLE.everySec * TICKS_PER_SEC * DISCIPLE.speedMult));
  assert.equal(upgradeCheck(createGame(), 'disciple').ok, false);
});

test('前の版の保存：人が解いた形は節の段から数える', () => {
  const s = createGame();
  s.dojo.nodes.kamae = { skill: 6 }; // 3/5：0・1段（5×5）と2段（6×6）を解いている
  s.dojo.nodes.mikiri = { skill: 2 };
  const shapes = shapesFromLevels(s);
  assert.deepEqual(shapes.sort(), ['base:5x5', 'base:6x6', shapeKey(scrollSpec(nodeOf('mikiri'), 0))].sort());
  const old = structuredClone(s);
  old.version = 4;
  delete old.split;
  delete old.dojo.shapes;
  delete old.dojo.disciple;
  delete old.workshop.disciple;
  delete old.stats.fed;
  const m = migrate(old);
  assert.equal(m.version, 5);
  assert.equal(m.workshop.disciple, 0);
  assert.equal(m.split.on, true);
  assert.equal(m.dojo.shapes.length, 3);
});

test('振り分け：割合に一番足りない出口へ、価値で合わせる', () => {
  const s = opened('split');
  assert.deepEqual(s.split.ratio, SPLIT.ratio);
  // 何も入れていなければ一番割合の大きい支度
  assert.equal(splitExit(s, 9), 'prep');
  s.split.fed = { prep: 40, grow: 0, forge: 0, workshop: 0 };
  assert.equal(splitExit(s, 9), 'grow');
  // 開いていない出口は使わない
  const t = structuredClone(s);
  t.open.exits = ['prep', 'grow'];
  t.split.fed = { prep: 40, grow: 30, forge: 0, workshop: 0 };
  assert.ok(['prep', 'grow'].includes(splitExit(t, 9)));
});

test('振り分け：出すランク以上を3秒に1個。人が選んでいる物には触らない', () => {
  let s = opened('split');
  s.run.wait = 1e9; // 冒険は止めておく
  s.board.cells[0] = { kind: 'iron', rank: 3 };
  s.board.cells[1] = { kind: 'iron', rank: 2 };
  s.board.cells[2] = { kind: 'copper', rank: 4 };
  let r = advance(s, SPLIT.everyTicks);
  let ev = r.events.filter((e) => e.type === 'split');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].item.rank, 4, '高い物から');
  assert.equal(ev[0].exit, 'prep');
  assert.equal(r.state.board.cells[2], null);
  assert.equal(r.state.stats.fed.split.prep, rankValue(4));
  // 選んでいる物は出さない
  r = advance(r.state, SPLIT.everyTicks, { locked: [0] });
  assert.equal(r.events.filter((e) => e.type === 'split').length, 0);
  assert.equal(r.state.board.cells[1].rank, 2, '低い物は待つ');
  // 止める
  const off = setSplit(r.state, { on: false }).state;
  assert.equal(advance(off, SPLIT.everyTicks).events.filter((e) => e.type === 'split').length, 0);
});

test('振り分け：盤がいっぱいで出せる物がなければ、一番低い物を支度へ', () => {
  const s = opened('split');
  s.run.wait = 1e9;
  s.board.cells = s.board.cells.map((_, i) => ({ kind: i % 2 ? 'iron' : 'fire', rank: i === 5 ? 1 : 2 }));
  const prep = s.run.prep;
  const r = advance(s, SPLIT.everyTicks);
  const ev = r.events.find((e) => e.type === 'split');
  assert.ok(ev.full);
  assert.equal(ev.item.rank, 1);
  assert.equal(r.state.board.cells[5], null);
  assert.ok(r.state.run.prep > prep);
});

test('振り分けの割合：10%刻みで合わせて100%、±で動かす', () => {
  const s = opened('split');
  assert.equal(setSplit(s, { ratio: { prep: 5 } }).ok, false, '合わせて100%でない');
  const t = setSplit(s, { ratio: { prep: 5, grow: 2 } }).state;
  assert.deepEqual(t.split.ratio, { prep: 5, grow: 2, forge: 2, workshop: 1 });
  const u = nudgeSplit(t, 'workshop', 1).state;
  assert.equal(u.split.ratio.workshop, 2);
  assert.equal(u.split.ratio.prep, 4, '一番多い出口から引く');
  assert.equal(Object.values(u.split.ratio).reduce((a, v) => a + v, 0), 10);
  const v = nudgeSplit(u, 'prep', -1).state;
  assert.equal(v.split.ratio.prep, 3);
  assert.equal(Object.values(v.split.ratio).reduce((a, x) => a + x, 0), 10);
  assert.equal(setSplit(s, { minRank: 9 }).state.split.minRank, SPLIT.maxRank);
});

test('マージの職人の「5個を待つ」：5個そろうまで合わせない。空きが2つ以下なら3個でも', () => {
  const b = createBoard(5, 4);
  b.cells[0] = { kind: 'iron', rank: 1 };
  b.cells[1] = { kind: 'iron', rank: 1 };
  b.cells[2] = { kind: 'iron', rank: 1 };
  assert.ok(crafterMerge(b, 1).merged, 'いつもは3個で合わせる');
  assert.equal(crafterMerge(b, 1, [], { wait5: true }).merged, null);
  b.cells[3] = { kind: 'iron', rank: 1 };
  b.cells[4] = { kind: 'iron', rank: 1 };
  assert.equal(crafterMerge(b, 1, [], { wait5: true }).merged.used, 5);
  const full = createBoard(5, 4);
  full.cells = full.cells.map((_, i) => (i < 3 ? { kind: 'iron', rank: 1 } : i < 18 ? { kind: 'fire', rank: 3 + (i % 2) } : null));
  assert.equal(crafterMerge(full, 1, [], { wait5: true, waitEmpty: 2 }).merged.used, 3);
  const s = setCrafterWait(createGame(), true).state;
  assert.equal(s.crafter.wait5, true);
});

test('帳簿の数：出口ごとの価値（手・振り分け）、直近の分ごと、地域ごとの帰った理由', () => {
  let s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 2 };
  s = feed(s, 0, 'grow').state;
  assert.equal(s.stats.fed.hand.grow, rankValue(2));
  assert.equal(s.stats.fed.now.grow, rankValue(2));
  s.tick += 60 * TICKS_PER_SEC;
  s.board.cells[0] = { kind: 'iron', rank: 1 };
  s = feed(s, 0, 'prep').state;
  assert.equal(s.stats.fed.past.length, 1);
  assert.equal(s.stats.fed.past[0].grow, rankValue(2));
  assert.equal(s.stats.byRegion[1].departs, 1);
  // 倒れて帰る
  s.run.hp = 0.0001;
  s.run.prep = 1e9;
  let r = { state: s, events: [] };
  for (let i = 0; i < 20000 && !r.events.some((e) => e.type === 'return'); i++) r = advance(r.state, 1);
  assert.equal(r.state.stats.byRegion[1].down, 1);
  assert.equal(r.state.stats.byRegion[1].departs, 2);
});

test('予定表どおりの地域3の入口（?test=r3）：レベル9・剣の格2・盾の格1、地域3から出発', async () => {
  const { planAfterRegion2, PLAN } = await import('../src/core/plan.js');
  const { heroStats } = await import('../src/core/gear.js');
  const s = planAfterRegion2();
  assert.equal(s.run.region, 3);
  assert.equal(s.hero.level, PLAN[1].level);
  assert.equal(s.gear.items['iron:weapon'].tier, 2);
  assert.equal(s.gear.items['copper:armor'].tier, 1);
  assert.ok(s.open.unlocks.includes('stage:dojo'));
  assert.ok(!s.open.unlocks.includes('crafter:forge'), '打ち分けの職人は地域3のボスから');
  assert.equal(s.run.hp, heroStats(s).maxHp);
  assert.equal(s.stats.byRegion[3].departs, 1);
  // 進めても壊れない
  const r = advance(s, 600);
  assert.ok(r.state.tick > s.tick);
});
