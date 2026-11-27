import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, migrate } from '../src/core/game.js';
import { heroStats } from '../src/core/gear.js';
import {
  levelOf, isNodeOpen, nodeStats, scrollSpec, techsFor, nodeOf, startScroll, scrollOpen, scrollFlag, scrollTech, quitScroll, scrollCheck,
} from '../src/core/dojo.js';
import { solve, difficulty } from '../src/core/scroll.js';
import { GUARD_TREE } from '../src/data/dojo.js';

function opened() {
  const s = createGame();
  s.open.unlocks.push('stage:dojo');
  return s;
}

// 巻物を解く道具の手順どおりに開けて解く。罠を開ける回数 miss を先にやる。
function solveScroll(s, miss = 0) {
  const p = s.dojo.scroll.puzzle;
  let st = s;
  const events = [];
  for (let k = 0; k < miss; k++) {
    const m = p.mines.findIndex((x, i) => x && !st.dojo.scroll.wrong.includes(i));
    const r = scrollOpen(st, m);
    st = r.state;
    events.push(...r.events);
  }
  const plan = solve(p);
  for (const step of plan.steps) {
    for (const i of step.safe) {
      if (!st.dojo.scroll || st.dojo.scroll.opened.includes(i)) continue;
      const r = scrollOpen(st, i);
      st = r.state;
      events.push(...r.events);
    }
  }
  return { state: st, events };
}

test('守りは15節。根だけが最初から開いていて、親が 1/5 で子が開く', () => {
  assert.equal(GUARD_TREE.length, 15);
  const s = opened();
  assert.equal(isNodeOpen(s, 'kamae'), true);
  assert.equal(isNodeOpen(s, 'uke'), false);
  s.dojo.nodes.kamae = { skill: 2 };
  assert.equal(levelOf(s, 'kamae'), 1);
  assert.equal(isNodeOpen(s, 'uke'), true);
  assert.equal(isNodeOpen(s, 'kaeshi'), true);
  assert.equal(isNodeOpen(s, 'mikiri'), false);
});

test('奥義は3本の枝の先の節のうち2つ、剣盾は剣の流派まで閉じている', () => {
  const s = opened();
  s.dojo.nodes.tategamae = { skill: 2 };
  assert.equal(isNodeOpen(s, 'shingan'), false);
  s.dojo.nodes.tame = { skill: 2 };
  assert.equal(isNodeOpen(s, 'shingan'), true);
  s.dojo.nodes.tateuchi = { skill: 2 };
  assert.equal(isNodeOpen(s, 'kenjun'), false);
  assert.match(scrollCheck(s, 'kenjun').reason, /剣/);
});

test('小さい節は1段ごとに強さが足され、勇者の強さに入る', () => {
  const s = opened();
  const base = heroStats(s);
  s.dojo.nodes.kamae = { skill: 10 }; // 5/5：HP +20%
  s.dojo.nodes.kaeshi = { skill: 4 }; // 2/5：攻撃 +6%
  s.dojo.nodes.uke = { skill: 6 }; // 3/5：受けるダメージ −6%
  const t = nodeStats(s);
  assert.ok(Math.abs(t.hp - 0.2) < 1e-9 && Math.abs(t.atk - 0.06) < 1e-9);
  const st = heroStats(s);
  assert.ok(Math.abs(st.maxHp - base.maxHp * 1.2) < 1e-9);
  assert.ok(Math.abs(st.atk - base.atk * 1.06) < 1e-9);
  assert.ok(Math.abs(st.taken - 0.94) < 1e-9);
});

test('巻物の形：小さい節は 2/5 まで土台 5×5、技の節は段で変えが増える', () => {
  const small = scrollSpec(nodeOf('kamae'), 0);
  assert.deepEqual([small.w, small.count, small.rules, small.maxGlobal], [5, 5, [], 0]);
  assert.equal(scrollSpec(nodeOf('kamae'), 2).w, 6);
  const t0 = scrollSpec(nodeOf('mikiri'), 0);
  assert.deepEqual([t0.w, t0.count, t0.rules], [5, 6, ['cross']]);
  assert.deepEqual(scrollSpec(nodeOf('mikiri'), 2).rules, ['cross']);
  assert.equal(scrollSpec(nodeOf('mikiri'), 2).w, 6);
  assert.deepEqual(scrollSpec(nodeOf('mikiri'), 3).rules, ['cross', 'connect']);
  assert.deepEqual(scrollSpec(nodeOf('tateuchi'), 4).rules, ['pair', 'cross'], '組には連結でなく十字を重ねる');
});

test('どの節のどの段の巻物も作れて、推理だけで解ける（守り13節×5段の最初の1枚）', () => {
  for (const n of GUARD_TREE) {
    if (n.locked) continue;
    for (let lv = 0; lv < 5; lv++) {
      const s = opened();
      for (const x of GUARD_TREE) s.dojo.nodes[x.id] = { skill: Math.max(2, lv * 2) };
      s.dojo.nodes[n.id] = { skill: lv * 2 };
      const r = startScroll(s, n.id);
      assert.ok(r.ok, `${n.name} ${lv}/5：${r.reason}`);
      const p = r.state.dojo.scroll.puzzle;
      const sol = solve(p);
      assert.ok(sol.solved, `${n.name} ${lv}/5 が解けない`);
      assert.ok(difficulty(sol).by[3] <= scrollSpec(n, lv).maxGlobal, `${n.name} ${lv}/5 の盤全体の手が多い`);
    }
  }
});

test('巻物を解くと熟練3で1段上がる。ミス1回なら熟練2、最低1', () => {
  let s = startScroll(opened(), 'kamae').state;
  assert.equal(s.dojo.scroll.node, 'kamae');
  let r = solveScroll(s);
  const ev = r.events.find((e) => e.type === 'scroll');
  assert.deepEqual([ev.gain, ev.from, ev.to], [3, 0, 1]);
  assert.equal(r.state.dojo.scroll, null);
  assert.equal(r.state.dojo.nodes.kamae.skill, 3);
  s = startScroll(r.state, 'kamae').state;
  r = solveScroll(s, 1);
  assert.equal(r.events.find((e) => e.type === 'scroll').gain, 2);
  assert.equal(r.state.dojo.nodes.kamae.skill, 5);
  assert.equal(levelOf(r.state, 'kamae'), 2);
  assert.equal(r.state.stats.scrolls, 2);
});

test('同じ節でも、次の巻物は別の盤', () => {
  const s = opened();
  const a = startScroll(s, 'kamae').state;
  const b = startScroll(quitScroll(a).state, 'kamae').state;
  assert.notEqual(JSON.stringify(a.dojo.scroll.puzzle), JSON.stringify(b.dojo.scroll.puzzle));
});

test('印はメモ。開いたマスや罠と分かったマスには付かない', () => {
  const s = startScroll(opened(), 'kamae').state;
  const p = s.dojo.scroll.puzzle;
  const free = p.mines.findIndex((m, i) => !s.dojo.scroll.opened.includes(i));
  const f = scrollFlag(s, free).state;
  assert.deepEqual(f.dojo.scroll.flags, [free]);
  assert.deepEqual(scrollFlag(f, free).state.dojo.scroll.flags, []);
  assert.equal(scrollFlag(s, s.dojo.scroll.opened[0]).ok, false);
});

test('修行中の技：その節の技は段＋1回、ほかに覚えた技は1回', () => {
  const s = opened();
  s.dojo.nodes = { kamae: { skill: 2 }, uke: { skill: 2 }, mikiri: { skill: 4 }, kaeshi: { skill: 2 }, tateuchi: { skill: 2 } };
  assert.deepEqual(techsFor(s, nodeOf('mikiri'), 2), { mikiri: 3, tateuchi: 1 });
  assert.deepEqual(techsFor(s, nodeOf('kamae'), 1), { mikiri: 1, tateuchi: 1 });
});

test('技の効き：見切り・盾構え・盾打ち・受け流し・心眼', () => {
  const s = opened();
  s.dojo.nodes = { kamae: { skill: 2 }, uke: { skill: 2 }, mikiri: { skill: 2 }, hada: { skill: 2 }, tategamae: { skill: 2 }, kaeshi: { skill: 2 }, tateuchi: { skill: 2 }, ibuki: { skill: 2 }, ukenagashi: { skill: 2 }, fumikomi: { skill: 2 }, kizu: { skill: 2 }, seishin: { skill: 2 }, tame: { skill: 2 } };
  let st = startScroll(s, 'shingan').state;
  const p = st.dojo.scroll.puzzle;
  const mine = p.mines.findIndex(Boolean);
  // 見切り：罠なら確かな印
  st = scrollTech(st, 'mikiri', mine).state;
  assert.ok(st.dojo.scroll.sure.includes(mine));
  assert.equal(scrollOpen(st, mine).ok, false, '確かな印のマスは開けない');
  // 盾構え・盾打ち：数が分かる
  st = scrollTech(st, 'tategamae', 0).state;
  assert.equal(st.dojo.scroll.hints[0].tech, 'tategamae');
  st = scrollTech(st, 'tateuchi', 0).state;
  const h = st.dojo.scroll.hints[1];
  assert.equal(h.row, p.mines.slice(0, p.w).filter(Boolean).length);
  assert.equal(scrollTech(st, 'tateuchi', 0).ok, false, '盾打ちは1回だけ（覚えた技）');
  // 受け流し：次のミスを数えない
  st = scrollTech(st, 'ukenagashi').state;
  const other = p.mines.findIndex((m, i) => m && i !== mine && !st.dojo.scroll.sure.includes(i));
  if (other >= 0) {
    const r = scrollOpen(st, other);
    assert.equal(r.state.dojo.scroll.mistakes, 0);
    assert.ok(r.events.some((e) => e.type === 'parry'));
  }
  // 心眼：3×3の罠に確かな印
  const c = p.mines.findIndex((m, i) => m && !st.dojo.scroll.sure.includes(i) && !st.dojo.scroll.wrong.includes(i));
  if (c >= 0) assert.ok(scrollTech(st, 'shingan', c).state.dojo.scroll.sure.includes(c));
});

test('道場は地域2のボスまで閉じている。版2の保存は道場を足して読める', () => {
  const s = createGame();
  assert.equal(startScroll(s, 'kamae').ok, false);
  const old = createGame();
  delete old.dojo;
  old.version = 2;
  const m = migrate(old);
  assert.equal(m.version, 3);
  assert.deepEqual(m.dojo, { nodes: {}, scroll: null, drawn: 0 });
  assert.equal(migrate({ version: 1 }), null);
});
