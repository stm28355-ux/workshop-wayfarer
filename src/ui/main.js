// 試作画面（工程3）：冒険・マージの盤・打ち分け・工房。ルールは src/core の関数を呼ぶだけ。
import { APP_VERSION } from '../version.js';
import { createGame, advance, feed, moveItem, chooseRegion, region, isOpen } from '../core/game.js';
import { xpToNext } from '../core/hero.js';
import { heroStats, damageTaken, intervalText } from '../core/gear.js';
import { rankValue } from '../core/rank.js';
import { TICKS_PER_SEC, PREP, KINDS } from '../data/balance.js';
import { load, save, clear } from './save.js';
import { createForgeUI, craftText } from './forge-ui.js';
import { createDojoUI } from './dojo-ui.js';
import { createAutoUI } from './auto-ui.js';
import { planAfterRegion2 } from '../core/plan.js';
import { activeCards } from '../core/lineup.js';
import { CARDS } from '../data/cards.js';

const params = new URLSearchParams(location.search);
const SPEED = Math.min(20, Math.max(0.25, Number(params.get('speed')) || 1));
// 試すとき：?test=open は地域1のボスを倒した後（素材つき）、?test=all は地域3のボスの後（職人が2人とも来ている）。
// 試すときの保存は本番と別。
// ?test=dojo は地域2のボスの後（道場が開いている）。
// ?test=line は地域2のボスの後で、守りの札が全部使え（節 1/5）、技の節3つが 3/5（枠6）。
// ?test=r3 は地域2のボスを倒した直後の、予定表どおりの状態（判定表 第11回 D4。src/core/plan.js）。
// ?test=auto は門下生と振り分けが来ている状態（第11回 D5）。
const TEST = ['open', 'dojo', 'line', 'all', 'r3', 'auto'].includes(params.get('test')) ? params.get('test') : null;
const SLOT = TEST ? `test-${TEST}` : undefined;
const TICK_MS = 1000 / TICKS_PER_SEC;
const EXIT_NAMES = { prep: '支度', grow: '育てる', forge: '装備作り', workshop: '工房' };

const $ = (id) => document.getElementById(id);

// ---- 状態 ----
let state;
let meta; // 画面だけの記録：ログ・地域ごとの一番遠く
const loaded = load(SLOT);
if (loaded) {
  state = loaded.state;
  meta = { log: [], best: {}, ...loaded.meta };
} else {
  state = TEST ? testState(TEST) : createGame();
  meta = { log: [], best: {} };
}

function testState(mode) {
  if (mode === 'r3') return planAfterRegion2();
  if (mode === 'auto') return autoState();
  const s = createGame();
  const upto = { open: 1, dojo: 2, line: 2, all: 3 }[mode];
  for (let id = 1; id <= upto; id++) {
    s.cleared.push(id);
    for (const key of region(id).unlocks) {
      const [what, arg] = key.split(':');
      if (what === 'region') s.open.regions.push(Number(arg));
      else if (what === 'exit') s.open.exits.push(arg);
      else s.open.unlocks.push(key);
    }
  }
  s.hero.level = mode === 'all' ? 11 : 8;
  s.stock.forge = mode === 'all' ? { iron: 600, copper: 600, fire: 200, stone: 200 } : { iron: 150, copper: 60, fire: 40, stone: 30 };
  s.stock.workshop = mode === 'all' ? 300 : 60;
  if (mode === 'line') {
    for (const id of ['kamae', 'uke', 'mikiri', 'hada', 'tategamae', 'kaeshi', 'tateuchi', 'fumikomi', 'kizu', 'ibuki', 'ukenagashi', 'seishin', 'tame', 'shingan']) s.dojo.nodes[id] = { skill: 2 };
    for (const id of ['tateuchi', 'tame', 'mikiri']) s.dojo.nodes[id] = { skill: 6 };
    s.hero.level = 10;
  }
  s.run.hp = heroStats(s).maxHp;
  return s;
}

// 門下生と振り分けを見る状態：予定表の地域3の入口から、地域5のボスまで開けた物。
function autoState() {
  const s = planAfterRegion2();
  for (const id of [3, 4, 5]) {
    if (!s.cleared.includes(id)) s.cleared.push(id);
    for (const key of region(id).unlocks) {
      const [what, arg] = key.split(':');
      if (what === 'region') { if (!s.open.regions.includes(Number(arg))) s.open.regions.push(Number(arg)); }
      else if (what === 'exit') { if (!s.open.exits.includes(arg)) s.open.exits.push(arg); }
      else if (!s.open.unlocks.includes(key)) s.open.unlocks.push(key);
    }
  }
  // 構えを 1/5 にし、土台 5×5 は解いたことにする（門下生が受けの型・返しの型・息吹を解ける）
  s.dojo.nodes.kamae = { skill: 2 };
  s.dojo.shapes = ['base:5x5'];
  s.stock.workshop = 200;
  // 盤にランク3の物をいくつか（振り分けが出す）
  s.board.cells[0] = { kind: 'copper', rank: 3 };
  s.board.cells[1] = { kind: 'iron', rank: 3 };
  s.board.cells[2] = { kind: 'fire', rank: 2 };
  s.board.cells[3] = { kind: 'fire', rank: 2 };
  s.run.prep = 1e6;
  return s;
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
    } else if (e.type === 'line') {
      // 技の並びの効き（判定表 第9回 C5）：戦いごとに数える
      if (e.what === 'dodge' || e.what === 'focus') fightNotes.dodge += 1;
      if (e.what === 'parry') fightNotes.parry += 1;
    } else if (e.type === 'kill' || e.type === 'boss' || e.type === 'return') {
      fightNotes.dodge = 0;
      fightNotes.parry = 0;
      if (e.type === 'return') handleReturn(e);
    } else if (e.type === 'crafterMerge') {
      recent.merge.push(state.tick);
      const until = performance.now() + 450;
      for (const i of e.merged.at) flashes.set(i, until);
    } else if (e.type === 'craft' && e.auto) {
      log(craftText(e));
    } else if (e.type === 'split') {
      if (e.full) log('盤がいっぱい：振り分けが一番低い物を支度へ');
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

const fightNotes = { dodge: 0, parry: 0 };
function handleReturn(e) {
  meta.best[e.region] = Math.max(meta.best[e.region] ?? 0, e.step);
  if (e.reason === 'prep') log(`支度が切れて村へ帰った（${e.step}歩）。3秒後に出発`);
  else if (e.reason === 'down') log(`倒れて村へ帰った（${e.step}歩）。支度の残りは失った`, 'bad');
}

function unlockName(key) {
  const [what, arg] = key.split(':');
  if (what === 'region') return `地域${arg}「${region(Number(arg)).name}」`;
  if (key === 'exit:workshop') return '工房の出口';
  if (key === 'crafter:merge') return 'マージの職人';
  if (key === 'crafter:forge') return '打ち分けの職人';
  if (key === 'stage:forge') return '段2 打ち分け';
  if (key === 'stage:dojo') return '段3 道場';
  if (key === 'disciple') return '門下生';
  if (key === 'split') return '振り分け';
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
      const locked = [selected, drag?.from].filter((x) => x !== null && x !== undefined);
      const r = advance(state, n, { locked });
      state = r.state;
      handle(r.events);
      autoUI.handle(r.events);
    }
  }
  if (now > saveAt) {
    save(state, meta, SLOT);
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
  save(state, meta, SLOT);
}
// 閉じている間・裏のタブの間は止まる（判定表 第1回 C4）
document.addEventListener('visibilitychange', () => (document.hidden ? stopLoop() : startLoop()));
window.addEventListener('pagehide', () => save(state, meta, SLOT));

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
  clear(SLOT);
  state = TEST ? testState(TEST) : createGame();
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
  const { atk, maxHp, attackTicks } = heroStats(s);

  renderRegions();
  $('region-note').textContent = s.nextRegion !== run.region ? `（次は ${region(s.nextRegion).name}）` : '';
  $('hero-level').textContent = `勇者 Lv${s.hero.level}　攻撃${Math.round(atk)}${attackTicks !== 10 ? `（${intervalText(attackTicks, TICKS_PER_SEC)}秒に1回）` : ''}`;
  setBar('hp-bar', run.hp / maxHp);
  $('hp-text').textContent = `HP ${Math.max(0, Math.ceil(run.hp))}/${Math.round(maxHp)}`;
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
    const hit = damageTaken(f.atk, heroStats(s).guard);
    const guardNote = hit < f.atk ? `（盾で${Math.round(hit * 10) / 10}に）` : '';
    $('enemy-text').textContent = `${Math.max(0, Math.ceil(f.hp))}/${f.maxHp}　攻撃${f.atk}${guardNote}${f.enemyTicks < 10 ? `×${Math.round(10 / f.enemyTicks)}回/秒` : ''}`;
  } else if (run.wait > 0) {
    $('fight-name').textContent = `村で支度している（あと${Math.ceil(run.wait / TICKS_PER_SEC)}秒で出発）`;
    $('enemy-meter').hidden = true;
    $('enemy-text').textContent = '';
  } else {
    $('fight-name').textContent = `歩いている（次の敵まで ${Math.max(0, run.nextEnemyAt - run.step)}歩）`;
    $('enemy-meter').hidden = true;
    $('enemy-text').textContent = '';
  }

  renderFightLine(s);

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
  renderTabs();
  forgeUI.render();
  dojoUI.render();

  const item = selected !== null ? s.board.cells[selected] : null;
  $('selected').textContent = item
    ? `${itemName(item)}（価値${rankValue(item.rank)}）を選んでいる。出口か、重ねる先・動かす先を押す`
    : '同じ物の上に重ねて合わせるか、出口へ入れる';

  pruneRates();
  $('rate-pick').textContent = recent.pick.length;
  $('rate-merge').textContent = recent.merge.length;
  $('rate-over').textContent = recent.over.length;
  autoUI.render();
}

// 技の並びの進みと状態（判定表 第9回 C5）
function renderFightLine(s) {
  const run = s.run;
  const cards = activeCards(s, run.region);
  const line = run.line;
  const parts = [];
  if (cards.length && line) {
    const seq = cards.map((id, i) => (i === line.pos && line.recast <= 0 ? `[${CARDS[id].name}]` : CARDS[id].name)).join(' → ');
    parts.push(`並び：${seq}${line.recast > 0 ? `（積み直し ${(line.recast / TICKS_PER_SEC).toFixed(1)}秒）` : ''}`);
    const st = [];
    if (line.mods.length) st.push(`溜め×${line.mods.length}`);
    if (line.dodge > 0) st.push(`かわし${line.dodge}`);
    if (line.parry > 0) st.push('受け流し構え');
    if (s.tick < line.stanceUntil) st.push('構え');
    if (s.tick < line.focusUntil) st.push('心眼');
    const f = run.fight;
    if (f && f.breakUntil > s.tick) st.push('敵：崩し');
    if (fightNotes.dodge) st.push(`かわした${fightNotes.dodge}`);
    if (fightNotes.parry) st.push(`返した${fightNotes.parry}`);
    if (st.length) parts.push(st.join('・'));
  }
  const f = run.fight;
  if (f) {
    const tr = [];
    if (f.shell) tr.push(`殻${Math.round(f.shell)}`);
    if (f.shieldMax) tr.push(`盾${f.shieldHits}/${f.shieldMax}`);
    if (f.regen) tr.push('回復');
    if (tr.length) parts.push(`敵の性質：${tr.join('・')}`);
  }
  const text = parts.join('　');
  if ($('fight-line').textContent !== text) $('fight-line').textContent = text;
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
  stock: state.stock,
  gear: Object.fromEntries(Object.entries(state.gear.items).map(([k, it]) => [k, `格${it.tier} q${Math.round(it.q * 100)} +${Math.round(it.extra * 10) / 10}`])),
  equip: state.gear.equip,
  session: state.forge.session && { kind: state.forge.session.kind, slot: state.forge.session.slot, values: state.forge.session.values, temp: state.forge.session.temp, conc: state.forge.session.conc },
  hero: heroStats(state),
  tab,
  mid,
  dojo: state.dojo,
  split: state.split,
  crafter: state.crafter,
});

// 段のタブ（スマホ。判定表 第3回 F1）
// PC は真ん中の列を打ち分けと道場で切り替える（判定表 第6回 E4）。スマホは段1〜3のタブ。
let tab = '1';
let mid = 'forge';
function renderTabs() {
  const forgeOpen = isOpen(state, 'stage:forge');
  const dojoOpen = isOpen(state, 'stage:dojo');
  $('stage-tabs').hidden = !forgeOpen;
  $('tab-3').hidden = !dojoOpen;
  let t = forgeOpen ? tab : '1';
  if (t === '3' && !dojoOpen) t = '1';
  const m = dojoOpen ? mid : 'forge';
  const st = $('stage');
  if (st.dataset.tab !== t) st.dataset.tab = t;
  if (st.dataset.mid !== m) st.dataset.mid = m;
  for (const b of document.querySelectorAll('#stage-tabs [data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  document.querySelector('.forge-side .mid-go').hidden = !dojoOpen;
}
$('stage-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  if (tab === '2') mid = 'forge';
  if (tab === '3') mid = 'dojo';
  render(performance.now());
});
for (const b of document.querySelectorAll('.mid-go')) {
  b.addEventListener('click', () => {
    mid = b.dataset.mid;
    tab = mid === 'dojo' ? '3' : '2';
    render(performance.now());
  });
}

const forgeUI = createForgeUI({ get: () => state, set: (s) => { state = s; }, log });
const dojoUI = createDojoUI({ get: () => state, set: (s) => { state = s; }, log });
const autoUI = createAutoUI({ get: () => state, set: (s) => { state = s; }, log });

$('version').textContent = APP_VERSION;
$('speed-note').textContent = (SPEED !== 1 ? `　速さ ×${SPEED}` : '') + (TEST ? `　試す：${TEST}` : '');
render(performance.now()); // 最初のコマを待たずに一度描く
startLoop();
