// 地域4〜6 の「入ってから出るまで」の時間を測るボット（ゲームには出ない。工程9、Issue #25）。
// REGION=4|5|6 node tools/region-time.mjs [上限の分=240]
// 予定表どおりの「地域 R−1 を出るとき」の勇者（tools/profiles.mjs）で地域 R に入り、ボスを初めて倒すまで回す。
// 手は1つ：盤の1手は3秒。装備作りと巻物は答えを解かず、決まった手の時間を使ったことにする
// （装備は会心、巻物はミスなし。人より速い上の見積もり。tools/run-through.mjs と同じ考え）。
// 装備は「打つと勇者の強さ（毎秒の攻撃 × √もつ回数）が一番伸びる物」を、そのとき打てる一番上の格で打つ。
// 巻物は「地域 R を出るとき」の勇者の節へ向けて上げ、並びもその勇者の並びから使える札で組む。

import { advance, chooseRegion, retire, feed, moveItem, region, restartRun, buyUpgrade, upgradeCheck } from '../src/core/game.js';
import { move } from '../src/core/board.js';
import { rankValue } from '../src/core/rank.js';
import { applyCraft, heroStats, damageTaken } from '../src/core/gear.js';
import { isNodeOpen, levelOf } from '../src/core/dojo.js';
import { availableCards, slotCount, setLineup } from '../src/core/lineup.js';
import { TICKS_PER_SEC, HERO, KINDS } from '../src/data/balance.js';
import { GEAR, GEAR_KINDS, gearCost, bandOf } from '../src/data/forge.js';
import { SKILL } from '../src/data/dojo.js';
import { PLAN } from '../src/core/plan.js';
import { PROFILES4, PROFILES5, PROFILES6, build } from './profiles.mjs';

let R = Number(process.env.REGION ?? 4);
const CHAIN = !!process.env.CHAIN; // CHAIN=1：ボスを倒したら次の地域へ続ける（予定の勇者は最初の地域の入口だけ）
const LIMIT = Number(process.argv[2] ?? 240) * 60 * TICKS_PER_SEC;
const S = TICKS_PER_SEC;
const HAND = { board: 3 * S, scroll: 90 * S, forge: { 1: 20 * S, 2: 35 * S, 3: 50 * S } };
const SHARE = { grow: 0.42, forge: 0.5, workshop: 0.08 };
const CRIT = GEAR.crit;

const PAIRS = { 4: [PROFILES4.r3exit, PROFILES4.r4exit], 5: [PROFILES5.r4exit, PROFILES5.r5exit], 6: [PROFILES6.r5exit, PROFILES6.r6exit] };
let [enter, exit] = PAIRS[R];
// 数値をこの回だけ変えて試す：SET=4.boss.hp:5000,5.boss.traits.regenPct:0.02
for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split(':');
  const [id, ...keys] = path.split('.');
  let o = region(Number(id));
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys.at(-1)] = Number(v);
}

// ───── 勇者の強さ ─────
// 毎秒の攻撃 × √（ボスと道の敵の重い方の1回の当たりに何回もつか）。道の敵は群れなら当たりの数を掛ける。
function power(s) {
  const h = heroStats(s);
  const reg = region(R);
  const dps = h.atk / h.attackTicks;
  const hitOf = (atk, n = 1) => Math.max(1, damageTaken(atk, h.guard) * h.taken * n);
  const swarm = Math.max(1, ...(reg.enemy.traitCycle ?? [reg.enemy.traits ?? {}]).map((t) => t.swarm ?? 1));
  const hit = Math.max(hitOf(reg.boss.atk), hitOf(reg.enemy.atk, swarm) * 0.5);
  return dps * Math.sqrt(h.maxHp / hit);
}

// ───── 盤（tools/run-through.mjs と同じ手）─────
function findMerge(board) {
  let best = null;
  for (let from = 0; from < board.cells.length; from++) {
    if (!board.cells[from]) continue;
    for (let to = 0; to < board.cells.length; to++) {
      if (to === from) continue;
      const r = move(board, from, to);
      if (r.merged && (!best || r.merged.used > best.used || (r.merged.used === best.used && r.merged.from < best.rank))) best = { from, to, used: r.merged.used, rank: r.merged.from };
    }
  }
  return best;
}
function lowest(board) {
  let idx = -1;
  board.cells.forEach((c, i) => { if (c && (idx < 0 || rankValue(c.rank) < rankValue(board.cells[idx].rank))) idx = i; });
  return idx;
}

// 支度の見積もり：残りの道（測った1歩あたりの刻み）＋ボス戦（測った長さ）
let ob = { roadTicks: 0, roadSteps: 0, bossTicks: 60 * S };
let reach = [];
function prepNeed(s) {
  const r = region(s.run.region);
  const perStep = ob.roadSteps > 200 ? ob.roadTicks / ob.roadSteps : 1.6 / HERO.walk;
  if (reach.length >= 2 && reach.every((x) => x.reason === 'down')) {
    const far = Math.max(...reach.map((x) => x.step)) + 60;
    return Math.max(0, far - s.run.step) * perStep * r.drain;
  }
  const left = Math.max(0, r.bossAt - s.run.step);
  const bossLeft = s.run.fight?.boss ? ob.bossTicks * (s.run.fight.hp / s.run.fight.maxHp) : ob.bossTicks;
  return (left * perStep + bossLeft * 1.15) * r.drain;
}
let fed = { prep: 0, grow: 0, forge: 0, workshop: 0, overflow: 0 };
function chooseExit(s) {
  if (s.run.prep < prepNeed(s)) return 'prep';
  const total = fed.grow + fed.forge + fed.workshop + 1;
  let best = null;
  for (const [x, w] of Object.entries(SHARE)) {
    if (!s.open.exits.includes(x)) continue;
    const lack = w * total - fed[x];
    if (!best || lack > best.lack) best = { x, lack };
  }
  return best?.x ?? 'grow';
}

// ───── 装備（解かずに会心で打ったことにする）─────
function fuelFor(stock, kind, tier) {
  const cap = bandOf(tier).cap;
  const want = Math.round(cap * 0.75);
  const fuel = {};
  let conc = 0;
  for (const k of ['stone', 'wind', 'ice', 'thunder', 'fire']) {
    const have = (stock[k] ?? 0) - (k === kind ? gearCost(tier) : 0);
    const take = Math.min(Math.max(0, have), want - conc);
    if (take > 0) { fuel[k] = take; conc += take; }
  }
  return conc >= want ? fuel : null;
}
// その部類で持っている一番上の格（武器・防具は全部の素材、アクセサリーはその素材だけ）
function slotTop(s, slot, kind) {
  let top = 0;
  for (const it of Object.values(s.gear.items)) if (it.slot === slot && (slot !== 'accessory' || it.kind === kind)) top = Math.max(top, it.tier);
  return top;
}
function craftOptions(s) {
  const out = [];
  for (const [kind, g] of Object.entries(GEAR_KINDS)) {
    for (const slot of ['weapon', 'armor', 'accessory']) {
      if (!g[slot]) continue;
      const item = s.gear.items[`${kind}:${slot}`];
      for (let tier = GEAR.tierMax; tier >= 1; tier--) {
        if ((s.stock.forge[kind] ?? 0) < gearCost(tier)) continue;
        if (item && tier <= item.tier && (item.adds?.[tier] ?? 0) >= GEAR.addCap) continue;
        if (slotTop(s, slot, kind) > tier) break; // 今の一番上の格より下は打たない（貯めて上の格を打つ）
        const fuel = fuelFor(s.stock.forge, kind, tier);
        if (!fuel) continue;
        out.push({ kind, slot, tier, fuel });
        break; // 打てる一番上の格だけ
      }
    }
  }
  return out;
}
function withCraft(s, o) {
  const t = structuredClone(s);
  t.stock.forge[o.kind] -= gearCost(o.tier);
  for (const [k, v] of Object.entries(o.fuel)) t.stock.forge[k] -= v;
  t.gear.items = applyCraft(t.gear.items, o.kind, o.slot, o.tier, CRIT).items;
  if (o.slot !== 'accessory') {
    const key = `${o.kind}:${o.slot}`;
    const other = structuredClone(t);
    other.gear.equip[o.slot] = key;
    if (!t.gear.equip[o.slot] || power(other) > power(t)) t.gear.equip[o.slot] = key;
  }
  return t;
}
function tryForge(s) {
  const p0 = power(s);
  let best = null;
  for (const o of craftOptions(s)) {
    const t = withCraft(s, o);
    const gain = (power(t) - p0) / p0 / gearCost(o.tier);
    if (power(t) > p0 * 1.005 && (!best || gain > best.gain)) best = { state: t, gain, o };
  }
  if (!best) return null;
  crafts.push(`${best.o.kind}:${best.o.slot} 格${best.o.tier}`);
  let t = relineup(best.state);
  if (best.o.slot !== 'accessory') {
    // 持ち替えるかは、ボスと試しに戦って決める（強さの見積もりは盾と HP の比べ方が粗い）
    const old = structuredClone(best.state);
    old.gear.equip[best.o.slot] = s.gear.equip[best.o.slot];
    const u = relineup(old);
    if (duelNow(u) > duelNow(t)) t = u;
  }
  return { state: t, busy: HAND.forge[bandOf(best.o.tier).id], what: 'forge' };
}

// ───── 巻物（解かずにミスなしで解いたことにする）と並び ─────
function nextNode(s) {
  for (const [id, want] of Object.entries(exit.nodes)) {
    const have = s.dojo.nodes[id]?.skill ?? 0;
    if (have < want && isNodeOpen(s, id)) return id;
  }
  return null;
}
// ボスとだけ戦う（HP 満タンで、ボスの手前から）。勝てば 1000−秒、負ければ削った割合×100。
function bossDuel(s0, list) {
  let s = setLineup(structuredClone(s0), R, list).state;
  s.nextRegion = R;
  s = restartRun(s);
  s.run.prep = 1e15;
  s.run.hp = heroStats(s).maxHp;
  s.run.step = region(R).bossAt - 1;
  s.run.nextEnemyAt = 1e9;
  for (let t = 0; t < 5 * 60 * S; t += 5) {
    const r = advance(s, 5);
    const f = s.run.fight;
    s = r.state;
    s.run.prep = 1e15;
    for (const e of r.events) {
      if (e.type === 'boss') return 1000 - t / S;
      if (e.type === 'return') return f ? (1 - f.hp / f.maxHp) * 100 : 0;
    }
  }
  return s.run.fight ? (1 - s.run.fight.hp / s.run.fight.maxHp) * 100 : 0;
}
// 並び：予定の勇者の並びから使える札だけで組み、ボスと戦わせて一番よい物（人もボスに合わせて組み直す）
function bestLineup(s) {
  const have = new Set(availableCards(s));
  const n = slotCount(s);
  const seen = new Set();
  let best = [], score = -1;
  for (const list of [...(exit.tries ?? [exit.lineup]), ...(enter.tries ?? [enter.lineup])]) {
    const l = list.filter((c) => have.has(c)).slice(0, n);
    const key = l.join(',');
    if (!l.length || seen.has(key)) continue;
    seen.add(key);
    const sc = bossDuel(s, l);
    if (sc > score) { score = sc; best = l; }
  }
  return best;
}
// 今の並びでボスと戦った点
function duelNow(s) {
  return bossDuel(s, s.lineup?.byRegion?.[R] ?? []);
}
function relineup(s) {
  return setLineup(s, R, bestLineup(s)).state;
}
function tryScroll(s) {
  const id = nextNode(s);
  if (!id) return null;
  const t = structuredClone(s);
  const nd = t.dojo.nodes[id] ?? { skill: 0 };
  t.dojo.nodes[id] = { skill: nd.skill + SKILL.clear };
  scrolls += 1;
  return { state: relineup(t), busy: HAND.scroll, what: 'scroll' };
}

// ───── 1手 ─────
function handAct(s) {
  const b = s.board;
  const empty = b.cells.filter((c) => !c).length;
  const m = findMerge(b);
  if (m && (m.used === 5 || empty <= 6)) return { state: moveItem(s, m.from, m.to).state, busy: HAND.board, what: 'board' };
  const big = b.cells.findIndex((c) => c && c.rank >= 3);
  if (big >= 0 || empty <= 3) {
    const i = big >= 0 ? big : lowest(b);
    const x = chooseExit(s);
    const r = feed(s, i, x);
    fed[x] += r.value;
    return { state: r.state, busy: HAND.board, what: 'board' };
  }
  if (m) return { state: moveItem(s, m.from, m.to).state, busy: HAND.board, what: 'board' };
  for (const w of ['widen', 'speed', 'arm']) if (upgradeCheck(s, w).ok) return { state: buyUpgrade(s, w).state, busy: HAND.board, what: 'board' };
  const f = tryForge(s);
  if (f) return f;
  if (empty >= 8 && busy.scroll < 0.4 * (s.tick - start)) return tryScroll(s);
  return null;
}

// ───── 回す ─────
let s = build(enter, R);
s = relineup(s);
s.nextRegion = R;
s = restartRun(s);
s.run.hp = heroStats(s).maxHp;
let start, crafts, scrolls, busy;
const min = (t) => (t / S / 60).toFixed(1);
let sum = 0, sumPlan = 0;
for (;;) {
  start = s.tick;
  crafts = []; scrolls = 0; busy = { board: 0, forge: 0, scroll: 0 };
  ob = { roadTicks: 0, roadSteps: 0, bossTicks: 60 * S }; reach = []; fed = { prep: 0, grow: 0, forge: 0, workshop: 0, overflow: 0 };
  const counts = { departs: 1, down: 0, prep: 0, bossTries: 0 };
  const tries = []; // ボスに負けた回：入ってからの分と、削った割合
  const level0 = s.hero.level, p0 = power(s);
  let handFree = s.tick, bossStart = null, roadMark = { tick: s.tick, step: 0 }, done = null;
  while (s.tick - start < LIMIT && !done) {
    if (s.tick >= handFree) {
      const a = handAct(s);
      if (a) { s = a.state; handFree = s.tick + a.busy; busy[a.what] += a.busy; } else handFree = s.tick + S;
    }
    const before = s;
    const r = advance(s, Math.max(1, Math.min(handFree - s.tick, 10)));
    s = r.state;
    for (const e of r.events) {
      if (e.type === 'overflow') fed.overflow += rankValue(e.item.rank);
      if (e.type === 'boss' && e.region === R) done = s.tick;
      if (e.type === 'return') {
        reach = [...reach, { step: e.step, reason: e.reason }].slice(-3);
        if (e.reason === 'down') counts.down += 1;
        if (e.reason === 'prep') counts.prep += 1;
        if (bossStart !== null) {
          const f = before.run.fight;
          const frac = f ? 1 - f.hp / f.maxHp : 0;
          tries.push(`${min(s.tick - start)}分 ${Math.round(frac * 100)}%`);
          if (frac > 0.05) ob.bossTicks = Math.max(ob.bossTicks, (s.tick - bossStart) / frac);
        }
        bossStart = null;
      }
      if (e.type === 'depart') { counts.departs += 1; roadMark = { tick: s.tick, step: 0 }; }
    }
    if (s.run.fight?.boss && bossStart === null) {
      bossStart = s.tick;
      counts.bossTries += 1;
      ob.roadTicks += s.tick - roadMark.tick;
      ob.roadSteps += s.run.step - roadMark.step;
    }
  }
  const plan = PLAN.find((p) => p.region === R), prev = PLAN.find((p) => p.region === R - 1);
  const h = heroStats(s);
  sum += (done ?? s.tick) - start;
  sumPlan += plan.min - prev.min;
  console.log(`■ ${region(R).name}（地域${R}）：入ってからボスを初めて倒すまで ${done ? min(done - start) + '分' : `倒せない（${min(LIMIT)}分）`}　予定 ${plan.min - prev.min}分`);
  console.log(`  出発 ${counts.departs}・倒れ ${counts.down}・支度切れ ${counts.prep}・ボスに届いた ${counts.bossTries}（負けた回：${tries.join('、')}）`);
  console.log(`  レベル ${level0} → ${s.hero.level}（予定 ${plan.level}）・強さ ×${(power(s) / p0).toFixed(2)}・攻撃 ${h.atk.toFixed(0)}・HP ${h.maxHp.toFixed(0)}`);
  console.log(`  装備：${Object.values(s.gear.items).map((it) => `${it.kind}:${it.slot} 格${it.tier}`).join('・')}　持つ：${s.gear.equip.weapon}・${s.gear.equip.armor}`);
  console.log(`  打った ${crafts.length}回：${crafts.join('、')}`);
  console.log(`  巻物 ${scrolls}枚・枠 ${slotCount(s)}・並び ${bestLineup(s).join(' ')}`);
  console.log(`  手の時間：盤 ${min(busy.board)}分・装備 ${min(busy.forge)}分・巻物 ${min(busy.scroll)}分`);
  const total = Object.values(fed).reduce((a, v) => a + v, 0);
  console.log(`  配り方（価値）：${Object.entries(fed).map(([k, v]) => `${k} ${Math.round((v / Math.max(1, total)) * 100)}%`).join('・')}`);
  if (!CHAIN || !done || R >= 6) break;
  R += 1;
  [enter, exit] = PAIRS[R];
  s = chooseRegion(s, R).state;
  if (s.run.region !== R) s = retire(s).state; // ボスを倒した直後の出発は前の地域に向いているので、帰って出直す
  s = relineup(s);
}
if (CHAIN) console.log(`\n合わせて ${min(sum)}分（予定 ${sumPlan}分）`);
void levelOf; void KINDS;
