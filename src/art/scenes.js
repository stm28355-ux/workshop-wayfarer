// 道中の背景（判定表 第22回 Q4：道中の背景が要る）。地域ごとに1枚、横長のドット絵（128×40）。工程8。
// 戦いの絵では、歩いている間これを左へ流す（2枚並べて継ぎ目なく回す）。

const W = 128, H = 40;

function canvas() {
  const c = new Array(W * H).fill(null);
  const set = (x, y, col) => { if (x >= 0 && y >= 0 && x < W && y < H) c[y * W + x] = col; };
  const api = {
    c,
    set(x, y, col) { set(x, y, col); return api; },
    rect(x0, y0, x1, y1, col) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, col); return api; },
    sky(cols, until) { for (let y = 0; y < until; y++) { const k = Math.min(cols.length - 1, Math.floor((y / until) * cols.length)); api.rect(0, y, W - 1, y, cols[k]); } return api; },
    // ゆるい起伏の帯（端どうしがつながるように周期を W に合わせる）
    hills(base, amp, period, col, toY) {
      for (let x = 0; x < W; x++) {
        const top = Math.round(base + amp * Math.sin((x / W) * Math.PI * 2 * period));
        for (let y = top; y <= toY; y++) set(x, y, col);
      }
      return api;
    },
    blob(cx, cy, rx, ry, col) { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const dx = (x - cx) / (rx + 0.3), dy = (y - cy) / (ry + 0.3); if (dx * dx + dy * dy <= 1) set(((x % W) + W) % W, y, col); } return api; },
    dots(list, col) { for (const [x, y] of list) set(x, y, col); return api; },
  };
  return api;
}

function toSvg(c, cls) {
  let rects = '';
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const col = c[y * W + x];
      let k = 1;
      while (x + k < W && c[y * W + x + k] === col) k++;
      if (col) rects += `<rect x="${x}" y="${y}" width="${k}" height="1" fill="${col}"/>`;
      x += k;
    }
  }
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

// 道（下の帯）と地面
function road(a, ground, groundL, path, pebble) {
  a.rect(0, 30, W - 1, 33, groundL).rect(0, 34, W - 1, H - 1, ground).rect(0, 35, W - 1, 38, path);
  for (let x = 6; x < W; x += 23) a.set(x, 36, pebble).set(x + 9, 37, pebble);
  return a;
}

const SCENES = {
  // 草原：青い空・雲・丘・木
  1: () => {
    const a = canvas().sky(['#2b3d5c', '#34507a', '#3e6290', '#4a74a3'], 30);
    for (const [cx, cy] of [[14, 5], [52, 8], [96, 4]]) a.blob(cx, cy, 6, 1, '#8fa8c6').blob(cx + 3, cy - 1, 3, 1, '#a9bed8');
    a.hills(24, 2, 2, '#3f6b4a', 30).hills(27, 1, 3, '#4a8443', 30);
    for (const tx of [10, 70, 108]) { a.rect(tx, 20, tx, 28, '#4a3020').blob(tx, 17, 4, 3, '#2f5a2c').blob(tx - 1, 16, 2, 1, '#3d7a39'); }
    return road(a, '#3d6e38', '#5d9a52', '#6b5a3e', '#8a7656');
  },
  // 坑道：暗い岩壁・柱・ランタン
  2: () => {
    const a = canvas().sky(['#16141a', '#1d1a22', '#24202a'], 30);
    a.hills(6, 2, 3, '#2d2833', 0).rect(0, 0, W - 1, 3, '#2d2833');
    for (let x = 0; x < W; x += 32) { a.rect(x + 4, 6, x + 6, 30, '#5a4330').rect(x + 2, 6, x + 8, 7, '#6e5238').set(x + 10, 12, '#ffb347').set(x + 10, 13, '#ffcf7a').set(x + 11, 12, '#7a5a2a'); }
    a.dots([[20, 18], [44, 22], [60, 15], [85, 20], [110, 17]], '#6f7a86').dots([[21, 18], [86, 20]], '#9aa6b2');
    return road(a, '#2a2520', '#3a332b', '#4a4035', '#615444');
  },
  // 古い森：濃い緑・太い幹・苔
  3: () => {
    const a = canvas().sky(['#142019', '#1a2a20', '#203426'], 30);
    for (let x = 0; x < W; x += 21) a.rect(x + 3, 4, x + 7, 30, '#3d2e22').rect(x + 4, 4, x + 5, 30, '#4f3c2c').blob(x + 5, 4, 9, 4, '#1f3d24').blob(x + 2, 3, 4, 2, '#2a5230');
    a.dots([[12, 28], [40, 29], [77, 28], [101, 29]], '#4f7a3a');
    return road(a, '#25331f', '#33472a', '#4a3f2e', '#5f523c');
  },
  // 雪山：白い峰・雪・針葉樹
  4: () => {
    const a = canvas().sky(['#3a4a66', '#4d6080', '#6a7c9a', '#8a9ab3'], 30);
    for (const [px, h] of [[20, 8], [60, 4], [100, 9]]) for (let y = h; y < 30; y++) { const w = Math.round((y - h) * 1.2); a.rect(px - w, y, px + w, y, y < h + 5 ? '#e8f0f7' : '#9aaac0'); }
    a.dots([[30, 6], [70, 10], [115, 5], [8, 14], [88, 16]], '#ffffff');
    for (const tx of [40, 84, 120]) for (let y = 18; y < 30; y++) a.rect(tx - Math.floor((y - 18) / 2), y, tx + Math.floor((y - 18) / 2), y, '#2f4a46');
    return road(a, '#c9d6e3', '#e8f0f7', '#b3c2d1', '#ffffff');
  },
  // 沼地：濁った水・葦・霧
  5: () => {
    const a = canvas().sky(['#23281f', '#2c3326', '#353d2c', '#3f4733'], 30);
    a.hills(26, 1, 2, '#2e3a26', 30);
    for (let x = 0; x < W; x += 9) a.rect(x + 2, 22 + (x % 4), x + 2, 30, '#5a6a3a').set(x + 2, 21 + (x % 4), '#7a6a3a');
    a.rect(0, 30, W - 1, 33, '#3a4a3a').dots([[15, 31], [16, 31], [60, 32], [61, 32], [100, 31]], '#5f7a5a');
    for (const [cx, cy] of [[30, 14], [90, 12]]) a.blob(cx, cy, 10, 1, '#4a5640');
    a.rect(0, 34, W - 1, H - 1, '#2b3322').rect(0, 35, W - 1, 38, '#4a4530');
    return a;
  },
  // 魔王の城：赤い月・城の影・暗い空
  6: () => {
    const a = canvas().sky(['#12080f', '#1c0d18', '#2a1020', '#3a1426'], 30);
    a.blob(100, 8, 4, 4, '#c94a3a').blob(99, 7, 2, 2, '#e66a50');
    a.rect(30, 10, 60, 30, '#2a1424').rect(34, 4, 38, 10, '#2a1424').rect(52, 2, 56, 10, '#2a1424').rect(43, 7, 47, 10, '#2a1424');
    a.dots([[36, 14], [44, 18], [54, 13], [40, 24], [50, 22]], '#ff8a3a');
    a.hills(27, 1, 3, '#1f1018', 30);
    return road(a, '#1a0f14', '#2a1820', '#3a2a2a', '#5a3a3a');
  },
};

const cache = new Map();
export function sceneArt(regionId) {
  if (!cache.has(regionId)) cache.set(regionId, toSvg((SCENES[regionId] ?? SCENES[1])().c, 'bg'));
  return cache.get(regionId);
}
export const SCENE_KEYS = Object.freeze(Object.keys(SCENES).map(Number));
