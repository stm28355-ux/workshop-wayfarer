import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, feed, moveItem, chooseRegion, enemyAt, bossDrop } from '../src/core/game.js';
import { levelStats, xpToNext, gainXp } from '../src/core/hero.js';
import { PREP, BOARD, REGIONS } from '../src/data/balance.js';

// 強い勇者（死なない・支度が切れない）にした状態。
function strong(level = 200) {
  const s = createGame();
  s.hero.level = level;
  s.run.hp = levelStats(level).maxHp;
  s.run.prep = 1e9;
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

test('レベル：攻撃と HP、次に要る経験は1.6倍ずつ', () => {
  assert.deepEqual(levelStats(1), { atk: 5, maxHp: 30 });
  assert.deepEqual(levelStats(3), { atk: 9, maxHp: 50 });
  assert.equal(xpToNext(1), 10);
  assert.equal(xpToNext(2), 16);
  assert.deepEqual(gainXp({ level: 1, xp: 0 }, 27), { level: 3, xp: 1 });
});

test('始まりは地域1、盤は5×4で空、出口は3つ（工房はまだ）', () => {
  const s = createGame();
  assert.equal(s.run.region, 1);
  assert.equal(s.board.cells.length, BOARD.w * BOARD.h);
  assert.ok(s.board.cells.every((c) => c === null));
  assert.deepEqual(s.open.exits, ['prep', 'grow', 'forge']);
  assert.equal(s.run.prep, PREP.base);
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

test('最初の敵は20歩目。倒すと決まった物（鉄鉱1）が盤の左上に出る', () => {
  const r = until(createGame(), (e) => e.type === 'pickup');
  const p = r.events.find((e) => e.type === 'pickup');
  assert.deepEqual(p.item, { kind: 'iron', rank: 1 });
  assert.equal(p.index, 0);
  assert.equal(r.state.run.step, REGIONS[0].gap);
  assert.deepEqual(enemyAt(1, 1).drop, { kind: 'fire', rank: 1 });
});

test('支度が切れたら帰り、すぐ次の出発（支度は base から）', () => {
  const s = createGame();
  s.hero.level = 200;
  s.run.hp = levelStats(200).maxHp;
  s.run.prep = 100; // 盤があふれる前に切れる長さ
  const r = until(s, (e) => e.type === 'return');
  const ret = r.events.find((e) => e.type === 'return');
  assert.equal(ret.reason, 'prep');
  assert.equal(r.ticks, 100 / REGIONS[0].drain);
  assert.equal(r.state.run.step, 0);
  assert.equal(r.state.run.prep, PREP.base);
  assert.equal(r.state.stats.departures, 2);
});

test('倒れたら支度の残りを失って帰る', () => {
  const s = createGame();
  s.run.prep = 1e9;
  s.run.hp = 1;
  s.run.fight = { boss: false, hp: 1e6, maxHp: 1e6, atk: 5, heroCd: 5, enemyCd: 1 };
  const r = advance(s, 1);
  assert.ok(r.events.some((e) => e.type === 'return' && e.reason === 'down'));
  assert.equal(r.state.run.prep, PREP.base);
  assert.equal(r.state.stats.returns.down, 1);
});

test('盤がいっぱいのときに拾った物は、あふれとして支度に入る', () => {
  const s = strong();
  s.board.cells = s.board.cells.map(() => ({ kind: 'stone', rank: 1 }));
  const before = s.run.prep;
  const r = until(s, (e) => e.type === 'overflow');
  assert.equal(r.state.stats.overflow, 1);
  // 進んだ刻みぶん減り、鉄鉱1の価値ぶん伸びる
  assert.equal(r.state.run.prep, before - r.ticks * REGIONS[0].drain + PREP.perValue);
});

test('出口：支度は価値×50刻み、育てるは経験、装備作りは種類ごとにたまる', () => {
  let s = createGame();
  s.board.cells[0] = { kind: 'iron', rank: 3 }; // 価値9
  s.board.cells[1] = { kind: 'fire', rank: 2 }; // 価値3
  s.board.cells[2] = { kind: 'iron', rank: 3 };
  let r = feed(s, 0, 'prep');
  assert.equal(r.state.run.prep, PREP.base + 9 * PREP.perValue);
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
  assert.equal(r.state.run.hp, 30);
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

test('地域1のボスを倒すと、地域2・工房の出口・マージの職人・打ち分けが開き、帰る', () => {
  const r = until(strong(), (e) => e.type === 'boss');
  const s = r.state;
  assert.deepEqual(s.cleared, [1]);
  assert.deepEqual(s.stats.firstBoss[1], { tick: s.tick, level: 200 }, '初めて倒した刻みとレベルを残す');
  assert.deepEqual(s.open.regions, [1, 2]);
  assert.ok(s.open.exits.includes('workshop'));
  assert.ok(s.open.unlocks.includes('crafter:merge'));
  assert.ok(s.open.unlocks.includes('stage:forge'));
  assert.ok(r.events.some((e) => e.type === 'return' && e.reason === 'boss'));
  // ボスの落とし物（鉄鉱3）は盤に出るか、盤がいっぱいならあふれる
  assert.ok(r.events.some((e) => (e.type === 'pickup' || e.type === 'overflow') && e.item.kind === bossDrop(1).kind && e.item.rank === 3));
  assert.equal(s.run.step, 0);
});

test('2回目のボスでは開く物は増えない', () => {
  let s = until(strong(), (e) => e.type === 'boss').state;
  s.run.prep = 1e9;
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
  t.run.prep = 1;
  const r = advance(t, 1);
  assert.equal(r.state.run.region, 2);
});
