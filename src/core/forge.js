// 打ち分けの1回ぶん（叩いている間）の決まり。純粋な関数だけで、元の物は変えない。
// 盤の各マスに目標の真ん中 c があり、帯は c±1。帯の中で○、真ん中で◎、超えるとひび。
// 温度は 灼熱 → 赤熱 → 暗赤 の3段（temp 0〜2、3 は冷えて叩けない）。1段で perLevel 回叩くと下がる。
// 火を足すはいつでも使え、1段熱くなってその段を最初から叩ける（叩いた回数には入らない）。

import { GEAR, STRIKES, TEMPS, GEAR_KINDS, bandOf } from '../data/forge.js';

export function targetsOf(kind, slot, tier) {
  const band = bandOf(tier);
  const def = GEAR_KINDS[kind]?.[slot];
  if (!band || !def) return null;
  const targets = def.targets[band.id];
  return targets ? { band, targets } : null;
}

// tools：燃料に入っている欠片の種類（燃料で使える叩き方。判定表 第16回 B1）。
export function newSession({ kind, slot, tier, conc, fire, tools = [] }) {
  const t = targetsOf(kind, slot, tier);
  if (!t) throw new RangeError(`打てない：${kind} ${slot} 格${tier}`);
  const perLevel = GEAR_KINDS[kind].perLevel;
  const quirk = GEAR_KINDS[kind].quirk ?? null;
  return {
    kind, slot, tier, tools: tools.slice(), quirk,
    band: t.band.id, w: t.band.w, h: t.band.h,
    targets: t.targets.slice(),
    values: t.targets.map(() => 0),
    perLevel, temp: 0, left: levelLeft(quirk, perLevel, 0),
    conc, fire,
    seen: [], // 星鉄：叩いて目標が見えたマス
    log: [],
  };
}

// 段 temp で叩ける回数。竜の鱗は灼熱が長い（工程7d：企画まとめ「灼熱が長いが、強打が使えない」）。
export const LONG_HEAT = 5;
function levelLeft(quirk, perLevel, temp) {
  return quirk === 'longheat' && temp === 0 ? LONG_HEAT : perLevel;
}

// 目標が見えているか（星鉄は叩いたマスだけ見える。工程7d）。
export function targetSeen(session, cell) {
  return session.quirk !== 'hidden' || (session.seen ?? []).includes(cell);
}

// 叩き方 id でマス cell を叩くと伸びるマス。縦打ちは押したマスと下のマス（一番下の段なら上のマスと）。
// 十字打ちは押したマスと上下左右（盤の中だけ）、横薙ぎは押したマスの横1列。
export function strikeCells(session, id, cell) {
  const s = STRIKES[id];
  const n = session.values.length;
  if (!s || cell < 0 || cell >= n) return [];
  const w = session.w;
  if (s.shape === 'one') return [cell];
  if (s.shape === 'row') {
    const y = Math.floor(cell / w);
    return Array.from({ length: w }, (_, x) => y * w + x);
  }
  if (s.shape === 'cross') {
    const x = cell % w;
    const out = [cell];
    if (cell - w >= 0) out.push(cell - w);
    if (cell + w < n) out.push(cell + w);
    if (x > 0) out.push(cell - 1);
    if (x < w - 1) out.push(cell + 1);
    return out.sort((a, b) => a - b);
  }
  const below = cell + w;
  return below < n ? [cell, below] : [cell - w, cell];
}

// 今の温度で叩き方 id が伸ばす量（1マスあたり。均しは −1）。
export function strikeAmount(session, id) {
  if (session.temp > 2) return 0;
  const s = STRIKES[id];
  if (s.fixed) return s.amount;
  return Math.floor(s.amount * TEMPS[session.temp].mult);
}

// 燃料に要る欠片が入っているか。
export function hasTool(session, id) {
  const s = STRIKES[id];
  return !!s && (!s.needs || (session.tools ?? []).includes(s.needs));
}

export function canStrike(session, id) {
  const s = STRIKES[id];
  if (session.quirk === 'longheat' && id === 'heavy') return false; // 竜の鱗は強打が使えない
  return !!s && hasTool(session, id) && session.temp <= 2 && session.conc >= s.cost && strikeAmount(session, id) !== 0;
}

// 叩く前に見せる伸び：[{ index, amount }]
// 叩いたときの各マスの変わり方（叩いたマスは index・amount）。魔銀でこの1打で冷めるときは、
// 全部のマスの −1 も入れて decay を付ける（判定表 第17回 Q4：計算しなくても見えるように）。
export function preview(session, id, cell) {
  if (!canStrike(session, id)) return [];
  const next = strike(session, id, cell);
  const hit = new Set(strikeCells(session, id, cell));
  const decay = session.quirk === 'decay' && session.left === 1;
  const out = [];
  for (let i = 0; i < session.values.length; i++) {
    const amount = next.values[i] - session.values[i];
    if (!hit.has(i) && amount === 0) continue;
    out.push(decay ? { index: i, amount, decay: true, hit: hit.has(i) } : { index: i, amount });
  }
  return out;
}

// 今の集中力でその叩き方をあと何回使えるか（判定表 第17回 Q2）。
export function strikesLeft(session, id) {
  return canStrike(session, id) ? Math.floor(session.conc / STRIKES[id].cost) : 0;
}

// 叩くと冷める。段が下がるとき、魔銀は全部のマスが1下がる（判定表 第16回 C1）。
function cool(s) {
  s.left -= 1;
  if (s.left === 0) {
    s.temp += 1;
    s.left = levelLeft(s.quirk, s.perLevel, s.temp);
    if (s.quirk === 'decay') s.values = s.values.map((v) => Math.max(0, v - 1));
  }
}

export function strike(session, id, cell) {
  if (!canStrike(session, id)) return null;
  const cells = strikeCells(session, id, cell);
  if (cells.length === 0) return null;
  const amount = strikeAmount(session, id);
  const s = { ...session, values: session.values.slice(), log: [...session.log, [id, cell]] };
  for (const c of cells) s.values[c] = Math.max(0, s.values[c] + amount);
  s.conc -= STRIKES[id].cost;
  if (s.quirk === 'hidden') s.seen = [...new Set([...(s.seen ?? []), ...cells])];
  cool(s);
  return s;
}

// 火を足すはいつでも使える（判定表 第5回 Q3）。1段熱くなり、その段を最初から（perLevel 回）叩ける。
export function canFire(session) {
  return session.fire > 0 && session.temp > 0;
}

export function addFire(session) {
  if (!canFire(session)) return null;
  return { ...session, temp: session.temp - 1, left: levelLeft(session.quirk, session.perLevel, session.temp - 1), fire: session.fire - 1, log: [...session.log, ['fire']] };
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
