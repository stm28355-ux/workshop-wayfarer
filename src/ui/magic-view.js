// 魔法の巻物（属性の数独）と弓の巻物（鏡で光を通す）の盤を描く（道場の中）。判定表 第18回 B・C。
import { ELEMENT_NAMES, REACT_PAIRS, boxOf } from '../core/sudoku.js';
import { trace, portKey, SLASH, BACK, ROCK } from '../core/mirrors.js';
import { beamCells } from '../core/dojo.js';

export const SUDO_RULE_TEXT = Object.freeze({
  react: { name: '反応の印', text: '隣り合うマスの間の ◆ は「反応する組」（水と雷・水と氷・火と氷）。◆ のない所は反応しない組' },
  cycle: { name: '巡りの線', text: '線の上は ●の端から 火→水→氷→雷→火… の順に並ぶ' },
  cage: { name: '囲み', text: '点線の囲みの中に同じ属性はない' },
});
export const BEAM_RULE_TEXT = Object.freeze({
  color: { name: '色の光', text: '赤の弓の光は赤の的にだけ、青は青にだけ届ける' },
  break: { name: '割れる鏡', text: '鏡は光が1度通ると割れる（2本の光が同じ鏡を通れない）' },
  label: { name: '番号の的', text: '弓と同じ番号の的へ届ける' },
});

export function reactText(n) {
  return REACT_PAIRS[n].map(([a, b]) => `${ELEMENT_NAMES[a]}と${ELEMENT_NAMES[b]}`).join('・');
}

// sc：魔法の巻物の状態。sel：選んだ属性（ボタンの色合わせ用）
export function sudoBoardHtml(sc) {
  const p = sc.puzzle;
  const n = p.n;
  const { bw, bh } = boxOf(n);
  const cageOf = new Map();
  (p.cages ?? []).forEach((c, k) => c.forEach((i) => cageOf.set(i, k)));
  let cells = '';
  for (let i = 0; i < n * n; i++) {
    const x = i % n, y = Math.floor(i / n);
    const given = p.givens.includes(i);
    const v = given ? p.solution[i] : sc.values[i];
    const cls = ['sc'];
    if (x % bw === bw - 1 && x < n - 1) cls.push('br');
    if (y % bh === bh - 1 && y < n - 1) cls.push('bb');
    if (given) cls.push('given');
    if (sc.wrong.includes(i)) cls.push('wrong');
    if (v !== undefined) cls.push(`e${v}`);
    const notes = !given && v === undefined && sc.notes[i] ? `<span class="notes">${sc.notes[i].map((e) => `<i class="e${e}">${ELEMENT_NAMES[e]}</i>`).join('')}</span>` : '';
    const label = v !== undefined ? ELEMENT_NAMES[v] : 'まだ';
    cells += `<button type="button" class="${cls.join(' ')}" data-scell="${i}" aria-label="${label}">${v !== undefined ? ELEMENT_NAMES[v] : ''}${notes}</button>`;
  }
  // 印・線・囲みは盤の上に重ねる絵（1マス＝1）
  let svg = '';
  for (const c of p.cages ?? []) {
    const set = new Set(c);
    for (const i of c) {
      const x = i % n, y = Math.floor(i / n);
      const d = 0.1;
      if (!set.has(i - n) || y === 0) svg += `<line x1="${x + d}" y1="${y + d}" x2="${x + 1 - d}" y2="${y + d}"/>`;
      if (!set.has(i + n) || y === n - 1) svg += `<line x1="${x + d}" y1="${y + 1 - d}" x2="${x + 1 - d}" y2="${y + 1 - d}"/>`;
      if (!set.has(i - 1) || x === 0) svg += `<line x1="${x + d}" y1="${y + d}" x2="${x + d}" y2="${y + 1 - d}"/>`;
      if (!set.has(i + 1) || x === n - 1) svg += `<line x1="${x + 1 - d}" y1="${y + d}" x2="${x + 1 - d}" y2="${y + 1 - d}"/>`;
    }
  }
  const cageSvg = svg ? `<g class="cage">${svg}</g>` : '';
  let lines = '';
  for (const line of p.lines ?? []) {
    const pts = line.map((i) => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`).join(' ');
    const s0 = line[0];
    lines += `<polyline points="${pts}"/><circle cx="${(s0 % n) + 0.5}" cy="${Math.floor(s0 / n) + 0.5}" r="0.13"/>`;
  }
  let marks = '';
  for (const [a, b] of p.marks ?? []) {
    const ax = a % n, ay = Math.floor(a / n);
    const horiz = b === a + 1;
    const cx = horiz ? ax + 1 : ax + 0.5;
    const cy = horiz ? ay + 0.5 : ay + 1;
    marks += `<rect x="${cx - 0.09}" y="${cy - 0.09}" width="0.18" height="0.18" transform="rotate(45 ${cx} ${cy})"/>`;
  }
  const over = `<svg class="sudo-over" viewBox="0 0 ${n} ${n}" preserveAspectRatio="none" aria-hidden="true">${cageSvg}${lines ? `<g class="cycle">${lines}</g>` : ''}${marks ? `<g class="react">${marks}</g>` : ''}</svg>`;
  return `<div class="sudo-wrap" style="--n:${n}"><div class="sudo" role="grid" aria-label="巻物の盤">${cells}</div>${over}</div>`;
}

const ARROW = { top: '↓', bottom: '↑', left: '→', right: '←' };

// sc：弓の巻物の状態
export function beamBoardHtml(sc) {
  const p = sc.puzzle;
  const { w, h } = p;
  const cells = beamCells(sc);
  // 今の盤で光をたどる（置いていない所は空き）。光は盤の上に線で描く（1マス＝1、口と数の欄も1マス）。
  const reached = new Set();
  const at = (side, k) => (side === 'top' ? [k + 2.5, 1.5] : side === 'bottom' ? [k + 2.5, h + 2.5] : side === 'left' ? [1.5, k + 2.5] : [w + 2.5, k + 2.5]);
  let beams = '';
  for (const b of p.bows) {
    const r = trace(w, h, cells, b);
    const pts = [at(b.side, b.at), ...r.cells.map((c) => [(c % w) + 2.5, Math.floor(c / w) + 2.5])];
    if (r.out) {
      pts.push(at(r.out.side, r.out.at));
      const t = p.targets.find((x) => portKey(x) === portKey(r.out));
      const ok = t && (!b.color || b.color === t.color) && (b.label === undefined || b.label === t.label);
      if (ok) reached.add(portKey(t));
    }
    beams += `<polyline class="${b.color ?? 'w'}" points="${pts.map(([x, y]) => `${x},${y}`).join(' ')}"/>`;
  }
  const portAt = new Map();
  for (const b of p.bows) portAt.set(portKey(b), { ...b, role: 'bow' });
  for (const t of p.targets) portAt.set(portKey(t), { ...t, role: 'target' });
  const portHtml = (side, at) => {
    const o = portAt.get(`${side}:${at}`);
    if (!o) return '<span class="bp"></span>';
    const color = o.color ? ` ${o.color}` : '';
    const lab = o.label !== undefined ? `<small>${o.label}</small>` : '';
    if (o.role === 'bow') return `<span class="bp bow${color}" title="弓">弓${ARROW[side]}${lab}</span>`;
    const hit = reached.has(`${side}:${at}`);
    return `<span class="bp target${color}${hit ? ' hit' : ''}" title="的">${hit ? '◉' : '◎'}${lab}</span>`;
  };
  let g = '';
  // 1段目：列の鏡の数
  g += '<span class="bcnt"></span><span class="bcnt"></span>';
  for (let x = 0; x < w; x++) g += `<span class="bcnt">${p.colCounts ? p.colCounts[x] : ''}</span>`;
  g += '<span class="bcnt"></span>';
  // 2段目：上の口
  g += '<span class="bcnt"></span><span class="bp"></span>';
  for (let x = 0; x < w; x++) g += portHtml('top', x);
  g += '<span class="bp"></span>';
  const hintAt = new Map((sc.hints ?? []).map((x) => [x.at, x]));
  for (let y = 0; y < h; y++) {
    g += `<span class="bcnt row">${p.rowCounts ? p.rowCounts[y] : ''}</span>`;
    g += portHtml('left', y);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = cells[i];
      const cls = ['bc'];
      if (v === ROCK) cls.push('rock');
      if (p.shown.includes(i)) cls.push('given');
      if (sc.wrong.includes(i)) cls.push('wrong');
      const sure = sc.sureX.includes(i) || (p.shown.includes(i) && v === 0);
      const mark = sc.xs.includes(i);
      if (sure || mark) cls.push('x');
      if (sure) cls.push('sure');
      const glyph = v === ROCK ? '岩' : v === SLASH ? '╱' : v === BACK ? '╲' : sure || mark ? '×' : '';
      const hint = hintAt.get(i);
      const label = v === ROCK ? '岩' : v === SLASH ? '鏡／' : v === BACK ? '鏡＼' : sure ? '空き（確か）' : mark ? '×' : 'まだ';
      g += `<button type="button" class="${cls.join(' ')}" data-bcell="${i}" aria-label="${label}"${v === ROCK ? ' disabled' : ''}>${glyph}${hint ? `<i class="hint">${hint.value}</i>` : ''}</button>`;
    }
    g += portHtml('right', y);
  }
  g += '<span class="bcnt"></span><span class="bp"></span>';
  for (let x = 0; x < w; x++) g += portHtml('bottom', x);
  g += '<span class="bp"></span>';
  const over = `<svg class="beam-over" viewBox="0 0 ${w + 3} ${h + 3}" preserveAspectRatio="none" aria-hidden="true">${beams}</svg>`;
  return `<div class="beam-wrap" style="--w:${w};--h:${h}"><div class="beam" role="grid" aria-label="巻物の盤">${g}</div>${over}</div>`;
}
