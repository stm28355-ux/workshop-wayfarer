// 打ち分けの盤を「広く浅く」探す道具（ゲームには出ない。判定表 第16回 E1）。
// 9マスの盤と燃料の叩き方は、tools/forge-solve.mjs の全部を調べるやり方では遅すぎるので、
// よさそうな途中の盤を幅 width だけ残して進める（ビーム探索）。見つけた手順は replay で打ち直して確かめる。
// node tools/forge-beam.mjs                  … 全部の装備・格の盤で、燃料ごとの一番の出来を表にする
// node tools/forge-beam.mjs mithril weapon 3 … 1つの盤

import { pathToFileURL } from 'node:url';
import { GEAR_KINDS, STRIKES, BANDS } from '../src/data/forge.js';
import { newSession, strikeCells, canStrike, strike, canFire, addFire, replay, score, cellQuality, isOver } from '../src/core/forge.js';

function movesOf(s) {
  const out = [];
  const seen = new Set();
  for (const id of Object.keys(STRIKES)) {
    if (!canStrike(s, id)) continue;
    for (let c = 0; c < s.values.length; c++) {
      const key = `${id}:${strikeCells(s, id, c).join('+')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([id, c]);
    }
  }
  if (canFire(s)) out.push(['fire']);
  return out;
}

// 途中の盤のよさ：◎・○の数と、目標までの足りなさ（ひびは大きく引く）。
function goodness(s) {
  let h = 0;
  for (let i = 0; i < s.values.length; i++) {
    const v = s.values[i], t = s.targets[i];
    const q = cellQuality(v, t);
    if (q.crack) h -= 100;
    else h += q.q * 4 - Math.max(0, t - 1 - v) * 1.5;
  }
  return h + s.conc * 0.3 + s.fire * 1.5;
}

export function beamSolve({ kind, slot, tier, conc, fire, tools = [] }, width = 300) {
  const start = newSession({ kind, slot, tier, conc, fire, tools });
  let layer = [start];
  let best = { sum: score(start).sum, log: [] };
  const seen = new Set();
  for (let depth = 0; depth < 40 && layer.length; depth++) {
    const next = [];
    for (const s of layer) {
      const sc = score(s);
      if (sc.sum > best.sum || (sc.sum === best.sum && s.log.length < best.log.length)) best = { sum: sc.sum, log: s.log };
      if (isOver(s)) continue;
      for (const m of movesOf(s)) {
        const n = m[0] === 'fire' ? addFire(s) : strike(s, m[0], m[1]);
        if (!n) continue;
        const key = `${n.values.join(',')}|${n.temp}|${n.left}|${n.conc}|${n.fire}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(n);
      }
    }
    next.sort((a, b) => goodness(b) - goodness(a));
    layer = next.slice(0, width);
  }
  const end = replay(start, best.log);
  if (!end || score(end).sum !== best.sum) throw new Error('打ち直すと合わない');
  return { sum: best.sum, max: start.values.length * 2, log: best.log };
}

// 燃料の組み合わせ（集中力は上限まで）
export const FUELS = [
  { name: '欠片だけ', tools: [], fire: 0, plain: true },
  { name: '火1', tools: ['fire'], fire: 1, plain: true },
  { name: '氷＋石', tools: ['ice', 'stone'], fire: 0 },
  { name: '氷＋石＋火1', tools: ['fire', 'ice', 'stone'], fire: 1 },
  { name: '風＋氷', tools: ['ice', 'wind'], fire: 0 },
  { name: '雷＋氷', tools: ['ice', 'thunder'], fire: 0 },
  { name: '風＋石＋火1', tools: ['fire', 'stone', 'wind'], fire: 1 },
  { name: '雷＋石＋火1', tools: ['fire', 'stone', 'thunder'], fire: 1 },
];

function table(width) {
  for (const band of BANDS) {
    const tier = band.tiers[0];
    for (const [kind, def] of Object.entries(GEAR_KINDS)) {
      for (const slot of ['weapon', 'armor', 'accessory']) {
        if (!def[slot]?.targets[band.id]) continue;
        const cells = def[slot].targets[band.id];
        const row = FUELS.map((f) => beamSolve({ kind, slot, tier, conc: band.cap, fire: f.fire, tools: f.tools }, width).sum);
        console.log(`| ${def[slot].name} | ${band.w}×${band.h} | ${cells.join(',')} | ${def.perLevel}${def.quirk ? `・${def.quirk}` : ''} | ${row.join(' | ')} | ${cells.length * 2} |`);
      }
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [kind, slot, tierArg] = process.argv.slice(2);
  if (kind) {
    const tier = Number(tierArg ?? 1);
    const band = BANDS.find((b) => b.tiers.includes(tier));
    for (const f of FUELS) {
      const r = beamSolve({ kind, slot, tier, conc: band.cap, fire: f.fire, tools: f.tools });
      console.log(`${f.name}：出来 ${r.sum}/${r.max}　${r.log.map((m) => (m[0] === 'fire' ? '火' : `${STRIKES[m[0]].name}${m[1]}`)).join(' ')}`);
    }
  } else {
    console.log(`| 装備 | 盤 | 目標 | 1段の回数・癖 | ${FUELS.map((f) => f.name).join(' | ')} | 満点 |`);
    console.log(`| --- | --- | --- | --- | ${FUELS.map(() => '---').join(' | ')} | --- |`);
    table(Number(process.env.WIDTH ?? 300));
  }
}
