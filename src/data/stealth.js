// 隠密の流派の数値（工程7d。全部仮）。巻物は灯りを置く（src/core/lamps.js）。
// 戦いでは毒（回復を止める）・影縫い（止める）・煙玉（かわす）。沼地（回復する敵）の壁に合う。

export const STEALTH_SIZES = Object.freeze({ small: { w: 5, h: 5 }, large: { w: 7, h: 7 } });

// 隠密の15節。根「気配を消す」＋ 毒・影・煙の枝 ＋ 奥義「暗殺」＋ 合流「影分身」（召喚の狼と）。
export const STEALTH_TREE = Object.freeze([
  { id: 'kehai', name: '気配を消す', kind: 'small', branch: '根', needs: [], stat: { speed: 0.02 } },
  { id: 'dokuchishiki', name: '毒の知識', kind: 'small', branch: '毒', needs: ['kehai'], stat: { atk: 0.03 } },
  { id: 'dokuba', name: '毒の刃', kind: 'tech', branch: '毒', needs: ['dokuchishiki'], rule: 'short', tech: 'dokuba' },
  { id: 'chougou', name: '調合', kind: 'small', branch: '毒', needs: ['dokuba'], stat: { atk: 0.03 } },
  { id: 'nuri', name: '毒を塗る', kind: 'card', branch: '毒', needs: ['chougou'], rule: 'around', text: '修飾の札：次の技に毒を付ける' },
  { id: 'ashioto', name: '足音', kind: 'small', branch: '影', needs: ['kehai'], stat: { taken: 0.02 } },
  { id: 'kagenui', name: '影縫い', kind: 'tech', branch: '影', needs: ['ashioto'], rule: 'diag', tech: 'kagenui' },
  { id: 'yami', name: '闇', kind: 'small', branch: '影', needs: ['kagenui'], stat: { atk: 0.03 } },
  { id: 'fuiuchi', name: '不意を突く', kind: 'card', branch: '影', needs: ['yami'], rule: 'short', text: '条件の札：敵が止まっていなければ次の1枚を飛ばす' },
  { id: 'migaru', name: '身軽', kind: 'small', branch: '煙', needs: ['kehai'], stat: { speed: 0.02 } },
  { id: 'kemuri', name: '煙玉', kind: 'tech', branch: '煙', needs: ['migaru'], rule: 'around', tech: 'kemuri' },
  { id: 'shinobiashi', name: '忍び足', kind: 'small', branch: '煙', needs: ['kemuri'], stat: { taken: 0.02 } },
  { id: 'shinobi', name: '忍び', kind: 'card', branch: '煙', needs: ['shinobiashi'], rule: 'diag', text: '修飾の札：次の技が盾に防がれない' },
  { id: 'ansatsu', name: '暗殺', kind: 'secret', branch: '奥', needsAny: { of: ['dokuba', 'kagenui', 'kemuri'], n: 2, level: 3 }, rules: ['diag', 'short'], tech: 'ansatsu' },
  { id: 'kagebunshin', name: '影分身', kind: 'cross', branch: '奥', needs: ['kemuri', 'ookami'], rules: ['short', 'around'], tech: 'kagebunshin' },
].map((n) => ({ ...n, school: 'stealth' })));

// 修行中の技（巻物での手がかり）。
export const STEALTH_TECHS = Object.freeze({
  dokuba: { name: '毒の刃', text: '選んだマスと右のマスの答え（灯りか、置かないか）が分かる' },
  kagenui: { name: '影縫い', text: '選んだマスのまわり8マス（選んだマスは数えない）に灯りがいくつあるか分かる' },
  kemuri: { name: '煙玉', text: '選んだマスと上下左右の答えが分かる' },
  ansatsu: { name: '暗殺', text: '選んだマスの行の答えが全部分かる' },
  kagebunshin: { name: '影分身', text: '選んだマスと、盤の向かい側のマスの答えが分かる' },
});

export const STEALTH_SECOND = Object.freeze({ diag: 'short', short: 'around', around: 'diag' });

// 節の段ごとの巻物の形。maxRounds は浅い仮置きの数の上限。
export function stealthSpec(node, level) {
  const s = STEALTH_SIZES.small, l = STEALTH_SIZES.large;
  const base = { kind: 'lamps' };
  if (node.kind === 'small') return level < 2 ? { ...base, ...s, rules: [], maxLevel: 1 } : { ...base, ...l, rules: [], maxLevel: 2, maxRounds: 2 };
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret' || node.kind === 'cross') return { ...base, ...l, rules: main, maxLevel: 2, maxRounds: level < 2 ? 3 : 5 };
  if (level <= 1) return { ...base, ...s, rules: main, maxLevel: 2, maxRounds: 2 };
  if (level === 2) return { ...base, ...l, rules: main, maxLevel: 2, maxRounds: 3 };
  return { ...base, ...l, rules: [main[0], STEALTH_SECOND[main[0]]], maxLevel: 2, maxRounds: level === 3 ? 4 : 6 };
}
