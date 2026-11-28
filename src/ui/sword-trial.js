// 剣の巻物の試しの頁（工程7a）：ピクロス6問を遊ぶ。ルールは src/core/nonogram.js。判定表 第13回 B・第14回。
import { APP_VERSION } from '../version.js';
import { generateNono, nonoDifficulty, NONO_RULES, linesOf, filledCount } from '../core/nonogram.js';
import { SWORD_TRIAL } from '../data/sword.js';
import { skillGain } from '../data/dojo.js';

const $ = (id) => document.getElementById(id);
const KEY = 'workshop-wayfarer:sword-trial';
const COLOR_NAME = { 1: '赤', 2: '青' };

// 6問を作る（種つきなので毎回同じ）
const puzzles = SWORD_TRIAL.map((t) => {
  const g = generateNono(t);
  return { spec: t, p: g.puzzle, plan: nonoDifficulty(g.result) };
});

// 遊んだ記録：{ [番号]: { paint: { マス: 色 }, xs: [], wrong: [], mistakes, ms, done } }
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { saved = {}; }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* 保存できなくても遊べる */ } };

let cur = 0;
let mode = 'paint1'; // paint1・paint2（色）・x
let tickFrom = performance.now();

function rec(i = cur) {
  if (!saved[i]) saved[i] = { paint: {}, xs: [], wrong: [], mistakes: 0, ms: 0, done: false };
  return saved[i];
}
function addTime() {
  const now = performance.now();
  const r = rec();
  if (!r.done && !document.hidden) r.ms += now - tickFrom;
  tickFrom = now;
}
function clock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ───── 手 ─────
// 塗る。答えと違えばミスで、そのマスは正しい形（×か正しい色）に直る。
function paint(i, color) {
  const { p } = puzzles[cur];
  const r = rec();
  if (r.done || r.paint[i] !== undefined || r.wrong.includes(i)) return;
  r.xs = r.xs.filter((j) => j !== i);
  if (p.solution[i] === color) {
    r.paint[i] = color;
  } else {
    r.mistakes += 1;
    r.wrong.push(i);
    if (p.solution[i]) r.paint[i] = p.solution[i];
  }
  if (Object.keys(r.paint).length === filledCount(p)) r.done = true;
}
function setX(i, on) {
  const r = rec();
  if (r.done || r.paint[i] !== undefined || r.wrong.includes(i)) return;
  const has = r.xs.includes(i);
  if (on && !has) r.xs.push(i);
  if (!on && has) r.xs = r.xs.filter((j) => j !== i);
}

// 押したまま動かすと、最初のマスと同じ手を続ける
let stroke = null; // { kind: 'paint'|'x', color, on, done: Set }
function apply(i) {
  if (!stroke || stroke.done.has(i)) return;
  stroke.done.add(i);
  if (stroke.kind === 'paint') paint(i, stroke.color);
  else setX(i, stroke.on);
}
function begin(i, asX) {
  addTime();
  const r = rec();
  if (asX || mode === 'x') stroke = { kind: 'x', on: !r.xs.includes(i), done: new Set() };
  else stroke = { kind: 'paint', color: mode === 'paint2' ? 2 : 1, done: new Set() };
  apply(i);
  render();
}
function end() {
  if (!stroke) return;
  stroke = null;
  store();
  render();
}

const board = $('nono');
let longTimer = null;
board.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-cell]');
  if (!b) return;
  e.preventDefault();
  const i = Number(b.dataset.cell);
  if (e.button === 2) { begin(i, true); return; }
  if (e.pointerType === 'touch') {
    // 長押しは ×
    longTimer = setTimeout(() => { longTimer = null; begin(i, true); }, 450);
    board.dataset.pending = String(i);
    return;
  }
  begin(i, false);
});
window.addEventListener('pointermove', (e) => {
  if (longTimer) {
    // 長押しの前に動いたら塗るほうで始める
    const i = Number(board.dataset.pending);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#nono [data-cell]');
    if (el && Number(el.dataset.cell) !== i) { clearTimeout(longTimer); longTimer = null; begin(i, false); }
  }
  if (!stroke) return;
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#nono [data-cell]');
  if (el) { apply(Number(el.dataset.cell)); render(); }
});
window.addEventListener('pointerup', () => {
  if (longTimer) { clearTimeout(longTimer); longTimer = null; begin(Number(board.dataset.pending), false); }
  end();
});
board.addEventListener('contextmenu', (e) => e.preventDefault());
board.addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-cell]');
  if (!b) return;
  const i = Number(b.dataset.cell);
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(i, false); end(); }
  if (e.key === 'x' || e.key === 'X') { e.preventDefault(); begin(i, true); end(); }
});

$('modes').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mode]');
  if (!b) return;
  mode = b.dataset.mode;
  render();
});
$('scroll-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  addTime();
  cur = Number(b.dataset.pick);
  if (mode === 'paint2' && puzzles[cur].p.colors === 1) mode = 'paint1';
  store();
  render();
});
$('btn-retry').addEventListener('click', () => {
  if (!confirm('この巻物をはじめからにしますか？（時間とミスも消えます）')) return;
  delete saved[cur];
  tickFrom = performance.now();
  store();
  render();
});

// ───── 描く ─────
function clueHtml(p, clue, sum) {
  if (clue.kind === 'sum') {
    const parts = clue.counts.map((n, k) => (p.colors === 2 ? `<span class="c${k + 1}">${n}</span>` : `${n}`));
    return `<span class="sum" title="合計">◆${parts.join(' ')}</span>`;
  }
  if (!clue.runs.length) return '<span>0</span>';
  return clue.runs.map((r) => `<span class="c${p.colors === 2 ? r.color : 1}">${r.len}</span>`).join('');
}
function lineDone(p, r, cells) {
  return cells.every((c) => !p.solution[c] || r.paint[c] === p.solution[c]);
}

function render() {
  const { spec, p, plan } = puzzles[cur];
  const r = rec();
  $('scroll-list').innerHTML = puzzles.map((x, i) => {
    const s = saved[i];
    const sub = s?.done ? `解けた ${clock(s.ms)}・ミス${s.mistakes}` : s ? `途中 ${clock(s.ms)}` : 'まだ';
    return `<button type="button" class="opt${i === cur ? ' sel' : ''}" data-pick="${i}">${i + 1}. ${x.spec.name}<small>${sub}</small></button>`;
  }).join('');
  $('scroll-name').textContent = `${cur + 1}. ${spec.name}`;
  $('scroll-rule').innerHTML = spec.rules.length
    ? spec.rules.map((k) => `<b>${NONO_RULES[k].name}</b>：${NONO_RULES[k].text}`).join('<br>')
    : '変えルールなし（数字は続けて塗るマスの長さ）';
  $('paint-count').textContent = `塗る ${Object.keys(r.paint).length}/${filledCount(p)}`;
  $('mistakes').textContent = `ミス ${r.mistakes}`;
  const modes = [['paint1', p.colors === 2 ? '赤で塗る' : '塗る'], ...(p.colors === 2 ? [['paint2', '青で塗る']] : []), ['x', '×']];
  $('modes').innerHTML = modes.map(([m, t]) => `<button type="button" data-mode="${m}" aria-pressed="${mode === m}">${t}</button>`).join('');

  const lines = linesOf(p.w, p.h);
  board.style.setProperty('--w', p.w);
  board.classList.toggle('mirror', p.rules.includes('mirror'));
  board.classList.toggle('colors', p.colors === 2);
  let html = '<div class="nono-corner"></div>';
  for (let x = 0; x < p.w; x++) {
    const done = lineDone(p, r, lines[p.h + x].cells);
    html += `<div class="nono-clue col${done ? ' done' : ''}">${clueHtml(p, p.clues.cols[x])}</div>`;
  }
  for (let y = 0; y < p.h; y++) {
    const done = lineDone(p, r, lines[y].cells);
    html += `<div class="nono-clue row${done ? ' done' : ''}">${clueHtml(p, p.clues.rows[y])}</div>`;
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      const v = r.paint[i];
      const wrong = r.wrong.includes(i);
      const xMark = r.xs.includes(i) || (wrong && !p.solution[i]);
      const cls = ['nc'];
      if (v) cls.push(`p${v}`);
      if (xMark) cls.push('x');
      if (wrong) cls.push('wrong');
      if (p.rules.includes('mirror') && p.w % 2 === 0 && x === p.w / 2) cls.push('mid-l');
      if (p.rules.includes('mirror') && p.w % 2 === 1 && x === (p.w - 1) / 2) cls.push('mid');
      const label = v ? `${COLOR_NAME[v] ?? ''}塗り` : xMark ? '×' : 'まだ';
      html += `<button type="button" class="${cls.join(' ')}" data-cell="${i}" aria-label="${label}">${xMark ? '×' : ''}</button>`;
    }
  }
  board.innerHTML = html;
  $('dojo-note').textContent = r.done ? '' : mode === 'x' ? '×を付けるマスを押す（もう一度押すと消える）。押したまま動かすと続けて付く' : '塗るマスを押す。押したまま動かすと続けて塗れる。右クリック・長押しは×';
  const res = $('dojo-result');
  res.hidden = !r.done;
  if (r.done) {
    res.innerHTML = `<b>解けた！</b>　時間 ${clock(r.ms)}　ミス ${r.mistakes}　熟練 ＋${skillGain(r.mistakes)}` +
      `<br><span class="small quiet">解く道具の見立て：数字だけで決まる手 ${plan.by[1]}・行と列を行き来した回り ${plan.by[2]}・盤全体を見る手 ${plan.by[3]}</span>`;
  }
  renderClock();
}
function renderClock() {
  addTime();
  $('clock').textContent = `時間 ${clock(rec().ms)}`;
}
setInterval(() => { renderClock(); store(); }, 1000);
document.addEventListener('visibilitychange', () => { tickFrom = performance.now(); });

$('version').textContent = APP_VERSION;
render();

// 試すときに読む
window.describeSword = () => ({ cur, rec: rec(), name: puzzles[cur].spec.name, plan: puzzles[cur].plan, solution: puzzles[cur].p.solution, clues: puzzles[cur].p.clues });
