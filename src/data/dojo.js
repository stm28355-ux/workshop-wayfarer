// 道場の数値（判定表 第6回。全部仮）。

// 巻物の大きさと罠の数（A1・B4）。連結と組は罠を多めに。
export const SCROLL_SIZES = Object.freeze({
  small: { w: 5, h: 5, count: 5, countRule: 6 },
  large: { w: 6, h: 6, count: 8, countRule: 10 },
});

// 熟練（C1 と第6回の直し）：節の1段は熟練2。解くと3（技を使っても減らない）、ミス1回につき −1（最低1）。
export const SKILL = Object.freeze({ perLevel: 2, clear: 3, mistake: 1, min: 1 });

export function skillGain(mistakes) {
  return Math.max(SKILL.min, SKILL.clear - SKILL.mistake * mistakes);
}

// 重ねられない変えルールの組（連結と組は両立しない：罠が全部つながりつつ、組どうし接しないことはできない）。
export const RULE_CLASH = Object.freeze([['connect', 'pair']]);

// 試しの6問（判定表 第6回 E2）。tools/scroll-gen.mjs で選んだ種。maxLevel は使ってよい一番難しい手。
export const TRIAL = Object.freeze([
  { name: '土台 5×5', w: 5, h: 5, count: 5, rules: [], seed: 17, maxLevel: 2 },
  { name: '土台 6×6', w: 6, h: 6, count: 8, rules: [], seed: 29, maxLevel: 3 },
  { name: '十字 5×5', w: 5, h: 5, count: 5, rules: ['cross'], seed: 4, maxLevel: 3 },
  { name: '連結 5×5', w: 5, h: 5, count: 6, rules: ['connect'], seed: 11, maxLevel: 3 },
  { name: '組 5×5', w: 5, h: 5, count: 6, rules: ['pair'], seed: 17, maxLevel: 3 },
  { name: '十字＋組 6×6', w: 6, h: 6, count: 10, rules: ['cross', 'pair'], seed: 4, maxLevel: 3 },
]);
