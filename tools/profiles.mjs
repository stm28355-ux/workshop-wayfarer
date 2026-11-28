// 予定表どおりの勇者（地域3〜6を出るとき）。tools/r4-sim.mjs と tools/region-time.mjs が使う（ゲームには出ない）。
// nodes の数は熟練（2で1段）。L4・L5・L6 の環境変数でレベルだけ変えて試せる。

import { region } from '../src/core/game.js';
import { applyCraft } from '../src/core/gear.js';
import { planAfterRegion2 } from '../src/core/plan.js';

// 予定表の勇者（判定表 第18回 G1：地域3を出るとき 技×3、地域4を出るとき ×4）
export const PROFILES4 = {
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

// 地域5（沼地：回復する敵）の勇者（工程7d。予定表：地域5を出るとき レベル15・格4・枠7）
export const PROFILES5 = {
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
export const PROFILES6 = {
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

// 地域 R に入る前の状態：地域 R−1 まで開け、勇者を p にする。
export function build(p, R) {
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

