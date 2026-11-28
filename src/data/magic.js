// 魔法の流派の数値（判定表 第18回 B・E。全部仮）。巻物は属性の数独（src/core/sudoku.js）。

// 巻物の大きさ（B2）：1/5・2/5 は 4×4（火・水・氷・雷）、3/5〜5/5 は 6×6（風と土を足す）。
export const MAGIC_SIZES = Object.freeze({ small: 4, large: 6 });

// 魔法の15節（E1〜E5）。形は剣と同じ：根＋3つの枝（小さい節 → 技 → 小さい節 → 札）＋奥義＋合流。
// 奥義は技の節2つが 3/5 で開く（第18回 G2）。合流「魔法剣」は剣の十字斬りと雷撃が 1/5 で開く。
// rule：巻物の主な変えルール（rules は奥義と合流の2つ）。
export const MAGIC_TREE = Object.freeze([
  { id: 'eishou', name: '詠唱', kind: 'small', branch: '根', needs: [], stat: { atk: 0.03 } },
  { id: 'hinokokoro', name: '火の心', kind: 'small', branch: '炎', needs: ['eishou'], stat: { atk: 0.03 } },
  { id: 'kakyu', name: '火球', kind: 'tech', branch: '炎', needs: ['hinokokoro'], rule: 'react', tech: 'kakyu' },
  { id: 'netsu', name: '熱', kind: 'small', branch: '炎', needs: ['kakyu'], stat: { atk: 0.03 } },
  { id: 'nijuu', name: '二重詠唱', kind: 'card', branch: '炎', needs: ['netsu'], rule: 'cycle', text: '重ねの札：次の技を2回使う（時間は1.5倍）' },
  { id: 'mizunokokoro', name: '水の心', kind: 'small', branch: '水氷', needs: ['eishou'], stat: { hp: 0.04 } },
  { id: 'hyoso', name: '氷の槍', kind: 'tech', branch: '水氷', needs: ['mizunokokoro'], rule: 'cycle', tech: 'hyoso' },
  { id: 'samuke', name: '寒気', kind: 'small', branch: '水氷', needs: ['hyoso'], stat: { taken: 0.02 } },
  { id: 'matou', name: '水をまとう', kind: 'card', branch: '水氷', needs: ['samuke'], rule: 'cage', text: '修飾の札：次の技に濡れを付ける' },
  { id: 'ikazuchinokokoro', name: '雷の心', kind: 'small', branch: '雷', needs: ['eishou'], stat: { speed: 0.02 } },
  { id: 'raigeki', name: '雷撃', kind: 'tech', branch: '雷', needs: ['ikazuchinokokoro'], rule: 'cage', tech: 'raigeki' },
  { id: 'jiba', name: '磁場', kind: 'small', branch: '雷', needs: ['raigeki'], stat: { atk: 0.03 } },
  { id: 'kooreba', name: '凍っていれば', kind: 'card', branch: '雷', needs: ['jiba'], rule: 'react', text: '条件の札：敵が凍っていなければ次の1枚を飛ばす' },
  { id: 'inseki', name: '隕石', kind: 'secret', branch: '奥', needsAny: { of: ['kakyu', 'hyoso', 'raigeki'], n: 2, level: 3 }, rules: ['react', 'cage'], tech: 'inseki' },
  { id: 'mahouken', name: '魔法剣', kind: 'cross', branch: '奥', needs: ['raigeki', 'jujigiri'], rules: ['cycle', 'cage'], tech: 'mahouken' },
].map((n) => ({ ...n, school: 'magic' })));

// 魔法の修行中の技（巻物での手がかり）。戦いでの効きは src/data/cards.js。
export const MAGIC_TECHS = Object.freeze({
  kakyu: { name: '火球', text: '選んだマスと右のマスの答えが分かる' },
  hyoso: { name: '氷の槍', text: '選んだマスから下へ2マスの答えが分かる' },
  raigeki: { name: '雷撃', text: '選んだマスと、盤の向かい側（真ん中を挟んで反対）のマスの答えが分かる' },
  inseki: { name: '隕石', text: '選んだマスのある囲みの答えが全部分かる' },
  mahouken: { name: '魔法剣', text: '選んだマスの行の答えが全部分かる' },
});

// 4/5・5/5 で足す2つ目の変えルール。
export const MAGIC_SECOND = Object.freeze({ react: 'cycle', cycle: 'cage', cage: 'react' });

// 節の段ごとの巻物の形。4×4 は易しく（1/5・2/5）、6×6 から変えルールの回りを使う。
export function magicSpec(node, level) {
  const s = MAGIC_SIZES.small, l = MAGIC_SIZES.large;
  const base = { kind: 'sudo' };
  if (node.kind === 'small') return level < 2 ? { ...base, n: s, rules: [], maxLevel: 1 } : { ...base, n: l, rules: [], maxLevel: 1 };
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret' || node.kind === 'cross') {
    return level < 2 ? { ...base, n: l, rules: main, maxLevel: 2 } : { ...base, n: l, rules: main, maxLevel: 3, maxGlobal: 1 };
  }
  if (level === 0) return { ...base, n: s, rules: main, maxLevel: 2, maxRounds: 2 };
  if (level === 1) return { ...base, n: s, rules: main, maxLevel: 2 };
  if (level === 2) return { ...base, n: l, rules: main, maxLevel: 2 };
  if (level === 3) return { ...base, n: l, rules: [main[0], MAGIC_SECOND[main[0]]], maxLevel: 2 };
  return { ...base, n: l, rules: [main[0], MAGIC_SECOND[main[0]]], maxLevel: 3, maxGlobal: 1 };
}
