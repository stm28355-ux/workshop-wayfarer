// 魔法の巻物（属性の数独）の生成を測る道具（ゲームには出ない。判定表 第18回 A2）。
// node tools/sudo-gen.mjs … 形ごとに種1〜20で作り、かかった時間・最初から入っているマス・手の難しさを出す
import { generateSudo } from '../src/core/sudoku.js';

const SPECS = [
  { name: '土台 4×4', n: 4, rules: [], maxLevel: 1 },
  { name: '反応 4×4', n: 4, rules: ['react'], maxLevel: 2 },
  { name: '巡り 4×4', n: 4, rules: ['cycle'], maxLevel: 2 },
  { name: '囲み 4×4', n: 4, rules: ['cage'], maxLevel: 2 },
  { name: '土台 6×6', n: 6, rules: [], maxLevel: 2 },
  { name: '反応 6×6', n: 6, rules: ['react'], maxLevel: 2 },
  { name: '巡り 6×6', n: 6, rules: ['cycle'], maxLevel: 2 },
  { name: '囲み 6×6', n: 6, rules: ['cage'], maxLevel: 2 },
  { name: '反応＋巡り 6×6', n: 6, rules: ['react', 'cycle'], maxLevel: 3, maxGlobal: 1 },
  { name: '巡り＋囲み 6×6', n: 6, rules: ['cycle', 'cage'], maxLevel: 3, maxGlobal: 1 },
];
const only = process.argv[2];
for (const sp of SPECS) {
  if (only && !sp.name.includes(only)) continue;
  const rows = [];
  let fail = 0, worst = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const t = performance.now();
    const g = generateSudo({ ...sp, seed });
    const ms = performance.now() - t;
    worst = Math.max(worst, ms);
    if (!g) { fail++; continue; }
    rows.push({ given: g.puzzle.givens.length, r2: g.result.by[2], r3: g.result.by[3], max: g.result.max });
  }
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length)).toFixed(1);
  console.log(`| ${sp.name} | 作れた ${rows.length}/20 | 入っている ${avg('given')} | 回り ${avg('r2')} | 仮置き ${avg('r3')} | 一番遅い ${worst.toFixed(0)}ms |`);
}
