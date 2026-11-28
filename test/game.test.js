import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, feed, moveItem, chooseRegion, enemyAt, bossDrop, basePrep, region } from '../src/core/game.js';
import { levelStats, xpToNext, gainXp } from '../src/core/hero.js';
import { heroStats } from '../src/core/gear.js';
import { PREP, BOARD, REGIONS, HERO } from '../src/data/balance.js';

// 強い勇者（死なない・支度が切れない）にした状態。
function strong(level = 200) {
  const s = createGame();
  s.hero.level = level;
  s.run.hp = heroStats(s).maxHp;
  s.run.prep = 1e12;
  return s;
}

// 条件を満たすまで1刻みずつ進める。
function until(state, pred, limit = 200000) {
  let s = state;
  const all = [];
  for (let i = 0; i < limit; i++) {
    const r = advance(s, 1);
    s = r.state;
    all.push(...r.events);
    if (r.events.some(pred)) return { state: s, events: all, ticks: i + 1 };
  }
  throw new Error('起きなかった');
}

test('レベルは掛け算：1つで攻撃と HP が8%。次に要る経験は1.6倍ずつ', () => {
  assert.deepEqual(levelStats(1), { atk: 10, maxHp: 60 });
  const l3 = levelStats(3);
  assert.ok(Math.abs(l3.atk - 10 * 1.08 ** 2) < 1e-9);
  assert.ok(Math.abs(l3.maxHp - 60 * 1.08 ** 2) < 1e-9);
  assert.equal(xpToNext(1), 10);
  assert.equal(xpToNext(2), 16);
  assert.deepEqual(gainXp({ level: 1, xp: 0 }, 27), { level: 3, xp: 1 });
});

test('始まりは地域1、盤は5×4で空、出口は3つ（工房はまだ）、支度は30秒ぶん', () => {
  const s = createGame();
  assert.equal(s.run.region, 1);
  assert.equal(s.board.cells.length, BOARD.w * BOARD.h);
  assert.ok(s.board.cells.every((c) => c === null));
  assert.deepEqual(s.open.exits, ['prep', 'grow', 'forge']);
  assert.equal(s.run.prep, 300);
  assert.equal(basePrep(2), 300 * region(2).drain);
  assert.equal(s.run.wait, 0);
});

test('同じ状態から同じだけ進めれば同じ結果。分けて進めても同じ', () => {
  const s = createGame();
  const a = advance(s, 3000).state;
  const b = advance(s, 3000).state;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = advance(advance(s, 1234).state, 1766).state;
  assert.equal(JSON.stringify(a), JSON.stringify(c));
});

test('advance は元の状態を変えない', () => {
  const s = createGame();
  const before = JSON.stringify(s);
  advance(s, 500);
  assert.equal(JSON.stringify(s), before);
});

test('最初の敵は12歩目。倒すと決まった物（鉄鉱1）が盤の左上に出る', () => {
  const r = until(createGame(), (e) => e.type === 'pickup');
  const p = r.events.find((e) => e.type === 'pickup');
  assert.deepEqual(p.item, { kind: 'iron', rank: 1 });
  assert.equal(p.index, 0);
  assert.equal(r.state.run.step, REGIONS[0].gap);
  assert.deepEqual(enemyAt(1, 1).drop, { kind: 'fire', rank: 1 });
});

test('支度が切れたら帰り、3秒待ってから次の出発（支度は30秒ぶんから）', () => {
  const s = createGame();
  s.hero.level = 200;
  s.run.hp = heroStats(s).maxHp;
  s.run.prep = 100;
  const r = until(s, (e) => e.type === 'return');
  const ret = r.events.find((e) => e.type === 'return');
  assert.equal(ret.reason, 'prep');
  assert.equal(r.ticks, 100 / REGIONS[0].drain);
  assert.equal(r.state.run.step, 0);
  assert.equal(r.state.run.prep, basePrep(1));
  assert.equal(r.state.run.wait, PREP.waitTicks);
  assert.equal(r.state.stats.departures, 2);
  // 待っている間は歩かず、支度も減らない
  const w = advance(r.state, PREP.waitTicks).state;
  assert.equal(w.run.step, 0);
  assert.equal(w.run.prep, basePrep(1));
  assert.equal(advance(w, 1).state.run.step, HERO.walk, '1刻みに歩く速さだけ進む');
});

test('倒れたら支度の残りを失って帰る', () => {
  const s = createGame();
  s.run.prep = 1e9;
  s.run.hp = 1;
  s.run.fight = { boss: false, hp: 1e6, maxHp: 1e6, atk: 5, enemyTicks: 10, heroCd: 5, enemyCd: 1 };
  const r = advance(s, 1);
  assert.ok(r.events.some((e) => e.type === 'return' && e.reason === 'down'));
  assert.equal(r.state.run.prep, basePrep(1));
  assert.equal(r.state.stats.returns.down, 1);
});

test('群れの敵は1秒に何回も攻撃する', () => {
  const s = strong();
  s.run.region = 2;
  s.run.nextEnemyAt = 1;
  s.hero.level = 1;
  const r = advance(s, 1).state;
  assert.equal(r.run.fight.enemyTicks, Math.round(10 / REGIONS[1].enemy.hits));
});

test('盤がいっぱいのときに拾った物は、あふれとして支度に入る', () => {
  const s = strong();
  s.board.cells = s.board.cells.map(() => ({ kind: 'stone', rank: 1 }));
  const before = s.run.prep;
  const r = until(s, (e) => e.type === 'overflow');
  assert.equal(r.state.stats.overflow, 1);
  assert.equal(r.state.run.prep, before - r.ticks * REGIONS[0].drain + PREP.perValue);
});

test('出口：支度は価値×50、育てるは経験、装備作りは種類ごとにたまる', () => {
  let s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 3 }; // 価値9
  s.board.cells[1] = { kind: 'fire', rank: 2 }; // 価値3
  s.board.cells[2] = { kind: 'iron', rank: 3 };
  let r = feed(s, 0, 'prep');
  assert.equal(r.state.run.prep, basePrep(1) + 9 * PREP.perValue);
  assert.equal(r.state.board.cells[0], null);
  r = feed(r.state, 2, 'grow');
  assert.deepEqual(r.state.hero, { level: 1, xp: 9 });
  r = feed(r.state, 1, 'forge');
  assert.deepEqual(r.state.stock.forge, { fire: 3 });
  s = r.state;
  assert.equal(feed(s, 1, 'forge').ok, false, '空きマスは入れられない');
});

test('育ててレベルが上がると、今の HP も伸びる', () => {
  const s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 4 }; // 価値27 → レベル3
  s.run.hp = 10;
  const r = feed(s, 0, 'grow');
  assert.equal(r.state.hero.level, 3);
  assert.ok(Math.abs(r.state.run.hp - (10 + levelStats(3).maxHp - 60)) < 1e-9);
});

test('工房の出口は地域1のボスまで閉じている', () => {
  const s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 1 };
  assert.equal(feed(s, 0, 'workshop').ok, false);
});

test('手で重ねて合わせる', () => {
  const s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 1 };
  s.board.cells[1] = { kind: 'iron', rank: 1 };
  s.board.cells[7] = { kind: 'iron', rank: 1 };
  assert.equal(moveItem(s, 7, 2).merged, null, '空きマスに並べただけでは合わさらない');
  const r = moveItem(s, 7, 1);
  assert.equal(r.merged.rank, 2);
  assert.equal(r.state.stats.merges, 1);
  assert.equal(moveItem(s, 10, 3).state, s, '空きマスからは動かせない');
});

test('地域1のボスを倒すと、地域2・工房の出口・打ち分けが開き、帰る（マージの職人はまだ）', () => {
  const r = until(strong(), (e) => e.type === 'boss');
  const s = r.state;
  assert.deepEqual(s.cleared, [1]);
  assert.deepEqual(s.stats.firstBoss[1], { tick: s.tick, level: 200, weapon: 0, armor: 0, slots: 3 }, '初めて倒した刻み・レベル・格・枠を残す');
  assert.deepEqual(s.open.regions, [1, 2]);
  assert.ok(s.open.exits.includes('workshop'));
  assert.ok(s.open.unlocks.includes('stage:forge'));
  assert.ok(!s.open.unlocks.includes('crafter:merge'));
  assert.ok(r.events.some((e) => e.type === 'return' && e.reason === 'boss'));
  assert.ok(r.events.some((e) => (e.type === 'pickup' || e.type === 'overflow') && e.item.kind === bossDrop(1).kind && e.item.rank === 3));
  assert.equal(s.run.step, 0);
});

test('開く順：地域2 マージの職人と道場、地域3 打ち分けの職人、地域4 門下生、地域5 振り分け', () => {
  const has = (id, key) => region(id).unlocks.includes(key);
  assert.ok(has(2, 'crafter:merge') && has(2, 'stage:dojo'));
  assert.ok(has(3, 'crafter:forge'));
  assert.ok(has(4, 'disciple'));
  assert.ok(has(5, 'split'));
});

test('2回目のボスでは開く物は増えない', () => {
  let s = until(strong(), (e) => e.type === 'boss').state;
  s.run.prep = 1e12;
  const r = until(s, (e) => e.type === 'boss');
  assert.equal(r.events.filter((e) => e.type === 'unlock').length, 0);
  assert.deepEqual(r.state.cleared, [1]);
});

test('地域を選ぶ：開いた地域だけ。帰ったときから効く', () => {
  const s = createGame();
  assert.equal(chooseRegion(s, 2).ok, false);
  let t = until(strong(), (e) => e.type === 'boss').state;
  t = chooseRegion(t, 2).state;
  assert.equal(t.run.region, 1);
  t.run.wait = 0;
  t.run.prep = 1;
  const r = advance(t, 1);
  assert.equal(r.state.run.region, 2);
});
