// 段3 道場：守りのスキルツリー・熟練・巻物を解く手・修行中の技。純粋な関数だけ。
// 状態は state.dojo = { nodes: { [節]: { skill } }, scroll: 解いている巻物 | null, drawn: 作った巻物の数 }。
// 節の段は 熟練 ÷ 2（5段まで）。巻物を解くと熟練3、ミス1回につき −1（最低1）。判定表 第6回。

import { GUARD_TREE, TECHS, SECOND_RULE, SCROLL_SIZES, SKILL, DISCIPLE, skillGain } from '../data/dojo.js';
import { TICKS_PER_SEC } from '../data/balance.js';
import { generate, numberAt, areaOf } from './scroll.js';

export const LEVEL_MAX = 5;

export function nodeOf(id) {
  return GUARD_TREE.find((n) => n.id === id) ?? null;
}

export function skillOf(state, id) {
  return state.dojo?.nodes?.[id]?.skill ?? 0;
}

export function levelOf(state, id) {
  return Math.min(LEVEL_MAX, Math.floor(skillOf(state, id) / SKILL.perLevel));
}

// 節が開いているか（親が 1/5 以上）。
export function isNodeOpen(state, id) {
  const n = nodeOf(id);
  if (!n || n.locked) return false;
  if (n.needsAny) return n.needsAny.of.filter((p) => levelOf(state, p) >= 1).length >= n.needsAny.n;
  return n.needs.every((p) => levelOf(state, p) >= 1);
}

// 小さい節の強さの合計（割合）。
export function nodeStats(state) {
  const out = { hp: 0, atk: 0, taken: 0, regen: 0, speed: 0 };
  for (const n of GUARD_TREE) {
    if (!n.stat) continue;
    const lv = levelOf(state, n.id);
    for (const [k, v] of Object.entries(n.stat)) out[k] += v * lv;
  }
  return out;
}

// 節 node の、今の段 level（0〜4）から次の段へ上がるための巻物の形（判定表 第6回 D4・第7回）。
export function scrollSpec(node, level) {
  const small = SCROLL_SIZES.small, large = SCROLL_SIZES.large;
  const size = (rules, big) => {
    const s = big ? large : small;
    return { w: s.w, h: s.h, count: rules.length ? s.countRule : s.count, rules };
  };
  if (node.kind === 'small') {
    return level < 2 ? { ...size([], false), maxLevel: 2, maxGlobal: 0 } : { ...size([], true), maxLevel: 3, maxGlobal: 1 };
  }
  const main = node.rules ?? [node.rule];
  if (node.kind === 'secret') {
    return { ...size(main, true), maxLevel: 3, maxGlobal: level < 2 ? 1 : 2 };
  }
  if (level === 0) return { ...size(main, false), maxLevel: 3, maxGlobal: 0 };
  if (level === 1) return { ...size(main, false), maxLevel: 3, maxGlobal: 1 };
  if (level === 2) return { ...size(main, true), maxLevel: 3, maxGlobal: 1 };
  return { ...size([main[0], SECOND_RULE[main[0]]], true), maxLevel: 3, maxGlobal: 2 };
}

// この巻物で使える修行中の技 { 技: 回数 }。その節の技は「段＋1」回、ほかに覚えた守りの技は1回ずつ。
export function techsFor(state, node, level) {
  const out = {};
  for (const n of GUARD_TREE) {
    if (!n.tech) continue;
    if (n.id === node.id) out[n.tech] = level + 1;
    else if (levelOf(state, n.id) >= 1) out[n.tech] = 1;
  }
  return out;
}

function clone(state) {
  return structuredClone(state);
}

function ensure(s) {
  if (!s.dojo) s.dojo = { nodes: {}, scroll: null, drawn: 0 };
  return s.dojo;
}

// 0 のマスを開けると数えるマスも開く。opened（配列）に足す。
function openArea(p, opened, start) {
  const stack = [start];
  while (stack.length) {
    const c = stack.pop();
    if (opened.includes(c)) continue;
    opened.push(c);
    if (numberAt(p, c) === 0) for (const j of areaOf(p.w, p.h, p.rules, c)) if (!p.mines[j] && !opened.includes(j)) stack.push(j);
  }
}

export function scrollCheck(state, id) {
  if (!state.open.unlocks.includes('stage:dojo')) return { ok: false, reason: '道場は地域2のボスを倒すと開く' };
  const n = nodeOf(id);
  if (!n) return { ok: false, reason: 'ない節' };
  if (n.locked) return { ok: false, reason: n.locked };
  if (!isNodeOpen(state, id)) return { ok: false, reason: '前の節を 1/5 にすると開く' };
  if (levelOf(state, id) >= LEVEL_MAX) return { ok: false, reason: 'もう 5/5' };
  if (state.dojo?.scroll) return { ok: false, reason: '解いている巻物がある' };
  return { ok: true };
}

// 節 id の巻物を開く（種つきで作る）。
export function startScroll(state, id) {
  const c = scrollCheck(state, id);
  if (!c.ok) return { state, ok: false, reason: c.reason };
  const s = clone(state);
  const d = ensure(s);
  const node = nodeOf(id);
  const level = levelOf(s, id);
  const spec = scrollSpec(node, level);
  const no = GUARD_TREE.indexOf(node) + 1;
  let g = null;
  for (let k = 0; k < 5 && !g; k++) g = generate({ ...spec, seed: no * 100000 + level * 10000 + d.drawn * 10 + k });
  if (!g) return { state, ok: false, reason: '巻物を作れなかった' };
  d.drawn += 1;
  const p = g.puzzle;
  const opened = [];
  for (const i of p.shown) openArea(p, opened, i);
  d.scroll = {
    node: id, level, puzzle: p, opened, flags: [], sure: [], wrong: [], mistakes: 0,
    techs: techsFor(s, node, level), guard: false, hints: [], done: false,
  };
  return { state: s, ok: true };
}

function finishIfDone(s, events) {
  const sc = s.dojo.scroll;
  const safe = sc.puzzle.mines.filter((m) => !m).length;
  if (sc.opened.length < safe) return;
  const before = levelOf(s, sc.node);
  const gain = skillGain(sc.mistakes);
  const nd = s.dojo.nodes[sc.node] ?? { skill: 0 };
  s.dojo.nodes[sc.node] = { skill: Math.min(LEVEL_MAX * SKILL.perLevel, nd.skill + gain) };
  const after = levelOf(s, sc.node);
  s.dojo.scroll = null;
  // 人が解いた形を覚える（門下生が解けるようになる。判定表 第11回 A2）
  const shape = shapeKey(sc.puzzle);
  if (!s.dojo.shapes) s.dojo.shapes = [];
  if (!s.dojo.shapes.includes(shape)) s.dojo.shapes.push(shape);
  s.stats.scrolls = (s.stats.scrolls ?? 0) + 1;
  events.push({ type: 'scroll', node: sc.node, gain, mistakes: sc.mistakes, from: before, to: after });
}

// マスを開ける。罠ならミス（受け流しが構えてあれば数えない）。
export function scrollOpen(state, i) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.opened.includes(i) || sc.wrong.includes(i) || sc.sure.includes(i)) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const events = [];
  if (t.puzzle.mines[i]) {
    t.wrong.push(i);
    t.flags = t.flags.filter((j) => j !== i);
    if (t.guard) { t.guard = false; events.push({ type: 'parry' }); } else { t.mistakes += 1; events.push({ type: 'miss' }); }
  } else {
    openArea(t.puzzle, t.opened, i);
    t.flags = t.flags.filter((j) => !t.opened.includes(j));
    finishIfDone(s, events);
  }
  return { state: s, ok: true, events };
}

// 印を付ける・消す（自分用のメモ）。
export function scrollFlag(state, i) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.opened.includes(i) || sc.wrong.includes(i) || sc.sure.includes(i)) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  t.flags = t.flags.includes(i) ? t.flags.filter((j) => j !== i) : [...t.flags, i];
  return { state: s, ok: true };
}

// 修行中の技を使う。
export function scrollTech(state, tech, i) {
  const sc = state.dojo?.scroll;
  if (!sc || !(sc.techs[tech] > 0) || !TECHS[tech]) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const p = t.puzzle;
  const events = [];
  const markSure = (c) => { if (!t.sure.includes(c) && !t.wrong.includes(c)) t.sure.push(c); t.flags = t.flags.filter((j) => j !== c); };
  if (tech === 'ukenagashi') {
    if (t.guard) return { state, ok: false };
    t.guard = true;
  } else {
    if (!(i >= 0 && i < p.mines.length)) return { state, ok: false };
    if (tech === 'mikiri') {
      if (p.mines[i]) markSure(i);
      else { openArea(p, t.opened, i); t.flags = t.flags.filter((j) => !t.opened.includes(j)); }
    } else if (tech === 'tategamae') {
      const cells = [i, ...[-p.w, -1, 1, p.w].map((d) => i + d).filter((j, k) => {
        if (j < 0 || j >= p.mines.length) return false;
        if (k === 1 && i % p.w === 0) return false;
        if (k === 2 && i % p.w === p.w - 1) return false;
        return true;
      })];
      t.hints.push({ tech, at: i, value: cells.filter((c) => p.mines[c]).length });
    } else if (tech === 'tateuchi') {
      const x = i % p.w, y = Math.floor(i / p.w);
      let row = 0, col = 0;
      for (let k = 0; k < p.w; k++) if (p.mines[y * p.w + k]) row += 1;
      for (let k = 0; k < p.h; k++) if (p.mines[k * p.w + x]) col += 1;
      t.hints.push({ tech, at: i, row, col });
    } else if (tech === 'shingan') {
      const x = i % p.w, y = Math.floor(i / p.w);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
        const c = ny * p.w + nx;
        if (p.mines[c]) markSure(c);
      }
    }
  }
  t.techs[tech] -= 1;
  events.push({ type: 'tech', tech });
  finishIfDone(s, events);
  return { state: s, ok: true, events };
}

// 巻物をやめる（熟練は入らない）。
export function quitScroll(state) {
  if (!state.dojo?.scroll) return { state, ok: false };
  const s = clone(state);
  s.dojo.scroll = null;
  return { state: s, ok: true };
}

// ───── 巻物の形（判定表 第11回 A2）：変えルールの組み合わせと盤の大きさ ─────

export function shapeKey(spec) {
  return `${[...(spec.rules ?? [])].sort().join('+') || 'base'}:${spec.w}x${spec.h}`;
}

const RULE_NAMES = { cross: '十字', connect: '連結', pair: '組' };
export function shapeName(key) {
  const [rules, size] = key.split(':');
  const r = rules === 'base' ? '土台' : rules.split('+').map((x) => RULE_NAMES[x] ?? x).join('＋');
  return `${r} ${size.replace('x', '×')}`;
}

// 節 id の、今の段で解く巻物の形。
export function shapeOf(state, id) {
  const n = nodeOf(id);
  return shapeKey(scrollSpec(n, levelOf(state, id)));
}

// 前の版の保存から、人が解いた形を節の段で数える（段 L の節は 0〜L−1 段の巻物を解いている）。
export function shapesFromLevels(state) {
  const out = [];
  for (const n of GUARD_TREE) {
    if (n.locked) continue;
    for (let lv = 0; lv < levelOf(state, n.id); lv++) {
      const k = shapeKey(scrollSpec(n, lv));
      if (!out.includes(k)) out.push(k);
    }
  }
  return out;
}

// ───── 門下生（判定表 第11回 A：地域4のボスで来る） ─────
// 90秒に1枚（工房の「門下生の速さ」で×0.8ずつ）解き、熟練2。技は使わずミスもしない。
// 解けるのは人が手で一度解いた形だけ。選んだ枝の中で、開いていて段が一番低い節から（同じなら根に近い方）。
// 人が解いている節は取らない（A5）。

export const DISCIPLE_BRANCHES = Object.freeze(['all', '受け', '返し', '息吹']);

export function discipleTicks(state) {
  return Math.max(1, Math.round(DISCIPLE.everySec * TICKS_PER_SEC * DISCIPLE.speedMult ** (state.workshop?.disciple ?? 0)));
}

const depthMemo = new Map();
export function depthOf(id) {
  if (depthMemo.has(id)) return depthMemo.get(id);
  const n = nodeOf(id);
  const parents = n.needsAny ? n.needsAny.of : n.needs;
  const d = parents.length ? 1 + Math.min(...parents.map(depthOf)) : 0;
  depthMemo.set(id, d);
  return d;
}

// 門下生が次に解く節（なければ null）。
export function discipleTarget(state) {
  const d = state.dojo;
  const branch = d.disciple?.branch ?? 'all';
  const shapes = d.shapes ?? [];
  const busy = d.scroll?.node ?? null;
  let best = null;
  GUARD_TREE.forEach((n, order) => {
    if (n.locked || n.id === busy) return;
    if (branch !== 'all' && n.branch !== branch && n.branch !== '根') return;
    if (!isNodeOpen(state, n.id)) return;
    const lv = levelOf(state, n.id);
    if (lv >= LEVEL_MAX) return;
    if (!shapes.includes(shapeKey(scrollSpec(n, lv)))) return;
    const key = [lv, depthOf(n.id), order];
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && (key[1] < best.key[1] || (key[1] === best.key[1] && key[2] < best.key[2])))) best = { id: n.id, key };
  });
  return best?.id ?? null;
}

// 1刻み進める（状態をその場で変える。game.js の advance から呼ぶ）。
export function tickDisciple(s, events) {
  const d = ensure(s);
  if (!d.disciple) d.disciple = { branch: 'all', node: null, cd: 0 };
  const w = d.disciple;
  if (!w.node || w.node === d.scroll?.node || levelOf(s, w.node) >= LEVEL_MAX) {
    // 1秒ごとに次の節を探す
    if (w.node || s.tick % TICKS_PER_SEC === 0) {
      w.node = discipleTarget(s);
      w.cd = w.node ? discipleTicks(s) : 0;
    }
    return;
  }
  w.cd -= 1;
  if (w.cd > 0) return;
  const id = w.node;
  w.node = null;
  if (!shapes(d).includes(shapeOf(s, id))) return; // 人が段を上げて形が変わった
  const before = levelOf(s, id);
  const nd = d.nodes[id] ?? { skill: 0 };
  d.nodes[id] = { skill: Math.min(LEVEL_MAX * SKILL.perLevel, nd.skill + DISCIPLE.gain) };
  s.stats.discipleScrolls = (s.stats.discipleScrolls ?? 0) + 1;
  events.push({ type: 'disciple', node: id, gain: DISCIPLE.gain, from: before, to: levelOf(s, id) });
  w.node = discipleTarget(s);
  w.cd = w.node ? discipleTicks(s) : 0;
}

function shapes(d) {
  return d.shapes ?? [];
}

export function setDiscipleBranch(state, branch) {
  if (!DISCIPLE_BRANCHES.includes(branch)) return { state, ok: false };
  const s = clone(state);
  const d = ensure(s);
  d.disciple = { ...(d.disciple ?? { node: null, cd: 0 }), branch, node: null, cd: 0 };
  return { state: s, ok: true };
}
