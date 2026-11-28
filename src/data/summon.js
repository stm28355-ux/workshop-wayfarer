// 召喚の流派の数値（工程7d。全部仮）。巻物は部屋分け（src/core/rooms.js）。
// 戦いでは召喚獣が数秒のあいだ別に攻撃する（盾を1回ずつ削る）。

export const SUMMON_SIZES = Object.freeze({ small: { w: 5, h: 5 }, large: { w: 7, h: 7 } });

// 召喚の15節。根「契約」＋ 獣・精霊・守護の枝 ＋ 奥義「竜を呼ぶ」＋ 合流「狩り」（弓の狙い撃ちと）。
export const SUMMON_TREE = Object.freeze([
  { id: 'keiyaku', name: '契約', kind: 'small', branch: '根', needs: [], stat: { atk: 0.03 } },
  { id: 'kemonogoe', name: '獣の声', kind: 'small', branch: '獣', needs: ['keiyaku'], stat: { hp: 0.04 } },
  { id: 'ookami', name: '狼', kind: 'tech', branch: '獣', needs: ['kemonogoe'], rule: 'square', tech: 'ookami' },
  { id: 'kiba', name: '牙', kind: 'small', branch: '獣', needs: ['ookami'], stat: { atk: 0.03 } },
  { id: 'muredashi', name: '群れ呼び', kind: 'card', branch: '獣', needs: ['kiba'], rule: 'elem', text: '修飾の札：次の召喚は2体' },
  { id: 'seireigoe', name: '精霊の声', kind: 'small', branch: '精霊', needs: ['keiyaku'], stat: { atk: 0.03 } },
  { id: 'hinosei', name: '火の精', kind: 'tech', branch: '精霊', needs: ['seireigoe'], rule: 'elem', tech: 'hinosei' },
  { id: 'kyoumei', name: '共鳴', kind: 'small', branch: '精霊', needs: ['hinosei'], stat: { speed: 0.02 } },
  { id: 'yondeireba', name: '呼んでいれば', kind: 'card', branch: '精霊', needs: ['kyoumei'], rule: 'hidden', text: '条件の札：召喚獣がいなければ次の1枚を飛ばす' },
  { id: 'mamorigoe', name: '守りの声', kind: 'small', branch: '守護', needs: ['keiyaku'], stat: { taken: 0.02 } },
  { id: 'iwamori', name: '岩の守り手', kind: 'tech', branch: '守護', needs: ['mamorigoe'], rule: 'hidden', tech: 'iwamori' },
  { id: 'nehari', name: '根を張る', kind: 'small', branch: '守護', needs: ['iwamori'], stat: { hp: 0.04 } },
  { id: 'gourei', name: '号令', kind: 'card', branch: '守護', needs: ['nehari'], rule: 'square', text: '修飾の札：次の技の効きが1.5倍' },
  { id: 'ryuu', name: '竜を呼ぶ', kind: 'secret', branch: '奥', needsAny: { of: ['ookami', 'hinosei', 'iwamori'], n: 2, level: 3 }, rules: ['square', 'elem'], tech: 'ryuu' },
  { id: 'kari', name: '狩り', kind: 'cross', branch: '奥', needs: ['ookami', 'neraiuchi'], rules: ['elem', 'hidden'], tech: 'kari' },
].map((n) => ({ ...n, school: 'summon' })));

// 修行中の技（巻物での手がかり）。
export const SUMMON_TECHS = Object.freeze({
  ookami: { name: '狼', text: '選んだマスの部屋が分かる' },
  hinosei: { name: '火の精', text: '選んだマスと右のマスの部屋が分かる' },
  iwamori: { name: '岩の守り手', text: '選んだマスの部屋の大きさ（マスの数）が分かる' },
  ryuu: { name: '竜を呼ぶ', text: '選んだマスの行にかかる部屋が全部分かる' },
  kari: { name: '狩り', text: '選んだマスと下のマスの部屋が分かる' },
});

export const SUMMON_SECOND = Object.freeze({ square: 'elem', elem: 'hidden', hidden: 'square' });

// 節の段ごとの巻物の形。部屋分けは易しめなので、技の節の上の段は回りを求める。
export function summonSpec(node, level) {
  const s = SUMMON_SIZES.small, l = SUMMON_SIZES.large;
  const base = { kind: 'rooms' };
  if (node.kind === 'small') return level < 2 ? { ...base, ...s, rules: [], maxLevel: 2 } : { ...base, ...l, rules: [], maxLevel: 2 };
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret' || node.kind === 'cross') {
    return level < 2 ? { ...base, ...l, rules: main, maxLevel: 2 } : { ...base, ...l, rules: main, maxLevel: 3, maxGlobal: 1 };
  }
  if (level <= 1) return { ...base, ...s, rules: main, maxLevel: 2 };
  if (level === 2) return { ...base, ...l, rules: main, maxLevel: 2 };
  if (level === 3) return { ...base, ...l, rules: [main[0], SUMMON_SECOND[main[0]]], maxLevel: 2 };
  return { ...base, ...l, rules: [main[0], SUMMON_SECOND[main[0]]], maxLevel: 3, maxGlobal: 1 };
}
