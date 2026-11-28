// 工程7e：敵の属性（弱点と耐性）・魔王の城・魔王・終わり。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advance, region, enemyAt, restartRun } from '../src/core/game.js';
import { newLine, heroAct, enemyElem, elemMult } from '../src/core/lineup.js';
import { WEAKNESS } from '../src/data/cards.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';

function ctxOf(cards, f = {}) {
  const hero = { atk: 10, attackTicks: 10, maxHp: 100, guard: 0, taken: 1, cast: 1 };
  const fight = { hp: 1e9, maxHp: 1e9, atk: 5, enemyTicks: 10, heroCd: 0, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, start: 0, ...f };
  return { tick: 0, hero, cards, levels: {}, recast: 20, line: newLine(), f: fight, run: { hp: 100 }, events: [] };
}

test('属性：弱点は1.5倍、同じ属性は半分。水をまとった技は水の技', () => {
  assert.deepEqual(WEAKNESS, { fire: 'water', ice: 'fire', thunder: 'wind', water: 'thunder' });
  const f = { elem: 'ice' };
  assert.equal(elemMult(f, 0, 'fire'), 1.5);
  assert.equal(elemMult(f, 0, 'ice'), 0.5);
  assert.equal(elemMult(f, 0, 'thunder'), 1);
  assert.equal(elemMult(f, 0, null), 1);
  // 氷の敵に火球：攻撃×1.5×1.5
  const c = ctxOf(['kakyu'], { elem: 'ice' });
  assert.ok(Math.abs(heroAct(c) - 10 * 1.5 * 1.5) < 1e-9);
  // 火の敵に、水をまとった強斬り（水の技）：攻撃×3×1.5
  const w = ctxOf(['matou', 'strong'], { elem: 'fire' });
  heroAct(w);
  w.f.heroCd = 0;
  assert.ok(Math.abs(heroAct(w) - 10 * 3 * 1.5) < 1e-9);
});

test('魔王は15秒ごとに属性が変わる', () => {
  const f = { elemCycle: ['fire', 'ice', 'thunder', 'water'], elemSec: 15, start: 0 };
  assert.equal(enemyElem(f, 0), 'fire');
  assert.equal(enemyElem(f, 15 * TICKS_PER_SEC), 'ice');
  assert.equal(enemyElem(f, 45 * TICKS_PER_SEC), 'water');
  assert.equal(enemyElem(f, 60 * TICKS_PER_SEC), 'fire');
});

test('魔王の城の道の敵は 火（殻）・氷（盾）・雷（群れ）・水（回復）の順', () => {
  const t = [0, 1, 2, 3].map((i) => enemyAt(6, i).traits);
  assert.deepEqual(t.map((x) => x.elem), ['fire', 'ice', 'thunder', 'water']);
  assert.ok(t[0].shell && t[1].shield && t[2].swarm && t[3].regenPct);
  assert.equal(enemyAt(6, 4).traits.elem, 'fire');
  assert.deepEqual(region(6).unlocks, ['ending']);
});

test('魔王を倒すと終わりが開く', () => {
  let s = createGame();
  for (let id = 1; id <= 5; id++) {
    s.cleared.push(id);
    for (const key of region(id).unlocks) {
      const [what, arg] = key.split(':');
      if (what === 'region') s.open.regions.push(Number(arg));
      else if (what === 'exit') s.open.exits.push(arg);
      else s.open.unlocks.push(key);
    }
  }
  s.hero.level = 120; // 魔王を一撃で倒せる強さ
  s.nextRegion = 6;
  s = restartRun(s);
  s.run.wait = 0;
  s.run.prep = 1e12;
  s.run.step = region(6).bossAt - 1;
  s.run.nextEnemyAt = 1e9;
  let unlocked = false;
  for (let k = 0; k < 200 && !unlocked; k++) {
    const r = advance(s, 10);
    s = r.state;
    s.run.prep = 1e12;
    if (r.events.some((e) => e.type === 'unlock' && e.key === 'ending')) unlocked = true;
  }
  assert.ok(unlocked);
  assert.ok(s.open.unlocks.includes('ending'));
  assert.ok(s.cleared.includes(6));
});
