// マージの職人（判定表 第3回 E1〜E3）。純粋な関数だけ。
// 盤の中の同じ物を、隣り合っていなくても集めて合わせる。低いランクから。5個あれば5個（2個できる）、3〜4個なら3個。
// 5個そろうのを待つことはしない。できた物は使ったマスのうち左上から読んで最初のマスに置く。
// 人が選んでいる物・ドラッグしている物（locked のマス）には触らない。合わせられるのは maxRank 以下だけ。

import { RANK_MAX, merge } from './rank.js';
import { KINDS } from '../data/balance.js';

const KIND_ORDER = Object.keys(KINDS);

// opts.wait5：5個そろうまで待つ（空きマスが waitEmpty 以下なら3〜4個でも合わせる）。
export function crafterMerge(board, maxRank, locked = [], opts = {}) {
  const skip = new Set(locked);
  const groups = new Map();
  board.cells.forEach((c, i) => {
    if (!c || skip.has(i) || c.rank >= RANK_MAX || c.rank > maxRank) return;
    const key = `${c.rank}:${c.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  let ready = [...groups.entries()]
    .filter(([, cells]) => cells.length >= 3)
    .map(([key, cells]) => {
      const [rank, kind] = key.split(':');
      return { rank: Number(rank), kind, cells };
    })
    .sort((a, b) => a.rank - b.rank || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  if (opts.wait5) {
    const five = ready.filter((g) => g.cells.length >= 5);
    const empty = board.cells.filter((c) => !c).length;
    ready = five.length ? five : empty <= (opts.waitEmpty ?? 2) ? ready : [];
  }
  if (ready.length === 0) return { board, merged: null };
  const g = ready[0];
  const used = g.cells.length >= 5 ? 5 : 3;
  const made = merge(g.rank, used);
  const cells = g.cells.slice(0, used); // 読む順なので先頭が左上
  const next = { ...board, cells: board.cells.slice() };
  for (const c of cells) next.cells[c] = null;
  for (let i = 0; i < made.count; i++) next.cells[cells[i]] = { kind: g.kind, rank: made.rank };
  return { board: next, merged: { kind: g.kind, from: g.rank, rank: made.rank, used, made: made.count, at: cells.slice(0, made.count) } };
}
