import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, forgeCheck, forgeStart, forgeStrike, forgeFinish, forgeFire, equipItem, advance, setForgeAuto, fuelPower } from '../src/core/game.js';
import { planOf, applyCraft, mainValue, heroStats, baseOf, damageTaken } from '../src/core/gear.js';
import { gearCost, GEAR } from '../src/data/forge.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;

// 地域1のボスの後で、素材がたまった状態。
function opened(stock = { iron: 500, copper: 500, fire: 300, stone: 300 }) {
  const s = createGame();
  s.open.unlocks.push('stage:forge');
  s.open.exits.push('workshop');
  s.stock.forge = { ...stock };
  return s;
}

test('格 n の地金は 30×3^(n−1)、基本は格ごとに2倍', () => {
  assert.equal(gearCost(1), 30);
  assert.equal(gearCost(2), 90);
  assert.equal(gearCost(3), 270);
  assert.equal(baseOf('weapon', 2), 2 * baseOf('weapon', 1));
});

test('初めて打つ → 同じ格は加算（4回まで）→ 格が上なら加算を引き継ぐ', () => {
  let items = {};
  let r = applyCraft(items, 'iron', 'weapon', 1, 0.8);
  assert.equal(r.plan.mode, 'new');
  items = r.items;
  const first = mainValue(items['iron:weapon']);
  assert.ok(near(first, 6 * 0.8));
  for (let i = 0; i < GEAR.addCap; i++) {
    r = applyCraft(items, 'iron', 'weapon', 1, 1);
    assert.equal(r.plan.mode, 'add');
    items = r.items;
  }
  assert.ok(near(mainValue(items['iron:weapon']), first + 4 * 6 * 0.25));
  assert.equal(planOf(items, 'iron', 'weapon', 1).mode, 'full');
  r = applyCraft(items, 'iron', 'weapon', 2, 1);
  assert.equal(r.plan.mode, 'up');
  assert.ok(near(mainValue(r.items['iron:weapon']), 12 + 4 * 6 * 0.25), '格2の基本＋格1の加算');
  // 格2のときに格1を打っても、格1の加算はもう使い切っている
  assert.equal(planOf(r.items, 'iron', 'weapon', 1).mode, 'full');
  assert.equal(planOf(r.items, 'iron', 'weapon', 2).mode, 'add');
});

test('種類が違えば別々に育つ', () => {
  let items = applyCraft({}, 'iron', 'weapon', 1, 1).items;
  items = applyCraft(items, 'copper', 'weapon', 1, 1).items;
  assert.ok(items['iron:weapon'] && items['copper:weapon']);
  assert.equal(planOf(items, 'copper', 'weapon', 1).mode, 'add');
});

test('打つ前の確かめ：開いているか、素材と燃料、集中力の上限、格の上限', () => {
  const closed = createGame();
  assert.equal(forgeCheck(closed, { kind: 'iron', slot: 'weapon', tier: 1, fuel: { fire: 6 } }).ok, false);
  const s = opened({ iron: 29, fire: 20 });
  assert.match(forgeCheck(s, { kind: 'iron', slot: 'weapon', tier: 1, fuel: { fire: 6 } }).reason, /鉄鉱が足りない/);
  const t = opened();
  assert.equal(forgeCheck(t, { kind: 'iron', slot: 'weapon', tier: 1, fuel: {} }).ok, false, '燃料が要る');
  assert.match(forgeCheck(t, { kind: 'iron', slot: 'weapon', tier: 1, fuel: { fire: 17 } }).reason, /集中力は16まで/);
  assert.match(forgeCheck(t, { kind: 'iron', slot: 'weapon', tier: 3, fuel: { fire: 6 } }).reason, /格3からは次の工程/);
  assert.equal(forgeCheck(t, { kind: 'iron', slot: 'accessory', tier: 1, fuel: { fire: 6 } }).ok, false, '鉱石からアクセサリーは作れない');
  const ok = forgeCheck(t, { kind: 'fire', slot: 'accessory', tier: 1, fuel: { fire: 6, stone: 8 } });
  assert.ok(ok.ok);
  assert.equal(ok.need.fire, 36, '炎の腕輪は炎を素材30＋燃料6');
  assert.deepEqual(fuelPower({ fire: 7, stone: 5 }), { conc: 12, fire: 2 });
});

test('打ち始めると素材と燃料が減り、叩き切ると仕上がって装備される', () => {
  let s = opened();
  let r = forgeStart(s, { kind: 'iron', slot: 'weapon', tier: 1, fuel: { fire: 3, stone: 11 } });
  assert.ok(r.ok);
  s = r.state;
  assert.equal(s.stock.forge.iron, 470);
  assert.equal(s.stock.forge.fire, 297);
  assert.equal(s.stock.forge.stone, 289);
  assert.equal(s.forge.session.conc, 14);
  assert.equal(s.forge.session.fire, 1);
  const log = [['tap', 0], ['tap', 1], ['tap', 1], ['fire'], ['tap', 2], ['tap', 2], ['vertical', 3], ['tap', 0], ['tap', 3], ['heavy', 4], ['tap', 0], ['tap', 1], ['tap', 4]];
  let done = null;
  for (const step of log) {
    r = step[0] === 'fire' ? forgeFire(s) : forgeStrike(s, step[0], step[1]);
    assert.ok(r.ok);
    s = r.state;
    if (r.done) done = r.done;
  }
  assert.ok(done, '冷えて火もないので自動で仕上がる');
  assert.equal(done.crit, true);
  assert.equal(s.forge.session, null);
  assert.equal(s.gear.equip.weapon, 'iron:weapon');
  assert.ok(near(mainValue(s.gear.items['iron:weapon']), 6 * GEAR.crit));
  assert.equal(s.forge.best['iron:weapon:1'].sum, 12, '一番の手順を残す');
  assert.ok(near(heroStats(s).atk, 10 + 6 * GEAR.crit));
});

test('仕上げるはいつでも押せる。何も叩かなければ出来50%', () => {
  let s = forgeStart(opened(), { kind: 'copper', slot: 'armor', tier: 1, fuel: { stone: 5 } }).state;
  const r = forgeFinish(s);
  assert.ok(r.ok);
  s = r.state;
  assert.equal(r.done.ratio, GEAR.minQ);
  assert.equal(s.gear.equip.armor, 'copper:armor');
  assert.ok(near(heroStats(s).guard, 2 * 0.5), '銅の盾は1回に受けるダメージを引く');
});

test('武器と防具は付け替えられる。アクセサリーは全部効く', () => {
  let s = opened();
  for (const [kind, slot] of [['iron', 'weapon'], ['copper', 'weapon'], ['fire', 'accessory'], ['stone', 'accessory']]) {
    s = forgeStart(s, { kind, slot, tier: 1, fuel: { stone: 5 } }).state;
    s = forgeFinish(s).state;
  }
  assert.equal(s.gear.equip.weapon, 'iron:weapon', '最初に打った物を装備したまま');
  const st = heroStats(s);
  assert.ok(near(st.atkPct, 0.05 * 0.5));
  assert.ok(near(st.regenPct, 0.1 * 0.5));
  assert.equal(st.attackTicks, 10);
  s = equipItem(s, 'weapon', 'copper:weapon').state;
  assert.equal(heroStats(s).attackTicks, 14, '槌は遅い');
  assert.equal(equipItem(s, 'weapon', 'iron:armor').ok, false);
});

test('盾で受けるダメージは減るが、元の2割は通る', () => {
  assert.equal(damageTaken(10, 3), 7);
  assert.equal(damageTaken(10, 30), 2);
});

test('打ち分けの職人：手で出した一番の手順を繰り返し、加算か格上げをする', () => {
  let s = opened({ iron: 1000, stone: 300 });
  s = forgeStart(s, { kind: 'iron', slot: 'weapon', tier: 1, fuel: { stone: 6 } }).state;
  s = forgeStrike(s, 'heavy', 0).state;
  s = forgeFinish(s).state;
  const best = s.forge.best['iron:weapon:1'];
  assert.ok(best);
  s.open.unlocks.push('crafter:forge');
  s.forge.cd = 1;
  const r = advance(s, 1);
  const craft = r.events.find((e) => e.type === 'craft');
  assert.ok(craft && craft.auto);
  assert.equal(craft.mode, 'up', '格1と格2は同じ盤なので、格2へ格上げする');
  assert.equal(craft.sum, best.sum, '出来は手で出した一番と同じ');
  assert.equal(r.state.stock.forge.iron, s.stock.forge.iron - 90);
  // 格2の加算を4回使うと、格1の加算へ下りる。素材が尽きたら打たない
  let t = r.state;
  const modes = [];
  for (let i = 0; i < 12; i++) {
    t.forge.cd = 1;
    const x = advance(t, 1);
    t = x.state;
    const c = x.events.find((e) => e.type === 'craft');
    modes.push(c ? `${c.mode}${c.tier}` : '-');
  }
  assert.deepEqual(modes.slice(0, 8), ['add2', 'add2', 'add2', 'add2', 'add1', 'add1', 'add1', 'add1']);
  assert.equal(modes.at(-1), '-', '加算を使い切ったら打たない');
  assert.equal(r.state.stats.autoCrafted, 1);
  const off = setForgeAuto(s, false).state;
  assert.equal(advance(off, 1).events.filter((e) => e.type === 'craft').length, 0, '止めると打たない');
});
