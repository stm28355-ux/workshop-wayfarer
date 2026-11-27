// 道場の試しの頁（工程4 前半）：守りの巻物6問を遊ぶ。ルールは src/core/scroll.js。
import { APP_VERSION } from '../version.js';
import { generate, numberAt, areaOf, solve, difficulty, RULES } from '../core/scroll.js';
import { TRIAL, skillGain } from '../data/dojo.js';

const $ = (id) => document.getElementById(id);
const KEY = 'workshop-wayfarer:dojo-trial';

// 6問を作る（種つきなので毎回同じ）
const puzzles = TRIAL.map((t) => {
  const g = generate(t);
  return { spec: t, p: g.puzzle, plan: difficulty(solve(g.puzzle)) };
});

// 遊んだ記録：{ [番号]: { opened:[], flags:[], mistakes, ms, done } }
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}; } catch { saved = {}; }
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* 保存できなくても遊べる */ } };

let cur = 0;
let mode = 'open';
let glow = null; // 光らせる数字のマス
let tickFrom = performance.now();

function rec(i = cur) {
  if (!saved[i]) {
    // 最初から開いているマス。0 ならまわりも開けておく（0 を開けたときと同じ）
    const { p } = puzzles[i];
    const opened = [];
    const stack = p.shown.slice();
    while (stack.length) {
      const c = stack.pop();
      if (opened.includes(c)) continue;
      opened.push(c);
      if (numberAt(p, c) === 0) for (const j of areaOf(p.w, p.h, p.rules, c)) if (!opened.includes(j)) stack.push(j);
    }
    saved[i] = { opened, flags: [], mistakes: 0, ms: 0, done: false, wrong: [] };
  }
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

// マスを開ける。0なら数えるマスも開ける。罠ならミス。
function open(i) {
  const { p } = puzzles[cur];
  const r = rec();
  if (r.done || r.opened.includes(i) || r.wrong.includes(i)) return;
  if (p.mines[i]) {
    r.mistakes += 1;
    r.wrong.push(i);
    r.flags = r.flags.filter((j) => j !== i);
    return;
  }
  const stack = [i];
  while (stack.length) {
    const c = stack.pop();
    if (r.opened.includes(c)) continue;
    r.opened.push(c);
    r.flags = r.flags.filter((j) => j !== c);
    if (numberAt(p, c) === 0) for (const j of areaOf(p.w, p.h, p.rules, c)) if (!p.mines[j] && !r.opened.includes(j)) stack.push(j);
  }
  const safe = p.mines.filter((m) => !m).length;
  if (r.opened.length === safe) r.done = true;
}

function toggleFlag(i) {
  const r = rec();
  if (r.done || r.opened.includes(i) || r.wrong.includes(i)) return;
  r.flags = r.flags.includes(i) ? r.flags.filter((j) => j !== i) : [...r.flags, i];
}

function act(i, flag) {
  addTime();
  const r = rec();
  if (r.opened.includes(i)) {
    glow = glow === i ? null : i; // 数字を押すと数えるマスが光る
  } else if (flag || mode === 'flag') {
    toggleFlag(i);
    glow = null;
  } else {
    open(i);
    glow = null;
  }
  store();
  render();
}

// ───── 入力：押す・右クリック・長押し ─────
const board = $('mine-board');
let press = null;
board.addEventListener('pointerdown', (e) => {
  const b = e.target.closest('[data-cell]');
  if (!b) return;
  if (e.button === 2) return;
  press = { i: Number(b.dataset.cell), long: false, timer: setTimeout(() => { press.long = true; act(press.i, true); }, 450) };
});
board.addEventListener('pointerup', (e) => {
  if (!press) return;
  clearTimeout(press.timer);
  const b = e.target.closest('[data-cell]');
  if (!press.long && b && Number(b.dataset.cell) === press.i && e.button !== 2) act(press.i, false);
  press = null;
});
board.addEventListener('pointerleave', () => { if (press) { clearTimeout(press.timer); press = null; } });
board.addEventListener('contextmenu', (e) => {
  const b = e.target.closest('[data-cell]');
  e.preventDefault();
  if (b) act(Number(b.dataset.cell), true);
});
board.addEventListener('keydown', (e) => {
  const b = e.target.closest('[data-cell]');
  if (!b) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(Number(b.dataset.cell), false); }
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); act(Number(b.dataset.cell), true); }
});

for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => {
    mode = b.dataset.mode;
    for (const x of document.querySelectorAll('[data-mode]')) x.setAttribute('aria-pressed', String(x.dataset.mode === mode));
  });
}
$('scroll-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pick]');
  if (!b) return;
  addTime();
  cur = Number(b.dataset.pick);
  glow = null;
  store();
  render();
});
$('btn-retry').addEventListener('click', () => {
  if (!confirm('この巻物をはじめからにしますか？（時間とミスも消えます）')) return;
  delete saved[cur];
  glow = null;
  tickFrom = performance.now();
  store();
  render();
});

// ───── 描く ─────
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
    ? spec.rules.map((k) => `<b>${RULES[k].name}</b>：${RULES[k].text}`).join('<br>')
    : '変えルールなし（数字はまわり8マスの罠の数）';
  $('mine-count').textContent = `罠 ${p.count}　印 ${r.flags.length}`;
  $('mistakes').textContent = `ミス ${r.mistakes}`;
  const area = glow !== null ? new Set(areaOf(p.w, p.h, p.rules, glow)) : null;
  board.style.setProperty('--w', p.w);
  let html = '';
  for (let i = 0; i < p.w * p.h; i++) {
    const opened = r.opened.includes(i);
    const wrong = r.wrong.includes(i);
    const flag = r.flags.includes(i);
    const showMine = r.done && p.mines[i];
    const cls = ['mc'];
    if (opened) cls.push('open');
    if (p.shown.includes(i)) cls.push('given');
    if (wrong) cls.push('wrong');
    if (flag) cls.push('flag');
    if (showMine) cls.push('mine');
    if (area?.has(i)) cls.push('glow');
    if (glow === i) cls.push('glow-src');
    const n = opened ? numberAt(p, i) : null;
    const text = opened ? (n === 0 ? '' : n) : wrong ? '✖' : flag ? '◆' : showMine ? '◆' : '';
    const label = opened ? `数字${n}` : wrong ? '罠（ミス）' : flag ? '印' : 'まだ';
    html += `<button type="button" class="${cls.join(' ')}" data-cell="${i}" aria-label="${label}"><span class="n${n ?? ''}">${text}</span></button>`;
  }
  board.innerHTML = html;
  $('dojo-note').textContent = r.done ? '' : mode === 'flag' ? '印を付けるマスを押す（もう一度押すと消える）' : '開けるマスを押す。数字を押すと数えるマスが光る';
  const res = $('dojo-result');
  res.hidden = !r.done;
  if (r.done) {
    res.innerHTML = `<b>解けた！</b>　時間 ${clock(r.ms)}　ミス ${r.mistakes}　熟練 ＋${skillGain(r.mistakes)}` +
      `<br><span class="small quiet">解く道具の見立て：数字1つで決まる手 ${plan.by[1]}・数字2つを合わせる手 ${plan.by[2]}・盤全体を見る手 ${plan.by[3]}</span>`;
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
window.describeDojo = () => ({ cur, rec: rec(), name: puzzles[cur].spec.name, shown: puzzles[cur].p.shown, plan: puzzles[cur].plan });
