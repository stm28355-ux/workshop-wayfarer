// 剣の巻物（ピクロス）の盤を描く（道場の中）。判定表 第13回 B・第14回。
import { linesOf } from '../core/nonogram.js';

const COLOR_NAME = { 1: '赤', 2: '青' };

function clueHtml(p, clue) {
  if (clue.kind === 'sum') {
    const parts = clue.counts.map((n, k) => (p.colors === 2 ? `<span class="c${k + 1}">${n}</span>` : `${n}`));
    return `<span class="sum" title="合計">◆${parts.join(' ')}</span>`;
  }
  if (!clue.runs.length) return '<span>0</span>';
  return clue.runs.map((r) => `<span class="c${p.colors === 2 ? r.color : 1}">${r.len}</span>`).join('');
}

// sc：{ puzzle, paint, xs, sureX, wrong, hints }
export function nonoBoardHtml(sc) {
  const p = sc.puzzle;
  const lines = linesOf(p.w, p.h);
  const done = (cells) => cells.every((c) => !p.solution[c] || sc.paint[c] === p.solution[c]);
  const hintAt = new Map((sc.hints ?? []).map((x) => [x.at, x]));
  const cls0 = ['nono'];
  if (p.colors === 2) cls0.push('colors');
  let h = `<div class="${cls0.join(' ')}" style="--w:${p.w}" role="grid" aria-label="巻物の盤"><div class="nono-corner"></div>`;
  for (let x = 0; x < p.w; x++) h += `<div class="nono-clue col${done(lines[p.h + x].cells) ? ' done' : ''}">${clueHtml(p, p.clues.cols[x])}</div>`;
  for (let y = 0; y < p.h; y++) {
    h += `<div class="nono-clue row${done(lines[y].cells) ? ' done' : ''}">${clueHtml(p, p.clues.rows[y])}</div>`;
    for (let x = 0; x < p.w; x++) {
      const i = y * p.w + x;
      const v = sc.paint[i];
      const wrong = sc.wrong.includes(i);
      const sure = sc.sureX.includes(i) || (wrong && !p.solution[i]);
      const mark = sc.xs.includes(i);
      const cls = ['nc'];
      if (v) cls.push(`p${v}`);
      if (sure || mark) cls.push('x');
      if (sure) cls.push('sure');
      if (wrong) cls.push('wrong');
      if (p.rules.includes('mirror') && p.w % 2 === 1 && x === (p.w - 1) / 2) cls.push('mid');
      const hint = hintAt.get(i);
      const label = v ? `${COLOR_NAME[v] ?? ''}塗り` : sure ? '塗らない（確か）' : mark ? '×' : 'まだ';
      h += `<button type="button" class="${cls.join(' ')}" data-ncell="${i}" aria-label="${label}">${sure || mark ? '×' : ''}${hint ? `<i class="hint">${hint.value}</i>` : ''}</button>`;
    }
  }
  return h + '</div>';
}
