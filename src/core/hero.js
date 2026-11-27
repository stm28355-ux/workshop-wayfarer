// 勇者のレベルと経験。純粋な関数だけ。

import { HERO, XP } from '../data/balance.js';

export function levelStats(level) {
  return {
    atk: HERO.baseAtk + HERO.atkPerLevel * (level - 1),
    maxHp: HERO.baseHp + HERO.hpPerLevel * (level - 1),
  };
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
