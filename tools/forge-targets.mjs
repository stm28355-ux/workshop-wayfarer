// 打ち分けの目標を探す道具（ゲームには出ない。判定表 第16回 A2 と同じ決まりで、工程7d の12マスと竜の鱗・星鉄）。
// 決まり：「欠片だけ」「火1回」では会心に届かず、燃料の叩き方の組（FUELS の3つ目から）のどれかで届く。
// node tools/forge-targets.mjs [種=1] … 足りない盤の目標を探して JSON で出す（src/data/forge.js に写す）
import { GEAR_KINDS, BANDS } from '../src/data/forge.js';
import { beamSolve, FUELS } from './forge-beam.mjs';
import { rng } from '../src/core/scroll.js';

const seed = Number(process.argv[2] ?? 1);
const rand = rng(seed);
const WIDTH = Number(process.env.WIDTH ?? 150);
const TRIES = Number(process.env.TRIES ?? 60);
// 探す盤：12マス（盤3）は全部、竜の鱗・星鉄は盤1〜3
const jobs = [];
for (const [kind, def] of Object.entries(GEAR_KINDS)) {
  for (const slot of ['weapon', 'armor', 'accessory']) {
    if (!def[slot]) continue;
    for (const band of BANDS) {
      if (band.id === 3 || kind === 'dragon' || kind === 'star') jobs.push({ kind, slot, band });
    }
  }
}
const only = process.env.ONLY;
const RANGE = { 1: [4, 9], 2: [3, 8], 3: [3, 9] };
const out = {};
for (const job of jobs) {
  const name = `${job.kind}.${job.slot}.${job.band.id}`;
  if (only && !name.startsWith(only)) continue;
  // LO・HI で目標の幅を変えられる（魔銀や雷のように叩ける回数が少ない地金は低めにする）
  const [lo, hi] = [Number(process.env.LO ?? RANGE[job.band.id][0]), Number(process.env.HI ?? RANGE[job.band.id][1])];
  const n = job.band.w * job.band.h;
  const tier = job.band.tiers[0];
  let found = null;
  for (let t = 0; t < TRIES && !found; t++) {
    const targets = Array.from({ length: n }, () => lo + Math.floor(rand() * (hi - lo + 1)));
    // 盤のデータを一時的に差し替えて解く
    const def = GEAR_KINDS[job.kind][job.slot];
    const saved = def.targets[job.band.id];
    def.targets[job.band.id] = targets;
    try {
      const sums = [];
      let ok = true;
      for (let f = 0; f < FUELS.length; f++) {
        const r = beamSolve({ kind: job.kind, slot: job.slot, tier, conc: job.band.cap, fire: FUELS[f].fire, tools: FUELS[f].tools }, WIDTH);
        sums.push(r.sum);
        if (f < 2 && r.sum === r.max) { ok = false; break; }
      }
      if (ok && sums.slice(2).some((s) => s === n * 2)) found = { targets, sums };
    } finally {
      def.targets[job.band.id] = saved;
    }
  }
  out[name] = found;
  console.error(`${name}: ${found ? `${found.targets.join(',')}　${found.sums.join(' ')}` : '見つからない'}`);
}
console.log(JSON.stringify(out));
