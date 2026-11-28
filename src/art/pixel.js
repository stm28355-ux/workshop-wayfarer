// 16×16 のドット絵を、図形の組み合わせで描く小さな道具（Gateway Garden の pixel.js と同じ物）。最後に縁取りを付ける。
// 描いた絵は SVG の文字列にする（ブラウザでもテストでも使える）。工程8。
export function grid(n = 32) {
  const px = Array.from({ length: n }, () => Array(n).fill(null));
  const inside = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
  const set = (x, y, c) => { if (inside(x, y)) px[y][x] = c; };
  const g = {
    n, px,
    px1: (x, y, c) => { set(x, y, c); return g; },
    rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); return g; },
    clear(x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) px[y][x] = null; return g; },
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.35);
          const dy = (y - cy) / (ry + 0.35);
          if (dx * dx + dy * dy <= 1) set(x, y, c);
        }
      }
      return g;
    },
    poly(points, c) { // 点の並びで囲んだ形（中に入るマスを塗る）
      const ys = points.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = 0; x < n; x++) {
          let hit = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i];
            const [xj, yj] = points[j];
            if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) hit = !hit;
          }
          if (hit) set(x, y, c);
        }
      }
      return g;
    },
    line(x0, y0, x1, y1, c) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
      for (let i = 0; i <= steps; i++) set(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), c);
      return g;
    },
    // 目（2×2 の黒目に、左上の白い光）。工程7の判定で「顔は描いてよい」
    eye(x, y, ink = '#1d1a33', light = '#ffffff') {
      g.rect(x, y, x + 1, y + 1, ink);
      set(x, y, light);
      return g;
    },
    // 暗い顔のための目（白目2×2に、右下の黒目）
    eyeW(x, y, ink = '#1d1a33', white = '#ffffff') {
      g.rect(x, y, x + 1, y + 1, white);
      set(x + 1, y + 1, ink);
      return g;
    },
    // 太い線（点を並べた道を、丸で太らせる）
    path(points, r, c) {
      for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[i + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
        for (let k = 0; k <= steps; k++) g.ellipse(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, r, r, c);
      }
      return g;
    },
    // 塗ってあるマスだけ色を変える（しま模様・影など）
    tint(x0, y0, x1, y1, c, only = null) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y) && px[y][x] && (!only || px[y][x] === only)) px[y][x] = c;
      return g;
    },
    // 太い縁取り：塗ったマスに上下左右で接する空きマスを縁の色にする
    outline(c = '#1d1a33') {
      const add = [];
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          if (px[y][x]) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && px[y + dy][x + dx] && px[y + dy][x + dx] !== c)) add.push([x, y]);
        }
      }
      for (const [x, y] of add) px[y][x] = c;
      return g;
    },
  };
  return g;
}

// 横に続く同じ色をまとめて、小さな SVG にする
export function toSvg(g, size = 96, cls = 'px') {
  let rects = '';
  g.px.forEach((row, y) => {
    let x = 0;
    while (x < g.n) {
      const c = row[x];
      let w = 1;
      while (x + w < g.n && row[x + w] === c) w++;
      if (c) rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  });
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 ${g.n} ${g.n}" shape-rendering="crispEdges">${rects}</svg>`;
}
