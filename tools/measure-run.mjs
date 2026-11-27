// 冒険とマージの進み方を測る道具（ゲームには出ない）。
// node tools/measure-run.mjs [分=15]
// 遊び方（手）をいくつか決めて、地域1を決まった時間だけ回し、数を並べる。乱数がないので毎回同じ結果。

import { createGame, advance, feed, moveItem, region } from '../src/core/game.js';
import { TICKS_PER_SEC } from '../src/data/balance.js';
import { rankValue } from '../src/core/rank.js';

const minutes = Number(process.argv[2] ?? 15);
const TOTAL = minutes * 60 * TICKS_PER_SEC;

// 合わせられる手を1つ探す（物を空きマスか物の上に動かして3個以上つながる手）。5個になる手を先に。
function findMerge(state) {
  const n = state.board.cells.length;
  let best = null;
  for (let from = 0; from < n; from++) {
    if (!state.board.cells[from]) continue;
    for (let to = 0; to < n; to++) {
      if (to === from) continue;
      const r = moveItem(state, from, to);
      if (r.merged && (!best || r.merged.used > best.used)) best = { from, to, used: r.merged.used };
    }
  }
  return best;
}

// 一番価値の低い物のマス。
function lowest(state) {
  let idx = -1;
  for (let i = 0; i < state.board.cells.length; i++) {
    const c = state.board.cells[i];
    if (c && (idx < 0 || rankValue(c.rank) < rankValue(state.board.cells[idx].rank))) idx = i;
  }
  return idx;
}

const policies = {
  // 手を出さない
  idle: () => null,
  // 拾った物をすぐ支度に入れる（合わせない）
  'すぐ支度': (s) => (lowest(s) >= 0 ? ['feed', lowest(s), 'prep'] : null),
  // 拾った物をすぐ育てるに入れる（合わせない）
  'すぐ育てる': (s) => (lowest(s) >= 0 ? ['feed', lowest(s), 'grow'] : null),
  // 合わせられたら合わせ、盤が埋まりかけたら低い物を入れる。支度が少ないときは支度、ほかは育てる
  // ランク3まで育った物は配る。盤が埋まりかけたら低い物も配る
  '合わせて配る': (s) => {
    const m = findMerge(s);
    if (m) return ['move', m.from, m.to];
    // ボスまで届く支度（歩く分と戦う分で、残りの歩数の1.6倍の刻み）が足りなければ支度、足りれば育てる
    const r = region(s.run.region);
    const need = (r.bossAt - s.run.step) * 1.6 * r.drain;
    const to = s.run.prep < need ? 'prep' : 'grow';
    const big = s.board.cells.findIndex((c) => c && c.rank >= 3);
    if (big >= 0) return ['feed', big, to];
    const empty = s.board.cells.filter((c) => !c).length;
    if (empty <= 3 && lowest(s) >= 0) return ['feed', lowest(s), to];
    return null;
  },
};

function run(name, policy, handEvery) {
  let s = createGame();
  let firstOverflow = null;
  let maxStep = 0;
  let bossAt = null;
  let actions = 0;
  for (let t = 0; t < TOTAL; t++) {
    if (handEvery && t % handEvery === 0) {
      const a = policy(s);
      if (a) {
        actions += 1;
        s = a[0] === 'feed' ? feed(s, a[1], a[2]).state : moveItem(s, a[1], a[2]).state;
      }
    }
    const r = advance(s, 1);
    s = r.state;
    maxStep = Math.max(maxStep, s.run.step);
    for (const e of r.events) {
      if (e.type === 'overflow' && firstOverflow === null) firstOverflow = s.tick;
      if (e.type === 'boss' && bossAt === null) bossAt = s.tick;
    }
  }
  const sec = (t) => (t === null ? '―' : `${Math.round(t / TICKS_PER_SEC)}秒`);
  return {
    name,
    '1手の間': handEvery ? `${handEvery / TICKS_PER_SEC}秒` : '―',
    '手の数': actions,
    '最初のあふれ': sec(firstOverflow),
    'あふれ': s.stats.overflow,
    '拾った': s.stats.picked,
    '合わせた': s.stats.merges,
    'レベル': s.hero.level,
    '一番遠く(歩)': maxStep,
    '帰った 支度/倒れ/ボス': `${s.stats.returns.prep}/${s.stats.returns.down}/${s.stats.returns.boss}`,
    'ボスを倒した': sec(bossAt),
  };
}

const rows = [
  run('idle', policies.idle, 0),
  run('すぐ支度', policies['すぐ支度'], 10),
  run('すぐ育てる', policies['すぐ育てる'], 10),
  run('合わせて配る（1秒に1手）', policies['合わせて配る'], 10),
  run('合わせて配る（3秒に1手）', policies['合わせて配る'], 30),
];

const keys = Object.keys(rows[0]);
console.log(`地域1を ${minutes} 分回した結果（数値は src/data/balance.js の仮の値）\n`);
console.log(`| ${keys.join(' | ')} |`);
console.log(`| ${keys.map(() => '---').join(' | ')} |`);
for (const r of rows) console.log(`| ${keys.map((k) => r[k]).join(' | ')} |`);
