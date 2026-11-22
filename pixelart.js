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
  };
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
  return { get, url, draw, hydrate, names: () => Object.keys(D) };
})();
