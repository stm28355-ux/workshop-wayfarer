// 冒険（オートラン）と盤と出口と打ち分けをまとめたゲームの状態。純粋な関数だけ（乱数なし）。
// advance(state, 刻み) で時間を進め、moveItem・feed・chooseRegion・forge*・equipItem・buyUpgrade が人の手。
// どれも新しい状態を返し、元の状態は変えない。

import { TICKS_PER_SEC, HERO, PREP, BOARD, REGIONS, MERGE_CRAFTER, WORKSHOP } from '../data/balance.js';
import { GEAR, SLOTS, GEAR_KINDS, FIRE_PER, FORGE_CRAFTER, gearCost, bandOf } from '../data/forge.js';
import { rankValue } from './rank.js';
import { createBoard, place, move, takeAt, widen } from './board.js';
import { gainXp } from './hero.js';
import { heroStats, damageTaken, planOf, applyCraft, itemKey } from './gear.js';
import { crafterMerge } from './crafter.js';
import * as forge from './forge.js';
import { KINDS } from '../data/balance.js';

export const STATE_VERSION = 2;

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
    crafter: { cd: MERGE_CRAFTER.everyTicks },
    workshop: { arm: 0, speed: 0, widen: 0 },
    stats: {
      departures: 1, picked: 0, overflow: 0, merges: 0, crafterMerges: 0, kills: 0, crafted: 0, autoCrafted: 0, crits: 0,
      returns: { prep: 0, down: 0, boss: 0 }, firstBoss: {},
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

function goHome(s, reason, events) {
  s.stats.returns[reason] += 1;
  events.push({ type: 'return', reason, region: s.run.region, step: s.run.step });
  s.run = newRun(s, s.nextRegion, PREP.waitTicks);
  s.stats.departures += 1;
  events.push({ type: 'depart', region: s.run.region });
}

function startFight(s, boss) {
  const run = s.run;
  const e = boss ? region(run.region).boss : enemyAt(run.region, run.enemyIndex);
  const hits = e.hits ?? 1;
  const enemyTicks = Math.max(1, Math.round(TICKS_PER_SEC / hits));
  run.fight = { boss, hp: e.hp, maxHp: e.hp, atk: e.atk, enemyTicks, heroCd: 1, enemyCd: enemyTicks };
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
      s.stats.firstBoss = { ...(s.stats.firstBoss ?? {}), [run.region]: { tick: s.tick, level: s.hero.level } };
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
      const r = crafterMerge(s.board, mergeCrafterRank(s), locked);
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
    const f = run.fight;
    f.heroCd -= 1;
    if (f.heroCd <= 0) {
      f.hp -= hero.atk;
      f.heroCd = hero.attackTicks;
      if (f.hp <= 0) {
        winFight(s, events);
        return;
      }
    }
    f.enemyCd -= 1;
    if (f.enemyCd <= 0) {
      run.hp -= damageTaken(f.atk, hero.guard);
      f.enemyCd = f.enemyTicks;
      if (run.hp <= 0) {
        goHome(s, 'down', events); // 倒れたら支度の残りを失って帰る（判定表 第1回 B6）
        return;
      }
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
  return { state: s, ok: true, item, value };
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
