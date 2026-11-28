// 剣の流派の数値（判定表 第13回。全部仮）。巻物はピクロス（src/core/nonogram.js）。

// 巻物の大きさ（B1）：1/5・2/5 は 5×5、3/5〜5/5 は 7×7。
export const SWORD_SIZES = Object.freeze({ small: { w: 5, h: 5 }, large: { w: 7, h: 7 } });

// 試しの6問（B6、判定表 第14回で遊ぶ）。maxLevel：使ってよい一番難しい手（2＝行と列を行き来する、3＝盤全体）。
// minRounds / maxRounds：行と列を行き来する回りの数。maxGlobal：盤全体の手の数。種は tools/nono-gen.mjs と同じ作り方で選んだ。
export const SWORD_TRIAL = Object.freeze([
  { name: '土台 5×5', w: 5, h: 5, rules: [], seed: 1, maxLevel: 2, maxRounds: 2 },
  { name: '土台 7×7', w: 7, h: 7, rules: [], seed: 1, maxLevel: 2, minRounds: 4 },
  { name: '色 5×5', w: 5, h: 5, rules: ['color'], seed: 1, maxLevel: 2, minRounds: 2 },
  { name: '合計 5×5', w: 5, h: 5, rules: ['sum'], seed: 1, maxLevel: 2, minRounds: 2 },
  { name: '鏡 7×7', w: 7, h: 7, rules: ['mirror'], seed: 1, maxLevel: 2, minRounds: 3 },
  { name: '色＋鏡 7×7', w: 7, h: 7, rules: ['color', 'mirror'], seed: 1, maxLevel: 3, minLevel: 3, maxGlobal: 1 },
]);
