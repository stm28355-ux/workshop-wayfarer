// 剣の巻物（ピクロス）を作る速さと難しさを測る道具（ゲームには出ない）。判定表 第13回 B6。
// node tools/nono-gen.mjs [枚数=30]
// 種類ごと・一番難しい手ごとに種1〜N で作り、作れた割合・1枚の時間・手の難しさを並べる。

import { pathToFileURL } from 'node:url';
import { generateNono, nonoDifficulty } from '../src/core/nonogram.js';

export const NONO_TYPES = [
  { name: '土台 5×5', w: 5, h: 5, rules: [] },
  { name: '土台 7×7', w: 7, h: 7, rules: [] },
  { name: '色 5×5', w: 5, h: 5, rules: ['color'] },
  { name: '合計 5×5', w: 5, h: 5, rules: ['sum'] },
  { name: '鏡 5×5', w: 5, h: 5, rules: ['mirror'] },
  { name: '色 7×7', w: 7, h: 7, rules: ['color'] },
  { name: '合計 7×7', w: 7, h: 7, rules: ['sum'] },
  { name: '鏡 7×7', w: 7, h: 7, rules: ['mirror'] },
  { name: '色＋合計 7×7', w: 7, h: 7, rules: ['color', 'sum'] },
  { name: '色＋鏡 7×7', w: 7, h: 7, rules: ['color', 'mirror'] },
  { name: '合計＋鏡 7×7', w: 7, h: 7, rules: ['sum', 'mirror'] },
];

function measure(type, n, maxLevel, minLevel, extra = {}) {
  let ok = 0, ms = 0, worst = 0, att = 0;
  const lv = { 1: 0, 2: 0, 3: 0 };
  for (let seed = 1; seed <= n; seed++) {
    const t0 = performance.now();
    const g = generateNono({ ...type, seed, maxLevel, minLevel, maxGlobal: 2, ...extra });
    const dt = performance.now() - t0;
    ms += dt;
    worst = Math.max(worst, dt);
    if (!g) continue;
    ok += 1;
    att += g.attempts;
    const d = nonoDifficulty(g.result);
    for (const k of [1, 2, 3]) lv[k] += d.by[k];
  }
  const avg = (x) => (ok ? (x / ok).toFixed(1) : '―');
  return `| ${type.name} | ${minLevel ?? 1}〜${maxLevel}${extra.minRounds ? `・回り${extra.minRounds}〜` : ''} | ${ok}/${n} | ${(ms / n).toFixed(0)} | ${worst.toFixed(0)} | ${avg(att)} | ${avg(lv[1])} / ${avg(lv[2])} / ${avg(lv[3])} |`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2] ?? 30);
  console.log('| 種類 | 手の難しさ | 作れた | 1枚の平均ms | 一番遅いms | 作り直した回数 | 手の数（数字だけ／行と列の回り／盤全体） |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const t of NONO_TYPES) {
    console.log(measure(t, n, 2));
    console.log(measure(t, n, 2, 2, { minRounds: 4 }));
    console.log(measure(t, n, 3, 3));
  }
}
