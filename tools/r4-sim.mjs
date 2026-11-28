// 地域4（雪山）・地域5（沼地）の戦いを測る道具（ゲームには出ない。判定表 第18回 G1・G3、工程7d）。
// REGION=5 で沼地。そのときの勇者は「地域4を出るとき」「地域5を出るとき」。
// 予定表どおりの「地域3を出るとき」「地域4を出るとき」の勇者で、雪山の道とボスを支度なしの制限で回す。
// node tools/r4-sim.mjs [--r4=hp:500,step:20,atk:10,every:10,shield:3,ssec:2,bhp:34000,batk:30,bshield:5,bssec:1.5]
// 出す物：技の並びの比（木人 素・盾）、道の敵1体の時間、ボスまでの時間と倒れた数、ボスを倒す時間（並びあり・なし）。

import { advance, region, restartRun } from '../src/core/game.js';
import { applyCraft, heroStats } from '../src/core/gear.js';
import { setLineup, compareDummy } from '../src/core/lineup.js';
import { planAfterRegion2 } from '../src/core/plan.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

const args = process.argv.slice(2);
const R = Number(process.env.REGION ?? 4);
const r4arg = args.find((a) => a.startsWith('--r4=') || a.startsWith('--rg='))?.slice(5);
if (r4arg) {
  const r = region(R);
  for (const kv of r4arg.split(',')) {
    const [k, v] = kv.split(':');
    const n = Number(v);
    if (k === 'hp') r.enemy.hp = n;
    if (k === 'step') r.enemy.hpStep = n;
    if (k === 'atk') r.enemy.atk = n;
    if (k === 'every') r.enemy.atkEvery = n;
    if (k === 'shield') r.enemy.traits = { ...r.enemy.traits, shield: n };
    if (k === 'ssec') r.enemy.traits = { ...r.enemy.traits, shieldSec: n };
    if (k === 'bhp') r.boss.hp = n;
    if (k === 'batk') r.boss.atk = n;
    if (k === 'bshield') r.boss.traits = { ...r.boss.traits, shield: n };
    if (k === 'bssec') r.boss.traits = { ...r.boss.traits, shieldSec: n };
    if (k === 'boss') r.bossAt = n;
    if (k === 'hits') r.enemy.hits = n;
    if (k === 'bhits') r.boss.hits = n;
    if (k === 'regen') r.enemy.traits = { ...r.enemy.traits, regenPct: n };
    if (k === 'bregen') r.boss.traits = { ...r.boss.traits, regenPct: n };
    if (k === 'drain') r.drain = n;
    if (k === 'bshell') r.boss.traits = { ...r.boss.traits, shell: n };
    if (k === 'scale') r.enemy.traitCycle = r.enemy.traitCycle?.map((t) => ({ ...t, ...(t.shell ? { shell: Math.round(t.shell * n) } : {}) }));
  }
}
const r4 = region(R);
console.log(`${r4.name}：`, JSON.stringify({ bossAt: r4.bossAt, enemy: r4.enemy, boss: r4.boss }));

// 予定表の勇者（判定表 第18回 G1：地域3を出るとき 技×3、地域4を出るとき ×4）
const PROFILES4 = {
  r3exit: {
    name: '地域3を出るとき（レベル11・剣と盾 格2）',
    level: 11,
    crafts: [['iron', 'weapon', 2, 0.9], ['iron', 'weapon', 2, 0.9], ['copper', 'armor', 2, 0.85], ['fire', 'accessory', 2, 0.9], ['stone', 'accessory', 1, 0.9]],
    nodes: { kamae: 4, kaeshi: 4, tateuchi: 4, ibuki: 2, tame: 4, nigiri: 4, suburi: 2, renda: 6, ashi: 2, nidan: 4, rikimi: 2, jujigiri: 6, togi: 2, issen: 6, funbari: 2, hanika: 2 },
    lineup: ['nidan', 'renda', 'renda', 'tame', 'issen'],
    // 盾の壁に合わせて人が組みそうな並び（一番よいボス戦の物を使う）
    tries: [
      ['nidan', 'renda', 'renda', 'tame', 'issen'],
      ['renda', 'renda', 'tame', 'issen'],
      ['nidan', 'renda', 'renda', 'jujigiri'],
      ['renda', 'renda', 'renda', 'jujigiri', 'tateuchi'],
      ['tategamae', 'renda', 'renda', 'tame', 'issen'],
    ],
  },
  r4exit: {
    name: '地域4を出るとき（レベル13・格3）',
    level: Number(process.env.L4 ?? 13), // L4=16 などでレベルだけ上げて試す
    crafts: [['iron', 'weapon', 3, 0.95], ['iron', 'weapon', 3, 0.95], ['copper', 'armor', 3, 0.9], ['fire', 'accessory', 2, 1], ['stone', 'accessory', 2, 0.9], ['thunder', 'accessory', 2, 0.9], ['wind', 'accessory', 2, 0.9]],
    nodes: {
      kamae: 6, kaeshi: 4, tateuchi: 6, ibuki: 2, tame: 6, nigiri: 6, suburi: 4, renda: 8, ashi: 4, nidan: 6, rikimi: 4, jujigiri: 8, togi: 2, issen: 8, funbari: 2, hanika: 2,
      eishou: 4, ikazuchinokokoro: 4, raigeki: 6, hinokokoro: 2, kakyu: 2, tsuru: 4, hayate: 4, rensha: 6,
    },
    lineup: ['raigeki', 'nidan', 'rensha', 'renda', 'tame', 'issen'],
    tries: [
      ['raigeki', 'nidan', 'rensha', 'renda', 'tame', 'issen'],
      ['nidan', 'rensha', 'renda', 'tame', 'issen', 'raigeki'],
      ['rensha', 'renda', 'tame', 'issen', 'raigeki', 'renda'],
      ['raigeki', 'rensha', 'tame', 'issen', 'tategamae', 'renda'],
      ['tategamae', 'nidan', 'rensha', 'renda', 'tame', 'issen'],
      ['nidan', 'rensha', 'rensha', 'renda', 'renda', 'jujigiri'],
    ],
  },
};

function build(p) {
  const s = planAfterRegion2();
  for (let id = 3; id < R; id++) {
    s.cleared.push(id);
    for (const key of region(id).unlocks) {
      const [what, arg] = key.split(':');
      if (what === 'region') { if (!s.open.regions.includes(Number(arg))) s.open.regions.push(Number(arg)); }
      else if (!s.open.unlocks.includes(key)) s.open.unlocks.push(key);
    }
  }
  s.hero.level = p.level;
  let items = {};
  for (const [k, slot, tier, q] of p.crafts) items = applyCraft(items, k, slot, tier, q).items;
  s.gear = { items, equip: { weapon: `${p.crafts[0][0]}:weapon`, armor: `${p.crafts.find((c) => c[1] === 'armor')[0]}:armor` } };
  for (const [id, v] of Object.entries(p.nodes)) s.dojo.nodes[id] = { skill: v };
  return s;
}

function withLineup(s, list) {
  return setLineup(s, R, list).state;
}

// 雪山を回す。支度は無限（倒れたら入口から）。ボスを倒すか limit 分で止める。
function runR4(s0, limitMin = Number(process.env.LIMIT ?? 30)) {
  let s = structuredClone(s0);
  s.nextRegion = R;
  s = restartRun(s);
  s.run.hp = heroStats(s).maxHp;
  s.run.prep = 1e15;
  const start = s.tick;
  let downs = 0, kills = 0, bossStart = null, bossTicks = null, firstEnemy = null, far = 0;
  const limit = limitMin * 60 * TICKS_PER_SEC;
  while (s.tick - start < limit) {
    const r = advance(s, TICKS_PER_SEC);
    s = r.state;
    s.run.prep = 1e15;
    for (const e of r.events) {
      if (e.type === 'return' && e.reason === 'down') downs += 1;
      if (e.type === 'kill') { kills += 1; if (firstEnemy === null) firstEnemy = (s.tick - start) / TICKS_PER_SEC; }
      if (e.type === 'boss') { bossTicks = s.tick - bossStart; return { downs, kills, bossStart: (bossStart - start) / TICKS_PER_SEC, bossSec: bossTicks / TICKS_PER_SEC, total: (s.tick - start) / TICKS_PER_SEC }; }
    }
    far = Math.max(far, s.run.enemyIndex ?? 0);
    if (s.run.fight?.boss && bossStart === null) bossStart = s.tick;
    if (!s.run.fight?.boss && bossStart !== null && bossTicks === null) bossStart = null; // 倒れてやり直し
  }
  return { downs, kills, bossStart: null, bossSec: null, total: null, firstEnemy, far };
}

// ボスとだけ戦う（HP 満タンで、ボスの手前から）。{ win, sec, hpLeft }
function bossDuel(s0) {
  let s = structuredClone(s0);
  s.nextRegion = R;
  s = restartRun(s);
  s.run.prep = 1e15;
  s.run.hp = heroStats(s).maxHp;
  s.run.step = region(R).bossAt - 1;
  s.run.nextEnemyAt = 1e9;
  for (let t = 0; t < 10 * 60 * TICKS_PER_SEC; t++) {
    const r = advance(s, 1);
    s = r.state;
    s.run.prep = 1e15;
    for (const e of r.events) {
      if (e.type === 'boss') return { win: true, sec: t / TICKS_PER_SEC };
      if (e.type === 'return' && e.reason === 'down') return { win: false, sec: t / TICKS_PER_SEC, left: s.run.fight ? 0 : null };
    }
  }
  return { win: false, sec: 600 };
}

// 道の敵1体の時間（入口の敵、並びあり）
function enemySeconds(s0) {
  let s = structuredClone(s0);
  s.nextRegion = R;
  s = restartRun(s);
  s.run.prep = 1e15;
  s.run.hp = heroStats(s).maxHp;
  let fightTicks = 0, kills = 0, hpLost = 0;
  for (let t = 0; t < 5 * 60 * TICKS_PER_SEC && kills < 10; t++) {
    const before = s.run.hp;
    const r = advance(s, 1);
    s = r.state;
    s.run.prep = 1e15;
    if (s.run.fight) { fightTicks += 1; hpLost += Math.max(0, before - s.run.hp); }
    for (const e of r.events) if (e.type === 'kill') kills += 1;
  }
  return { sec: fightTicks / TICKS_PER_SEC / Math.max(1, kills), hpLostPer: hpLost / Math.max(1, kills), maxHp: heroStats(s).maxHp };
}

// 地域5（沼地：回復する敵）の勇者（工程7d。予定表：地域5を出るとき レベル15・格4・枠7）
const PROFILES5 = {
  r4exit: { ...PROFILES4.r4exit, name: '地域4を出るとき（レベル13・格3）' },
  r5exit: {
    name: '地域5を出るとき（レベル15・格4）',
    level: Number(process.env.L5 ?? 15),
    crafts: [['iron', 'weapon', 4, 0.95], ['iron', 'weapon', 4, 0.95], ['copper', 'armor', 4, 0.9], ['fire', 'accessory', 3, 1], ['stone', 'accessory', 3, 0.9], ['thunder', 'accessory', 3, 0.9], ['wind', 'accessory', 3, 0.9]],
    nodes: {
      ...PROFILES4.r4exit.nodes,
      keiyaku: 4, kemonogoe: 4, ookami: 6, kehai: 4, dokuchishiki: 4, dokuba: 6, chougou: 2, nuri: 2,
    },
    lineup: ['dokuba', 'ookami', 'nidan', 'renda', 'tame', 'issen'],
    tries: [
      ['dokuba', 'ookami', 'nidan', 'renda', 'tame', 'issen'],
      ['nuri', 'tame', 'issen', 'ookami', 'renda', 'renda'],
      ['dokuba', 'nidan', 'renda', 'renda', 'tame', 'issen', 'ookami'],
      ['ookami', 'dokuba', 'tame', 'issen', 'raigeki', 'rensha'],
      ['nidan', 'renda', 'renda', 'tame', 'issen'],
    ],
  },
};
PROFILES5.r4exit.tries = [...(PROFILES4.r4exit.tries ?? []), ['nidan', 'renda', 'renda', 'tame', 'issen']];
// 地域6（魔王の城：属性と全部）の勇者（工程7e。予定表：地域6を出るとき レベル17・格5・枠8）
const PROFILES6 = {
  r5exit: { ...PROFILES5.r5exit, name: '地域5を出るとき（レベル15・格4）', level: 15 },
  r6exit: {
    name: '地域6を出るとき（レベル17・格5）',
    level: Number(process.env.L6 ?? 17),
    crafts: [['iron', 'weapon', 5, 0.95], ['iron', 'weapon', 5, 0.95], ['copper', 'armor', 5, 0.9], ['fire', 'accessory', 4, 1], ['stone', 'accessory', 4, 0.9], ['thunder', 'accessory', 4, 0.9], ['wind', 'accessory', 4, 0.9], ['ice', 'accessory', 4, 0.9]],
    nodes: {
      ...PROFILES5.r5exit.nodes,
      kakyu: 6, hyoso: 6, raigeki: 8, matou: 4, samuke: 2, mizunokokoro: 4, hinokokoro: 4, netsu: 2,
      kazeya: 6, kazeyomi: 4, ookami: 8, dokuba: 8, kagenui: 4, ashioto: 2, tsuranuki: 2, shinobi: 2, kemuri: 4, migaru: 2,
    },
    lineup: ['raigeki', 'rensha', 'tame', 'issen', 'dokuba', 'ookami', 'kakyu', 'kazeya'],
    tries: [
      ['raigeki', 'rensha', 'tame', 'issen', 'dokuba', 'ookami', 'kakyu', 'kazeya'],
      ['shinobi', 'tame', 'issen', 'raigeki', 'kakyu', 'kazeya', 'matou', 'raigeki'],
      ['nidan', 'rensha', 'renda', 'tame', 'issen', 'dokuba', 'ookami', 'raigeki'],
      ['matou', 'jujigiri', 'raigeki', 'kakyu', 'kazeya', 'hyoso', 'tame', 'issen'],
      ['ookami', 'ookami', 'raigeki', 'kazeya', 'kakyu', 'matou', 'jujigiri', 'tame'],
    ],
  },
};
PROFILES6.r5exit.tries = PROFILES5.r5exit.tries;
const PROFILES = R === 6 ? PROFILES6 : R === 5 ? PROFILES5 : PROFILES4;

for (const [key, p] of Object.entries(PROFILES)) {
  // ボス戦で一番よい並びを選ぶ（勝ちで一番速い、なければ一番長くもつ）
  let bestList = p.lineup, bestScore = -Infinity;
  for (const list of p.tries ?? [p.lineup]) {
    const d = bossDuel(withLineup(build(p), list));
    const score = d.win ? 1000 - d.sec : d.sec;
    if (score > bestScore) { bestScore = score; bestList = list; }
  }
  p.lineup = bestList;
  const s = withLineup(build(p), p.lineup);
  const h = heroStats(s);
  const plain = compareDummy(s, p.lineup, 'plain', 30).ratio;
  const shield = compareDummy(s, p.lineup, 'shield', 30).ratio;
  console.log(`\n■ ${p.name}：攻撃 ${h.atk.toFixed(1)}・HP ${h.maxHp.toFixed(0)}・並び ${p.lineup.join(' ')}`);
  console.log(`  技の並びの比：木人 素 ×${plain.toFixed(2)}・盾 ×${shield.toFixed(2)}（盾は並びなしの普通の攻撃との比）`);
  const en = enemySeconds(s);
  console.log(`  道の敵（入口から10体）：1体 ${en.sec.toFixed(1)}秒、1体で HP −${en.hpLostPer.toFixed(0)}（最大 ${en.maxHp.toFixed(0)}）`);
  const d1 = bossDuel(s);
  const d0 = bossDuel(withLineup(build(p), []));
  console.log(`  ボスだけ：並びあり ${d1.win ? '勝ち' : '負け'} ${d1.sec.toFixed(0)}秒・並びなし ${d0.win ? '勝ち' : '負け'} ${d0.sec.toFixed(0)}秒`);
  if (process.env.DUEL) continue;
  const a = runR4(s);
  console.log(`  並びあり：ボスまで ${a.bossStart === null ? `届かない（${a.far}体目まで）` : `${(a.bossStart / 60).toFixed(1)}分`}・倒れた ${a.downs}・ボスを倒す ${a.bossSec === null ? 'できない（30分）' : `${(a.bossSec / 60).toFixed(1)}分`}`);
  const b = runR4(withLineup(build(p), []));
  console.log(`  並びなし：ボスまで ${b.bossStart === null ? `届かない（${b.far}体目まで）` : `${(b.bossStart / 60).toFixed(1)}分`}・倒れた ${b.downs}・ボスを倒す ${b.bossSec === null ? 'できない（30分）' : `${(b.bossSec / 60).toFixed(1)}分`}`);
  void key;
}
