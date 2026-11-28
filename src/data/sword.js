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

// 剣の15節（判定表 第13回 C1）。形は守りと同じ：根＋3つの枝（小さい節 → 技 → 小さい節 → 札）＋奥義＋合流。
// 合流「剣盾」は守りの盾打ちと剣の十字斬りが 1/5 で開く（前は守りの木で閉じていた節をこちらへ移した）。
// stat（1段ごと）：守りと同じ。bleed＝出血のダメージ ＋。
// rule：巻物の主な変えルール（rules は奥義と合流の2つ）。
export const SWORD_TREE = Object.freeze([
  { id: 'nigiri', name: '握り', kind: 'small', branch: '根', needs: [], stat: { atk: 0.03 } },
  { id: 'suburi', name: '素振り', kind: 'small', branch: '速さ', needs: ['nigiri'], stat: { speed: 0.02 } },
  { id: 'renda', name: '連撃', kind: 'tech', branch: '速さ', needs: ['suburi'], rule: 'color', tech: 'renda' },
  { id: 'ashi', name: '足運び', kind: 'small', branch: '速さ', needs: ['renda'], stat: { taken: 0.02 } },
  { id: 'nidan', name: '二段', kind: 'card', branch: '速さ', needs: ['ashi'], rule: 'sum', text: '重ねの札：次の2枚を同時に使う' },
  { id: 'rikimi', name: '力み', kind: 'small', branch: '重さ', needs: ['nigiri'], stat: { atk: 0.03 } },
  { id: 'jujigiri', name: '十字斬り', kind: 'tech', branch: '重さ', needs: ['rikimi'], rule: 'sum', tech: 'jujigiri' },
  { id: 'funbari', name: '踏ん張り', kind: 'small', branch: '重さ', needs: ['jujigiri'], stat: { hp: 0.04 } },
  { id: 'hanika', name: '範囲化', kind: 'card', branch: '重さ', needs: ['funbari'], rule: 'mirror', text: '修飾の札：次の技が群れの全員に当たる' },
  { id: 'togi', name: '研ぎ', kind: 'small', branch: '刃', needs: ['nigiri'], stat: { atk: 0.03 } },
  { id: 'shukketsu', name: '出血の刃', kind: 'tech', branch: '刃', needs: ['togi'], rule: 'mirror', tech: 'shukketsu' },
  { id: 'chi', name: '血の匂い', kind: 'small', branch: '刃', needs: ['shukketsu'], stat: { bleed: 0.1 } },
  { id: 'iai', name: '居合', kind: 'card', branch: '刃', needs: ['chi'], rule: 'color', text: '条件の札：戦いが始まって3秒より後なら次の1枚を飛ばす' },
  { id: 'issen', name: '一閃', kind: 'secret', branch: '奥', needsAny: { of: ['renda', 'jujigiri', 'shukketsu'], n: 2, level: 3 }, rules: ['color', 'mirror'], tech: 'issen' },
  { id: 'kenjun', name: '剣盾', kind: 'cross', branch: '奥', needs: ['tateuchi', 'jujigiri'], rules: ['sum', 'mirror'], tech: 'kenjun' },
].map((n) => ({ ...n, school: 'sword' })));

// 剣の修行中の技（第13回 B5）。巻物での手がかり。戦いでの効きは src/data/cards.js。
export const SWORD_TECHS = Object.freeze({
  renda: { name: '連撃', text: '選んだマスから右へ3マスの答えが分かる' },
  jujigiri: { name: '十字斬り', text: '選んだマスと上下左右の5マスの答えが分かる' },
  shukketsu: { name: '出血の刃', text: '選んだマスのまわり8マス（選んだマスは数えない）に、塗るマスがいくつあるか分かる' },
  issen: { name: '一閃', text: '選んだマスの行の答えが全部分かる' },
  kenjun: { name: '剣盾', text: '選んだマスから右下の2×2の答えが分かる' },
});

// 4/5・5/5 で足す2つ目の変えルール。
export const SWORD_SECOND = Object.freeze({ color: 'mirror', sum: 'color', mirror: 'sum' });

// 節の段ごとの巻物の形（第14回の結果：7×7 で行と列を4回り以上行き来する盤は約3分かかり「難しい」→ 7×7 は3回りまで）。
export function swordSpec(node, level) {
  const s = SWORD_SIZES.small, l = SWORD_SIZES.large;
  const base = { kind: 'nono' };
  if (node.kind === 'small') {
    return level < 2 ? { ...base, ...s, rules: [], maxLevel: 2, maxRounds: 2 } : { ...base, ...l, rules: [], maxLevel: 2, maxRounds: 3 };
  }
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret' || node.kind === 'cross') {
    return level < 2 ? { ...base, ...l, rules: main, maxLevel: 2, maxRounds: 3 } : { ...base, ...l, rules: main, maxLevel: 3, maxGlobal: 1 };
  }
  if (level === 0) return { ...base, ...s, rules: main, maxLevel: 2, maxRounds: 2 };
  if (level === 1) return { ...base, ...s, rules: main, maxLevel: 2 };
  if (level === 2) return { ...base, ...l, rules: main, maxLevel: 2, maxRounds: 3 };
  if (level === 3) return { ...base, ...l, rules: [main[0], SWORD_SECOND[main[0]]], maxLevel: 2, maxRounds: 3 };
  return { ...base, ...l, rules: [main[0], SWORD_SECOND[main[0]]], maxLevel: 3, maxGlobal: 1 };
}
