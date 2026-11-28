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
});

// 札の種類の呼び名
export const CARD_KINDS = Object.freeze({ tech: '技', mod: '修飾', cond: '条件', stack: '重ね' });

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

// 殻を通るダメージの下限（殻より小さい攻撃でも元の1割は通る）。
export const SHELL_MIN = 0.1;
