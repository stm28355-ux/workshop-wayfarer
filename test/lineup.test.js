import { test } from 'node:test';
import { GUARD_TREE } from '../src/data/dojo.js';
import assert from 'node:assert/strict';
import { createGame, advance } from '../src/core/game.js';
import { heroStats } from '../src/core/gear.js';
import {
  slotCount, availableCards, lineupFor, activeCards, setLineup, newLine, heroAct, enemyAct, tickFight, hitEnemy, runDummy, compareDummy, recastTicks,
} from '../src/core/lineup.js';
import { CARDS } from '../src/data/cards.js';

// 道場が開き、守りの節を全部 lv 段にした状態。
function withNodes(lv = 1) {
  const s = createGame();
  s.open.unlocks.push('stage:dojo');
  for (const id of ['kamae', 'uke', 'mikiri', 'hada', 'tategamae', 'kaeshi', 'tateuchi', 'fumikomi', 'kizu', 'ibuki', 'ukenagashi', 'seishin', 'tame', 'shingan']) s.dojo.nodes[id] = { skill: lv * 2 };
  return s;
}

// 決まった敵に ticks 刻み戦う（倒れない・敵も倒れない）。
function fight(state, cards, ticks, enemy = {}) {
  const hero = heroStats(state);
  const f = { hp: 1e9, maxHp: 1e9, atk: 1, enemyTicks: 10, heroCd: 1, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0, ...enemy };
  const line = newLine();
  const run = { hp: hero.maxHp };
  const levels = Object.fromEntries(cards.map((id) => [id, 1]));
  const ctx = { tick: 0, hero, cards, levels, recast: recastTicks(state), line, f, run, events: [] };
  let dealt = 0;
  const log = [];
  for (let t = 0; t < ticks; t++) {
    ctx.tick = t;
    tickFight(ctx);
    f.heroCd -= 1;
    if (f.heroCd <= 0) {
      const n = ctx.events.length;
      const d = heroAct(ctx);
      dealt += d;
      log.push({ t, d, events: ctx.events.slice(n) });
    }
    f.enemyCd -= 1;
    if (f.enemyCd <= 0) enemyAct(ctx);
  }
  return { dealt, log, ctx, hero };
}

test('枠は3から。技・札・奥義の節が 3/5 になるたびに ＋1、上限10', () => {
  assert.equal(slotCount(createGame()), 3);
  assert.equal(slotCount(withNodes(2)), 3);
  assert.equal(slotCount(withNodes(3)), 10, '守りの技・札・奥義は7節');
});

test('使える札：強斬りは道場で、守りの札は節が 1/5 で', () => {
  assert.deepEqual(availableCards(createGame()), []);
  const s = createGame();
  s.open.unlocks.push('stage:dojo');
  assert.deepEqual(availableCards(s), ['strong']);
  // 守りの節だけなら、剣の札は使えない
  const guardCards = Object.keys(CARDS).filter((id) => !CARDS[id].node || GUARD_TREE.some((n) => n.id === CARDS[id].node));
  assert.deepEqual(availableCards(withNodes(1)), guardCards);
});

test('並びは地域ごと。まだない地域は一つ前の並び。枠を超える札と使えない札は除く', () => {
  let s = withNodes(1);
  s = setLineup(s, 2, ['strong', 'tame', 'strong', 'mikiri']).state;
  assert.deepEqual(lineupFor(s, 2), ['strong', 'tame', 'strong'], '枠3まで');
  assert.deepEqual(lineupFor(s, 3), ['strong', 'tame', 'strong'], '地域3は地域2の並び');
  assert.deepEqual(lineupFor(s, 1), []);
  s.dojo.nodes.tame = { skill: 0 };
  assert.deepEqual(activeCards(s, 2), ['strong', 'strong'], '溜めの節が 0/5 なら使わない');
});

test('並びが空なら今と同じ：普通の攻撃だけ', () => {
  const s = createGame();
  const r = fight(s, [], 100);
  const hero = heroStats(s);
  assert.ok(Math.abs(r.dealt - hero.atk * 10) < 1e-9, '10秒で10回');
});

test('札は普通の攻撃の合間に順に使い、最後の後は積み直し（その間も普通の攻撃）', () => {
  const s = createGame();
  const hero = heroStats(s);
  const r = fight(s, ['strong'], 80);
  const first = r.log[0];
  assert.equal(first.events[0].id, 'strong');
  assert.ok(Math.abs(first.d - hero.atk * 3) < 1e-9);
  // 強斬りは2振り（20刻み）。その後は積み直し3秒の間、普通の攻撃
  assert.equal(r.log[1].t, 20);
  assert.equal(r.log[1].events.length, 0);
  const next = r.log.find((x) => x.events.some((e) => e.id === 'strong') && x.t > 0);
  assert.equal(next.t, 20 + 30, '最後の札が終わってから積み直し3秒');
});

test('修飾は次の技に掛かり、頭に戻っても消えない（第9回 A4）', () => {
  const s = withNodes(1);
  const hero = heroStats(s);
  const r = fight(s, ['strong', 'tame'], 200);
  const strongs = r.log.filter((x) => x.events.some((e) => e.id === 'strong'));
  assert.ok(Math.abs(strongs[0].d - hero.atk * 3) < 1e-9);
  assert.ok(Math.abs(strongs[1].d - hero.atk * 6) < 1e-9, '1周目の溜めが2周目の強斬りに掛かる');
});

test('条件：HP が半分以下でなければ次の1枚を飛ばす', () => {
  const s = withNodes(1);
  const r = fight(s, ['kizu', 'strong'], 5);
  const ev = r.log[0].events;
  assert.deepEqual(ev[0], { type: 'card', id: 'kizu', skip: true });
  assert.equal(ev.length, 1, '強斬りを飛ばして普通の攻撃');
});

test('殻は1回の攻撃から引かれ、盾打ちの崩しで半分になり、受けるダメージも増える', () => {
  const f = { hp: 1000, shell: 8, breakUntil: -1, shieldHits: 0 };
  assert.equal(hitEnemy(f, 10, 0), 2);
  assert.equal(hitEnemy(f, 5, 0), 0.5, '殻より小さくても1割は通る');
  f.breakUntil = 100;
  assert.ok(Math.abs(hitEnemy(f, 10, 0) - (13 - 4)) < 1e-9);
  const g = { hp: 1000, shieldHits: 2, breakUntil: -1 };
  assert.equal(hitEnemy(g, 10, 0), 0);
  assert.equal(hitEnemy(g, 10, 0), 0);
  assert.equal(hitEnemy(g, 10, 0), 10, '盾は2回まで');
});

test('守りの札：見切りでかわし、受け流しで返し、盾構えで半分、心眼で反撃', () => {
  const s = withNodes(1);
  let r = fight(s, ['mikiri'], 25);
  assert.ok(r.ctx.events.filter((e) => e.type === 'dodge').length === 1, '見切りで1回かわす');
  r = fight(s, ['ukenagashi'], 15, { atk: 7 });
  assert.ok(r.ctx.events.some((e) => e.type === 'parry'));
  r = fight(s, ['shingan'], 35);
  assert.equal(r.ctx.events.filter((e) => e.type === 'focus').length, 2, '心眼の2.5秒で2回かわして反撃');
  const hp0 = heroStats(s).maxHp;
  r = fight(s, ['tategamae'], 15, { atk: 10 });
  assert.ok(Math.abs(hp0 - r.ctx.run.hp - 10 * heroStats(s).taken * 0.5) < 1e-9, '盾構えの間は半分');
});

test('節の段が上がると札の効きが ＋10%/段', () => {
  const s = withNodes(5);
  const hero = heroStats(s);
  const f = { hp: 1e9, maxHp: 1e9, atk: 1, enemyTicks: 10, heroCd: 1, enemyCd: 10, breakUntil: -1, shell: 0, shieldHits: 0 };
  const ctx = { tick: 0, hero, cards: ['tateuchi'], levels: { tateuchi: 5 }, recast: 30, line: newLine(), f, run: { hp: 1 }, events: [] };
  const d = heroAct(ctx);
  assert.ok(Math.abs(d - hero.atk * 1.2 * 1.4) < 1e-9);
  assert.ok(Math.abs(f.breakUntil - 5 * 10 * 1.4) < 1e-9);
});

test('ゲームの戦いでも並びを使い、出発し直すと頭から', () => {
  let s = withNodes(1);
  s.open.regions.push(2);
  s = setLineup(s, 1, ['strong']).state;
  s.run.prep = 1e9;
  s.run.nextEnemyAt = 1;
  const r = advance(s, 3);
  assert.ok(r.events.some((e) => e.type === 'line' && e.id === 'strong'));
  assert.equal(r.state.run.line.pos, 0, '1枚なので頭に戻って積み直し');
  assert.ok(r.state.run.line.recast > 0);
});

test('木人：殻には強斬り＋崩し、群れには見切りが効く。並びなしと比べる', () => {
  const s = withNodes(1);
  const shellPlain = compareDummy(s, [], 'shell');
  assert.equal(shellPlain.ratio, 1);
  const shell = compareDummy(s, ['tateuchi', 'strong', 'strong'], 'shell');
  assert.ok(shell.ratio > 2, `殻に強斬り＋崩しは2倍以上（${shell.ratio}）`);
  const swarm = compareDummy(s, ['mikiri', 'mikiri', 'mikiri'], 'swarm');
  assert.ok(swarm.takenPerSec < swarm.plainTaken * 0.8, '見切りで受けるダメージが減る');
  const d = runDummy(s, ['strong', 'tame', 'strong'], 'plain');
  assert.ok(d.cycleSec > 3);
  assert.deepEqual(d.timeline.map((e) => e.id), ['strong', 'tame', 'strong']);
});

test('攻撃の速さの小さい伸びも効く（端数を持ち越す）。見せるときは0.01秒で切り上げ', async () => {
  const { intervalText } = await import('../src/core/gear.js');
  const s = createGame();
  s.dojo.nodes.seishin = { skill: 2 }; // 攻撃の速さ ＋2%
  const hero = heroStats(s);
  assert.ok(hero.attackTicks < 10);
  const r = fight(s, [], 1000);
  assert.equal(r.log.length, 102, '100秒で100回ではなく102回');
  assert.equal(intervalText(hero.attackTicks), '0.99');
  assert.equal(intervalText(10), '1');
  assert.equal(intervalText(14), '1.4');
});
