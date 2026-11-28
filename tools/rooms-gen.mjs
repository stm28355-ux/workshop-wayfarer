// 召喚の巻物（部屋分け）の生成を測る道具（ゲームには出ない。工程7d）。
// node tools/rooms-gen.mjs … 形ごとに種1〜20で作り、部屋の数・回り・仮置き・かかった時間を出す
import { generateRooms } from '../src/core/rooms.js';

const SPECS = [
  { name: '土台 5×5', w: 5, h: 5, rules: [], maxLevel: 1 },
  { name: '土台 5×5（回りあり）', w: 5, h: 5, rules: [], maxLevel: 2 },
  { name: '正方形 5×5', w: 5, h: 5, rules: ['square'], maxLevel: 2 },
  { name: '属性 5×5', w: 5, h: 5, rules: ['elem'], maxLevel: 2 },
  { name: '隠れ 5×5', w: 5, h: 5, rules: ['hidden'], maxLevel: 2 },
  { name: '土台 7×7', w: 7, h: 7, rules: [], maxLevel: 2 },
  { name: '正方形 7×7', w: 7, h: 7, rules: ['square'], maxLevel: 2 },
  { name: '属性 7×7', w: 7, h: 7, rules: ['elem'], maxLevel: 2 },
  { name: '隠れ 7×7', w: 7, h: 7, rules: ['hidden'], maxLevel: 2 },
  { name: '属性＋隠れ 7×7', w: 7, h: 7, rules: ['elem', 'hidden'], maxLevel: 3, maxGlobal: 1 },
  { name: '正方形＋属性 7×7', w: 7, h: 7, rules: ['square', 'elem'], maxLevel: 3, maxGlobal: 1 },
];
const only = process.argv[2];
const N = Number(process.env.SEEDS ?? 20);
for (const sp of SPECS) {
  if (only && !sp.name.includes(only)) continue;
  const rows = [];
  let worst = 0;
  for (let seed = 1; seed <= N; seed++) {
    const t = performance.now();
    const g = generateRooms({ ...sp, seed });
    worst = Math.max(worst, performance.now() - t);
    if (g) rows.push({ rooms: g.puzzle.rooms.length, r2: g.result.by[2], r3: g.result.by[3] });
  }
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length)).toFixed(1);
  console.log(`| ${sp.name} | ${rows.length}/${N} | ${avg('rooms')} | ${avg('r2')} | ${avg('r3')} | ${worst.toFixed(0)}ms |`);
}
