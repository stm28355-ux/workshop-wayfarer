// 冒険（オートラン）と盤と出口をまとめたゲームの状態。純粋な関数だけ（乱数なし）。
// advance(state, 刻み) で時間を進め、moveItem・feed・chooseRegion が人の手。
// どれも新しい状態を返し、元の状態は変えない。

import { TICKS_PER_SEC, HERO, PREP, BOARD, REGIONS } from '../data/balance.js';
import { rankValue } from './rank.js';
import { createBoard, place, move, takeAt } from './board.js';
import { levelStats, gainXp } from './hero.js';

const ATTACK_TICKS = TICKS_PER_SEC; // 攻撃は1秒に1回
const REGEN_TICKS = Math.round(TICKS_PER_SEC / HERO.regenPerSec);

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
    drop: r.drops[i % r.drops.length],
  };
}

// ボスの落とし物：その地域の最初の落とし物の2つ上のランク。
export function bossDrop(regionId) {
  const d = region(regionId).drops[0];
  return { kind: d.kind, rank: d.rank + 2 };
}

function newRun(state, regionId) {
  const r = region(regionId);
  return {
    region: regionId,
    step: 0,
    prep: PREP.base,
    hp: levelStats(state.hero.level).maxHp,
    regenCd: REGEN_TICKS,
    enemyIndex: 0,
    nextEnemyAt: r.gap,
    fight: null,
  };
}

export function createGame() {
  const state = {
    version: 1,
    tick: 0,
    hero: { level: 1, xp: 0 },
    open: { regions: [1], exits: ['prep', 'grow', 'forge'], unlocks: [] },
    cleared: [],
    nextRegion: 1,
    run: null,
    board: createBoard(BOARD.w, BOARD.h),
    stock: { forge: {}, workshop: 0 },
    stats: { departures: 1, picked: 0, overflow: 0, merges: 0, kills: 0, returns: { prep: 0, down: 0, boss: 0 }, firstBoss: {} },
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
  s.run = newRun(s, s.nextRegion);
  s.stats.departures += 1;
  events.push({ type: 'depart', region: s.run.region });
}

function startFight(s, boss) {
  const run = s.run;
  if (boss) {
    const b = region(run.region).boss;
    run.fight = { boss: true, hp: b.hp, maxHp: b.hp, atk: b.atk, heroCd: 1, enemyCd: ATTACK_TICKS };
  } else {
    const e = enemyAt(run.region, run.enemyIndex);
    run.fight = { boss: false, hp: e.hp, maxHp: e.hp, atk: e.atk, heroCd: 1, enemyCd: ATTACK_TICKS };
  }
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

function tickOnce(s, events) {
  s.tick += 1;
  const run = s.run;
  const r = region(run.region);
  const { atk, maxHp } = levelStats(s.hero.level);

  // 支度は毎刻み減る（戦っている間も）。切れたら帰る。
  run.prep -= r.drain;
  if (run.prep <= 0) {
    goHome(s, 'prep', events);
    return;
  }

  if (run.fight) {
    const f = run.fight;
    f.heroCd -= 1;
    if (f.heroCd === 0) {
      f.hp -= atk;
      f.heroCd = ATTACK_TICKS;
      if (f.hp <= 0) {
        winFight(s, events);
        return;
      }
    }
    f.enemyCd -= 1;
    if (f.enemyCd === 0) {
      run.hp -= f.atk;
      f.enemyCd = ATTACK_TICKS;
      if (run.hp <= 0) {
        goHome(s, 'down', events); // 倒れたら支度の残りを失って帰る（判定表 第1回 B6）
        return;
      }
    }
  } else {
    run.step += 1;
    run.regenCd -= 1;
    if (run.regenCd === 0) {
      run.hp = Math.min(maxHp, run.hp + 1);
      run.regenCd = REGEN_TICKS;
    }
    if (run.step >= r.bossAt) startFight(s, true);
    else if (run.step >= run.nextEnemyAt) startFight(s, false);
  }
}

// 時間を ticks 刻み進める。{ state, events } を返す。
export function advance(state, ticks) {
  const s = clone(state);
  const events = [];
  for (let i = 0; i < ticks; i++) tickOnce(s, events);
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
    const before = s.hero.level;
    s.hero = gainXp(s.hero, value);
    // レベルが上がったぶん、今の HP も伸ばす
    s.run.hp += levelStats(s.hero.level).maxHp - levelStats(before).maxHp;
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
