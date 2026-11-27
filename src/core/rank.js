// マージの盤のランクと価値（判定表 第1回 D3）。
// ランクは 1〜RANK_MAX。ランクが1つ上がるごとに価値は RANK_RATIO 倍。
// 3個合わせると上のランク1個、5個合わせると上のランク2個。
// 3倍なので、3個合わせは価値の合計が変わらず場所だけ空き、5個合わせは2割の得になる。

export const RANK_MAX = 7;
export const RANK_RATIO = 3;

// 何個合わせると、上のランクが何個できるか。
export const MERGE_OUT = Object.freeze({ 3: 1, 5: 2 });

// ランク1を1としたときの価値。
export function rankValue(rank) {
  if (!Number.isInteger(rank) || rank < 1 || rank > RANK_MAX) {
    throw new RangeError(`ランクは 1〜${RANK_MAX}: ${rank}`);
  }
  return RANK_RATIO ** (rank - 1);
}

// 同じランクの物を count 個合わせた結果。合わせられないときは null。
export function merge(rank, count) {
  const out = MERGE_OUT[count];
  if (out === undefined || rank >= RANK_MAX) return null;
  rankValue(rank); // 範囲の確かめ
  return { rank: rank + 1, count: out };
}

// 合わせる前と後の価値の比（1 なら損得なし、1.2 なら2割の得）。
export function mergeGain(count) {
  const out = MERGE_OUT[count];
  if (out === undefined) return null;
  return (out * RANK_RATIO) / count;
}
