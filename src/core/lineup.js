// 技の並び（判定表 第9回）。純粋な関数だけ。
// 普通の攻撃は今のまま続き、札はその合間に左から順に使う。最後の札の後は積み直し（武器の秒数）で、その間も普通の攻撃。
// 条件は合わなければ次の1枚を飛ばす（時間を使わない）。修飾はたまって次の技に掛かり、頭に戻っても消えない。
// 並びの進み（line）は出発ごとに頭から。歩いている間は止まり、次の敵で続きを使う。
// 戦いの1刻みの手（heroAct・enemyAct・tickFight）は、ゲームと木人で同じ物を使う。

import { CARDS, LINEUP, STATES, SHELL_MIN } from '../data/cards.js';
import { GUARD_TREE } from '../data/dojo.js';
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
  const extra = GUARD_TREE.filter((n) => ['tech', 'card', 'secret'].includes(n.kind) && levelOf(state, n.id) >= LINEUP.slotLevel).length;
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
  return { pos: 0, recast: 0, mods: [], dodge: 0, parry: 0, stanceUntil: -1, focusUntil: -1, counter: 0 };
}

// 積み直しの刻み（装備中の武器。素手は3秒）。
export function recastTicks(state) {
  const w = state.gear?.items?.[state.gear?.equip?.weapon];
  const sec = w ? GEAR_KINDS[w.kind].weapon.recast : 3;
  return Math.round(sec * TICKS_PER_SEC);
}

// ───────── 戦いの1刻み ─────────
// ctx：{ tick, hero（heroStats）, cards, levels（{札: 段}）, recast（刻み）, line, f（敵）, run（hp を持つ）, events }

// 敵に当てる。盾が残っていれば防がれ、殻があれば引かれる。崩しの間は ＋30%・殻が半分。当たった量を返す。
export function hitEnemy(f, raw, tick) {
  if (f.shieldHits > 0) {
    f.shieldHits -= 1;
    return 0;
  }
  const broken = f.breakUntil > tick;
  let dmg = raw * (broken ? STATES.breakTaken : 1);
  const shell = (f.shell ?? 0) * (broken ? STATES.breakShell : 1);
  if (shell > 0) dmg = Math.max(dmg * SHELL_MIN, dmg - shell);
  f.hp -= dmg;
  return dmg;
}

function applyTech(ctx, c, p) {
  const { hero, line, f, tick } = ctx;
  let dealt = 0;
  if (c.damage) dealt += hitEnemy(f, hero.atk * c.damage * p, tick);
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

// 勇者の番（heroCd が 0 になったとき）。当てた量を返す。
export function heroAct(ctx) {
  const { hero, cards, levels, line, f, run, events } = ctx;
  if (line.recast <= 0 && cards.length) {
    for (let guard = 0; guard < cards.length * 2 + 2; guard++) {
      if (line.pos >= cards.length) {
        line.pos = 0;
        line.recast = ctx.recast;
        break;
      }
      const id = cards[line.pos];
      const c = CARDS[id];
      const p = 1 + LINEUP.perLevel * ((levels[id] ?? 1) - 1);
      if (c.type === 'cond') {
        const ok = run.hp <= hero.maxHp / 2;
        events.push({ type: 'card', id, skip: !ok });
        line.pos += ok ? 1 : 2;
        continue;
      }
      let time = c.swings;
      let dealt = 0;
      if (c.type === 'mod') {
        line.mods.push({ mult: c.mult, timeMult: c.timeMult });
        events.push({ type: 'card', id });
      } else {
        const mult = line.mods.reduce((a, m) => a * m.mult, 1);
        const tm = line.mods.reduce((a, m) => a * m.timeMult, 1);
        events.push({ type: 'card', id, mods: line.mods.length });
        line.mods = [];
        dealt = applyTech(ctx, c, p * mult);
        time *= tm;
      }
      line.pos += 1;
      // 時間の端数は捨てずに次へ持ち越す（攻撃の速さの小さい伸びも効くように）
      f.heroCd += Math.max(1, time * hero.attackTicks);
      if (line.pos >= cards.length) {
        // 最後の札が終わってから積み直し
        line.pos = 0;
        line.recast = ctx.recast + f.heroCd;
      }
      return dealt;
    }
  }
  // 普通の攻撃
  f.heroCd += hero.attackTicks; // 端数を持ち越す
  return hitEnemy(f, hero.atk, ctx.tick);
}

// 敵の番（enemyCd が 0 になったとき）。勇者が受けた量を返す（反撃で敵に当てた量は dealt に足す）。
export function enemyAct(ctx) {
  const { hero, line, f, run, events, tick } = ctx;
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

// 敵の性質の時間の動き（回復・盾が戻る）と、積み直しの時計。
export function tickFight(ctx) {
  const { f, line } = ctx;
  if (line.recast > 0) line.recast -= 1;
  if (f.regen) f.hp = Math.min(f.maxHp, f.hp + f.regen);
  if (f.shieldMax) {
    f.shieldCd -= 1;
    if (f.shieldCd <= 0) {
      f.shieldHits = Math.min(f.shieldMax, f.shieldHits + 1);
      f.shieldCd = f.shieldEvery;
    }
  }
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
  swarm: { name: '群れ', text: '1秒に3回、最大HPの2%の攻撃' },
  shell: { name: '硬い殻', text: '1回の攻撃から、勇者の攻撃の8割を引く' },
  regen: { name: '回復', text: '毎秒、普通の攻撃の6割ぶん回復する（差し引きを出す）' },
});

export function runDummy(state, cards, type, seconds = 30) {
  const hero = heroStats(state);
  const levels = levelsOf(state, cards);
  const base = hero.atk * TICKS_PER_SEC / hero.attackTicks; // 普通の攻撃だけの毎秒（回復の木人の強さに使う）
  const f = { hp: 1e15, maxHp: 1e15, atk: hero.maxHp * 0.05, enemyTicks: TICKS_PER_SEC, heroCd: 1, enemyCd: TICKS_PER_SEC, shell: 0, shieldHits: 0, breakUntil: -1 };
  if (type === 'swarm') { f.atk = hero.maxHp * 0.02; f.enemyTicks = Math.round(TICKS_PER_SEC / 3); f.enemyCd = f.enemyTicks; }
  if (type === 'shell') f.shell = hero.atk * 0.8;
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
    tickFight(ctx);
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
    if (regenPerTick) dealt -= regenPerTick;
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
