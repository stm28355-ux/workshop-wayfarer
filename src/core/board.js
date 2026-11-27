// マージの盤（段1）。純粋な関数だけ。盤は { w, h, cells }、cells[y * w + x] は { kind, rank } か null。
// 合わせ方は Farm Merge Valley と同じ形：
// 手で物を動かしたとき、動かした先とつながった同じ物（種類とランクが同じ・上下左右）が3個以上なら合わせる。
// 5個以上なら5個を使って上のランク2個、3〜4個なら3個を使って上のランク1個（rank.js）。
// 拾った物が盤に出たときは合わせない（5個そろうまで待つかは人が選ぶ）。

import { RANK_MAX, merge } from './rank.js';

export function createBoard(w, h) {
  return { w, h, cells: Array(w * h).fill(null) };
}

function copy(board) {
  return { w: board.w, h: board.h, cells: board.cells.slice() };
}

export function same(a, b) {
  return !!a && !!b && a.kind === b.kind && a.rank === b.rank;
}

// 上・左・右・下の順の隣。
export function neighbors(board, index) {
  const { w, h } = board;
  const x = index % w;
  const y = Math.floor(index / w);
  const out = [];
  if (y > 0) out.push(index - w);
  if (x > 0) out.push(index - 1);
  if (x < w - 1) out.push(index + 1);
  if (y < h - 1) out.push(index + w);
  return out;
}

export function emptyCount(board) {
  return board.cells.filter((c) => c === null).length;
}

// 拾った物を、左上から読む順で最初の空きマスに置く。空きがなければ index は null（あふれ）。
export function place(board, item) {
  const index = board.cells.indexOf(null);
  if (index < 0) return { board, index: null };
  const next = copy(board);
  next.cells[index] = { kind: item.kind, rank: item.rank };
  return { board: next, index };
}

// index とつながった同じ物のマス。index から近い順（上・左・右・下の順で広げる）。
export function groupAt(board, index) {
  const start = board.cells[index];
  if (!start) return [];
  const seen = new Set([index]);
  const order = [index];
  for (let i = 0; i < order.length; i++) {
    for (const n of neighbors(board, order[i])) {
      if (!seen.has(n) && same(board.cells[n], start)) {
        seen.add(n);
        order.push(n);
      }
    }
  }
  return order;
}

// index のつながりを合わせる。できた物は index と、2個目は近い順で次のマスに置く。
export function mergeAt(board, index) {
  const item = board.cells[index];
  if (!item || item.rank >= RANK_MAX) return { board, merged: null };
  const group = groupAt(board, index);
  if (group.length < 3) return { board, merged: null };
  const used = group.length >= 5 ? 5 : 3;
  const made = merge(item.rank, used);
  const next = copy(board);
  const cells = group.slice(0, used);
  for (const c of cells) next.cells[c] = null;
  for (let i = 0; i < made.count; i++) next.cells[cells[i]] = { kind: item.kind, rank: made.rank };
  return {
    board: next,
    merged: { kind: item.kind, from: item.rank, rank: made.rank, used, made: made.count, at: cells.slice(0, made.count) },
  };
}

// 手で物を動かす。空きマスなら移り、物があれば入れ替える。動かした先で3個以上つながれば合わせる。
export function move(board, from, to) {
  if (from === to || !board.cells[from]) return { board, merged: null };
  const next = copy(board);
  const moving = next.cells[from];
  next.cells[from] = next.cells[to];
  next.cells[to] = moving;
  return mergeAt(next, to);
}

// マスの物を取り出す（出口に入れるとき）。
export function takeAt(board, index) {
  const item = board.cells[index];
  if (!item) return { board, item: null };
  const next = copy(board);
  next.cells[index] = null;
  return { board: next, item };
}

// 盤を広げる。物は同じ (x, y) に残る。
export function widen(board, w, h) {
  if (w < board.w || h < board.h) throw new RangeError('盤は狭められない');
  const next = createBoard(w, h);
  for (let i = 0; i < board.cells.length; i++) {
    const x = i % board.w;
    const y = Math.floor(i / board.w);
    next.cells[y * w + x] = board.cells[i];
  }
  return next;
}
