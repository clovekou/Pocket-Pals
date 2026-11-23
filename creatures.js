'use strict';
// Pocket Pal — species roster + sprite renderer.
// Sprites come from Pokemon-Sprites/ (PMD SpriteCollab layout); their metadata
// is generated into sprites.js by tools/build_sprites.py.

const ELEMENTS = {
  normal:   { label: 'Normal',   color: '#a8a77a', biome: 'meadow' },
  grass:    { label: 'Grass',    color: '#4cb04a', biome: 'meadow' },
  fire:     { label: 'Fire',     color: '#ee7f30', biome: 'volcano' },
  water:    { label: 'Water',    color: '#4f8fe8', biome: 'beach' },
  electric: { label: 'Electric', color: '#e8b10f', biome: 'meadow' },
  ice:      { label: 'Ice',      color: '#5fc0e0', biome: 'snow' },
  fighting: { label: 'Fighting', color: '#c22e28', biome: 'mountain' },
  poison:   { label: 'Poison',   color: '#a33ea1', biome: 'forest' },
  ground:   { label: 'Ground',   color: '#c9a44a', biome: 'mountain' },
  flying:   { label: 'Flying',   color: '#8f7fe8', biome: 'mountain' },
  psychic:  { label: 'Psychic',  color: '#f95587', biome: 'forest' },
  bug:      { label: 'Bug',      color: '#91a119', biome: 'forest' },
  rock:     { label: 'Rock',     color: '#b6a136', biome: 'mountain' },
  ghost:    { label: 'Ghost',    color: '#735797', biome: 'forest' },
  dragon:   { label: 'Dragon',   color: '#6f35fc', biome: 'mountain' },
  dark:     { label: 'Dark',     color: '#705746', biome: 'forest' },
  steel:    { label: 'Steel',    color: '#8a8aa8', biome: 'mountain' },
  fairy:    { label: 'Fairy',    color: '#d685ad', biome: 'meadow' },
};

const FLAVORS = [
  { id: 'sweet', label: 'Pecha Berry',  taste: 'Sweet', icon: 'pecha',  color: '#ffa3c7' },
  { id: 'sour',  label: 'Aspear Berry', taste: 'Sour',  icon: 'aspear', color: '#f3d23c' },
  { id: 'spicy', label: 'Cheri Berry',  taste: 'Spicy', icon: 'cheri',  color: '#e8282b' },
];

// Species come from species.js (edited in dashboard.html). id = Dex number.
// base = [ATK, DEF, SPD]; next = what it evolves into; evo = level it evolves at.
const SPECIES = (typeof SPECIES_CONFIG !== 'undefined' ? SPECIES_CONFIG : [])
  .filter(s => typeof SPRITE_DATA === 'undefined' || SPRITE_DATA[s.id])
  .map(s => ({ ...s, el: ELEMENTS[s.el] ? s.el : 'normal', next: [...(s.next || [])], tier: s.tier || 'common' }))
  .sort((a, b) => a.id - b.id);

const SPECIES_BY_ID = {};
SPECIES.forEach(s => { SPECIES_BY_ID[s.id] = s; });
SPECIES.forEach(s => { s.next = s.next.filter(n => SPECIES_BY_ID[n]); });
SPECIES.forEach(s => s.next.forEach(n => { SPECIES_BY_ID[n].prev = s.id; }));
SPECIES.forEach(s => {
  let st = 1, cur = s;
  while (cur.prev) { st++; cur = SPECIES_BY_ID[cur.prev]; }
  s.stage = st;
  s.lineBase = cur.id;
  s.fav = (s.id * 7 + 1) % 3;   // hidden favourite berry
});
const _bases = SPECIES.filter(s => !s.prev);
const STARTERS = (_bases.some(s => s.starter) ? _bases.filter(s => s.starter) : _bases).map(s => s.id);
const TIER_ORDER = ['common', 'rare', 'legend'];
const TIER_LABEL = { common: 'Common', rare: 'Rare', legend: 'Legendary' };

// ---------- sprite loading (lazy: an image is fetched the first time it's drawn) ----------
const _imgs = {};
function _img(src, onload) {
  let im = _imgs[src];
  if (!im) {
    im = new Image(); im._cbs = [];
    im.crossOrigin = 'anonymous'; // so remote sprites can still be measured
    im.onload = () => { const cbs = im._cbs; im._cbs = []; cbs.forEach(f => f()); };
    im.onerror = () => { // flaky mobile network: forget the failure and try again shortly
      im._tries = (im._tries || 0) + 1;
      if (im._tries <= 4) setTimeout(() => { im.src = src + (src.includes('?') ? '&' : '?') + 'retry=' + im._tries; }, 800 * im._tries);
      else { const cbs = im._cbs; im._cbs = []; cbs.forEach(f => f()); }
    };
    im.src = src; _imgs[src] = im;
  }
  if (onload) { if (im.complete) onload(); else im._cbs.push(onload); }
  return im;
}
// Where sprites come from: the local Pokemon-Sprites/ folder, or — when the game is hosted
// somewhere without that folder (e.g. GitHub Pages) — straight from the PMD SpriteCollab repo.
const SPRITECOLLAB = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/';
const REMOTE_SPRITES = typeof location !== 'undefined' && /\.github\.io$/i.test(location.hostname);
function _pad4(id) { return String(id).padStart(4, '0'); }
function _spriteUrl(id, sd, shiny, file) {
  return REMOTE_SPRITES
    ? `${SPRITECOLLAB}sprite/${_pad4(id)}/${shiny ? '0000/0001/' : ''}${file}`
    : `Pokemon-Sprites/${sd.f}/sprite/${shiny ? '0000/Shiny/' : ''}${file}?v=${sd.v}`;
}
function _portraitUrl(id, sd, shiny, emo) {
  return REMOTE_SPRITES
    ? `${SPRITECOLLAB}portrait/${_pad4(id)}/${shiny ? '0000/0001/' : ''}${emo}.png`
    : `Pokemon-Sprites/${sd.f}/portrait/${shiny ? '0000/Shiny/' : ''}${emo}.png?v=${sd.v}`;
}

// PMD direction rows: 0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft
const DIR_ROW = { front: 0, downright: 1, right: 2, left: 6, downleft: 7 };
const ANIM_FALLBACK = {
  Eat: ['Eat', 'Charge', 'Idle'], Hop: ['Hop', 'Nod', 'Idle'], Attack: ['Attack', 'Charge', 'Idle'],
  Hurt: ['Hurt', 'Idle'], Walk: ['Walk', 'Idle'], Sleep: ['Sleep', 'Idle'], Idle: ['Idle'],
};
const _animCache = {};
/** Animation info {fw, fh, frames, rows, dur, src, feet[], top[]} — feet are measured when the image loads. */
function spriteAnim(id, shiny, name) {
  const sd = SPRITE_DATA[id]; if (!sd) return null;
  const useShiny = !!(shiny && sd.s);
  const set = useShiny ? sd.s : sd.a;
  for (const n of ANIM_FALLBACK[name] || [name, 'Idle']) {
    if (!set[n]) continue;
    const key = id + (useShiny ? 's' : 'n') + n;
    if (!_animCache[key]) {
      const [fw, fh, frames, rows, dur, file] = set[n];
      const guess = Math.min(fh - 1, Math.round(fh / 2 + Math.min(10, fh / 4)));
      _animCache[key] = {
        name: n, fw, fh, frames, rows, dur,
        src: _spriteUrl(id, sd, useShiny, `${file || n}-Anim.png`),
        feet: new Array(rows).fill(guess), top: new Array(rows).fill(0), measured: false,
      };
    }
    return _animCache[key];
  }
  return null;
}
// find each direction's lowest/highest opaque pixel so sprites stand on the ground
const _probe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
function _measure(a, img) {
  if (a.measured || !_probe) return;
  a.measured = true;
  try {
    _probe.width = img.naturalWidth; _probe.height = img.naturalHeight;
    const g = _probe.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, _probe.width, _probe.height); g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, _probe.width, _probe.height).data, W = _probe.width;
    for (let r = 0; r < a.rows; r++) {
      let lo = -1, hi = a.fh;
      for (let y = 0; y < a.fh; y++) {
        const row = (r * a.fh + y) * W * 4;
        for (let x = 0; x < a.frames * a.fw && x < W; x++) {
          if (px[row + x * 4 + 3] > 0) { lo = Math.max(lo, y); hi = Math.min(hi, y); break; }
        }
      }
      if (lo >= 0) { a.feet[r] = lo; a.top[r] = hi; }
    }
  } catch (e) { /* opened as a local file: the browser forbids reading pixels, keep the estimate */ }
}
/** calls cb once the image for this animation has loaded (and been measured) */
function whenSprite(id, shiny, name, cb) {
  const a = spriteAnim(id, shiny, name); if (!a) return;
  // the callback can run immediately (image already loaded), so look the image up inside it
  _img(a.src, () => { const im = _imgs[a.src]; if (im && im.naturalWidth) _measure(a, im); cb && cb(); });
}
/** start loading the animations a Pokémon uses on the main screen */
function preloadSpecies(id, shiny) {
  for (const n of ['Idle', 'Walk', 'Sleep', 'Hop', 'Eat', 'Attack', 'Hurt']) whenSprite(id, shiny, n);
}
/** URL of a portrait for an emotion (falls back to Normal, then any), or null */
function portraitUrl(id, shiny, emo) {
  const sd = SPRITE_DATA[id]; if (!sd) return null;
  const useShiny = !!(shiny && sd.ps);
  const mask = useShiny ? sd.ps : sd.p;
  if (!mask) return null;
  let i = EMOTIONS.indexOf(emo);
  if (i < 0 || !(mask & (1 << i))) i = mask & 1 ? 0 : Math.log2(mask & -mask);
  return _portraitUrl(id, sd, useShiny, EMOTIONS[i]);
}
/** length of a one-shot animation, in seconds */
function animLength(id, name) {
  const a = spriteAnim(id, false, name); if (!a) return 0;
  return a.dur.reduce((x, y) => x + y, 0) / 60;
}

const _tmp = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/**
 * drawCreature(ctx, id, o)
 * o: { x, y (feet), size, t, shiny, sleep, eat, flip, walking, anim, animT, dir,
 *      alpha, silhouette (colour), hop, still, maxH }
 * The sprite is drawn at ~size/10 screen px per sprite pixel, shrunk if its idle frame would be taller than maxH.
 */
function drawCreature(ctx, id, o) {
  const name = o.anim || (o.sleep ? 'Sleep' : o.eat ? 'Eat' : o.walking ? 'Walk' : 'Idle');
  const a = spriteAnim(id, o.shiny, name); if (!a) return;
  const img = _img(a.src);
  if (!img.complete || !img.naturalWidth) return;
  if (!a.measured) _measure(a, img);

  // frame from time (durations are in 1/60 s)
  const total = a.dur.reduce((x, y) => x + y, 0) || 1;
  let tick = Math.floor(((o.animT != null ? o.animT : o.t || 0) * 60));
  tick = o.animT != null ? Math.min(tick, total - 1) : tick % total;
  if (o.still) tick = 0;
  let f = 0;
  for (let acc = 0; f < a.frames - 1; f++) { acc += a.dur[f]; if (tick < acc) break; }

  const dirName = o.dir || (name === 'Walk' || name === 'Attack' ? (o.flip ? 'left' : 'right') : (o.flip ? 'downleft' : 'downright'));
  const row = Math.min(a.rows - 1, o.still && !o.dir ? 0 : DIR_ROW[dirName] || 0);
  let scale = o.size / 10;
  if (o.pxScale) {                    // one shared pixel size (party Pokémon): sprite pixels match across species
    scale = o.pxScale;
    if (o.maxH) {                     // only true giants get shrunk, in whole device-pixel steps
      const idle = spriteAnim(id, o.shiny, 'Idle') || a;
      const h = idle.measured ? Math.max(8, idle.feet[0] - idle.top[0] + 1) : idle.fh * .7;
      const d = o.dpr || 1;
      while (h * scale > o.maxH && scale * d > 1) scale = (Math.round(scale * d) - 1) / d;
    }
  } else if (o.fitH) {                       // same on-screen height for every species (party Pokémon)
    const idle = spriteAnim(id, o.shiny, 'Idle') || a;
    if (!idle.measured) { const ii = _img(idle.src); if (ii.complete && ii.naturalWidth) _measure(idle, ii); }
    const h = idle.measured ? Math.max(8, idle.feet[0] - idle.top[0] + 1) : idle.fh * .7;
    scale = o.fitH / h;
  } else if (o.maxH) {
    const idle = spriteAnim(id, o.shiny, 'Idle') || a;
    const h = idle.measured ? Math.max(8, idle.feet[0] - idle.top[0] + 1) : idle.fh * .7;
    if (h * scale > o.maxH) scale = o.maxH / h;
  }
  const sx = f * a.fw, sy = row * a.fh;
  const dw = a.fw * scale, dh = a.fh * scale;
  const dx = o.x - dw / 2, dy = o.y - (o.hop || 0) - (a.feet[row] + 1) * scale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
  if (o.silhouette && _tmp) {
    _tmp.width = a.fw; _tmp.height = a.fh;
    const g = _tmp.getContext('2d');
    g.clearRect(0, 0, a.fw, a.fh);
    g.drawImage(img, sx, sy, a.fw, a.fh, 0, 0, a.fw, a.fh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = o.silhouette === true ? '#4a4460' : o.silhouette;
    g.fillRect(0, 0, a.fw, a.fh);
    ctx.drawImage(_tmp, dx, dy, dw, dh);
  } else {
    ctx.drawImage(img, sx, sy, a.fw, a.fh, dx, dy, dw, dh);
  }
  ctx.restore();
  // where the top of the sprite is on screen (for markers above its head)
  return { top: dy + (a.measured ? a.top[row] : a.fh * .15) * scale, scale };
}

const EGG_STYLES = {
  common: { c: '#fbf6ea', s: '#6fbf73' },
  rare:   { c: '#e6f1ff', s: '#4f93c4' },
  legend: { c: '#fff4d1', s: '#e0a81f' },
};
function drawEgg(ctx, x, y, size, tier, t, wobble, cracks) {
  const st = EGG_STYLES[tier] || EGG_STYLES.common;
  const rx = size * .62, ry = size * .8, lw = Math.max(1, size * .045);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 22) * .18 * (wobble || 0) + Math.sin(t * 1.5) * .03);
  if (tier === 'legend') {
    const g = ctx.createRadialGradient(0, -ry, size * .2, 0, -ry, size * 1.6);
    g.addColorStop(0, 'rgba(255,220,110,.55)'); g.addColorStop(1, 'rgba(255,220,110,0)');
    ctx.fillStyle = g; ctx.fillRect(-size * 2, -ry - size * 2, size * 4, size * 4);
  }
  ctx.beginPath();
  ctx.moveTo(0, -ry * 2);
  ctx.bezierCurveTo(rx * 1.05, -ry * 2, rx * 1.15, -ry * .35, rx * .9, -ry * .25);
  ctx.quadraticCurveTo(rx * .6, 0, 0, 0);
  ctx.quadraticCurveTo(-rx * .6, 0, -rx * .9, -ry * .25);
  ctx.bezierCurveTo(-rx * 1.15, -ry * .35, -rx * 1.05, -ry * 2, 0, -ry * 2);
  ctx.closePath();
  ctx.fillStyle = st.c; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = st.s;
  for (const [sx, sy, r] of [[-.4, -1.3, .2], [.35, -1.55, .15], [.45, -.8, .22], [-.3, -.55, .14], [0, -1.0, .1]]) {
    ctx.beginPath(); ctx.ellipse(sx * rx, sy * ry, r * size, r * size, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#2b2438'; ctx.lineWidth = lw; ctx.stroke();
  if (cracks > 0) {
    ctx.beginPath();
    ctx.moveTo(-rx * .6, -ry * 1.1); ctx.lineTo(-rx * .3, -ry * 1.25); ctx.lineTo(-rx * .1, -ry * 1.05); ctx.lineTo(rx * .15, -ry * 1.3);
    if (cracks > 1) { ctx.lineTo(rx * .35, -ry * 1.1); ctx.lineTo(rx * .6, -ry * 1.22); }
    ctx.strokeStyle = '#2b2438'; ctx.lineWidth = lw * .9; ctx.stroke();
  }
  ctx.restore();
}
