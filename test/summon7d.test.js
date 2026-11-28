// 工程7d：召喚の巻物（部屋分け）・隠密の巻物（灯りを置く）・2つの15節・召喚獣と毒など。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/core/game.js';
import { startScroll, scrollRoom, scrollLamp, scrollMark, scrollTech, isNodeOpen, levelOf, shapeKey, shapeName, lampLeft, DISCIPLE_BRANCHES } from '../src/core/dojo.js';
import { generateRooms, countRooms, checkRooms, solveRooms, roomCells } from '../src/core/rooms.js';
import { generateLamps, countLamps, checkLamps, raysOf, makeLamps } from '../src/core/lamps.js';
import { SUMMON_TREE, summonSpec } from '../src/data/summon.js';
import { STEALTH_TREE, stealthSpec } from '../src/data/stealth.js';
import { SCHOOLS } from '../src/data/schools.js';
import { newLine, heroAct, enemyAct, tickFight, compareDummy } from '../src/core/lineup.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

function opened() {
  const s = createGame();
  s.open.unlocks.push('stage:dojo', 'school:guard', 'school:sword', 'school:magic', 'school:bow', 'school:summon', 'school:stealth');
  return s;
}

test('部屋分け：作った盤は答えが1つで、答えは決まりを満たす', () => {
  for (const rules of [[], ['square'], ['elem'], ['hidden'], ['elem', 'hidden']]) {
    const g = generateRooms({ w: 5, h: 5, rules, seed: 3, maxLevel: 3 });
    assert.ok(g, rules.join());
    const p = g.puzzle;
    assert.ok(checkRooms(p, p.rooms));
    assert.equal(countRooms(p, 2), 1);
    assert.ok(solveRooms(p).solved);
    const cells = p.rooms.flatMap((r) => roomCells(r, p.w));
    assert.equal(new Set(cells).size, 25);
    if (rules.includes('square')) assert.ok(p.rooms.every((r) => r.w === r.h));
    if (rules.includes('hidden')) assert.ok(p.clues.some((c) => !c.n));
  }
});

test('灯り：縦横に壁まで照らす。斜め・短い。作った盤は答えが1つ', () => {
  const wall = new Array(9).fill(false);
  wall[4] = true;
  const p = makeLamps(3, 3, [], wall, new Array(9).fill(null), []);
  assert.deepEqual(raysOf(p, 0).sort((a, b) => a - b), [1, 2, 3, 6]);
  const d = makeLamps(3, 3, ['diag'], new Array(9).fill(false), new Array(9).fill(null), []);
  assert.ok(raysOf(d, 0).includes(4) && raysOf(d, 0).includes(8));
  const sh = makeLamps(5, 1, ['short'], new Array(5).fill(false), new Array(5).fill(null), []);
  assert.deepEqual(raysOf(sh, 0), [1, 2]);
  for (const rules of [[], ['diag'], ['short'], ['around']]) {
    const g = generateLamps({ w: 5, h: 5, rules, seed: 5, maxLevel: 2 });
    assert.ok(g, rules.join());
    assert.ok(checkLamps(g.puzzle, g.puzzle.lamps));
    assert.equal(countLamps(g.puzzle, 2), 1);
  }
});

test('召喚と隠密は15節ずつ。地域4のボスで開き、奥義は技の節2つが 3/5、合流は別の流派と', () => {
  assert.equal(SUMMON_TREE.length, 15);
  assert.equal(STEALTH_TREE.length, 15);
  assert.ok(SCHOOLS.summon && SCHOOLS.stealth);
  const s = opened();
  assert.ok(isNodeOpen(s, 'keiyaku') && isNodeOpen(s, 'kehai'));
  s.dojo.nodes.ookami = { skill: 6 };
  s.dojo.nodes.hinosei = { skill: 6 };
  assert.ok(isNodeOpen(s, 'ryuu'));
  assert.equal(isNodeOpen(s, 'kari'), false, '狩りは弓の狙い撃ちも要る');
  s.dojo.nodes.neraiuchi = { skill: 2 };
  assert.ok(isNodeOpen(s, 'kari'));
  for (const b of ['獣', '精霊', '守護', '毒', '影', '煙']) assert.ok(DISCIPLE_BRANCHES.includes(b));
  assert.equal(shapeName(shapeKey(summonSpec(SUMMON_TREE[2], 0))), '召喚 正方形 5×5');
  assert.equal(shapeName(shapeKey(stealthSpec(STEALTH_TREE[6], 3))), '隠密 斜め＋短い 7×7');
});

test('召喚の巻物：長方形で切る。数字が1つでない長方形は切れない。違う部屋はミスで正しい部屋が置かれる', () => {
  let s = startScroll(opened(), 'keiyaku').state;
  const p = s.dojo.scroll.puzzle;
  assert.equal(s.dojo.scroll.kind, 'rooms');
  // 盤全体は数字が2つ以上なので切れない
  assert.equal(scrollRoom(s, 0, p.w * p.h - 1).ok, false);
  // 1つ目の部屋をわざと間違える：数字のマスだけの1マス（部屋が1マスでなければ間違い）
  const k = p.rooms.findIndex((r) => r.w * r.h > 1);
  const at = p.clues[k].at;
  s = scrollRoom(s, at, at).state;
  assert.equal(s.dojo.scroll.mistakes, 1);
  assert.ok(s.dojo.scroll.placed.includes(k));
  // 残りを正しく切る
  p.rooms.forEach((r, j) => {
    if (!s.dojo.scroll || s.dojo.scroll.placed.includes(j)) return;
    s = scrollRoom(s, r.y * p.w + r.x, (r.y + r.h - 1) * p.w + (r.x + r.w - 1)).state;
  });
  assert.equal(s.dojo.scroll, null);
  assert.equal(levelOf(s, 'keiyaku'), 1);
});

test('隠密の巻物：灯りを置く・×・置き間違いはミス。解くと熟練', () => {
  let s = startScroll(opened(), 'kehai').state;
  const p = s.dojo.scroll.puzzle;
  assert.equal(s.dojo.scroll.kind, 'lamps');
  const bad = p.wall.findIndex((w, i) => !w && !p.lamps.includes(i));
  s = scrollLamp(s, bad).state;
  assert.equal(s.dojo.scroll.mistakes, 1);
  assert.ok(s.dojo.scroll.sureX.includes(bad));
  const other = p.wall.findIndex((w, i) => !w && !p.lamps.includes(i) && i !== bad);
  if (other >= 0) {
    s = scrollMark(s, other).state;
    assert.equal(scrollLamp(s, other).ok, false, '×のマスには置けない');
  }
  assert.equal(lampLeft(s.dojo.scroll), p.lamps.length);
  for (const i of p.lamps) if (s.dojo.scroll) s = scrollLamp(s, i).state;
  assert.equal(s.dojo.scroll, null);
  assert.equal(levelOf(s, 'kehai'), 1);
});

test('召喚と隠密の修行中の技', () => {
  const s0 = opened();
  s0.dojo.nodes = { keiyaku: { skill: 2 }, kemonogoe: { skill: 2 }, mamorigoe: { skill: 2 } };
  let s = startScroll(s0, 'ookami').state;
  s = scrollTech(s, 'ookami', 0).state;
  assert.equal(s.dojo.scroll.placed.length, 1, '狼：選んだマスの部屋が置かれる');
  const t0 = opened();
  t0.dojo.nodes = { kehai: { skill: 2 }, ashioto: { skill: 2 } };
  let t = startScroll(t0, 'kagenui').state;
  t = scrollTech(t, 'kagenui', 12).state;
  assert.equal(t.dojo.scroll.hints[0].tech, 'kagenui');
});

// ───── 戦い ─────
function ctxOf(cards, f = {}) {
  const hero = { atk: 10, attackTicks: 10, maxHp: 100, guard: 0, taken: 1, cast: 1 };
  const fight = { hp: 1e9, maxHp: 1e9, atk: 5, enemyTicks: 10, heroCd: 0, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, ...f };
  return { tick: 0, hero, cards, levels: {}, recast: 20, line: newLine(), f: fight, run: { hp: 100 }, events: [] };
}

test('召喚獣：狼は8秒、毎秒 攻撃×0.5。群れ呼びで2体。岩の守り手は3回受け持つ', () => {
  const c = ctxOf(['ookami']);
  heroAct(c);
  let d = 0;
  for (let t = 1; t <= 10 * TICKS_PER_SEC; t++) { c.tick = t; d += tickFight(c); }
  assert.ok(Math.abs(d - 8 * 5) < 1e-9, String(d));
  const two = ctxOf(['muredashi', 'ookami']);
  heroAct(two);
  two.f.heroCd = 0;
  heroAct(two);
  assert.equal(two.line.pets.length, 2);
  const g = ctxOf(['iwamori']);
  heroAct(g);
  for (let k = 0; k < 3; k++) { g.f.enemyCd = 0; assert.equal(enemyAct(g), 0); }
  g.f.enemyCd = 0;
  assert.ok(enemyAct(g) > 0);
});

test('毒：毎秒 攻撃×0.2、毒の間は回復しない。影縫いは敵を止め、暗殺は3割以下で倒す', () => {
  const c = ctxOf(['dokuba'], { hp: 1000, maxHp: 1000, regen: 1 });
  heroAct(c);
  const hp0 = c.f.hp;
  for (let t = 1; t <= 5 * TICKS_PER_SEC; t++) { c.tick = t; tickFight(c); }
  assert.ok(Math.abs(hp0 - c.f.hp - 5 * 2) < 1e-6, '毒の5秒ぶんだけ減り、回復しない');
  const k = ctxOf(['kagenui']);
  heroAct(k);
  k.f.enemyCd = 0;
  assert.equal(enemyAct(k), 0, '止まっている');
  const a = ctxOf(['ansatsu'], { hp: 300, maxHp: 1000 });
  heroAct(a);
  assert.ok(a.f.hp <= 0, '6倍で240、残り60は3割以下なので倒す');
});

test('木人：毒の並びは回復の木人に強い', () => {
  const s = opened();
  s.dojo.nodes = { kehai: { skill: 2 }, dokuchishiki: { skill: 2 }, dokuba: { skill: 2 } };
  const r = compareDummy(s, ['dokuba', 'dokuba'], 'regen', 30);
  assert.ok(r.ratio > 1.5, String(r.ratio));
});

// ───── 打ち分けの格5・6、竜の鱗・星鉄（工程7d） ─────
import { newSession, strike, canStrike, addFire, targetSeen, LONG_HEAT } from '../src/core/forge.js';
import { GEAR, bandOf, gearCost } from '../src/data/forge.js';

test('格5・6 は 4×3 の12マス、集中力32', () => {
  assert.equal(GEAR.tierMax, 6);
  assert.deepEqual([bandOf(5).w, bandOf(5).h, bandOf(6).cap], [4, 3, 32]);
  assert.equal(gearCost(5), 2430);
  const s = newSession({ kind: 'iron', slot: 'weapon', tier: 5, conc: 32, fire: 0 });
  assert.equal(s.values.length, 12);
});

test('竜の鱗：灼熱は5回叩ける・強打が使えない。星鉄：叩いたマスだけ目標が見える', () => {
  let d = newSession({ kind: 'dragon', slot: 'weapon', tier: 1, conc: 16, fire: 1 });
  assert.equal(d.left, LONG_HEAT);
  assert.equal(canStrike(d, 'heavy'), false);
  for (let k = 0; k < LONG_HEAT; k++) d = strike(d, 'tap', 0);
  assert.equal(d.temp, 1);
  assert.equal(d.left, d.perLevel, '赤熱からはふつうの回数');
  d = addFire(d);
  assert.equal(d.left, LONG_HEAT, '火を足して灼熱に戻ると5回');
  let st = newSession({ kind: 'star', slot: 'armor', tier: 1, conc: 16, fire: 0 });
  assert.equal(targetSeen(st, 0), false);
  st = strike(st, 'vertical', 0);
  assert.ok(targetSeen(st, 0) && targetSeen(st, 2));
  assert.equal(targetSeen(st, 1), false);
});
