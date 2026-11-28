// 工程7b：打ち分けの格3・4（9マス）・燃料の叩き方・魔銀と雷の癖・新しい装備・打てる物（判定表 第16回）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, forgeStart, forgeStrike, forgeCheck, craftable, fuelTools, CRAFT_MIN_FUEL } from '../src/core/game.js';
import { newSession, strike, strikeCells, canStrike, strikeAmount, addFire, preview, strikesLeft } from '../src/core/forge.js';
import { heroStats, applyCraft, craftGain } from '../src/core/gear.js';
import { newLine, heroAct } from '../src/core/lineup.js';
import { GEAR, GEAR_KINDS, BANDS, bandOf, gearCost, STAT_CAPS } from '../src/data/forge.js';

function forgeOpen() {
  const s = createGame();
  s.open.unlocks.push('stage:forge');
  return s;
}

test('格3・4 は 3×3 の9マス、集中力24。素材は 270・810', () => {
  assert.equal(GEAR.tierMax, 4);
  assert.deepEqual([bandOf(3).w, bandOf(3).h, bandOf(4).cap], [3, 3, 24]);
  assert.deepEqual([gearCost(3), gearCost(4)], [270, 810]);
  for (const [kind, def] of Object.entries(GEAR_KINDS)) {
    for (const slot of ['weapon', 'armor', 'accessory']) {
      if (!def[slot]) continue;
      for (const b of BANDS) assert.equal(def[slot].targets[b.id].length, b.w * b.h, `${kind} ${slot} 盤${b.id}`);
    }
  }
  const s = newSession({ kind: 'copper', slot: 'weapon', tier: 3, conc: 24, fire: 0 });
  assert.equal(s.values.length, 9);
});

test('燃料の叩き方：その欠片を燃料に入れたときだけ。形と伸び', () => {
  const plain = newSession({ kind: 'iron', slot: 'weapon', tier: 3, conc: 24, fire: 0 });
  for (const id of ['fine', 'cross', 'sweep', 'smooth']) assert.equal(canStrike(plain, id), false, id);
  const s = newSession({ kind: 'iron', slot: 'weapon', tier: 3, conc: 24, fire: 0, tools: ['ice', 'stone', 'thunder', 'wind'] });
  assert.deepEqual(strikeCells(s, 'cross', 4), [1, 3, 4, 5, 7]);
  assert.deepEqual(strikeCells(s, 'cross', 0), [0, 1, 3]);
  assert.deepEqual(strikeCells(s, 'sweep', 5), [3, 4, 5]);
  // 灼熱：十字と横薙ぎは＋2、細打ちは温度に関係なく＋1、均しは −1
  assert.equal(strikeAmount(s, 'cross'), 2);
  assert.equal(strikeAmount(s, 'fine'), 1);
  assert.equal(strikeAmount(s, 'smooth'), -1);
  let t = strike(s, 'heavy', 0);
  t = strike(t, 'smooth', 0);
  assert.equal(t.values[0], 7);
  // 均しで 0 より下にはならない
  const z = strike(s, 'smooth', 8);
  assert.equal(z.values[8], 0);
  assert.deepEqual(fuelTools({ ice: 3, iron: 5, fire: 0, wind: 1 }), ['ice', 'wind']);
});

test('魔銀：温度が1段下がるたびに全部のマスが1下がる。雷は1段で2回', () => {
  let s = newSession({ kind: 'mithril', slot: 'weapon', tier: 1, conc: 16, fire: 1 });
  assert.equal(s.quirk, 'decay');
  s = strike(s, 'heavy', 0); // +8
  s = strike(s, 'heavy', 1); // +8
  assert.deepEqual(s.values.slice(0, 2), [8, 8]);
  s = strike(s, 'tap', 2); // 3回目で赤熱へ：全部 −1
  assert.deepEqual(s.values.slice(0, 3), [7, 7, 3]);
  // 火を足して温度が戻っても上がりはしない
  const f = addFire(s);
  assert.deepEqual(f.values.slice(0, 3), [7, 7, 3]);
  assert.equal(GEAR_KINDS.thunder.perLevel, 2);
  const th = newSession({ kind: 'thunder', slot: 'accessory', tier: 1, conc: 16, fire: 0 });
  const a = strike(strike(th, 'tap', 0), 'tap', 1);
  assert.equal(a.temp, 1);
});

test('打ち始めると燃料の欠片が使える叩き方になる', () => {
  const s = forgeOpen();
  s.stock.forge = { copper: 300, ice: 10, stone: 10 };
  const c = forgeCheck(s, { kind: 'copper', slot: 'weapon', tier: 3, fuel: { ice: 10, stone: 10 } });
  assert.ok(c.ok, c.reason);
  const r = forgeStart(s, { kind: 'copper', slot: 'weapon', tier: 3, fuel: { ice: 10, stone: 10 } });
  assert.deepEqual(r.state.forge.session.tools, ['ice', 'stone']);
  assert.ok(forgeStrike(r.state, 'fine', 0).ok);
  assert.equal(forgeStrike(r.state, 'cross', 0).ok, false, '雷は入れていない');
});

test('新しい装備：衣と首飾りは受けるダメージ −%、羽は攻撃の速さ、耳飾りは札の時間。割合には上限', () => {
  const s = createGame();
  let items = {};
  items = applyCraft(items, 'mithril', 'armor', 1, 1).items;
  items = applyCraft(items, 'ice', 'accessory', 1, 1).items;
  items = applyCraft(items, 'wind', 'accessory', 1, 1).items;
  items = applyCraft(items, 'thunder', 'accessory', 1, 1).items;
  items = applyCraft(items, 'mithril', 'weapon', 1, 1).items;
  s.gear = { items, equip: { weapon: 'mithril:weapon', armor: 'mithril:armor' } };
  const h = heroStats(s);
  assert.ok(Math.abs(h.taken - (1 - 0.08)) < 1e-9);
  assert.ok(Math.abs(h.attackTicks - 12 / 1.04) < 1e-9, '杖は1.2秒に1回、羽で ＋4%');
  assert.ok(Math.abs(h.cast - 0.96) < 1e-9);
  // 上限
  s.gear.items['ice:accessory'] = { ...items['ice:accessory'], tier: 4, extra: 5 };
  assert.ok(Math.abs(heroStats(s).taken - (1 - STAT_CAPS.ward)) < 1e-9);
  // 札の時間：強斬り（2振り）が耳飾りで縮む
  const hero = heroStats(s);
  const f = { hp: 1e9, maxHp: 1e9, atk: 0, enemyTicks: 10, heroCd: 0, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0 };
  const ctx = { tick: 0, hero, cards: ['strong', 'tame'], levels: {}, recast: 20, line: newLine(), f, run: { hp: hero.maxHp }, events: [] };
  heroAct(ctx);
  assert.ok(Math.abs(f.heroCd - 2 * hero.attackTicks * hero.cast) < 1e-9);
});

test('今打てる物：素材と燃料が足りるときだけ。持っている物は格上げか加算', () => {
  const s = forgeOpen();
  assert.deepEqual(craftable(s), []);
  s.stock.forge = { iron: 30, fire: CRAFT_MIN_FUEL - 1 };
  assert.deepEqual(craftable(s), [], '燃料が足りない');
  s.stock.forge.stone = 5;
  assert.deepEqual(craftable(s).map((c) => `${c.kind}:${c.slot}:${c.tier}:${c.mode}`), ['iron:weapon:1:new', 'iron:armor:1:new']);
  s.gear.items = applyCraft({}, 'iron', 'weapon', 2, 0.8).items;
  s.stock.forge.iron = 270;
  const w = craftable(s).find((c) => c.slot === 'weapon');
  assert.deepEqual([w.tier, w.mode], [3, 'up']);
  s.stock.forge.iron = 100;
  const w2 = craftable(s).find((c) => c.slot === 'weapon');
  assert.deepEqual([w2.tier, w2.mode], [2, 'add']);
});

test('第17回：十字と横薙ぎは集中力2と1。叩き方ごとにあと何回使えるか', () => {
  const s = newSession({ kind: 'iron', slot: 'weapon', tier: 3, conc: 24, fire: 0, tools: ['thunder', 'wind'] });
  assert.equal(strikesLeft(s, 'cross'), 12);
  assert.equal(strikesLeft(s, 'sweep'), 24);
  assert.equal(strikesLeft(s, 'fine'), 0, '氷は入れていない');
  const t = strike(s, 'heavy', 0);
  assert.equal(strikesLeft(t, 'heavy'), 11);
});

test('第17回：魔銀でこの1打で冷めるときは、見通しに全部の −1 が入る', () => {
  let s = newSession({ kind: 'mithril', slot: 'weapon', tier: 1, conc: 16, fire: 0 });
  s = strike(strike(s, 'heavy', 0), 'heavy', 1);
  const pv = preview(s, 'tap', 2);
  const at = new Map(pv.map((p) => [p.index, p]));
  assert.equal(at.get(2).amount, 4 - 1);
  assert.equal(at.get(2).hit, true);
  assert.equal(at.get(0).amount, -1);
  assert.equal(at.get(0).hit, false);
  // 冷めないときは前と同じ形
  const f = newSession({ kind: 'mithril', slot: 'weapon', tier: 1, conc: 16, fire: 0 });
  assert.deepEqual(preview(f, 'tap', 0), [{ index: 0, amount: 4 }]);
});

test('第17回：会心なら加算でも足す量が1.2倍', () => {
  const items = applyCraft({}, 'iron', 'weapon', 1, 1).items;
  const a = craftGain(items, 'iron', 'weapon', 1, 1);
  const c = craftGain(items, 'iron', 'weapon', 1, 1.2);
  assert.equal(a.mode, 'add');
  assert.ok(Math.abs((c.after - c.before) / (a.after - a.before) - 1.2) < 1e-9);
  const n = craftGain({}, 'iron', 'weapon', 1, 1.2);
  assert.deepEqual([n.mode, n.before], ['new', 0]);
});
