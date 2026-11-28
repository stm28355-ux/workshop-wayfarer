// 装備（持ち物・格・加算）と勇者の強さ。純粋な関数だけ。
// 持ち物は「種類×部類」ごとに1つ（判定表 第4回 A6）。装備は武器と防具が1つずつ、アクセサリーは持っている物が全部効く。
// 物は { kind, slot, tier, q, adds: { 格: 回数 }, extra }。主の数値＝ 格の基本 × q ＋ extra。

import { GEAR, GEAR_KINDS, GEAR_BASE, STAT_CAPS } from '../data/forge.js';
import { HERO, LEVEL } from '../data/balance.js';
import { nodeStats } from './dojo.js';

export function itemKey(kind, slot) {
  return `${kind}:${slot}`;
}

export function statOf(kind, slot) {
  const def = GEAR_KINDS[kind]?.[slot];
  if (!def) return null;
  return slot === 'weapon' ? 'weapon' : def.stat;
}

// 格 tier の基本（出来100%）。
export function baseOf(stat, tier) {
  return GEAR_BASE[stat] * GEAR.baseRatio ** (tier - 1);
}

export function mainValue(item) {
  return baseOf(statOf(item.kind, item.slot), item.tier) * item.q + item.extra;
}

// 打つ前の見通し：mode は new（初めて）・up（格上げ）・add（加算）・full（その格の加算は使い切った）。
export function planOf(items, kind, slot, tier) {
  const item = items[itemKey(kind, slot)];
  if (!item) return { mode: 'new' };
  if (tier > item.tier) return { mode: 'up', from: item.tier };
  const used = item.adds[tier] ?? 0;
  if (used >= GEAR.addCap) return { mode: 'full', used };
  return { mode: 'add', used, left: GEAR.addCap - used };
}

// 出来 ratio で打ち上がった物を持ち物に入れる。新しい items を返す。
export function applyCraft(items, kind, slot, tier, ratio) {
  const key = itemKey(kind, slot);
  const plan = planOf(items, kind, slot, tier);
  const next = { ...items };
  const old = items[key];
  if (plan.mode === 'new') {
    next[key] = { kind, slot, tier, q: ratio, adds: {}, extra: 0 };
  } else if (plan.mode === 'up') {
    next[key] = { ...old, tier, q: ratio, adds: { ...old.adds } };
  } else if (plan.mode === 'add') {
    const add = baseOf(statOf(kind, slot), tier) * GEAR.addRate * ratio;
    next[key] = { ...old, adds: { ...old.adds, [tier]: plan.used + 1 }, extra: old.extra + add };
  } else {
    return { items, plan };
  }
  return { items: next, plan };
}

export function levelMult(level) {
  return LEVEL.mult ** (level - 1);
}

// 勇者の強さ（レベル×装備）。atk は1回の攻撃、attackTicks は攻撃の間（刻み）、guard は1回に受けるダメージから引く数。
export function heroStats(state) {
  const m = levelMult(state.hero.level);
  const items = state.gear?.items ?? {};
  const equip = state.gear?.equip ?? {};
  let atkAdd = 0;
  let attackTicks = HERO.attackTicks;
  const w = items[equip.weapon];
  if (w) {
    const def = GEAR_KINDS[w.kind].weapon;
    atkAdd = mainValue(w) * def.atk;
    attackTicks = def.ticks;
  }
  let hpAdd = 0;
  let guard = 0;
  let wardPct = 0;
  const a = items[equip.armor];
  if (a) {
    const st = statOf(a.kind, a.slot);
    if (st === 'hp') hpAdd = mainValue(a);
    else if (st === 'ward') wardPct += mainValue(a); // 衣：受けるダメージ −%（判定表 第16回 C3）
    else guard = mainValue(a) * m;
  }
  let atkPct = 0;
  let regenPct = 0;
  let speedPct = 0;
  let castPct = 0;
  for (const it of Object.values(items)) {
    if (it.slot !== 'accessory') continue;
    const st = statOf(it.kind, it.slot);
    if (st === 'atk') atkPct += mainValue(it);
    else if (st === 'regen') regenPct += mainValue(it);
    else if (st === 'ward') wardPct += mainValue(it);
    else if (st === 'speed') speedPct += mainValue(it);
    else if (st === 'cast') castPct += mainValue(it);
  }
  // 道場の小さい節（判定表 第6回 D2）。割合には上限（第16回 C5）
  const tree = nodeStats(state);
  const speed = Math.min(STAT_CAPS.speed, tree.speed + speedPct);
  const ward = Math.min(STAT_CAPS.ward, tree.taken + wardPct);
  const cast = Math.min(STAT_CAPS.cast, castPct);
  return {
    atk: (HERO.baseAtk + atkAdd) * m * (1 + atkPct + tree.atk),
    maxHp: (HERO.baseHp + hpAdd) * m * (1 + tree.hp),
    attackTicks: attackTicks / (1 + speed),
    guard,
    taken: 1 - ward,
    regen: HERO.regen * m * (1 + regenPct + tree.regen),
    cast: 1 - cast, // 札の時間の倍率（雷の耳飾り）
    atkPct,
    regenPct,
    wardPct,
    speedPct,
    castPct,
    tree,
  };
}

// 攻撃の間（秒）を見せるとき：0.01秒の単位で切り上げる（判定表 第10回の一言）。
export function intervalText(ticks, perSec = 10) {
  const sec = Math.ceil((ticks / perSec) * 100 - 1e-9) / 100;
  return String(sec);
}

// 受けるダメージ：盾で引く。どれだけ引いても元の2割は通る。
export function damageTaken(atk, guard) {
  return Math.max(atk * 0.2, atk - guard);
}
