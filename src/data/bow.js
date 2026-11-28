// 弓の流派の数値（判定表 第18回 C・F。全部仮）。巻物は鏡で光を通す（src/core/mirrors.js）。

// 巻物の大きさ（C2）：1/5・2/5 は 5×5、3/5〜5/5 は 7×7。盤の外に行と列の鏡の数がいつも出る。
export const BOW_SIZES = Object.freeze({ small: { w: 5, h: 5 }, large: { w: 7, h: 7 } });

// 弓の15節（F1〜F5）。奥義は技の節2つが 3/5 で開く（第18回 G2）。合流「氷の矢」は狙い撃ちと氷の槍が 1/5 で開く。
export const BOW_TREE = Object.freeze([
  { id: 'tsuru', name: '弦', kind: 'small', branch: '根', needs: [], stat: { atk: 0.03 } },
  { id: 'hayate', name: '早手', kind: 'small', branch: '速射', needs: ['tsuru'], stat: { speed: 0.02 } },
  { id: 'rensha', name: '連射', kind: 'tech', branch: '速射', needs: ['hayate'], rule: 'color', tech: 'rensha' },
  { id: 'kokyu', name: '呼吸', kind: 'small', branch: '速射', needs: ['rensha'], stat: { taken: 0.02 } },
  { id: 'oiuchi', name: '追い撃ち', kind: 'card', branch: '速射', needs: ['kokyu'], rule: 'break', text: '引き金の札：技で敵を倒したら、次の1枚をすぐ次の敵へ放つ' },
  { id: 'me', name: '鷹の目', kind: 'small', branch: '狙い', needs: ['tsuru'], stat: { atk: 0.03 } },
  { id: 'neraiuchi', name: '狙い撃ち', kind: 'tech', branch: '狙い', needs: ['me'], rule: 'label', tech: 'neraiuchi' },
  { id: 'shuuchuu', name: '集中', kind: 'small', branch: '狙い', needs: ['neraiuchi'], stat: { atk: 0.03 } },
  { id: 'shirushi', name: '印があれば', kind: 'card', branch: '狙い', needs: ['shuuchuu'], rule: 'color', text: '条件の札：敵に印がなければ次の1枚を飛ばす' },
  { id: 'kazeyomi', name: '風読み', kind: 'small', branch: '風', needs: ['tsuru'], stat: { hp: 0.04 } },
  { id: 'kazeya', name: '風の矢', kind: 'tech', branch: '風', needs: ['kazeyomi'], rule: 'break', tech: 'kazeya' },
  { id: 'oikaze', name: '追い風', kind: 'small', branch: '風', needs: ['kazeya'], stat: { speed: 0.02 } },
  { id: 'tsuranuki', name: '貫き', kind: 'card', branch: '風', needs: ['oikaze'], rule: 'label', text: '修飾の札：次の技が殻を無視する' },
  { id: 'ryuusei', name: '流星', kind: 'secret', branch: '奥', needsAny: { of: ['rensha', 'neraiuchi', 'kazeya'], n: 2, level: 3 }, rules: ['color', 'break'], tech: 'ryuusei' },
  { id: 'kooriya', name: '氷の矢', kind: 'cross', branch: '奥', needs: ['neraiuchi', 'hyoso'], rules: ['break', 'label'], tech: 'kooriya' },
].map((n) => ({ ...n, school: 'bow' })));

// 弓の修行中の技（巻物での手がかり）。戦いでの効きは src/data/cards.js。
export const BOW_TECHS = Object.freeze({
  rensha: { name: '連射', text: '選んだマスから右へ3マスの答えが分かる' },
  neraiuchi: { name: '狙い撃ち', text: '選んだマスの答えと、まわり8マス（選んだマスは数えない）の鏡の数が分かる' },
  kazeya: { name: '風の矢', text: '選んだマスと上下のマスの答えが分かる' },
  ryuusei: { name: '流星', text: '選んだマスの行の答えが全部分かる' },
  kooriya: { name: '氷の矢', text: '選んだマスから右下の2×2の答えが分かる' },
});

export const BOW_SECOND = Object.freeze({ color: 'break', break: 'label', label: 'color' });

// 節の段ごとの巻物の形。maxNodes は解く道具がたどった枝の数の上限（迷いすぎる盤をはじく）。
export function bowSpec(node, level) {
  const s = BOW_SIZES.small, l = BOW_SIZES.large;
  const base = { kind: 'beam' };
  // extraShown：答えが1つに決まった後に見せる鏡の数（判定表 第19回「技を使う前提の難しさ」→ 5×5 は2、7×7 は3）
  const S = { ...base, ...s, extraShown: 2 }, L = { ...base, ...l, extraShown: 3 };
  if (node.kind === 'small') return level < 2 ? { ...S, rules: [], maxNodes: 400 } : { ...L, rules: [], maxNodes: 6000 };
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret' || node.kind === 'cross') return { ...L, rules: main, maxNodes: 8000 };
  if (level <= 1) return { ...S, rules: main, maxNodes: 600 };
  if (level === 2) return { ...L, rules: main, maxNodes: 6000 };
  return { ...L, rules: [main[0], BOW_SECOND[main[0]]], maxNodes: 8000 };
}
