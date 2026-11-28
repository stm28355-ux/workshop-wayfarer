// 召喚の巻物（部屋分け）と隠密の巻物（灯りを置く）の盤を描く（道場の中）。工程7d。
import { roomCells } from '../core/rooms.js';
import { litCells } from '../core/lamps.js';
import { ELEMENT_NAMES } from '../core/sudoku.js';

export const ROOM_RULE_TEXT = Object.freeze({
  square: { name: '正方形', text: '部屋は全部正方形' },
  elem: { name: '属性の印', text: '数字の色は部屋の属性。隣り合う部屋は同じ属性でない' },
  hidden: { name: '隠れた数', text: '「？」の部屋は大きさが分からない（数字は1つだけ、という決まりは同じ）' },
});
export const LAMP_RULE_TEXT = Object.freeze({
  diag: { name: '斜めの灯り', text: '灯りは斜めにも照らす' },
  short: { name: '短い灯り', text: '灯りが届くのは2マスまで' },
  around: { name: 'まわりの数', text: '壁の数字はまわり8マスの灯りの数' },
});

// sc：召喚の巻物の状態。drag：{ a, b }（切っている途中の長方形）
export function roomsBoardHtml(sc, drag) {
  const p = sc.puzzle;
  const clueAt = new Map(p.clues.map((c, k) => [c.at, { ...c, k }]));
  const ownerOf = new Map();
  for (const k of sc.placed) for (const i of roomCells(p.rooms[k], p.w)) ownerOf.set(i, k);
  let sel = null;
  if (drag) {
    const x0 = Math.min(drag.a % p.w, drag.b % p.w), x1 = Math.max(drag.a % p.w, drag.b % p.w);
    const y0 = Math.min(Math.floor(drag.a / p.w), Math.floor(drag.b / p.w)), y1 = Math.max(Math.floor(drag.a / p.w), Math.floor(drag.b / p.w));
    sel = new Set(roomCells({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }, p.w));
  }
  const hintAt = new Map((sc.hints ?? []).map((x) => [x.at, x]));
  let cells = '';
  for (let i = 0; i < p.w * p.h; i++) {
    const c = clueAt.get(i);
    const k = ownerOf.get(i);
    const cls = ['rc'];
    if (k !== undefined) cls.push('placed', `tint${k % 6}`);
    if (k !== undefined && sc.wrong.includes(k)) cls.push('wrong');
    if (sel?.has(i)) cls.push('sel');
    const label = c ? (c.n ? `数字${c.n}` : '？') : k !== undefined ? '部屋' : 'まだ';
    const elem = c && c.elem !== undefined ? ` e${c.elem}` : '';
    const text = c ? `<b class="clue${elem}">${c.n || '？'}</b>${c.elem !== undefined ? `<small class="e${c.elem}">${ELEMENT_NAMES[c.elem]}</small>` : ''}` : '';
    const hint = hintAt.get(i);
    cells += `<button type="button" class="${cls.join(' ')}" data-rcell="${i}" aria-label="${label}">${text}${hint ? `<i class="hint">${hint.value}</i>` : ''}</button>`;
  }
  // 置けた部屋の枠
  let svg = '';
  for (const k of sc.placed) {
    const r = p.rooms[k];
    svg += `<rect class="${sc.wrong.includes(k) ? 'bad' : ''}" x="${r.x + 0.06}" y="${r.y + 0.06}" width="${r.w - 0.12}" height="${r.h - 0.12}" rx="0.12"/>`;
  }
  const over = `<svg class="rooms-over" viewBox="0 0 ${p.w} ${p.h}" preserveAspectRatio="none" aria-hidden="true">${svg}</svg>`;
  return `<div class="rooms-wrap" style="--w:${p.w};--h:${p.h}"><div class="rooms" role="grid" aria-label="巻物の盤">${cells}</div>${over}</div>`;
}

// sc：隠密の巻物の状態
export function lampsBoardHtml(sc) {
  const p = sc.puzzle;
  const lamps = Object.keys(sc.placed).map(Number);
  const lit = litCells(p, lamps);
  const hintAt = new Map((sc.hints ?? []).map((x) => [x.at, x]));
  let cells = '';
  for (let i = 0; i < p.w * p.h; i++) {
    const cls = ['lc'];
    if (p.wall[i]) {
      cls.push('wall');
      const n = p.nums[i];
      cells += `<span class="${cls.join(' ')}" aria-label="壁${n ?? ''}">${n ?? ''}</span>`;
      continue;
    }
    const lamp = !!sc.placed[i];
    const sure = sc.sureX.includes(i);
    const mark = sc.xs.includes(i);
    // 照らされているかは×のマスでも見せる（判定表 第20回 Q2：ミスしたマスが照らされているか分からない）
    if (lamp) cls.push('lamp');
    else if (lit.has(i)) cls.push('lit');
    if (sure || mark) cls.push('x');
    if (sure) cls.push('sure');
    if (sc.wrong.includes(i)) cls.push('wrong');
    const hint = hintAt.get(i);
    const label = lamp ? '灯り' : `${sure ? '置かない（確か）' : mark ? '×' : 'まだ'}${lit.has(i) ? '・照らされている' : ''}`;
    cells += `<button type="button" class="${cls.join(' ')}" data-lcell="${i}" aria-label="${label}">${lamp ? '灯' : sure || mark ? '×' : ''}${hint ? `<i class="hint">まわり${hint.value}</i>` : ''}</button>`;
  }
  return `<div class="lamps" style="--w:${p.w}" role="grid" aria-label="巻物の盤">${cells}</div>`;
}
