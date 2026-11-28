// 道場の巻物（弓：鏡で光を通す）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。判定表 第18回 C。
// 盤は w×h、cells[y * w + x]。答えのマスは 0＝空き・1＝／・2＝＼・3＝岩（最初から見えていて光を止める）。
// 盤の縁の口：{ side: 'top'|'bottom'|'left'|'right', at: 位置 }。弓は口から盤の中へ光を出し、
// 光は鏡で曲がって、盤の外へ出た口が的なら届いた。岩に当たる・的でない口から出る・同じ所を回り続けるのは外れ。
// 決まり：弓の光は全部どれかの的へ届き、的には全部ちょうど1本届く。置いた鏡には全部光が当たる。
// 盤の外に、行と列ごとの鏡の数がいつも出る（判定表 第18回 C6 の「鏡の数」を土台に入れた。
// 数がないと答えを1つにするのに盤の半分近くを見せる要があったため）。
// 変えルール：
//   color 色の光：赤と青。赤の光は赤の的にだけ、青は青にだけ
//   break 割れる鏡：鏡は光が1度通ると割れる（2本の光が同じ鏡を通れない。同じ光が2度通るのも駄目）
//   label 番号の的：弓と的に番号があり、同じ番号の的へ届ける
// 最初から答えが見えているマス（shown）がいくつかある。

import { rng } from './scroll.js';

export const BEAM_RULES = Object.freeze({ color: '色の光', break: '割れる鏡', label: '番号の的' });
export const EMPTY = 0, SLASH = 1, BACK = 2, ROCK = 3;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
// ／：右へ進む光は上へ、上へは右へ、左へは下へ、下へは左へ。＼ はその逆。
const TURN = {
  1: { right: 'up', up: 'right', left: 'down', down: 'left' },
  2: { right: 'down', down: 'right', left: 'up', up: 'left' },
};

export function portKey(port) {
  return `${port.side}:${port.at}`;
}

// 口から入る光の、最初のマスと向き。
export function entry(w, h, port) {
  if (port.side === 'top') return { x: port.at, y: 0, dir: 'down' };
  if (port.side === 'bottom') return { x: port.at, y: h - 1, dir: 'up' };
  if (port.side === 'left') return { x: 0, y: port.at, dir: 'right' };
  return { x: w - 1, y: port.at, dir: 'left' };
}

// 盤の外へ出たときの口。
function exitPort(w, h, x, y) {
  if (y < 0) return { side: 'top', at: x };
  if (y >= h) return { side: 'bottom', at: x };
  if (x < 0) return { side: 'left', at: y };
  return { side: 'right', at: y };
}

// 置いてある物（cells：0〜3、未定は -1）で光をたどる。
// { cells: [通ったマス], hits: [鏡のマス], out: 口 | null, stop: 'rock'|'loop'|'open'|null, open: 未定のマス }
export function trace(w, h, cells, port) {
  let { x, y, dir } = entry(w, h, port);
  const path = [];
  const hits = [];
  const seen = new Set();
  for (;;) {
    if (x < 0 || y < 0 || x >= w || y >= h) return { cells: path, hits, out: exitPort(w, h, x, y), stop: null };
    const i = y * w + x;
    const key = `${i}:${dir}`;
    if (seen.has(key)) return { cells: path, hits, out: null, stop: 'loop' };
    seen.add(key);
    const c = cells[i];
    if (c === ROCK) return { cells: path, hits, out: null, stop: 'rock' };
    if (c === -1 || c === undefined) return { cells: path, hits, out: null, stop: 'open', open: i, dir };
    path.push(i);
    if (c === SLASH || c === BACK) { hits.push(i); dir = TURN[c][dir]; }
    x += DIRS[dir][0];
    y += DIRS[dir][1];
  }
}

// 弓と的の合い方：label（番号）があれば同じ番号へ、色の光なら同じ色へ。
function sameColor(p, bow, target) {
  if (p.rules.includes('color') && bow.color !== target.color) return false;
  if (bow.label !== undefined && target.label !== undefined && bow.label !== target.label) return false;
  return true;
}

// 全部置いた盤が決まりを満たすか。
export function checkBeams(p, cells) {
  const targets = new Map(p.targets.map((t) => [portKey(t), t]));
  const got = new Set();
  const lit = new Map();
  for (const b of p.bows) {
    const r = trace(p.w, p.h, cells, b);
    if (!r.out) return false;
    const t = targets.get(portKey(r.out));
    if (!t || got.has(portKey(t)) || !sameColor(p, b, t)) return false;
    got.add(portKey(t));
    for (const m of r.hits) lit.set(m, (lit.get(m) ?? 0) + 1);
  }
  if (got.size !== p.targets.length) return false;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== SLASH && cells[i] !== BACK) continue;
    if (!lit.has(i)) return false;
    if (p.rules.includes('break') && lit.get(i) > 1) return false;
  }
  if (p.rowCounts) {
    for (let y = 0; y < p.h; y++) if (countRow(cells, p.w, y) !== p.rowCounts[y]) return false;
    for (let x = 0; x < p.w; x++) if (countCol(cells, p.w, p.h, x) !== p.colCounts[x]) return false;
  }
  return true;
}

function isMirror(v) {
  return v === SLASH || v === BACK;
}
function countRow(cells, w, y) {
  let n = 0;
  for (let x = 0; x < w; x++) if (isMirror(cells[y * w + x])) n += 1;
  return n;
}
function countCol(cells, w, h, x) {
  let n = 0;
  for (let y = 0; y < h; y++) if (isMirror(cells[y * w + x])) n += 1;
  return n;
}

// 答えを数える（limit まで）。known：最初から分かっているマス（岩と shown）。
// 光をたどって、未定のマスに当たったら「空き・／・＼」に分ける。光の通らないマスは空きになる。
// 手間が cap（たどった枝の数）を超えたら、答えが2つ以上あるとみなす（作るときに迷いすぎる盤をはじく）。
export function countBeams(p, limit = 2, stats = null, cap = 20000) {
  const targets = new Map(p.targets.map((t) => [portKey(t), t]));
  let nodes = 0;
  const N = p.w * p.h;
  const cells = new Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (p.solution[i] === ROCK) cells[i] = ROCK;
  for (const i of p.shown) cells[i] = p.solution[i];
  const countOk = (partial) => {
    if (!p.rowCounts) return true;
    for (let y = 0; y < p.h; y++) {
      let m = 0, open = 0;
      for (let x = 0; x < p.w; x++) { const v = partial[y * p.w + x]; if (isMirror(v)) m++; else if (v === -1) open++; }
      if (m > p.rowCounts[y] || m + open < p.rowCounts[y]) return false;
    }
    for (let x = 0; x < p.w; x++) {
      let m = 0, open = 0;
      for (let y = 0; y < p.h; y++) { const v = partial[y * p.w + x]; if (isMirror(v)) m++; else if (v === -1) open++; }
      if (m > p.colCounts[x] || m + open < p.colCounts[x]) return false;
    }
    return true;
  };
  let count = 0;
  const rec = () => {
    if (count >= limit) return;
    nodes += 1;
    if (stats) stats.nodes = nodes;
    if (nodes > cap) { count = limit; if (stats) stats.over = true; return; }
    if (!countOk(cells)) return;
    // まだ届いていない光を順にたどる。届いた光は的・色・割れる鏡をその場で確かめる
    const got = new Set();
    const use = new Set();
    for (const b of p.bows) {
      const r = trace(p.w, p.h, cells, b);
      if (r.stop === null) {
        const t = targets.get(portKey(r.out));
        if (!t || got.has(portKey(t)) || !sameColor(p, b, t)) return;
        got.add(portKey(t));
        if (p.rules.includes('break')) for (const m of r.hits) { if (use.has(m)) return; use.add(m); }
        continue;
      }
      if (p.rules.includes('break') && r.hits.some((m, k) => use.has(m) || r.hits.indexOf(m) !== k)) return;
      if (r.stop === 'open') {
        const i = r.open;
        for (const v of [EMPTY, SLASH, BACK]) {
          cells[i] = v;
          rec();
          cells[i] = -1;
          if (count >= limit) return;
        }
        return;
      }
      if (r.stop) return; // 岩か回り続ける
    }
    // 全部の光が外へ出た：残りの未定は空き
    const filled = cells.map((v) => (v === -1 ? EMPTY : v));
    if (checkBeams(p, filled)) count += 1;
  };
  rec();
  return count;
}

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function allPorts(w, h) {
  const out = [];
  for (let x = 0; x < w; x++) out.push({ side: 'top', at: x }, { side: 'bottom', at: x });
  for (let y = 0; y < h; y++) out.push({ side: 'left', at: y }, { side: 'right', at: y });
  return out;
}

export function makeBeams(w, h, rules, solution, bows, targets, shown) {
  const p = { kind: 'beam', w, h, rules: rules.slice(), solution: solution.slice(), bows, targets, shown: shown.slice().sort((a, b) => a - b) };
  if (rules.includes('count') || !rules.includes('nocount')) {
    p.rowCounts = Array.from({ length: h }, (_, y) => countRow(solution, w, y));
    p.colCounts = Array.from({ length: w }, (_, x) => countCol(solution, w, h, x));
  }
  return p;
}

// spec：{ w, h, rules, seed, bows（光の数）, mirrors（鏡の数の目安）, rocks, maxNodes（解く手間の上限）, minShownFree }
export function generateBeams(spec) {
  const rand = rng(spec.seed);
  const { w, h, rules } = spec;
  const N = w * h;
  const nBows = spec.bows ?? (N <= 25 ? 3 : 4);
  const wantMirrors = spec.mirrors ?? Math.round(N * 0.24);
  const nRocks = spec.rocks ?? (N <= 25 ? 1 : 3);
  for (let attempt = 0; attempt < 400; attempt++) {
    const sol = new Array(N).fill(EMPTY);
    const free = shuffle([...Array(N).keys()], rand);
    for (let k = 0; k < nRocks; k++) sol[free.pop()] = ROCK;
    // 光を1本ずつ通し、通り道に鏡を置いていく
    const ports = shuffle(allPorts(w, h), rand);
    const used = new Set();
    const bows = [];
    const targets = [];
    const lit = new Map();
    let mirrors = 0;
    for (const port of ports) {
      if (bows.length >= nBows) break;
      if (used.has(portKey(port))) continue;
      // 光の道を歩きながら、空きのマスで曲がるか決める
      let { x, y, dir } = entry(w, h, port);
      const trial = sol.slice();
      const placed = [];
      let ok = true, steps = 0;
      const seen = new Set();
      while (x >= 0 && y >= 0 && x < w && y < h) {
        const i = y * w + x;
        if (seen.has(`${i}:${dir}`) || ++steps > N * 3) { ok = false; break; }
        seen.add(`${i}:${dir}`);
        if (trial[i] === ROCK) { ok = false; break; }
        if (trial[i] === EMPTY && !lit.has(i) && mirrors + placed.length < wantMirrors && rand() < 0.38) {
          trial[i] = rand() < 0.5 ? SLASH : BACK;
          placed.push(i);
        }
        if (isMirror(trial[i])) {
          if (rules.includes('break') && (lit.has(i) && !placed.includes(i))) { ok = false; break; }
          dir = TURN[trial[i]][dir];
        }
        x += DIRS[dir][0];
        y += DIRS[dir][1];
      }
      if (!ok) continue;
      const out = exitPort(w, h, x, y);
      if (used.has(portKey(out)) || portKey(out) === portKey(port)) continue;
      // 光が通る前のマス（空きで光が通っていた所）に置いた鏡は、前の光を曲げてしまうので使えない
      const r = trace(w, h, trial, port);
      if (!r.out || portKey(r.out) !== portKey(out)) continue;
      const before = bows.map((b) => trace(w, h, trial, b));
      if (before.some((t, k) => !t.out || portKey(t.out) !== portKey(targets[k]))) continue;
      if (r.hits.length === 0) continue; // まっすぐ抜ける光は面白くない
      if (rules.includes('break')) {
        const all = [...before.flatMap((t) => t.hits), ...r.hits];
        if (new Set(all).size !== all.length) continue;
      }
      for (const c of placed) sol[c] = trial[c];
      mirrors += placed.length;
      used.add(portKey(port));
      used.add(portKey(out));
      bows.push({ ...port });
      targets.push({ ...out });
      for (const t of [...before, r]) for (const c of t.hits) lit.set(c, true);
    }
    if (bows.length < nBows || mirrors < Math.max(2, wantMirrors - 2)) continue;
    if (spec.labels || rules.includes('label')) bows.forEach((b, k) => { b.label = k + 1; targets[k].label = k + 1; });
    if (rules.includes('color')) {
      bows.forEach((b, k) => { const c = k % 2 === 0 || rand() < 0.3 ? 'red' : 'blue'; b.color = c; targets[k].color = c; });
      if (!bows.some((b) => b.color === 'blue')) { bows[1].color = 'blue'; targets[1].color = 'blue'; }
    }
    // 的は並びを混ぜる（どの弓とつながるかは解いて分かる）
    const tg = shuffle(targets.slice(), rand);
    const base = makeBeams(w, h, rules, sol, bows, tg, []);
    if (!checkBeams(base, sol)) continue;
    // 答えが1つになるまで、見せるマスを足す（迷いを一番減らすマスから）
    let shown = [];
    let p = base;
    const cand = [...Array(N).keys()].filter((i) => sol[i] !== ROCK);
    let guard = 0;
    while (countBeams(p, 2) > 1 && guard++ < N) {
      let best = null;
      for (const i of shuffle(cand.filter((c) => !shown.includes(c)), rand).slice(0, 12)) {
        const st = { nodes: 0 };
        const q = makeBeams(w, h, rules, sol, bows, tg, [...shown, i]);
        const c = countBeams(q, 2, st);
        const score = c === 1 ? -1e9 + st.nodes : st.nodes;
        if (!best || score < best.score) best = { i, score };
      }
      shown = [...shown, best.i];
      p = makeBeams(w, h, rules, sol, bows, tg, shown);
    }
    if (countBeams(p, 2) !== 1) continue;
    // 減らせる見せマスは減らす
    for (const i of shuffle(shown.slice(), rand)) {
      const q = makeBeams(w, h, rules, sol, bows, tg, shown.filter((j) => j !== i));
      if (countBeams(q, 2) === 1) { shown = q.shown; p = q; }
    }
    const st = { nodes: 0 };
    countBeams(p, 2, st);
    if (spec.maxNodes && st.nodes > spec.maxNodes) continue;
    if (spec.minNodes && st.nodes < spec.minNodes) continue;
    // 手がかりを足す（判定表 第19回：技なしでも解き始められるように）。鏡のマスを先に見せる
    if (spec.extraShown) {
      // 鏡の半分より多くは見せない（解く所がなくならないように）
      const hiddenM = cand.filter((c) => !shown.includes(c) && (sol[c] === SLASH || sol[c] === BACK));
      const allM = cand.filter((c) => sol[c] === SLASH || sol[c] === BACK).length;
      const room = Math.max(0, hiddenM.length - Math.ceil(allM / 2));
      const more = shuffle(hiddenM, rand).slice(0, Math.min(spec.extraShown, room));
      p = makeBeams(w, h, rules, sol, bows, tg, [...shown, ...more]);
      st.nodes = 0;
      countBeams(p, 2, st);
    }
    return { puzzle: p, nodes: st.nodes, attempts: attempt + 1 };
  }
  return null;
}
