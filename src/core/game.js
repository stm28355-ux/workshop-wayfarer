// 冒険（オートラン）と盤と出口と打ち分けをまとめたゲームの状態。純粋な関数だけ（乱数なし）。
// advance(state, 刻み) で時間を進め、moveItem・feed・chooseRegion・forge*・equipItem・buyUpgrade が人の手。
// どれも新しい状態を返し、元の状態は変えない。

import { TICKS_PER_SEC, HERO, PREP, BOARD, REGIONS, MERGE_CRAFTER, WORKSHOP, SPLIT, EXITS } from '../data/balance.js';
import { tickDisciple, shapesFromLevels } from './dojo.js';
import { GEAR, SLOTS, GEAR_KINDS, FIRE_PER, FORGE_CRAFTER, gearCost, bandOf } from '../data/forge.js';
import { rankValue } from './rank.js';
import { createBoard, place, move, takeAt, widen } from './board.js';
import { gainXp } from './hero.js';
import { heroStats, damageTaken, planOf, applyCraft, itemKey } from './gear.js';
import { crafterMerge } from './crafter.js';
import * as forge from './forge.js';
import { activeCards, levelsOf, recastTicks, newLine, heroAct, enemyAct, tickFight, slotCount } from './lineup.js';
import { KINDS } from '../data/balance.js';

export const STATE_VERSION = 5;

// 前の版の保存を今の形にする（版2 → 3：道場を足した）。読めなければ null。
export function migrate(state) {
  if (!state) return null;
  if (state.version === 2) {
    state.dojo = { nodes: {}, scroll: null, drawn: 0 };
    state.version = 3;
  }
  if (state.version === 3) {
    // 版3 → 4：技の並びを足した
    state.lineup = { byRegion: {} };
    if (state.run) state.run.line = newLine();
    state.version = 4;
  }
  if (state.version === 4) {
    // 版4 → 5：門下生・振り分け・帳簿の数（判定表 第11回）
    state.workshop.disciple = 0;
    state.dojo.shapes = shapesFromLevels(state);
    state.dojo.disciple = { branch: 'all', node: null, cd: 0 };
    state.split = newSplit();
    state.crafter.wait5 = false;
    state.stats.fed = newFed();
    state.stats.byRegion = {};
    state.version = 5;
  }
  return state.version === STATE_VERSION ? state : null;
}

export function region(id) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) throw new RangeError(`地域がない: ${id}`);
  return r;
}

// 道の i 体目（0から）の敵。
export function enemyAt(regionId, i) {
  const r = region(regionId);
  return {
    hp: r.enemy.hp + Math.floor(r.enemy.hpStep * i),
    atk: r.enemy.atk + Math.floor(i / r.enemy.atkEvery),
    hits: r.enemy.hits ?? 1,
    traits: r.enemy.traits ?? null,
    drop: r.drops[i % r.drops.length],
  };
}

// ボスの落とし物：その地域の最初の落とし物の2つ上のランク。
export function bossDrop(regionId) {
  const d = region(regionId).drops[0];
  return { kind: d.kind, rank: d.rank + 2 };
}

// 出発のときの支度（baseSec 秒ぶん、その地域の減りで）。
export function basePrep(regionId) {
  return PREP.baseSec * TICKS_PER_SEC * region(regionId).drain;
}

function newRun(state, regionId, wait = 0) {
  const r = region(regionId);
  return {
    region: regionId,
    step: 0,
    prep: basePrep(regionId),
    hp: heroStats(state).maxHp,
    regenCd: HERO.regenEvery,
    enemyIndex: 0,
    nextEnemyAt: r.gap,
    fight: null,
    wait,
    line: newLine(), // 技の並びは出発ごとに頭から（判定表 第9回 A1）
  };
}

export function createGame() {
  const state = {
    version: STATE_VERSION,
    tick: 0,
    hero: { level: 1, xp: 0 },
    open: { regions: [1], exits: ['prep', 'grow', 'forge'], unlocks: [] },
    cleared: [],
    nextRegion: 1,
    run: null,
    board: createBoard(BOARD.w, BOARD.h),
    stock: { forge: {}, workshop: 0 },
    gear: { items: {}, equip: { weapon: null, armor: null } },
    forge: { session: null, fuel: null, best: {}, auto: true, cd: FORGE_CRAFTER.everyTicks, next: 0 },
    crafter: { cd: MERGE_CRAFTER.everyTicks, wait5: false },
    workshop: { arm: 0, speed: 0, widen: 0, disciple: 0 },
    dojo: { nodes: {}, scroll: null, drawn: 0, shapes: [], disciple: { branch: 'all', node: null, cd: 0 } },
    split: newSplit(),
    lineup: { byRegion: {} },
    stats: {
      departures: 1, picked: 0, overflow: 0, merges: 0, crafterMerges: 0, kills: 0, crafted: 0, autoCrafted: 0, crits: 0,
      returns: { prep: 0, down: 0, boss: 0 }, firstBoss: {},
      fed: newFed(), byRegion: { 1: { departs: 1, prep: 0, down: 0, boss: 0 } }, discipleScrolls: 0,
    },
  };
  state.run = newRun(state, 1);
  return state;
}

function clone(state) {
  return structuredClone(state);
}

function itemValue(item) {
  return rankValue(item.rank);
}

export function isOpen(state, key) {
  return state.open.unlocks.includes(key);
}

// 拾った物を盤に出す。空きがなければあふれとして支度に入る（判定表 第1回 C2）。
function pickUp(s, item, events) {
  s.stats.picked += 1;
  const r = place(s.board, item);
  if (r.index === null) {
    s.stats.overflow += 1;
    s.run.prep += itemValue(item) * PREP.perValue;
    events.push({ type: 'overflow', item });
  } else {
    s.board = r.board;
    events.push({ type: 'pickup', item, index: r.index });
  }
}

function applyUnlock(s, key, events) {
  const [what, arg] = key.split(':');
  if (what === 'region') {
    const id = Number(arg);
    if (!s.open.regions.includes(id)) s.open.regions.push(id);
  } else if (what === 'exit') {
    if (!s.open.exits.includes(arg)) s.open.exits.push(arg);
  } else if (!s.open.unlocks.includes(key)) {
    s.open.unlocks.push(key);
  }
  events.push({ type: 'unlock', key });
}

// 帳簿の数（判定表 第11回 C1）：出口ごとに入れた価値（手・振り分け）と、直近の分ごと。
function newFed() {
  return { hand: { prep: 0, grow: 0, forge: 0, workshop: 0 }, split: { prep: 0, grow: 0, forge: 0, workshop: 0 }, minute: -1, now: null, past: [] };
}
function noteFed(s, exit, value, by) {
  if (!s.stats.fed) s.stats.fed = newFed();
  const f = s.stats.fed;
  f[by][exit] += value;
  const m = Math.floor(s.tick / (60 * TICKS_PER_SEC));
  if (f.minute !== m) {
    if (f.now) f.past = [...f.past, { minute: f.minute, ...f.now }].slice(-5);
    f.minute = m;
    f.now = { prep: 0, grow: 0, forge: 0, workshop: 0 };
  }
  f.now[exit] += value;
}
function regionStats(s, id) {
  if (!s.stats.byRegion) s.stats.byRegion = {};
  if (!s.stats.byRegion[id]) s.stats.byRegion[id] = { departs: 0, prep: 0, down: 0, boss: 0 };
  return s.stats.byRegion[id];
}

function goHome(s, reason, events) {
  s.stats.returns[reason] += 1;
  regionStats(s, s.run.region)[reason] += 1;
  events.push({ type: 'return', reason, region: s.run.region, step: s.run.step });
  s.run = newRun(s, s.nextRegion, PREP.waitTicks);
  s.stats.departures += 1;
  regionStats(s, s.run.region).departs += 1;
  events.push({ type: 'depart', region: s.run.region });
}

function startFight(s, boss) {
  const run = s.run;
  const e = boss ? { ...region(run.region).boss, traits: region(run.region).boss.traits ?? region(run.region).enemy.traits ?? null } : enemyAt(run.region, run.enemyIndex);
  const hits = e.hits ?? 1;
  const enemyTicks = Math.max(1, Math.round(TICKS_PER_SEC / hits));
  run.fight = { boss, hp: e.hp, maxHp: e.hp, atk: e.atk, enemyTicks, heroCd: 1, enemyCd: enemyTicks, breakUntil: -1, shell: 0, shieldHits: 0 };
  // 敵の性質（判定表 第9回 C2）：殻・盾・回復
  const t = e.traits;
  if (t?.shell) run.fight.shell = t.shell;
  if (t?.shield) Object.assign(run.fight, { shieldHits: t.shield, shieldMax: t.shield, shieldEvery: t.shieldSec * TICKS_PER_SEC, shieldCd: t.shieldSec * TICKS_PER_SEC });
  if (t?.regenPct) run.fight.regen = (e.hp * t.regenPct) / TICKS_PER_SEC;
}

function winFight(s, events) {
  const run = s.run;
  const { boss } = run.fight;
  run.fight = null;
  s.stats.kills += 1;
  if (boss) {
    events.push({ type: 'boss', region: run.region });
    pickUp(s, bossDrop(run.region), events);
    if (!s.cleared.includes(run.region)) {
      s.cleared.push(run.region);
      // 試すときの記録（判定表 第2回）：初めて倒した刻みとレベル
      // 帳簿（判定表 第11回 C2）で予定表と並べるため、武器と防具の格・並びの枠も残す
      const tierOf = (slot) => (s.gear.equip[slot] ? s.gear.items[s.gear.equip[slot]].tier : 0);
      s.stats.firstBoss = { ...(s.stats.firstBoss ?? {}), [run.region]: { tick: s.tick, level: s.hero.level, weapon: tierOf('weapon'), armor: tierOf('armor'), slots: slotCount(s) } };
      for (const key of region(run.region).unlocks) applyUnlock(s, key, events);
    }
    goHome(s, 'boss', events);
    return;
  }
  const e = enemyAt(run.region, run.enemyIndex);
  events.push({ type: 'kill', index: run.enemyIndex });
  pickUp(s, e.drop, events);
  run.enemyIndex += 1;
  run.nextEnemyAt = run.step + region(run.region).gap;
}

// マージの職人の間（刻み）と合わせられるランク。
export function mergeCrafterTicks(state) {
  return Math.max(1, Math.round(MERGE_CRAFTER.everyTicks * MERGE_CRAFTER.speedMult ** state.workshop.speed));
}
export function mergeCrafterRank(state) {
  return MERGE_CRAFTER.rank + state.workshop.arm;
}

function tickCrafters(s, events, locked) {
  if (isOpen(s, 'crafter:merge')) {
    s.crafter.cd -= 1;
    if (s.crafter.cd <= 0) {
      s.crafter.cd = mergeCrafterTicks(s);
      const r = crafterMerge(s.board, mergeCrafterRank(s), locked, { wait5: s.crafter.wait5, waitEmpty: MERGE_CRAFTER.waitEmpty });
      if (r.merged) {
        s.board = r.board;
        s.stats.crafterMerges += 1;
        events.push({ type: 'crafterMerge', merged: r.merged });
      }
    }
  }
  if (isOpen(s, 'crafter:forge') && s.forge.auto && !s.forge.session) {
    s.forge.cd -= 1;
    if (s.forge.cd <= 0) {
      s.forge.cd = FORGE_CRAFTER.everyTicks;
      const r = autoCraft(s);
      if (r) events.push(r);
    }
  }
  if (isOpen(s, 'disciple')) tickDisciple(s, events);
  tickSplit(s, events, locked);
}

function tickOnce(s, events, locked) {
  s.tick += 1;
  tickCrafters(s, events, locked);
  const run = s.run;
  if (run.wait > 0) {
    // 帰ってから次の出発までの待ち（判定表 第4回 C4）
    run.wait -= 1;
    return;
  }
  const r = region(run.region);
  const hero = heroStats(s);

  // 支度は毎刻み減る（戦っている間も）。切れたら帰る。
  run.prep -= r.drain;
  if (run.prep <= 0) {
    goHome(s, 'prep', events);
    return;
  }

  if (run.fight) {
    // 普通の攻撃の合間に技の並びを使う（判定表 第9回。src/core/lineup.js）
    const f = run.fight;
    if (!run.line) run.line = newLine();
    const cards = activeCards(s, run.region);
    const ctx = { tick: s.tick, hero, cards, levels: levelsOf(s, cards), recast: recastTicks(s), line: run.line, f, run, events: [] };
    tickFight(ctx);
    f.heroCd -= 1;
    if (f.heroCd <= 0) heroAct(ctx);
    if (f.hp > 0) {
      f.enemyCd -= 1;
      if (f.enemyCd <= 0) enemyAct(ctx);
    }
    for (const e of ctx.events) events.push({ ...e, type: 'line', what: e.type });
    if (f.hp <= 0) {
      winFight(s, events);
      return;
    }
    if (run.hp <= 0) {
      goHome(s, 'down', events); // 倒れたら支度の残りを失って帰る（判定表 第1回 B6）
      return;
    }
  } else {
    run.step += HERO.walk;
    run.regenCd -= 1;
    if (run.regenCd <= 0) {
      run.hp = Math.min(hero.maxHp, run.hp + hero.regen);
      run.regenCd = HERO.regenEvery;
    }
    if (run.step >= r.bossAt) startFight(s, true);
    else if (run.step >= run.nextEnemyAt) startFight(s, false);
  }
}

// 時間を ticks 刻み進める。{ state, events } を返す。
// opts.locked：人が選んでいる・ドラッグしている盤のマス（マージの職人は触らない）。
export function advance(state, ticks, opts = {}) {
  const s = clone(state);
  const events = [];
  const locked = opts.locked ?? [];
  for (let i = 0; i < ticks; i++) tickOnce(s, events, locked);
  return { state: s, events };
}

// 盤の物を手で動かす（合わせる）。
export function moveItem(state, from, to) {
  const r = move(state.board, from, to);
  if (r.board === state.board) return { state, merged: null };
  const s = clone(state);
  s.board = r.board;
  if (r.merged) s.stats.merges += 1;
  return { state: s, merged: r.merged };
}

// 盤の物を出口に入れる。開いていない出口や空きマスなら何もしない（ok: false）。
export function feed(state, index, exit) {
  if (!state.open.exits.includes(exit) || !state.board.cells[index]) return { state, ok: false };
  const s = clone(state);
  const r = feedInto(s, index, exit, 'hand');
  return { state: s, ok: true, item: r.item, value: r.value };
}

// 出口に入れる（s をその場で変える）。by：'hand'＝人、'split'＝振り分け。
function feedInto(s, index, exit, by) {
  const { board, item } = takeAt(s.board, index);
  s.board = board;
  const value = itemValue(item);
  if (exit === 'prep') {
    s.run.prep += value * PREP.perValue;
  } else if (exit === 'grow') {
    const before = heroStats(s).maxHp;
    s.hero = gainXp(s.hero, value);
    // レベルが上がったぶん、今の HP も伸ばす
    s.run.hp += heroStats(s).maxHp - before;
  } else if (exit === 'forge') {
    s.stock.forge[item.kind] = (s.stock.forge[item.kind] ?? 0) + value;
  } else if (exit === 'workshop') {
    s.stock.workshop += value;
  }
  noteFed(s, exit, value, by);
  return { item, value };
}

// ───────── 振り分け（判定表 第11回 B：地域5のボスで来る） ─────────
// 「出すランク」以上の物を3秒に1個、入れた価値の合計が割合に一番足りていない出口へ入れる。
// 出せる物がなく盤がいっぱいなら、一番低い物を支度へ。人が選んでいる・ドラッグしている物には触らない。

export function newSplit() {
  return { on: true, ratio: { ...SPLIT.ratio }, minRank: SPLIT.minRank, cd: SPLIT.everyTicks, fed: { prep: 0, grow: 0, forge: 0, workshop: 0 } };
}

// 次に入れる出口（開いていて割合が0でない出口のうち、足りなさが一番大きい所）。
export function splitExit(state, value) {
  const sp = state.split;
  const exits = EXITS.filter((x) => state.open.exits.includes(x) && sp.ratio[x] > 0);
  if (!exits.length) return null;
  const sum = exits.reduce((a, x) => a + sp.ratio[x], 0);
  const total = exits.reduce((a, x) => a + sp.fed[x], 0) + value;
  let best = null;
  for (const x of exits) {
    const lack = (total * sp.ratio[x]) / sum - sp.fed[x];
    if (!best || lack > best.lack + 1e-9) best = { x, lack };
  }
  return best.x;
}

function tickSplit(s, events, locked) {
  const sp = s.split;
  if (!isOpen(s, 'split') || !sp?.on) return;
  sp.cd -= 1;
  if (sp.cd > 0) return;
  sp.cd = SPLIT.everyTicks;
  const skip = new Set(locked);
  const cells = s.board.cells;
  let pick = -1;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (!c || skip.has(i) || c.rank < sp.minRank) continue;
    if (pick < 0 || c.rank > cells[pick].rank) pick = i;
  }
  if (pick >= 0) {
    const exit = splitExit(s, itemValue(cells[pick]));
    if (!exit) return;
    const r = feedInto(s, pick, exit, 'split');
    sp.fed[exit] += r.value;
    events.push({ type: 'split', exit, item: r.item, value: r.value });
    return;
  }
  if (cells.some((c) => !c)) return;
  // 盤がいっぱいで出せる物がない：一番低い物を支度へ（B4）
  let low = -1;
  for (let i = 0; i < cells.length; i++) {
    if (skip.has(i) || !cells[i]) continue;
    if (low < 0 || itemValue(cells[i]) < itemValue(cells[low])) low = i;
  }
  if (low < 0 || !s.open.exits.includes('prep')) return;
  const r = feedInto(s, low, 'prep', 'split');
  events.push({ type: 'split', exit: 'prep', item: r.item, value: r.value, full: true });
}

// 振り分けの設定を変える。{ on, ratio: { 出口: 0〜10 }, minRank }。割合を変えたら入れた合計を数え直す。
export function setSplit(state, patch) {
  const s = clone(state);
  if (!s.split) s.split = newSplit();
  const sp = s.split;
  if ('on' in patch) sp.on = !!patch.on;
  if (patch.minRank !== undefined) sp.minRank = Math.max(1, Math.min(SPLIT.maxRank, Math.round(patch.minRank)));
  if (patch.ratio) {
    const next = { ...sp.ratio };
    for (const [x, v] of Object.entries(patch.ratio)) if (x in next) next[x] = Math.max(0, Math.min(10, Math.round(v)));
    const sum = Object.values(next).reduce((a, v) => a + v, 0);
    if (sum !== 10) return { state, ok: false, reason: '割合は合わせて100%' };
    sp.ratio = next;
    sp.fed = { prep: 0, grow: 0, forge: 0, workshop: 0 };
  }
  return { state: s, ok: true };
}

// 割合を1つの出口で ±10% 動かす（ほかの出口から順に引く・足す）。
export function nudgeSplit(state, exit, dir) {
  const sp = state.split ?? newSplit();
  const r = { ...sp.ratio };
  if (!(exit in r)) return { state, ok: false };
  if (dir > 0) {
    if (r[exit] >= 10) return { state, ok: false };
    // 一番多い出口から1つ引く
    const from = EXITS.filter((x) => x !== exit && r[x] > 0).sort((a, b) => r[b] - r[a])[0];
    if (!from) return { state, ok: false };
    r[from] -= 1;
    r[exit] += 1;
  } else {
    if (r[exit] <= 0) return { state, ok: false };
    // 一番少ない開いた出口へ1つ足す
    const to = EXITS.filter((x) => x !== exit && state.open.exits.includes(x)).sort((a, b) => r[a] - r[b])[0] ?? EXITS.find((x) => x !== exit);
    r[exit] -= 1;
    r[to] += 1;
  }
  return setSplit(state, { ratio: r });
}

// マージの職人の「5個を待つ」（判定表 第11回 D6 の一言）。
export function setCrafterWait(state, on) {
  const s = clone(state);
  s.crafter.wait5 = !!on;
  return { state: s, ok: true };
}


// 今の出発をやめて、次の地域から出発し直す（試すときと道具で使う。待ちなし）。
export function restartRun(state) {
  const s = clone(state);
  s.run = newRun(s, s.nextRegion, 0);
  s.stats.departures += 1;
  regionStats(s, s.run.region).departs += 1;
  return s;
}

// 次に出発する地域を選ぶ（帰ったときから効く）。
export function chooseRegion(state, id) {
  if (!state.open.regions.includes(id)) return { state, ok: false };
  const s = clone(state);
  s.nextRegion = id;
  return { state: s, ok: true };
}

// ───────── 打ち分け（段2） ─────────

// 素材 kind で作れる部類。
export function slotsOf(kind) {
  const def = GEAR_KINDS[kind];
  if (!def) return [];
  return Object.keys(SLOTS).filter((slot) => def[slot]);
}

// 燃料 { 欠片の種類: 価値 } から集中力と火を足す回数。
export function fuelPower(fuel) {
  let conc = 0;
  for (const [kind, v] of Object.entries(fuel ?? {})) {
    if (KINDS[kind]?.group !== 'shard' || !(v > 0)) continue;
    conc += v;
  }
  return { conc, fire: Math.floor((fuel?.fire ?? 0) / FIRE_PER) };
}

// 打つ前の見通し。ok でなければ reason に理由。
export function forgeCheck(state, { kind, slot, tier, fuel }) {
  if (!isOpen(state, 'stage:forge')) return { ok: false, reason: '打ち分けは地域1のボスを倒すと開く' };
  if (state.forge.session) return { ok: false, reason: '打っている途中' };
  if (!slotsOf(kind).includes(slot)) return { ok: false, reason: 'この素材では作れない' };
  if (!(tier >= 1) || tier > GEAR.tierMax || !bandOf(tier)) return { ok: false, reason: `格${GEAR.tierMax + 1}からは次の工程で` };
  const plan = planOf(state.gear.items, kind, slot, tier);
  if (plan.mode === 'full') return { ok: false, reason: `格${tier}の加算は${GEAR.addCap}回使い切った`, plan };
  const cost = gearCost(tier);
  const need = { [kind]: cost };
  for (const [k, v] of Object.entries(fuel ?? {})) if (v > 0) need[k] = (need[k] ?? 0) + v;
  for (const [k, v] of Object.entries(need)) {
    if ((state.stock.forge[k] ?? 0) < v) return { ok: false, reason: `${KINDS[k].name}が足りない（${v}要る）`, plan, cost };
  }
  const { conc, fire } = fuelPower(fuel);
  const cap = bandOf(tier).cap;
  if (conc < 1) return { ok: false, reason: '燃料（欠片）を入れる', plan, cost };
  if (conc > cap) return { ok: false, reason: `集中力は${cap}まで`, plan, cost };
  return { ok: true, plan, cost, conc, fire, need };
}

export function forgeStart(state, args) {
  const c = forgeCheck(state, args);
  if (!c.ok) return { state, ok: false, reason: c.reason };
  const s = clone(state);
  for (const [k, v] of Object.entries(c.need)) s.stock.forge[k] -= v;
  const fuel = {};
  for (const [k, v] of Object.entries(args.fuel)) if (v > 0) fuel[k] = v;
  s.forge.session = forge.newSession({ kind: args.kind, slot: args.slot, tier: args.tier, conc: c.conc, fire: c.fire });
  s.forge.fuel = fuel;
  return { state: s, ok: true };
}

function finishSession(s, auto = false) {
  const sess = s.forge.session;
  const sc = forge.score(sess);
  const r = applyCraft(s.gear.items, sess.kind, sess.slot, sess.tier, sc.ratio);
  s.gear.items = r.items;
  const key = itemKey(sess.kind, sess.slot);
  if (sess.slot !== 'accessory' && !s.gear.equip[sess.slot]) s.gear.equip[sess.slot] = key;
  const bestKey = `${sess.kind}:${sess.slot}:${sess.band}`;
  const best = s.forge.best[bestKey];
  if (!auto && (!best || sc.sum > best.sum)) {
    s.forge.best[bestKey] = { sum: sc.sum, max: sc.max, ratio: sc.ratio, crit: sc.crit, log: sess.log, fuel: s.forge.fuel };
  }
  s.forge.session = null;
  s.forge.fuel = null;
  s.stats.crafted += 1;
  if (sc.crit && !auto) s.stats.crits = (s.stats.crits ?? 0) + 1;
  if (auto) s.stats.autoCrafted += 1;
  return { type: 'craft', auto, kind: sess.kind, slot: sess.slot, tier: sess.tier, mode: r.plan.mode, ...sc };
}

function afterHand(s, next) {
  s.forge.session = next;
  if (forge.isOver(next)) return { state: s, ok: true, done: finishSession(s) };
  return { state: s, ok: true };
}

export function forgeStrike(state, id, cell) {
  const sess = state.forge.session;
  if (!sess) return { state, ok: false };
  const next = forge.strike(sess, id, cell);
  if (!next) return { state, ok: false };
  return afterHand(clone(state), next);
}

export function forgeFire(state) {
  const sess = state.forge.session;
  if (!sess) return { state, ok: false };
  const next = forge.addFire(sess);
  if (!next) return { state, ok: false };
  return afterHand(clone(state), next);
}

export function forgeFinish(state) {
  if (!state.forge.session) return { state, ok: false };
  const s = clone(state);
  return { state: s, ok: true, done: finishSession(s) };
}

// 打ち分けの職人：装備中の武器・防具と、持っているアクセサリーを順に、手で出した一番の手順で打つ。
// 格上げできれば格上げ、できなければ加算の残る一番上の格。素材や燃料が足りなければ次の物へ。
function autoCraft(s) {
  const keys = [s.gear.equip.weapon, s.gear.equip.armor, ...Object.keys(s.gear.items).filter((k) => k.endsWith(':accessory'))].filter(Boolean);
  for (let n = 0; n < keys.length; n++) {
    const key = keys[(s.forge.next + n) % keys.length];
    const item = s.gear.items[key];
    const tiers = [];
    if (item.tier < GEAR.tierMax) tiers.push(item.tier + 1);
    for (let t = item.tier; t >= 1; t--) tiers.push(t);
    for (const tier of tiers) {
      const band = bandOf(tier);
      const best = band && s.forge.best[`${item.kind}:${item.slot}:${band.id}`];
      if (!best) continue;
      const c = forgeCheck(s, { kind: item.kind, slot: item.slot, tier, fuel: best.fuel });
      if (!c.ok) continue;
      const start = forge.newSession({ kind: item.kind, slot: item.slot, tier, conc: c.conc, fire: c.fire });
      const end = forge.replay(start, best.log);
      if (!end) continue;
      for (const [k, v] of Object.entries(c.need)) s.stock.forge[k] -= v;
      s.forge.session = end;
      s.forge.fuel = best.fuel;
      s.forge.next = (s.forge.next + n + 1) % Math.max(1, keys.length);
      return finishSession(s, true);
    }
  }
  return null;
}

export function setForgeAuto(state, on) {
  const s = clone(state);
  s.forge.auto = !!on;
  return { state: s, ok: true };
}

// 装備を付け替える（武器と防具。アクセサリーは持っている物が全部効く）。
export function equipItem(state, slot, key) {
  if (slot === 'accessory' || !state.gear.items[key] || state.gear.items[key].slot !== slot) return { state, ok: false };
  const s = clone(state);
  const before = heroStats(s).maxHp;
  s.gear.equip[slot] = key;
  // 最大 HP が変わったら今の HP も同じだけ動かす（1は残す）
  s.run.hp = Math.max(1, s.run.hp + heroStats(s).maxHp - before);
  return { state: s, ok: true };
}

// ───────── 工房（4つ目の出口） ─────────

export function upgradeCost(state, what) {
  const w = WORKSHOP[what];
  return w.base * w.ratio ** state.workshop[what];
}

// 盤を広げた先の大きさ（列と段を交互に。7×6まで）。広げられなければ null。
export function widenTo(board) {
  const canW = board.w < BOARD.maxW;
  const canH = board.h < BOARD.maxH;
  if (!canW && !canH) return null;
  const preferW = board.w - BOARD.w <= board.h - BOARD.h;
  if ((preferW && canW) || !canH) return { w: board.w + 1, h: board.h };
  return { w: board.w, h: board.h + 1 };
}

export function upgradeCheck(state, what) {
  if (!WORKSHOP[what]) return { ok: false, reason: 'ない' };
  if (!state.open.exits.includes('workshop')) return { ok: false, reason: '工房はまだ開いていない' };
  if ((what === 'arm' || what === 'speed') && !isOpen(state, 'crafter:merge')) return { ok: false, reason: 'マージの職人は地域2のボスで来る' };
  if (what === 'disciple' && !isOpen(state, 'disciple')) return { ok: false, reason: '門下生は地域4のボスで来る' };
  if (what === 'widen' && !widenTo(state.board)) return { ok: false, reason: '盤はもう一番広い' };
  const cost = upgradeCost(state, what);
  if (state.stock.workshop < cost) return { ok: false, reason: `工房の価値が足りない（${cost}要る）`, cost };
  return { ok: true, cost };
}

export function buyUpgrade(state, what) {
  const c = upgradeCheck(state, what);
  if (!c.ok) return { state, ok: false, reason: c.reason };
  const s = clone(state);
  s.stock.workshop -= c.cost;
  s.workshop[what] += 1;
  if (what === 'widen') {
    const to = widenTo(s.board);
    s.board = widen(s.board, to.w, to.h);
  }
  return { state: s, ok: true };
}
