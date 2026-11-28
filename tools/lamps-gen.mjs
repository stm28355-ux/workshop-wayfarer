// 隠密の巻物（灯りを置く）の生成を測る道具（ゲームには出ない。工程7d）。
// node tools/lamps-gen.mjs … 形ごとに種1〜20で作り、灯りの数・数字の残った壁・仮置き・かかった時間を出す
import { generateLamps } from '../src/core/lamps.js';

const SPECS = [
  { name: '土台 5×5', w: 5, h: 5, rules: [], maxLevel: 1 },
  { name: '土台 5×5（仮置きあり）', w: 5, h: 5, rules: [], maxLevel: 2 },
  { name: '斜め 5×5', w: 5, h: 5, rules: ['diag'], maxLevel: 2 },
  { name: '短い 5×5', w: 5, h: 5, rules: ['short'], maxLevel: 2 },
  { name: 'まわり 5×5', w: 5, h: 5, rules: ['around'], maxLevel: 2 },
  { name: '土台 7×7', w: 7, h: 7, rules: [], maxLevel: 2 },
  { name: '斜め 7×7', w: 7, h: 7, rules: ['diag'], maxLevel: 2 },
  { name: '短い 7×7', w: 7, h: 7, rules: ['short'], maxLevel: 2 },
  { name: 'まわり 7×7', w: 7, h: 7, rules: ['around'], maxLevel: 2 },
  { name: '斜め＋短い 7×7', w: 7, h: 7, rules: ['diag', 'short'], maxLevel: 2 },
  { name: '短い＋まわり 7×7', w: 7, h: 7, rules: ['short', 'around'], maxLevel: 2 },
];
const only = process.argv[2];
const N = Number(process.env.SEEDS ?? 20);
for (const sp of SPECS) {
  if (only && !sp.name.includes(only)) continue;
  const rows = [];
  let worst = 0;
  for (let seed = 1; seed <= N; seed++) {
    const t = performance.now();
    const g = generateLamps({ ...sp, seed });
    worst = Math.max(worst, performance.now() - t);
    if (!g) continue;
    const p = g.puzzle;
    rows.push({ lamps: p.lamps.length, nums: p.nums.filter((n) => n !== null).length, walls: p.wall.filter(Boolean).length, r2: g.result.by[2] });
  }
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length)).toFixed(1);
  console.log(`| ${sp.name} | ${rows.length}/${N} | ${avg('lamps')} | ${avg('walls')} | ${avg('nums')} | ${avg('r2')} | ${worst.toFixed(0)}ms |`);
}
