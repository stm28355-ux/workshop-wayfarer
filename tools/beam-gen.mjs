// 弓の巻物（鏡で光を通す）の生成を測る道具（ゲームには出ない。判定表 第18回 A2）。
// node tools/beam-gen.mjs … 形ごとに種1〜20で作り、かかった時間・見せるマス・鏡の数・解く手間（たどった枝の数）を出す
// 鏡の数を出さない盤（nocount）は、答えを1つにするのに盤の半分近くを見せる要があった（土台に数を入れた理由）。
import { generateBeams, SLASH, BACK } from '../src/core/mirrors.js';

const SPECS = [
  { name: '土台 5×5', w: 5, h: 5, rules: [] },
  { name: '数なし 5×5（比べる用）', w: 5, h: 5, rules: ['nocount'] },
  { name: '色 5×5', w: 5, h: 5, rules: ['color'] },
  { name: '割れる 5×5', w: 5, h: 5, rules: ['break'] },
  { name: '番号 5×5', w: 5, h: 5, rules: ['label'] },
  { name: '土台 7×7', w: 7, h: 7, rules: [] },
  { name: '色 7×7', w: 7, h: 7, rules: ['color'] },
  { name: '割れる 7×7', w: 7, h: 7, rules: ['break'] },
  { name: '番号 7×7', w: 7, h: 7, rules: ['label'] },
  { name: '色＋割れる 7×7', w: 7, h: 7, rules: ['color', 'break'] },
  { name: '割れる＋番号 7×7', w: 7, h: 7, rules: ['break', 'label'] },
];
const only = process.argv[2];
const N = Number(process.env.SEEDS ?? 20);
for (const sp of SPECS) {
  if (only && !sp.name.includes(only)) continue;
  const rows = [];
  let worst = 0;
  for (let seed = 1; seed <= N; seed++) {
    const t = performance.now();
    const g = generateBeams({ ...sp, seed });
    const ms = performance.now() - t;
    worst = Math.max(worst, ms);
    if (!g) continue;
    const m = g.puzzle.solution.filter((v) => v === SLASH || v === BACK).length;
    rows.push({ shown: g.puzzle.shown.length, m, nodes: g.nodes });
  }
  const avg = (k) => (rows.reduce((a, r) => a + r[k], 0) / Math.max(1, rows.length)).toFixed(1);
  console.log(`| ${sp.name} | 作れた ${rows.length}/${N} | 見せる ${avg('shown')} | 鏡 ${avg('m')} | 手間 ${avg('nodes')} | 一番遅い ${worst.toFixed(0)}ms |`);
}
