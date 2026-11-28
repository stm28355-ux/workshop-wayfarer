// 道場の巻物（魔法：属性の数独）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。判定表 第18回 B。
// 盤は n×n（4 か 6）、cells[y * n + x]。値は属性の番号：0＝火・1＝水・2＝氷・3＝雷・4＝風・5＝土。
// 各行・各列・囲み（4×4 は 2×2、6×6 は 横3×縦2）に同じ属性はない。
// 変えルール：
//   react 反応の印：隣り合うマスの間の印は「反応する組」。印のない所は反応しない組
//   cycle 巡りの線：線の上は 火→水→氷→雷→火… の順（線の端から）
//   cage  囲み：太い線の囲みの中に同じ属性がない
// 解く道具の手の難しさ（剣と同じ考え方）：
//   1＝行・列・囲みで「そこにしか入らない／それしか入らない」が決まる
//   2＝変えルールの印や線を使って、隣のマスの候補を消す（1回り＝1手）
//   3＝盤全体（仮に置いて、盤全体を進めて矛盾が出る）

import { rng } from './scroll.js';

export const ELEMENT_NAMES = Object.freeze(['火', '水', '氷', '雷', '風', '土']);
export const SUDO_RULES = Object.freeze({ react: '反応の印', cycle: '巡りの線', cage: '囲み' });
// 反応する組（第18回 B4）
export const REACT_PAIRS = Object.freeze({
  4: [[1, 3], [1, 2], [0, 2]],
  6: [[1, 3], [1, 2], [0, 2], [0, 4], [1, 5]],
});
// 巡りの順（第18回 B5）：火→水→氷→雷→火
export const CYCLE = Object.freeze([0, 1, 2, 3]);

export function nextInCycle(v) {
  return v < 4 ? (v + 1) % 4 : -1;
}

export function reacts(n, a, b) {
  return REACT_PAIRS[n].some(([p, q]) => (p === a && q === b) || (p === b && q === a));
}

export function boxOf(n) {
  return n === 4 ? { bw: 2, bh: 2 } : { bw: 3, bh: 2 };
}

// 行・列・囲み（どれも n マス）。
export function unitsOf(n) {
  const { bw, bh } = boxOf(n);
  const out = [];
  for (let y = 0; y < n; y++) out.push(Array.from({ length: n }, (_, x) => y * n + x));
  for (let x = 0; x < n; x++) out.push(Array.from({ length: n }, (_, y) => y * n + x));
  for (let by = 0; by < n; by += bh) for (let bx = 0; bx < n; bx += bw) {
    const u = [];
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) u.push(y * n + x);
    out.push(u);
  }
  return out;
}

// 隣り合うマスの組（右と下）。
export function edgesOf(n) {
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x;
    if (x < n - 1) out.push([i, i + 1]);
    if (y < n - 1) out.push([i, i + n]);
  }
  return out;
}

// 盤の決まりを、マスの組の「同じでない」と「組の決まり」に直す。
function constraintsOf(p) {
  const n = p.n;
  const groups = [...unitsOf(n), ...(p.cages ?? [])];
  const peers = Array.from({ length: n * n }, () => new Set());
  for (const g of groups) for (const a of g) for (const b of g) if (a !== b) peers[a].add(b);
  const rels = []; // { a, b, ok(va, vb) }
  if (p.rules.includes('react')) {
    const marked = new Set((p.marks ?? []).map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`));
    for (const [a, b] of edgesOf(n)) {
      const m = marked.has(`${a},${b}`);
      rels.push({ a, b, ok: (va, vb) => reacts(n, va, vb) === m });
    }
  }
  if (p.rules.includes('cycle')) {
    for (const line of p.lines ?? []) {
      for (let k = 0; k + 1 < line.length; k++) rels.push({ a: line[k], b: line[k + 1], ok: (va, vb) => nextInCycle(va) === vb });
    }
  }
  return { groups, units: unitsOf(n), peers: peers.map((s) => [...s]), rels };
}

const bit = (v) => 1 << v;
const popcount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const only = (m) => 31 - Math.clz32(m);

// 答えが入っているか確かめる（行・列・囲みと変えルールを全部満たすか）。
export function checkSolution(p, values) {
  const c = constraintsOf(p);
  for (let i = 0; i < values.length; i++) for (const j of c.peers[i]) if (values[i] === values[j]) return false;
  return c.rels.every((r) => r.ok(values[r.a], values[r.b]));
}

// 答えを数える（limit まで）。
export function countSolutions(p, limit = 2) {
  const c = constraintsOf(p);
  const N = p.n * p.n;
  const full = (1 << p.n) - 1;
  const vals = new Array(N).fill(-1);
  for (const i of p.givens) vals[i] = p.solution[i];
  const relsOf = Array.from({ length: N }, () => []);
  for (const r of c.rels) { relsOf[r.a].push(r); relsOf[r.b].push(r); }
  let count = 0;
  const okAt = (i, v) => {
    for (const j of c.peers[i]) if (vals[j] === v) return false;
    for (const r of relsOf[i]) {
      const o = r.a === i ? r.b : r.a;
      if (vals[o] < 0) continue;
      if (!(r.a === i ? r.ok(v, vals[o]) : r.ok(vals[o], v))) return false;
    }
    return true;
  };
  for (const i of p.givens) { const v = vals[i]; vals[i] = -1; if (!okAt(i, v)) return 0; vals[i] = v; }
  const rec = () => {
    if (count >= limit) return;
    // 候補の一番少ないマス
    let best = -1, bestMask = 0, bestN = 99;
    for (let i = 0; i < N; i++) {
      if (vals[i] >= 0) continue;
      let m = 0;
      for (let v = 0; v < p.n; v++) if (okAt(i, v)) m |= bit(v);
      const k = popcount(m);
      if (k === 0) return;
      if (k < bestN) { best = i; bestMask = m; bestN = k; }
    }
    if (best < 0) { count += 1; return; }
    for (let v = 0; v < p.n; v++) {
      if (!(bestMask & bit(v))) continue;
      vals[best] = v;
      rec();
      vals[best] = -1;
      if (count >= limit) return;
    }
  };
  void full;
  rec();
  return count;
}

// 人の手に近い解き方。{ solved, by: {1,2,3}, max, cand }。
export function solveSudo(p, opts = {}) {
  const maxLevel = opts.maxLevel ?? 3;
  const c = constraintsOf(p);
  const N = p.n * p.n;
  const full = (1 << p.n) - 1;
  const start = new Array(N).fill(full);
  for (const i of p.givens) start[i] = bit(p.solution[i]);
  const by = { 1: 0, 2: 0, 3: 0 };

  // 1：同じ行・列・囲みから消す＋そこにしか入らない。矛盾なら false。
  const basic = (cand) => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < N; i++) {
        if (popcount(cand[i]) !== 1) continue;
        for (const j of c.peers[i]) {
          if (cand[j] & cand[i]) { cand[j] &= ~cand[i]; changed = true; if (!cand[j]) return false; }
        }
      }
      for (const u of c.units) {
        for (let v = 0; v < p.n; v++) {
          const where = u.filter((i) => cand[i] & bit(v));
          if (where.length === 0) return false;
          if (where.length === 1 && cand[where[0]] !== bit(v)) { cand[where[0]] = bit(v); changed = true; }
        }
      }
    }
    return true;
  };
  // 2：印・線で隣の候補を消す（1回り）。消えたら true。
  const relRound = (cand) => {
    let any = false;
    for (const r of c.rels) {
      const ma = cand[r.a], mb = cand[r.b];
      let na = 0, nb = 0;
      for (let va = 0; va < p.n; va++) {
        if (!(ma & bit(va))) continue;
        for (let vb = 0; vb < p.n; vb++) {
          if (!(mb & bit(vb))) continue;
          if (r.ok(va, vb)) { na |= bit(va); nb |= bit(vb); }
        }
      }
      if (na !== ma || nb !== mb) { cand[r.a] = na; cand[r.b] = nb; any = true; }
    }
    return any;
  };
  const done = (cand) => cand.every((m) => popcount(m) === 1);
  const broken = (cand) => cand.some((m) => m === 0);
  // 1と2だけで進める（仮置きの中で使う）
  const settle = (cand) => {
    for (;;) {
      if (!basic(cand)) return false;
      if (broken(cand)) return false;
      if (done(cand)) return true;
      if (!relRound(cand)) return true;
      if (broken(cand)) return false;
    }
  };

  const cand = start.slice();
  for (;;) {
    if (!basic(cand)) return { solved: false, by, max: 0, cand };
    if (done(cand)) break;
    if (maxLevel >= 2 && relRound(cand)) { by[2] += 1; if (broken(cand)) return { solved: false, by, max: 2, cand }; continue; }
    if (maxLevel < 3) return { solved: false, by, max: 0, cand };
    // 3：仮置き
    let moved = false;
    for (let i = 0; i < N && !moved; i++) {
      if (popcount(cand[i]) < 2) continue;
      for (let v = 0; v < p.n && !moved; v++) {
        if (!(cand[i] & bit(v))) continue;
        const t = cand.slice();
        t[i] = bit(v);
        if (!settle(t)) { cand[i] &= ~bit(v); moved = true; }
      }
    }
    if (!moved) return { solved: false, by, max: 3, cand };
    by[3] += 1;
  }
  by[1] = 1;
  const max = by[3] ? 3 : by[2] ? 2 : 1;
  const ok = cand.every((m, i) => m === bit(p.solution[i]));
  return { solved: ok, by, max, cand };
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 全部埋まった盤を種から作る。
function fullGrid(n, rand) {
  const units = unitsOf(n);
  const peers = Array.from({ length: n * n }, () => new Set());
  for (const u of units) for (const a of u) for (const b of u) if (a !== b) peers[a].add(b);
  const vals = new Array(n * n).fill(-1);
  const rec = (i) => {
    if (i === n * n) return true;
    for (const v of shuffle([...Array(n).keys()], rand)) {
      if ([...peers[i]].some((j) => vals[j] === v)) continue;
      vals[i] = v;
      if (rec(i + 1)) return true;
    }
    vals[i] = -1;
    return false;
  };
  rec(0);
  return vals;
}

function neighbors(n, i) {
  const x = i % n, y = Math.floor(i / n);
  const out = [];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

// 巡りの線：答えの上で 火→水→氷→雷 の順に隣へ進む道を探す。
function makeLines(n, sol, rand, count, minLen, maxLen) {
  const used = new Set();
  const lines = [];
  for (let tries = 0; tries < 200 && lines.length < count; tries++) {
    const startCells = shuffle([...Array(n * n).keys()].filter((i) => !used.has(i) && sol[i] < 4), rand);
    if (!startCells.length) break;
    const line = [startCells[0]];
    const want = minLen + Math.floor(rand() * (maxLen - minLen + 1));
    while (line.length < want) {
      const last = line[line.length - 1];
      const nx = shuffle(neighbors(n, last).filter((j) => !used.has(j) && !line.includes(j) && sol[j] === nextInCycle(sol[last])), rand);
      if (!nx.length) break;
      line.push(nx[0]);
    }
    if (line.length < minLen) continue;
    for (const c of line) used.add(c);
    lines.push(line);
  }
  return lines;
}

// 囲み：つながった2〜3マスで、行・列・囲みの1つに収まらず、同じ属性がない物。
function makeCages(n, sol, rand, count) {
  const used = new Set();
  const cages = [];
  const units = unitsOf(n);
  for (let tries = 0; tries < 300 && cages.length < count; tries++) {
    const free = [...Array(n * n).keys()].filter((i) => !used.has(i));
    if (!free.length) break;
    const cage = [free[Math.floor(rand() * free.length)]];
    const want = 2 + Math.floor(rand() * 2);
    while (cage.length < want) {
      const nx = shuffle(cage.flatMap((c) => neighbors(n, c)).filter((j) => !used.has(j) && !cage.includes(j) && !cage.some((c) => sol[c] === sol[j])), rand);
      if (!nx.length) break;
      cage.push(nx[0]);
    }
    if (cage.length < 2) continue;
    if (units.some((u) => cage.every((c) => u.includes(c)))) continue;
    for (const c of cage) used.add(c);
    cages.push(cage.sort((a, b) => a - b));
  }
  return cages;
}

export function makeSudo(n, rules, solution, extra = {}) {
  const p = { kind: 'sudo', n, rules: rules.slice(), solution: solution.slice(), givens: extra.givens ?? [...solution.keys()] };
  if (rules.includes('react')) p.marks = edgesOf(n).filter(([a, b]) => reacts(n, solution[a], solution[b]));
  if (rules.includes('cycle')) p.lines = extra.lines ?? [];
  if (rules.includes('cage')) p.cages = extra.cages ?? [];
  return p;
}

// spec：{ n, rules, seed, maxLevel, minLevel, minRounds, maxRounds, maxGlobal, minEmpty }
export function generateSudo(spec) {
  const rand = rng(spec.seed);
  const { n, rules } = spec;
  const maxLevel = spec.maxLevel ?? 3;
  const maxGlobal = spec.maxGlobal ?? Infinity;
  const fits = (r) => r.solved && r.by[3] <= maxGlobal;
  for (let attempt = 0; attempt < 60; attempt++) {
    const sol = fullGrid(n, rand);
    const extra = {};
    if (rules.includes('cycle')) {
      extra.lines = makeLines(n, sol, rand, n === 4 ? 2 : 3, 3, n === 4 ? 4 : 5);
      if (extra.lines.length < (n === 4 ? 1 : 2)) continue;
    }
    if (rules.includes('cage')) {
      extra.cages = makeCages(n, sol, rand, n === 4 ? 3 : 5);
      if (extra.cages.length < 2) continue;
    }
    const p = makeSudo(n, rules, sol, extra);
    // 最初から入っているマスを、答えが1つで解き方が合う間だけ減らす
    let givens = [...sol.keys()];
    for (const i of shuffle([...sol.keys()], rand)) {
      const trial = { ...p, givens: givens.filter((j) => j !== i) };
      if (countSolutions(trial, 2) !== 1) continue;
      if (!fits(solveSudo(trial, { maxLevel }))) continue;
      givens = trial.givens;
    }
    const q = { ...p, givens: givens.sort((a, b) => a - b) };
    const r = solveSudo(q, { maxLevel });
    if (!fits(r)) continue;
    if (spec.minLevel && r.max < spec.minLevel) continue;
    if (spec.minRounds && r.by[2] < spec.minRounds) continue;
    if (spec.maxRounds !== undefined && r.by[2] > spec.maxRounds) continue;
    if (spec.minEmpty && n * n - givens.length < spec.minEmpty) continue;
    return { puzzle: q, result: r, attempts: attempt + 1 };
  }
  return null;
}
