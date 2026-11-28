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
  kizu: { name: '傷の構え', type: 'cond', swings: 0, node: 'kizu', text: 'HP が半分以下でなければ次の1枚を飛ばす' },
  tame: { name: '溜め', type: 'mod', swings: 0.5, mult: 2, timeMult: 1.5, node: 'tame', text: '次の技の効きが2倍、その技の時間は1.5倍' },
});

export const LINEUP = Object.freeze({
  baseSlots: 3,
  maxSlots: 10,
  perLevel: 0.1, // 節の段ごとの効き
  slotLevel: 3, // 技・札・奥義の節がこの段で枠 ＋1
});

// 状態（判定表 第9回 C1）。崩し：敵が受けるダメージ ＋30%・殻が半分。構え：受けるダメージ半分。
export const STATES = Object.freeze({ breakTaken: 1.3, breakShell: 0.5, stanceTaken: 0.5 });

// 殻を通るダメージの下限（殻より小さい攻撃でも元の1割は通る）。
export const SHELL_MIN = 0.1;
