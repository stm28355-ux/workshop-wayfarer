// 打ち分けの盤を解く道具（ゲームには出ない）。
// node tools/forge-solve.mjs                     … 全部の盤で、集中力と火の回数ごとの一番の出来を表にする
// node tools/forge-solve.mjs iron weapon 14 1    … 1つの盤（格1）の一番の手順を出す
// 同じ温度の間は叩く順番で結果が変わらないので、1段ごとに「叩く手の組み合わせ」を選ぶ形で探す。
// 見つけた手順は src/core/forge.js の replay で打ち直し、出来を確かめる。

import { pathToFileURL } from 'node:url';
import { GEAR_KINDS, STRIKES, TEMPS, BANDS } from '../src/data/forge.js';
import { newSession, strikeCells, replay, score, cellQuality } from '../src/core/forge.js';

// 盤の上の手（叩き方とマスの組）。縦打ちは同じ2マスを1通りに数える。
function movesOf(start) {
  const moves = [];
  const seen = new Set();
  for (const id of Object.keys(STRIKES)) {
    for (let c = 0; c < start.values.length; c++) {
      const cells = strikeCells(start, id, c);
      const key = `${id}:${cells.join('+')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push({ id, cell: c, cells, base: STRIKES[id].amount, cost: STRIKES[id].cost });
    }
  }
  return moves;
}

// moves から k 個選ぶ組み合わせ（同じ手を何度でも）を順に渡す。
function* multisets(n, k, from = 0) {
  if (k === 0) { yield []; return; }
  for (let i = from; i < n; i++) for (const rest of multisets(n, k - 1, i)) yield [i, ...rest];
}

function sumOf(values, targets) {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += cellQuality(values[i], targets[i]).q;
  return s;
}

export function solve(kind, slot, tier, conc, fire) {
  const start = newSession({ kind, slot, tier, conc, fire });
  const { targets, perLevel } = start;
  const moves = movesOf(start);
  const memo = new Map();
  // 段ごと・叩く回数ごとに、伸び方が同じ組み合わせは一番安い1つにまとめる。
  const options = TEMPS.map((t) => {
    const byK = [];
    for (let k = 1; k <= perLevel; k++) {
      const uniq = new Map();
      for (const pick of multisets(moves.length, k)) {
        const delta = targets.map(() => 0);
        let cost = 0;
        let zero = false;
        for (const m of pick) {
          const amt = Math.floor(moves[m].base * t.mult);
          if (amt === 0) zero = true;
          cost += moves[m].cost;
          for (const c of moves[m].cells) delta[c] += amt;
        }
        if (zero) continue;
        const key = delta.join(',');
        const old = uniq.get(key);
        if (!old || cost < old.cost) uniq.set(key, { delta, cost, steps: pick.map((m) => [moves[m].id, moves[m].cell]) });
      }
      byK[k] = [...uniq.values()];
    }
    return byK;
  });
  // 段 temp の頭にいるときの一番：{ sum, plan }（plan は段ごとの手の並び。'fire' は火を足す）
  function rec(values, temp, conc, fire) {
    const key = `${values.join(',')}|${temp}|${conc}|${fire}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let best = { sum: sumOf(values, targets), plan: [] };
    if (fire > 0 && temp > 0) {
      const r = rec(values, temp - 1, conc, fire - 1);
      if (r.sum > best.sum) best = { sum: r.sum, plan: ['fire', ...r.plan] };
    }
    if (temp <= 2) {
      for (let k = 1; k <= perLevel; k++) {
        for (const o of options[temp][k]) {
          if (o.cost > conc) continue;
          const v = values.map((x, i) => x + o.delta[i]);
          if (v.some((x, i) => x > targets[i] + 1)) continue;
          const cost = o.cost;
          const steps = o.steps;
          if (k < perLevel) {
            // 段の途中でやめる＝そこで仕上げる
            const s = sumOf(v, targets);
            if (s > best.sum) best = { sum: s, plan: steps };
          } else {
            const r = rec(v, temp + 1, conc - cost, fire);
            if (r.sum > best.sum || (r.sum === best.sum && steps.length + r.plan.length < best.plan.length)) {
              best = { sum: r.sum, plan: [...steps, ...r.plan] };
            }
          }
        }
      }
    }
    memo.set(key, best);
    return best;
  }
  const r = rec(start.values, 0, conc, fire);
  const log = r.plan.map((p) => (p === 'fire' ? ['fire'] : p));
  const end = replay(start, log);
  if (!end || score(end).sum !== r.sum) throw new Error(`打ち直すと合わない：${kind} ${slot} ${conc} ${fire}`);
  return { sum: r.sum, log };
}

function name(log) {
  return log.map((m) => (m[0] === 'fire' ? '火' : `${STRIKES[m[0]].name}${m[1]}`)).join(' ');
}

function table() {
  for (const band of BANDS) {
    const tier = band.tiers[0];
    for (const [kind, def] of Object.entries(GEAR_KINDS)) {
      for (const slot of ['weapon', 'armor', 'accessory']) {
        if (!def[slot]?.targets[band.id]) continue;
        const max = def[slot].targets[band.id].length * 2;
        const rows = [];
        for (let conc = 6; conc <= band.cap; conc += 2) {
          rows.push(`${conc}:${[0, 1, 2].map((f) => solve(kind, slot, tier, conc, f).sum).join('/')}`);
        }
        console.log(`${def[slot].name}（${def[slot].targets[band.id].join(',')}・1段${def.perLevel}回・満点${max}） 集中力:火0/1/2 → ${rows.join('  ')}`);
      }
    }
  }
}

const [kind, slot, conc, fire] = process.argv.slice(2);
const direct = import.meta.url === pathToFileURL(process.argv[1]).href; // 読み込まれただけなら何もしない
if (!direct) {
  // 何もしない
} else if (kind) {
  const r = solve(kind, slot, 1, Number(conc), Number(fire ?? 0));
  console.log(`出来 ${r.sum}　手順 ${name(r.log)}`);
} else {
  table();
}
