// 道場の数値（判定表 第6回。全部仮）。

// 巻物の大きさと罠の数（A1・B4）。連結と組は罠を多めに。
export const SCROLL_SIZES = Object.freeze({
  small: { w: 5, h: 5, count: 5, countRule: 6 },
  large: { w: 6, h: 6, count: 8, countRule: 10 },
});

// 熟練（C1 と第6回の直し）：節の1段は熟練2。解くと3（技を使っても減らない）、ミス1回につき −1（最低1）。
export const SKILL = Object.freeze({ perLevel: 2, clear: 3, mistake: 1, min: 1 });

// 門下生（判定表 第11回 A1・A4）：everySec 秒に1枚、熟練 gain。工房で速さを上げると間が speedMult 倍ずつ。
export const DISCIPLE = Object.freeze({ everySec: 90, gain: 2, speedMult: 0.8 });

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

// 守りの15節（判定表 第6回 D）。needs：開くのに 1/5 以上が要る節。needsAny：of のうち n 個が 1/5 以上で開く。
// kind：small＝小さい節（1段ごとに stat が足される）、tech＝技、card＝札、secret＝奥義（技）、cross＝流派をまたぐ技。
// stat（1段ごと）：hp＝最大HP +、atk＝攻撃 +、taken＝受けるダメージ −、regen＝歩く間の回復 +、speed＝攻撃の速さ +（割合）。
// rule：技・札の巻物の主な変えルール（rules は奥義の2つ）。
export const GUARD_TREE = Object.freeze([
  { id: 'kamae', name: '構え', kind: 'small', branch: '根', needs: [], stat: { hp: 0.04 } },
  { id: 'uke', name: '受けの型', kind: 'small', branch: '受け', needs: ['kamae'], stat: { taken: 0.02 } },
  { id: 'mikiri', name: '見切り', kind: 'tech', branch: '受け', needs: ['uke'], rule: 'cross', tech: 'mikiri' },
  { id: 'hada', name: '硬い肌', kind: 'small', branch: '受け', needs: ['mikiri'], stat: { hp: 0.04 } },
  { id: 'tategamae', name: '盾構え', kind: 'tech', branch: '受け', needs: ['hada'], rule: 'connect', tech: 'tategamae' },
  { id: 'kaeshi', name: '返しの型', kind: 'small', branch: '返し', needs: ['kamae'], stat: { atk: 0.03 } },
  { id: 'tateuchi', name: '盾打ち', kind: 'tech', branch: '返し', needs: ['kaeshi'], rule: 'pair', tech: 'tateuchi' },
  { id: 'fumikomi', name: '踏み込み', kind: 'small', branch: '返し', needs: ['tateuchi'], stat: { atk: 0.03 } },
  { id: 'kizu', name: '傷の構え', kind: 'card', branch: '返し', needs: ['fumikomi'], rule: 'cross', text: '条件の札：HP が半分以下なら次の札を使う' },
  { id: 'ibuki', name: '息吹', kind: 'small', branch: '息吹', needs: ['kamae'], stat: { regen: 0.05 } },
  { id: 'ukenagashi', name: '受け流し', kind: 'tech', branch: '息吹', needs: ['ibuki'], rule: 'connect', tech: 'ukenagashi' },
  { id: 'seishin', name: '静心', kind: 'small', branch: '息吹', needs: ['ukenagashi'], stat: { speed: 0.02 } },
  { id: 'tame', name: '溜め', kind: 'card', branch: '息吹', needs: ['seishin'], rule: 'pair', text: '修飾の札：次の技が2倍、時間も伸びる' },
  { id: 'shingan', name: '心眼', kind: 'secret', branch: '奥', needsAny: { of: ['tategamae', 'kizu', 'tame'], n: 2 }, rules: ['cross', 'connect'], tech: 'shingan' },
  { id: 'kenjun', name: '剣盾', kind: 'cross', branch: '奥', needs: ['tateuchi'], locked: '剣の流派と合わせて開く（工程7）' },
]);

// 守りの技の、解読での形（判定表 第6回 C）。戦いでの効きは工程5。
export const TECHS = Object.freeze({
  mikiri: { name: '見切り', text: '選んだ1マスが罠かどうか分かる（安全なら開き、罠なら確かな印）' },
  tategamae: { name: '盾構え', text: '選んだマスと上下左右の5マスの罠の数が分かる' },
  tateuchi: { name: '盾打ち', text: '選んだマスの行と列の罠の数が分かる' },
  ukenagashi: { name: '受け流し', text: '次のミス1回を数えない' },
  shingan: { name: '心眼', text: '選んだマスのまわり3×3の罠に、確かな印が付く' },
});

// 4/5・5/5 で足す2つ目の変えルール（隣の枝の変え。連結と組は両立しないので組には十字）。
export const SECOND_RULE = Object.freeze({ cross: 'connect', connect: 'cross', pair: 'cross' });
