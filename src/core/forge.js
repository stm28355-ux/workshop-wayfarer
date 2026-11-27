// 打ち分けの1回ぶん（叩いている間）の決まり。純粋な関数だけで、元の物は変えない。
// 盤の各マスに目標の真ん中 c があり、帯は c±1。帯の中で○、真ん中で◎、超えるとひび。
// 温度は 灼熱 → 赤熱 → 暗赤 の3段（temp 0〜2、3 は冷えて叩けない）。1段で perLevel 回叩くと下がる。
// 火を足すは段の頭（その段でまだ叩いていない）で使うと1段戻る（叩いた回数には入らない）。

import { GEAR, STRIKES, TEMPS, GEAR_KINDS, bandOf } from '../data/forge.js';

export function targetsOf(kind, slot, tier) {
  const band = bandOf(tier);
  const def = GEAR_KINDS[kind]?.[slot];
  if (!band || !def) return null;
  const targets = def.targets[band.id];
  return targets ? { band, targets } : null;
}

export function newSession({ kind, slot, tier, conc, fire }) {
  const t = targetsOf(kind, slot, tier);
  if (!t) throw new RangeError(`打てない：${kind} ${slot} 格${tier}`);
  const perLevel = GEAR_KINDS[kind].perLevel;
  return {
    kind, slot, tier,
    band: t.band.id, w: t.band.w, h: t.band.h,
    targets: t.targets.slice(),
    values: t.targets.map(() => 0),
    perLevel, temp: 0, left: perLevel,
    conc, fire,
    log: [],
  };
}

// 叩き方 id でマス cell を叩くと伸びるマス。縦打ちは押したマスと下のマス（一番下の段なら上のマスと）。
export function strikeCells(session, id, cell) {
  const s = STRIKES[id];
  if (!s || cell < 0 || cell >= session.values.length) return [];
  if (s.shape === 'one') return [cell];
  const below = cell + session.w;
  return below < session.values.length ? [cell, below] : [cell - session.w, cell];
}

// 今の温度で叩き方 id が伸ばす量（1マスあたり）。
export function strikeAmount(session, id) {
  if (session.temp > 2) return 0;
  return Math.floor(STRIKES[id].amount * TEMPS[session.temp].mult);
}

export function canStrike(session, id) {
  const s = STRIKES[id];
  return !!s && session.temp <= 2 && session.conc >= s.cost && strikeAmount(session, id) > 0;
}

// 叩く前に見せる伸び：[{ index, amount }]
export function preview(session, id, cell) {
  if (!canStrike(session, id)) return [];
  const amount = strikeAmount(session, id);
  return strikeCells(session, id, cell).map((index) => ({ index, amount }));
}

function cool(s) {
  s.left -= 1;
  if (s.left === 0) {
    s.temp += 1;
    s.left = s.perLevel;
  }
}

export function strike(session, id, cell) {
  if (!canStrike(session, id)) return null;
  const cells = strikeCells(session, id, cell);
  if (cells.length === 0) return null;
  const amount = strikeAmount(session, id);
  const s = { ...session, values: session.values.slice(), log: [...session.log, [id, cell]] };
  for (const c of cells) s.values[c] += amount;
  s.conc -= STRIKES[id].cost;
  cool(s);
  return s;
}

export function canFire(session) {
  return session.fire > 0 && session.temp > 0 && session.left === session.perLevel;
}

export function addFire(session) {
  if (!canFire(session)) return null;
  return { ...session, temp: session.temp - 1, fire: session.fire - 1, log: [...session.log, ['fire']] };
}

// もう何もできない（集中力が切れたか、冷えて火も足せない）。
export function isOver(session) {
  if (session.conc < 1) return true;
  if (session.temp > 2) return !canFire(session);
  return false;
}

// 1マスの出来：0＝帯に届かない、1＝○、2＝◎。ひび（帯を超えた）は 0 で crack。
export function cellQuality(value, center) {
  if (value > center + 1) return { q: 0, crack: true };
  if (value === center) return { q: 2, crack: false };
  if (value >= center - 1) return { q: 1, crack: false };
  return { q: 0, crack: false };
}

// 出来の合計と、基本の何割になるか（判定表 第4回 B3）。
export function score(session) {
  let sum = 0;
  let cracks = 0;
  for (let i = 0; i < session.values.length; i++) {
    const c = cellQuality(session.values[i], session.targets[i]);
    sum += c.q;
    if (c.crack) cracks += 1;
  }
  const max = session.values.length * 2;
  const crit = sum === max;
  const ratio = crit ? GEAR.crit : GEAR.minQ + (1 - GEAR.minQ) * (sum / max);
  return { sum, max, crit, cracks, ratio };
}

// 手順（log）を最初からもう一度打つ（職人が繰り返すとき）。途中で打てなければ null。
export function replay(start, log) {
  let s = start;
  for (const step of log) {
    s = step[0] === 'fire' ? addFire(s) : strike(s, step[0], step[1]);
    if (!s) return null;
  }
  return s;
}
