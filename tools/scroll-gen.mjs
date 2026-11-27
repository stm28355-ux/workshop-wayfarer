// 巻物を作る速さと難しさを測る道具（ゲームには出ない）。
// node tools/scroll-gen.mjs [枚数=30]
// 種類ごとに種1〜N で作り、作れた割合・1枚の時間・最初から開いているマスの数・手の難しさを並べる。

import { pathToFileURL } from 'node:url';
import { generate, difficulty } from '../src/core/scroll.js';

export const TYPES = [
  { name: '土台 5×5', w: 5, h: 5, count: 5, rules: [] },
  { name: '土台 6×6', w: 6, h: 6, count: 8, rules: [] },
  { name: '十字 5×5', w: 5, h: 5, count: 5, rules: ['cross'] },
  { name: '連結 5×5', w: 5, h: 5, count: 6, rules: ['connect'] },
  { name: '組 5×5', w: 5, h: 5, count: 6, rules: ['pair'] },
  { name: '十字 6×6', w: 6, h: 6, count: 8, rules: ['cross'] },
  { name: '連結 6×6', w: 6, h: 6, count: 10, rules: ['connect'] },
  { name: '組 6×6', w: 6, h: 6, count: 10, rules: ['pair'] },
  { name: '十字＋連結 6×6', w: 6, h: 6, count: 10, rules: ['cross', 'connect'] },
  { name: '十字＋組 6×6', w: 6, h: 6, count: 10, rules: ['cross', 'pair'] },
  { name: '連結＋組 6×6', w: 6, h: 6, count: 10, rules: ['connect', 'pair'] },
];

function measure(type, n, maxLevel) {
  let ok = 0, ms = 0, worst = 0, shown = 0;
  const lv = { 1: 0, 2: 0, 3: 0 };
  for (let seed = 1; seed <= n; seed++) {
    const t0 = performance.now();
    const g = generate({ ...type, seed, maxLevel });
    const dt = performance.now() - t0;
    ms += dt;
    worst = Math.max(worst, dt);
    if (!g) continue;
    ok += 1;
    shown += g.puzzle.shown.length;
    const d = difficulty(g.result);
    for (const k of [1, 2, 3]) lv[k] += d.by[k];
  }
  const avg = (x) => (ok ? (x / ok).toFixed(1) : '―');
  return `| ${type.name} | ${maxLevel} | ${ok}/${n} | ${(ms / n).toFixed(0)} | ${worst.toFixed(0)} | ${avg(shown)} | ${avg(lv[1])} / ${avg(lv[2])} / ${avg(lv[3])} |`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2] ?? 30);
  console.log('| 種類 | 一番難しい手 | 作れた | 1枚の平均ms | 一番遅いms | 最初から開いているマス | 手の数（数字1つ／2つ／盤全体） |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const t of TYPES) for (const maxLevel of [2, 3]) console.log(measure(t, n, maxLevel));
}
