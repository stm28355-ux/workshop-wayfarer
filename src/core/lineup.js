// 技の並び（判定表 第9回）。純粋な関数だけ。
// 普通の攻撃は今のまま続き、札はその合間に左から順に使う。最後の札の後は積み直し（武器の秒数）で、その間も普通の攻撃。
// 条件は合わなければ次の1枚を飛ばす（時間を使わない）。修飾はたまって次の技に掛かり、頭に戻っても消えない。
// 並びの進み（line）は出発ごとに頭から。歩いている間は止まり、次の敵で続きを使う。
// 戦いの1刻みの手（heroAct・enemyAct・tickFight）は、ゲームと木人で同じ物を使う。

import { CARDS, LINEUP, STATES, SHELL_MIN, ELEMENT_STATES as ES, BLUNT } from '../data/cards.js';
import { ALL_NODES } from '../data/schools.js';
import { GEAR_KINDS } from '../data/forge.js';
import { TICKS_PER_SEC } from '../data/balance.js';
import { levelOf } from './dojo.js';
import { heroStats, damageTaken } from './gear.js';

// ───────── 札と枠 ─────────
export function cardOpen(state, id) {
  const c = CARDS[id];
  if (!c) return false;
  if (c.opens) return state.open.unlocks.includes(c.opens);
  return levelOf(state, c.node) >= 1;
}

export function cardLevel(state, id) {
  const c = CARDS[id];
  return c?.node ? Math.max(1, levelOf(state, c.node)) : 1;
}

export function availableCards(state) {
  return Object.keys(CARDS).filter((id) => cardOpen(state, id));
}

// 枠の数：3から、技・札・奥義の節が 3/5 になるたびに ＋1（上限10）。
export function slotCount(state) {
  const extra = ALL_NODES.filter((n) => ['tech', 'card', 'secret'].includes(n.kind) && levelOf(state, n.id) >= LINEUP.slotLevel).length;
  return Math.min(LINEUP.maxSlots, LINEUP.baseSlots + extra);
}

// 地域の並び。まだない地域は一つ前の地域の並びを使う（判定表 第9回 A6）。
export function lineupFor(state, regionId) {
  const by = state.lineup?.byRegion ?? {};
  for (let r = regionId; r >= 1; r--) if (by[r]) return by[r];
  return [];
}

// 実際に使う札（使えない札を除き、枠の数まで）。
export function activeCards(state, regionId) {
  return lineupFor(state, regionId).filter((id) => cardOpen(state, id)).slice(0, slotCount(state));
}

export function setLineup(state, regionId, cards) {
  const list = cards.filter((id) => CARDS[id]).slice(0, slotCount(state));
  const s = structuredClone(state);
  if (!s.lineup) s.lineup = { byRegion: {} };
  s.lineup.byRegion[regionId] = list;
  return { state: s, ok: true };
}

export function newLine() {
  return { pos: 0, recast: 0, mods: [], dodge: 0, parry: 0, stanceUntil: -1, focusUntil: -1, counter: 0, chase: false, free: false };
}

// 積み直しの刻み（装備中の武器。素手は3秒）。
export function recastTicks(state) {
  const w = state.gear?.items?.[state.gear?.equip?.weapon];
  const sec = w ? GEAR_KINDS[w.kind].weapon.recast : 3;
  return Math.round(sec * TICKS_PER_SEC);
}

// ───────── 戦いの1刻み ─────────
// ctx：{ tick, hero（heroStats）, cards, levels（{札: 段}）, recast（刻み）, line, f（敵）, run（hp を持つ）, events }

// 敵に当てる。盾が残っていれば防がれ、殻があれば引かれる（pierce なら殻を無視）。崩しの間は ＋30%・殻が半分。当たった量を返す。
export function hitEnemy(f, raw, tick, pierce = false, noShield = false) {
  if (f.shieldHits > 0 && !noShield) {
    f.shieldHits -= 1;
    return 0;
  }
  const broken = f.breakUntil > tick;
  let dmg = raw * (broken ? STATES.breakTaken : 1);
  if ((f.markUntil ?? -1) > tick) dmg *= ES.markTaken;
  const shell = pierce ? 0 : (f.shell ?? 0) * (broken ? STATES.breakShell : 1);
  if (shell > 0) dmg = Math.max(dmg * SHELL_MIN, dmg - shell);
  f.hp -= dmg;
  return dmg;
}

// 出血を重ねる。弾けたら当てた量を返す。
function addBleed(ctx, n) {
  const { f, hero, tick, events } = ctx;
  f.bleed = (f.bleed ?? 0) + n;
  if (f.bleed < STATES.bleedMax) return 0;
  f.bleed = 0;
  events.push({ type: 'burst' });
  return hitEnemy(f, hero.atk * STATES.bleedBurst, tick, true);
}

export function isFrozen(f, tick) {
  return (f.frozenUntil ?? -1) > tick;
}
// 止まっている（凍結か影縫い）。
export function isHeld(f, tick) {
  return isFrozen(f, tick) || (f.holdUntil ?? -1) > tick;
}
export function isWet(f, tick) {
  return (f.wetUntil ?? -1) > tick;
}

// 属性の状態を付ける（判定表 第18回 D）。技のダメージの前に呼ぶ。{ mult：この技の倍率 } を返す。
function applyElement(ctx, c, id, p, wetMod) {
  const { hero, f, tick, events } = ctx;
  let mult = 1;
  if (wetMod) { f.wetUntil = tick + ES.wetSec * TICKS_PER_SEC; events.push({ type: 'state', state: 'wet' }); }
  const frozen = isFrozen(f, tick);
  // 打撃と氷の矢：凍った敵に3倍で、解ける
  if (frozen && (BLUNT.includes(id) || c.shatter)) {
    mult *= ES.shatter;
    f.frozenUntil = -1;
    events.push({ type: 'state', state: 'shatter' });
  }
  if (c.elem === 'fire') {
    if (frozen) { f.frozenUntil = -1; events.push({ type: 'state', state: 'melt' }); }
    if (isWet(f, tick)) {
      mult *= ES.wetFire;
      f.wetUntil = -1;
    } else {
      f.burn = { left: ES.burnTimes, per: hero.atk * ES.burnPer * p, cd: ES.burnEvery * TICKS_PER_SEC };
      events.push({ type: 'state', state: 'burn' });
    }
  } else if (c.elem === 'ice' && !isFrozen(f, tick)) {
    f.chill = (f.chill ?? 0) + 1;
    if (isWet(f, tick) || f.chill >= ES.chillToFreeze) {
      f.frozenUntil = tick + ES.freezeSec * TICKS_PER_SEC;
      f.chill = 0;
      events.push({ type: 'state', state: 'freeze' });
    }
  } else if (c.elem === 'thunder') {
    f.shock = ES.shockHits;
    const strip = c.strip ?? 1;
    f.shieldHits = Math.max(0, (f.shieldHits ?? 0) - strip);
    events.push({ type: 'state', state: 'shock' });
  } else if (c.elem === 'wind') {
    if (f.burn) { f.burnSpread = true; events.push({ type: 'state', state: 'spread' }); }
  }
  if (c.mark) { f.markUntil = tick + ES.markSec * TICKS_PER_SEC; events.push({ type: 'state', state: 'mark' }); }
  return mult;
}

// 技を当てる。area：群れの全員に（群れでなければ1体）。
function applyTech(ctx, c, p, area = false, extra = {}) {
  const { hero, line, f, tick } = ctx;
  let dealt = 0;
  const bodies = area || c.area ? f.swarm ?? 1 : 1;
  const em = applyElement(ctx, c, extra.id, p, extra.wet);
  if (c.damage) {
    for (let b = 0; b < bodies; b++) for (let k = 0; k < (c.hits ?? 1); k++) dealt += hitEnemy(f, hero.atk * c.damage * p * em, tick, !!c.pierce || !!extra.pierce, !!extra.unshield);
  }
  // 工程7d：召喚獣・受け持ち・毒・止める・暗殺
  if (c.pet) {
    if (!line.pets) line.pets = [];
    const n = extra.pets ?? 1;
    for (let k = 0; k < n; k++) {
      line.pets.push({ until: tick + c.pet.sec * TICKS_PER_SEC, every: c.pet.every * TICKS_PER_SEC, cd: 1, // 呼んだらすぐ1回目
        dmg: hero.atk * c.pet.damage * p, area: !!c.pet.area, elem: c.pet.elem ?? null });
    }
    ctx.events.push({ type: 'state', state: 'summon' });
  }
  if (c.absorb) line.absorb = (line.absorb ?? 0) + Math.round(c.absorb * p);
  if (c.poison || extra.poison) {
    f.poisonUntil = tick + ES.poisonSec * TICKS_PER_SEC;
    f.poisonPer = Math.max(f.poisonPer ?? 0, hero.atk * ES.poisonPer * p);
    ctx.events.push({ type: 'state', state: 'poison' });
  }
  if (c.holdSec) f.holdUntil = Math.max(f.holdUntil ?? -1, tick + c.holdSec * TICKS_PER_SEC);
  if (c.execute && f.hp > 0 && f.hp <= (f.maxHp ?? Infinity) * c.execute) {
    dealt += f.hp;
    f.hp = 0;
    ctx.events.push({ type: 'state', state: 'execute' });
  }
  if (c.bleed) dealt += addBleed(ctx, c.bleed);
  if (c.breakSec) f.breakUntil = Math.max(f.breakUntil ?? -1, tick + c.breakSec * TICKS_PER_SEC * p);
  if (c.dodge) line.dodge += Math.round(c.dodge * p);
  if (c.stanceSec) line.stanceUntil = Math.max(line.stanceUntil, tick + c.stanceSec * TICKS_PER_SEC * p);
  if (c.parry) line.parry = Math.max(line.parry, c.parry * p);
  if (c.focusSec) {
    line.focusUntil = Math.max(line.focusUntil, tick + c.focusSec * TICKS_PER_SEC * p);
    line.counter = c.counter * p;
  }
  return dealt;
}

// 条件が合うか。
function condHolds(ctx, c) {
  if (c.cond === 'opening') return ctx.tick - (ctx.f.start ?? 0) < STATES.iaiSec * TICKS_PER_SEC;
  if (c.cond === 'frozen') return isFrozen(ctx.f, ctx.tick);
  if (c.cond === 'held') return isHeld(ctx.f, ctx.tick);
  if (c.cond === 'summoned') return (ctx.line.pets ?? []).some((pt) => pt.until > ctx.tick);
  if (c.cond === 'marked') return (ctx.f.markUntil ?? -1) > ctx.tick;
  return ctx.run.hp <= ctx.hero.maxHp / 2;
}

// 札を1枚使う。{ time（振り）, dealt, skip?（条件）, stack?（重ねの枚数） }
function useCard(ctx, id) {
  const { levels, line, events } = ctx;
  const c = CARDS[id];
  const p = 1 + LINEUP.perLevel * ((levels[id] ?? 1) - 1);
  if (c.type === 'cond') {
    const ok = condHolds(ctx, c);
    events.push({ type: 'card', id, skip: !ok });
    return { time: 0, dealt: 0, skip: !ok };
  }
  if (c.type === 'stack') {
    events.push({ type: 'card', id });
    return { time: 0, dealt: 0, stack: c.count };
  }
  if (c.type === 'trig') {
    line.chase = true;
    events.push({ type: 'card', id });
    return { time: 0, dealt: 0, skip: false }; // 時間を使わず、続けて次の札へ（条件が合ったのと同じ）
  }
  if (c.type === 'mod') {
    line.mods.push({ mult: c.mult ?? 1, timeMult: c.timeMult ?? 1, area: !!c.area, repeat: c.repeat ?? 1, wet: !!c.wet, pierce: !!c.pierce, pets: c.pets ?? 1, poison: !!c.poison, unshield: !!c.unshield });
    events.push({ type: 'card', id });
    return { time: c.swings, dealt: 0 };
  }
  const mult = line.mods.reduce((a, m) => a * m.mult, 1);
  const tm = line.mods.reduce((a, m) => a * m.timeMult, 1);
  const area = line.mods.some((m) => m.area);
  const repeat = line.mods.reduce((a, m) => a * m.repeat, 1);
  const extra = {
    id, wet: line.mods.some((m) => m.wet), pierce: line.mods.some((m) => m.pierce),
    pets: line.mods.reduce((a, m) => a * (m.pets ?? 1), 1), poison: line.mods.some((m) => m.poison), unshield: line.mods.some((m) => m.unshield),
  };
  events.push({ type: 'card', id, mods: line.mods.length });
  line.mods = [];
  let dealt = 0;
  for (let k = 0; k < repeat; k++) dealt += applyTech(ctx, c, p * mult, area, k === 0 ? extra : { id });
  // 追い撃ち：この技で倒したら、次の札を次の敵へ時間なしで使う
  if (line.chase) {
    line.chase = false;
    if (ctx.f.hp <= 0) { line.free = true; events.push({ type: 'chase' }); }
  }
  return { time: c.swings * tm, dealt };
}

// 勇者の番（heroCd が 0 になったとき）。当てた量を返す。
export function heroAct(ctx) {
  const { hero, cards, line, f } = ctx;
  if (line.recast <= 0 && cards.length) {
    for (let guard = 0; guard < cards.length * 2 + 2; guard++) {
      if (line.pos >= cards.length) {
        line.pos = 0;
        line.recast = ctx.recast;
        break;
      }
      // 追い撃ちで倒した後の札は時間なし（その札を使う前に決める。倒した札自身には掛からない）
      const freeNow = line.free && ['tech', 'mod'].includes(CARDS[cards[line.pos]].type);
      if (freeNow) line.free = false;
      const r = useCard(ctx, cards[line.pos]);
      if (r.skip !== undefined) {
        line.pos += r.skip ? 2 : 1;
        continue;
      }
      line.pos += 1;
      let time = r.time;
      let dealt = r.dealt;
      if (r.stack) {
        // 重ね：次の何枚かを同時に使う（時間は一番長い札。条件は数えない）
        let left = r.stack;
        while (left > 0 && line.pos < cards.length) {
          const n0 = ctx.events.length;
          const r2 = useCard(ctx, cards[line.pos]);
          for (let k = n0; k < ctx.events.length; k++) ctx.events[k].together = true; // 重ねで同時に使った
          if (r2.skip !== undefined) { line.pos += r2.skip ? 2 : 1; continue; }
          line.pos += 1;
          left -= 1;
          time = Math.max(time, r2.time);
          dealt += r2.dealt;
        }
      }
      // 追い撃ちで放つ札は時間なし（次の敵の最初の手）
      const wasFree = freeNow;
      if (wasFree) time = 0;
      // 時間の端数は捨てずに次へ持ち越す（攻撃の速さの小さい伸びも効くように）
      f.heroCd += wasFree ? 1 : Math.max(1, time * hero.attackTicks * (hero.cast ?? 1)); // 札の時間は雷の耳飾りで縮む（判定表 第16回 C4）
      if (line.pos >= cards.length) {
        // 最後の札が終わってから積み直し
        line.pos = 0;
        line.recast = ctx.recast + f.heroCd;
      }
      return dealt;
    }
  }
  // 普通の攻撃。感電の間は群れの隣にも（濡れていれば全員に）当たる
  f.heroCd += hero.attackTicks; // 端数を持ち越す
  let bodies = 1;
  if (f.shock > 0) {
    f.shock -= 1;
    bodies = Math.min(f.swarm ?? 1, isWet(f, ctx.tick) ? f.swarm ?? 1 : 2);
  }
  let dealt = 0;
  for (let b = 0; b < bodies; b++) dealt += hitEnemy(f, hero.atk, ctx.tick);
  return dealt;
}

// 敵の番（enemyCd が 0 になったとき）。勇者が受けた量を返す（反撃で敵に当てた量は dealt に足す）。
export function enemyAct(ctx) {
  const { hero, line, f, run, events, tick } = ctx;
  // 凍っている・影縫いの間は動かない（解けたらすぐ動く）
  if (isHeld(f, tick)) { f.enemyCd = 1; return 0; }
  // 岩の守り手が受け持つ
  if (line.absorb > 0) {
    line.absorb -= 1;
    f.enemyCd = f.enemyTicks;
    events.push({ type: 'guard' });
    return 0;
  }
  f.enemyCd = f.enemyTicks;
  if (tick < line.focusUntil) {
    ctx.dealt = (ctx.dealt ?? 0) + hitEnemy(f, hero.atk * line.counter, tick);
    events.push({ type: 'focus' });
    return 0;
  }
  if (line.dodge > 0) {
    line.dodge -= 1;
    events.push({ type: 'dodge' });
    return 0;
  }
  if (line.parry > 0) {
    ctx.dealt = (ctx.dealt ?? 0) + hitEnemy(f, f.atk * line.parry, tick);
    line.parry = 0;
    events.push({ type: 'parry' });
    return 0;
  }
  let d = damageTaken(f.atk, hero.guard) * hero.taken;
  if (tick < line.stanceUntil) d *= STATES.stanceTaken;
  run.hp -= d;
  return d;
}

// 敵の性質の時間の動き（回復・盾が戻る）と、出血と、積み直しの時計。出血で削った量を返す。
export function tickFight(ctx) {
  const { f, line, hero } = ctx;
  let dealt = 0;
  if (line.recast > 0) line.recast -= 1;
  if (f.bleed > 0 && hero) {
    dealt = (hero.atk * STATES.bleedPer * f.bleed * (1 + (hero.tree?.bleed ?? 0))) / TICKS_PER_SEC;
    f.hp -= dealt;
  }
  // 燃焼（殻と盾を無視。風で広がっていれば群れの全員）
  if (f.burn && f.burn.left > 0) {
    f.burn.cd -= 1;
    if (f.burn.cd <= 0) {
      const d = f.burn.per * (f.burnSpread ? f.swarm ?? 1 : 1);
      f.hp -= d;
      dealt += d;
      f.burn.left -= 1;
      f.burn.cd = ES.burnEvery * TICKS_PER_SEC;
      if (f.burn.left <= 0) { f.burn = null; f.burnSpread = false; }
    }
  }
  // 毒：毎秒（刻みに割って）削り、毒の間は回復しない
  const poisoned = (f.poisonUntil ?? -1) > ctx.tick;
  if (poisoned && hero) {
    const d = f.poisonPer / TICKS_PER_SEC;
    f.hp -= d;
    dealt += d;
  }
  // 召喚獣
  if (line.pets?.length) {
    for (const pt of line.pets) {
      if (pt.until <= ctx.tick) continue;
      pt.cd -= 1;
      if (pt.cd > 0) continue;
      pt.cd = pt.every;
      const bodies = pt.area ? f.swarm ?? 1 : 1;
      for (let b = 0; b < bodies; b++) dealt += hitEnemy(f, pt.dmg, ctx.tick);
      if (pt.elem === 'fire' && !isWet(f, ctx.tick)) f.burn = { left: ES.burnTimes, per: pt.dmg * 0.5, cd: ES.burnEvery * TICKS_PER_SEC };
    }
    line.pets = line.pets.filter((pt) => pt.until > ctx.tick);
  }
  if (f.regen && !poisoned) f.hp = Math.min(f.maxHp, f.hp + f.regen);
  if (f.shieldMax && !isHeld(f, ctx.tick)) {
    f.shieldCd -= 1;
    if (f.shieldCd <= 0) {
      f.shieldHits = Math.min(f.shieldMax, f.shieldHits + 1);
      f.shieldCd = f.shieldEvery;
    }
  }
  return dealt;
}

// 札ごとの段。
export function levelsOf(state, cards) {
  const out = {};
  for (const id of cards) out[id] = cardLevel(state, id);
  return out;
}

// ───────── 木人（判定表 第9回 D1・D2） ─────────
// 木人は倒れない。今の強さで seconds 秒当てた結果。相手の強さは勇者に合わせて決める（どの強さでも比べられるように）。
export const DUMMIES = Object.freeze({
  plain: { name: '素の敵', text: '1秒に1回、最大HPの5%の攻撃' },
  swarm: { name: '群れ', text: '3体の群れ。1秒に3回、最大HPの2%の攻撃' },
  shield: { name: '盾', text: '盾3枚（1回の攻撃を1枚で防ぐ）。2秒ごとに1枚張り直す' },
  shell: { name: '硬い殻', text: '1回の攻撃から、勇者の攻撃の8割を引く' },
  regen: { name: '回復', text: '毎秒、普通の攻撃の6割ぶん回復する（差し引きを出す）' },
});

export function runDummy(state, cards, type, seconds = 30) {
  const hero = heroStats(state);
  const levels = levelsOf(state, cards);
  const base = hero.atk * TICKS_PER_SEC / hero.attackTicks; // 普通の攻撃だけの毎秒（回復の木人の強さに使う）
  const f = { hp: 1e15, maxHp: 1e15, atk: hero.maxHp * 0.05, enemyTicks: TICKS_PER_SEC, heroCd: 1, enemyCd: TICKS_PER_SEC, shell: 0, shieldHits: 0, breakUntil: -1 };
  if (type === 'swarm') { f.atk = hero.maxHp * 0.02; f.enemyTicks = Math.round(TICKS_PER_SEC / 3); f.enemyCd = f.enemyTicks; f.swarm = 3; }
  f.start = 0;
  if (type === 'shell') f.shell = hero.atk * 0.8;
  if (type === 'shield') Object.assign(f, { shieldHits: 3, shieldMax: 3, shieldEvery: 2 * TICKS_PER_SEC, shieldCd: 2 * TICKS_PER_SEC });
  const regenPerTick = type === 'regen' ? (base * 0.6) / TICKS_PER_SEC : 0;
  const line = newLine();
  const run = { hp: 1e15 };
  const ctx = { tick: 0, hero: { ...hero, maxHp: 1e15 }, cards, levels, recast: recastTicks(state), line, f, run, events: [] };
  // 条件「HP が半分以下」は木人では HP を勇者のまま見る
  ctx.hero.maxHp = hero.maxHp;
  run.hp = hero.maxHp;
  let dealt = 0, taken = 0;
  const timeline = [];
  let firstRecast = null;
  for (let t = 0; t < seconds * TICKS_PER_SEC; t++) {
    ctx.tick = t;
    dealt += tickFight(ctx);
    f.heroCd -= 1;
    if (f.heroCd <= 0) {
      const before = ctx.events.length;
      dealt += heroAct(ctx);
      if (firstRecast === null) {
        for (const e of ctx.events.slice(before)) timeline.push({ ...e, t });
        if (line.recast > 0) { firstRecast = t; line.recastStart = line.recast; }
      }
    }
    f.enemyCd -= 1;
    if (f.enemyCd <= 0) {
      ctx.dealt = 0;
      taken += enemyAct(ctx);
      dealt += ctx.dealt;
      run.hp = hero.maxHp; // 木人の試しでは倒れない（受けた量だけ数える）
    }
    if (regenPerTick && !((f.poisonUntil ?? -1) > t)) dealt -= regenPerTick; // 毒の間は回復しない（工程7d）
  }
  // 1周：最初の積み直しが始まるまで ＋ 積み直し
  const cycle = firstRecast === null ? null : (firstRecast + line.recastStart) / TICKS_PER_SEC;
  return { dps: dealt / seconds, takenPerSec: taken / seconds, cycleSec: cards.length ? cycle : null, timeline };
}

// 並びなしとの比べ（同じ木人に普通の攻撃だけで当てた結果）。
export function compareDummy(state, cards, type, seconds = 30) {
  const withCards = runDummy(state, cards, type, seconds);
  const plain = runDummy(state, [], type, seconds);
  return { ...withCards, plainDps: plain.dps, plainTaken: plain.takenPerSec, ratio: plain.dps > 0 ? withCards.dps / plain.dps : null };
}
