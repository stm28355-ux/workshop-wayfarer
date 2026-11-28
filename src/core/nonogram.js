// 道場の巻物（剣：ピクロス）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。判定表 第13回 B。
// 盤は w×h、cells[y * w + x]。値は 0＝塗らない、1＝塗る（色の巻物では 1＝赤・2＝青）。
// 行と列の数字：{ kind: 'runs', runs: [{ len, color }] }（続けて塗るマスの長さ）か、{ kind: 'sum', counts: [赤, 青?] }（合計だけ）。
// 変えルール：
//   color  色：2色。同じ色の塗りは1マス以上あける。違う色はくっついてよい
//   sum    合計：いくつかの行・列は、塗りの長さでなく塗るマスの合計だけが出る
//   mirror 鏡：答えの絵は左右対称
// 解く道具の手の難しさ（判定表 第13回 B4）：
//   1＝その線の数字だけで決まる（何も分かっていない線を1本見て決まる）
//   2＝分かったマスを使って行と列を行き来すると決まる（線を1本ずつ見る。1回り＝1手）
//   3＝盤全体（仮に塗って、盤全体を進めて矛盾が出る）
// 単色のピクロスでは、行と列の浅い仮置きは線を見るのと同じ所までしか進まないので、段は「線」と「盤全体」の2つで足りる。

import { rng } from './scroll.js';

export const NONO_RULES = Object.freeze({
  color: { name: '色', text: '赤と青の2色。数字も色つき。同じ色の塗りは1マス以上あけるが、違う色はくっついてよい' },
  sum: { name: '合計', text: '◆の付いた行・列は、塗りの長さでなく、塗るマスの合計だけが出る' },
  mirror: { name: '鏡', text: '答えの絵は左右対称' },
});

// ───────── 線と数字 ─────────
export function rowCells(w, y) {
  return Array.from({ length: w }, (_, x) => y * w + x);
}
export function colCells(w, h, x) {
  return Array.from({ length: h }, (_, y) => y * w + x);
}
// 線の一覧：行が先、列が後。{ cells, kind: 'row'|'col', index }
export function linesOf(w, h) {
  const out = [];
  for (let y = 0; y < h; y++) out.push({ cells: rowCells(w, y), kind: 'row', index: y });
  for (let x = 0; x < w; x++) out.push({ cells: colCells(w, h, x), kind: 'col', index: x });
  return out;
}

export function runsOf(values) {
  const runs = [];
  let cur = null;
  for (const v of values) {
    if (v && cur && cur.color === v) cur.len += 1;
    else if (v) { cur = { len: 1, color: v }; runs.push(cur); }
    else cur = null;
  }
  return runs;
}
export function countsOf(values, colors) {
  const c = Array.from({ length: colors }, () => 0);
  for (const v of values) if (v) c[v - 1] += 1;
  return c;
}
function keyOf(clue) {
  return clue.kind === 'sum' ? `s${clue.counts.join(',')}` : `r${clue.runs.map((r) => `${r.len}.${r.color}`).join(',')}`;
}
export function clueOf(values, colors, sum) {
  return sum ? { kind: 'sum', counts: countsOf(values, colors) } : { kind: 'runs', runs: runsOf(values) };
}

// 線の候補表：長さ n・色の数 k の全部の塗り方を、数字ごとに分けて持つ（長さと色の数ごとに一度だけ作る）。
const TABLES = new Map();
function table(n, colors) {
  const tk = `${n}:${colors}`;
  if (TABLES.has(tk)) return TABLES.get(tk);
  const by = new Map();
  const base = colors + 1;
  const total = base ** n;
  for (let code = 0; code < total; code++) {
    const pt = new Array(n);
    let c = code;
    for (let k = 0; k < n; k++) { pt[k] = c % base; c = Math.floor(c / base); }
    for (const sum of [false, true]) {
      const key = keyOf(clueOf(pt, colors, sum));
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(pt);
    }
  }
  TABLES.set(tk, by);
  return by;
}

// ───────── 解く道具 ─────────
function prepare(p) {
  const lines = linesOf(p.w, p.h).map((l, i) => {
    const clue = i < p.h ? p.clues.rows[i] : p.clues.cols[i - p.h];
    return { ...l, cands: table(l.cells.length, p.colors).get(keyOf(clue)) ?? [] };
  });
  const lineOfCell = Array.from({ length: p.w * p.h }, () => []);
  lines.forEach((l, li) => l.cells.forEach((c) => lineOfCell[c].push(li)));
  return { lines, lineOfCell };
}

function mirrorOf(p, i) {
  const x = i % p.w, y = Math.floor(i / p.w);
  return y * p.w + (p.w - 1 - x);
}

// 1本の線から決まるマス。null なら矛盾（その線に合う塗り方がない）。
function lineDeduce(line, know) {
  const { cells, cands } = line;
  let first = null;
  const same = new Array(cells.length).fill(true);
  let any = false;
  for (const pt of cands) {
    let ok = true;
    for (let k = 0; k < cells.length; k++) {
      const kv = know[cells[k]];
      if (kv >= 0 && kv !== pt[k]) { ok = false; break; }
    }
    if (!ok) continue;
    if (!any) { first = pt; any = true; continue; }
    for (let k = 0; k < cells.length; k++) if (same[k] && pt[k] !== first[k]) same[k] = false;
  }
  if (!any) return null;
  const out = [];
  for (let k = 0; k < cells.length; k++) if (know[cells[k]] < 0 && same[k]) out.push([cells[k], first[k]]);
  return out;
}

// know に値を入れる（鏡なら反対側も）。矛盾したら false。
function setKnow(p, know, i, v, changed) {
  const targets = p.rules.includes('mirror') ? [i, mirrorOf(p, i)] : [i];
  for (const c of targets) {
    if (know[c] === v) continue;
    if (know[c] >= 0) return false;
    know[c] = v;
    changed?.push(c);
  }
  return true;
}

// 線を順に見て、決まるマスがなくなるまで進める。矛盾したら false。
function propagate(p, prep, know, budget) {
  const queue = new Set(prep.lines.map((_, i) => i));
  while (queue.size) {
    if (budget && ++budget.used > budget.limit) return true; // 打ち切り（矛盾は見つからなかった扱い）
    const li = queue.values().next().value;
    queue.delete(li);
    const d = lineDeduce(prep.lines[li], know);
    if (!d) return false;
    for (const [c, v] of d) {
      const changed = [];
      if (!setKnow(p, know, c, v, changed)) return false;
      for (const ch of changed) for (const lj of prep.lineOfCell[ch]) queue.add(lj);
    }
  }
  return true;
}

function domain(p) {
  return p.colors === 2 ? [0, 1, 2] : [0, 1];
}

// 仮に v を置いて、盤全体を進めると矛盾するか。
function contradicts(p, prep, know, i, v, budget) {
  const k = know.slice();
  if (!setKnow(p, k, i, v)) return true;
  return !propagate(p, prep, k, budget);
}

// 手1：線の数字だけで決まるマス（盤の状態を見ない）。
function level1(p, prep, know) {
  const empty = new Array(know.length).fill(-1);
  const found = [];
  for (const line of prep.lines) {
    for (const [c, v] of lineDeduce(line, empty) ?? []) {
      if (know[c] < 0) { setKnow(p, know, c, v); found.push([c, v]); }
    }
  }
  return found;
}

// 手2：分かったマスを使って線を1本ずつ見る（1回り）。
function level2(p, prep, know) {
  const found = [];
  for (const line of prep.lines) {
    for (const [c, v] of lineDeduce(line, know) ?? []) {
      if (know[c] < 0) { setKnow(p, know, c, v); found.push([c, v]); }
    }
  }
  return found;
}

function probe(p, prep, know, budget) {
  for (let i = 0; i < know.length; i++) {
    if (know[i] >= 0) continue;
    const left = domain(p).filter((v) => !contradicts(p, prep, know, i, v, budget));
    if (left.length === 1) return [[i, left[0]]];
    if (budget.used > budget.limit) return [];
  }
  return [];
}

// 解く。{ solved, steps: [{ level, cells: [[マス, 値]] }], know }
export function solveNono(p, opts = {}) {
  const prep = prepare(p);
  const know = new Array(p.w * p.h).fill(-1);
  const steps = [];
  const budget = { limit: opts.limit ?? 40000, used: 0 };
  const check = (found) => {
    for (const [c, v] of found) if (p.solution && p.solution[c] !== v) throw new Error('解く道具が答えと違うマスを決めた');
  };
  const first = level1(p, prep, know);
  check(first);
  if (first.length) steps.push({ level: 1, cells: first });
  for (let guard = 0; guard < 400; guard++) {
    if (know.every((v) => v >= 0)) return { solved: true, steps, know };
    let level = 2;
    let found = (opts.maxLevel ?? 3) >= 2 ? level2(p, prep, know) : [];
    if (!found.length && (opts.maxLevel ?? 3) >= 3) {
      level = 3;
      found = probe(p, prep, know, budget);
      for (const [c, v] of found) setKnow(p, know, c, v);
    }
    if (!found.length) return { solved: false, steps, know };
    check(found);
    steps.push({ level, cells: found });
  }
  return { solved: false, steps, know };
}

export function nonoDifficulty(result) {
  const by = { 1: 0, 2: 0, 3: 0 };
  for (const s of result.steps) by[s.level] += 1;
  return { max: Math.max(0, ...result.steps.map((s) => s.level)), by };
}

// ───────── 作る ─────────
// spec：{ w, h, rules, seed, density?（塗る割合）, maxLevel?（使ってよい一番難しい手）, maxGlobal?（盤全体の手は何回まで）,
//         minLevel?（この難しさの手が1つは要る）, minRounds?（手2の回りがこれ以上）, maxRounds?, sumShare?（合計だけの線の割合） }
export function makePuzzle(w, h, rules, solution, sumLines = []) {
  const colors = rules.includes('color') ? 2 : 1;
  const lines = linesOf(w, h);
  const clue = (l, i) => clueOf(l.cells.map((c) => solution[c]), colors, sumLines.includes(i));
  return {
    w, h, rules: rules.slice(), colors, solution: solution.slice(),
    clues: { rows: lines.slice(0, h).map((l, i) => clue(l, i)), cols: lines.slice(h).map((l, i) => clue(l, h + i)) },
    sumLines: sumLines.slice(),
  };
}

export function generateNono(spec) {
  const rand = rng(spec.seed);
  const { w, h, rules } = spec;
  const colors = rules.includes('color') ? 2 : 1;
  const density = spec.density ?? (w * h <= 25 ? 0.6 : 0.58);
  const maxLevel = spec.maxLevel ?? 3;
  const maxGlobal = spec.maxGlobal ?? Infinity;
  const good = (r) => {
    if (!r.solved) return false;
    const d = nonoDifficulty(r);
    if (d.max > maxLevel || d.by[3] > maxGlobal) return false;
    if (spec.minLevel && d.max < spec.minLevel) return false;
    if (spec.minRounds && d.by[2] < spec.minRounds) return false;
    if (spec.maxRounds && d.by[2] > spec.maxRounds) return false;
    return true;
  };
  for (let attempt = 0; attempt < 300; attempt++) {
    const sol = new Array(w * h).fill(0);
    const half = rules.includes('mirror') ? Math.ceil(w / 2) : w;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < half; x++) {
        if (rand() >= density) continue;
        let c = 1;
        if (colors === 2) {
          // 隣（左か上）の色に寄せる（塊がまとまって見える）
          const left = x > 0 ? sol[y * w + x - 1] : 0;
          const up = y > 0 ? sol[(y - 1) * w + x] : 0;
          const near = left || up;
          c = near && rand() < 0.65 ? near : rand() < 0.5 ? 1 : 2;
        }
        sol[y * w + x] = c;
        if (half < w) sol[y * w + (w - 1 - x)] = c;
      }
    }
    // 色の巻物は、どちらの色も塗りの3割以上にする（片方の色ばかりだと色の意味がない）
    if (colors === 2) {
      const filled = sol.filter(Boolean).length;
      const red = sol.filter((v) => v === 1).length;
      if (red < filled * 0.3 || filled - red < filled * 0.3) continue;
    }
    // 空の行・列が多い盤は作り直す（易しすぎる）
    const lines = linesOf(w, h);
    if (lines.filter((l) => l.cells.every((c) => !sol[c])).length > 1) continue;
    let sumLines = [];
    if (rules.includes('sum')) {
      const share = spec.sumShare ?? 0.35;
      const idx = lines.map((_, i) => i).filter(() => rand() < share);
      sumLines = idx.length ? idx : [Math.floor(rand() * lines.length)];
    }
    const p = makePuzzle(w, h, rules, sol, sumLines);
    const r = solveNono(p, { maxLevel });
    if (!good(r)) continue;
    return { puzzle: p, result: r, attempts: attempt + 1 };
  }
  return null;
}

// 人の手を確かめる：value を塗ってよいか（答えと同じ色か）
export function isRightPaint(p, i, value) {
  return p.solution[i] === value;
}
export function filledCount(p) {
  return p.solution.filter((v) => v).length;
}
