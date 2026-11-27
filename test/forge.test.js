import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSession, strike, addFire, canFire, isOver, preview, strikeCells, cellQuality, score, replay } from '../src/core/forge.js';
import { GEAR } from '../src/data/forge.js';

const sword = () => newSession({ kind: 'iron', slot: 'weapon', tier: 1, conc: 14, fire: 1 });

test('盤は2列×3段、目標は素材と部類で決まる', () => {
  const s = sword();
  assert.equal(s.w, 2);
  assert.equal(s.h, 3);
  assert.deepEqual(s.targets, [7, 9, 8, 6, 5, 4]);
  assert.deepEqual(s.values, [0, 0, 0, 0, 0, 0]);
  assert.equal(s.perLevel, 3);
  assert.equal(newSession({ kind: 'copper', slot: 'weapon', tier: 1, conc: 5, fire: 0 }).perLevel, 4);
});

test('伸びは温度で変わる：灼熱2倍・赤熱1倍・暗赤半分（切り捨て）', () => {
  let s = sword();
  assert.deepEqual(preview(s, 'tap', 0), [{ index: 0, amount: 4 }]);
  assert.deepEqual(preview(s, 'heavy', 0), [{ index: 0, amount: 8 }]);
  s = strike(strike(strike(s, 'tap', 0), 'tap', 0), 'tap', 0);
  assert.equal(s.temp, 1, '3回叩くと赤熱');
  assert.deepEqual(preview(s, 'tap', 1), [{ index: 1, amount: 2 }]);
  s = strike(strike(strike(s, 'tap', 1), 'tap', 1), 'tap', 1);
  assert.equal(s.temp, 2, '暗赤');
  assert.deepEqual(preview(s, 'tap', 2), [{ index: 2, amount: 1 }]);
  assert.equal(s.conc, 8);
});

test('縦打ちは押したマスと下のマス。一番下の段なら上のマスと', () => {
  const s = sword();
  assert.deepEqual(strikeCells(s, 'vertical', 0), [0, 2]);
  assert.deepEqual(strikeCells(s, 'vertical', 5), [3, 5]);
  const t = strike(s, 'vertical', 4);
  assert.deepEqual(t.values, [0, 0, 4, 0, 4, 0]);
  assert.equal(t.conc, 12);
});

test('集中力が足りない叩き方は使えない', () => {
  const s = newSession({ kind: 'iron', slot: 'weapon', tier: 1, conc: 1, fire: 0 });
  assert.equal(strike(s, 'heavy', 0), null);
  assert.ok(strike(s, 'tap', 0));
});

test('火を足すは段の頭でだけ使え、1段戻る。冷えた後でも暗赤へ戻る', () => {
  let s = sword();
  assert.equal(canFire(s), false, '灼熱では戻れない');
  s = strike(strike(strike(s, 'tap', 0), 'tap', 0), 'tap', 1);
  assert.equal(canFire(s), true);
  s = strike(s, 'tap', 2);
  assert.equal(canFire(s), false, '段の途中では使えない');
  const cold = { ...sword(), temp: 3, left: 3, fire: 1 };
  assert.equal(isOver(cold), false, '火があれば終わらない');
  assert.equal(addFire(cold).temp, 2);
  assert.equal(isOver({ ...cold, fire: 0 }), true);
});

test('出来：帯に届かない0・帯の中○1・真ん中◎2・超えたらひび0', () => {
  assert.deepEqual(cellQuality(5, 7), { q: 0, crack: false });
  assert.deepEqual(cellQuality(6, 7), { q: 1, crack: false });
  assert.deepEqual(cellQuality(7, 7), { q: 2, crack: false });
  assert.deepEqual(cellQuality(8, 7), { q: 1, crack: false });
  assert.deepEqual(cellQuality(9, 7), { q: 0, crack: true });
});

test('全部◎なら会心で120%、何もしなければ50%', () => {
  const s = sword();
  assert.equal(score(s).ratio, GEAR.minQ);
  const done = { ...s, values: s.targets.slice() };
  const sc = score(done);
  assert.equal(sc.crit, true);
  assert.equal(sc.ratio, GEAR.crit);
});

test('鉄の剣は集中力14＋火1回で会心に届く手順がある（解く道具で見つけた手順）', () => {
  const log = [['tap', 0], ['tap', 1], ['tap', 1], ['fire'], ['tap', 2], ['tap', 2], ['vertical', 3], ['tap', 0], ['tap', 3], ['heavy', 4], ['tap', 0], ['tap', 1], ['tap', 4]];
  const end = replay(sword(), log);
  assert.ok(end);
  assert.equal(score(end).crit, true);
  assert.equal(isOver(end), true, '冷えて火もないので終わり');
});

test('元のセッションは変わらない', () => {
  const s = sword();
  const before = JSON.stringify(s);
  strike(s, 'heavy', 0);
  addFire(s);
  assert.equal(JSON.stringify(s), before);
});
