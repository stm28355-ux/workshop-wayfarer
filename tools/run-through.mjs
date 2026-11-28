// 地域1〜3の通しを測るボット（ゲームには出ない。判定表 第11回 D2・D3）。
// node tools/run-through.mjs [分=100] [--snap=ファイル]
// 手は1つ：盤の1手は3秒、打ち分けは解く道具の一番の手順で打ち（3秒＋1手1.5秒）、巻物は1枚1分（ミスなし）。
// 手がふさがっている間は盤に触らない。地域のボスを倒したら次の地域へ進む。
// --from=r3：地域2のボスを倒した直後の、予定表どおりの状態（src/core/plan.js）から始める。

import {
  createGame, advance, feed, moveItem, chooseRegion, region, isOpen, basePrep,
  forgeStart, forgeStrike, forgeFire, forgeFinish, equipItem, buyUpgrade, upgradeCheck,
} from '../src/core/game.js';
import { move } from '../src/core/board.js';
import { rankValue } from '../src/core/rank.js';
import { heroStats } from '../src/core/gear.js';
import { startScroll, scrollOpen, levelOf, isNodeOpen } from '../src/core/dojo.js';
import { availableCards, slotCount, setLineup, compareDummy } from '../src/core/lineup.js';
import { TICKS_PER_SEC, HERO, PREP, KINDS } from '../src/data/balance.js';
import { GEAR, gearCost } from '../src/data/forge.js';
import { solve } from './forge-solve.mjs';
import { planAfterRegion2 } from '../src/core/plan.js';

const args = process.argv.slice(2);
const minutes = Number(args.find((a) => !a.startsWith('--')) ?? 100);
const from = args.find((a) => a.startsWith('--from='))?.slice(7);
const TOTAL = minutes * 60 * TICKS_PER_SEC;
// 試しの数値：--r3=drain:2,atk:9,shell:15,hp:100,step:3,every:12（地域3の道の敵・支度の減りをこの回だけ変える）
const r3arg = args.find((a) => a.startsWith('--r3='))?.slice(5);
if (r3arg) {
  const r3 = region(3);
  for (const kv of r3arg.split(',')) {
    const [k, v] = kv.split(':');
    const n = Number(v);
    if (k === 'drain') r3.drain = n;
    if (k === 'atk') r3.enemy.atk = n;
    if (k === 'every') r3.enemy.atkEvery = n;
    if (k === 'hp') r3.enemy.hp = n;
    if (k === 'step') r3.enemy.hpStep = n;
    if (k === 'shell') r3.enemy.traits = { shell: n };
    if (k === 'bshell') r3.boss.traits = { shell: n };
    if (k === 'bhp') r3.boss.hp = n;
    if (k === 'batk') r3.boss.atk = n;
  }
  console.log('地域3を試しの数値で：', JSON.stringify({ drain: r3.drain, enemy: r3.enemy, boss: r3.boss }));
}
const S = TICKS_PER_SEC;
const HAND = { board: 3 * S, forgeBase: 3 * S, forgeStep: 1.5 * S, scroll: 60 * S };
// 予定表（判定表 第11回 D1）：その地域を出る（ボスを初めて倒す）ときの目安
const PLAN = { 1: { min: 15, level: 7 }, 2: { min: 40, level: 9, weapon: 2, armor: 1 }, 3: { min: 75, level: 11, weapon: 2, armor: 2, slots: 4 } };
// 支度のほかの配り方（価値の割合）。地域1は育てる、地域2からは育てる・装備作り・工房
const SHARE = { 1: { grow: 0.9, forge: 0.1, workshop: 0 }, 2: { grow: 0.42, forge: 0.5, workshop: 0.08 } };
// 道場で上げる順（節, 目指す段）。並びの枠を増やす技の節を早めに。
const NODE_PLAN = [
  ['kamae', 1], ['kaeshi', 1], ['tateuchi', 1], ['ibuki', 1], ['ukenagashi', 1], ['seishin', 1], ['tame', 1],
  ['kamae', 2], ['kaeshi', 2], ['tateuchi', 3], ['tame', 3], ['uke', 1], ['mikiri', 1], ['fumikomi', 2], ['kamae', 4], ['kaeshi', 4],
  ['hada', 2], ['ibuki', 3], ['seishin', 3], ['kamae', 5], ['kaeshi', 5], ['fumikomi', 4], ['tateuchi', 5], ['tame', 5],
];

// ───── 盤 ─────
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
const value = (c) => rankValue(c.rank);
function lowest(board) {
  let idx = -1;
  board.cells.forEach((c, i) => { if (c && (idx < 0 || value(c) < value(board.cells[idx]))) idx = i; });
  return idx;
}

// ───── 支度の見積もり：残りの道（この地域で測った「1歩あたりの刻み」）＋ボス戦（測った長さ）─────
const obs = {}; // 地域 → { roadTicks, roadSteps, bossTicks }
function ob(id) {
  return (obs[id] ??= { roadTicks: 0, roadSteps: 0, bossTicks: 30 * S });
}
// 倒れている間は、届いた所の少し先までで足りる（それより先の支度は倒れて失う）
const reach = {}; // 地域 → 直近3回の出発で届いた歩数
function prepNeed(s) {
  const r = region(s.run.region);
  const o = ob(r.id);
  const rc = reach[r.id] ?? [];
  if (rc.length >= 2 && rc.every((x) => x.reason === 'down')) {
    const far = Math.max(...rc.map((x) => x.step)) + 60;
    const perStep0 = o.roadSteps > 200 ? o.roadTicks / o.roadSteps : 1.6 / HERO.walk;
    return Math.max(0, far - s.run.step) * perStep0 * r.drain;
  }
  const perStep = o.roadSteps > 200 ? o.roadTicks / o.roadSteps : 1.6 / HERO.walk;
  const left = Math.max(0, r.bossAt - s.run.step);
  const bossLeft = s.run.fight?.boss ? o.bossTicks * (s.run.fight.hp / s.run.fight.maxHp) : o.bossTicks;
  return (left * perStep + bossLeft * 1.15) * r.drain;
}

// ───── 打ち分け ─────
const solveCache = new Map();
function bestLog(kind, slot, tier, conc, fire) {
  const k = `${kind}:${slot}:${tier}:${conc}:${fire}`;
  if (!solveCache.has(k)) solveCache.set(k, solve(kind, slot, tier, conc, fire));
  return solveCache.get(k);
}
const GEAR_PLAN = [['iron', 'weapon'], ['copper', 'armor'], ['copper', 'weapon'], ['fire', 'accessory'], ['stone', 'accessory']];
let gearNext = 0;
// ボットは格2まで（格3・4 の9マスは解く道具が遅いので打たない。工程7b）
const BOT_TIER_MAX = 2;
function nextTier(s, kind, slot) {
  const it = s.gear.items[`${kind}:${slot}`];
  if (!it) return 1;
  if (it.tier < Math.min(GEAR.tierMax, BOT_TIER_MAX)) return it.tier + 1;
  for (let t = it.tier; t >= 1; t--) if ((it.adds?.[t] ?? 0) < GEAR.addCap) return t;
  return null;
}
// 燃料：炎の欠片3（火1回）＋ほかの欠片で集中力16まで。素材にする欠片の分は残す。
function fuelFor(s, kind, cost) {
  const stock = { ...s.stock.forge };
  if (KINDS[kind].group === 'shard') stock[kind] = (stock[kind] ?? 0) - cost;
  const fuel = {};
  let conc = 0;
  for (const k of ['stone', 'wind', 'ice', 'thunder', 'fire']) {
    const take = Math.min(stock[k] ?? 0, 16 - conc);
    if (take > 0) { fuel[k] = (fuel[k] ?? 0) + take; conc += take; stock[k] -= take; }
  }
  return conc >= 12 ? { fuel, conc, fire: Math.floor((fuel.fire ?? 0) / 3) } : null;
}
function tryForge(s) {
  if (!isOpen(s, 'stage:forge')) return null;
  for (let n = 0; n < GEAR_PLAN.length; n++) {
    const [kind, slot] = GEAR_PLAN[(gearNext + n) % GEAR_PLAN.length];
    const tier = nextTier(s, kind, slot);
    if (!tier) continue;
    const cost = gearCost(tier);
    if ((s.stock.forge[kind] ?? 0) < cost) continue;
    const f = fuelFor(s, kind, cost);
    if (!f) continue;
    const r = forgeStart(s, { kind, slot, tier, fuel: f.fuel });
    if (!r.ok) continue;
    const plan = bestLog(kind, slot, tier, f.conc, 0); // 火を足す手は探さない（探すと遅い。集中力16なら火なしでほぼ会心）
    let t = r.state;
    let done = null;
    for (const step of plan.log) {
      const x = step[0] === 'fire' ? forgeFire(t) : forgeStrike(t, step[0], step[1]);
      t = x.state;
      if (x.done) { done = x.done; break; }
    }
    if (!done) { const x = forgeFinish(t); t = x.state; done = x.done; }
    if (slot === 'armor' && t.gear.equip.armor !== `${kind}:${slot}`) t = equipItem(t, 'armor', `${kind}:${slot}`).state;
    if (slot === 'weapon') {
      // 毎秒の攻撃が大きい方の武器を持つ
      const dps = (x) => { const h = heroStats(x); return h.atk / h.attackTicks; };
      const other = equipItem(t, 'weapon', `${kind}:${slot}`).state;
      if (dps(other) > dps(t)) t = other;
    }
    gearNext = (gearNext + n + 1) % GEAR_PLAN.length;
    return { state: t, busy: HAND.forgeBase + HAND.forgeStep * plan.log.length, done };
  }
  return null;
}

// ───── 道場 ─────
function nextNode(s) {
  for (const [id, lv] of NODE_PLAN) if (levelOf(s, id) < lv && isNodeOpen(s, id)) return id;
  return null;
}
function trySCroll(s) {
  if (!isOpen(s, 'stage:dojo') || s.dojo.scroll) return null;
  const id = nextNode(s);
  if (!id) return null;
  let t = startScroll(s, id).state;
  const p = t.dojo.scroll.puzzle;
  for (let i = 0; i < p.mines.length && t.dojo.scroll; i++) if (!p.mines[i] && !t.dojo.scroll.opened.includes(i)) t = scrollOpen(t, i).state;
  return { state: setBestLineup(t), busy: HAND.scroll, node: id };
}
// 並び：溜め → 強斬り → 盾打ち を枠の数まで繰り返す（使える札だけ）
function setBestLineup(s) {
  const have = availableCards(s);
  const pattern = ['tame', 'strong', 'tateuchi'].filter((c) => have.includes(c));
  if (!pattern.length) return s;
  const n = slotCount(s);
  const list = Array.from({ length: n }, (_, i) => pattern[i % pattern.length]);
  return setLineup(s, 2, list).state;
}

// ───── 1手を選ぶ ─────
const fedBy = {}; // 地域 → 出口 → 価値
function noteFeed(regionId, exit, v) {
  const f = (fedBy[regionId] ??= { prep: 0, grow: 0, forge: 0, workshop: 0, overflow: 0 });
  f[exit] += v;
}
function chooseExit(s) {
  if (s.run.prep < prepNeed(s)) return 'prep';
  const share = SHARE[Math.min(2, s.run.region)];
  const f = fedBy[s.run.region] ?? { grow: 0, forge: 0, workshop: 0 };
  let best = null;
  for (const [x, w] of Object.entries(share)) {
    if (!w || !s.open.exits.includes(x)) continue;
    const total = (f.grow ?? 0) + (f.forge ?? 0) + (f.workshop ?? 0) + 1;
    const lack = w * total - (f[x] ?? 0);
    if (!best || lack > best.lack) best = { x, lack };
  }
  return best?.x ?? 'grow';
}
function handAct(s) {
  const b = s.board;
  const empty = b.cells.filter((c) => !c).length;
  const m = findMerge(b);
  if (m && (m.used === 5 || empty <= 6)) return { state: moveItem(s, m.from, m.to).state, busy: HAND.board, what: 'merge' };
  const big = b.cells.findIndex((c) => c && c.rank >= 3);
  if (big >= 0 || empty <= 3) {
    const i = big >= 0 ? big : lowest(b);
    const exit = chooseExit(s);
    const r = feed(s, i, exit);
    noteFeed(s.run.region, exit, r.value);
    return { state: r.state, busy: HAND.board, what: 'feed' };
  }
  if (m) return { state: moveItem(s, m.from, m.to).state, busy: HAND.board, what: 'merge' };
  // 盤に急ぎの手がなければ、工房・打ち分け・巻物
  for (const w of ['widen']) {
    if (upgradeCheck(s, w).ok) return { state: buyUpgrade(s, w).state, busy: HAND.board, what: 'shop' };
  }
  for (const w of ['speed', 'arm']) {
    if (upgradeCheck(s, w).ok) return { state: buyUpgrade(s, w).state, busy: HAND.board, what: 'shop' };
  }
  const f = tryForge(s);
  if (f) return { ...f, what: 'forge' };
  // 巻物は手の時間の4割まで（人の第8回：20分で22枚のときは盤があふれた）
  if (empty >= 8 && busyBy.scroll < 0.4 * (s.tick - startTick)) {
    const sc = trySCroll(s);
    if (sc) return { ...sc, what: 'scroll' };
  }
  return null;
}

// ───── 回す ─────
let s = from === 'r3' ? planAfterRegion2() : createGame();
const startTick = s.tick;
let handFree = s.tick;
const firstBoss = {};
const runs = []; // 地域3の出発ごと：刻み・拾った価値・帰った理由
let cur = { region: s.run.region, start: s.tick, picked: 0 };
let bossStart = null;
let roadMark = { tick: s.tick, step: 0 };
const busyBy = { board: 0, forge: 0, scroll: 0, shop: 0 };
while (s.tick < startTick + TOTAL) {
  if (s.tick >= handFree) {
    const a = handAct(s);
    if (a) {
      s = a.state;
      handFree = s.tick + a.busy;
      busyBy[a.what === 'merge' || a.what === 'feed' ? 'board' : a.what] += a.busy;
    } else handFree = s.tick + S;
  }
  const step = Math.max(1, Math.min(handFree - s.tick, 10));
  const r = advance(s, step);
  const before = s;
  s = r.state;
  for (const e of r.events) {
    if (e.type === 'pickup' || e.type === 'overflow') cur.picked += rankValue(e.item.rank);
    if (e.type === 'overflow') noteFeed(before.run.region, 'overflow', rankValue(e.item.rank));
    if (e.type === 'boss' && !firstBoss[e.region]) {
      firstBoss[e.region] = { tick: s.tick, level: s.hero.level, weapon: s.gear.items['iron:weapon']?.tier ?? 0, armor: s.gear.items['copper:armor']?.tier ?? 0, slots: slotCount(s) };
      // 次の地域へ
      const next = Math.max(...s.open.regions);
      s = chooseRegion(s, next).state;
    }
    if (e.type === 'return') {
      reach[e.region] = [...(reach[e.region] ?? []), { step: e.step, reason: e.reason }].slice(-3);
      if (cur.region === 3) runs.push({ ticks: s.tick - cur.start, picked: cur.picked, reason: e.reason, step: e.step, boss: before.run.fight?.boss ? `ボス残り${Math.round((before.run.fight.hp / before.run.fight.maxHp) * 100)}%・戦い${Math.round((s.tick - bossStart) / S)}秒` : '' });
      if (bossStart !== null && e.reason !== 'boss') {
        // ボス戦の途中で帰った：残りの HP から全体の長さを見積もる
        const f = before.run.fight;
        const done = f ? 1 - f.hp / f.maxHp : 0;
        if (done > 0.05) ob(e.region).bossTicks = Math.max(ob(e.region).bossTicks, (s.tick - bossStart) / done);
      }
      bossStart = null;
    }
    if (e.type === 'depart') { cur = { region: e.region, start: s.tick, picked: 0 }; roadMark = { tick: s.tick, step: 0 }; }
  }
  // 道の長さ（ボスの前まで）を測る
  if (s.run.fight?.boss && bossStart === null) {
    bossStart = s.tick;
    const o = ob(s.run.region);
    o.roadTicks += s.tick - roadMark.tick;
    o.roadSteps += s.run.step - roadMark.step;
  }
  if (before.run.fight?.boss && !s.run.fight && bossStart !== null) {
    ob(before.run.region).bossTicks = s.tick - bossStart;
    bossStart = null;
  }
}

// ───── 出力 ─────
const min = (t) => (t / S / 60).toFixed(1);
console.log(`通しのボット ${minutes}分（地域を出る＝ボスを初めて倒したとき）\n`);
console.log('| 地域 | ボス（分） | 目標 | レベル | 目安 | 武器の格 | 防具の格 | 枠 | 出発 | 支度切れ | 倒れ |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const id of [1, 2, 3]) {
  const fb = firstBoss[id];
  const p = PLAN[id];
  const br = s.stats.byRegion[id] ?? { departs: 0, prep: 0, down: 0 };
  console.log(`| ${id} | ${fb ? min(fb.tick) : '―'} | ${p.min} | ${fb?.level ?? '―'} | ${p.level} | ${fb?.weapon ?? '―'} | ${fb?.armor ?? '―'} | ${fb?.slots ?? '―'} | ${br.departs} | ${br.prep} | ${br.down} |`);
}
console.log(`\n終わり：${min(s.tick)}分 レベル${s.hero.level} 地域${s.run.region}（一番遠く ${s.run.step}歩）`);
const h = heroStats(s);
console.log(`勇者：攻撃 ${h.atk.toFixed(1)}・HP ${h.maxHp.toFixed(0)}・盾 ${h.guard.toFixed(1)}・受け ×${h.taken.toFixed(2)}`);
console.log(`装備：${Object.entries(s.gear.items).map(([k, it]) => `${k} 格${it.tier}（加算${Object.values(it.adds ?? {}).reduce((a, v) => a + v, 0)}）`).join('・')}`);
console.log(`節：${Object.entries(s.dojo.nodes).map(([k, v]) => `${k}${levelOf(s, k)}`).join(' ')}　枠${slotCount(s)}`);
console.log(`手の時間：盤 ${min(busyBy.board)}分・打ち分け ${min(busyBy.forge)}分・巻物 ${min(busyBy.scroll)}分`);
for (const [id, f] of Object.entries(fedBy)) {
  const total = f.prep + f.grow + f.forge + f.workshop + f.overflow;
  console.log(`地域${id}の配り方（価値）：支度 ${pct(f.prep + f.overflow, total)}（あふれ ${pct(f.overflow, total)}）・育てる ${pct(f.grow, total)}・装備 ${pct(f.forge, total)}・工房 ${pct(f.workshop, total)}`);
}
function pct(a, b) { return `${Math.round((a / Math.max(1, b)) * 100)}%`; }
if (runs.length) {
  // 入口からボスまでに要る支度：歩き切った出発の長さ × 減り − 出発の支度、を価値に直して拾った価値と比べる
  const r3 = region(3);
  const full = runs.filter((r) => r.reason === 'boss' || r.step >= r3.bossAt);
  console.log(`\n地域3の出発 ${runs.length}回（ボスまで届いた ${full.length}回）`);
  for (const r of runs.slice(0, 40)) {
    const needValue = Math.max(0, r.ticks * r3.drain - basePrep(3)) / PREP.perValue;
    console.log(`  ${(r.ticks / S).toFixed(0)}秒 ${r.step}歩 ${r.reason} ${r.boss}：要る支度 ${needValue.toFixed(0)} ／ 拾った ${r.picked}（${pct(needValue, r.picked)}）`);
  }
}
const cards = availableCards(s);
if (cards.length) {
  const list = Array.from({ length: slotCount(s) }, (_, i) => ['tame', 'strong', 'tateuchi'].filter((c) => cards.includes(c))[i % 3] ?? 'strong');
  const c = compareDummy(s, list, 'shell');
  console.log(`木人（殻）：並び ${list.join(',')} ×${c.ratio?.toFixed(2)}`);
}
