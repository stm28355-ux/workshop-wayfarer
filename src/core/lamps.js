// 道場の巻物（隠密：灯りを置く）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。工程7d。
// 盤は w×h。壁のマス（数字があることも）と白いマス。白いマスに灯りを置き、白いマスを全部照らす。
// 灯りは縦横にまっすぐ壁か盤の端まで照らす。灯りどうしは照らし合ってはいけない。
// 壁の数字は、上下左右に接する灯りの数。答えは lamps（灯りのマスの並び）。
// 変えルール：
//   diag   斜め：灯りは斜めにも照らす
//   short  短い灯り：灯りが届くのは2マスまで
//   around まわりの数：壁の数字はまわり8マスの灯りの数
// 解く道具の手の難しさ：
//   1＝壁の数字・照らされたマス・「照らせるマスが1つしかない」で決まる
//   2＝浅い仮置き（1マスに仮に置いて、1の手だけで矛盾が出る。1回＝1手）
//   3＝使わない（仮置きはどれも2で数える）

import { rng } from './scroll.js';

export const LAMP_RULES = Object.freeze({ diag: '斜めの灯り', short: '短い灯り', around: 'まわりの数' });

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIRS8 = [...DIRS4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

// マス i の灯りが照らすマス（i 自身は含まない）。
export function raysOf(p, i) {
  const x0 = i % p.w, y0 = Math.floor(i / p.w);
  const out = [];
  const reach = p.rules.includes('short') ? 2 : Infinity;
  for (const [dx, dy] of p.rules.includes('diag') ? DIRS8 : DIRS4) {
    let x = x0 + dx, y = y0 + dy, k = 1;
    while (x >= 0 && y >= 0 && x < p.w && y < p.h && k <= reach) {
      const j = y * p.w + x;
      if (p.wall[j]) break;
      out.push(j);
      x += dx; y += dy; k += 1;
    }
  }
  return out;
}

// 壁 i の数字が数えるマス。
export function aroundOf(p, i) {
  const x0 = i % p.w, y0 = Math.floor(i / p.w);
  const out = [];
  for (const [dx, dy] of p.rules.includes('around') ? DIRS8 : DIRS4) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= p.w || y >= p.h) continue;
    const j = y * p.w + x;
    if (!p.wall[j]) out.push(j);
  }
  return out;
}

function prep(p) {
  if (p._rays) return p;
  Object.defineProperty(p, '_rays', { value: p.wall.map((wl, i) => (wl ? [] : raysOf(p, i))), enumerable: false });
  Object.defineProperty(p, '_around', { value: p.wall.map((wl, i) => (wl ? aroundOf(p, i) : [])), enumerable: false });
  return p;
}

// 灯りの並びで照らされるマス。
export function litCells(p, lamps) {
  prep(p);
  const lit = new Set();
  for (const i of lamps) { lit.add(i); for (const j of p._rays[i]) lit.add(j); }
  return lit;
}

export function checkLamps(p, lamps) {
  prep(p);
  const set = new Set(lamps);
  for (const i of lamps) if (p.wall[i] || p._rays[i].some((j) => set.has(j))) return false;
  const lit = litCells(p, lamps);
  for (let i = 0; i < p.wall.length; i++) if (!p.wall[i] && !lit.has(i)) return false;
  for (let i = 0; i < p.wall.length; i++) {
    const n = p.nums[i];
    if (n === null || n === undefined || !p.wall[i]) continue;
    if (p._around[i].filter((j) => set.has(j)).length !== n) return false;
  }
  return true;
}

// 1の手で進める。st：0＝まだ、1＝灯り、2＝置かない。矛盾なら false。
function basic(p, st) {
  const N = st.length;
  let changed = true;
  while (changed) {
    changed = false;
    const lit = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (st[i] === 1) { lit[i] = 1; for (const j of p._rays[i]) { if (st[j] === 1) return false; lit[j] = 1; } }
    // 照らされたマスに灯りは置けない
    for (let i = 0; i < N; i++) if (!p.wall[i] && st[i] === 0 && lit[i]) { st[i] = 2; changed = true; }
    // 壁の数字
    for (let i = 0; i < N; i++) {
      const n = p.nums[i];
      if (!p.wall[i] || n === null || n === undefined) continue;
      const ar = p._around[i];
      const on = ar.filter((j) => st[j] === 1).length;
      const open = ar.filter((j) => st[j] === 0);
      if (on > n || on + open.length < n) return false;
      if (open.length && on === n) { for (const j of open) st[j] = 2; changed = true; }
      else if (open.length && on + open.length === n) { for (const j of open) st[j] = 1; changed = true; }
    }
    if (changed) continue;
    // まだ照らされていないマス：照らせるマスが1つなら灯り、なければ矛盾
    for (let i = 0; i < N; i++) {
      if (p.wall[i] || lit[i]) continue;
      const by = [i, ...p._rays[i]].filter((j) => st[j] === 0);
      if (by.length === 0) return false;
      if (by.length === 1) { st[by[0]] = 1; changed = true; break; }
    }
  }
  return true;
}

function finished(p, st) {
  return st.every((v, i) => p.wall[i] || v !== 0);
}

// 答えを数える（limit まで）。
export function countLamps(p, limit = 2) {
  prep(p);
  let count = 0;
  const rec = (st) => {
    if (count >= limit) return;
    if (!basic(p, st)) return;
    const i = st.findIndex((v, k) => !p.wall[k] && v === 0);
    if (i < 0) {
      const lamps = st.map((v, k) => (v === 1 ? k : -1)).filter((k) => k >= 0);
      if (checkLamps(p, lamps)) count += 1;
      return;
    }
    for (const v of [1, 2]) {
      const t = st.slice();
      t[i] = v;
      rec(t);
      if (count >= limit) return;
    }
  };
  rec(new Array(p.wall.length).fill(0));
  return count;
}

// 人の手に近い解き方。{ solved, by, max, st }
export function solveLamps(p, opts = {}) {
  prep(p);
  const maxLevel = opts.maxLevel ?? 2;
  const by = { 1: 1, 2: 0, 3: 0 };
  const st = new Array(p.wall.length).fill(0);
  for (;;) {
    if (!basic(p, st)) return { solved: false, by, max: 0, st };
    if (finished(p, st)) break;
    if (maxLevel < 2) return { solved: false, by, max: 0, st };
    let moved = false;
    for (let i = 0; i < st.length && !moved; i++) {
      if (p.wall[i] || st[i] !== 0) continue;
      for (const v of [1, 2]) {
        const t = st.slice();
        t[i] = v;
        if (!basic(p, t)) { st[i] = v === 1 ? 2 : 1; moved = true; break; }
      }
    }
    if (!moved) return { solved: false, by, max: 2, st };
    by[2] += 1;
  }
  const sol = new Set(p.lamps);
  const solved = st.every((v, i) => p.wall[i] || (v === 1) === sol.has(i));
  return { solved, by, max: by[2] ? 2 : 1, st };
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeLamps(w, h, rules, wall, nums, lamps) {
  return prep({ kind: 'lamps', w, h, rules: rules.slice(), wall: wall.slice(), nums: nums.slice(), lamps: lamps.slice().sort((a, b) => a - b) });
}

// spec：{ w, h, rules, seed, walls（壁の割合）, maxLevel, minRounds, maxRounds }
export function generateLamps(spec) {
  const rand = rng(spec.seed);
  const { w, h, rules } = spec;
  const N = w * h;
  const share = spec.walls ?? 0.2;
  for (let attempt = 0; attempt < 300; attempt++) {
    const wall = new Array(N).fill(false);
    for (const i of shuffle([...Array(N).keys()], rand).slice(0, Math.round(N * share))) wall[i] = true;
    const base = makeLamps(w, h, rules, wall, new Array(N).fill(null), []);
    // 照らされていないマスを、照らせる所に灯りを置いて埋めていく
    const lamps = new Set();
    const lit = new Set();
    let ok = true;
    for (let guard = 0; guard < N * 2; guard++) {
      const dark = [...Array(N).keys()].filter((i) => !wall[i] && !lit.has(i));
      if (!dark.length) break;
      const target = dark[Math.floor(rand() * dark.length)];
      const can = [target, ...base._rays[target]].filter((j) => !lit.has(j));
      if (!can.length) { ok = false; break; }
      const at = can[Math.floor(rand() * can.length)];
      lamps.add(at);
      lit.add(at);
      for (const j of base._rays[at]) lit.add(j);
    }
    if (!ok || [...Array(N).keys()].some((i) => !wall[i] && !lit.has(i))) continue;
    const list = [...lamps];
    // 壁に数字を全部付けてから、答えが1つで解き方が合う間だけ消す
    const nums = wall.map((wl, i) => (wl ? base._around[i].filter((j) => lamps.has(j)).length : null));
    let p = makeLamps(w, h, rules, wall, nums, list);
    if (countLamps(p, 2) !== 1) continue;
    const fits = (q) => { const r = solveLamps(q, { maxLevel: spec.maxLevel ?? 2 }); return r.solved && (spec.maxRounds === undefined || r.by[2] <= spec.maxRounds); };
    if (!fits(p)) continue;
    for (const i of shuffle([...Array(N).keys()].filter((k) => wall[k]), rand)) {
      const n2 = p.nums.slice();
      n2[i] = null;
      const q = makeLamps(w, h, rules, wall, n2, list);
      if (countLamps(q, 2) === 1 && fits(q)) p = q;
    }
    const r = solveLamps(p, { maxLevel: spec.maxLevel ?? 2 });
    if (spec.minRounds && r.by[2] < spec.minRounds) continue;
    return { puzzle: p, result: r, attempts: attempt + 1 };
  }
  return null;
}
