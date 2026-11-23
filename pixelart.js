'use strict';
// Pocket Pal — 32×32 pixel-art icon set, drawn in code.
// Each icon is painted on a 32×32 grid, then gets rim shading and a 1px outline.
// PX.get(name) -> 32×32 canvas · PX.url(name) -> data URL (for <img>) · PX.draw(ctx, name, x, y, size)

const PX = (() => {
  const N = 32;
  const OUT = '#1d1530';

  // ---------- colour helpers ----------
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const light = (c, t = .35) => mix(c, '#ffffff', t);
  const dark = (c, t = .3) => mix(c, '#20102a', t);

  // ---------- grid painting ----------
  // a grid cell holds { c: colour, f: flat (no shading) }
  function Grid() { this.c = new Array(N * N).fill(null); }
  Grid.prototype.set = function (x, y, c, flat) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < N && y < N) this.c[y * N + x] = c ? { c, f: !!flat } : null;
  };
  Grid.prototype.get = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N ? this.c[y * N + x] : null; };
  Grid.prototype.ell = function (cx, cy, rx, ry, c, flat) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, c, flat);
    }
    return this;
  };
  Grid.prototype.rect = function (x0, y0, w, h, c, flat) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, flat);
    return this;
  };
  Grid.prototype.poly = function (pts, c, flat) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + .5, py = y + .5; let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, c, flat);
    }
    return this;
  };
  Grid.prototype.line = function (x0, y0, x1, y1, c, flat, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) this.set(x0 + a, y0 + b, c, flat);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  };
  Grid.prototype.dots = function (pts, c) { pts.forEach(([x, y]) => this.set(x, y, c, true)); return this; };

  // shade + outline, then paint to a canvas
  function render(g, { outline = OUT, shade = true } = {}) {
    const out = new Array(N * N).fill(null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const p = g.get(x, y); if (!p) continue;
      let c = p.c;
      if (shade && !p.f && c[0] === '#') {
        const same = (a, b) => { const q = g.get(a, b); return q && q.c === p.c; };
        if (!same(x, y - 1) || !same(x - 1, y)) c = light(c, .3);
        else if (!same(x, y + 1) || !same(x + 1, y)) c = dark(c, .22);
      }
      out[y * N + x] = c;
    }
    if (outline) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (g.get(x, y)) continue;
        if (g.get(x + 1, y) || g.get(x - 1, y) || g.get(x, y + 1) || g.get(x, y - 1)) out[y * N + x] = outline;
      }
    }
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
    const ctx = cv.getContext('2d');
    out.forEach((c, i) => { if (c) { ctx.fillStyle = c; ctx.fillRect(i % N, Math.floor(i / N), 1, 1); } });
    return cv;
  }

  // ---------- icon designs ----------
  const LEAF = '#4fbf4a', STEM = '#7a4a26';
  const D = {
    // berries
    berrySweet: g => {
      g.ell(16, 19, 10.5, 10, '#ff5fa2');
      g.dots([[12, 17], [18, 15], [20, 21], [14, 23], [22, 17], [11, 22]], '#c22f6f');
      g.line(16, 9, 17, 5, STEM, true, 2);
      g.poly([[17, 7], [25, 3], [26, 6], [21, 10]], LEAF);
      g.rect(10, 13, 3, 2, '#ffffff', true); g.set(10, 15, '#ffffff', true);
    },
    berrySour: g => {
      g.poly([[5, 20], [9, 12], [16, 9], [24, 11], [28, 18], [25, 25], [17, 28], [9, 27]], '#ffd93b');
      g.set(4, 20, '#ffd93b'); g.set(28, 17, '#ffd93b');
      g.dots([[12, 17], [17, 14], [21, 20], [14, 23], [22, 15]], '#d9a400');
      g.line(16, 9, 15, 5, STEM, true, 2);
      g.poly([[16, 7], [8, 3], [7, 6], [12, 9]], LEAF);
      g.rect(10, 14, 3, 2, '#ffffff', true);
    },
    berrySpicy: g => {
      g.poly([[9, 10], [17, 8], [22, 12], [24, 19], [22, 26], [17, 29], [14, 27], [15, 22], [12, 16]], '#ee3b2f');
      g.poly([[8, 9], [12, 6], [18, 7], [17, 10], [10, 11]], LEAF);
      g.line(13, 6, 11, 2, STEM, true, 2);
      g.rect(16, 12, 2, 4, '#ffb3a8', true);
    },
    candy: g => {
      g.poly([[2, 10], [10, 14], [10, 18], [2, 22], [5, 16]], '#7ad0ff');
      g.poly([[30, 10], [22, 14], [22, 18], [30, 22], [27, 16]], '#7ad0ff');
      g.ell(16, 16, 8, 7, '#ff6fae');
      [[11, 11, 14, 21], [15, 9, 18, 23], [19, 10, 21, 19]].forEach(([a, b, c, d]) => g.line(a, b, c, d, '#ffe3f0', true));
      g.rect(11, 12, 2, 2, '#ffffff', true);
    },
    poop: g => {
      g.ell(16, 25, 12, 5, '#8a5428');
      g.ell(16, 19, 9, 4.5, '#9a5f2e');
      g.ell(16, 14, 6, 4, '#a86a35');
      g.poly([[14, 11], [17, 5], [20, 10]], '#a86a35');
      g.dots([[9, 23], [10, 23], [12, 17], [13, 17], [14, 12]], '#d79a63');
    },
    star: g => {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6.5 : 14.5; pts.push([16 + Math.cos(a) * r, 17 + Math.sin(a) * r]); }
      g.poly(pts, '#ffd23d');
      g.dots([[15, 8], [15, 9], [16, 9], [11, 14], [12, 14]], '#fff6c2');
    },
    sparkle: g => {
      g.poly([[16, 2], [19, 13], [30, 16], [19, 19], [16, 30], [13, 19], [2, 16], [13, 13]], '#fff7c9');
      g.rect(15, 15, 2, 2, '#ffffff', true);
    },
    heart: g => {
      g.ell(11, 12, 7, 7, '#ff4d7a').ell(21, 12, 7, 7, '#ff4d7a');
      g.poly([[4, 14], [28, 14], [16, 28]], '#ff4d7a');
      g.rect(8, 8, 3, 2, '#ffd0dc', true); g.set(8, 10, '#ffd0dc', true);
    },
    heartEmpty: g => {
      g.ell(11, 12, 7, 7, '#5a4d72').ell(21, 12, 7, 7, '#5a4d72');
      g.poly([[4, 14], [28, 14], [16, 28]], '#5a4d72');
    },
    bubble: g => {
      g.ell(16, 16, 13, 13, '#a9e4ff', true);
      g.ell(16, 16, 11, 11, '#d9f4ff', true);
      g.ell(16, 16, 9.5, 9.5, null);
      g.rect(9, 9, 4, 2, '#ffffff', true); g.rect(9, 11, 2, 2, '#ffffff', true);
      g.rect(21, 21, 2, 2, '#ffffff', true);
    },
    flame: g => {
      g.poly([[16, 2], [22, 10], [26, 18], [24, 26], [16, 30], [8, 26], [6, 18], [10, 12], [12, 16], [14, 8]], '#ff6a2d');
      g.poly([[16, 12], [20, 18], [21, 24], [16, 28], [11, 24], [12, 19], [15, 20]], '#ffd23d');
    },
    // status icons
    food: g => {
      g.ell(20, 12, 9, 9, '#c8743a');
      g.poly([[14, 16], [9, 23], [11, 25], [18, 18]], '#f3e6c4');
      g.ell(7, 25, 3, 3, '#f3e6c4').ell(10, 28, 3, 3, '#f3e6c4');
      g.rect(16, 7, 3, 2, '#e8a06a', true);
    },
    joy: g => {
      g.ell(16, 16, 13, 13, '#ffd23d');
      g.rect(10, 11, 3, 4, OUT, true); g.rect(19, 11, 3, 4, OUT, true);
      g.line(9, 19, 12, 22, OUT, true); g.line(12, 22, 20, 22, OUT, true); g.line(20, 22, 23, 19, OUT, true);
      g.dots([[7, 18], [8, 18], [24, 18], [25, 18]], '#ff9a8a');
    },
    energy: g => {
      g.poly([[19, 2], [6, 18], [15, 18], [11, 30], [26, 12], [17, 12], [22, 2]], '#ffd23d');
      g.dots([[17, 5], [16, 6], [15, 7]], '#fff6c2');
    },
    hygiene: g => {
      g.poly([[16, 3], [24, 15], [25, 22], [16, 29], [7, 22], [8, 15]], '#4fb6ff');
      g.rect(11, 15, 2, 5, '#d9f1ff', true);
    },
    // actions
    feed: g => D.berrySweet(g),
    play: g => D.star(g),
    train: g => {
      g.ell(15, 14, 11, 10, '#e8503a');
      g.ell(22, 12, 5, 5, '#e8503a');
      g.rect(8, 22, 14, 7, '#f3f0ea');
      g.rect(8, 22, 14, 2, '#cfc8bd', true);
      g.line(11, 9, 14, 7, '#ff9d8a', true, 2);
    },
    bath: g => {
      g.ell(11, 13, 7, 7, '#a9e4ff', true).ell(11, 13, 5, 5, '#e6f8ff', true);
      g.ell(22, 9, 5, 5, '#a9e4ff', true).ell(22, 9, 3.5, 3.5, '#e6f8ff', true);
      g.poly([[3, 18], [29, 18], [27, 25], [22, 28], [10, 28], [5, 25]], '#ffffff');
      g.rect(3, 18, 26, 2, '#dfe7f1', true);
      g.rect(7, 28, 3, 2, '#9aa6b8').rect(22, 28, 3, 2, '#9aa6b8');
      g.rect(8, 10, 2, 2, '#ffffff', true);
    },
    sleep: g => {
      g.ell(15, 16, 12, 12, '#ffe58a');
      g.ell(21, 12, 10, 10, null);
      g.dots([[9, 9], [8, 12]], '#fff6c8');
      g.rect(24, 22, 2, 2, '#ffe58a', true); g.rect(27, 6, 2, 2, '#ffe58a', true);
    },
    wake: g => {
      g.ell(16, 16, 8, 8, '#ffc93d');
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        g.line(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 16 + Math.cos(a) * 14, 16 + Math.sin(a) * 14, '#ffc93d', true, 2);
      }
      g.rect(12, 11, 3, 2, '#fff2b0', true);
    },
    dex: g => {
      g.rect(5, 4, 22, 25, '#e8413a');
      g.rect(5, 15, 22, 3, '#2b2438', true);
      g.ell(16, 16.5, 4.5, 4.5, '#2b2438', true).ell(16, 16.5, 2.5, 2.5, '#ffffff', true);
      g.rect(5, 18, 22, 11, '#f3f0ea');
      g.ell(16, 16.5, 4.5, 4.5, '#2b2438', true).ell(16, 16.5, 2.5, 2.5, '#ffffff', true);
      g.rect(8, 6, 6, 2, '#ff9b92', true);
    },
    gear: g => {
      g.ell(16, 16, 10, 10, '#b9c0d4');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.rect(Math.round(15 + Math.cos(a) * 11), Math.round(15 + Math.sin(a) * 11), 3, 3, '#b9c0d4'); }
      g.ell(16, 16, 4, 4, null);
    },
    card: g => {
      g.rect(3, 7, 26, 19, '#7b61ff');
      g.ell(10, 15, 4, 4, '#ffd9c2', true);
      g.rect(6, 20, 8, 3, '#ffd9c2', true);
      g.rect(17, 12, 9, 2, '#ffffff', true); g.rect(17, 16, 7, 2, '#cfc6ff', true); g.rect(17, 20, 8, 2, '#cfc6ff', true);
    },
    bag: g => {
      g.rect(15, 0, 2, 5, '#5a4636', true);
      g.ell(16, 9, 8, 4, '#e8503a').rect(8, 9, 16, 15, '#e8503a').ell(16, 24, 8, 4, '#e8503a');
      g.rect(8, 12, 16, 2, '#ffffff', true); g.rect(8, 20, 16, 2, '#ffffff', true);
      g.rect(10, 9, 2, 12, '#ff8f80', true);
    },
    z: g => {
      g.rect(8, 8, 16, 4, '#ffffff').poly([[20, 12], [24, 12], [12, 20], [8, 20]], '#ffffff').rect(8, 20, 16, 4, '#ffffff');
    },
    medal: g => {
      g.poly([[9, 2], [15, 2], [17, 12], [12, 12]], '#4f93c4');
      g.poly([[23, 2], [17, 2], [15, 12], [20, 12]], '#e8503a');
      g.ell(16, 20, 9, 9, '#ffd23d');
      g.ell(16, 20, 5, 5, '#f2b51d', true);
      g.rect(12, 15, 3, 2, '#fff6c2', true);
    },
    heartGold: g => {
      g.ell(11, 12, 7, 7, '#ffc93d').ell(21, 12, 7, 7, '#ffc93d');
      g.poly([[4, 14], [28, 14], [16, 28]], '#ffc93d');
      g.rect(8, 8, 3, 2, '#fff3c4', true);
    },
    rain: g => {
      g.ell(11, 13, 7, 6, '#9aa8c7').ell(20, 11, 8, 7, '#9aa8c7').rect(6, 13, 20, 6, '#9aa8c7');
      [[8, 23], [15, 25], [22, 23]].forEach(([x, y]) => g.line(x, y, x - 2, y + 5, '#5fb3ff', true, 2));
    },
    shield: g => {
      g.poly([[16, 3], [27, 7], [26, 18], [16, 29], [6, 18], [5, 7]], '#4f93c4');
      g.poly([[16, 7], [23, 10], [22, 18], [16, 25]], '#7fb8e6');
    },
    sword: g => {
      g.line(25, 4, 11, 18, '#dfe6f2', false, 3);
      g.rect(6, 17, 10, 3, '#c9a23c'); g.rect(10, 13, 3, 10, '#c9a23c');
      g.line(9, 21, 5, 25, '#7a4a26', true, 3);
    },
    speed: g => {
      g.poly([[12, 6], [28, 16], [12, 26], [16, 16]], '#58b868');
      g.rect(3, 10, 8, 2, '#a9dfb2', true); g.rect(1, 15, 10, 2, '#a9dfb2', true); g.rect(3, 20, 8, 2, '#a9dfb2', true);
    },
    book: g => {
      g.rect(5, 5, 22, 23, '#4f93c4');
      g.rect(9, 5, 2, 23, '#2f6c9c', true);
      g.rect(14, 10, 9, 2, '#d9ecfb', true); g.rect(14, 14, 7, 2, '#d9ecfb', true);
    },
    wrench: g => {
      g.line(8, 24, 20, 12, '#b9c0d4', false, 4);
      g.ell(22, 10, 7, 7, '#b9c0d4'); g.ell(25, 7, 3, 3, null);
      g.ell(8, 24, 3, 3, '#b9c0d4');
    },
    up: g => {
      g.poly([[16, 3], [28, 16], [21, 16], [21, 29], [11, 29], [11, 16], [4, 16]], '#58b868');
    },
    warning: g => {
      g.poly([[16, 3], [30, 28], [2, 28]], '#ffc93d');
      g.rect(15, 11, 3, 9, OUT, true); g.rect(15, 22, 3, 3, OUT, true);
    },
    medalBronze: g => { D.medal(g); g.ell(16, 20, 9, 9, '#cd7f4a'); g.ell(16, 20, 5, 5, '#a8612f', true); g.rect(12, 15, 3, 2, '#f1c19c', true); },
    medalSilver: g => { D.medal(g); g.ell(16, 20, 9, 9, '#c9d0dc'); g.ell(16, 20, 5, 5, '#9aa3b3', true); g.rect(12, 15, 3, 2, '#ffffff', true); },
    medalGold: g => { D.medal(g); },
    crown: g => {
      g.poly([[4, 12], [10, 18], [16, 6], [22, 18], [28, 12], [26, 26], [6, 26]], '#ffd23d');
      g.rect(6, 22, 20, 4, '#f2b51d', true);
      g.dots([[15, 15], [16, 15], [15, 16], [16, 16]], '#e8413a');
    },
    dumbbell: g => {
      g.rect(9, 14, 14, 4, '#9aa3b3');
      g.rect(3, 9, 6, 14, '#4a4460'); g.rect(23, 9, 6, 14, '#4a4460');
      g.rect(4, 10, 2, 5, '#8b86a6', true); g.rect(24, 10, 2, 5, '#8b86a6', true);
    },
    hand: g => {
      g.rect(9, 12, 15, 14, '#ffd0a8');
      [9, 13, 17, 21].forEach((x, i) => g.rect(x, 4 + (i % 3), 3, 9, '#ffd0a8'));
      g.poly([[24, 18], [29, 13], [30, 16], [25, 23]], '#ffd0a8');
    },
    folder: g => {
      g.rect(3, 7, 11, 4, '#e0a81f'); g.rect(3, 10, 26, 17, '#ffc93d');
      g.rect(3, 10, 26, 2, '#ffe28a', true);
    },
    box: g => {
      g.rect(5, 9, 22, 18, '#c8915a'); g.rect(5, 9, 22, 4, '#dba873');
      g.rect(14, 9, 4, 18, '#8e6237', true);
    },
    disk: g => {
      g.rect(4, 4, 24, 24, '#4f6fd8'); g.rect(9, 4, 14, 8, '#e6ebf5'); g.rect(18, 5, 3, 6, '#4f6fd8', true);
      g.rect(8, 17, 16, 11, '#ffffff');
    },
    trash: g => {
      g.rect(7, 8, 18, 3, '#9aa3b3'); g.rect(13, 5, 6, 3, '#9aa3b3');
      g.poly([[8, 12], [24, 12], [22, 29], [10, 29]], '#c9d0dc');
      g.rect(12, 15, 2, 11, '#9aa3b3', true); g.rect(18, 15, 2, 11, '#9aa3b3', true);
    },
    image: g => {
      g.rect(3, 6, 26, 21, '#7fc8ff');
      g.poly([[3, 27], [12, 15], [19, 22], [23, 18], [29, 24], [29, 27]], '#58b868');
      g.ell(22, 12, 3, 3, '#ffd23d');
    },
    check: g => { g.line(6, 16, 13, 23, '#58b868', false, 4); g.line(13, 23, 26, 9, '#58b868', false, 4); },
    lock: g => {
      g.rect(7, 14, 18, 14, '#ffc93d'); g.rect(10, 6, 3, 9, '#9aa3b3'); g.rect(19, 6, 3, 9, '#9aa3b3'); g.rect(10, 5, 12, 3, '#9aa3b3');
      g.rect(15, 19, 2, 5, OUT, true);
    },
    // ---- Pokémon-style items ----
    pecha: g => {   // sweet: soft pink peach-like berry
      g.ell(16, 19, 11, 10, '#ffa3c7');
      g.line(16, 10, 16, 15, '#e0679a', true); g.line(15, 15, 17, 15, '#e0679a', true);
      g.poly([[16, 9], [9, 4], [8, 7], [13, 10]], LEAF).poly([[17, 9], [24, 4], [25, 7], [20, 10]], LEAF);
      g.rect(9, 15, 3, 2, '#ffe1ee', true); g.set(9, 17, '#ffe1ee', true);
    },
    aspear: g => {  // sour: yellow pear-shaped berry with bumps
      g.ell(16, 21, 10, 8.5, '#f3d23c').ell(16, 12, 6.5, 6, '#f3d23c');
      g.dots([[11, 20], [15, 24], [20, 19], [18, 13], [13, 14], [22, 23]], '#c9a414');
      g.line(16, 6, 17, 3, STEM, true, 2);
      g.poly([[17, 5], [24, 3], [23, 6]], LEAF);
      g.rect(11, 10, 2, 3, '#fff6b8', true);
    },
    cheri: g => {   // spicy: twin red berries on joined stems
      g.ell(10, 21, 7, 7, '#e8282b').ell(22, 21, 7, 7, '#e8282b');
      g.line(10, 14, 15, 5, '#3f9a3a', true, 2); g.line(22, 14, 17, 5, '#3f9a3a', true, 2);
      g.poly([[15, 5], [9, 2], [8, 5]], LEAF).poly([[17, 5], [23, 2], [24, 5]], LEAF);
      g.rect(6, 18, 2, 2, '#ff9c9c', true); g.rect(18, 18, 2, 2, '#ff9c9c', true);
    },
    oran: g => {    // the food icon: round blue berry
      g.ell(16, 18, 11, 11, '#4a86e8');
      g.dots([[11, 16], [17, 13], [21, 19], [14, 23], [19, 24]], '#2e5fb8');
      g.line(16, 7, 16, 3, STEM, true, 2);
      g.poly([[16, 6], [8, 2], [7, 5], [12, 8]], LEAF).poly([[17, 6], [25, 3], [25, 6], [21, 8]], LEAF);
      g.rect(10, 12, 3, 2, '#cfe1ff', true);
    },
    poffin: g => {  // treat: little iced muffin
      g.poly([[7, 18], [25, 18], [23, 28], [9, 28]], '#d99a52');
      g.rect(9, 20, 2, 7, '#b77b3a', true); g.rect(15, 20, 2, 8, '#b77b3a', true); g.rect(21, 20, 2, 7, '#b77b3a', true);
      g.ell(16, 15, 12, 7, '#ff8fbd');
      g.dots([[11, 13], [16, 11], [21, 14], [13, 17], [19, 16]], '#fff3a0');
      g.rect(12, 10, 3, 2, '#ffd3e6', true);
    },
    pokeball: g => {
      g.ell(16, 16, 13.5, 13.5, '#ee1515');
      for (let y = 16; y < 32; y++) for (let x = 0; x < 32; x++) if (g.get(x, y)) g.set(x, y, '#f4f4f4');
      g.rect(3, 15, 27, 3, '#2b2438', true);
      g.ell(16, 16.5, 5, 5, '#2b2438', true).ell(16, 16.5, 3, 3, '#ffffff', true);
      g.rect(8, 7, 4, 2, '#ff9a9a', true); g.rect(7, 9, 2, 2, '#ff9a9a', true);
    },
    greatball: g => {
      D.pokeball(g);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 32; x++) { const p = g.get(x, y); if (p && p.c === '#ee1515') g.set(x, y, '#2f6fe0'); }
      g.poly([[5, 9], [10, 6], [11, 9], [7, 12]], '#ee1515', true).poly([[27, 9], [22, 6], [21, 9], [25, 12]], '#ee1515', true);
      g.rect(8, 7, 3, 2, '#9cc0ff', true);
    },
    ultraball: g => {
      D.pokeball(g);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 32; x++) { const p = g.get(x, y); if (p && (p.c === '#ee1515' || p.c === '#ff9a9a')) g.set(x, y, '#2d2d33'); }
      g.rect(9, 3, 3, 12, '#ffcb05', true); g.rect(20, 3, 3, 12, '#ffcb05', true);
    },
    pokedex: g => {
      g.rect(5, 3, 22, 26, '#e3350d');
      g.ell(11, 9, 4, 4, '#ffffff', true).ell(11, 9, 3, 3, '#3fa9f5', true); g.rect(10, 7, 1, 1, '#ffffff', true);
      g.ell(18, 7, 1.4, 1.4, '#ff6a6a', true).ell(21, 7, 1.4, 1.4, '#ffd23d', true).ell(24, 7, 1.4, 1.4, '#58d068', true);
      g.rect(8, 15, 16, 11, '#2b2438', true); g.rect(9, 16, 14, 9, '#a8e0b0', true);
      g.rect(10, 18, 6, 1, '#4f8f5a', true); g.rect(10, 21, 9, 1, '#4f8f5a', true);
    },
    arrow: g => {   // "this is your main" marker
      g.poly([[4, 8], [28, 8], [16, 26]], '#ffcb05');
      g.poly([[9, 11], [16, 11], [14, 18]], '#fff3a8', true);
    },
    chat: g => {    // speech bubble with dots
      g.ell(16, 13, 13, 10, '#ffffff', true);
      g.poly([[9, 19], [15, 21], [7, 29]], '#ffffff', true);
      [10, 16, 22].forEach(x => g.rect(x - 1, 12, 3, 3, '#2b2438', true));
    },
    note: g => {    // music note
      g.rect(18, 5, 3, 17, '#2b2438', true); g.poly([[21, 5], [28, 9], [28, 13], [21, 9]], '#2b2438', true);
      g.ell(14, 23, 6, 5, '#ff6fb5');
    },
    party: g => {   // three little Poké Balls
      [[10, 20], [22, 20], [16, 10]].forEach(([x, y]) => {
        g.ell(x, y, 7, 7, '#ee1515');
        for (let yy = y; yy < y + 8; yy++) for (let xx = x - 8; xx < x + 8; xx++) { const p = g.get(xx, yy); if (p && p.c === '#ee1515') g.set(xx, yy, '#f4f4f4'); }
        g.rect(x - 7, y - 1, 14, 2, '#2b2438', true); g.ell(x, y, 2.2, 2.2, '#2b2438', true); g.ell(x, y, 1.2, 1.2, '#ffffff', true);
      });
    },
    masterball: g => {
      D.pokeball(g);
      for (let y = 0; y < 15; y++) for (let x = 0; x < 32; x++) { const p = g.get(x, y); if (p && (p.c === '#ee1515' || p.c === '#ff9a9a')) g.set(x, y, '#7a3fc4'); }
      g.ell(9, 9, 2.6, 2.6, '#ff6fb5', true).ell(23, 9, 2.6, 2.6, '#ff6fb5', true);
      g.line(12, 11, 13, 5, '#ffffff', true); g.line(13, 5, 16, 9, '#ffffff', true); g.line(16, 9, 19, 5, '#ffffff', true); g.line(19, 5, 20, 11, '#ffffff', true);
    },
    fragment: g => {   // glowing shard of a legendary
      g.poly([[16, 2], [24, 12], [21, 29], [11, 29], [8, 12]], '#ffd84a');
      g.poly([[16, 6], [20, 13], [16, 25], [12, 13]], '#fff4b0', true);
      g.dots([[5, 5], [27, 8], [26, 24], [4, 22]], '#fff7c9');
    },
    rock: g => {
      g.poly([[4, 26], [6, 14], [12, 7], [21, 6], [27, 12], [29, 26]], '#9aa0b0');
      g.line(12, 12, 15, 18, '#6b7080', true); g.line(15, 18, 13, 23, '#6b7080', true); g.line(20, 10, 22, 16, '#6b7080', true);
      g.rect(10, 9, 4, 2, '#d3d7e2', true);
    },
    rubble: g => {
      g.ell(9, 24, 5, 4, '#9aa0b0').ell(20, 25, 6, 4, '#8a90a0').ell(15, 18, 4, 3, '#a8aebd').ell(25, 19, 3, 3, '#9aa0b0');
    },
    orb: g => {   // incoming attack
      g.ell(16, 16, 11, 11, '#5a2a8a'); g.ell(16, 16, 7, 7, '#8a4fd0', true); g.ell(13, 13, 3, 3, '#d9b8ff', true);
    },
    shield: g => {
      g.poly([[16, 3], [27, 7], [26, 18], [16, 29], [6, 18], [5, 7]], '#4f93c4');
      g.poly([[16, 7], [23, 10], [22, 18], [16, 25]], '#7fb8e6');
    },
    games: g => { D.pokeball(g); },
    friends: g => {   // two trainers
      g.ell(11, 10, 5, 5, '#ffd0a8').ell(22, 11, 4.5, 4.5, '#ffd0a8');
      g.rect(9, 3, 6, 4, '#e3350d'); g.rect(7, 6, 10, 2, '#e3350d'); g.rect(19, 5, 6, 4, '#3d7dca'); g.rect(17, 8, 10, 2, '#3d7dca');
      g.poly([[4, 29], [5, 18], [11, 15], [17, 18], [18, 29]], '#e3350d'); g.poly([[15, 29], [16, 19], [22, 16], [28, 19], [29, 29]], '#3d7dca');
    },
    lock: g => {
      g.rect(7, 14, 18, 14, '#ffc93d'); g.rect(10, 6, 3, 9, '#9aa3b3'); g.rect(19, 6, 3, 9, '#9aa3b3'); g.rect(10, 5, 12, 3, '#9aa3b3');
      g.rect(15, 19, 2, 5, '#2b2438', true);
    },
    trade: g => {
      g.poly([[4, 10], [20, 10], [20, 5], [28, 12], [20, 19], [20, 14], [4, 14]], '#58b868');
      g.poly([[28, 22], [12, 22], [12, 27], [4, 20], [12, 13], [12, 18], [28, 18]], '#3d7dca');
    },
    // ---- explore ----
    map: g => {
      g.poly([[3, 7], [11, 4], [21, 7], [29, 4], [29, 25], [21, 28], [11, 25], [3, 28]], '#f3e2b3');
      g.line(11, 4, 11, 25, '#d1b77a', true); g.line(21, 7, 21, 28, '#d1b77a', true);
      g.line(6, 20, 9, 14, '#6fae5a', true, 2); g.line(13, 18, 18, 12, '#4f93c4', true, 2);
      g.line(22, 12, 26, 16, '#e3350d', true, 2); g.line(26, 12, 22, 16, '#e3350d', true, 2);
    },
    chest: g => {
      g.rect(4, 13, 24, 15, '#b06a2a'); g.ell(16, 13, 12, 6, '#c47a33'); g.rect(4, 12, 24, 2, '#7a4518', true);
      g.rect(4, 18, 24, 2, '#ffcb05', true); g.rect(14, 16, 4, 6, '#ffcb05', true); g.rect(15, 18, 2, 2, '#2b2438', true);
      g.rect(7, 9, 4, 2, '#e0a061', true);
    },
    chestOpen: g => {
      g.rect(4, 15, 24, 13, '#b06a2a'); g.rect(4, 19, 24, 2, '#ffcb05', true);
      g.poly([[4, 15], [8, 4], [24, 4], [28, 15]], '#7a4518');
      g.rect(6, 12, 20, 4, '#fff3a0', true); g.dots([[10, 10], [16, 9], [22, 11], [13, 7], [20, 7]], '#ffffff');
    },
    rareCandy: g => {
      g.poly([[2, 11], [9, 14], [9, 18], [2, 21], [5, 16]], '#9fd6ff');
      g.poly([[30, 11], [23, 14], [23, 18], [30, 21], [27, 16]], '#9fd6ff');
      g.ell(16, 16, 8, 7, '#4a7fe0');
      g.rect(12, 13, 8, 6, '#ffffff', true); g.rect(15, 11, 2, 10, '#ffffff', true);
      g.rect(11, 12, 2, 2, '#bcd6ff', true);
    },
    pearl: g => { g.ell(16, 17, 10, 10, '#f4eee6'); g.ell(16, 17, 10, 10, null); g.ell(16, 17, 10, 10, '#efe6f2'); g.rect(11, 11, 4, 3, '#ffffff', true); g.dots([[20, 22], [21, 21]], '#d8c8de'); },
    starPiece: g => {
      g.poly([[16, 3], [21, 12], [29, 14], [22, 20], [24, 29], [16, 24], [8, 29], [10, 20], [3, 14], [11, 12]], '#ff8a7a');
      g.poly([[16, 8], [19, 14], [16, 19], [13, 14]], '#ffd0c8', true);
    },
    nugget: g => {
      g.poly([[6, 18], [10, 10], [18, 7], [26, 11], [28, 19], [22, 26], [12, 26]], '#ffc93d');
      g.dots([[11, 13], [12, 13], [17, 10], [18, 10], [11, 14]], '#fff3b0'); g.dots([[22, 21], [18, 23], [24, 17]], '#d99a00');
    },
    // Gym-style badges
    badgeBoulder: g => { g.poly([[11, 4], [21, 4], [28, 11], [28, 21], [21, 28], [11, 28], [4, 21], [4, 11]], '#a8aab8'); g.rect(10, 9, 4, 3, '#e6e8f2', true); },
    badgeCascade: g => { g.poly([[16, 3], [25, 16], [26, 22], [16, 29], [6, 22], [7, 16]], '#4fb6ff'); g.rect(11, 14, 3, 5, '#d6f0ff', true); },
    badgeThunder: g => {
      const pts = []; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 7 : 14; pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]); }
      g.poly(pts, '#ffa43a'); g.ell(16, 16, 4, 4, '#ffd98a', true);
    },
    badgeRainbow: g => {
      [['#ff6a6a', 16, 8], ['#ffd23d', 24, 16], ['#58d068', 16, 24], ['#4f9bff', 8, 16]].forEach(([c, x, y]) => g.ell(x, y, 6, 6, c));
      g.ell(16, 16, 4, 4, '#ffffff');
    },
    badgeSoul: g => { g.ell(11, 13, 7, 7, '#ff6fb5').ell(21, 13, 7, 7, '#ff6fb5'); g.poly([[4, 15], [28, 15], [16, 28]], '#ff6fb5'); g.rect(8, 9, 3, 2, '#ffd0e6', true); },
    badgeMarsh: g => { g.ell(16, 16, 13, 13, '#ffcb05'); g.ell(16, 16, 7, 7, null); g.ell(16, 16, 4, 4, '#ffcb05'); g.rect(8, 8, 3, 3, '#fff3b0', true); },
    badgeVolcano: g => { D.flame(g); },
    badgeEarth: g => {
      g.poly([[16, 3], [25, 10], [27, 19], [20, 27], [16, 29], [12, 27], [5, 19], [7, 10]], '#4fbf4a');
      g.line(16, 6, 16, 27, '#2f7f2c', true); g.line(16, 14, 22, 10, '#2f7f2c', true); g.line(16, 19, 10, 15, '#2f7f2c', true);
    },
  };

  // ---------- premium redraws: three-tone shading, gold trims and glints ----------
  // tint: recolour the pixels already painted where test(x, y) is true (flat, so the rim shading leaves them alone)
  const tint = (g, test, c) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g.get(x, y) && test(x, y)) g.set(x, y, c, true); };
  const GOLD = '#f2c14e', GOLD_D = '#c98a1e', GOLD_L = '#fff0b0';
  const heartShape = (g, c) => { g.ell(10.5, 11.5, 7.5, 7.5, c).ell(21.5, 11.5, 7.5, 7.5, c); g.poly([[3.2, 13], [28.8, 13], [16, 28.6]], c); };
  function star(g, cx, cy, ro, ri, c, flat) {
    const pts = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? ri : ro; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    g.poly(pts, c, flat);
  }
  Object.assign(D, {
    // home-screen needs
    heart: g => {
      heartShape(g, '#ff3d6e');
      tint(g, (x, y) => x + y > 35 || y > 22, '#d41f55');
      g.line(6, 11, 8, 8, '#ff8fb0', true, 2); g.rect(9, 7, 2, 1, '#ff8fb0', true);
      g.rect(7, 9, 1, 1, '#ffffff', true); g.set(8, 8, '#ffffff', true);
    },
    heartEmpty: g => {
      heartShape(g, '#5a4d72');
      tint(g, (x, y) => x + y > 35 || y > 22, '#41365a');
      g.line(6, 11, 8, 8, '#776a93', true, 2); g.rect(9, 7, 2, 1, '#776a93', true);
    },
    energy: g => {
      g.poly([[20, 1.5], [5, 18.5], [14.5, 18.5], [10, 30.5], [27, 12], [17.5, 12], [23, 1.5]], '#ffd23d');
      tint(g, (x, y) => x + y > 33, '#f5a21b');
      g.line(19, 4, 10, 15, '#fff6c2', true); g.line(15, 20, 13, 25, '#ffe680', true);
      g.dots([[28, 3], [27, 4], [29, 4], [28, 5], [4, 26]], '#fff6c2');
    },
    hygiene: g => {
      g.poly([[15.5, 2], [24, 13], [26, 21], [22.5, 27.5], [15.5, 30], [8.5, 27.5], [5, 21], [7, 13]], '#38a8f5');
      tint(g, (x, y) => x + y > 38 || y > 26, '#1f74d0');
      tint(g, (x, y) => (x - 11) ** 2 / 9 + (y - 18) ** 2 / 30 < 1, '#8fd6ff');
      g.rect(10, 16, 2, 5, '#ffffff', true); g.set(11, 13, '#ffffff', true);
      g.ell(26.5, 5.5, 3, 3, '#bfe9ff', true); g.set(25, 4, '#ffffff', true);
    },
    // care actions
    bath: g => {
      g.ell(8.5, 13, 4.5, 4, '#eaf8ff', true).ell(14, 11.5, 5, 4.5, '#eaf8ff', true).ell(25, 13, 4, 3.5, '#eaf8ff', true);
      g.ell(8.5, 12, 2.5, 2, '#ffffff', true).ell(14, 10, 3, 2.5, '#ffffff', true);
      g.ell(20, 12, 3, 3, '#ffd23d', true).ell(21.5, 8.5, 2.6, 2.6, '#ffd23d', true);   // rubber duck
      g.dots([[23, 8]], OUT); g.rect(24, 9, 2, 1, '#ff8a2d', true);
      g.ell(27, 4, 2.3, 2.3, '#bfe9ff', true); g.set(26, 3, '#ffffff', true);
      g.poly([[1.5, 16], [30.5, 16], [28.5, 23.5], [23, 27], [9, 27], [3.5, 23.5]], '#f6f8fc');
      g.rect(2, 16, 28, 2, '#dfe6f2', true);
      tint(g, (x, y) => y >= 24 && y < 27, '#c6cfdf');
      g.rect(4, 20, 24, 1, GOLD, true);
      g.rect(7, 27, 3, 3, GOLD).rect(22, 27, 3, 3, GOLD);
      g.rect(6, 18, 2, 2, '#ffffff', true);
    },
    wake: g => {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, r1 = i % 2 ? 13 : 15;
        g.line(16 + Math.cos(a) * 11, 16 + Math.sin(a) * 11, 16 + Math.cos(a) * r1, 16 + Math.sin(a) * r1, i % 2 ? '#ffb52e' : '#ffd23d', true, 2);
      }
      g.ell(16, 16, 8.5, 8.5, '#ff9f1c');
      g.ell(15.2, 15.2, 6.8, 6.8, '#ffd23d', true);
      g.ell(13.5, 13.5, 3, 3, '#fff3b0', true);
      g.rect(12, 12, 2, 2, '#ffffff', true);
    },
    // training
    rock: g => {
      g.poly([[3, 27], [5, 15], [10, 8], [18, 5], [25, 9], [29, 17], [29, 27]], '#8d93a6');
      g.poly([[5, 16], [10, 8.5], [18, 5.5], [16, 13], [9, 19]], '#b7bdcc', true);
      g.poly([[25, 9], [29, 17], [29, 27], [22, 27], [24, 17]], '#636a7e', true);
      g.rect(3, 25, 27, 2, '#555c70', true);
      g.line(16, 13, 19, 19, '#454b5c', true); g.line(19, 19, 17, 24, '#454b5c', true); g.line(9, 19, 12, 23, '#454b5c', true);
      g.poly([[19, 16], [22, 12], [25, 16], [22, 21]], '#6fe3ff', true);   // a crystal in the rock
      g.poly([[19, 16], [22, 12], [22, 21]], '#c9f6ff', true);
      g.set(21, 14, '#ffffff', true);
      g.rect(10, 9, 3, 1, '#e6e9f1', true);
    },
    rubble: g => {
      g.poly([[2, 28], [4, 22], [9, 20], [12, 24], [11, 28]], '#8d93a6');
      g.poly([[13, 28], [15, 21], [21, 19], [25, 23], [24, 28]], '#7b8296');
      g.poly([[24, 28], [26, 24], [30, 25], [30, 28]], '#8d93a6');
      g.poly([[9, 16], [12, 13], [15, 16], [12, 18]], '#b7bdcc');
      g.poly([[18, 13], [21, 8], [23, 13], [21, 16]], '#6fe3ff', true); g.set(20, 11, '#ffffff', true);
      g.dots([[6, 12], [27, 15], [16, 6]], '#fff6c2');
    },
    orb: g => {   // incoming attack: a dark energy ball with a bright core
      g.ell(16, 16, 12.5, 12.5, '#5a1fa0');
      g.ell(16, 16, 9.5, 9.5, '#8b46e0', true);
      g.ell(15, 15, 6, 6, '#c79bff', true);
      g.ell(14.5, 14.5, 3, 3, '#f6ecff', true);
      g.rect(10, 9, 2, 2, '#ffffff', true);
    },
    shield: g => {
      g.poly([[16, 1.5], [28.5, 5.5], [27.5, 18], [16, 30.5], [4.5, 18], [3.5, 5.5]], GOLD);
      tint(g, (x, y) => x >= 16, GOLD_D);
      g.poly([[16, 4.5], [25.5, 7.5], [24.5, 17.5], [16, 27], [7.5, 17.5], [6.5, 7.5]], '#3f7fd0', true);
      tint(g, (x, y) => { const p = g.get(x, y); return p && p.c === '#3f7fd0' && x < 16; }, '#5c9be6');
      star(g, 16, 15.5, 5.5, 2.4, GOLD_L, true);
      g.dots([[8, 8], [9, 8], [8, 9]], '#ffffff');
    },
    // options
    image: g => {
      g.rect(2, 4, 28, 24, GOLD);
      g.rect(4, 6, 24, 20, '#7cc8ff', true);
      g.rect(4, 6, 24, 4, '#5bb2f5', true);
      g.ell(22, 12, 3, 3, '#ffe46b', true); g.set(21, 11, '#ffffff', true);
      g.poly([[4, 26], [4, 21], [11, 13], [17, 20], [21, 17], [28, 23], [28, 26]], '#7d8fd6', true);
      g.poly([[9.5, 15], [11, 13], [12.6, 15]], '#ffffff', true);
      g.poly([[4, 26], [4, 23], [12, 20], [20, 22], [28, 21], [28, 26]], '#4fbf4a', true);
      g.rect(4, 25, 24, 1, '#2f9a45', true);
      [[2, 4], [28, 4], [2, 26], [28, 26]].forEach(([x, y]) => g.rect(x, y, 2, 2, GOLD_L, true));
    },
    friends: g => {
      // back trainer (blue cap)
      g.ell(22, 11, 4.5, 4.5, '#ffd9b8');
      g.rect(17, 5, 10, 4, '#2f6fd0'); g.rect(17, 8, 12, 2, '#2f6fd0', true); g.rect(21, 6, 2, 2, '#ffffff', true);
      g.poly([[15, 30], [16, 19], [22, 16.5], [28, 19], [29.5, 30]], '#3d7dca');
      g.rect(22, 20, 1, 10, '#1f4f99', true);
      // front trainer (red cap)
      g.ell(11, 12, 5, 5, '#ffd9b8');
      g.rect(5, 5, 12, 4, '#e3350d'); g.rect(4, 8, 14, 2, '#e3350d', true); g.rect(10, 6, 2, 2, '#ffffff', true);
      g.poly([[2.5, 30], [3.5, 20], [11, 17], [18.5, 20], [19.5, 30]], '#e3350d');
      g.rect(11, 21, 1, 9, '#a3220a', true); g.rect(7, 23, 2, 2, GOLD, true);
      g.dots([[9, 13], [13, 13]], OUT);
    },
    card: g => {   // stat card: a gold-rimmed trading card with stat bars
      g.rect(5, 1, 22, 30, GOLD);
      g.rect(7, 3, 18, 26, '#2c3a8f', true);
      g.rect(8, 4, 16, 12, '#9bd8ff', true);
      for (let i = 0; i < 4; i++) g.line(8 + i * 5, 15, 12 + i * 5, 4, ['#ffc4e6', '#fff2a8', '#c2f5d0', '#ffc4e6'][i], true);
      g.ell(16, 10, 4, 4, '#ee1515', true); g.rect(12, 10, 9, 1, OUT, true);
      tint(g, (x, y) => (x - 16) ** 2 + (y - 10.5) ** 2 < 15 && y > 10, '#ffffff');
      g.rect(15, 9, 3, 3, '#ffffff', true); g.set(16, 10, OUT, true);
      g.rect(9, 18, 12, 2, '#ff6f61', true); g.rect(9, 21, 9, 2, '#7fdc6c', true); g.rect(9, 24, 11, 2, '#62c9ff', true);
      star(g, 22, 25, 2.6, 1.2, GOLD_L, true);
    },
    widget: g => {   // home-screen widget: a phone with a tile on its screen
      g.rect(7, 1, 18, 30, '#d9dde8');
      g.rect(9, 4, 14, 22, '#1d2240', true);
      g.rect(13, 2, 6, 1, '#8b92a8', true); g.rect(14, 27, 4, 2, '#8b92a8', true);
      g.rect(10, 5, 12, 9, '#ff6f61', true); g.rect(10, 5, 12, 2, '#ff9a8a', true);
      g.ell(16, 10, 2.5, 2.5, '#ffffff', true); g.rect(13, 10, 7, 1, OUT, true);
      [[10, 16], [14, 16], [18, 16], [10, 20], [14, 20], [18, 20]].forEach(([x, y], i) => g.rect(x, y, 3, 3, ['#7fdc6c', '#62c9ff', GOLD, '#c79bff', '#ff9cbd', '#7fdc6c'][i], true));
    },
    book: g => {   // how to play: a leather manual with gold corners
      g.rect(6, 2, 21, 25, '#c8323a');
      g.rect(6, 2, 4, 25, '#8f1f2a', true);
      g.rect(9, 26, 18, 4, '#f6efdc'); g.rect(10, 27, 16, 1, '#d9cfb6', true);
      g.ell(18, 14, 5.5, 5.5, GOLD, true); g.ell(18, 14, 3.8, 3.8, '#c8323a', true);
      g.rect(17, 11, 3, 1, GOLD_L, true); g.rect(16, 12, 1, 1, GOLD_L, true); g.rect(19, 12, 1, 2, GOLD_L, true); g.rect(18, 14, 1, 2, GOLD_L, true); g.rect(18, 17, 1, 1, GOLD_L, true);   // "?"
      [[24, 3], [24, 23]].forEach(([x, y]) => g.rect(x, y, 2, 2, GOLD, true));
      g.rect(11, 4, 12, 1, '#e4606a', true);
    },
    lock: g => {   // a gold padlock with a steel shackle
      g.rect(9, 3, 14, 4, '#c3c9d8'); g.rect(9, 3, 4, 12, '#c3c9d8'); g.rect(19, 3, 4, 12, '#c3c9d8');
      g.rect(13, 7, 6, 8, null);
      g.rect(10, 4, 2, 9, '#eef1f7', true);
      g.rect(5, 13, 22, 16, GOLD);
      tint(g, (x, y) => y >= 13 && y < 29 && x >= 18, GOLD_D);
      g.rect(6, 14, 20, 2, GOLD_L, true);
      g.ell(16, 20, 2.6, 2.6, '#3a2a14', true); g.rect(15, 21, 2, 5, '#3a2a14', true);
      g.rect(7, 26, 2, 1, GOLD_L, true);
    },
    credits: g => {   // a gold medal on a ribbon
      g.poly([[8, 1], [14, 1], [18, 13], [13, 15]], '#e3350d'); g.poly([[18, 1], [24, 1], [19, 15], [14, 13]], '#3d7dca');
      g.ell(16, 21, 9.5, 9.5, GOLD);
      g.ell(16, 21, 7, 7, GOLD_D, true);
      star(g, 16, 21.5, 6, 2.6, GOLD_L, true);
      g.rect(10, 15, 2, 2, '#ffffff', true);
    },
  });
  // eggs (3 rarities × 0–2 cracks)
  const EGG = { common: ['#fbf6ea', '#6fbf73'], rare: ['#e6f1ff', '#4f93c4'], legend: ['#fff1c4', '#e0a81f'] };
  Object.entries(EGG).forEach(([tier, [base, spot]]) => {
    for (let k = 0; k <= 2; k++) {
      D[`egg_${tier}_${k}`] = g => {
        g.ell(16, 18, 10.5, 13, base);
        g.ell(11, 12, 3, 2.5, spot).ell(21, 9, 2.2, 2, spot).ell(21, 19, 3.2, 3, spot).ell(12, 23, 2.5, 2.2, spot);
        g.rect(9, 8, 2, 3, '#ffffff', true);
        if (k >= 1) { g.line(8, 15, 12, 13, OUT, true); g.line(12, 13, 14, 16, OUT, true); g.line(14, 16, 17, 13, OUT, true); }
        if (k >= 2) { g.line(17, 13, 20, 16, OUT, true); g.line(20, 16, 24, 14, OUT, true); }
      };
    }
  });

  const cache = {}, urls = {};
  function get(name) {
    if (!cache[name]) {
      const g = new Grid();
      (D[name] || D.star)(g);
      cache[name] = render(g, name === 'bubble' ? { outline: '#3e8fc4', shade: false } : name === 'z' ? { outline: '#3a3060', shade: false } : {});
    }
    return cache[name];
  }
  function url(name) { return urls[name] || (urls[name] = get(name).toDataURL()); }
  /** draw centred at (x, y) at `size` px (rounded to whole pixels per sprite pixel when big enough) */
  function draw(ctx, name, x, y, size, opts = {}) {
    const c = get(name);
    let s = size / N;
    if (s >= 1) s = Math.max(1, Math.round(s * 2) / 2);
    const w = N * s;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    if (opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); ctx.drawImage(c, -w / 2, -w / 2, w, w); }
    else ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - w / 2), w, w);
    ctx.restore();
  }
  /** fill every <img data-icon="name"> inside root */
  function hydrate(root = document) {
    root.querySelectorAll('img[data-icon]').forEach(im => { const u = url(im.dataset.icon); if (im.src !== u) im.src = u; });
  }
  // ---------- the egg picture (assets/egg.png) replaces the drawn eggs ----------
  const listeners = [];
  (function loadEgg() {
    if (typeof document === 'undefined') return;
    const im = new Image();
    im.onload = () => {
      try {
        const W = im.naturalWidth, H = im.naturalHeight;
        const big = document.createElement('canvas'); big.width = W; big.height = H;
        const bg = big.getContext('2d'); bg.drawImage(im, 0, 0);
        const px = bg.getImageData(0, 0, W, H).data;
        // the picture is pixel art drawn big: find how many screen pixels make one art pixel
        const runs = [];
        for (const yy of [Math.floor(H * .35), Math.floor(H * .5), Math.floor(H * .65)]) {
          let run = 1;
          for (let x = 1; x < W; x++) {
            const i = (yy * W + x) * 4, j = i - 4;
            const same = Math.abs(px[i] - px[j]) + Math.abs(px[i + 1] - px[j + 1]) + Math.abs(px[i + 2] - px[j + 2]) + Math.abs(px[i + 3] - px[j + 3]) < 24;
            if (same) run++; else { if (run >= 3) runs.push(run); run = 1; }
          }
        }
        runs.sort((a, b) => a - b);
        let block = runs.length ? runs[Math.floor(runs.length * .2)] : 1;
        if (!(block >= 2 && block <= 40)) block = Math.max(1, Math.round(Math.max(W, H) / 30));
        const nw = Math.round(W / block), nh = Math.round(H / block), size = Math.max(nw, nh, 1);
        // sample the centre of each art pixel into a small, square canvas
        const base = document.createElement('canvas'); base.width = size; base.height = size;
        const g = base.getContext('2d'), out = g.createImageData(size, size), ox = Math.floor((size - nw) / 2), oy = size - nh;
        for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
          const sx = Math.min(W - 1, Math.floor((x + .5) * W / nw)), sy = Math.min(H - 1, Math.floor((y + .5) * H / nh));
          const i = (sy * W + sx) * 4, o = ((y + oy) * size + x + ox) * 4;
          out.data[o] = px[i]; out.data[o + 1] = px[i + 1]; out.data[o + 2] = px[i + 2]; out.data[o + 3] = px[i + 3] > 100 ? 255 : 0;
        }
        // the picture has a solid background: clear everything connected to the border that matches it
        {
          const d = out.data, at = (x, y) => (y * size + x) * 4;
          const bgc = [d[at(0, 0)], d[at(0, 0) + 1], d[at(0, 0) + 2]];
          const near = i => d[i + 3] > 0 && Math.abs(d[i] - bgc[0]) + Math.abs(d[i + 1] - bgc[1]) + Math.abs(d[i + 2] - bgc[2]) < 60;
          const seen = new Uint8Array(size * size), stack = [];
          for (let k = 0; k < size; k++) stack.push([k, 0], [k, size - 1], [0, k], [size - 1, k]);
          while (stack.length) {
            const [x, y] = stack.pop();
            if (x < 0 || y < 0 || x >= size || y >= size || seen[y * size + x]) continue;
            seen[y * size + x] = 1;
            const i = at(x, y);
            if (d[i + 3] === 0 || near(i)) { d[i + 3] = 0; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
          }
        }
        g.putImageData(out, 0, 0);
        const tint = (tier) => {      // green spots -> blue (rare) / gold (legendary)
          const c = document.createElement('canvas'); c.width = size; c.height = size;
          const cg = c.getContext('2d'); cg.drawImage(base, 0, 0);
          if (tier === 'common') return c;
          const d = cg.getImageData(0, 0, size, size);
          for (let i = 0; i < d.data.length; i += 4) {
            const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2];
            if (gg > r + 12 && gg > b + 12) {
              const l = (r + gg + b) / 3 / 255;
              const [R2, G2, B2] = tier === 'rare' ? [70, 130, 230] : [235, 175, 40];
              d.data[i] = R2 * (.55 + l * .6); d.data[i + 1] = G2 * (.55 + l * .6); d.data[i + 2] = B2 * (.55 + l * .6);
            }
          }
          cg.putImageData(d, 0, 0); return c;
        };
        const crack = (c, k) => {     // zig-zag cracks across the top half
          const cg = c.getContext('2d'); cg.fillStyle = '#2b2438';
          const pts = [[.2, .42], [.32, .36], [.42, .44], [.52, .34], [.62, .42], [.74, .35], [.84, .43]];
          const upto = k === 1 ? 4 : pts.length;
          for (let i = 0; i < upto - 1; i++) {
            const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], steps = Math.max(2, Math.round(size * .14));
            for (let t = 0; t <= steps; t++) cg.fillRect(Math.round((x0 + (x1 - x0) * t / steps) * size), Math.round((y0 + (y1 - y0) * t / steps) * size), 1, 1);
          }
          return c;
        };
        ['common', 'rare', 'legend'].forEach(tier => {
          for (let k = 0; k <= 2; k++) {
            const c = tint(tier);
            if (k) crack(c, k);
            // pad into the 32-grid size the drawing code expects
            const sq = document.createElement('canvas'); sq.width = sq.height = Math.max(32, size);
            sq.getContext('2d').drawImage(c, Math.floor((sq.width - size) / 2), sq.height - size);
            cache[`egg_${tier}_${k}`] = sq; delete urls[`egg_${tier}_${k}`];
          }
        });
        listeners.forEach(f => f());
      } catch (e) { /* opened as a local file: keep the drawn eggs */ }
    };
    im.src = 'assets/egg.png';
  })();
  // ---------- picture icons (assets/ui/*.png, copied from Pokemon_Item_Icons/; shop.png is a hand-drawn basket) ----------
  // Each PNG is cropped to its art and padded to a square, so every icon fills its slot the same way. Until a picture has
  // loaded (or if it can't be read), the drawn icon is used.
  const PICTURES = ['oran', 'rareCandy', 'pearl', 'starPiece', 'nugget', 'pokeball', 'greatball', 'ultraball', 'masterball',
    'pecha', 'aspear', 'cheri', 'chest', 'map', 'coin', 'shop', 'cart'];
  D.coin = D.coin || (g => { g.ell(16, 16, 12, 12, '#f2b51d'); g.ell(16, 16, 8, 8, '#ffd75a'); });
  ['shop', 'cart'].forEach(n => { D[n] = D[n] || D.star; });
  function nativePixels(im) {
    const W = im.naturalWidth, H = im.naturalHeight;
    const big = document.createElement('canvas'); big.width = W; big.height = H;
    const bg = big.getContext('2d', { willReadFrequently: true }); bg.drawImage(im, 0, 0);
    const px = bg.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const block = 1;   // keep full resolution: on phone screens these show at about 1:1
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, nw = Math.max(1, Math.round(cw / block)), nh = Math.max(1, Math.round(ch / block));
    const pad = Math.max(1, Math.round(Math.max(nw, nh) * .06)), size = Math.max(nw, nh) + pad * 2;
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), out = g.createImageData(size, size);
    const ox = Math.floor((size - nw) / 2), oy = Math.floor((size - nh) / 2);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const sx = Math.min(W - 1, x0 + Math.floor((x + .5) * cw / nw)), sy = Math.min(H - 1, y0 + Math.floor((y + .5) * ch / nh));
      const i = (sy * W + sx) * 4, o = ((y + oy) * size + x + ox) * 4;
      if (px[i + 3] <= 100) continue;
      out.data[o] = px[i]; out.data[o + 1] = px[i + 1]; out.data[o + 2] = px[i + 2]; out.data[o + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    return c;
  }
  if (typeof document !== 'undefined') {
    // item icons drawn for items.js (pic: true) live in assets/items/
    const ITEM_PICS = typeof ITEM_DATA !== 'undefined' ? Object.values(ITEM_DATA).filter(it => it.pic).map(it => it.icon) : [];
    const ALL = PICTURES.map(n => [n, `assets/ui/${n}.png`]).concat(ITEM_PICS.map(n => [n, `assets/items/${n}.png`]));
    let pending = ALL.length, changed = false;
    const done = () => { if (--pending === 0 && changed) listeners.forEach(f => f()); };
    ALL.forEach(([name, src]) => {
      const im = new Image();
      im.onload = () => {
        try { const c = nativePixels(im); if (c) { cache[name] = c; delete urls[name]; changed = true; } } catch (e) { /* local file: keep the drawn icon */ }
        done();
      };
      im.onerror = done;
      im.src = src;
    });
  }

  /** draw: like PX.draw but for sprites bigger than 32 (keeps whole pixels) */
  const draw0 = draw;
  function drawAny(ctx, name, x, y, size, opts) {
    const c = get(name);
    if (c.width === N) return draw0(ctx, name, x, y, size, opts);
    const w = size, s = w / c.width;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (opts && opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    if (opts && opts.rot) { ctx.translate(x, y); ctx.rotate(opts.rot); ctx.drawImage(c, -w / 2, -w / 2, w, c.height * s); }
    else ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - w / 2), w, c.height * s);
    ctx.restore();
  }
  return { get, url, draw: drawAny, hydrate, names: () => Object.keys(D), onUpdate: f => listeners.push(f) };
})();
