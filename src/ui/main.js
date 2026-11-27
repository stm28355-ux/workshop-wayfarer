// 試作画面（工程2）：地域1の冒険とマージの盤。ルールは src/core の関数を呼ぶだけ。
import { APP_VERSION } from '../version.js';
import { createGame, advance, feed, moveItem, chooseRegion, region } from '../core/game.js';
import { levelStats, xpToNext } from '../core/hero.js';
import { rankValue } from '../core/rank.js';
import { TICKS_PER_SEC, PREP, REGIONS, KINDS } from '../data/balance.js';
import { load, save, clear } from './save.js';

const params = new URLSearchParams(location.search);
const SPEED = Math.min(20, Math.max(0.25, Number(params.get('speed')) || 1));
const TEST_OPEN = params.get('test') === 'open';
const TICK_MS = 1000 / TICKS_PER_SEC;
const EXIT_NAMES = { prep: '支度', grow: '育てる', forge: '装備作り', workshop: '工房' };

const $ = (id) => document.getElementById(id);

// ---- 状態 ----
let state;
let meta; // 画面だけの記録：ログ・地域ごとの一番遠く
const loaded = load();
if (loaded) {
  state = loaded.state;
  meta = { log: [], best: {}, ...loaded.meta };
} else {
  state = createGame();
  meta = { log: [], best: {} };
}
if (TEST_OPEN) openAll(state);

function openAll(s) {
  s.open.regions = REGIONS.map((r) => r.id);
  if (!s.open.exits.includes('workshop')) s.open.exits.push('workshop');
}

let selected = null; // 選んでいるマス
let drag = null; // { from, x, y, moved }
let paused = false;
const flashes = new Map(); // マス → 光らせる終わりの時刻
const recent = { pick: [], merge: [], over: [] }; // 直近1分の刻み

// ---- ことば ----
function itemName(item) {
  return `${KINDS[item.kind].name}${item.rank}`;
}
function secs(ticks) {
  const s = Math.max(0, Math.ceil(ticks / TICKS_PER_SEC));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function log(text, kind = '') {
  meta.log.unshift({ text, kind });
  meta.log.length = Math.min(meta.log.length, 4);
}
function prepSecondsFor(value) {
  return Math.round((value * PREP.perValue) / region(state.run.region).drain / TICKS_PER_SEC);
}

// ---- 時間を進める ----
function handle(events) {
  let overflow = 0;
  for (const e of events) {
    if (e.type === 'pickup') recent.pick.push(state.tick);
    else if (e.type === 'overflow') {
      recent.pick.push(state.tick);
      recent.over.push(state.tick);
      overflow += 1;
    } else if (e.type === 'boss') {
      log(`${region(e.region).boss.name}を倒した！`, 'good');
    } else if (e.type === 'unlock') {
      const name = unlockName(e.key);
      if (name) log(`${name}が開いた`, 'good');
    } else if (e.type === 'return') {
      meta.best[e.region] = Math.max(meta.best[e.region] ?? 0, e.step);
      if (e.reason === 'prep') log(`支度が切れて村へ帰った（${e.step}歩）。すぐ出発`);
      else if (e.reason === 'down') log(`倒れて村へ帰った（${e.step}歩）。支度の残りは失った`, 'bad');
    }
  }
  if (overflow) {
    // あふれは続けて起きるので、続いている間は1行にまとめて数える
    const top = meta.log[0];
    const total = (top?.over ?? 0) + overflow;
    if (top?.over) meta.log.shift();
    meta.log.unshift({ text: `盤がいっぱい：拾った物は支度へ（続けて ${total}個）`, kind: 'bad', over: total });
    meta.log.length = Math.min(meta.log.length, 4);
  }
  meta.best[state.run.region] = Math.max(meta.best[state.run.region] ?? 0, state.run.step);
}

function unlockName(key) {
  const [what, arg] = key.split(':');
  if (what === 'region') return `地域${arg}「${region(Number(arg)).name}」`;
  if (key === 'exit:workshop') return '工房の出口';
  if (key === 'crafter:merge') return 'マージの職人（工程6から）';
  if (key === 'stage:forge') return '段2 打ち分け（工程3から）';
  return null;
}

let last = performance.now();
let acc = 0;
let saveAt = 0;
let loopOn = false;

function frame(now) {
  if (!loopOn) return;
  const dt = Math.min(1000, now - last); // コマが間引かれても1秒までは追いつく
  last = now;
  if (!paused) {
    acc += dt * SPEED;
    const n = Math.floor(acc / TICK_MS);
    if (n > 0) {
      acc -= n * TICK_MS;
      const r = advance(state, n);
      state = r.state;
      handle(r.events);
    }
  }
  if (now > saveAt) {
    save(state, meta);
    saveAt = now + 5000;
  }
  render(now);
  requestAnimationFrame(frame);
}
function startLoop() {
  if (loopOn) return;
  loopOn = true;
  last = performance.now();
  acc = 0;
  requestAnimationFrame(frame);
}
function stopLoop() {
  loopOn = false;
  save(state, meta);
}
// 閉じている間・裏のタブの間は止まる（判定表 第1回 C4）
document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
window.addEventListener('pagehide', () => save(state, meta));

// ---- 人の手 ----
function doMove(from, to) {
  const r = moveItem(state, from, to);
  const a = state.board.cells[from];
  const b = state.board.cells[to];
  if (!r.merged && a && b && a.kind === b.kind && a.rank === b.rank) {
    log('重ねて3個以上にならないと合わさらない');
  }
  state = r.state;
  selected = null;
  if (r.merged) {
    recent.merge.push(state.tick);
    const until = performance.now() + 450;
    for (const i of r.merged.at) flashes.set(i, until);
  }
}

function doFeed(index, exit) {
  if (!state.open.exits.includes(exit)) {
    log('工房は地域1のボスを倒すと開く');
    return;
  }
  const before = state.hero.level;
  const r = feed(state, index, exit);
  if (!r.ok) return;
  state = r.state;
  selected = null;
  if (exit === 'grow' && state.hero.level > before) log(`レベル${state.hero.level}に上がった`, 'good');
}

function act(target) {
  if (!target) return;
  if (target.dataset.exit) {
    if (selected !== null) doFeed(selected, target.dataset.exit);
    return;
  }
  const i = Number(target.dataset.cell);
  if (selected === null) {
    if (state.board.cells[i]) selected = i;
  } else if (selected === i) {
    selected = null;
  } else {
    doMove(selected, i);
  }
}

const boardEl = $('board');
const ghost = $('ghost');

boardEl.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (!cell || e.button > 0) return;
  const i = Number(cell.dataset.cell);
  if (!state.board.cells[i]) return; // 空きマスは pointerup で扱う
  drag = { from: i, x: e.clientX, y: e.clientY, moved: false };
  e.preventDefault();
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
    drag.moved = true;
    const item = state.board.cells[drag.from];
    if (!item) { drag = null; return; }
    ghost.innerHTML = itemHtml(item);
    ghost.hidden = false;
  }
  if (drag.moved) {
    ghost.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
    markHover(e.clientX, e.clientY);
  }
});
window.addEventListener('pointerup', (e) => {
  const under = document.elementFromPoint(e.clientX, e.clientY);
  const target = under?.closest('[data-cell],[data-exit]');
  if (drag) {
    const d = drag;
    drag = null;
    ghost.hidden = true;
    markHover(-1, -1);
    if (d.moved) {
      if (target?.dataset.exit) doFeed(d.from, target.dataset.exit);
      else if (target?.dataset.cell !== undefined) doMove(d.from, Number(target.dataset.cell));
      return;
    }
    act(target);
    return;
  }
  // 物のないマスや出口を押した
  if (target && (boardEl.contains(target) || target.dataset.exit) && e.pointerType !== undefined) act(target);
});
// キーボード（Enter・スペース）は click で来る
document.addEventListener('click', (e) => {
  if (e.detail !== 0) return;
  act(e.target.closest('[data-cell],[data-exit]'));
});

let hoverEl = null;
function markHover(x, y) {
  const el = x < 0 ? null : document.elementFromPoint(x, y)?.closest('[data-cell],[data-exit]');
  if (el === hoverEl) return;
  hoverEl?.classList.remove('hover');
  hoverEl = el ?? null;
  hoverEl?.classList.add('hover');
}

$('region').addEventListener('change', (e) => {
  const r = chooseRegion(state, Number(e.target.value));
  if (r.ok) state = r.state;
});
$('btn-pause').addEventListener('click', () => {
  paused = !paused;
  $('btn-pause').textContent = paused ? '再開' : '一時停止';
  $('btn-pause').setAttribute('aria-pressed', String(paused));
});
$('btn-help').addEventListener('click', () => $('help').showModal());
$('btn-reset').addEventListener('click', () => {
  if (!confirm('はじめからにしますか？（今の記録は消えます）')) return;
  clear();
  state = createGame();
  if (TEST_OPEN) openAll(state);
  meta = { log: [], best: {} };
  selected = null;
  for (const k of Object.keys(recent)) recent[k] = [];
  lastBoardKey = '';
});

// ---- 描く ----
function itemHtml(item) {
  const k = KINDS[item.kind];
  return `<span class="item r${item.rank}" style="--c:${k.color}"><b>${k.mark}</b><i>${item.rank}</i></span>`;
}

let lastBoardKey = '';
function renderBoard(now) {
  const b = state.board;
  for (const [i, until] of flashes) if (until < now) flashes.delete(i);
  const key = JSON.stringify([b.w, b.cells, selected, [...flashes.keys()]]);
  if (key === lastBoardKey) return;
  lastBoardKey = key;
  boardEl.style.setProperty('--w', b.w);
  let html = '';
  b.cells.forEach((c, i) => {
    const cls = ['cell'];
    if (i === selected) cls.push('sel');
    if (flashes.has(i)) cls.push('flash');
    const label = c ? `${itemName(c)}（価値${rankValue(c.rank)}）` : '空き';
    html += `<button type="button" class="${cls.join(' ')}" data-cell="${i}" role="gridcell" aria-label="${label}">${c ? itemHtml(c) : ''}</button>`;
  });
  boardEl.innerHTML = html;
}

function exitSub(exit) {
  const s = state;
  if (!s.open.exits.includes(exit)) return '地域1のボスで開く';
  if (exit === 'prep') return `残り ${secs(s.run.prep / region(s.run.region).drain)}`;
  if (exit === 'grow') return `Lv${s.hero.level}　あと ${xpToNext(s.hero.level) - s.hero.xp}`;
  if (exit === 'forge') return `たまった ${Object.values(s.stock.forge).reduce((a, b) => a + b, 0)}`;
  return `たまった ${s.stock.workshop}`;
}
function exitGain(exit, item) {
  if (!item || !state.open.exits.includes(exit)) return '';
  const v = rankValue(item.rank);
  if (exit === 'prep') return `＋${prepSecondsFor(v)}秒`;
  if (exit === 'grow') return `＋${v} 経験`;
  return `＋${v}`;
}

let lastExitsKey = '';
function renderExits() {
  const item = selected !== null ? state.board.cells[selected] : drag ? state.board.cells[drag.from] : null;
  const parts = ['prep', 'grow', 'forge', 'workshop'].map((x) => [x, exitSub(x), exitGain(x, item), state.open.exits.includes(x)]);
  const key = JSON.stringify(parts);
  if (key === lastExitsKey) return;
  lastExitsKey = key;
  $('exits').innerHTML = parts.map(([x, sub, gain, open]) =>
    `<button type="button" class="exit${open ? '' : ' locked'}" data-exit="${x}" aria-disabled="${!open}">` +
    `<span class="exit-name">${EXIT_NAMES[x]}</span><span class="exit-sub num">${sub}</span><span class="exit-gain num">${gain}</span></button>`).join('');
}

function renderRegions() {
  const sel = $('region');
  const key = state.open.regions.join(',') + '|' + state.nextRegion;
  if (sel.dataset.key === key) return;
  sel.dataset.key = key;
  sel.innerHTML = state.open.regions.map((id) => `<option value="${id}"${id === state.nextRegion ? ' selected' : ''}>${id} ${region(id).name}</option>`).join('');
}

function setBar(id, ratio) {
  $(id).style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
}

function pruneRates() {
  const from = state.tick - 60 * TICKS_PER_SEC;
  for (const k of Object.keys(recent)) while (recent[k].length && recent[k][0] < from) recent[k].shift();
}

function render(now) {
  const s = state;
  const run = s.run;
  const reg = region(run.region);
  const { atk, maxHp } = levelStats(s.hero.level);

  renderRegions();
  $('region-note').textContent = s.nextRegion !== run.region ? `（次は ${region(s.nextRegion).name}）` : '';
  $('hero-level').textContent = `勇者 Lv${s.hero.level}　攻撃${atk}`;
  setBar('hp-bar', run.hp / maxHp);
  $('hp-text').textContent = `HP ${run.hp}/${maxHp}`;
  $('xp-text').textContent = `経験 ${s.hero.xp}/${xpToNext(s.hero.level)}`;

  const prepTicks = run.prep / reg.drain;
  setBar('prep-bar', prepTicks / (180 * TICKS_PER_SEC));
  $('prep-text').textContent = `残り ${secs(prepTicks)}`;

  const best = meta.best[run.region] ?? 0;
  $('road-hero').style.left = `${Math.min(1, run.step / reg.bossAt) * 100}%`;
  $('road-best').style.left = `${Math.min(1, best / reg.bossAt) * 100}%`;
  $('road-text').textContent = `${run.step} / ${reg.bossAt} 歩（一番遠く ${best}）`;

  const f = run.fight;
  if (f) {
    $('fight-name').textContent = f.boss ? `ボス：${reg.boss.name}` : `${reg.enemy.name}（${run.enemyIndex + 1}体目）`;
    $('enemy-meter').hidden = false;
    setBar('enemy-bar', f.hp / f.maxHp);
    $('enemy-text').textContent = `${Math.max(0, f.hp)}/${f.maxHp}　攻撃${f.atk}`;
  } else {
    $('fight-name').textContent = `歩いている（次の敵まで ${Math.max(0, run.nextEnemyAt - run.step)}歩）`;
    $('enemy-meter').hidden = true;
    $('enemy-text').textContent = '';
  }

  const logHtml = [0, 1, 2, 3].map((i) => {
    const l = meta.log[i];
    return `<li class="${l ? l.kind : ''}">${l ? l.text : '&nbsp;'}</li>`;
  }).join('');
  if ($('log').dataset.key !== logHtml) {
    $('log').dataset.key = logHtml;
    $('log').innerHTML = logHtml;
  }

  renderBoard(now);
  renderExits();

  const item = selected !== null ? s.board.cells[selected] : null;
  $('selected').textContent = item
    ? `${itemName(item)}（価値${rankValue(item.rank)}）を選んでいる。出口か、重ねる先・動かす先を押す`
    : '同じ物の上に重ねて合わせるか、出口へ入れる';

  pruneRates();
  $('rate-pick').textContent = recent.pick.length;
  $('rate-merge').textContent = recent.merge.length;
  $('rate-over').textContent = recent.over.length;
  renderRecords();
}

// 試すときの記録（判定表 第2回）：遊んだ時間・出発・倒れた・支度切れ・ボスを初めて倒した時間とレベル
function renderRecords() {
  const st = state.stats;
  const rows = [
    ['遊んだ時間', secs(state.tick)],
    ['出発', `${st.departures}回`],
    ['倒れて帰った', `${st.returns.down}回`],
    ['支度が切れて帰った', `${st.returns.prep}回`],
  ];
  for (const id of state.open.regions) {
    const fb = st.firstBoss?.[id];
    if (fb || id === state.run.region) rows.push([`地域${id}のボス`, fb ? `${secs(fb.tick)}（Lv${fb.level}）` : 'まだ']);
  }
  const html = rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('');
  const el = $('records');
  if (el.dataset.key !== html) {
    el.dataset.key = html;
    el.innerHTML = html;
  }
}

// 画面のまとめ（試すときに読む）
window.describeUI = () => ({
  version: APP_VERSION,
  region: state.run.region,
  step: state.run.step,
  prepSec: Math.round(state.run.prep / region(state.run.region).drain / TICKS_PER_SEC),
  level: state.hero.level,
  hp: state.run.hp,
  board: state.board.cells.map((c) => (c ? `${c.kind}${c.rank}` : '.')),
  selected,
  exits: state.open.exits,
  cleared: state.cleared,
  log: meta.log.map((l) => l.text),
});

$('version').textContent = APP_VERSION;
$('speed-note').textContent = SPEED !== 1 ? `　速さ ×${SPEED}` : '';
startLoop();
