// 勇者のレベルと経験。純粋な関数だけ。
// レベルは掛け算で効く（判定表 第4回 C2）。装備を含めた強さは gear.js の heroStats。

import { HERO, XP, LEVEL } from '../data/balance.js';

// 素手・装備なしのときの攻撃と最大 HP。
export function levelStats(level) {
  const m = LEVEL.mult ** (level - 1);
  return { atk: HERO.baseAtk * m, maxHp: HERO.baseHp * m };
}

// レベル level から次のレベルに要る経験。
export function xpToNext(level) {
  return Math.ceil(XP.base * XP.growth ** (level - 1));
}

// 経験を足す。足りればレベルを続けて上げる。
export function gainXp(hero, amount) {
  let { level, xp } = hero;
  xp += amount;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  return { level, xp };
}
