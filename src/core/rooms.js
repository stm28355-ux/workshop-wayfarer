// 道場の巻物（召喚：部屋分け）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。工程7d。
// 盤は w×h。数字のマスがいくつかあり、盤を長方形の部屋に分ける。どの部屋にも数字がちょうど1つで、
// 部屋のマスの数はその数字。答えは rooms：[{ clue: マス, x, y, w, h }]。
// 変えルール：
//   square 正方形：部屋は全部正方形
//   elem   属性の印：数字のマスに属性（火・水・氷・雷）が付き、隣り合う部屋は同じ属性でない
//   hidden 隠れた数：いくつかの数字が「？」（大きさが分からない部屋）
// 解く道具の手の難しさ（守り・剣と同じ考え方）：
//   1＝その数字の部屋の置き方が1通りしかない（ほかの部屋と重なる置き方を除いて）
//   2＝あるマスに届く数字が1つしかない、など盤を見回して置き方を減らす（1回り＝1手）
//   3＝盤全体（仮に置いて、盤全体を進めて矛盾が出る）

import { rng } from './scroll.js';

export const ROOM_RULES = Object.freeze({ square: '正方形', elem: '属性の印', hidden: '隠れた数' });

export function roomCells(r, W) {
  const out = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push(y * W + x);
  return out;
}

function touches(a, b) {
  const xo = a.x < b.x + b.w && b.x < a.x + a.w;
  const yo = a.y < b.y + b.h && b.y < a.y + a.h;
  if (xo && yo) return false;
  if (xo && (a.y + a.h === b.y || b.y + b.h === a.y)) return true;
  if (yo && (a.x + a.w === b.x || b.x + b.w === a.x)) return true;
  return false;
}

// 数字 k の部屋の置き方の候補。
function candidatesOf(p, k) {
  const c = p.clues[k];
  const cx = c.at % p.w, cy = Math.floor(c.at / p.w);
  const areas = c.n ? [c.n] : Array.from({ length: p.maxArea }, (_, i) => i + 1);
  const others = new Set(p.clues.filter((_, j) => j !== k).map((o) => o.at));
  const out = [];
  for (const a of areas) {
    for (let rw = 1; rw <= a; rw++) {
      if (a % rw) continue;
      const rh = a / rw;
      if (p.rules.includes('square') && rw !== rh) continue;
      for (let x = cx - rw + 1; x <= cx; x++) for (let y = cy - rh + 1; y <= cy; y++) {
        if (x < 0 || y < 0 || x + rw > p.w || y + rh > p.h) continue;
        const r = { clue: k, x, y, w: rw, h: rh };
        if (roomCells(r, p.w).some((i) => others.has(i))) continue;
        out.push(r);
      }
    }
  }
  return out;
}

const key = (r) => `${r.x},${r.y},${r.w},${r.h}`;

// 部屋の並びが答えか。
export function checkRooms(p, rooms) {
  const cover = new Array(p.w * p.h).fill(-1);
  for (const r of rooms) {
    for (const i of roomCells(r, p.w)) { if (cover[i] >= 0) return false; cover[i] = r.clue; }
    const inside = p.clues.filter((c) => roomCells(r, p.w).includes(c.at));
    if (inside.length !== 1) return false;
    if (inside[0].n && inside[0].n !== r.w * r.h) return false;
    if (p.rules.includes('square') && r.w !== r.h) return false;
  }
  if (cover.some((v) => v < 0)) return false;
  if (p.rules.includes('elem')) {
    for (let a = 0; a < rooms.length; a++) for (let b = a + 1; b < rooms.length; b++) {
      if (p.clues[rooms[a].clue].elem === p.clues[rooms[b].clue].elem && touches(rooms[a], rooms[b])) return false;
    }
  }
  return true;
}

// 答えを数える（limit まで）。
export function countRooms(p, limit = 2) {
  const cands = p.clues.map((_, k) => candidatesOf(p, k));
  const used = new Uint8Array(p.w * p.h);
  const chosen = [];
  let count = 0;
  const order = cands.map((c, k) => k).sort((a, b) => cands[a].length - cands[b].length);
  const rec = (d) => {
    if (count >= limit) return;
    if (d === order.length) {
      if (used.every((v) => v) && (!p.rules.includes('elem') || checkRooms(p, chosen))) count += 1;
      return;
    }
    const k = order[d];
    for (const r of cands[k]) {
      const cells = roomCells(r, p.w);
      if (cells.some((i) => used[i])) continue;
      if (p.rules.includes('elem') && chosen.some((o) => p.clues[o.clue].elem === p.clues[k].elem && touches(o, r))) continue;
      for (const i of cells) used[i] = 1;
      chosen.push(r);
      rec(d + 1);
      chosen.pop();
      for (const i of cells) used[i] = 0;
      if (count >= limit) return;
    }
  };
  rec(0);
  return count;
}

// 人の手に近い解き方。{ solved, by, max, cands }
export function solveRooms(p, opts = {}) {
  const maxLevel = opts.maxLevel ?? 3;
  const N = p.w * p.h;
  const by = { 1: 0, 2: 0, 3: 0 };
  const start = p.clues.map((_, k) => candidatesOf(p, k));

  // 1：決まった部屋のマスと重なる置き方・同じ属性で接する置き方を消し、1通りになった部屋を決める。矛盾なら false
  const basic = (cands) => {
    let changed = true;
    while (changed) {
      changed = false;
      const fixed = cands.map((c) => (c.length === 1 ? c[0] : null));
      const taken = new Int16Array(N).fill(-1);
      for (const r of fixed) if (r) for (const i of roomCells(r, p.w)) { if (taken[i] >= 0) return false; taken[i] = r.clue; }
      for (let k = 0; k < cands.length; k++) {
        if (cands[k].length === 1) continue;
        const keep = cands[k].filter((r) => roomCells(r, p.w).every((i) => taken[i] < 0)
          && (!p.rules.includes('elem') || !fixed.some((f) => f && p.clues[f.clue].elem === p.clues[k].elem && touches(f, r))));
        if (keep.length === 0) return false;
        if (keep.length !== cands[k].length) { cands[k] = keep; changed = true; }
      }
    }
    return true;
  };
  // 2：マスに届く部屋が1つだけなら、その部屋はそのマスを含む。部屋の全部の置き方が含むマスは、ほかの部屋が使えない（1回り）
  const round = (cands) => {
    let any = false;
    const reach = Array.from({ length: N }, () => new Set());
    cands.forEach((c, k) => { for (const r of c) for (const i of roomCells(r, p.w)) reach[i].add(k); });
    for (let i = 0; i < N; i++) {
      if (reach[i].size === 0) return { any, broken: true };
      if (reach[i].size === 1) {
        const k = [...reach[i]][0];
        const keep = cands[k].filter((r) => roomCells(r, p.w).includes(i));
        if (keep.length !== cands[k].length) { cands[k] = keep; any = true; }
      }
    }
    for (let k = 0; k < cands.length; k++) {
      if (!cands[k].length) return { any, broken: true };
      const core = roomCells(cands[k][0], p.w).filter((i) => cands[k].every((r) => roomCells(r, p.w).includes(i)));
      for (let j = 0; j < cands.length; j++) {
        if (j === k) continue;
        const keep = cands[j].filter((r) => !roomCells(r, p.w).some((i) => core.includes(i)));
        if (keep.length !== cands[j].length) { cands[j] = keep; any = true; }
      }
    }
    return { any, broken: false };
  };
  const done = (cands) => cands.every((c) => c.length === 1);
  const settle = (cands) => {
    for (;;) {
      if (!basic(cands)) return false;
      if (done(cands)) return checkRooms(p, cands.map((c) => c[0]));
      const r = round(cands);
      if (r.broken) return false;
      if (!r.any) return true;
    }
  };
  const cands = start.map((c) => c.slice());
  for (;;) {
    if (!basic(cands)) return { solved: false, by, max: 0, cands };
    if (done(cands)) break;
    if (maxLevel >= 2) {
      const r = round(cands);
      if (r.broken) return { solved: false, by, max: 2, cands };
      if (r.any) { by[2] += 1; continue; }
    }
    if (maxLevel < 3) return { solved: false, by, max: 0, cands };
    let moved = false;
    for (let k = 0; k < cands.length && !moved; k++) {
      if (cands[k].length < 2) continue;
      for (const r of cands[k]) {
        const t = cands.map((c) => c.slice());
        t[k] = [r];
        if (!settle(t)) { cands[k] = cands[k].filter((x) => x !== r); moved = true; break; }
      }
    }
    if (!moved) return { solved: false, by, max: 3, cands };
    by[3] += 1;
  }
  by[1] = 1;
  const sol = new Set(p.rooms.map(key));
  const solved = cands.every((c) => c.length === 1 && sol.has(key(c[0])));
  return { solved, by, max: by[3] ? 3 : by[2] ? 2 : 1, cands };
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 盤を長方形に切る（大きさ minA〜maxA。正方形の巻物は正方形だけ）。
function partition(w, h, rand, square, maxA) {
  const owner = new Int16Array(w * h).fill(-1);
  const rooms = [];
  for (let i = 0; i < w * h; i++) {
    if (owner[i] >= 0) continue;
    const x = i % w, y = Math.floor(i / w);
    const opts = [];
    for (let rw = 1; rw <= maxA; rw++) for (let rh = 1; rh * rw <= maxA; rh++) {
      if (square && rw !== rh) continue;
      if (x + rw > w || y + rh > h) continue;
      let ok = true;
      for (let yy = y; yy < y + rh && ok; yy++) for (let xx = x; xx < x + rw && ok; xx++) if (owner[yy * w + xx] >= 0) ok = false;
      if (!ok) continue;
      const a = rw * rh;
      // 1マスの部屋は少なめ、大きい部屋をやや多めに
      const weight = a === 1 ? 0.25 : 1 + a * (square ? 0.5 : 0.15);
      opts.push({ rw, rh, weight });
    }
    let t = rand() * opts.reduce((s, o) => s + o.weight, 0);
    let pick = opts[0];
    for (const o of opts) { t -= o.weight; if (t <= 0) { pick = o; break; } }
    const r = { x, y, w: pick.rw, h: pick.rh };
    for (const c of roomCells(r, w)) owner[c] = rooms.length;
    rooms.push(r);
  }
  return rooms;
}

// spec：{ w, h, rules, seed, maxLevel, maxGlobal, minRounds, maxRounds }
export function generateRooms(spec) {
  const rand = rng(spec.seed);
  const { w, h, rules } = spec;
  const maxA = rules.includes('square') ? 9 : Math.min(8, Math.max(4, Math.round((w * h) / 5)));
  const maxLevel = spec.maxLevel ?? 3;
  for (let attempt = 0; attempt < 200; attempt++) {
    const parts = partition(w, h, rand, rules.includes('square'), maxA);
    // 1マスの部屋が多い盤は作り直す（正方形の盤は 1×1 が増えやすいので半分まで）
    if (parts.filter((r) => r.w * r.h === 1).length > Math.ceil(parts.length / (rules.includes('square') ? 2 : 4))) continue;
    const clues = [];
    const rooms = [];
    parts.forEach((r, k) => {
      const cells = roomCells(r, w);
      const at = cells[Math.floor(rand() * cells.length)];
      clues.push({ at, n: r.w * r.h });
      rooms.push({ clue: k, ...r });
    });
    if (rules.includes('elem')) {
      // 隣り合う部屋が違う属性になるように色を塗る（4色）
      const elems = new Array(rooms.length).fill(-1);
      const order = shuffle([...rooms.keys()], rand);
      let ok = true;
      for (const k of order) {
        const used = new Set(rooms.filter((o, j) => elems[j] >= 0 && touches(o, rooms[k])).map((o) => elems[rooms.indexOf(o)]));
        const free = shuffle([0, 1, 2, 3].filter((e) => !used.has(e)), rand);
        if (!free.length) { ok = false; break; }
        elems[k] = free[0];
      }
      if (!ok) continue;
      clues.forEach((c, k) => { c.elem = elems[k]; });
    }
    const p = { kind: 'rooms', w, h, rules: rules.slice(), clues, rooms, maxArea: maxA };
    if (rules.includes('hidden')) {
      // 大きさを隠しても答えが1つの数字を、いくつか「？」にする
      for (const k of shuffle([...clues.keys()], rand)) {
        if (clues.filter((c) => !c.n).length >= Math.max(1, Math.round(clues.length / 4))) break;
        const n = clues[k].n;
        clues[k].n = 0;
        if (countRooms(p, 2) !== 1) clues[k].n = n;
      }
      if (!clues.some((c) => !c.n)) continue;
    }
    if (countRooms(p, 2) !== 1) continue;
    const r = solveRooms(p, { maxLevel });
    if (!r.solved) continue;
    if (spec.maxGlobal !== undefined && r.by[3] > spec.maxGlobal) continue;
    if (spec.minLevel && r.max < spec.minLevel) continue;
    if (spec.minRounds && r.by[2] < spec.minRounds) continue;
    if (spec.maxRounds !== undefined && r.by[2] > spec.maxRounds) continue;
    return { puzzle: p, result: r, attempts: attempt + 1 };
  }
  return null;
}
