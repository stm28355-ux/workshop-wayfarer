// 道場の巻物（守り：数字から罠を推理する盤）。純粋な関数だけ。乱数は種から作る（同じ種なら同じ盤）。
// 盤は w×h、cells[y * w + x]。mines[i] が true なら罠。shown は最初から開いているマス。
// 変えルール（判定表 第6回 B）：
//   cross   十字：数字は上下左右に2マスずつ（十字の8マス）の罠の数
//   connect 連結：罠は全部、上下左右でつながっている
//   pair    組：罠は2つずつの組（上下か左右に隣り合う）で、組どうしは上下左右で接しない
// 解く道具は人と同じ手順で進む：安全と分かったマスを開け（数字が見える）、罠と分かったマスに印を付ける。
// 1手の難しさ：1＝数字1つで決まる、2＝数字2つを合わせて決まる、3＝盤全体（罠の数・連結・組）を見て決まる。

export const RULES = Object.freeze({
  cross: { name: '十字', text: '数字は、上下左右に2マスずつ（十字の8マス）の罠の数' },
  connect: { name: '連結', text: '罠は全部、上下左右でつながっている' },
  pair: { name: '組', text: '罠は2つずつの組（上下か左右に隣り合う）。組どうしは上下左右で接しない' },
});

// ───────── 種つきの乱数 ─────────
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────── 盤の形 ─────────
function orth(w, h, i) {
  const x = i % w, y = Math.floor(i / w);
  const out = [];
  if (y > 0) out.push(i - w);
  if (x > 0) out.push(i - 1);
  if (x < w - 1) out.push(i + 1);
  if (y < h - 1) out.push(i + w);
  return out;
}

// マス i の数字が数えるマス。
export function areaOf(w, h, rules, i) {
  const x = i % w, y = Math.floor(i / w);
  const out = [];
  if (rules.includes('cross')) {
    for (const [dx, dy] of [[0, -1], [0, -2], [-1, 0], [-2, 0], [1, 0], [2, 0], [0, 1], [0, 2]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  } else {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
  }
  return out;
}

export function numberAt(p, i) {
  return areaOf(p.w, p.h, p.rules, i).filter((j) => p.mines[j]).length;
}

// 罠の置き方が変えルールを守っているか（全部決まった盤で見る）。
export function rulesHold(w, h, rules, mines) {
  if (rules.includes('pair')) {
    for (let i = 0; i < mines.length; i++) {
      if (mines[i] && orth(w, h, i).filter((j) => mines[j]).length !== 1) return false;
    }
  }
  if (rules.includes('connect')) {
    const all = [];
    mines.forEach((m, i) => m && all.push(i));
    if (all.length) {
      const seen = new Set([all[0]]);
      const q = [all[0]];
      while (q.length) for (const j of orth(w, h, q.pop())) if (mines[j] && !seen.has(j)) { seen.add(j); q.push(j); }
      if (seen.size !== all.length) return false;
    }
  }
  return true;
}

// ───────── 罠を置く ─────────
function placeMines(w, h, rules, count, rand) {
  const n = w * h;
  for (let tries = 0; tries < 200; tries++) {
    const mines = Array(n).fill(false);
    if (rules.includes('pair')) {
      // 2つずつの組を、組どうしが上下左右で接しないように置く
      let placed = 0;
      for (let t = 0; t < 400 && placed < count; t++) {
        const a = Math.floor(rand() * n);
        const nb = orth(w, h, a);
        const b = nb[Math.floor(rand() * nb.length)];
        if (mines[a] || mines[b]) continue;
        const touch = [a, b].some((c) => orth(w, h, c).some((d) => d !== a && d !== b && mines[d]));
        if (touch) continue;
        mines[a] = mines[b] = true;
        placed += 2;
      }
      if (placed !== count) continue;
    } else if (rules.includes('connect')) {
      // つながった罠を1マスずつ伸ばす
      const start = Math.floor(rand() * n);
      mines[start] = true;
      let placed = 1;
      while (placed < count) {
        const edge = [];
        mines.forEach((m, i) => m && orth(w, h, i).forEach((j) => !mines[j] && edge.push(j)));
        mines[edge[Math.floor(rand() * edge.length)]] = true;
        placed += 1;
      }
    } else {
      for (const i of shuffle([...Array(n).keys()], rand).slice(0, count)) mines[i] = true;
    }
    if (rulesHold(w, h, rules, mines)) return mines;
  }
  return null;
}

// ───────── 解く道具 ─────────
// know[i]：-1＝まだ分からない、0＝安全（開いた）、1＝罠（印）。
// 返り値：{ solved, steps: [{ level, safe: [...], mine: [...] }], know }

function constraintsOf(p, know) {
  const out = [];
  know.forEach((k, i) => {
    if (k !== 0) return;
    const area = areaOf(p.w, p.h, p.rules, i);
    const unknown = area.filter((j) => know[j] === -1);
    if (!unknown.length) return;
    const need = numberAt(p, i) - area.filter((j) => know[j] === 1).length;
    out.push({ at: i, unknown, need });
  });
  return out;
}

// 数字1つで決まるマス。
function level1(cons) {
  const safe = new Set(), mine = new Set();
  for (const c of cons) {
    if (c.need === 0) c.unknown.forEach((j) => safe.add(j));
    else if (c.need === c.unknown.length) c.unknown.forEach((j) => mine.add(j));
  }
  return { safe: [...safe], mine: [...mine] };
}

// 数字2つを合わせて決まるマス（2つの数えるマスが重なるとき）。
function level2(cons) {
  const safe = new Set(), mine = new Set();
  for (let a = 0; a < cons.length; a++) {
    for (let b = a + 1; b < cons.length; b++) {
      const A = cons[a], B = cons[b];
      if (!A.unknown.some((j) => B.unknown.includes(j))) continue;
      const cells = [...new Set([...A.unknown, ...B.unknown])];
      if (cells.length > 16) continue;
      const canMine = cells.map(() => false), canSafe = cells.map(() => false);
      const total = 1 << cells.length;
      for (let m = 0; m < total; m++) {
        let ca = 0, cb = 0;
        cells.forEach((c, k) => {
          if (m & (1 << k)) { if (A.unknown.includes(c)) ca++; if (B.unknown.includes(c)) cb++; }
        });
        if (ca !== A.need || cb !== B.need) continue;
        cells.forEach((c, k) => { if (m & (1 << k)) canMine[k] = true; else canSafe[k] = true; });
      }
      cells.forEach((c, k) => {
        if (canMine[k] && !canSafe[k]) mine.add(c);
        if (canSafe[k] && !canMine[k]) safe.add(c);
      });
    }
  }
  return { safe: [...safe], mine: [...mine] };
}

// 盤全体：数字・罠の数・変えルールを全部満たす置き方を探す。fixed で1マスを決めて探せる。
// 見つかった置き方（mines の配列）か null。limit を超えたら 'limit'。
function search(p, know, cons, fixed, budget) {
  const unknown = [];
  know.forEach((k, i) => k === -1 && unknown.push(i));
  // 数字に関わるマスを先に
  const inCons = new Set(cons.flatMap((c) => c.unknown));
  unknown.sort((a, b) => (inCons.has(b) ? 1 : 0) - (inCons.has(a) ? 1 : 0));
  const assign = new Map(fixed ? [[fixed[0], fixed[1]]] : []);
  const knownMines = know.filter((k) => k === 1).length;
  const total = p.count;
  const order = unknown.filter((i) => !assign.has(i));
  const consOf = new Map();
  cons.forEach((c, ci) => c.unknown.forEach((j) => { if (!consOf.has(j)) consOf.set(j, []); consOf.get(j).push(ci); }));
  const mineCnt = cons.map(() => 0), leftCnt = cons.map((c) => c.unknown.length);
  let mines = knownMines;
  const apply = (cell, v, d) => {
    for (const ci of consOf.get(cell) ?? []) { leftCnt[ci] -= d; if (v) mineCnt[ci] += d; }
    if (v) mines += d;
  };
  const okCons = (cell) => (consOf.get(cell) ?? []).every((ci) => mineCnt[ci] <= cons[ci].need && mineCnt[ci] + leftCnt[ci] >= cons[ci].need);
  for (const [cell, v] of assign) { apply(cell, v, 1); if (!okCons(cell)) return null; }
  const pairOk = (cell) => {
    if (!p.rules.includes('pair')) return true;
    // 罠のまわりの決まった罠が2つ以上なら不可、全部決まって1つでないなら不可
    const val = (j) => (know[j] === 1 ? 1 : know[j] === 0 ? 0 : assign.has(j) ? (assign.get(j) ? 1 : 0) : -1);
    for (const c of [cell, ...orth(p.w, p.h, cell)]) {
      if (val(c) !== 1) continue;
      const nb = orth(p.w, p.h, c).map(val);
      const m = nb.filter((v) => v === 1).length;
      if (m > 1) return false;
      if (m === 0 && !nb.includes(-1)) return false;
    }
    return true;
  };
  let nodes = 0;
  let found = null;
  const rest = order.length;
  const rec = (k) => {
    if (found || nodes > budget.limit) return;
    nodes += 1;
    if (mines > total || mines + (rest - k) < total) return;
    if (k === rest) {
      const all = know.map((kk, i) => kk === 1 || (kk === -1 && assign.get(i) === true));
      if (mines === total && rulesHold(p.w, p.h, p.rules, all)) found = all;
      return;
    }
    const cell = order[k];
    for (const v of [true, false]) {
      assign.set(cell, v);
      apply(cell, v, 1);
      if (okCons(cell) && pairOk(cell)) rec(k + 1);
      apply(cell, v, -1);
      assign.delete(cell);
      if (found) return;
    }
  };
  rec(0);
  budget.used += nodes;
  if (!found && nodes > budget.limit) return 'limit';
  return found;
}

function level3(p, know, cons, budget) {
  const one = search(p, know, cons, null, budget);
  if (!one || one === 'limit') return { safe: [], mine: [], broken: true };
  const safe = [], mine = [];
  know.forEach((k, i) => {
    if (k !== -1) return;
    const other = search(p, know, cons, [i, !one[i]], budget);
    if (other === 'limit') return;
    if (!other) (one[i] ? mine : safe).push(i);
  });
  return { safe, mine };
}

export function solve(p, opts = {}) {
  const know = p.mines.map(() => -1);
  p.shown.forEach((i) => { know[i] = 0; });
  const steps = [];
  const budget = { limit: opts.limit ?? 20000, used: 0 };
  const safeTotal = p.mines.filter((m) => !m).length;
  for (let guard = 0; guard < 200; guard++) {
    if (know.filter((k) => k === 0).length === safeTotal) return { solved: true, steps, know, nodes: budget.used };
    const cons = constraintsOf(p, know);
    let r = level1(cons), level = 1;
    if (!r.safe.length && !r.mine.length) { r = level2(cons); level = 2; }
    if (!r.safe.length && !r.mine.length) { r = level3(p, know, cons, budget); level = 3; }
    if (!r.safe.length && !r.mine.length) return { solved: false, steps, know, nodes: budget.used };
    for (const i of r.safe) { if (p.mines[i]) throw new Error('解く道具が罠を安全とした'); know[i] = 0; }
    for (const i of r.mine) { if (!p.mines[i]) throw new Error('解く道具が安全を罠とした'); know[i] = 1; }
    steps.push({ level, safe: r.safe, mine: r.mine });
  }
  return { solved: false, steps, know, nodes: budget.used };
}

// 難しさのまとめ：各段の手の数と、一番難しい手。
export function difficulty(result) {
  const by = { 1: 0, 2: 0, 3: 0 };
  for (const s of result.steps) by[s.level] += 1;
  return { max: Math.max(0, ...result.steps.map((s) => s.level)), by };
}

// ───────── 作る ─────────
// spec：{ w, h, count, rules, seed, maxLevel?（使ってよい一番難しい手）, maxGlobal?（盤全体の手は何回まで。最初の手には使わない）,
//         prune?（開いているマスを減らすか） }
export function generate(spec) {
  const rand = rng(spec.seed);
  const maxLevel = spec.maxLevel ?? 3;
  const maxGlobal = spec.maxGlobal ?? Infinity;
  const good = (r) => {
    if (!r.solved) return false;
    const d = difficulty(r);
    if (d.max > maxLevel || d.by[3] > maxGlobal) return false;
    return maxGlobal === Infinity || !r.steps.length || r.steps[0].level < 3;
  };
  for (let attempt = 0; attempt < 60; attempt++) {
    const mines = placeMines(spec.w, spec.h, spec.rules, spec.count, rand);
    if (!mines) continue;
    const safeCells = shuffle(mines.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0), rand);
    const p = { w: spec.w, h: spec.h, rules: spec.rules.slice(), count: spec.count, mines, shown: [] };
    // 解けるまで開いているマスを足す（詰まった所のまだ分からない安全なマスから選ぶ）
    p.shown.push(safeCells[0]);
    let r = solve(p);
    while (!good(r)) {
      const stuck = safeCells.filter((i) => r.know[i] === -1 && !p.shown.includes(i));
      if (!stuck.length) break;
      p.shown.push(stuck[0]);
      r = solve(p);
    }
    if (!good(r)) continue;
    // 要らない開いたマスを除く（解けて、難しさの条件を守るなら除く）
    if (spec.prune !== false) {
      for (const i of shuffle(p.shown, rand)) {
        if (p.shown.length <= 1) break;
        const q = { ...p, shown: p.shown.filter((j) => j !== i) };
        const rq = solve(q);
        if (good(rq)) { p.shown = q.shown; r = rq; }
      }
    }
    p.shown.sort((a, b) => a - b);
    return { puzzle: p, result: r, attempts: attempt + 1 };
  }
  return null;
}
