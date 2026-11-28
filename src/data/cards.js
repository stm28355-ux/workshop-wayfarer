// 技の並びの札（判定表 第9回。全部仮で、木人と遊んだ結果で直す）。
// 普通の攻撃は今のまま続き、札はその合間に左から順に使う。最後の札の後は積み直し（武器の秒数）で、その間も普通の攻撃。
// swings：札の時間（振り。1振り＝武器の攻撃の間）。node：使えるようになる道場の節（その節が 1/5 以上）。
// 効きは節の段ごとに ＋10%（1/5 で 1.0 倍）。修飾が掛かると mult 倍。
// 木人で測って直した：見切りは2回→1回、心眼は1振り3秒→2振り2.5秒（3枚並べると攻撃をほぼ全部かわせて強すぎた）。
export const CARDS = Object.freeze({
  strong: { name: '強斬り', type: 'tech', swings: 2, damage: 3.0, opens: 'stage:dojo', text: '攻撃×3.0 の一撃' },
  tateuchi: { name: '盾打ち', type: 'tech', swings: 1, damage: 1.2, breakSec: 5, node: 'tateuchi', text: '攻撃×1.2＋敵に崩し5秒' },
  mikiri: { name: '見切り', type: 'tech', swings: 0.5, dodge: 1, node: 'mikiri', text: '敵の攻撃を1回かわす' },
  tategamae: { name: '盾構え', type: 'tech', swings: 0.5, stanceSec: 4, node: 'tategamae', text: '4秒、受けるダメージ半分' },
  ukenagashi: { name: '受け流し', type: 'tech', swings: 0.5, parry: 3, node: 'ukenagashi', text: '次の1撃をなくし、敵の攻撃×3を返す' },
  shingan: { name: '心眼', type: 'tech', swings: 2, focusSec: 2.5, counter: 1.0, node: 'shingan', text: '2.5秒、攻撃を全部かわし、かわすたびに攻撃×1.0で反撃' },
  kizu: { name: '傷の構え', type: 'cond', swings: 0, cond: 'halfHp', node: 'kizu', text: 'HP が半分以下でなければ次の1枚を飛ばす' },
  tame: { name: '溜め', type: 'mod', swings: 0.5, mult: 2, timeMult: 1.5, node: 'tame', text: '次の技の効きが2倍、その技の時間は1.5倍' },
  // 剣（判定表 第13回 C2〜C4）
  renda: { name: '連撃', type: 'tech', swings: 1, damage: 0.5, hits: 3, node: 'renda', text: '攻撃×0.5 を3回（盾は1回ずつ減る。殻は毎回引かれる）' },
  jujigiri: { name: '十字斬り', type: 'tech', swings: 2, damage: 2.5, pierce: true, node: 'jujigiri', text: '攻撃×2.5、殻を無視する' },
  shukketsu: { name: '出血の刃', type: 'tech', swings: 1, damage: 0.8, bleed: 1, node: 'shukketsu', text: '攻撃×0.8＋出血1重' },
  issen: { name: '一閃', type: 'tech', swings: 2, damage: 4.0, area: true, node: 'issen', text: '攻撃×4.0 を群れの全員に' },
  kenjun: { name: '剣盾', type: 'tech', swings: 1, damage: 1.5, breakSec: 5, node: 'kenjun', text: '攻撃×1.5＋敵に崩し5秒' },
  nidan: { name: '二段', type: 'stack', swings: 0, count: 2, node: 'nidan', text: '次の2枚を同時に使う（時間は長い方）' },
  hanika: { name: '範囲化', type: 'mod', swings: 0.5, mult: 1, timeMult: 1.2, area: true, node: 'hanika', text: '次の技が群れの全員に当たる（時間×1.2）' },
  iai: { name: '居合', type: 'cond', swings: 0, cond: 'opening', node: 'iai', text: '戦いが始まって3秒より後なら、次の1枚を飛ばす' },
  // 魔法（判定表 第18回 E）。elem：属性（D1）。打撃（blunt）は強斬り・盾打ち・剣盾
  kakyu: { name: '火球', type: 'tech', swings: 2, damage: 1.5, elem: 'fire', node: 'kakyu', text: '火 攻撃×1.5＋燃焼' },
  hyoso: { name: '氷の槍', type: 'tech', swings: 2, damage: 1.8, elem: 'ice', node: 'hyoso', text: '氷 攻撃×1.8（濡れていれば凍る、でなければ2回で凍る）' },
  raigeki: { name: '雷撃', type: 'tech', swings: 1.5, damage: 1.2, elem: 'thunder', node: 'raigeki', text: '雷 攻撃×1.2＋感電（盾を1枚はがす）' },
  inseki: { name: '隕石', type: 'tech', swings: 3, damage: 5.0, area: true, elem: 'fire', node: 'inseki', text: '火 攻撃×5.0 を群れの全員に＋燃焼' },
  mahouken: { name: '魔法剣', type: 'tech', swings: 2, damage: 2.0, elem: 'thunder', strip: 2, node: 'mahouken', text: '雷 攻撃×2.0＋感電、盾を2枚はがす' },
  nijuu: { name: '二重詠唱', type: 'mod', swings: 0, mult: 1, timeMult: 1.5, repeat: 2, node: 'nijuu', text: '次の技を2回使う（時間は1.5倍）' },
  matou: { name: '水をまとう', type: 'mod', swings: 0.5, mult: 1, timeMult: 1, wet: true, node: 'matou', text: '次の技に濡れを付ける' },
  kooreba: { name: '凍っていれば', type: 'cond', swings: 0, cond: 'frozen', node: 'kooreba', text: '敵が凍っていなければ次の1枚を飛ばす' },
  // 弓（判定表 第18回 F）
  rensha: { name: '連射', type: 'tech', swings: 1, damage: 0.4, hits: 5, node: 'rensha', text: '攻撃×0.4 を5回（盾に強い）' },
  neraiuchi: { name: '狙い撃ち', type: 'tech', swings: 1.5, damage: 2.0, mark: true, node: 'neraiuchi', text: '攻撃×2.0＋印（10秒、受けるダメージ＋20%）' },
  kazeya: { name: '風の矢', type: 'tech', swings: 1, damage: 1.0, elem: 'wind', node: 'kazeya', text: '風 攻撃×1.0、燃焼を群れの全員へ広げる' },
  ryuusei: { name: '流星', type: 'tech', swings: 2.5, damage: 0.6, hits: 8, area: true, node: 'ryuusei', text: '攻撃×0.6 を8回、群れの全員に' },
  kooriya: { name: '氷の矢', type: 'tech', swings: 1.5, damage: 1.5, elem: 'ice', shatter: true, node: 'kooriya', text: '氷 攻撃×1.5、凍った敵には打撃と同じく3倍' },
  oiuchi: { name: '追い撃ち', type: 'trig', swings: 0, node: 'oiuchi', text: '次の技で敵を倒したら、その次の札を次の敵へすぐ放つ（時間なし）' },
  shirushi: { name: '印があれば', type: 'cond', swings: 0, cond: 'marked', node: 'shirushi', text: '敵に印がなければ次の1枚を飛ばす' },
  tsuranuki: { name: '貫き', type: 'mod', swings: 0.5, mult: 1, timeMult: 1, pierce: true, node: 'tsuranuki', text: '次の技が殻を無視する' },
});

// 打撃の札（凍った敵に3倍。判定表 第18回 D1・D4）
export const BLUNT = Object.freeze(['strong', 'tateuchi', 'kenjun']);

// 札の種類の呼び名
export const CARD_KINDS = Object.freeze({ tech: '技', mod: '修飾', cond: '条件', stack: '重ね', trig: '引き金' });

export const LINEUP = Object.freeze({
  baseSlots: 3,
  maxSlots: 10,
  perLevel: 0.1, // 節の段ごとの効き
  slotLevel: 3, // 技・札・奥義の節がこの段で枠 ＋1
});

// 状態（判定表 第9回 C1）。崩し：敵が受けるダメージ ＋30%・殻が半分。構え：受けるダメージ半分。
// 出血（第13回 C3）：1重ごとに毎秒、勇者の攻撃×bleedPer を削る（殻を無視）。bleedMax 重で弾けて攻撃×bleedBurst、重ねは0に。
// 居合：戦いが始まって iaiSec 秒まで。
export const STATES = Object.freeze({ breakTaken: 1.3, breakShell: 0.5, stanceTaken: 0.5, bleedPer: 0.1, bleedMax: 5, bleedBurst: 3, iaiSec: 3 });

// 属性の状態（判定表 第18回 D2〜D6。全部仮）。
// 燃焼：burnEvery 秒ごとに 攻撃×burnPer を burnTimes 回（付け直すと回数が戻る）。殻と盾を無視。
// 濡れ：wetSec 秒。火の技は wetFire 倍で燃焼は付かず、濡れは消える。
// 凍結：freezeSec 秒、敵の攻撃と盾の張り直しが止まる。濡れていれば氷1回、でなければ氷 chillToFreeze 回。打撃は shatter 倍で、当てると解ける。火でも解ける。
// 感電：次の shockHits 回の普通の攻撃が群れの隣にも当たる（濡れていれば群れの全員）。付いたときに盾を1枚はがす。
// 印：markSec 秒、受けるダメージ ×markTaken。
export const ELEMENT_STATES = Object.freeze({
  burnEvery: 3, burnPer: 0.3, burnTimes: 5,
  wetSec: 8, wetFire: 0.5,
  freezeSec: 2, chillToFreeze: 2, shatter: 3,
  shockHits: 3,
  markSec: 10, markTaken: 1.2,
});

// 殻を通るダメージの下限（殻より小さい攻撃でも元の1割は通る）。
export const SHELL_MIN = 0.1;
