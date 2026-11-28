// 段3 道場：流派のスキルツリー（守り・剣）・熟練・巻物を解く手・修行中の技。純粋な関数だけ。
// 守りの巻物はマインスイーパ（scroll.js）、剣はピクロス（nonogram.js）、魔法は属性の数独（sudoku.js）、
// 弓は鏡で光を通す（mirrors.js）。判定表 第6回・第13回・第18回。
// 状態は state.dojo = { nodes: { [節]: { skill } }, scroll: 解いている巻物 | null, drawn: 作った巻物の数 }。
// 節の段は 熟練 ÷ 2（5段まで）。巻物を解くと熟練3、ミス1回につき −1（最低1）。判定表 第6回。

import { SECOND_RULE, SCROLL_SIZES, SKILL, DISCIPLE, skillGain } from '../data/dojo.js';
import { ALL_NODES, ALL_TECHS, SCHOOLS } from '../data/schools.js';
import { swordSpec } from '../data/sword.js';
import { magicSpec } from '../data/magic.js';
import { bowSpec } from '../data/bow.js';
import { TICKS_PER_SEC } from '../data/balance.js';
import { generate, numberAt, areaOf } from './scroll.js';
import { generateNono } from './nonogram.js';
import { generateSudo } from './sudoku.js';
import { generateBeams, SLASH, BACK, ROCK } from './mirrors.js';

export const LEVEL_MAX = 5;

export function nodeOf(id) {
  return ALL_NODES.find((n) => n.id === id) ?? null;
}

// 流派が開いているか（地域のボスで school:<id> が開く。守りは道場と一緒）。
export function schoolOpen(state, school) {
  const u = state.open?.unlocks ?? [];
  return u.includes(`school:${school}`) || (school === 'guard' && u.includes('stage:dojo'));
}

export function skillOf(state, id) {
  return state.dojo?.nodes?.[id]?.skill ?? 0;
}

export function levelOf(state, id) {
  return Math.min(LEVEL_MAX, Math.floor(skillOf(state, id) / SKILL.perLevel));
}

// 節が開いているか（親が 1/5 以上）。奥義は needsAny.level（技の節2つが 3/5。判定表 第18回 G2）。
// 前の決まりで開いて熟練が入っている節は、そのまま開いている。
export function isNodeOpen(state, id) {
  const n = nodeOf(id);
  if (!n || n.locked || !schoolOpen(state, n.school)) return false;
  if (n.needsAny) {
    if (skillOf(state, id) > 0) return true;
    return n.needsAny.of.filter((p) => levelOf(state, p) >= (n.needsAny.level ?? 1)).length >= n.needsAny.n;
  }
  return n.needs.every((p) => levelOf(state, p) >= 1);
}

// 小さい節の強さの合計（割合）。
export function nodeStats(state) {
  const out = { hp: 0, atk: 0, taken: 0, regen: 0, speed: 0, bleed: 0 };
  for (const n of ALL_NODES) {
    if (!n.stat) continue;
    const lv = levelOf(state, n.id);
    for (const [k, v] of Object.entries(n.stat)) out[k] += v * lv;
  }
  return out;
}

// 節 node の、今の段 level（0〜4）から次の段へ上がるための巻物の形（判定表 第6回 D4・第7回）。
export function scrollSpec(node, level) {
  if (node.school === 'sword') return swordSpec(node, level);
  if (node.school === 'magic') return magicSpec(node, level);
  if (node.school === 'bow') return bowSpec(node, level);
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

// この巻物で使える修行中の技 { 技: 回数 }。その節の技は「段＋1」回、ほかに覚えた同じ流派の技は1回ずつ。
export function techsFor(state, node, level) {
  const out = {};
  for (const n of ALL_NODES) {
    if (!n.tech || n.school !== node.school) continue;
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
  if (!schoolOpen(state, n.school)) return { ok: false, reason: `${SCHOOLS[n.school].name}の流派はまだ開いていない` };
  if (!isNodeOpen(state, id)) return { ok: false, reason: n.needsAny ? `${n.needsAny.of.map((x) => nodeOf(x).name).join('・')}のうち${n.needsAny.n}つを ${n.needsAny.level ?? 1}/5 にすると開く` : `${n.needs.map((x) => nodeOf(x).name).join('と')}を 1/5 にすると開く` };
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
  const no = ALL_NODES.indexOf(node) + 1;
  const seedOf = (k) => no * 100000 + level * 10000 + d.drawn * 10 + k;
  if (spec.kind === 'sudo' || spec.kind === 'beam') {
    let g = null;
    for (let k = 0; k < 5 && !g; k++) g = spec.kind === 'sudo' ? generateSudo({ ...spec, seed: seedOf(k) }) : generateBeams({ ...spec, seed: seedOf(k) });
    if (!g) return { state, ok: false, reason: '巻物を作れなかった' };
    d.drawn += 1;
    const common = { kind: spec.kind, node: id, level, puzzle: g.puzzle, wrong: [], mistakes: 0, techs: techsFor(s, node, level), guard: false, hints: [], done: false };
    d.scroll = spec.kind === 'sudo'
      ? { ...common, values: {}, notes: {} }
      : { ...common, placed: {}, xs: [], sureX: [] };
    return { state: s, ok: true };
  }
  if (spec.kind === 'nono') {
    let g = null;
    for (let k = 0; k < 5 && !g; k++) g = generateNono({ ...spec, seed: no * 100000 + level * 10000 + d.drawn * 10 + k });
    if (!g) return { state, ok: false, reason: '巻物を作れなかった' };
    d.drawn += 1;
    d.scroll = {
      kind: 'nono', node: id, level, puzzle: g.puzzle, paint: {}, xs: [], sureX: [], wrong: [], mistakes: 0,
      techs: techsFor(s, node, level), guard: false, hints: [], done: false,
    };
    return { state: s, ok: true };
  }
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
  if (sc.kind === 'nono') { finishNonoIfDone(s, events); return; }
  if (sc.kind === 'sudo') { if (sudoLeft(sc) === 0) finishScroll(s, events); return; }
  if (sc.kind === 'beam') { if (beamLeft(sc) === 0) finishScroll(s, events); return; }
  const safe = sc.puzzle.mines.filter((m) => !m).length;
  if (sc.opened.length < safe) return;
  finishScroll(s, events);
}

// 解けた：熟練を足し、人が解いた形を覚える。
function finishScroll(s, events) {
  const sc = s.dojo.scroll;
  const before = levelOf(s, sc.node);
  const gain = skillGain(sc.mistakes);
  const nd = s.dojo.nodes[sc.node] ?? { skill: 0 };
  s.dojo.nodes[sc.node] = { skill: Math.min(LEVEL_MAX * SKILL.perLevel, nd.skill + gain) };
  const after = levelOf(s, sc.node);
  s.dojo.scroll = null;
  // 人が解いた形を覚える（門下生が解けるようになる。判定表 第11回 A2）
  const shape = shapeKey({ ...sc.puzzle, kind: sc.kind });
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
  if (!sc || !(sc.techs[tech] > 0) || !ALL_TECHS[tech]) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const p = t.puzzle;
  const events = [];
  if (t.kind === 'sudo' || t.kind === 'beam') {
    if (!(i >= 0 && i < p.solution.length) || !revealTech(t, tech, i)) return { state, ok: false };
    t.techs[tech] -= 1;
    events.push({ type: 'tech', tech });
    finishIfDone(s, events);
    return { state: s, ok: true, events };
  }
  if (t.kind === 'nono') {
    if (!(i >= 0 && i < p.solution.length) || !nonoTech(t, tech, i)) return { state, ok: false };
    t.techs[tech] -= 1;
    events.push({ type: 'tech', tech });
    finishIfDone(s, events);
    return { state: s, ok: true, events };
  }
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

// 剣の巻物（ピクロス）は頭に nono/、魔法は sudo/、弓は beam/ を付けて守りと分ける。
const KIND_PREFIX = { nono: 'nono/', sudo: 'sudo/', beam: 'beam/' };
const KIND_NAME = { nono: '剣', sudo: '魔法', beam: '弓' };
export function shapeKey(spec) {
  const w = spec.kind === 'sudo' ? spec.n : spec.w;
  const h = spec.kind === 'sudo' ? spec.n : spec.h;
  return `${KIND_PREFIX[spec.kind] ?? ''}${[...(spec.rules ?? [])].sort().join('+') || 'base'}:${w}x${h}`;
}

const RULE_NAMES = {
  cross: '十字', connect: '連結', pair: '組', color: '色', sum: '合計', mirror: '鏡',
  react: '反応', cycle: '巡り', cage: '囲み', break: '割れる鏡', label: '番号',
};
export function shapeName(key) {
  const m = key.match(/^(nono|sudo|beam)\//);
  const kind = m ? m[1] : null;
  const [rules, size] = key.replace(/^(nono|sudo|beam)\//, '').split(':');
  const r = rules === 'base' ? '土台' : rules.split('+').map((x) => RULE_NAMES[x] ?? x).join('＋');
  return `${kind ? KIND_NAME[kind] : '守り'} ${r} ${size.replace('x', '×')}`;
}

// 節 id の、今の段で解く巻物の形。
export function shapeOf(state, id) {
  const n = nodeOf(id);
  return shapeKey(scrollSpec(n, levelOf(state, id)));
}

// 前の版の保存から、人が解いた形を節の段で数える（段 L の節は 0〜L−1 段の巻物を解いている）。
export function shapesFromLevels(state) {
  const out = [];
  for (const n of ALL_NODES) {
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

// 枝の名前は流派をまたいで重ならない。根は同じ流派の枝を選んだときに入る。
export const DISCIPLE_BRANCHES = Object.freeze(['all', '受け', '返し', '息吹', '速さ', '重さ', '刃', '炎', '水氷', '雷', '速射', '狙い', '風']);
const BRANCH_SCHOOL = {
  受け: 'guard', 返し: 'guard', 息吹: 'guard', 速さ: 'sword', 重さ: 'sword', 刃: 'sword',
  炎: 'magic', 水氷: 'magic', 雷: 'magic', 速射: 'bow', 狙い: 'bow', 風: 'bow',
};

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
  ALL_NODES.forEach((n, order) => {
    if (n.locked || n.id === busy) return;
    if (branch !== 'all' && n.branch !== branch && !(n.branch === '根' && n.school === BRANCH_SCHOOL[branch])) return;
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

// ───── 剣の巻物（ピクロス。判定表 第13回 B・第14回） ─────
// 巻物の状態：{ kind: 'nono', node, level, puzzle, paint: { マス: 色 }, xs: [自分の×], sureX: [技で分かった塗らないマス],
//              wrong: [ミスしたマス], mistakes, techs, hints: [{ tech, at, value }], done }

function finishNonoIfDone(s, events) {
  const sc = s.dojo.scroll;
  const need = sc.puzzle.solution.filter((v) => v).length;
  if (Object.keys(sc.paint).length < need) return;
  finishScroll(s, events);
}

// 塗る（color：1＝赤・黒、2＝青）。答えと違えばミスで、そのマスは正しい形に直る。×のマスは塗れない（第14回 Q1）。
export function scrollPaint(state, i, color = 1) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.kind !== 'nono') return { state, ok: false };
  const p = sc.puzzle;
  if (!(i >= 0 && i < p.solution.length) || sc.paint[i] !== undefined || sc.wrong.includes(i) || sc.xs.includes(i) || sc.sureX.includes(i)) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const events = [];
  if (p.solution[i] === color) {
    t.paint[i] = color;
  } else {
    t.wrong.push(i);
    if (p.solution[i]) t.paint[i] = p.solution[i];
    if (t.guard) { t.guard = false; events.push({ type: 'parry' }); } else { t.mistakes += 1; events.push({ type: 'miss' }); }
  }
  finishNonoIfDone(s, events);
  return { state: s, ok: true, events };
}

// ×（自分用の印）を付ける・外す。on を省くと切り替え。
export function scrollMark(state, i, on) {
  const sc = state.dojo?.scroll;
  if (!sc || (sc.kind !== 'nono' && sc.kind !== 'beam')) return { state, ok: false };
  const filled = sc.kind === 'nono' ? sc.paint[i] !== undefined : sc.placed[i] !== undefined || sc.puzzle.shown.includes(i) || sc.puzzle.solution[i] === ROCK;
  if (filled || sc.wrong.includes(i) || sc.sureX.includes(i)) return { state, ok: false };
  const has = sc.xs.includes(i);
  const want = on ?? !has;
  if (want === has) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  t.xs = want ? [...t.xs, i] : t.xs.filter((j) => j !== i);
  return { state: s, ok: true };
}

// 剣の修行中の技：マスの答えを見せる（塗るマスは塗り、塗らないマスは確かな×）か、数を見せる。
function nonoTech(t, tech, i) {
  const p = t.puzzle;
  const x = i % p.w, y = Math.floor(i / p.w);
  const cellsAt = (list) => list.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < p.w && cy < p.h).map(([cx, cy]) => cy * p.w + cx);
  const reveal = (cells) => {
    for (const c of cells) {
      if (t.paint[c] !== undefined || t.wrong.includes(c)) continue;
      t.xs = t.xs.filter((j) => j !== c);
      if (p.solution[c]) t.paint[c] = p.solution[c];
      else if (!t.sureX.includes(c)) t.sureX.push(c);
    }
  };
  if (tech === 'renda') reveal(cellsAt([[x, y], [x + 1, y], [x + 2, y]]));
  else if (tech === 'jujigiri') reveal(cellsAt([[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]));
  else if (tech === 'issen') reveal(cellsAt(Array.from({ length: p.w }, (_, k) => [k, y])));
  else if (tech === 'kenjun') reveal(cellsAt([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]));
  else if (tech === 'shukketsu') {
    const around = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) around.push([x + dx, y + dy]);
    t.hints.push({ tech, at: i, value: cellsAt(around).filter((c) => p.solution[c]).length });
  } else return false;
  return true;
}

// ───── 魔法の巻物（属性の数独。判定表 第18回 B） ─────
// 巻物の状態：{ kind: 'sudo', node, level, puzzle, values: { マス: 属性 }, notes: { マス: [候補] }, wrong, mistakes, techs, hints }

export function sudoLeft(sc) {
  const p = sc.puzzle;
  let n = 0;
  for (let i = 0; i < p.solution.length; i++) if (!p.givens.includes(i) && sc.values[i] === undefined) n += 1;
  return n;
}

// 属性 v を置く。答えと違えばミスで、そのマスは正しい属性に直る（剣の塗り間違いと同じ。B3）。
export function scrollPlace(state, i, v) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.kind !== 'sudo') return { state, ok: false };
  const p = sc.puzzle;
  if (!(i >= 0 && i < p.solution.length) || p.givens.includes(i) || sc.values[i] !== undefined || !(v >= 0 && v < p.n)) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const events = [];
  t.values[i] = p.solution[i];
  delete t.notes[i];
  if (p.solution[i] !== v) {
    t.wrong.push(i);
    t.mistakes += 1;
    events.push({ type: 'miss' });
  }
  finishIfDone(s, events);
  return { state: s, ok: true, events };
}

// 候補の印を付ける・外す（ミスにならない）。
export function scrollNote(state, i, v) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.kind !== 'sudo') return { state, ok: false };
  const p = sc.puzzle;
  if (!(i >= 0 && i < p.solution.length) || p.givens.includes(i) || sc.values[i] !== undefined || !(v >= 0 && v < p.n)) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const cur = t.notes[i] ?? [];
  t.notes[i] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort((a, b) => a - b);
  if (!t.notes[i].length) delete t.notes[i];
  return { state: s, ok: true };
}

// ───── 弓の巻物（鏡で光を通す。判定表 第18回 C） ─────
// 巻物の状態：{ kind: 'beam', node, level, puzzle, placed: { マス: 1|2 }, xs: [自分の×], sureX: [分かった空き], wrong, mistakes, techs, hints }

export function beamLeft(sc) {
  const p = sc.puzzle;
  let n = 0;
  for (let i = 0; i < p.solution.length; i++) {
    if (p.solution[i] !== SLASH && p.solution[i] !== BACK) continue;
    if (!p.shown.includes(i) && sc.placed[i] === undefined) n += 1;
  }
  return n;
}

// 今の盤（見えている鏡・置いた鏡・岩）。未定は空き。光を描くのに使う。
export function beamCells(sc) {
  const p = sc.puzzle;
  return p.solution.map((v, i) => (v === ROCK ? ROCK : p.shown.includes(i) ? v : sc.placed[i] ?? 0));
}

// 鏡 v（1＝／、2＝＼）を置く。答えと違えばミス：そこが鏡なら正しい向きに直り、空きなら確かな空きになる（C3）。
export function scrollMirror(state, i, v) {
  const sc = state.dojo?.scroll;
  if (!sc || sc.kind !== 'beam') return { state, ok: false };
  const p = sc.puzzle;
  if (!(i >= 0 && i < p.solution.length) || p.solution[i] === ROCK || p.shown.includes(i) || sc.placed[i] !== undefined || sc.sureX.includes(i) || sc.xs.includes(i)) return { state, ok: false };
  if (v !== SLASH && v !== BACK) return { state, ok: false };
  const s = clone(state);
  const t = s.dojo.scroll;
  const events = [];
  const right = p.solution[i];
  if (right === v) {
    t.placed[i] = v;
  } else {
    t.wrong.push(i);
    t.mistakes += 1;
    events.push({ type: 'miss' });
    if (right === SLASH || right === BACK) t.placed[i] = right;
    else t.sureX.push(i);
  }
  finishIfDone(s, events);
  return { state: s, ok: true, events };
}

// 魔法と弓の修行中の技：マスの答えを見せる（第18回 E・F。巻物での手がかりは data/magic.js・bow.js）。
function revealTech(t, tech, i) {
  const p = t.puzzle;
  const w = t.kind === 'sudo' ? p.n : p.w;
  const h = t.kind === 'sudo' ? p.n : p.h;
  const x = i % w, y = Math.floor(i / w);
  const cellsAt = (list) => list.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < w && cy < h).map(([cx, cy]) => cy * w + cx);
  const reveal = (cells) => {
    for (const c of cells) {
      if (t.kind === 'sudo') {
        if (p.givens.includes(c) || t.values[c] !== undefined) continue;
        t.values[c] = p.solution[c];
        delete t.notes[c];
      } else {
        const v = p.solution[c];
        if (v === ROCK || p.shown.includes(c) || t.placed[c] !== undefined || t.sureX.includes(c)) continue;
        t.xs = t.xs.filter((j) => j !== c);
        if (v === SLASH || v === BACK) t.placed[c] = v;
        else t.sureX.push(c);
      }
    }
  };
  const row = Array.from({ length: w }, (_, k) => [k, y]);
  if (tech === 'kakyu') reveal(cellsAt([[x, y], [x + 1, y]]));
  else if (tech === 'hyoso') reveal(cellsAt([[x, y], [x, y + 1], [x, y + 2]]));
  else if (tech === 'raigeki') reveal(cellsAt([[x, y], [w - 1 - x, h - 1 - y]]));
  else if (tech === 'inseki') {
    const bw = p.n === 4 ? 2 : 3, bh = 2;
    const bx = Math.floor(x / bw) * bw, by = Math.floor(y / bh) * bh;
    const box = [];
    for (let yy = by; yy < by + bh; yy++) for (let xx = bx; xx < bx + bw; xx++) box.push([xx, yy]);
    reveal(cellsAt(box));
  } else if (tech === 'mahouken' || tech === 'ryuusei') reveal(cellsAt(row));
  else if (tech === 'rensha') reveal(cellsAt([[x, y], [x + 1, y], [x + 2, y]]));
  else if (tech === 'kazeya') reveal(cellsAt([[x, y], [x, y - 1], [x, y + 1]]));
  else if (tech === 'kooriya') reveal(cellsAt([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]));
  else if (tech === 'neraiuchi') {
    reveal(cellsAt([[x, y]]));
    const around = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) around.push([x + dx, y + dy]);
    t.hints.push({ tech, at: i, value: cellsAt(around).filter((c) => p.solution[c] === SLASH || p.solution[c] === BACK).length });
  } else return false;
  return true;
}
