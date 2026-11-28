// 予定表（判定表 第4回 D・第11回 D1）の目安と、「予定表どおりの状態」を作る関数。純粋な関数だけ。
// 帳簿（第11回 C2）が今の値と並べて出し、?test=r3 と tools/run-through.mjs が地域3の入口に使う。

import { createGame, region, restartRun } from './game.js';
import { applyCraft, heroStats } from './gear.js';
import { createBoard, widen } from './board.js';
import { BOARD, TICKS_PER_SEC } from '../data/balance.js';

// その地域を出る（ボスを初めて倒す）ときの目安。min は遊び始めからの累計の分。
// 技の並びの比（tech）は人の記録に合わせて大きくした（判定表 第18回 G1：地域3 ×1.6 → ×3、地域4 ×4）。地域5は工程7d、地域6は時間だけ（7e で直す）。
export const PLAN = Object.freeze([
  { region: 1, min: 15, level: 7 },
  { region: 2, min: 40, level: 9, weapon: 2, armor: 1 },
  { region: 3, min: 75, level: 11, weapon: 2, armor: 2, slots: 4, tech: 3 }, // tech：木人（素）で並びなしとの比
  { region: 4, min: 121, level: 13, weapon: 3, armor: 3, slots: 6, tech: 4 },
  { region: 5, min: 178, level: 15, weapon: 4, armor: 4, slots: 7, tech: 5 },
  { region: 6, min: 264 },
]);

export function planOfRegion(id) {
  return PLAN.find((p) => p.region === id) ?? null;
}

function openUpTo(s, upto) {
  for (let id = 1; id <= upto; id++) {
    if (!s.cleared.includes(id)) s.cleared.push(id);
    for (const key of region(id).unlocks) {
      const [what, arg] = key.split(':');
      if (what === 'region') { if (!s.open.regions.includes(Number(arg))) s.open.regions.push(Number(arg)); }
      else if (what === 'exit') { if (!s.open.exits.includes(arg)) s.open.exits.push(arg); }
      else if (!s.open.unlocks.includes(key)) s.open.unlocks.push(key);
    }
  }
}

// 地域2のボスを初めて倒した直後の、予定表どおりの状態（判定表 第11回 D4）。
// レベル9・鉄の剣 格2（加算1）・銅の盾 格1・炎の腕輪と石の護符 格1（出来はどれも8割）。道場は開いたばかりで節は0。
export function planAfterRegion2() {
  const s = createGame();
  openUpTo(s, 2);
  s.tick = PLAN[1].min * 60 * TICKS_PER_SEC;
  s.hero = { level: PLAN[1].level, xp: 0 };
  let items = {};
  items = applyCraft(items, 'iron', 'weapon', 1, 0.8).items;
  items = applyCraft(items, 'iron', 'weapon', 2, 0.8).items;
  items = applyCraft(items, 'iron', 'weapon', 2, 0.8).items;
  items = applyCraft(items, 'copper', 'armor', 1, 0.8).items;
  items = applyCraft(items, 'fire', 'accessory', 1, 0.8).items;
  items = applyCraft(items, 'stone', 'accessory', 1, 0.8).items;
  s.gear = { items, equip: { weapon: 'iron:weapon', armor: 'copper:armor' } };
  s.stock.forge = { iron: 20, copper: 30, fire: 12, stone: 12 };
  s.stock.workshop = 10;
  // 工房：盤を1回広げ、職人の速さを1回
  s.workshop = { ...s.workshop, widen: 1, speed: 1 };
  const b = createBoard(BOARD.w, BOARD.h);
  s.board = widen(b, BOARD.w + 1, BOARD.h);
  s.stats.firstBoss = {
    1: { tick: PLAN[0].min * 60 * TICKS_PER_SEC, level: PLAN[0].level, weapon: 0, armor: 0, slots: 3 },
    2: { tick: s.tick, level: PLAN[1].level, weapon: 2, armor: 1, slots: 3 },
  };
  s.stats.byRegion = { 1: { departs: 0, prep: 0, down: 0, boss: 1 }, 2: { departs: 0, prep: 0, down: 0, boss: 1 } };
  s.nextRegion = 3;
  const t = restartRun(s);
  t.run.hp = heroStats(t).maxHp;
  return t;
}
