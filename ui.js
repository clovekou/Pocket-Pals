'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const now = () => performance.now();
  Game.load();
  const ST = () => Game.state;

  // ======================= sound =======================
  const Sound = (() => {
    let ac = null;
    const SFX = {
      tap: [[660, .05]], pet: [[880, .06], [1175, .09]],
      eat: [[392, .07], [0, .04], [392, .07], [0, .04], [523, .1]],
      hatch: [[523, .1], [659, .1], [784, .1], [1047, .28]],
      level: [[523, .08], [659, .08], [784, .16]],
      evolve: [[392, .12], [523, .12], [659, .12], [784, .12], [1047, .45]],
      medal: [[784, .08], [988, .08], [1319, .28]],
      bye: [[659, .22], [523, .22], [440, .22], [392, .6]],
      sad: [[330, .25], [262, .45]], hit: [[140, .05]], catch: [[1047, .05], [1319, .05]], miss: [[200, .14]],
      bath: [[880, .04], [0, .03], [988, .04], [0, .03], [1175, .07]], poop: [[180, .06], [140, .09]],
      sleep: [[523, .15], [392, .28]], wake: [[392, .1], [523, .16]], no: [[220, .08], [0, .03], [220, .1]],
      blip: [[880, .022]], blipLow: [[440, .022]],
    };
    function unlock() {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (ac.state === 'suspended') ac.resume();
    }
    function play(n) {
      try { playUnsafe(n); } catch (e) { /* audio hiccup (e.g. Safari after locking the screen) — ignore */ }
    }
    function playUnsafe(n) {
      if (!ST().settings.sound || !ac || ac.state === 'closed') return;
      const seq = SFX[n]; if (!seq) return;
      let t = ac.currentTime + .01;
      for (const [f, d] of seq) {
        if (f > 0) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square'; o.frequency.value = f;
          g.gain.setValueAtTime(n.startsWith('blip') ? .025 : .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
          o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02);
        }
        t += d;
      }
    }
    return { unlock, play, ctx: () => ac };
  })();
  document.addEventListener('pointerdown', Sound.unlock, { capture: true });

  // ======================= music =======================
  // An original, cozy chiptune loop in the style of a handheld-game town theme (16 bars, loops ~45 s).
  const Music = (() => {
    const NOTE = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); const i = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (i + (+m[3] + 1) * 12 - 69) / 12); };
    // melody: [note, length in eighths], 8 eighths per bar
    const MEL = [
      ['G4', 2], ['E5', 2], ['D5', 1], ['C5', 1], ['D5', 2], ['E5', 3], ['C5', 1], ['A4', 4],
      ['F4', 1], ['A4', 1], ['C5', 2], ['D5', 1], ['C5', 1], ['A4', 2], ['B4', 2], ['D5', 2], ['G4', 4],
      ['G4', 2], ['E5', 2], ['F5', 1], ['E5', 1], ['D5', 2], ['E5', 2], ['G5', 2], ['B4', 4],
      ['A4', 2], ['C5', 1], ['F5', 1], ['E5', 2], ['D5', 2], ['D5', 2], ['B4', 2], ['C5', 4],
      ['A5', 2], ['G5', 1], ['F5', 1], ['E5', 2], ['C5', 2], ['G5', 3], ['E5', 1], ['C5', 4],
      ['D5', 2], ['F5', 2], ['A5', 2], ['G5', 1], ['F5', 1], ['E5', 2], ['D5', 2], ['B4', 4],
      ['A4', 1], ['C5', 1], ['F5', 2], ['E5', 1], ['D5', 1], ['C5', 2], ['B4', 2], ['E5', 2], ['A4', 4],
      ['D5', 2], ['F5', 1], ['E5', 1], ['D5', 2], ['B4', 2], ['C5', 6], [null, 2],
    ];
    // one chord per bar: [bass root, chord tones for the music-box arpeggio]
    const CH = { C: ['C3', ['C4', 'E4', 'G4']], Am: ['A2', ['A3', 'C4', 'E4']], F: ['F2', ['F3', 'A3', 'C4']], G: ['G2', ['G3', 'B3', 'D4']], Em: ['E2', ['E3', 'G3', 'B3']], Dm: ['D3', ['D4', 'F4', 'A4']] };
    const BARS = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'F', 'C', 'Dm', 'G', 'F', 'Am', 'Dm', 'C'];
    const E8 = 60 / 84 / 2; // eighth note at 84 bpm
    let master = null, filt = null, timer = null, next = 0, step = 0, melIdx = 0, melLeft = 0;
    const want = () => ST().settings.music !== false && vol() > 0 && !document.hidden;
    const vol = () => { const v = ST().settings.musicVol; return (v == null ? 60 : v) / 100; };
    function tone(type, f, t, d, vol, dest) {
      const ac = Sound.ctx(), o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015);
      g.gain.exponentialRampToValueAtTime(vol * .55, t + Math.min(.18, d * .5)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + .05);
    }
    function schedule() {
      const ac = Sound.ctx();
      if (!ac || ac.state !== 'running') return;
      if (!want()) { if (master) master.gain.setTargetAtTime(0, ac.currentTime, .3); return; }
      if (!master) {
        master = ac.createGain(); master.gain.value = 0;
        filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 2200;
        filt.connect(master); master.connect(ac.destination);
      }
      const P = Game.pet(), quiet = P && P.asleep;
      master.gain.setTargetAtTime(vol() * (quiet ? .5 : 1.2), ac.currentTime, .15);
      if (next < ac.currentTime) next = ac.currentTime + .1;
      while (next < ac.currentTime + .35) {
        const bar = Math.floor(step / 8) % BARS.length, beat = step % 8, [root, tri] = CH[BARS[bar]];
        if (melLeft <= 0) {
          const [n, len] = MEL[melIdx]; melIdx = (melIdx + 1) % MEL.length; melLeft = len;
          if (n) tone('square', NOTE(n), next, len * E8 * .95, .045, filt);
        }
        melLeft--;
        if (beat === 0 || beat === 4) tone('triangle', NOTE(root), next, E8 * 3.6, .16, filt);
        if (beat === 2 || beat === 6) tone('triangle', NOTE(root) * 1.5, next, E8 * 1.8, .1, filt);
        tone('sine', NOTE(tri[[0, 1, 2, 1][beat % 4]]) * 2, next, E8 * 1.6, .03, filt);
        next += E8; step = (step + 1) % (BARS.length * 8);
      }
    }
    function start() { if (!timer) timer = setInterval(() => { try { schedule(); } catch (e) { /* audio hiccup */ } }, 90); }
    return { start };
  })();
  document.addEventListener('pointerdown', () => { Sound.unlock(); Music.start(); }, { capture: true });

  // ======================= helpers =======================
  const rng = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const fmtDur = m => {
    m = Math.max(0, Math.round(m));
    const d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
    return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = n => `<img class="ic" src="${PX.url(n)}" alt="">`;
  const icons = s => String(s).replace(/\{i:(\w+)\}/g, (_, n) => ic(n)); // {i:name} -> pixel icon
  const petName = () => { const p = Game.pet(); if (!p) return ''; if (p.egg) return 'Egg'; return p.name || Game.sp().name; };
  const stageScale = id => { const s = SPECIES_BY_ID[id]; return s.tier === 'legend' ? 1.12 : [0, .85, 1, 1.12][s.stage] || 1; };

  function heart(g, x, y, r) { PX.draw(g, 'heart', x, y, r * 2.6); }

  function star(g, x, y, r, rot, col) { PX.draw(g, col === '#fff' || col === '#fff6b0' ? 'sparkle' : 'star', x, y, r * 2.6, { rot: 0 }); }


  // ======================= toasts =======================
  function toast(msg, ms = 2800) {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstChild.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = icons(esc(msg)); box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms);
  }

  // ======================= scene =======================
  const stage = $('#stage'), cv = $('#scene'), cx = cv.getContext('2d');
  let W = 1, H = 1, DPR = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  new ResizeObserver(resize).observe(stage); resize();

  const V = {
    lift: 0,
    x: .5, tx: .5, flip: false, moving: false, nextMove: 0, nextBlink: 2, blinkUntil: 0,
    eatUntil: 0, eatColor: null, hopAt: -9, hearts: [], fx: [], eggWobbleUntil: 0, anim: null, press: null, bathUntil: 0,
  };
  const horizon = () => H * .6, feetY = () => H * .86 - V.lift;
  const talkEl = document.getElementById('talk');
  /** how far the ground must rise so the Pokémon stands just above the dialogue box */
  function talkLift() {
    if (!Talk.busy || talkEl.classList.contains('hidden')) return 0;
    const top = talkEl.offsetTop; // box top inside the stage (the portrait sits to the left, above it)
    return Math.max(0, H * .86 - (top - 10));
  }
  const baseSize = () => Math.min(W * .14, H * .16);
  const petSize = () => { const p = Game.pet(); return p && !p.egg ? baseSize() * stageScale(p.sp) : baseSize(); };

  function addHearts(n = 4) {
    const x = V.x * W, y = feetY() - petSize() * 2;
    for (let i = 0; i < n; i++) V.hearts.push({ x: x + (Math.random() - .5) * 60, y: y + Math.random() * 20, vy: 30 + Math.random() * 25, life: 1.4 + Math.random() * .5, age: 0 });
  }
  function addSparkles(x, y, n = 10, col = '#fff6b0') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 80;
      V.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .8 + Math.random() * .5, age: 0, col });
    }
  }

  function dayPhase() {
    const p = Game.pet();
    if (p && !p.egg && p.asleep) return 'night';
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 17.5) return 'day';
    if (h >= 17.5 && h < 20) return 'dusk';
    return 'night';
  }
  const SKY = { dawn: ['#ff9e7a', '#ffe0b0'], day: ['#5fb8f5', '#cdeeff'], dusk: ['#5b4a9e', '#ff9a72'], night: ['#0f1433', '#2c2f66'] };

  function drawSky(t, phase) {
    const g = cx.createLinearGradient(0, 0, 0, horizon());
    g.addColorStop(0, SKY[phase][0]); g.addColorStop(1, SKY[phase][1]);
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
    if (phase === 'night') {
      for (let i = 0; i < 40; i++) {
        const a = .4 + .6 * Math.abs(Math.sin(t * (1 + rng(i) * 2) + i));
        cx.fillStyle = `rgba(255,255,255,${a})`;
        cx.fillRect(rng(i + 1) * W, rng(i + 50) * horizon() * .9, 2, 2);
      }
      const mx = W * .78, my = H * .14, mr = Math.min(W, H) * .06;
      cx.fillStyle = '#fff6d6'; cx.beginPath(); cx.arc(mx, my, mr, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = SKY.night[0]; cx.beginPath(); cx.arc(mx + mr * .45, my - mr * .2, mr * .85, 0, Math.PI * 2); cx.fill();
    } else {
      const k = Math.min(1, Math.max(0, (h - 5) / 15));
      const sx = W * (.1 + .8 * k), sy = horizon() * (.75 - Math.sin(k * Math.PI) * .6), sr = Math.min(W, H) * .065;
      cx.fillStyle = phase === 'day' ? 'rgba(255,240,150,.35)' : 'rgba(255,200,140,.35)';
      cx.beginPath(); cx.arc(sx, sy, sr * 1.7, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = phase === 'day' ? '#ffe36b' : '#ffb36b';
      cx.beginPath(); cx.arc(sx, sy, sr, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 3; i++) {
        const x = ((t * (6 + i * 3) + rng(i + 9) * W * 1.5) % (W + 160)) - 80, y = H * (.08 + i * .09);
        cx.beginPath(); cx.ellipse(x, y, 34, 12, 0, 0, Math.PI * 2); cx.ellipse(x + 20, y - 8, 22, 12, 0, 0, Math.PI * 2); cx.ellipse(x - 18, y - 4, 18, 10, 0, 0, Math.PI * 2); cx.fill();
      }
    }
  }

  function drawBiome(biome, t, phase) {
    const hz = horizon();
    const hill = (col, amp, y0, seed) => {
      cx.fillStyle = col; cx.beginPath(); cx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) cx.lineTo(x, y0 - Math.sin(x / W * 3 + seed) * amp - Math.sin(x / W * 7 + seed * 2) * amp * .3);
      cx.lineTo(W, H); cx.closePath(); cx.fill();
    };
    const peaks = (col, cap, n, hgt, seed) => {
      for (let i = 0; i < n; i++) {
        const x = (i + .5) / n * W + (rng(seed + i) - .5) * W / n, h = hgt * (.6 + rng(seed + i + 7) * .5), w = W / n * .9;
        cx.fillStyle = col; cx.beginPath(); cx.moveTo(x - w, hz); cx.lineTo(x, hz - h); cx.lineTo(x + w, hz); cx.fill();
        if (cap) { cx.fillStyle = cap; cx.beginPath(); cx.moveTo(x - w * .25, hz - h * .75); cx.lineTo(x, hz - h); cx.lineTo(x + w * .25, hz - h * .75); cx.lineTo(x + w * .08, hz - h * .7); cx.lineTo(x - w * .08, hz - h * .78); cx.fill(); }
      }
    };
    if (biome === 'beach') {
      cx.fillStyle = '#3b9ed8'; cx.fillRect(0, hz - H * .07, W, H * .1);
      cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 2;
      for (let r = 0; r < 3; r++) {
        cx.beginPath();
        for (let x = 0; x <= W; x += 6) cx.lineTo(x, hz - H * .05 + r * H * .02 + Math.sin(x / 18 + t * 2 + r) * 2);
        cx.stroke();
      }
      hill('#f3dfa2', H * .01, hz + H * .02, 1);
      for (let i = 0; i < 6; i++) { cx.fillStyle = '#e8c987'; cx.beginPath(); cx.ellipse(rng(i + 3) * W, hz + H * .1 + rng(i + 4) * H * .25, 6, 3, 0, 0, Math.PI * 2); cx.fill(); }
    } else if (biome === 'forest') {
      for (let i = 0; i < 9; i++) {
        const x = rng(i + 20) * W, h = H * (.18 + rng(i + 30) * .14), w = h * .35;
        cx.fillStyle = i % 2 ? '#2f6b3f' : '#275a35';
        cx.beginPath(); cx.moveTo(x - w, hz + 4); cx.lineTo(x, hz - h); cx.lineTo(x + w, hz + 4); cx.fill();
      }
      hill('#4f8f4a', H * .015, hz + H * .02, 2);
      for (let i = 0; i < 4; i++) {
        const x = rng(i + 60) * W, y = hz + H * .12 + rng(i + 61) * H * .2;
        cx.fillStyle = '#f2efe1'; cx.fillRect(x - 2, y - 6, 4, 7);
        cx.fillStyle = '#d9534f'; cx.beginPath(); cx.ellipse(x, y - 6, 7, 5, 0, Math.PI, 0); cx.fill();
      }
    } else if (biome === 'volcano') {
      const vx = W * .7, vh = H * .32, vw = W * .35;
      cx.fillStyle = '#5a4545'; cx.beginPath(); cx.moveTo(vx - vw, hz); cx.lineTo(vx - vw * .15, hz - vh); cx.lineTo(vx + vw * .15, hz - vh); cx.lineTo(vx + vw, hz); cx.fill();
      cx.fillStyle = `rgba(255,120,40,${.6 + Math.sin(t * 2) * .2})`; cx.beginPath(); cx.ellipse(vx, hz - vh, vw * .15, 6, 0, 0, Math.PI * 2); cx.fill();
      for (let i = 0; i < 3; i++) { const ph = (t * .2 + i / 3) % 1; cx.fillStyle = `rgba(120,110,110,${.5 * (1 - ph)})`; cx.beginPath(); cx.arc(vx + Math.sin(ph * 4 + i) * 12, hz - vh - ph * H * .2, 10 + ph * 22, 0, Math.PI * 2); cx.fill(); }
      hill('#6b5050', H * .012, hz + H * .02, 3);
      cx.strokeStyle = '#ff7a2d'; cx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const x = rng(i + 80) * W, y = hz + H * .1 + rng(i + 81) * H * .25; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 14, y + 4); cx.lineTo(x + 24, y - 2); cx.stroke(); }
    } else if (biome === 'mountain') {
      peaks('#8e9bb8', '#f4f8ff', 4, H * .3, 40);
      peaks('#76839f', null, 5, H * .16, 50);
      hill('#9fb57a', H * .015, hz + H * .02, 4);
      for (let i = 0; i < 6; i++) { cx.fillStyle = '#8a8f8a'; cx.beginPath(); cx.ellipse(rng(i + 90) * W, hz + H * .1 + rng(i + 91) * H * .25, 9, 5, 0, 0, Math.PI * 2); cx.fill(); }
    } else if (biome === 'snow') {
      peaks('#cfe3f2', '#ffffff', 4, H * .24, 70);
      hill('#f4fbff', H * .02, hz + H * .02, 5);
      cx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 30; i++) {
        const x = (rng(i + 100) * W + Math.sin(t + i) * 10) % W, y = (rng(i + 140) * H + t * (20 + rng(i) * 20)) % H;
        cx.beginPath(); cx.arc(x, y, 1.5 + rng(i + 7) * 1.5, 0, Math.PI * 2); cx.fill();
      }
    } else { // meadow
      hill('#8fd16a', H * .03, hz - H * .01, 0);
      hill('#7cc35a', H * .012, hz + H * .03, 6);
      for (let i = 0; i < 14; i++) {
        const x = rng(i + 200) * W, y = hz + H * .08 + rng(i + 201) * H * .3;
        cx.strokeStyle = '#5ea844'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(x - 4, y); cx.lineTo(x - 6, y - 8); cx.moveTo(x, y); cx.lineTo(x, y - 10); cx.moveTo(x + 4, y); cx.lineTo(x + 6, y - 8); cx.stroke();
        if (i % 3 === 0) { cx.fillStyle = ['#fff', '#ffd23d', '#ff8fb3'][i % 9 / 3 | 0]; cx.beginPath(); cx.arc(x + 10, y - 3, 3, 0, Math.PI * 2); cx.fill(); }
      }
    }
    if (phase === 'night') { cx.fillStyle = 'rgba(10,14,45,.45)'; cx.fillRect(0, hz - H * .35, W, H); }
    else if (phase === 'dusk') { cx.fillStyle = 'rgba(80,40,90,.18)'; cx.fillRect(0, hz - H * .35, W, H); }
  }

  // ---------- uploaded backgrounds (set in the dashboard) ----------
  const bgImgs = {};
  function drawCustomBg(scene, phase) {
    const cfg = typeof BACKGROUNDS !== 'undefined' ? BACKGROUNDS : null;
    const file = cfg && cfg.assign && (cfg.assign[scene] || cfg.assign.default);
    if (!file) return false;
    let im = bgImgs[file];
    if (!im) { im = bgImgs[file] = new Image(); im.src = 'backgrounds/' + encodeURIComponent(file); }
    if (!im.complete || !im.naturalWidth) return false;          // built-in scenery until it loads
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight); // cover the whole stage
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    cx.drawImage(im, (W - w) / 2, (H - h) * .5, w, h);            // centred, so the top of the scene isn't cut off
    V.bg = { x: (W - w) / 2, y: (H - h) * .5, w, h };              // where the picture landed (party stands on its back lawn)
    if (cfg.night !== false) {
      if (phase === 'night') { cx.fillStyle = 'rgba(10,14,45,.5)'; cx.fillRect(0, 0, W, H); }
      else if (phase === 'dusk') { cx.fillStyle = 'rgba(90,40,100,.18)'; cx.fillRect(0, 0, W, H); }
      else if (phase === 'dawn') { cx.fillStyle = 'rgba(255,150,110,.12)'; cx.fillRect(0, 0, W, H); }
    }
    return true;
  }

  const POOP_X = [.16, .84, .7];
  function drawPoop(x, y, t, i) {
    const r = baseSize() * .22, sz = Math.max(32, Math.round(baseSize() * .9 / 16) * 16);
    PX.draw(cx, 'poop', x, y - sz * .42, sz);
    cx.save(); cx.translate(x, y - sz * .5);
    cx.strokeStyle = 'rgba(150,170,80,.75)'; cx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      cx.beginPath();
      for (let j = 0; j < 8; j++) cx.lineTo(k * r * .6 + Math.sin(j * .9 + t * 3 + i + k) * 3, -r * 1.5 - j * 3);
      cx.stroke();
    }
    cx.restore();
  }

  function stepView(t, dt) {
    const p = Game.pet();
    if (t > V.nextBlink) { V.blinkUntil = t + .14; V.nextBlink = t + 2.5 + Math.random() * 3; }
    V.moving = false;
    syncPals(t); stepPals(t, dt);
    // rise smoothly above the dialogue box while talking, settle back afterwards
    V.lift += (talkLift() - V.lift) * Math.min(1, dt * 8);
    if (Talk.busy && !V.anim) {           // keep clear of the portrait square on the left
      const minX = Math.min(.7, (100 + petSize() * 1.2) / W);
      if (V.tx < minX) V.tx = minX + Math.random() * .1;
      if (V.x < minX - .02) { V.x += Math.min(minX - V.x, dt * .35); V.flip = false; }
    }
    if (p && !p.egg && !p.asleep && !V.anim && now() > V.eatUntil && now() > V.bathUntil && !V.press) {
      if (t > V.nextMove) { V.tx = .22 + Math.random() * .56; V.nextMove = t + 3 + Math.random() * 5; }
      const sad = Game.lowest() < 25;
      const sp = (sad ? .035 : .07) * dt * (p.weight > 50 ? .6 : 1);
      const d = V.tx - V.x;
      if (Math.abs(d) > .004) { V.x += Math.sign(d) * Math.min(Math.abs(d), sp); V.flip = d < 0; V.moving = true; }
    } else if (p && p.asleep) { V.x += (.5 - V.x) * Math.min(1, dt * 2); }
    V.hearts = V.hearts.filter(h => { h.age += dt; h.y -= h.vy * dt; return h.age < h.life; });
    V.fx = V.fx.filter(f => { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 60 * dt; return f.age < f.life; });
  }

  // ---------- party Pokémon in the background ----------
  const PAL_ACTS = ['wander', 'wander', 'sleep', 'play', 'chat', 'chat'];
  V.pals = [];
  function syncPals(t) {
    const party = Game.party();
    const sig = party.map(m => m.sp + (m.shiny ? 's' : '')).join(',');
    if (V.palSig === sig) return;
    V.palSig = sig;
    V.pals = party.map((m, i) => {
      const old = V.pals.find(p => p.sp === m.sp && p.shiny === m.shiny);
      return old || { sp: m.sp, shiny: m.shiny, x: .12 + Math.random() * .76, tx: .5, flip: Math.random() < .5, act: 'wander', until: 0, t0: t,
        depth: .62 + (i % 3) * .04 + Math.random() * .02 };
    });
    party.forEach(m => preloadSpecies(m.sp, m.shiny));
  }
  function stepPals(t, dt) {
    const pals = V.pals;
    const P = Game.pet(), mainAsleep = !!(P && !P.egg && P.asleep);
    pals.forEach((p, i) => {
      // lights out: when the main Pokémon sleeps, the whole party curls up too
      if (mainAsleep) { if (p.act !== 'sleep' || !p.napWithMain) { p.act = 'sleep'; p.napWithMain = true; p.t0 = t; } p.moving = false; p.until = t + 1 + Math.random() * 3; return; }
      if (p.napWithMain) { p.napWithMain = false; p.until = t + Math.random() * 1.5; } // wake up a moment after the main
      if (t > p.until) {                                  // pick a new activity
        p.act = PAL_ACTS[Math.floor(Math.random() * PAL_ACTS.length)];
        p.until = t + 7 + Math.random() * 9; p.t0 = t;
        p.tx = .1 + Math.random() * .8;
        if (p.act === 'chat') {                           // walk over to a friend (another pal, or the main)
          const others = pals.filter(q => q !== p);
          p.friend = others.length && Math.random() < .85 ? others[Math.floor(Math.random() * others.length)] : 'main';
        }
      }
      let target = p.tx;
      if (p.act === 'chat') {
        const fx = p.friend === 'main' ? V.x : p.friend.x;
        target = Math.max(.06, Math.min(.94, fx + (p.x < fx ? -1 : 1) * (p.friend === 'main' ? .24 : .15)));
        if (p.friend !== 'main' && p.friend.act !== 'chat') { p.friend.act = 'chat'; p.friend.friend = p; p.friend.until = p.until; p.friend.t0 = t; }
      }
      p.moving = false;
      if (p.act === 'wander' || p.act === 'chat') {
        const d = target - p.x;
        if (Math.abs(d) > .006) { p.x += Math.sign(d) * Math.min(Math.abs(d), dt * .05); p.flip = d < 0; p.moving = true; }
        else if (p.act === 'chat') { const fx = p.friend === 'main' ? V.x : p.friend.x; p.flip = fx < p.x; }
        else if (Math.random() < dt * .3) p.tx = .1 + Math.random() * .8;
      }
    });
  }
  function drawPal(p, t) {
    // with a background picture, the party stands far back on the open lawn below the trees
    // (picture coords: 43-48% down, 18-80% across), small because they're further away
    const bg = V.bg, far = !!bg;
    const fy = far ? Math.max(H * .3, bg.y + bg.h * (.43 + (p.depth - .62) * .5)) - V.lift * .5
                   : H * p.depth - V.lift * .5;
    const x = far ? Math.max(bg.x, 0) + Math.min(bg.w, W) * (.18 + (p.x - .1) / .8 * .62) : p.x * W;
    const size = baseSize() * (far ? .34 : .55);
    const fitH = baseSize() * (far ? .68 : 1.15);   // every party Pokémon is drawn this tall, whatever its species
    cx.fillStyle = 'rgba(0,0,0,.14)'; cx.beginPath(); cx.ellipse(x, fy, size * .8, size * .16, 0, 0, Math.PI * 2); cx.fill();
    const sleeping = p.act === 'sleep', playing = p.act === 'play' && !p.moving;
    const pos = drawCreature(cx, p.sp, {
      x, y: fy, size, t: t + p.depth * 10, fitH, shiny: p.shiny, sleep: sleeping, walking: p.moving, flip: p.flip,
      anim: playing ? 'Hop' : undefined, animT: playing ? ((t - p.t0) % Math.max(.4, animLength(p.sp, 'Hop') + .5)) : undefined,
    });
    const top = pos ? pos.top : fy - size * 2;
    if (sleeping) {
      const ph = (t * .4 + p.depth) % 1;
      PX.draw(cx, 'z', x + size * .5, top - 4 - ph * 18, 16, { alpha: 1 - ph });
    } else if (p.act === 'chat' && !p.moving) {
      const turn = Math.floor((t - p.t0) / 1.6) % 2 === (p.friend !== 'main' && V.pals.indexOf(p) > V.pals.indexOf(p.friend) ? 1 : 0);
      if (turn) PX.draw(cx, Math.floor((t - p.t0) / 3.2) % 3 === 2 ? 'note' : 'chat', x + (p.flip ? -1 : 1) * size * .4, top - 12, 24);
    } else if (playing && Math.sin(t * 3 + p.depth * 20) > .85) {
      PX.draw(cx, 'note', x, top - 10, 20);
    }
    p.hit = { x, top, fy, w: Math.max(28, size * 1.2) };
  }

  function drawPet(t, ms) {
    const p = Game.pet(); if (!p) return;
    const fy = feetY();
    if (p.egg) {
      const s = SPECIES_BY_ID[p.sp];
      const sz = baseSize() * 1.1;
      cx.fillStyle = 'rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(W / 2, fy, sz * .7, sz * .16, 0, 0, Math.PI * 2); cx.fill();
      const eggPx = Math.round(sz * 2.2 / 32) * 32 || 64, wob = ms < V.eggWobbleUntil ? Math.sin(t * 22) * .18 : Math.sin(t * 1.5) * .04;
      cx.save(); cx.translate(W / 2, fy - eggPx * .08); cx.rotate(wob);
      PX.draw(cx, `egg_${s.tier || 'common'}_${Math.min(2, p.taps)}`, 0, -eggPx * .45, eggPx);
      cx.restore();
      return;
    }
    const size = petSize();
    const x = V.x * W;
    cx.fillStyle = 'rgba(0,0,0,.18)'; cx.beginPath(); cx.ellipse(x, fy, size * .85, size * .18, 0, 0, Math.PI * 2); cx.fill();
    const hopT = (ms - V.hopAt) / 1000, hopping = hopT < animLength(p.sp, 'Hop') && !p.asleep;
    const mainPos = drawCreature(cx, p.sp, {
      x, y: fy, size, t, maxH: H * .42, shiny: p.shiny, sleep: p.asleep, blink: t < V.blinkUntil,
      eat: ms < V.eatUntil, flip: V.flip, walking: V.moving,
      anim: hopping ? 'Hop' : (!V.moving && ms >= V.eatUntil && !p.asleep && Game.lowest() < 15 ? 'Hurt' : undefined),
      animT: hopping ? hopT : undefined,
    });
    if (mainPos && Game.party().length) {               // ▼ marks your main when others are around
      PX.draw(cx, 'arrow', x, mainPos.top - 16 - Math.abs(Math.sin(t * 3)) * 6, 24);
    }
    if (p.shiny && !p.asleep && Math.sin(t * 1.3) > .97) addSparkles(x + (Math.random() - .5) * size * 2, fy - size * (1 + Math.random() * 1.2), 1, '#fff');
    if (ms < V.eatUntil) {
      const k = (V.eatUntil - ms) / 2500, dir = V.flip ? -1 : 1;
      const bx = x + dir * size * .9, by = fy - size * 1.2;
      PX.draw(cx, V.eatIcon || 'pecha', bx, by, Math.max(16, Math.round((size * .7 * k + 8) / 8) * 8));
      if (Math.random() < .2) V.fx.push({ kind: 'crumb', x: bx, y: by, vx: (Math.random() - .5) * 60, vy: -30, life: .5, age: 0, col: V.eatColor });
    }
    if (p.asleep) {
      cx.fillStyle = '#fff'; cx.font = `800 ${Math.round(size * .35)}px system-ui`;
      for (let i = 0; i < 3; i++) {
        const ph = (t * .35 + i / 3) % 1;
        cx.globalAlpha = 1 - ph;
        PX.draw(cx, 'z', x + size * (.7 + ph * .6), fy - size * (1.8 + ph * 1.2), 24 + i * 6, { alpha: 1 - ph });
      }
      cx.globalAlpha = 1;
    }
    if (V.press && V.press.onPet && ms - V.press.t0 > 300) {
      const k = Math.min(1, (ms - V.press.t0) / 3000);
      cx.strokeStyle = 'rgba(255,255,255,.9)'; cx.lineWidth = 5; cx.lineCap = 'round';
      cx.beginPath(); cx.arc(x, fy - size, size * 1.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); cx.stroke();
    }
  }

  function drawFx() {
    for (const h of V.hearts) { cx.globalAlpha = Math.min(1, (h.life - h.age) * 2); heart(cx, h.x + Math.sin(h.age * 5) * 6, h.y, 9); }
    for (const f of V.fx) {
      cx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      if (f.kind === 'spark') star(cx, f.x, f.y, 5, f.age * 4, f.col);
      else if (f.kind === 'bubble') PX.draw(cx, 'bubble', f.x, f.y, f.r * 3.2);
      else { cx.fillStyle = f.col; cx.beginPath(); cx.arc(f.x, f.y, 3, 0, Math.PI * 2); cx.fill(); }
    }
    cx.globalAlpha = 1;
  }

  // ------------- special animations -------------
  function drawBath(t, ms) {
    if (ms > V.bathUntil) return;
    const k = 1 - (V.bathUntil - ms) / 2400;
    const x = V.x * W, fy = feetY(), size = petSize();
    cx.fillStyle = 'rgba(255,255,255,.92)';
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2 + t, r = size * (1.1 + Math.sin(i * 3 + t * 4) * .15);
      const fade = k < .8 ? Math.min(1, k * 4) : (1 - k) * 5;
      cx.globalAlpha = Math.max(0, fade);
      cx.beginPath(); cx.arc(x + Math.cos(a) * r, fy - size + Math.sin(a) * r * .9, size * .28, 0, Math.PI * 2); cx.fill();
    }
    cx.globalAlpha = 1;
    if (Math.random() < .5) V.fx.push({ kind: 'bubble', x: x + (Math.random() - .5) * size * 2, y: fy - size * Math.random() * 2, vx: 0, vy: -50, r: 4 + Math.random() * 8, life: 1, age: 0 });
  }

  function drawEvolve(t, ms) {
    const A = V.anim, e = (ms - A.start) / A.dur;
    const x = V.x * W, fy = feetY();
    cx.fillStyle = `rgba(10,8,25,${Math.min(.75, e * 3)})`; cx.fillRect(0, 0, W, H);
    const s0 = baseSize() * stageScale(A.from), s1 = baseSize() * stageScale(A.to);
    const cyc = fy - s1 * 1.2;
    cx.save(); cx.translate(x, cyc); cx.rotate(t * .4);
    for (let i = 0; i < 12; i++) {
      cx.rotate(Math.PI / 6);
      cx.fillStyle = `rgba(255,240,180,${.12 + .1 * Math.sin(t * 3 + i)})`;
      cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-20, -Math.max(W, H)); cx.lineTo(20, -Math.max(W, H)); cx.fill();
    }
    cx.restore();
    const halo = cx.createRadialGradient(x, cyc, 4, x, cyc, s1 * 2.4);
    halo.addColorStop(0, 'rgba(255,255,220,.8)'); halo.addColorStop(1, 'rgba(255,255,220,0)');
    cx.fillStyle = halo; cx.fillRect(0, 0, W, H);
    let id = A.from, sil = false, size = s0;
    if (e > .12 && e < .88) {
      const el = (ms - A.start) / 1000, f = 1.5 + e * 9;
      const showNew = Math.sin(el * f * Math.PI * 2) > 0;
      id = showNew ? A.to : A.from; size = showNew ? s1 : s0; sil = '#ffffff';
    } else if (e >= .88) { id = A.to; size = s1; }
    drawCreature(cx, id, { x, y: fy, size, t, maxH: H * .42, shiny: Game.pet().shiny, silhouette: sil, still: true });
    if (Math.random() < .4) addSparkles(x + (Math.random() - .5) * s1 * 3, fy - Math.random() * s1 * 3, 1);
    if (e > .85) { cx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - Math.abs(e - .9) * 12)})`; cx.fillRect(0, 0, W, H); }
    if (e >= 1) {
      V.anim = null;
      const to = SPECIES_BY_ID[A.to];
      toast(`{i:sparkle} ${SPECIES_BY_ID[A.from].name} evolved into ${to.name}!`, 4000);
      Talk.say('evolveDone', { vars: { to: to.name }, prio: 2 });
      addHearts(6); addSparkles(x, fy - s1, 20);
    }
  }

  function drawEnding(t, ms) {
    const A = V.anim, e = (ms - A.start) / A.dur, p = Game.pet();
    const fy = feetY(), size = petSize();
    let x = V.x * W, alpha = 1, lift = 0, flip = V.flip, mood = 'happy';
    if (A.type === 'farewell') {
      cx.fillStyle = `rgba(255,214,120,${Math.min(.35, e)})`; cx.fillRect(0, 0, W, H);
      if (Math.random() < .25) V.hearts.push({ x: x + (Math.random() - .5) * size * 3, y: fy - size, vy: 35 + Math.random() * 30, life: 2.5, age: 0 });
      if (e > .45) { alpha = Math.max(0, 1 - (e - .45) / .45); lift = (e - .45) * size * 3; }
    } else if (A.type === 'release') {
      if (e > .25) { x = V.x * W + (e - .25) * W * 1.1; flip = false; }
      if (Math.random() < .12) V.hearts.push({ x: x, y: fy - size * 2, vy: 30, life: 1.6, age: 0 });
    } else { // runaway
      mood = 'sad';
      cx.fillStyle = `rgba(20,25,45,${Math.min(.55, e * 2)})`; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(180,200,255,.55)'; cx.lineWidth = 1.5;
      for (let i = 0; i < 60; i++) {
        const rx = (rng(i) * W + t * 40) % W, ry = (rng(i + 300) * H + t * 500) % H;
        cx.beginPath(); cx.moveTo(rx, ry); cx.lineTo(rx - 4, ry + 14); cx.stroke();
      }
      if (e > .3) { x = V.x * W - (e - .3) * W * .9; flip = true; }
    }
    const hop = (A.type !== 'farewell' && e > .25) ? Math.abs(Math.sin(t * 8)) * size * .1 : 0;
    drawCreature(cx, p.sp, { x, y: fy - lift, size, t, maxH: H * .42, shiny: p.shiny, mood, flip, alpha, hop });
    const msg = { farewell: `Goodbye, ${petName()}… thank you!`, release: `${petName()} returns to the wild.`, runaway: `${petName()} felt alone and left…` }[A.type];
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = '800 17px system-ui';
    cx.globalAlpha = Math.min(1, e * 3); cx.fillText(msg, W / 2, H * .22); cx.globalAlpha = 1; cx.textAlign = 'left';
    if (e >= 1) {
      V.anim = null; V.x = .5;
      Game.finishEnding();
      const note = { farewell: 'A blessed egg appeared! {i:sparkle}', runaway: 'A plain egg appeared…', release: 'A new egg appeared.' }[A.type];
      toast(note, 3500);
      Talk.say('newEgg', { prio: 2 });
    }
  }

  function draw(t, ms) {
    const p = Game.pet();
    const phase = dayPhase();
    const biome = p ? ELEMENTS[SPECIES_BY_ID[p.sp].el].biome : 'meadow';
    const scene = p && p.egg ? 'meadow' : biome;
    V.bg = null;
    if (!drawCustomBg(scene, phase)) { drawSky(t, phase); drawBiome(scene, t, phase); }
    if (p && !p.egg) for (let i = 0; i < p.poops; i++) drawPoop(POOP_X[i] * W, feetY() - 2 + i * 4, t, i);
    if (V.anim && V.anim.type === 'evolve') drawEvolve(t, ms);
    else if (V.anim) drawEnding(t, ms);
    else { V.pals.slice().sort((a, b) => a.depth - b.depth).forEach(p => drawPal(p, t)); drawPet(t, ms); drawBath(t, ms); }
    drawFx();
  }

  // ======================= HUD =======================
  const els = {
    name: $('#petName'), lv: $('#petLevel'), cer: $('#cerBtns'), hint: $('#hint'),
    lightIcon: $('#lightIcon'), lightLbl: $('#lightLbl'), sub: $('#petSub'), avatar: $('#avatar'),
    bars: [...document.querySelectorAll('.bar')].map(b => ({ k: b.dataset.k, el: b, fill: b.querySelector('i'), val: b.querySelector('.bv') })),
  };
  let cerSig = '';
  let curUntil = 0;
  function hud() {
    const p = Game.pet(), S = ST();
    if (!p) { els.name.textContent = 'Pocket Pal'; els.name.dataset.sig = ''; els.sub.textContent = 'Choose a partner'; els.avatar.className = 'egg'; els.avatar.src = PX.url('egg_rare_0'); els.lv.textContent = ''; els.lv.classList.add('hidden'); return; }
    const nameSig = petName() + p.shiny + p.egg + p.sp;
    if (els.name.dataset.sig !== nameSig) {
      els.name.dataset.sig = nameSig;
      els.name.innerHTML = esc(petName()) + (p.shiny && !p.egg ? ic('sparkle') : '');
      const s = SPECIES_BY_ID[p.sp];
      els.sub.textContent = p.egg ? `${TIER_LABEL[s.tier || 'common']} egg` : `${p.name ? s.name + ' · ' : ''}${ELEMENTS[s.el].label}`;
      const face = !p.egg && portraitUrl(p.sp, p.shiny, 'Normal');
      els.avatar.className = face ? '' : 'egg';
      els.avatar.src = face || PX.url(`egg_${s.tier || 'common'}_0`);
    }
    els.lv.textContent = p.egg ? '' : 'Lv ' + Game.level();
    els.lv.classList.toggle('hidden', !!p.egg);
    if (p.egg) delete els.sub.dataset.lv; else els.sub.dataset.lv = 'Lv ' + Game.level();
    for (const b of els.bars) {
      const v = p.egg ? 0 : p[b.k];
      b.fill.style.width = v + '%';
      b.val.textContent = p.egg ? '–' : Math.round(v);
      b.el.classList.toggle('low', !p.egg && v <= 20);
      b.el.classList.toggle('mid', !p.egg && v > 20 && v <= 50);
    }
    const asleep = !p.egg && p.asleep;
    const li = PX.url(asleep ? 'wake' : 'sleep'); if (els.lightIcon.src !== li) els.lightIcon.src = li;
    els.lightLbl.textContent = asleep ? 'Wake' : 'Sleep';
    document.querySelectorAll('#actions button').forEach(b => {
      const a = b.dataset.act;
      const off = (p.egg && a !== 'dex' && a !== 'party') || (asleep && ['feed', 'play', 'train', 'explore'].includes(a));
      b.classList.toggle('off', off);
      if (b.classList.contains('cur') && performance.now() > curUntil && $('#scrim').classList.contains('hidden') && $('#arena').classList.contains('hidden')) b.classList.remove('cur');
    });
    els.hint.textContent = !S.player.starterPicked ? '' : p.egg ? 'Tap the egg 3× to hatch it' : '';
    // ceremony buttons
    const busy = !!V.anim;
    const sig = busy ? 'busy' : [Game.canEvolve(), Game.canFarewell(), Game.canRunaway()].join();
    if (sig !== cerSig) {
      cerSig = sig; els.cer.innerHTML = '';
      if (!busy) {
        if (Game.canEvolve()) { els.cer.append(mkBtn('{i:sparkle} Ready to evolve!', 'cb-evolve', askEvolve)); Talk.say('evolveReady', { prio: 2 }); }
        if (Game.canFarewell()) { els.cer.append(mkBtn('{i:heartGold} A full life — say goodbye?', 'cb-farewell', askFarewell)); Talk.say('farewellReady', { prio: 2 }); }
        if (Game.canRunaway()) { els.cer.append(mkBtn('{i:rain} It feels abandoned…', 'cb-runaway', askRunaway)); Talk.say('runawayReady', { prio: 2 }); }
      }
    }
  }
  function mkBtn(label, cls, fn) {
    const b = document.createElement('button'); b.className = cls; b.innerHTML = icons(esc(label));
    b.addEventListener('click', e => { e.stopPropagation(); fn(); }); return b;
  }

  // ======================= sheets & dialogs =======================
  const sheet = $('#sheet'), scrim = $('#scrim');
  let sheetLocked = false;
  function openSheet(html, { dialog = false, locked = false } = {}) {
    sheet.className = dialog ? 'dialog' : '';
    sheet.innerHTML = icons(html); sheet.scrollTop = 0;
    scrim.classList.remove('hidden'); sheetLocked = locked;
    paintMinis(sheet);
  }
  function closeSheet() {
    onlineOpen = false; gateOpen = false; sheet.className = 'hidden'; scrim.classList.add('hidden'); sheet.innerHTML = ''; sheetLocked = false; }
  scrim.addEventListener('click', () => { if (!sheetLocked) closeSheet(); });
  const head = title => `<div class="sh-head"><h2>${title}</h2><button class="x" data-close aria-label="Close">✕</button></div>`;
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });

  function dialog(title, text, buttons, opts = {}) {
    openSheet(`<h2 style="margin:0 0 6px">${title}</h2><p>${text}</p><div class="btns ${buttons.length === 2 ? 'two' : ''}">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div>`, { dialog: true, locked: opts.locked });
    sheet.querySelectorAll('[data-i]').forEach(el => el.addEventListener('click', () => { const b = buttons[+el.dataset.i]; closeSheet(); b.fn && b.fn(); }));
  }

  function miniCanvas(id, { px = 80, shiny = false, sil = false } = {}) {
    return `<canvas data-mini="${id}" data-px="${px}" ${shiny ? 'data-shiny="1"' : ''} ${sil ? 'data-sil="1"' : ''} width="${px * 2}" height="${px * 2}" style="width:${px}px;height:${px}px"></canvas>`;
  }
  function paintMinis(root) {
    root.querySelectorAll('canvas[data-mini]').forEach(c => {
      const paint = () => {
        if (!c.isConnected && c.dataset.painted) return;
        const px = +c.dataset.px, g = c.getContext('2d'), id = +c.dataset.mini;
        g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, px, px);
        drawCreature(g, id, { x: px / 2, y: px * .9, size: px * .3 * Math.min(1.05, stageScale(id)), maxH: px * .8, t: .3, shiny: !!c.dataset.shiny, silhouette: c.dataset.sil ? '#9da2b8' : false, still: true });
        c.dataset.painted = 1;
      };
      paint();
      whenSprite(+c.dataset.mini, !!c.dataset.shiny, 'Idle', paint); // repaint once its image has loaded
    });
  }
  // fix the dex-grid canvases to stretch
  const blockedMsg = { egg: 'Hatch the egg first!', asleep: 'Shh… it\'s sleeping. Wake it up first.', busy: 'Not right now.' };
  function guard(needAwake = true) {
    const p = Game.pet();
    if (!p || V.anim) return false;
    if (p.egg) { toast(blockedMsg.egg); Sound.play('no'); return false; }
    if (needAwake && p.asleep) { toast(blockedMsg.asleep); Sound.play('no'); return false; }
    return true;
  }

  // ---------- welcome: new players need an account before choosing a starter ----------
  let gateOpen = false, gatePhase = '';
  const needsGate = () => Online.state.enabled && !ST().player.starterPicked;
  function phaseOf(o) {
    if (!o.ready) return o.error ? 'error' : 'connecting';
    if (!o.user) return 'signin' + (o.error || '');
    if (o.needsUsername) return 'username';
    if (!o.profile || !o.cloudChecked) return 'loading';
    return 'done';
  }
  function openGate() {
    const o = Online.state, ph = phaseOf(o);
    gatePhase = ph;
    if (ph === 'done') {
      gateOpen = false;
      if (ST().player.starterPicked) { closeSheet(); V.loaded = null; V.x = .5; toast(`Welcome back, ${o.profile.username}! Your save was loaded.`, 4000); setTimeout(greet, 900); }
      else openStarter();
      return;
    }
    gateOpen = true;
    let body;
    if (ph === 'error') body = `<p class="note-bad">Couldn't connect: ${esc(o.error)}</p><p class="muted">Check your internet connection.</p><div class="btns"><button class="btn alt" id="onRetry">Try again</button></div>`;
    else if (ph === 'connecting') body = '<p class="muted">Connecting…</p>';
    else if (ph.startsWith('signin')) body = `<p>Create your trainer account to start your adventure. Your progress is saved to it, so you can play on any device and add friends to battle and trade with.</p>
        <div class="btns"><button class="btn google" id="onSignIn">{i:pokeball} Sign in with Google</button></div>
        ${o.error ? `<p class="note-bad">${esc(o.error)}</p>` : ''}`;
    else if (ph === 'username') body = `<p>Choose a <b>username</b>. It's how friends find you, and nobody else can have it.</p>
        <div class="searchrow"><input id="unIn" maxlength="16" placeholder="e.g. AshKetchum" autocapitalize="off" autocomplete="off"><button id="unGo">Create</button></div>
        <p class="muted" id="unMsg">3–16 letters, numbers or _. You'll also get a unique player ID.</p>`;
    else body = '<p class="muted">Loading your trainer save…</p>';
    openSheet(`<div class="gate"><img class="gate-egg" src="${PX.url('egg_common_0')}" alt=""><h2>Welcome to Pocket Pals!</h2>${body}</div>`, { dialog: true, locked: true });
    wireOnline();
  }
  Online.on(o => { if (gateOpen && phaseOf(o) !== gatePhase) openGate(); });
  const startNewGame = () => (needsGate() ? openGate() : openStarter());

  // ---------- home-screen widget (via the free Scriptable app on iPhone/iPad) ----------
  function widgetScript(token) {
    const project = (typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.projectId) || '';
    return `// Pocket Pals widget for the Scriptable app. Shows your partner Pokémon and how it's doing.
// Synced with your Pocket Pals account. Keep this script private: it contains your widget key.
const TOKEN = "${token}";
const PROJECT = "${project}";
const GAME = "https://clovekou.github.io/Pocket-Pals/";
// the widget itself is downloaded from the game, so updates arrive automatically
const fm = FileManager.local(), codeFile = fm.joinPath(fm.documentsDirectory(), "pocketpals-widget.js");
let code = null;
try { code = await new Request(GAME + "widget.js?t=" + Date.now()).loadString(); if (code.includes("POCKETPALS_WIDGET")) fm.writeString(codeFile, code); else code = null; } catch (e) {}
if (!code && fm.fileExists(codeFile)) code = fm.readString(codeFile);
if (!code) {
  const w = new ListWidget(); const t = w.addText("Pocket Pals: connect to the internet once to set up the widget."); t.font = Font.boldSystemFont(13);
  Script.setWidget(w); Script.complete();
} else {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction("TOKEN", "PROJECT", "GAME", code)(TOKEN, PROJECT, GAME);
}
`;
  }
  function openWidget() {
    const o = ON();
    if (!o.enabled || !o.profile) {
      openSheet(head('Home-screen widget') + `<p>The widget shows your partner Pokémon's portrait (its face changes with its mood) and its Food, Happy, Energy and Hygiene bars, synced with your account.</p>
        <p class="muted">Sign in first, so the widget knows which Pokémon is yours.</p><div class="btns"><button class="btn" id="wgSignIn">{i:friends} Sign in</button></div>`);
      $('#wgSignIn').addEventListener('click', () => openOnline());
      return;
    }
    const token = Game.widgetToken();
    Online.syncWidget(true).catch(e => toast("Couldn't update the widget: " + (e.message || e)));
    openSheet(head('Home-screen widget') + `<p>Put your Pokémon on your home screen: its portrait changes with its mood, and the bars show how it's doing. It's synced with your account and refreshes about every 15 minutes while the game is open on any device.</p>
      <h4 style="font-family:var(--pixel);margin:14px 0 6px">iPhone / iPad</h4>
      <ol class="muted" style="padding-left:20px;line-height:1.7;margin:0">
        <li>Install <b>Scriptable</b> (free) from the App Store.</li>
        <li>Tap <b>Copy widget script</b> below.</li>
        <li>Open Scriptable, tap <b>+</b>, paste, and name the script <b>Pocket Pals</b> (tap the title at the top). Tap <b>Done</b>.</li>
        <li>On your home screen, press and hold an empty spot → <b>Edit</b> → <b>Add Widget</b> → <b>Scriptable</b>. Pick small or medium and tap <b>Add Widget</b>.</li>
        <li>Press and hold the new widget → <b>Edit Widget</b> → set <b>Script</b> to <b>Pocket Pals</b>.</li>
      </ol>
      <div class="btns"><button class="btn gold" id="wgCopy">{i:card} Copy widget script</button></div>
      <h4 style="font-family:var(--pixel);margin:16px 0 6px">Mac desktop app</h4>
      <p class="muted" style="margin:0">Pocket Pals Dock lets your Pokémon walk around your Mac's desktop. When it asks for your key, paste this:</p>
      <div class="btns"><button class="btn alt" id="wgKey">{i:card} Copy key for Mac app</button></div>
      <p class="muted" style="margin-top:10px">Keep the script to yourself: it has your private widget key. Tapping the widget opens the game.</p>
      <p class="muted">Android: widgets need an installed app, so for now add the game to your home screen from Chrome's ⋮ menu → <b>Add to Home screen</b>.</p>`);
    $('#wgKey').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(token); toast('Key copied! Paste it into Pocket Pals Dock.', 3500); }
      catch (e) { const ta = document.createElement('textarea'); ta.value = token; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Key copied!'); }
    });
    $('#wgCopy').addEventListener('click', async () => {
      const s = widgetScript(token);
      try { await navigator.clipboard.writeText(s); toast('Widget script copied! Paste it into Scriptable.', 3500); }
      catch (e) { const ta = document.createElement('textarea'); ta.value = s; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Widget script copied!'); }
    });
  }

  // ---------- starter ----------
  function openStarter() {
    gateOpen = false;
    openSheet(`<h2 style="margin:0 0 4px">${STARTERS.length > 1 ? 'Choose your first partner' : 'Meet your partner'}</h2>
      <p class="muted">Raise it, evolve it, and fill your Dex with all ${SPECIES.length} creatures (shinies too!).</p>
      <div class="starters">${STARTERS.map(id => { const s = SPECIES_BY_ID[id]; return `<button data-st="${id}">${miniCanvas(id, { px: 96 })}${esc(s.name)}<small>${ELEMENTS[s.el].label}</small></button>`; }).join('')}</div>`, { dialog: true, locked: true });
    sheet.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
      Game.pickStarter(+b.dataset.st); closeSheet(); Sound.play('hatch');
      toast('Your egg is here! Tap it 3 times to hatch.', 3500);
      setTimeout(() => toast('{i:egg_legend_0} Bonus: a Mystery Egg is in your Bag → Items! Hatch your starter first, then use it.', 5500), 1800);
      setTimeout(() => toast('Tip: swipe ← → for the Dex, ↑ for its card, ↓ for settings.', 4500), 3800);
    }));
  }

  // ---------- feed ----------
  let bagTab = 'berries';
  function openFeed(tab) {
    if (tab) bagTab = tab;
    if (bagTab === 'items') return openItems();
    if (!guard()) return;
    const p = Game.pet(), s = Game.sp();
    const known = p.berryKnown;
    openSheet(head('Bag') + bagTabs() + `<div class="foods">
      ${FLAVORS.map((f, i) => `<button class="food" data-f="${i}">${ic(f.icon).replace('class="ic"', 'class="px"')}<span><b>${f.label}</b><small>${f.taste} · +25 food${known && s.fav === i ? ' · favourite!' : ''}</small></span>${known && s.fav === i ? '<span class="heart">{i:heart}</span>' : ''}</button>`).join('')}
      <button class="food" data-f="candy">${ic('poffin').replace('class="ic"', 'class="px"')}<span><b>Poffin</b><small>Treat · +12 happy, fattening</small></span></button>
      </div><p class="muted" style="margin-top:12px">${known ? `Its favourite is the ${FLAVORS[s.fav].label} (${FLAVORS[s.fav].taste.toLowerCase()}).` : 'Every Pokémon has a hidden favourite berry. Try them all!'}</p>`);
    wireBagTabs();
    sheet.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => {
      const f = b.dataset.f; closeSheet();
      const foodBefore = Game.pet().food;
      if (f === 'candy') {
        const r = Game.feedCandy(); if (r.error) return;
        startEat('#ff8fb3', 'poffin');
        toast(Game.pet().weight > 50 ? 'Yum! …but it\'s getting chubby (sluggish).' : 'Yum! +Happy');
        Talk.say(Game.pet().weight > 50 ? 'candyHeavy' : 'candy');
      } else {
        const r = Game.feedBerry(+f); if (r.error) return;
        startEat(FLAVORS[+f].color, FLAVORS[+f].icon);
        const berry = FLAVORS[+f].label;
        if (r.fav) { addHearts(6); toast(r.first ? `{i:heart} It LOVES ${berry}s! Favourite found.` : '{i:heart} Its favourite!'); Talk.say(r.first ? 'favFirst' : 'fav', { vars: { berry } }); }
        else { toast('+25 food'); Talk.say(foodBefore >= 90 ? 'berryFull' : 'berry'); }
      }
    }));
  }
  function startEat(color, icon) { V.eatUntil = now() + 2500; V.eatColor = color; V.eatIcon = icon; Sound.play('eat'); }

  // ---------- evolve / endings ----------
  function askEvolve() {
    if (!Game.canEvolve()) return;
    const s = Game.sp();
    const branch = s.next.length > 1 ? ' Its path will lean toward a form you haven\'t raised yet.' : '';
    dialog(`${petName()} is glowing…`, `It's ready to evolve!${branch}`, [
      { label: 'Keep form', cls: 'alt', fn: () => { Game.declineEvolve(); toast(`OK — it stays as ${s.name}. It'll ask again next level.`); Talk.say('evolveNo'); } },
      { label: '{i:sparkle} Evolve', cls: 'red', fn: () => {
        const r = Game.evolve(); if (!r) return;
        V.anim = { type: 'evolve', from: r.from, to: r.to, start: now(), dur: 5200 }; Sound.play('evolve');
      } },
    ]);
  }
  function askFarewell() {
    dialog('A full life together', `${petName()} has reached its final form and lived a full life. Saying goodbye <b>blesses your next egg</b> (better rarity and shiny odds).`, [
      { label: 'Stay together', cls: 'alt', fn: () => { Game.postponeFarewell(); toast('You stay together. It will ask again in a day.'); Talk.say('stay', { prio: 2 }); } },
      { label: '{i:heartGold} Say goodbye', cls: 'gold', fn: () => startEnd('farewell') },
    ]);
  }
  function askRunaway() {
    dialog('It feels abandoned…', `All of ${petName()}'s needs have been empty for an hour. One act of care will make it stay. If it leaves, your next egg will be <b>plain (common)</b>.`, [
      { label: 'Not yet', cls: 'alt' },
      { label: 'Let it go', cls: '', fn: () => startEnd('runaway') },
    ]);
  }
  function askRelease() {
    const p = Game.pet(); if (!p || p.egg || V.anim) return;
    dialog(`Release ${esc(petName())}?`, 'It will go back to the wild, and a new egg will appear. This can\'t be undone.', [
      { label: 'Cancel', cls: 'alt' },
      { label: 'Release', cls: 'red', fn: () => startEnd('release') },
    ]);
  }
  function startEnd(type) {
    if (!Game.startEnding(type)) return;
    V.anim = { type, start: now(), dur: 8000 };
    Sound.play(type === 'runaway' ? 'sad' : 'bye');
    Talk.clear(); Talk.say(type, { prio: 2 });
  }

  // ---------- party ----------
  function memberName(m) { return m.name || SPECIES_BY_ID[m.sp].name; }
  function askSwitch(i) {
    const m = Game.party()[i]; if (!m) return;
    const p = Game.pet();
    if (!p || p.egg) { toast('Hatch your egg first, then you can switch.'); return; }
    dialog(`Make ${esc(memberName(m))} your main?`, `${esc(memberName(m))} comes to the front and ${esc(petName())} goes to rest with the party.`, [
      { label: 'Not now', cls: 'alt' },
      { label: '{i:arrow} Make main', cls: 'red', fn: () => doSwitch(i) },
    ]);
  }
  function doSwitch(i) {
    if (!Game.switchMain(i)) return;
    V.x = .5; V.loaded = null; Talk.clear();
    Sound.play('wake'); addHearts(3);
    toast(`${petName()} is now your main!`);
    setTimeout(() => Talk.say('backHappy', { prio: 2 }), 400);
  }
  function openParty() {
    const p = Game.pet(), party = Game.party(), chk = Game.eggCheck();
    const needBar = m => {
      if (m.egg) return '';
      const v = Math.min(m.food, m.joy, m.ene, m.hyg), col = v > 50 ? 'var(--hp-hi)' : v > 20 ? 'var(--hp-mid)' : 'var(--hp-lo)';
      return `<div class="mini"><i style="width:${v}%;background:${col}"></i></div>`;
    };
    const slot = (m, i, isMain) => {
      const s = SPECIES_BY_ID[m.sp], lv = m.egg ? '' : ` · Lv ${Game.memberLevel(m)}`;
      const face = !m.egg && portraitUrl(m.sp, m.shiny, m.joy < 25 ? 'Sad' : 'Normal');
      const pic = m.egg ? `<img class="face" src="${PX.url(`egg_${s.tier || 'common'}_${Math.min(2, m.taps || 0)}`)}" alt="">` : face ? `<img class="face" src="${face}" alt="">` : miniCanvas(m.sp, { px: 56, shiny: m.shiny });
      return `<div class="pslot ${isMain ? 'main' : ''}">${pic}<div class="pi"><b>${m.egg ? 'Egg' : esc(memberName(m))}${m.shiny && !m.egg ? '{i:sparkle}' : ''}</b>
        <small>${m.egg ? 'Waiting to hatch' : `${ELEMENTS[s.el].label}${lv}${isMain ? '' : ' · resting'}`}</small>${needBar(m)}</div>
        <div class="acts">${isMain ? '<span class="tag">{i:arrow}Main</span>' : m.locked ? '<span class="tag">{i:lock}In a trade</span>' : `<button data-sw="${i}">Make main</button><button class="alt" data-tobox="${i}">To Box</button>`}</div></div>`;
    };
    const roomInParty = party.length + 1 < Game.PARTY_MAX;
    const boxSlot = (m, i) => {
      const s = SPECIES_BY_ID[m.sp], face = portraitUrl(m.sp, m.shiny, 'Normal');
      return `<div class="pslot">${face ? `<img class="face" src="${face}" alt="">` : miniCanvas(m.sp, { px: 56, shiny: m.shiny })}<div class="pi"><b>${esc(memberName(m))}${m.shiny ? '{i:sparkle}' : ''}</b>
        <small>${ELEMENTS[s.el].label} · Lv ${Game.memberLevel(m)} · in the PC</small></div>
        <div class="acts">${m.locked ? '<span class="tag">{i:lock}In a trade</span>' : `<button data-frombox="${i}" ${roomInParty ? '' : 'disabled'}>To party</button><button class="alt" data-relbox="${i}">Release</button>`}</div></div>`;
    };
    const empties = Math.max(0, Game.PARTY_MAX - 1 - party.length);
    openSheet(head('Party') + `<p class="muted" style="margin-top:0">Up to ${Game.PARTY_MAX} Pokémon. Your main is the one you care for; the others rest and play in the background (their needs pause while resting). Tap one on the home screen to switch.</p>
      <div class="partylist">${p ? slot(p, -1, true) : ''}${party.map((m, i) => slot(m, i, false)).join('')}${'<div class="pslot empty">Empty slot</div>'.repeat(empties)}</div>
      <div class="btns"><button class="btn ${chk.ok ? 'gold' : 'alt'}" id="takeEgg" ${chk.ok ? '' : 'disabled'}>{i:egg_rare_0} Get a new egg</button></div>
      ${Game.box().length ? `<h4 style="font-family:var(--pixel);margin:18px 0 8px">PC Box (${Game.box().length})</h4><div class="partylist">${Game.box().map((m, i) => boxSlot(m, i)).join('')}</div>` : ''}
      <p class="muted" style="text-align:center">${chk.ok ? 'Your main joins the party and the egg becomes your new main.' : esc(chk.why)}</p>`);
    sheet.querySelectorAll('[data-sw]').forEach(b => b.addEventListener('click', () => { closeSheet(); doSwitch(+b.dataset.sw); }));
    sheet.querySelectorAll('[data-tobox]').forEach(b => b.addEventListener('click', () => { Game.partyToBox(+b.dataset.tobox); openParty(); }));
    sheet.querySelectorAll('[data-frombox]').forEach(b => b.addEventListener('click', () => { if (Game.boxToParty(+b.dataset.frombox)) openParty(); else toast('Your party is full.'); }));
    sheet.querySelectorAll('[data-relbox]').forEach(b => b.addEventListener('click', () => {
      const m = Game.box()[+b.dataset.relbox];
      dialog(`Release ${esc(memberName(m))}?`, 'It goes back to the wild. This can\'t be undone.', [
        { label: 'Cancel', cls: 'alt', fn: () => openParty() },
        { label: 'Release', cls: 'red', fn: () => { Game.releaseBox(+b.dataset.relbox); openParty(); } },
      ]);
    }));
    sheet.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => {
      const m = party[+b.dataset.rel];
      dialog(`Release ${esc(memberName(m))}?`, 'It goes back to the wild and is remembered under Companions in the Pokédex. This can\'t be undone.', [
        { label: 'Cancel', cls: 'alt', fn: () => openParty() },
        { label: 'Release', cls: 'red', fn: () => { Game.releaseMember(+b.dataset.rel); toast(`${memberName(m)} was released. Bye!`); openParty(); } },
      ]);
    }));
    const te = $('#takeEgg');
    if (te) te.addEventListener('click', () => {
      if (!Game.takeEgg()) return;
      closeSheet(); V.x = .5; V.loaded = null; Talk.clear(); Sound.play('hatch');
      toast('A new egg! Tap it 3 times to hatch.', 3500);
      Talk.say('newEgg', { prio: 2 });
    });
  }

  // ---------- stat card ----------
  let cardTab = 'profile';
  function openCard(tab) {
    const p = Game.pet();
    if (!p || p.egg) { toast('Hatch the egg first!'); return; }
    if (tab) cardTab = tab;
    renderCard();
  }
  const weightLabel = w => w === 0 ? 'Fit' : w <= 25 ? 'Normal' : w <= 50 ? 'Chubby' : 'Heavy (sluggish)';
  function renderCard() {
    const p = Game.pet(), s = Game.sp(), S = ST(), el = ELEMENTS[s.el];
    const tabs = ['profile', 'battle', 'medals', 'progress'];
    const TAB_LABEL = { profile: 'Info', battle: 'Stats', medals: 'Badges', progress: 'Trainer' };
    let body = '';
    if (cardTab === 'profile') {
      const hearts = Math.round(p.bond / 20);
      body = `<div class="hero">${miniCanvas(p.sp, { px: 104, shiny: p.shiny })}<div>
          <h3>${esc(petName())} ${p.shiny ? '<span style="color:#e0a81f">{i:sparkle}</span>' : ''}</h3>
          <div class="muted">${s.name} · Lv ${Game.level()}</div>
          <span class="pill" style="background:${el.color}">${el.label}</span>
        </div></div>
        <div class="renamer"><input id="nameIn" maxlength="12" placeholder="Give it a nickname" value="${esc(p.name)}"><button id="nameSave">Save</button></div>
        <div class="rows" style="margin-top:8px">
          <div class="row"><span>Stage</span><b>${s.stage === 1 && !s.next.length ? 'Unique' : 'Stage ' + s.stage}${!s.next.length ? ' (final)' : ''}</b></div>
          <div class="row"><span>Age</span><b>${fmtDur(p.ageMin)}</b></div>
          <div class="row"><span>Weight</span><b>${weightLabel(p.weight)}</b></div>
          <div class="row"><span>Bond</span><b>${'{i:heart}'.repeat(hearts)}${'{i:heartEmpty}'.repeat(5 - hearts)} ${p.bond}%</b></div>
          <div class="row"><span>Favourite berry</span><b>${p.berryKnown ? FLAVORS[s.fav].label : '???'}</b></div>
          <div class="row"><span>Original Trainer</span><b>${p.ot ? `${esc(p.ot.name)}${p.ot.code ? ` (${esc(p.ot.code)})` : ''}` : '—'}</b></div>
          ${p.receivedFrom ? `<div class="row"><span>Received from</span><b>${esc(p.receivedFrom.name)} (trade)</b></div>` : ''}
          <div class="row"><span>Slip-ups</span><b>${p.mistakes}</b></div>
          <div class="row"><span>Genes</span><b>ATK ${p.genes.atk}% · DEF ${p.genes.def}% · SPD ${p.genes.spd}%</b></div>
        </div>`;
    } else if (cardTab === 'battle') {
      const row = (k, label, col, note) => { const v = Game.stat(k); return `<div class="stat"><div class="top"><span>${label}</span><span>${v}</span></div><div class="trk"><i style="width:${Math.min(100, v / 2.5)}%;background:${col}"></i></div><small>${note}</small></div>`; };
      const defLeft = 720 - p.goodTicks;
      body = row('atk', '{i:sword} Attack', '#e8503a', `Strength training ${p.tr.atk}/100 — from Rock Smash`) +
        row('def', '{i:shield} Defence', '#4f93c4', `Defence training ${p.tr.def}/100 — from Protect, and +1 per 12 h of good care`) +
        row('spd', '{i:speed} Speed', '#58b868', `Speed training ${p.tr.spd}/100 — from Poké Ball Catch`) +
        `<p class="muted">Stat = species base × genes + level + training.</p>
        <div class="rows"><div class="row"><span>Best Poké Ball Catch</span><b>${S.player.gameHi}</b></div><div class="row"><span>Best Protect</span><b>${S.player.defHi || 0}</b></div></div>
        <div class="btns"><button class="btn red" id="goTrain">{i:pokeball} Training games</button></div>`;
    } else if (cardTab === 'medals') {
      body = `<div class="medals">${MEDALS.map(m => `<div class="medal ${p.medals.includes(m.id) ? '' : 'off'}" title="${m.desc}">${ic(m.icon)}${m.label}</div>`).join('')}</div>
        <p class="muted" style="margin-top:12px">${p.medals.length}/8 for ${esc(petName())} · ${S.player.totalMedals} medals earned in total.</p>
        <div class="rows">${MEDALS.map(m => `<div class="row"><span>${ic(m.icon)} ${m.label}</span><b>${m.desc}</b></div>`).join('')}</div>`;
    } else {
      const need = Game.evoLevel();
      const fin = Game.farewellIn();
      const nextMs = [3, 7, 30, 100].find(x => x > S.player.streak);
      const end = S.player.lastEnd;
      body = `<div class="rows">
        <div class="row"><span>Dex</span><b>${Game.registeredCount()} / ${SPECIES.length}</b></div>
        <div class="row"><span>Shinies</span><b>${Game.shinyCount()} / ${SPECIES.length}</b></div>
        <div class="row"><span>Streak</span><b>{i:flame} ${S.player.streak} days (best ${S.player.bestStreak})</b></div>
        <div class="row"><span>Next milestone</span><b>${nextMs ? nextMs + ' days' : 'All reached!'}</b></div>
        <div class="row"><span>Evolution</span><b>${need == null ? 'Final form' : `At Lv ${need}${p.mistakes ? ` (${s.evo} + ${p.mistakes} slip-ups)` : ''}`}</b></div>
        ${need == null ? '' : '<div class="row"><span>Also needs</span><b>Awake, every need ≥ 40</b></div>'}
        <div class="row"><span>Farewell</span><b>${fin == null ? 'After its final form' : fin === 0 ? 'Ready' : 'In ' + fmtDur(fin)}</b></div>
        <div class="row"><span>Egg luck bonus</span><b>+${Game.careBonus()} (streak + bond)</b></div>
        <div class="row"><span>Next egg</span><b>${end === 'farewell' ? 'Blessed {i:sparkle}' : end === 'runaway' ? 'Plain (after a run-away)' : 'Normal'}</b></div>
        ${SPECIES.some(x => x.tier === 'legend') ? `<div class="row"><span>Legendaries</span><b>${Game.registeredCount() >= Game.LEGEND_UNLOCK ? 'Can appear!' : `Unlock at ${Game.LEGEND_UNLOCK} registered`}</b></div>` : ''}
      </div>`;
    }
    openSheet(head('Summary') + `<div class="tabs">${tabs.map(t => `<button data-tab="${t}" class="${t === cardTab ? 'on' : ''}">${TAB_LABEL[t]}</button>`).join('')}</div>` + body);
    sheet.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { cardTab = b.dataset.tab; renderCard(); }));
    const ns = $('#nameSave'); if (ns) ns.addEventListener('click', () => { Game.rename($('#nameIn').value); toast('Name saved!'); renderCard(); });
    const gt = $('#goTrain'); if (gt) gt.addEventListener('click', () => openGames());
  }

  // ---------- dex ----------
  let dexTab = 'dex', dexQuery = '', dexFilter = 'all', dexShown = 60;
  const DEX_PAGE = 60;
  function fillDexGrid() {
    const S = ST(), q = dexQuery.trim().toLowerCase();
    const list = SPECIES.filter(s => {
      const reg = Game.registered(s.id);
      if (dexFilter === 'reg' && !reg) return false;
      if (dexFilter === 'missing' && reg) return false;
      if (!q) return true;
      return String(s.id) === q.replace(/^#?0*/, '') || (reg && s.name.toLowerCase().includes(q));
    });
    const shown = list.slice(0, dexShown);
    $('#dexGrid').innerHTML = icons(shown.map(s => {
      const reg = Game.registered(s.id), sh = !!S.player.shiny[s.id];
      const face = reg && portraitUrl(s.id, false, 'Normal');
      const pic = !reg ? miniCanvas(s.id, { px: 72, sil: true }) : face ? `<img class="face" src="${face}" alt="" loading="lazy">` : miniCanvas(s.id, { px: 72 });
      return `<button class="dexcell" data-dex="${s.id}"><span class="no">${String(s.id).padStart(4, '0')}</span>${sh ? ic('sparkle').replace('class="ic"', 'class="ic st"') : ''}${pic}<small>${reg ? esc(s.name) : '???'}</small></button>`;
    }).join('') + (list.length > shown.length ? `<button class="dexmore" data-more>Show more (${list.length - shown.length} left)</button>` : '')
      + (list.length ? '' : '<p class="muted" style="grid-column:1/-1">Nothing matches.</p>'));
    paintMinis($('#dexGrid'));
  }
  function openDex(tab) { if (tab) dexTab = tab; renderDex(); }
  function renderDex() {
    const S = ST();
    let body = '';
    if (dexTab === 'dex') {
      body = `<p class="muted">${Game.registeredCount()}/${SPECIES.length} registered · ${Game.shinyCount()} shiny. Raise or evolve a Pokémon to register it.</p>
        <div class="dexbar"><input id="dexQ" type="search" placeholder="Search name or number" value="${esc(dexQuery)}">
        <select id="dexF"><option value="all">All</option><option value="reg">Registered</option><option value="missing">Missing</option></select></div>
        <div class="dexgrid" id="dexGrid"></div>`;
    } else {
      const H = S.player.history;
      const endLbl = { farewell: '{i:heartGold} Farewell', runaway: '{i:rain} Ran away', release: '{i:hand} Released' };
      body = H.length ? H.map(h => `<div class="hist">${miniCanvas(h.sp, { px: 56, shiny: h.shiny })}<div><b>${esc(h.name || SPECIES_BY_ID[h.sp].name)}</b> ${h.shiny ? '{i:sparkle}' : ''}<br><span class="muted">${SPECIES_BY_ID[h.sp].name} · Lv ${h.level} · ${fmtDur(h.ageMin)} · ${h.medals} medals<br>${endLbl[h.end] || ''} · ${new Date(h.date).toLocaleDateString()}</span></div></div>`).join('')
        : '<p class="muted">Your past companions will be remembered here.</p>';
    }
    openSheet(head('Pokédex') + `<div class="tabs"><button data-dt="dex" class="${dexTab === 'dex' ? 'on' : ''}">Pokédex</button><button data-dt="hist" class="${dexTab === 'hist' ? 'on' : ''}">Companions</button></div>` + body);
    sheet.querySelectorAll('[data-dt]').forEach(b => b.addEventListener('click', () => { dexTab = b.dataset.dt; renderDex(); }));
    if (dexTab === 'dex') {
      $('#dexF').value = dexFilter;
      $('#dexQ').addEventListener('input', e => { dexQuery = e.target.value; dexShown = DEX_PAGE; fillDexGrid(); });
      $('#dexF').addEventListener('change', e => { dexFilter = e.target.value; dexShown = DEX_PAGE; fillDexGrid(); });
      $('#dexGrid').addEventListener('click', e => {
        const more = e.target.closest('[data-more]');
        if (more) { dexShown += DEX_PAGE; fillDexGrid(); return; }
        const b = e.target.closest('[data-dex]'); if (!b) return;
        const id = +b.dataset.dex;
        if (!Game.registered(id)) { toast('Not registered yet — keep raising Pokémon!'); return; }
        renderDexDetail(id);
      });
      fillDexGrid();
    }
  }
  function renderDexDetail(id) {
    const S = ST(), s = SPECIES_BY_ID[id], el = ELEMENTS[s.el];
    const hasShiny = !!S.player.shiny[id];
    const line = [];
    let base = SPECIES_BY_ID[s.lineBase];
    const walk = sp => { line.push(sp); sp.next.forEach(n => walk(SPECIES_BY_ID[n])); };
    walk(base);
    openSheet(head(`#${String(id).padStart(2, '0')} ${s.name}`) + `
      <div class="pair"><figure>${miniCanvas(id, { px: 120 })}Normal</figure><figure>${miniCanvas(id, { px: 120, shiny: true, sil: !hasShiny })}${hasShiny ? 'Shiny {i:sparkle}' : 'Shiny ???'}</figure></div>
      <div class="rows">
        <div class="row"><span>Element</span><b><span class="pill" style="background:${el.color}">${el.label}</span></b></div>
        <div class="row"><span>Egg rarity</span><b>${TIER_LABEL[SPECIES_BY_ID[s.lineBase].tier]}</b></div>
        <div class="row"><span>Evolves</span><b>${s.next.length ? s.next.map(n => Game.registered(n) ? SPECIES_BY_ID[n].name : '???').join(' / ') + ` at Lv ${s.evo}` : 'Final form'}</b></div>
        <div class="row"><span>Favourite berry</span><b>${S.player.favKnown[id] ? FLAVORS[s.fav].label : '???'}</b></div>
        <div class="row"><span>Base ATK / DEF / SPD</span><b>${s.base.join(' / ')}</b></div>
        <div class="row"><span>Raised</span><b>${S.player.dex[id]}×${S.player.shiny[id] ? ` (${S.player.shiny[id]} shiny)` : ''}</b></div>
        <div class="row"><span>Line</span><b>${line.map(x => Game.registered(x.id) ? x.name : '???').join(' → ')}</b></div>
      </div>
      <div class="btns"><button class="btn alt" id="dexBack">← Back to Dex</button></div>`);
    $('#dexBack').addEventListener('click', () => { dexTab = 'dex'; renderDex(); });
  }

  // ---------- settings ----------
  function openSettings() {
    const S = ST();
    openSheet(head('Options') + `
      <label class="toggle"><span><b>Your name</b><small>What your Pokémon calls you</small></span><input id="setPlayer" maxlength="14" placeholder="partner" value="${esc(S.settings.player || '')}" style="width:140px;border:2px solid var(--line);border-radius:10px;padding:7px 9px;font:inherit;font-size:16px"></label>
      <label class="toggle"><span><b>Music</b><small>Cozy background tune</small></span><span class="sw"><input type="checkbox" id="setMusic" ${S.settings.music !== false ? 'checked' : ''}><i></i></span></label>
      <label class="toggle"><span><b>Music volume</b><small id="musicVolTxt">${S.settings.musicVol == null ? 60 : S.settings.musicVol}%</small></span><input type="range" id="setMusicVol" min="0" max="100" step="5" value="${S.settings.musicVol == null ? 60 : S.settings.musicVol}" style="width:150px;accent-color:#e3350d"></label>
      <label class="toggle"><span><b>Sound</b><small>Retro beeps</small></span><span class="sw"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}><i></i></span></label>
      <label class="toggle"><span><b>Fast time (testing)</b><small>1 second = 1 game minute. Normally 1 real minute = 1 game minute.</small></span><span class="sw"><input type="checkbox" id="setFast" ${S.settings.fast ? 'checked' : ''}><i></i></span></label>
      <div class="btns"><button class="btn alt" id="openOnline">{i:friends} Account &amp; friends</button><button class="btn alt" id="openWidget">{i:card} Home-screen widget</button><button class="btn alt" id="howTo">{i:book} How to play</button><button class="btn alt" id="openCard">{i:card} Stat card</button>${REMOTE_SPRITES ? '' : '<a class="btn alt" href="dashboard.html" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box">{i:wrench} Sprite dashboard</a>'}<button class="btn red" id="resetBtn">Reset game</button></div>
      <p class="muted" style="margin-top:12px">Progress is saved in this browser. Add it to your home screen to play it like an app.</p>`);
    $('#setSound').addEventListener('change', e => { S.settings.sound = e.target.checked; Game.save(); });
    $('#setMusic').addEventListener('change', e => { S.settings.music = e.target.checked; Game.save(); });
    $('#setMusicVol').addEventListener('input', e => { S.settings.musicVol = +e.target.value; $('#musicVolTxt').textContent = e.target.value + '%'; if (+e.target.value > 0 && S.settings.music === false) { S.settings.music = true; $('#setMusic').checked = true; } Game.save(); });
    $('#setPlayer').addEventListener('input', e => { S.settings.player = e.target.value.slice(0, 14); Game.save(); });
    $('#setFast').addEventListener('change', e => { Game.setFast(e.target.checked); toast(e.target.checked ? 'Fast time ON' : 'Fast time OFF'); });
    $('#howTo').addEventListener('click', openManual);
    $('#openOnline').addEventListener('click', () => openOnline());
    $('#openWidget').addEventListener('click', openWidget);
    $('#openCard').addEventListener('click', () => openCard());
    $('#resetBtn').addEventListener('click', () => dialog('Reset everything?', 'Your creature, Dex, streak and medals will be erased.', [
      { label: 'Cancel', cls: 'alt' },
      { label: 'Erase', cls: 'red', fn: () => { Game.reset(); V.anim = null; V.x = .5; startNewGame(); } },
    ]));
  }
  function openManual() {
    openSheet(head('How to play') + `<div class="manual">
      <h4>Time</h4><ul><li>1 real minute = 1 game minute. +1 level every hour.</li><li>It keeps living while the app is closed (up to 2 weeks of catch-up).</li></ul>
      <h4>Needs</h4><ul><li>FOOD −2/min, ENE −1/min, HYG −1/min (−4 more per poop), HAPPY −1/min (faster if hungry or dirty).</li><li>Letting a need drop to 10 or less is a <b>slip-up</b>: it delays evolution by 1 level and cools the bond.</li></ul>
      <h4>Care</h4><ul><li>{i:pecha}{i:aspear}{i:cheri} <b>Pecha, Aspear and Cheri Berries</b> +25 food. One is its hidden favourite (+35 food, +happy, bond).</li><li>{i:poffin} <b>Poffin</b> +food +happy but adds weight. Over 50 weight = sluggish.</li><li>{i:pokeball} <b>Poké Ball Catch</b> trains SPEED and burns weight. {i:rock} <b>Rock Smash</b> trains ATTACK. {i:shield} <b>Protect</b> trains DEFENCE.</li><li>{i:bath} <b>Bath</b> clears poops. {i:hand} <b>Tap</b> to pet it. {i:sleep} <b>Sleep</b> restores energy; needs drop much slower.</li></ul>
      <h4>Evolution</h4><ul><li>When it reaches its evolution level and every need is ≥ 40, a button appears — you choose to evolve or keep its form.</li></ul>
      <h4>Endings</h4><ul><li>{i:heartGold} <b>Farewell</b>: final form + 3 days. Blesses the next egg.</li><li>{i:rain} <b>Run-away</b>: all needs at 0 for 1 hour. One act of care cancels it. Curses the next egg.</li><li>{i:hand} <b>Release</b>: hold your finger on it for 3 seconds.</li></ul>
      <h4>Eggs</h4><ul><li>Eggs hatch into a first-stage Pokémon — Common, Rare or (after ${Game.LEGEND_UNLOCK} registered) Legendary — favouring ones you haven't raised yet.</li><li>Streak + bond improve the shiny odds (1/48 → best 1/8). A farewell doubles them for the next egg.</li></ul>
      <h4>Gestures</h4><ul><li>Swipe ← → Pokédex · ↑ Summary · ↓ Options · hold 3 s = release.</li></ul>
      </div>`);
  }

  // ======================= stage input =======================
  function hitPet(x, y) {
    const p = Game.pet(); if (!p) return false;
    const size = p.egg ? baseSize() * 1.1 : petSize();
    const px = p.egg ? W / 2 : V.x * W, fy = feetY();
    return Math.abs(x - px) < size * 1.3 && y > fy - size * 2.6 && y < fy + size * .3;
  }
  let pressTimer = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('#cerBtns button')) return;
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const onPet = hitPet(x, y);
    const p = Game.pet();
    V.press = { x, y, t0: now(), onPet: onPet && p && !p.egg && !V.anim, id: e.pointerId };
    if (V.press.onPet) pressTimer = setTimeout(() => { V.press = null; askRelease(); }, 3000);
  });
  stage.addEventListener('pointermove', e => {
    if (!V.press) return;
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (Math.hypot(x - V.press.x, y - V.press.y) > 14 && pressTimer) { clearTimeout(pressTimer); pressTimer = null; V.press.onPet = false; }
  });
  const endPress = e => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    const P = V.press; V.press = null;
    if (!P || V.anim || !ST().player.starterPicked) return;
    const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = x - P.x, dy = y - P.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 50) {
      if (Math.abs(dx) > Math.abs(dy)) openDex();
      else if (dy < 0) openCard();
      else openSettings();
      return;
    }
    if (now() - P.t0 > 700) return; // long-ish press that wasn't a release
    const palHit = !hitPet(x, y) && V.pals.find(p => p.hit && Math.abs(x - p.hit.x) < p.hit.w && y > p.hit.top - 10 && y < p.hit.fy + 8);
    if (palHit) { askSwitch(V.pals.indexOf(palHit)); return; }
    if (hitPet(x, y)) {
      const p = Game.pet();
      if (p.egg) {
        V.eggWobbleUntil = now() + 400; Sound.play('tap');
        const r2 = Game.eggTap();
        if (r2 !== 'hatched') Talk.say('eggTap'); // hatching itself is handled by the 'hatch' event
      } else if (p.asleep) { Talk.say('petAsleep'); }
      else {
        const sad = Game.lowest() < 25;
        const r3 = Game.caress();
        if (!r3.error) { addHearts(3); Sound.play('pet'); V.hopAt = now(); if (sad || Math.random() < .6) Talk.say(sad ? 'petSad' : 'pet'); }
      }
    } else {
      const p = Game.pet();
      if (p && !p.egg && p.poops) {
        for (let i = 0; i < p.poops; i++) if (Math.abs(x - POOP_X[i] * W) < 30 && Math.abs(y - feetY()) < 50) { toast('Eww! Give it a bath {i:bath}'); break; }
      }
    }
  };
  stage.addEventListener('pointerup', endPress);
  stage.addEventListener('pointercancel', () => { if (pressTimer) clearTimeout(pressTimer); pressTimer = null; V.press = null; });

  function onHatched() {
    const p = Game.pet(), s = Game.sp();
    Sound.play('hatch'); addSparkles(W / 2, feetY() - baseSize(), 24); addHearts(5);
    V.x = .5;
    toast(p.shiny ? `{i:sparkle} A SHINY ${s.name} hatched! {i:sparkle}` : `It hatched! Meet ${s.name}!`, 4000);
    Talk.clear(); Talk.say(p.shiny ? 'hatchShiny' : 'hatch', { prio: 2 });
  }

  // ======================= action bar =======================
  document.querySelectorAll('#actions button').forEach(b => b.addEventListener('click', () => {
    if (!ST().player.starterPicked) return;
    if (!b.classList.contains('off')) { document.querySelectorAll('#actions button.cur').forEach(x => x.classList.remove('cur')); b.classList.add('cur'); curUntil = performance.now() + 700; }
    const a = b.dataset.act;
    if (a === 'dex') return openDex();
    if (a === 'party') return openParty();
    if (V.anim) return;
    if (a === 'feed') return openFeed();
    if (a === 'play') return openGames();
    if (a === 'explore') return startExplore();
    if (a === 'bath') {
      if (!guard(false)) return;
      if (now() < V.bathUntil) return;
      V.bathUntil = now() + 2400; Sound.play('bath');
      const stinky = Game.pet().poops >= 2 || Game.pet().hyg < 30;
      setTimeout(() => { Game.clean(); if (!Game.pet().asleep) Talk.say(stinky ? 'bathStinky' : 'bath'); }, 1800);
      return;
    }
    if (a === 'light') {
      if (!guard(false)) return;
      const r = Game.toggleSleep(); if (r.error) return;
      Sound.play(r.asleep ? 'sleep' : 'wake');
      Talk.say(r.asleep ? 'sleep' : Game.pet().ene < 50 ? 'wakeTired' : 'wake');
    }
  }));
  $('#nameBtn').addEventListener('click', () => openCard());
  $('#settingsBtn').addEventListener('click', openSettings);

  // ======================= minigames =======================
  const arena = $('#arena'), acv = $('#arenaCanvas'), ac = acv.getContext('2d');
  let AW = 1, AH = 1, arenaGame = null;
  function openArena(title) {
    $('#arenaTitle').innerHTML = icons(esc(title)); arena.classList.remove('hidden');
    const r = acv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    AW = r.width; AH = r.height; acv.width = AW * d; acv.height = AH * d; ac.setTransform(d, 0, 0, d, 0, 0);
  }
  function closeArena() { arena.classList.add('hidden'); $('#arenaPanel').classList.add('hidden'); arenaGame = null; }
  $('#arenaClose').addEventListener('click', () => { if (arenaGame) arenaGame.finish(true); });
  const aPos = e => { const r = acv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  acv.addEventListener('pointerdown', e => arenaGame && arenaGame.down && arenaGame.down(aPos(e)));
  acv.addEventListener('pointermove', e => arenaGame && arenaGame.move && arenaGame.move(aPos(e)));

  function startCatch() {
    openArena('{i:pokeball} Poké Ball Catch');
    const p = Game.pet();
    const G = { score: 0, lives: 3, t0: now(), dur: 30000, items: [], px: .5, vx: 0, nextSpawn: 0, over: false, endAt: 0, pops: [] };
    const size = Math.min(AW, AH) * .09;
    G.move = pos => { G.px = Math.max(.06, Math.min(.94, pos.x / AW)); };
    G.down = G.move;
    G.finish = early => {
      if (G.over) { if (early) { closeArena(); } return; }
      G.over = true; G.endAt = now();
      const r = Game.playResult(G.score);
      G.result = r;
      if (early) { closeArena(); reportCatch(); }
    };
    const reportCatch = () => {
      const r = G.result || {};
      if (r.hearts) addHearts(5);
      toast(`{i:pokeball} Caught ${G.score} Poké Balls! SPD training +${r.spd || 0}${r.hi ? ' · New record!' : ''}`, 3500);
      Talk.say(G.score >= 8 ? 'playGood' : 'playBad');
    };
    let last = now(), dispX = .5;
    G.loop = () => {
      if (arenaGame !== G) return;
      const ms = now(), dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
      const left = Math.max(0, G.dur - (ms - G.t0));
      if (!G.over) {
        if (ms > G.nextSpawn) {
          G.items.push({ kind: Math.random() < .12 ? 'ultraball' : Math.random() < .3 ? 'greatball' : 'pokeball', x: .08 + Math.random() * .84, y: -.05, v: .22 + G.score * .012 + Math.random() * .12, rot: Math.random() * 6 });
          G.nextSpawn = ms + Math.max(380, 950 - G.score * 22);
        }
        const py = (AH - size * 1.3) / AH;
        for (const it of G.items) {
          it.y += it.v * dt; it.rot += dt * 3;
          if (!it.done && it.y > py - .02 && it.y < py + .05 && Math.abs(it.x - dispX) * AW < size * 1.2) {
            it.done = true; G.score++; Sound.play('catch'); G.pops.push({ x: it.x * AW, y: it.y * AH, age: 0 });
          } else if (!it.done && it.y > 1.03) { it.done = true; G.lives--; Sound.play('miss'); }
        }
        G.items = G.items.filter(i => !i.done);
        if (G.lives <= 0 || left <= 0) G.finish(false);
      } else if (ms - G.endAt > 1800) { closeArena(); reportCatch(); return; }
      const d = G.px - dispX; dispX += d * Math.min(1, dt * 14);
      // draw
      const g = ac.createLinearGradient(0, 0, 0, AH); g.addColorStop(0, '#1d1840'); g.addColorStop(1, '#4b3f8a');
      ac.fillStyle = g; ac.fillRect(0, 0, AW, AH);
      for (let i = 0; i < 30; i++) { ac.fillStyle = 'rgba(255,255,255,.5)'; ac.fillRect(rng(i) * AW, rng(i + 9) * AH, 2, 2); }
      ac.fillStyle = '#6a5fb0'; ac.fillRect(0, AH - size * .35, AW, size * .35);
      for (const it of G.items) PX.draw(ac, it.kind || 'pokeball', it.x * AW, it.y * AH, Math.max(32, Math.round(size * .9 / 16) * 16), { rot: Math.sin(it.rot) * .3 });
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = 1 - pp.age * 2; ac.fillStyle = '#fff'; ac.font = '800 18px system-ui'; ac.fillText('+1', pp.x - 8, pp.y - pp.age * 60); ac.globalAlpha = 1; return pp.age < .5; });
      drawCreature(ac, p.sp, { x: dispX * AW, y: AH - size * .35, size, t, maxH: AH * .25, shiny: p.shiny, flip: d < -.002, walking: Math.abs(d) > .01, dir: Math.abs(d) > .01 ? undefined : 'front' });
      $('#arenaInfo').innerHTML = icons(`{i:pokeball}${G.score} &nbsp;${'{i:heart}'.repeat(Math.max(0, G.lives))}${'{i:heartEmpty}'.repeat(3 - Math.max(0, G.lives))} &nbsp;${Math.ceil(left / 1000)}s`);
      if (G.over) {
        ac.fillStyle = 'rgba(0,0,0,.45)'; ac.fillRect(0, 0, AW, AH);
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '800 28px system-ui';
        ac.fillText(`${G.score} caught!`, AW / 2, AH * .42);
        ac.font = '700 16px system-ui'; ac.fillText(`Speed training +${(G.result && G.result.spd) || 0}`, AW / 2, AH * .42 + 30); ac.textAlign = 'left';
      } else if (ms - G.t0 < 1800) {
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '700 16px system-ui';
        ac.fillText('Drag to catch the falling Poké Balls!', AW / 2, AH * .35); ac.textAlign = 'left';
      }
      requestAnimationFrame(G.loop);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- training games menu ----------
  function openGames() {
    if (!guard()) return;
    const p = Game.pet();
    const card = (id, icon, title, stat, desc) => `<button class="food" data-game="${id}" style="grid-column:1/-1">${ic(icon).replace('class="ic"', 'class="px"')}<span><b>${title}</b><small>${stat} · ${desc}</small></span></button>`;
    openSheet(head('Training games') + `<div class="foods">
      ${card('catch', 'pokeball', 'Poké Ball Catch', '{i:speed} Builds SPEED', 'drag to catch the falling Poké Balls')}
      ${card('smash', 'rock', 'Rock Smash', '{i:sword} Builds ATTACK', 'tap the rocks before they sink back down')}
      ${card('protect', 'shield', 'Protect', '{i:shield} Builds DEFENCE', 'tap the incoming attacks before they hit')}
      </div><p class="muted" style="margin-top:12px">Training: ATK ${p.tr.atk}/100 · DEF ${p.tr.def}/100 · SPD ${p.tr.spd}/100. Each game uses some energy.</p>`);
    sheet.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => {
      if (Game.pet().ene < 15) { closeSheet(); Talk.say('tooTired'); Sound.play('no'); return; }
      closeSheet();
      ({ catch: startCatch, smash: startRockSmash, protect: startProtect })[b.dataset.game]();
    }));
  }

  // ---------- Rock Smash (ATTACK) ----------
  function startRockSmash() {
    if (!guard()) return;
    openArena('{i:rock} Rock Smash');
    const p = Game.pet();
    const G = { hits: 0, misses: 0, t0: now(), dur: 20000, rocks: [], next: 0, over: false, endAt: 0, pops: [], attackAt: -9 };
    const cols = 3, rows = 3;
    const slot = i => ({ x: AW * (.2 + (i % cols) * .3), y: AH * (.2 + Math.floor(i / cols) * .2) });
    G.down = pos => {
      if (G.over) return;
      const r = G.rocks.find(r => !r.smashed && Math.hypot(pos.x - r.x, pos.y - r.y) < 46);
      if (!r) return;
      r.smashed = true; r.smashAt = now(); G.hits++; G.attackAt = now(); Sound.play('hit');
      G.pops.push({ txt: '+1', x: r.x, y: r.y - 30, age: 0 });
    };
    G.finish = early => {
      if (G.over) { if (early) closeArena(); return; }
      G.over = true; G.endAt = now();
      G.result = Game.trainStrength(G.hits * 2);
      if (early) { closeArena(); report(); }
    };
    const report = () => {
      const r = G.result || {};
      if (r.hearts) addHearts(5);
      toast(`{i:rock} Smashed ${G.hits} rocks! ATK training +${r.atk || 0}${r.hi ? ' · New record!' : ''}`, 3500);
      Talk.say(G.hits >= 12 ? 'trainGood' : 'trainBad');
    };
    let last = now();
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
      const left = Math.max(0, G.dur - (ms - G.t0));
      if (!G.over && left <= 0) G.finish(false);
      if (G.over && ms - G.endAt > 1800) { closeArena(); report(); return; }
      if (!G.over && ms > G.next) {                          // pop up a rock in a free hole
        const used = new Set(G.rocks.filter(r => !r.gone).map(r => r.i));
        const free = [...Array(cols * rows).keys()].filter(i => !used.has(i));
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)], s0 = slot(i);
          const life = Math.max(650, 1400 - G.hits * 25);
          G.rocks.push({ i, x: s0.x, y: s0.y, born: ms, life, smashed: false });
        }
        G.next = ms + Math.max(320, 800 - G.hits * 18);
      }
      G.rocks.forEach(r => { if (!r.smashed && ms - r.born > r.life) { r.gone = true; } if (r.smashed && ms - r.smashAt > 400) r.gone = true; });
      G.rocks = G.rocks.filter(r => !r.gone || ms - r.born < 100);
      // draw: rocky ground with 9 holes
      const bgr = ac.createLinearGradient(0, 0, 0, AH); bgr.addColorStop(0, '#6b5640'); bgr.addColorStop(1, '#4a3b2c');
      ac.fillStyle = bgr; ac.fillRect(0, 0, AW, AH);
      for (let i = 0; i < 40; i++) { ac.fillStyle = 'rgba(0,0,0,.12)'; ac.fillRect(rng(i) * AW, rng(i + 70) * AH, 6, 4); }
      for (let i = 0; i < cols * rows; i++) { const s0 = slot(i); ac.fillStyle = '#2e241b'; ac.beginPath(); ac.ellipse(s0.x, s0.y + 18, 40, 13, 0, 0, Math.PI * 2); ac.fill(); }
      for (const r of G.rocks) {
        const age = ms - r.born, up = Math.min(1, age / 140), down = r.smashed ? 0 : Math.max(0, 1 - (r.life - age) / 160);
        if (r.smashed) { PX.draw(ac, 'rubble', r.x, r.y + 6, 64, { alpha: Math.max(0, 1 - (ms - r.smashAt) / 400) }); continue; }
        PX.draw(ac, 'rock', r.x, r.y + 18 - 26 * up * (1 - down), 64);
      }
      const size = Math.min(AW, AH) * .12, atk = (ms - G.attackAt) / 1000;
      drawCreature(ac, p.sp, { x: AW / 2, y: AH * .9, size, t, maxH: AH * .22, shiny: p.shiny, dir: 'front',
        anim: atk < animLength(p.sp, 'Attack') ? 'Attack' : undefined, animT: atk < animLength(p.sp, 'Attack') ? atk : undefined });
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = Math.max(0, 1 - pp.age * 1.8); ac.fillStyle = '#fff'; ac.font = '800 20px "Pixelify Sans", system-ui'; ac.fillText(pp.txt, pp.x - 10, pp.y - pp.age * 60); ac.globalAlpha = 1; return pp.age < .55; });
      $('#arenaInfo').innerHTML = icons(`{i:rock}${G.hits} &nbsp;{i:sword}+${Math.min(18, Math.floor(G.hits / 2))} &nbsp;${Math.ceil(left / 1000)}s`);
      ac.textAlign = 'center';
      if (G.over) { ac.fillStyle = 'rgba(0,0,0,.45)'; ac.fillRect(0, 0, AW, AH); ac.fillStyle = '#fff'; ac.font = '700 30px "Pixelify Sans", system-ui'; ac.fillText(`${G.hits} rocks smashed!`, AW / 2, AH * .45); ac.font = '700 17px "Pixelify Sans", system-ui'; ac.fillText(`Attack training +${(G.result && G.result.atk) || 0}`, AW / 2, AH * .45 + 30); }
      else if (ms - G.t0 < 2200) { ac.fillStyle = '#fff'; ac.font = '700 17px "Pixelify Sans", system-ui'; ac.fillText('Tap the rocks to smash them!', AW / 2, AH * .74); }
      ac.textAlign = 'left';
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- Protect (DEFENCE) ----------
  function startProtect() {
    if (!guard()) return;
    openArena('{i:shield} Protect');
    const p = Game.pet();
    const G = { blocks: 0, lives: 3, t0: now(), dur: 25000, orbs: [], next: 0, over: false, endAt: 0, pops: [], hitAt: -9, shieldAt: -9 };
    const center = () => ({ x: AW / 2, y: AH * .55 });
    G.down = pos => {
      if (G.over) return;
      let best = null, bd = 56;
      for (const o of G.orbs) { const d = Math.hypot(pos.x - o.x, pos.y - o.y); if (!o.dead && d < bd) { best = o; bd = d; } }
      if (!best) return;
      best.dead = true; best.blockAt = now(); G.blocks++; G.shieldAt = now(); Sound.play('catch');
      G.pops.push({ txt: 'Blocked!', x: best.x, y: best.y, age: 0 });
    };
    G.finish = early => {
      if (G.over) { if (early) closeArena(); return; }
      G.over = true; G.endAt = now();
      G.result = Game.trainDefense(G.blocks);
      if (early) { closeArena(); report(); }
    };
    const report = () => {
      const r = G.result || {};
      if (r.hearts) addHearts(5);
      toast(`{i:shield} Blocked ${G.blocks} attacks! DEF training +${r.def || 0}${r.hi ? ' · New record!' : ''}`, 3500);
      Talk.say(G.blocks >= 15 ? 'trainGood' : 'trainBad');
    };
    let last = now();
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
      const left = Math.max(0, G.dur - (ms - G.t0)), c = center();
      if (!G.over && (left <= 0 || G.lives <= 0)) G.finish(false);
      if (G.over && ms - G.endAt > 1800) { closeArena(); report(); return; }
      if (!G.over && ms > G.next) {                           // attacks fly in from the edges
        const a = Math.random() * Math.PI * 2, rr = Math.hypot(AW, AH) * .55;
        G.orbs.push({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr, speed: 90 + G.blocks * 6 + Math.random() * 40 });
        G.next = ms + Math.max(380, 1100 - G.blocks * 30);
      }
      for (const o of G.orbs) {
        if (o.dead) continue;
        const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
        if (d < 34) { o.dead = true; o.hit = true; G.lives--; G.hitAt = ms; Sound.play('miss'); continue; }
        o.x += dx / d * o.speed * dt; o.y += dy / d * o.speed * dt;
      }
      G.orbs = G.orbs.filter(o => !o.dead || (o.blockAt && ms - o.blockAt < 300));
      // draw: dark arena with a glowing ring
      const bgr = ac.createRadialGradient(c.x, c.y, 20, c.x, c.y, Math.max(AW, AH) * .7); bgr.addColorStop(0, '#3b3a78'); bgr.addColorStop(1, '#14122e');
      ac.fillStyle = bgr; ac.fillRect(0, 0, AW, AH);
      ac.strokeStyle = 'rgba(160,190,255,.25)'; ac.lineWidth = 3; ac.beginPath(); ac.arc(c.x, c.y, 60 + Math.sin(t * 3) * 3, 0, Math.PI * 2); ac.stroke();
      const size = Math.min(AW, AH) * .1, hurt = ms - G.hitAt < 400;
      drawCreature(ac, p.sp, { x: c.x, y: c.y + size * .8, size, t, maxH: AH * .18, shiny: p.shiny, dir: 'front', anim: hurt ? 'Hurt' : undefined, animT: hurt ? (ms - G.hitAt) / 1000 : undefined, alpha: hurt && Math.floor(ms / 80) % 2 ? .4 : 1 });
      if (ms - G.shieldAt < 250) PX.draw(ac, 'shield', c.x, c.y, 64, { alpha: 1 - (ms - G.shieldAt) / 250 });
      for (const o of G.orbs) {
        if (o.blockAt) PX.draw(ac, 'sparkle', o.x, o.y, 32, { alpha: 1 - (ms - o.blockAt) / 300 });
        else PX.draw(ac, 'orb', o.x, o.y, 40, { rot: t * 4 });
      }
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = Math.max(0, 1 - pp.age * 1.8); ac.fillStyle = '#bfe0ff'; ac.font = '800 16px "Pixelify Sans", system-ui'; ac.fillText(pp.txt, pp.x - 26, pp.y - 20 - pp.age * 50); ac.globalAlpha = 1; return pp.age < .55; });
      $('#arenaInfo').innerHTML = icons(`{i:shield}${G.blocks} &nbsp;${'{i:heart}'.repeat(Math.max(0, G.lives))}${'{i:heartEmpty}'.repeat(3 - Math.max(0, G.lives))} &nbsp;${Math.ceil(left / 1000)}s`);
      ac.textAlign = 'center';
      if (G.over) { ac.fillStyle = 'rgba(0,0,0,.45)'; ac.fillRect(0, 0, AW, AH); ac.fillStyle = '#fff'; ac.font = '700 30px "Pixelify Sans", system-ui'; ac.fillText(`${G.blocks} blocked!`, AW / 2, AH * .3); ac.font = '700 17px "Pixelify Sans", system-ui'; ac.fillText(`Defence training +${(G.result && G.result.def) || 0}`, AW / 2, AH * .3 + 30); }
      else if (ms - G.t0 < 2200) { ac.fillStyle = '#fff'; ac.font = '700 17px "Pixelify Sans", system-ui'; ac.fillText('Tap the attacks before they hit!', AW / 2, AH * .18); }
      ac.textAlign = 'left';
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- bag: items found while exploring ----------
  function bagTabs() {
    return `<div class="tabs"><button data-bag="berries" class="${bagTab === 'berries' ? 'on' : ''}">Berries</button><button data-bag="items" class="${bagTab === 'items' ? 'on' : ''}">Items</button></div>`;
  }
  function wireBagTabs() { sheet.querySelectorAll('[data-bag]').forEach(b => b.addEventListener('click', () => openFeed(b.dataset.bag))); }
  function fragmentsHtml() {
    const fr = ST().player.fragments || {}, ids = Object.keys(fr).filter(k => fr[k] > 0).map(Number);
    if (!ids.length) return '';
    const need = Game.FRAGMENTS_TO_SUMMON;
    return `<h4 style="font-family:var(--pixel);margin:16px 0 8px;display:flex;align-items:center;gap:6px">{i:fragment} Legendary fragments</h4>` + ids.map(id => {
      const n = fr[id], s = SPECIES_BY_ID[id], ready = n >= need;
      return `<div class="itemrow">${miniCanvas(id, { px: 40 })}<div class="ii"><b>${esc(s.name)}</b>
        <div class="mini" style="height:8px;border-radius:5px;background:#4a4e66;border:2px solid var(--line);overflow:hidden;margin-top:4px"><i style="display:block;height:100%;width:${Math.min(100, n / need * 100)}%;background:${ready ? 'var(--yellow)' : 'var(--blue)'}"></i></div></div>
        <span class="cnt">${Math.min(n, need)}/${need}</span>${ready ? `<button data-summon="${id}">Summon</button>` : ''}</div>`;
    }).join('');
  }
  function openItems() {
    const IT = Game.ITEMS, keys = Object.keys(IT);
    const have = keys.filter(k => Game.itemCount(k) > 0);
    openSheet(head('Bag') + bagTabs() + (have.length || Object.keys(ST().player.fragments || {}).length ? have.map(k => `<div class="itemrow">${ic(IT[k].icon).replace('class="ic"', 'class="px"')}
        <div class="ii"><b>${IT[k].name}</b><small>${IT[k].desc}</small></div><span class="cnt">×${Game.itemCount(k)}</span>
        ${IT[k].use ? `<button data-use="${k}">Use</button>` : ''}</div>`).join('')
      : '<p class="muted">No items yet. Go <b>Explore</b> to find treasure, Rare Candy and Mystery Eggs!</p>')
      + fragmentsHtml()
      + `<p class="muted" style="margin-top:12px">Deepest floor reached: B${ST().player.exploreBest || 0}F · Wild battles won: ${ST().player.wildWins || 0}</p>`);
    wireBagTabs();
    sheet.querySelectorAll('[data-summon]').forEach(b => b.addEventListener('click', () => {
      const id = +b.dataset.summon, nm = SPECIES_BY_ID[id].name;
      dialog(`Summon ${esc(nm)}?`, `Use ${Game.FRAGMENTS_TO_SUMMON} fragments to call ${esc(nm)}. It answers for sure and joins your party (or PC Box if the party is full).`, [
        { label: 'Not yet', cls: 'alt', fn: () => openFeed('items') },
        { label: '{i:fragment} Summon!', cls: 'gold', fn: () => {
          const where = Game.summonLegend(id); if (!where) return;
          Sound.play('evolve'); addSparkles(V.x * W, feetY() - petSize(), 30);
          toast(`{i:sparkle} ${nm} answered your call! It ${where === 'party' ? 'joined your party' : 'was sent to your PC Box'}.`, 5000);
        } },
      ]);
    }));
    sheet.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.use, r = Game.useItem(k);
      if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return; }
      closeSheet();
      if (k === 'oran') { startEat('#4a86e8', 'oran'); addHearts(4); toast('{i:oran} Every need +25!'); Talk.say('fav', { vars: { berry: 'Oran Berry' } }); }
      if (k === 'rareCandy') { startEat('#4a7fe0', 'rareCandy'); addSparkles(V.x * W, feetY() - petSize(), 18); toast(`{i:rareCandy} ${petName()} grew to Lv ${Game.level()}!`); }
      if (r.egg) { V.x = .5; V.loaded = null; Talk.clear(); Sound.play('hatch'); toast('{i:egg_legend_0} The Mystery Egg is your new main — tap it 3 times!', 4000); Talk.say('newEgg', { prio: 2 }); }
    }));
  }

  // ---------- explore (Mystery-Dungeon style) ----------
  const panel = $('#arenaPanel'), epMsg = $('#epMsg'), epBtns = $('#epBtns');
  // ---------- pixel-art crystal caves (painted once at low resolution, scaled up crisp) ----------
  const DUNGEONS = [
    { name: 'Crystal Cavern', sky: ['#120e2a', '#241c4e'], rock: ['#2c2550', '#3b3268', '#4c4282', '#5d539a'], floor: ['#4a4170', '#574d80', '#3d355f'],
      crys: ['#7af0ff', '#38c6e8', '#1e7fb5', '#d9fbff'], crys2: ['#d58cff', '#a656e0', '#6c2aa8', '#f3dcff'], glow: 'rgba(120,230,255,' },
    { name: 'Emerald Grotto', sky: ['#0b1a17', '#13302a'], rock: ['#1f3a33', '#2b4d43', '#386055', '#4a7568'], floor: ['#3b5a4c', '#466858', '#2f4a3f'],
      crys: ['#8dffb0', '#3fdc7a', '#1f9a52', '#e2ffe9'], crys2: ['#b8f05a', '#7cc22f', '#4a8418', '#efffcf'], glow: 'rgba(120,255,170,' },
    { name: 'Ember Hollow', sky: ['#1c0d0a', '#3a1a12'], rock: ['#3b2420', '#51302a', '#6a3e35', '#835043'], floor: ['#5e3b30', '#6e473a', '#4a2e26'],
      crys: ['#ffc26a', '#ff8a2d', '#c4561a', '#fff0c8'], crys2: ['#ff7a9c', '#e0456c', '#a52449', '#ffd6e2'], glow: 'rgba(255,170,90,' },
  ];
  const PXS = 4; // screen pixels per art pixel
  function prand(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }
  function makeCave(D, w, h, seed) {
    const W2 = Math.ceil(w / PXS) * 2, H2 = Math.ceil(h / PXS);   // two screens wide, tiles seamlessly
    const c = document.createElement('canvas'); c.width = W2; c.height = H2;
    const g = c.getContext('2d'), R = prand(seed * 9973 + 7);
    const px = (x, y, col) => { g.fillStyle = col; g.fillRect(((x % W2) + W2) % W2, y, 1, 1); };
    // cave air
    const grd = g.createLinearGradient(0, 0, 0, H2); grd.addColorStop(0, D.sky[0]); grd.addColorStop(1, D.sky[1]);
    g.fillStyle = grd; g.fillRect(0, 0, W2, H2);
    const floorY = Math.round(H2 * .66);
    // far wall: noisy rock blocks
    for (let y = 0; y < floorY; y++) for (let x = 0; x < W2; x++) {
      const n = Math.sin(x * .21 + seed) * Math.cos(y * .17 + seed * .3) + Math.sin((x + y) * .07) * .6 + (R() - .5) * .5;
      if (n > .55) px(x, y, D.rock[0]); else if (n > .15 && y > H2 * .08) px(x, y, D.rock[1] + '');
    }
    // mid rock pillars with lit edges
    for (let i = 0; i < 7; i++) {
      const cx = Math.round((i + .5) / 7 * W2 + (R() - .5) * 10), wdt = 6 + Math.round(R() * 8);
      for (let y = Math.round(H2 * .12 + R() * 10); y < floorY; y++) {
        const ww = wdt + Math.round(Math.sin(y * .3 + i) * 2);
        for (let x = -ww; x <= ww; x++) px(cx + x, y, x === -ww ? D.rock[3] : x < -ww + 2 ? D.rock[2] : x > ww - 1 ? D.rock[0] : D.rock[1]);
      }
    }
    // ceiling + stalactites
    for (let x = 0; x < W2; x++) { const d = 3 + Math.round(Math.sin(x * .3) * 1.5 + R() * 2); for (let y = 0; y < d; y++) px(x, y, y === d - 1 ? D.rock[2] : D.rock[1]); }
    for (let i = 0; i < 16; i++) {
      const x0 = Math.round(R() * W2), len = 5 + Math.round(R() * 12), wd = 2 + Math.round(R() * 2);
      for (let y = 0; y < len; y++) { const ww = Math.max(0, Math.round(wd * (1 - y / len))); for (let x = -ww; x <= ww; x++) px(x0 + x, y + 3, x === -ww ? D.rock[3] : D.rock[2]); }
    }
    // floor: stone band with lit top edge, pebbles and cracks
    for (let y = floorY; y < H2; y++) for (let x = 0; x < W2; x++) {
      const n = (R() - .5) * .4 + Math.sin(x * .5 + y * .9) * .2;
      px(x, y, y === floorY ? D.rock[3] : y < floorY + 2 ? D.floor[1] : n > .25 ? D.floor[1] : n < -.25 ? D.floor[2] : D.floor[0]);
    }
    for (let i = 0; i < 60; i++) {
      const x = Math.round(R() * W2), y = floorY + 3 + Math.round(R() * (H2 - floorY - 4));
      px(x, y, D.rock[3]); px(x + 1, y, D.rock[2]); px(x, y + 1, D.floor[2]);
    }
    // crystal clusters (on the walls, by the pillars, and a few on the floor)
    const crystal = (x0, y0, hgt, pal) => {
      const wd = Math.max(1, Math.round(hgt / 3.2));
      for (let y = 0; y < hgt; y++) {
        const ww = y < wd ? y : wd; // pointed tip
        for (let x = -ww; x <= ww; x++) px(x0 + x, y0 - hgt + y, y === 0 ? pal[3] : x === -ww ? pal[3] : x < 0 ? pal[0] : x === 0 ? pal[1] : pal[2]);
      }
    };
    const clusters = [];
    for (let i = 0; i < 9; i++) {
      const onFloor = i % 3 === 0, x0 = Math.round(R() * W2), y0 = onFloor ? floorY + 2 + Math.round(R() * 3) : Math.round(H2 * .3 + R() * (floorY - H2 * .3));
      const pal = R() < .6 ? D.crys : D.crys2, big = (onFloor ? 6 : 8) + Math.round(R() * 8);
      crystal(x0, y0, big, pal); crystal(x0 - 3, y0, Math.round(big * .6), pal); crystal(x0 + 4, y0, Math.round(big * .7), pal);
      clusters.push({ x: x0, y: y0 - big / 2, pal });
    }
    return { canvas: c, clusters, floorY, W2, H2 };
  }
  // an uploaded "Explore & battles" picture replaces the built-in cave
  let exploreImg = null;
  function drawExploreBg(G, ms) {
    const file = typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.assign && BACKGROUNDS.assign.explore;
    if (!file) return false;
    if (!exploreImg || exploreImg._file !== file) { exploreImg = new Image(); exploreImg._file = file; exploreImg.src = 'backgrounds/' + encodeURIComponent(file); }
    if (!exploreImg.complete || !exploreImg.naturalWidth) return false;
    ac.imageSmoothingEnabled = false;
    const iw = exploreImg.naturalWidth, ih = exploreImg.naturalHeight;
    if (iw / ih > 1.3) {
      // wide panorama: fill the height and slide sideways in step with the walk.
      // Copies alternate normal / mirrored, so the scroll never shows a seam.
      const s2 = AH / ih, w = iw * s2;
      const last = G.panAt || ms; G.panAt = ms;
      if (G.state === 'walk') {
        const p = Game.pet(), walk = p && spriteAnim(p.sp, p.shiny, 'Walk');
        const cycle = walk ? walk.dur.reduce((x, y) => x + y, 0) / 60 : .6;   // seconds per step cycle
        const scale = Math.min(AW, AH) * .11 / 10;                              // sprite pixels -> screen pixels
        const speed = (16 * scale) / Math.max(.25, cycle);                      // one stride per walk cycle
        G.pan = (G.pan || 0) + speed * Math.min(.05, (ms - last) / 1000);
      }
      const off = ((G.pan || 0) % (w * 2) + w * 2) % (w * 2);
      for (let k = -1; k <= Math.ceil(AW / w) + 1; k++) {
        const x = Math.floor(k * w - off), flip = ((k % 2) + 2) % 2 === 1;
        if (x > AW || x + w < 0) continue;
        if (flip) { ac.save(); ac.translate(x + w, 0); ac.scale(-1, 1); ac.drawImage(exploreImg, 0, 0, w + 1, AH); ac.restore(); }
        else ac.drawImage(exploreImg, x, 0, w + 1, AH);
      }
    } else {
      // tall picture: walking deeper slowly zooms in; each new floor starts a fresh walk
      const walkK = G.state === 'walk' ? Math.min(1, (ms - G.at) / 1700) : 1;
      const zoom = 1.04 + .06 * walkK + Math.sin(ms / 2400) * .006;
      const s = Math.max(AW / iw, AH / ih) * zoom;
      const w = iw * s, h = ih * s;
      ac.drawImage(exploreImg, (AW - w) / 2 + Math.sin(ms / 3100) * 6, AH - h + (h - AH) * .25, w, h);
    }
    const v = ac.createRadialGradient(AW / 2, AH * .55, AH * .3, AW / 2, AH * .55, AH * .85);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(5,8,25,.35)');
    ac.fillStyle = v; ac.fillRect(0, 0, AW, AH);
    return true;
  }
  function drawCave(G, ms, walking) {
    if (drawExploreBg(G, ms)) return;
    if (!G.cave || G.cave.w !== AW || G.cave.h !== AH) G.cave = Object.assign(makeCave(G.D, AW, AH, G.seedInt), { w: AW, h: AH });
    const cv = G.cave, scroll = G.scroll || 0;
    const off = Math.round(scroll / PXS) % cv.W2;
    ac.imageSmoothingEnabled = false;
    for (let k = -1; k <= 1; k++) ac.drawImage(cv.canvas, 0, 0, cv.W2, cv.H2, (k * cv.W2 - off) * PXS, 0, cv.W2 * PXS, cv.H2 * PXS);
    // soft crystal glow + twinkles (drawn at full resolution on top)
    for (const cl of cv.clusters) for (let k = -1; k <= 1; k++) {
      const x = (cl.x + k * cv.W2 - off) * PXS, y = cl.y * PXS;
      if (x < -80 || x > AW + 80) continue;
      const a = .18 + Math.sin(ms / 600 + cl.x) * .06;
      const gr = ac.createRadialGradient(x, y, 2, x, y, 70); gr.addColorStop(0, G.D.glow + a + ')'); gr.addColorStop(1, G.D.glow + '0)');
      ac.fillStyle = gr; ac.fillRect(x - 70, y - 70, 140, 140);
      if (Math.sin(ms / 300 + cl.x * 3) > .92) PX.draw(ac, 'sparkle', x + Math.sin(cl.x) * 10, y - 8, 16);
    }
  }
  function say(html, sub) { epMsg.innerHTML = icons(html) + (sub ? `<small>${icons(sub)}</small>` : ''); }
  function buttons(list, wrap) {
    epBtns.classList.toggle('wrap', !!wrap);
    epBtns.innerHTML = list.map((b, i) => `<button class="btn ${b.cls || ''}" data-b="${i}">${icons(b.label)}</button>`).join('');
    epBtns.querySelectorAll('[data-b]').forEach(el => el.addEventListener('click', () => { const b = list[+el.dataset.b]; epBtns.innerHTML = ''; b.fn(); }));
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function hpBox(g, x, y, w, name, lv, hp, max, showNums) {
    const h = showNums ? 58 : 46;
    roundRect(g, x, y, w, h, 10); g.fillStyle = '#fbf9ef'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#2f3448'; g.stroke();
    g.fillStyle = '#2b2d42'; g.font = '700 16px "Pixelify Sans", system-ui'; g.textAlign = 'left';
    g.fillText(name, x + 10, y + 20); g.textAlign = 'right'; g.font = '700 14px "Pixelify Sans", system-ui'; g.fillText('Lv' + lv, x + w - 10, y + 20); g.textAlign = 'left';
    const bx = x + 34, by = y + 28, bw = w - 44, k = Math.max(0, hp / max);
    g.fillStyle = '#2f3448'; roundRect(g, x + 8, by - 1, 24, 12, 4); g.fill();
    g.fillStyle = '#ffcb05'; g.font = '700 10px "Pixelify Sans", system-ui'; g.fillText('HP', x + 12, by + 9);
    roundRect(g, bx, by, bw, 10, 5); g.fillStyle = '#4a4e66'; g.fill(); g.strokeStyle = '#2f3448'; g.lineWidth = 2; g.stroke();
    if (k > 0) { roundRect(g, bx + 2, by + 2, (bw - 4) * k, 6, 3); g.fillStyle = k > .5 ? '#48d048' : k > .2 ? '#f8c030' : '#f85838'; g.fill(); }
    if (showNums) { g.fillStyle = '#2b2d42'; g.font = '700 13px "Pixelify Sans", system-ui'; g.textAlign = 'right'; g.fillText(`${Math.max(0, Math.ceil(hp))}/${max}`, x + w - 10, y + 52); g.textAlign = 'left'; }
  }

  function startExplore() {
    const chk = Game.exploreCheck();
    if (!chk.ok) { toast(chk.why); Sound.play('no'); if (/tired/.test(chk.why)) Talk.say('tooTired'); return; }
    const p = Game.pet();
    panel.classList.remove('hidden');
    const D = DUNGEONS[Math.floor(Math.random() * DUNGEONS.length)];
    const caveName = typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.assign && BACKGROUNDS.assign.explore ? 'Crystal Cave' : D.name;
    openArena(`{i:map} ${caveName}`);
    const me = Game.battler(p.sp, Game.level(), true);
    const G = {
      D, caveName, floor: 0, state: 'walk', at: now(), me, meHp: me.maxHp, wins: 0, finds: {}, wild: null, wildHp: 0,
      act: null, actAt: 0, hurt: null, hurtAt: 0, chest: null, over: false, seedInt: 1 + Math.floor(Math.random() * 100000), scroll: 0,
    };
    preloadSpecies(p.sp, p.shiny);
    Sound.play('wake'); Talk.say('exploreGo');
    const name = () => petName();
    const info = () => { $('#arenaInfo').innerHTML = icons(`B${G.floor}F &nbsp;{i:energy}${Math.round(Game.pet().ene)}`); };

    function nextFloor() {
      G.floor++; G.state = 'walk'; G.at = now(); G.wild = null; G.chest = null;
      G.meHp = Math.min(G.me.maxHp, G.meHp + Math.round(G.me.maxHp * .15));  // catches its breath between floors
      G.tired = !Game.exploreStep();
      info(); say(`B${G.floor}F — ${esc(name())} explores…`); buttons([]);
      setTimeout(() => { if (arenaGame === G) resolveFloor(); }, 1700);
    }
    function resolveFloor() {
      const ev = Game.rollFloor(G.floor);
      if (ev === 'wild') return encounter();
      if (ev === 'legend') return encounter(Game.rollLegend());
      if (ev === 'treasure') {
        G.state = 'chest'; G.chest = { open: false, item: null }; G.at = now();
        say('A treasure chest!'); Sound.play('tap');
        setTimeout(() => {
          if (arenaGame !== G) return;
          const k = Game.rollTreasure(G.floor); Game.addItem(k); G.finds[k] = (G.finds[k] || 0) + 1;
          G.chest = { open: true, item: k }; G.at = now(); Sound.play('medal');
          say(`Found ${/^[AEIOU]/.test(Game.ITEMS[k].name) ? 'an' : 'a'} {i:${Game.ITEMS[k].icon}} <b>${Game.ITEMS[k].name}</b>!`, Game.ITEMS[k].desc);
          afterFloor();
        }, 900);
        return;
      }
      if (ev === 'egg') {
        Game.addItem('mysteryEgg'); G.finds.mysteryEgg = (G.finds.mysteryEgg || 0) + 1;
        G.state = 'egg'; G.at = now(); Sound.play('hatch');
        say('Something was hidden in the grass… a {i:egg_legend_0} <b>Mystery Egg</b>!', 'Find it in your Bag → Items. It hatches into a random Pokémon.');
        return afterFloor();
      }
      G.state = 'empty';
      say(['Nothing here but dust…', 'Just some rustling leaves.', 'A quiet, empty floor.', 'It sniffs around… nothing.'][Math.floor(Math.random() * 4)]);
      afterFloor();
    }
    function encounter(preset) {
      const w = preset || Game.rollWild(), ws = SPECIES_BY_ID[w.sp];
      G.wild = Object.assign(Game.battler(w.sp, w.level, false), { shiny: w.shiny, name: ws.name, legend: !!w.legend, raw: w });
      if (w.legend) G.wild.maxHp = Math.round(G.wild.maxHp * 1.2);   // legendaries are a little tougher
      G.wildHp = G.wild.maxHp; G.state = 'encounter'; G.at = now(); G.legendAt = w.legend ? now() : 0; G.throw = null; G.wheel = null;
      preloadSpecies(w.sp, w.shiny); Sound.play(w.legend ? 'evolve' : 'sad');
      const frag = Game.state.player.fragments[w.sp] || 0;
      if (w.legend) say(`{i:sparkle} A <b>legendary</b> Pokémon appeared! It's ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level})!`,
        `Win the battle to spin the catch wheel.${frag ? ` You have ${frag}/${Game.FRAGMENTS_TO_SUMMON} of its fragments.` : ''}`);
      else say(`A wild ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level}) appeared!`, `${ELEMENTS[ws.el].label} type · ${esc(name())} is Lv ${G.me.level}`);
      buttons([
        { label: '{i:sword} Fight', cls: 'red', fn: () => fight(false) },
        { label: '{i:speed} Run', cls: 'alt', fn: run },
      ]);
    }
    function run() {
      if (Math.random() < .8) { say('Got away safely!'); Sound.play('wake'); G.wild = null; G.state = 'empty'; return afterFloor(); }
      say(`Couldn't get away! The wild ${esc(G.wild.name)} attacks!`); fight(true);
    }
    function fight(wildFirst) {
      G.state = 'battle'; buttons([]);
      let turn = wildFirst ? 'wild' : (G.me.spd >= G.wild.spd ? 'me' : 'wild');
      const step = () => {
        if (arenaGame !== G) return;
        const A = turn === 'me' ? G.me : G.wild, Dd = turn === 'me' ? G.wild : G.me;
        const crit = Math.random() < .07;
        const dmg = Math.max(2, Math.round((A.atk / Math.max(1, Dd.def)) * (A.level * .45 + 6) * (.85 + Math.random() * .3) * (crit ? 1.5 : 1)));
        G.act = turn; G.actAt = now(); Sound.play('hit');
        const an = turn === 'me' ? esc(name()) : `The wild ${esc(G.wild.name)}`;
        setTimeout(() => {
          if (arenaGame !== G) return;
          if (turn === 'me') G.wildHp -= dmg; else G.meHp -= dmg;
          G.hurt = turn === 'me' ? 'wild' : 'me'; G.hurtAt = now();
          say(`${an} attacks!${crit ? ' A critical hit!' : ''}`, `${dmg} damage`);
          if (G.wildHp <= 0) return setTimeout(win, 700);
          if (G.meHp <= 0) return setTimeout(lose, 700);
          turn = turn === 'me' ? 'wild' : 'me';
          setTimeout(step, 750);
        }, 380);
      };
      setTimeout(step, 600);
    }
    function win() {
      if (G.wild.legend) { G.wins++; return startWheel(); }
      G.wins++; G.state = 'won'; G.at = now(); Sound.play('level');
      let sub = `${esc(name())} feels proud!`;
      if (Math.random() < .35) { const k = Game.rollTreasure(G.floor); Game.addItem(k); G.finds[k] = (G.finds[k] || 0) + 1; sub = `It dropped ${/^[AEIOU]/.test(Game.ITEMS[k].name) ? 'an' : 'a'} {i:${Game.ITEMS[k].icon}} ${Game.ITEMS[k].name}!`; }
      say(`The wild ${esc(G.wild.name)} fainted! ${esc(name())} won!`, sub);
      afterFloor();
    }
    function lose() {
      G.state = 'lost'; G.at = now(); Sound.play('sad');
      say(`${esc(name())} is out of strength…`, 'It heads back home to rest.');
      buttons([{ label: '{i:map} Return home', cls: 'red', fn: () => finish(true, true) }]);
    }
    // ---- Ga-Olé style catch wheel: one spin, one throw ----
    const BALLS = {
      poke: { icon: 'pokeball', name: 'Poké Ball', rate: .2 },
      great: { icon: 'greatball', name: 'Great Ball', rate: .35 },
      ultra: { icon: 'ultraball', name: 'Ultra Ball', rate: .55 },
      master: { icon: 'masterball', name: 'Master Ball', rate: 1 },
    };
    const SEGS = ['poke', 'great', 'poke', 'ultra', 'poke', 'great', 'master', 'poke', 'great', 'ultra', 'poke', 'great'];
    function startWheel() {
      G.state = 'wheel'; G.at = now(); G.wheel = { angle: 0, spinning: false, result: null };
      Sound.play('medal');
      say(`${esc(name())} won! The legendary <b>${esc(G.wild.name)}</b> is weakened…`, 'Spin the wheel to choose your ball — you get one throw!');
      buttons([{ label: '{i:pokeball} Spin!', cls: 'gold', fn: spin }]);
    }
    function spin() {
      const W0 = G.wheel, idx = Math.floor(Math.random() * SEGS.length), seg = Math.PI * 2 / SEGS.length, TAU = Math.PI * 2;
      // land the chosen segment's centre under the pointer at the top (-90°), after 5–6 full turns
      const target = -Math.PI / 2 - (idx + .5) * seg + (Math.random() - .5) * seg * .6;
      let to = target; while (to > W0.angle - TAU * 5) to -= TAU;
      W0.from = W0.angle; W0.to = to;
      W0.spinning = true; W0.t0 = now(); W0.dur = 3200; W0.result = SEGS[idx]; W0.lastSeg = -1;
      say('Spinning…');
      setTimeout(() => {
        if (arenaGame !== G) return;
        W0.spinning = false; W0.angle = W0.to;
        const b = BALLS[W0.result]; Sound.play('level');
        say(`It's a {i:${b.icon}} <b>${b.name}</b>!`, W0.result === 'master' ? 'The Master Ball never misses!' : 'Throw it and hope it holds!');
        buttons([{ label: `{i:${b.icon}} Throw!`, cls: 'red', fn: throwBall }]);
      }, W0.dur + 100);
    }
    function throwBall() {
      const b = BALLS[G.wheel.result];
      const caught = Math.random() < b.rate;
      G.state = 'throw'; G.at = now(); G.lastShake = -1; G.throw = { ball: b.icon, caught, shakes: caught ? 3 : 1 + Math.floor(Math.random() * 3) };
      Sound.play('tap'); say(`You threw the ${b.name}!`);
      const total = 700 + 500 + G.throw.shakes * 650;
      setTimeout(() => {
        if (arenaGame !== G) return;
        const w = G.wild.raw;
        if (caught) {
          const where = Game.catchLegend(w);
          G.state = 'caught'; G.at = now(); Sound.play('evolve');
          say(`Gotcha! <b>${esc(G.wild.name)}</b> was caught! {i:sparkle}`, where === 'party' ? 'It joined your party.' : 'Your party is full — it was sent to your PC Box (Party → PC Box).');
          G.wild = null;
        } else {
          const n = Game.addFragment(w.sp);
          G.state = 'fled'; G.at = now(); Sound.play('sad');
          say(`Oh no! ${esc(G.wild.name)} broke free and fled…`,
            `It left behind a {i:fragment} ${esc(G.wild.name)} Fragment (${Math.min(n, Game.FRAGMENTS_TO_SUMMON)}/${Game.FRAGMENTS_TO_SUMMON}). ${n >= Game.FRAGMENTS_TO_SUMMON ? 'You can summon it from Bag → Items!' : 'Collect 20 to summon it.'}`);
          setTimeout(() => { if (G.state === 'fled') G.wild = null; }, 1000);
        }
        afterFloor();
      }, total);
    }
    function drawWheel(ms) {
      const W0 = G.wheel; if (!W0) return;
      const n = SEGS.length, seg = Math.PI * 2 / n;
      if (W0.spinning) {
        const k = Math.min(1, (ms - W0.t0) / W0.dur), e = 1 - Math.pow(1 - k, 3);
        W0.angle = W0.from + (W0.to - W0.from) * e;
        const at = Math.floor(((((-Math.PI / 2 - W0.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / seg);
        if (at !== W0.lastSeg) { W0.lastSeg = at; Sound.play('blip'); }
      }
      const cxw = AW / 2, cyw = AH * .44, R = Math.min(AW, AH) * .3;
      ac.fillStyle = 'rgba(10,8,30,.55)'; ac.fillRect(0, 0, AW, AH);
      ac.save(); ac.translate(cxw, cyw);
      ac.beginPath(); ac.arc(0, 0, R + 10, 0, Math.PI * 2); ac.fillStyle = '#2f3448'; ac.fill();
      ac.beginPath(); ac.arc(0, 0, R + 6, 0, Math.PI * 2); ac.fillStyle = '#ffcb05'; ac.fill();
      SEGS.forEach((k, i) => {
        const a0 = W0.angle + i * seg;
        ac.beginPath(); ac.moveTo(0, 0); ac.arc(0, 0, R, a0, a0 + seg); ac.closePath();
        ac.fillStyle = k === 'master' ? '#e6d4ff' : i % 2 ? '#fbf9ef' : '#e9e4cf'; ac.fill();
        ac.strokeStyle = '#2f3448'; ac.lineWidth = 2; ac.stroke();
        const am = a0 + seg / 2;
        PX.draw(ac, BALLS[k].icon, Math.cos(am) * R * .68, Math.sin(am) * R * .68, Math.max(24, Math.round(R * .3 / 8) * 8));
      });
      ac.beginPath(); ac.arc(0, 0, R * .16, 0, Math.PI * 2); ac.fillStyle = '#fbf9ef'; ac.fill(); ac.lineWidth = 3; ac.strokeStyle = '#2f3448'; ac.stroke();
      ac.restore();
      PX.draw(ac, 'arrow', cxw, cyw - R - 14, 32);
    }
    function drawThrow(ms, wx, wy, size) {
      const T = G.throw; if (!T) return null;
      const e = ms - G.at, sx = AW * .2, sy = AH * .8;
      if (e < 700) {                                   // the ball flies in an arc
        const k = e / 700, x = sx + (wx - sx) * k, y = sy + (wy - size * 1.4 - sy) * k - Math.sin(k * Math.PI) * AH * .25;
        PX.draw(ac, T.ball, x, y, 32, { rot: k * 12 });
        return 'show';
      }
      if (e < 1200) {                                  // the Pokémon is pulled into the ball
        const k = (e - 700) / 500;
        ac.fillStyle = `rgba(255,255,255,${.6 * (1 - k)})`; ac.fillRect(0, 0, AW, AH);
        PX.draw(ac, T.ball, wx, wy - 14, 32);
        return k < .5 ? 'flash' : 'hide';
      }
      const se = e - 1200, shake = Math.floor(se / 650), within = (se % 650) / 650;
      if (shake < T.shakes) {                          // wobble… wobble…
        const rot = within < .5 ? Math.sin(within * Math.PI * 4) * .4 : 0;
        if (within < .1 && G.lastShake !== shake) { G.lastShake = shake; Sound.play('tap'); }
        PX.draw(ac, T.ball, wx, wy - 14, 32, { rot });
        return 'hide';
      }
      return T.caught ? 'hide' : 'show';
    }
    function drawThrowState(ms) { return drawThrow(ms, AW * .72, AH * .56, Math.min(AW, AH) * .11); }

    function afterFloor() {
      if (G.floor >= Game.EXPLORE_MAX_FLOOR) {
        say(epMsg.innerHTML + '<small>This is the deepest floor!</small>');
        return buttons([{ label: '{i:map} Return home', cls: 'gold', fn: () => finish(true) }]);
      }
      if (G.tired) return buttons([{ label: '{i:map} Too tired — go home', cls: 'gold', fn: () => finish(true) }, { label: '{i:oran} Items', cls: 'alt', fn: showItems }]);
      buttons([
        { label: `Go deeper (B${G.floor + 1}F)`, cls: 'red', fn: nextFloor },
        { label: '{i:pecha} Items', cls: 'alt', fn: showItems },
        { label: 'Home', cls: 'alt', fn: () => finish(true) },
      ]);
    }
    // ---- use berries / items between floors ----
    function showItems() {
      const p = Game.pet(), hpPct = Math.round(Math.max(0, G.meHp) / G.me.maxHp * 100);
      say(`Use an item? <small>HP ${hpPct}% · Food ${Math.round(p.food)} · Energy ${Math.round(p.ene)}</small>`);
      const list = FLAVORS.map((f, i) => ({ label: `{i:${f.icon}} ${f.label.replace(' Berry', '')}`, cls: 'alt', fn: () => useInDungeon('berry', i) }));
      list.push({ label: '{i:poffin} Poffin', cls: 'alt', fn: () => useInDungeon('poffin') });
      if (Game.itemCount('oran')) list.push({ label: `{i:oran} Oran ×${Game.itemCount('oran')}`, cls: 'alt', fn: () => useInDungeon('oran') });
      if (Game.itemCount('rareCandy')) list.push({ label: `{i:rareCandy} Candy ×${Game.itemCount('rareCandy')}`, cls: 'alt', fn: () => useInDungeon('rareCandy') });
      list.push({ label: '← Back', cls: 'red', fn: () => { say('What next?'); afterFloor(); } });
      buttons(list, true);
    }
    function healHp(frac) { G.meHp = Math.min(G.me.maxHp, Math.max(0, G.meHp) + Math.round(G.me.maxHp * frac)); }
    function useInDungeon(kind, i) {
      const nm = esc(name());
      let msg = '';
      if (kind === 'berry') {
        const f = FLAVORS[i], r = Game.feedBerry(i);
        if (r.error) { toast('Not right now.'); return showItems(); }
        healHp(.1); Sound.play('eat');
        msg = `${nm} ate the {i:${f.icon}} ${f.label}!${r.fav ? ' It loved it!' : ''} <small>+${r.fav ? 35 : 25} food · +10% HP</small>`;
      } else if (kind === 'poffin') {
        const r = Game.feedCandy(); if (r.error) { toast('Not right now.'); return showItems(); }
        Sound.play('eat'); msg = `${nm} munched a {i:poffin} Poffin! <small>+12 happy</small>`;
      } else if (kind === 'oran') {
        const r = Game.useItem('oran'); if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return showItems(); }
        healHp(.4); Sound.play('level'); msg = `${nm} ate an {i:oran} Oran Berry! <small>Every need +25 · +40% HP</small>`;
      } else if (kind === 'rareCandy') {
        const ratio = Math.max(0, G.meHp) / G.me.maxHp, r = Game.useItem('rareCandy');
        if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return showItems(); }
        const p = Game.pet(); G.me = Game.battler(p.sp, Game.level(), true); G.meHp = Math.round(G.me.maxHp * ratio);
        Sound.play('level'); msg = `${nm} grew to Lv ${Game.level()}! {i:sparkle} <small>Its battle stats went up</small>`;
      }
      G.tired = Game.pet().ene < 8;
      $('#arenaInfo').innerHTML = icons(`B${G.floor}F &nbsp;{i:energy}${Math.round(Game.pet().ene)}`);
      say(msg);
      if (G.tired) return buttons([{ label: '{i:map} Too tired — go home', cls: 'gold', fn: () => finish(true) }]);
      afterFloor();
    }
    function finish(early, lost) {
      if (G.over) return; G.over = true;
      Game.exploreEnd({ floor: G.floor, wins: G.wins, lost: !!lost });
      closeArena();
      const found = Object.entries(G.finds).map(([k, n]) => `{i:${Game.ITEMS[k].icon}}${n > 1 ? '×' + n : ''}`).join(' ');
      toast(`Explored to B${G.floor}F${G.wins ? ` · won ${G.wins} battle${G.wins > 1 ? 's' : ''}` : ''}${found ? ' · found ' + found : ''}`, 5000);
      Talk.clear(); setTimeout(() => Talk.say(lost ? 'exploreLose' : 'exploreBack', { prio: 2 }), 300);
    }
    G.finish = early => finish(early, false);

    let last2 = now();
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), t = ms / 1000;
      const P = Game.pet(); if (!P) return;
      const walking = G.state === 'walk';
      if (walking) G.scroll = (G.scroll || 0) + 70 * Math.min(.05, (ms - last2) / 1000);
      last2 = ms;
      drawCave(G, ms, walking);
      const size = Math.min(AW, AH) * .11, meX = (G.wild || G.state === 'won') ? AW * .28 : AW * .4, meY = Math.round(AH * .84);
      // the wild Pokémon (top-right) and its HP box
      if (G.state === 'caught' && ms - G.at < 2500 && G.throw) {   // celebration stars over the ball
        PX.draw(ac, G.throw.ball, AW * .72, AH * .56 - 14, 32);
        for (let i = 0; i < 3; i++) PX.draw(ac, 'sparkle', AW * .72 + Math.cos(ms / 200 + i * 2) * 30, AH * .56 - 40 + Math.sin(ms / 200 + i * 2) * 12, 18);
      }
      const throwing = G.state === 'throw' ? drawThrowState(ms) : null;
      if ((G.wild && G.state !== 'won' && throwing !== 'hide') || (G.state === 'won' && ms - G.at < 900)) {
        const wx = AW * .72, wy = AH * .56;
        const hurt = G.hurt === 'wild' && ms - G.hurtAt < 450, att = G.act === 'wild' && ms - G.actAt < 600;
        const fade = G.state === 'won' ? Math.max(0, 1 - (ms - G.at) / 800) : G.state === 'fled' ? Math.max(0, 1 - (ms - G.at) / 900) : 1;
        if (G.wild.legend && G.state !== 'fled') { const gr = ac.createRadialGradient(wx, wy - size, 4, wx, wy - size, size * 2.4); gr.addColorStop(0, 'rgba(255,220,120,.45)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); ac.fillStyle = gr; ac.fillRect(wx - size * 3, wy - size * 3.5, size * 6, size * 6); }
        ac.fillStyle = 'rgba(0,0,0,.22)'; ac.beginPath(); ac.ellipse(wx, wy, size * .8, size * .18, 0, 0, Math.PI * 2); ac.fill();
        drawCreature(ac, G.wild.id, { x: wx + (att ? -size * .4 : 0), y: wy - (G.state === 'fled' ? (ms - G.at) / 12 : 0), size: size * .95, silhouette: throwing === 'flash' ? '#ffffff' : false, t, maxH: AH * .26, shiny: G.wild.shiny, dir: 'downleft',
          anim: hurt ? 'Hurt' : att ? 'Attack' : undefined, animT: hurt ? (ms - G.hurtAt) / 1000 : att ? (ms - G.actAt) / 1000 : undefined, alpha: (hurt && Math.floor(ms / 80) % 2 ? .4 : 1) * fade });
        if (!['wheel', 'throw', 'fled'].includes(G.state)) hpBox(ac, 10, 10, Math.min(250, AW * .62), (G.wild.legend ? '★ ' : '') + G.wild.name, G.wild.level, G.wildHp, G.wild.maxHp, false);
      }
      // your Pokémon
      const hurtMe = G.hurt === 'me' && ms - G.hurtAt < 450, attMe = G.act === 'me' && ms - G.actAt < 600;
      ac.fillStyle = 'rgba(0,0,0,.22)'; ac.beginPath(); ac.ellipse(meX, meY, size * .9, size * .2, 0, 0, Math.PI * 2); ac.fill();
      drawCreature(ac, P.sp, { x: meX + (attMe ? size * .4 : 0), y: meY, size, t, maxH: AH * .3, shiny: P.shiny, dir: walking ? 'right' : 'downright', walking,
        anim: G.state === 'lost' ? 'Hurt' : hurtMe ? 'Hurt' : attMe ? 'Attack' : (G.state === 'won' || (G.state === 'chest' && G.chest && G.chest.open)) ? 'Hop' : undefined,
        animT: hurtMe ? (ms - G.hurtAt) / 1000 : attMe ? (ms - G.actAt) / 1000 : (G.state === 'won' || G.state === 'chest') ? ((ms - G.at) / 1000) % Math.max(.4, animLength(P.sp, 'Hop') + .3) : undefined,
        alpha: hurtMe && Math.floor(ms / 80) % 2 ? .4 : 1 });
      if (G.wild || G.state === 'won' || G.state === 'lost') hpBox(ac, AW - Math.min(250, AW * .62) - 10, AH - 70, Math.min(250, AW * .62), petName(), G.me.level, G.meHp, G.me.maxHp, true);
      if (G.legendAt && ms - G.legendAt < 1200) { ac.fillStyle = `rgba(255,240,190,${.75 * (1 - (ms - G.legendAt) / 1200)})`; ac.fillRect(0, 0, AW, AH); }
      if (G.state === 'wheel') drawWheel(ms);
      // treasure / egg props
      if (G.state === 'chest' && G.chest) {
        const cxp = AW * .68, cyp = AH * .7;
        PX.draw(ac, G.chest.open ? 'chestOpen' : 'chest', cxp, cyp, 64, { rot: G.chest.open ? 0 : Math.sin(ms / 60) * .06 });
        if (G.chest.item) { const k = Math.min(1, (ms - G.at) / 600); PX.draw(ac, Game.ITEMS[G.chest.item].icon, cxp, cyp - 30 - k * 34, 48); }
      }
      if (G.state === 'egg') PX.draw(ac, 'egg_legend_0', AW * .68, AH * .66 - Math.abs(Math.sin(t * 3)) * 6, 64);
      // floor label
      if (walking) {
        const k = Math.min(1, (ms - G.at) / 400);
        ac.globalAlpha = k; ac.fillStyle = 'rgba(15,20,45,.6)'; ac.fillRect(0, AH * .14, AW, 54);
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '700 30px "Pixelify Sans", system-ui';
        ac.fillText(`${G.caveName}  B${G.floor}F`, AW / 2, AH * .14 + 38); ac.textAlign = 'left'; ac.globalAlpha = 1;
      }
    };
    arenaGame = G; requestAnimationFrame(G.loop);
    nextFloor();
  }

  // ======================= online: account, friends, trades, battles =======================
  const ON = () => Online.state;
  let onlineTab = 'friends', onlineOpen = false, searchResult = null, searchMsg = '';
  const fmtTrainer = t => t ? `${esc(t.name)}${t.code ? ` <span class="muted">(${esc(t.code)})</span>` : ''}` : '—';
  function monFace(sp, shiny) { const f = portraitUrl(sp, shiny, 'Normal'); return f ? `<img class="face" src="${f}" alt="">` : miniCanvas(sp, { px: 52, shiny }); }
  function monLine(m) { if (!m) return '—'; const s = SPECIES_BY_ID[m.sp]; return `${m.shiny ? '{i:sparkle}' : ''}${esc(m.name || (s ? s.name : '?'))} Lv ${m.level || Game.memberLevel(m)}`; }
  function updateBadge() {
    const n = ON().enabled && ON().profile ? Online.pending() : 0;
    const b = $('#friendsBadge'); b.textContent = n; b.classList.toggle('hidden', !n);
  }
  function openOnline(tab) {
    if (tab) onlineTab = tab;
    onlineOpen = true;
    const S2 = ON();
    let body = '';
    if (!S2.enabled) {
      body = `<p>Online play lets you sign in with Google, save your progress to your account, add friends, battle and trade.</p>
        <p class="muted">It isn't switched on for this game yet. The owner needs to connect a free Firebase project (see <b>ONLINE-SETUP.md</b> in the game's files) — then this screen turns into your trainer card and friends list.</p>`;
    } else if (S2.error && !S2.ready) {
      body = `<p class="note-bad">Couldn't connect: ${esc(S2.error)}</p><div class="btns"><button class="btn alt" id="onRetry">Try again</button></div>`;
    } else if (!S2.ready) {
      body = '<p class="muted">Connecting…</p>';
    } else if (!S2.user) {
      body = `<p>Sign in to save your progress to your account, play on any device, and add friends to battle and trade with.</p>
        <div class="btns"><button class="btn google" id="onSignIn">{i:pokeball} Sign in with Google</button></div>
        ${S2.error ? `<p class="note-bad">${esc(S2.error)}</p>` : ''}`;
    } else if (S2.needsUsername) {
      body = `<p>Welcome, trainer! Choose a <b>username</b> — it's how friends find you, and nobody else can have it.</p>
        <div class="searchrow"><input id="unIn" maxlength="16" placeholder="e.g. AshKetchum" autocapitalize="off" autocomplete="off"><button id="unGo">Create</button></div>
        <p class="muted" id="unMsg">3–16 letters, numbers or _. You'll also get a unique player ID.</p>`;
    } else if (S2.conflict) {
      const c = S2.conflict;
      body = `<p>This device and your account have different saves. Which one do you want to keep?</p>
        <div class="fcard"><div class="fi"><b>Account (cloud) save</b><small>${esc(c.cloudInfo.name)} · Dex ${c.cloudInfo.dex} · party ${c.cloudInfo.party}</small></div><div class="acts"><button data-cf="cloud">Use this</button></div></div>
        <div class="fcard"><div class="fi"><b>This device</b><small>${esc(c.localInfo.name)} · Dex ${c.localInfo.dex} · party ${c.localInfo.party}</small></div><div class="acts"><button class="alt" data-cf="local">Use this</button></div></div>
        <p class="muted">The other one will be replaced.</p>`;
    } else {
      const P = S2.profile, nReq = S2.incoming.length, uid = S2.user.uid;
      const actTrades = S2.trades.filter(t => (t.status === 'offered' && t.to === uid) || (t.status === 'countered' && t.from === uid)).length;
      const tabs = [['friends', `Friends (${S2.friends.length})`], ['requests', `Requests${nReq ? ` (${nReq})` : ''}`], ['trades', `Trades${actTrades ? ` (${actTrades})` : ''}`], ['add', 'Add']];
      body = `<div class="trainer">${ic('friends').replace('class="ic"', 'class="px" style="width:40px;height:40px"')}<div class="sp"><b>${esc(P.username)}</b><small>ID ${esc(P.code)}</small></div><button class="btn alt" id="onSignOut" style="width:auto;padding:8px 12px">Sign out</button></div>
        <div class="tabs">${tabs.map(([k, l]) => `<button data-ot="${k}" class="${onlineTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>` + onlineTabBody(onlineTab);
    }
    openSheet(head('Friends') + body);
    wireOnline();
  }
  function onlineTabBody(tab) {
    const S2 = ON(), uid = S2.user.uid;
    if (tab === 'friends') {
      if (!S2.friends.length) return '<p class="muted">No friends yet. Use <b>Add</b> to search for a username.</p>';
      return S2.friends.map((f, i) => {
        const m = f.showcase && f.showcase.main;
        return `<div class="fcard">${m ? monFace(m.sp, m.shiny) : `<img class="face" src="${PX.url('egg_common_0')}" alt="">`}<div class="fi"><b>${esc(f.username)}</b><small>${esc(f.code || '')}</small><small>Main: ${m ? monLine(m) : 'none yet'}</small></div>
          <div class="acts"><button data-fb="${i}">{i:sword} Battle</button><button class="gold" data-ft="${i}">{i:trade} Trade</button></div></div>`;
      }).join('') + '<p class="muted" style="margin-top:10px">Battles use your friend\'s current main. Trades never include your main.</p>';
    }
    if (tab === 'requests') {
      const inc = S2.incoming.map(r => `<div class="fcard"><img class="face" src="${PX.url('friends')}" alt=""><div class="fi"><b>${esc(r.fromName)}</b><small>${esc(r.fromCode || '')} wants to be friends</small></div>
        <div class="acts"><button data-ra="${r.id}">Accept</button><button class="alt" data-rd="${r.id}">Decline</button></div></div>`).join('');
      const out = S2.outgoing.map(r => `<div class="fcard"><img class="face" src="${PX.url('friends')}" alt=""><div class="fi"><b>${esc(r.toName)}</b><small>Waiting for them to accept…</small></div>
        <div class="acts"><button class="alt" data-rc="${r.id}">Cancel</button></div></div>`).join('');
      return (inc || '<p class="muted">No requests right now.</p>') + (out ? `<h4 style="font-family:var(--pixel);margin:14px 0 8px">Sent</h4>${out}` : '');
    }
    if (tab === 'trades') {
      const order = { offered: 0, countered: 0, accepted: 1, done: 2, declined: 3, cancelled: 3 };
      const list = S2.trades.slice().sort((a, b) => (order[a.status] - order[b.status]) || ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0)).slice(0, 20);
      if (!list.length) return '<p class="muted">No trades yet. Open a friend and tap <b>Trade</b> to offer one of your Pokémon.</p>';
      return list.map(t => {
        const mineFrom = t.from === uid, other = mineFrom ? t.toName : t.fromName;
        const give = mineFrom ? t.offer : t.counter, get = mineFrom ? t.counter : t.offer;
        let status = '', acts = '';
        if (t.status === 'offered') {
          status = mineFrom ? `Waiting for <b>${esc(other)}</b> to pick a Pokémon to give you…` : `<b>${esc(other)}</b> offers you <b>${monLine(t.offer)}</b>`;
          acts = mineFrom ? `<button class="alt" data-tx="${t.id}">Cancel</button>` : `<button class="gold" data-tc="${t.id}">Pick mine</button><button class="alt" data-tx="${t.id}">Decline</button>`;
        } else if (t.status === 'countered') {
          status = mineFrom ? `<b>${esc(other)}</b> will give <b>${monLine(t.counter)}</b> for your <b>${monLine(t.offer)}</b>` : `Waiting for <b>${esc(other)}</b> to confirm…`;
          acts = mineFrom ? `<button class="gold" data-tk="${t.id}">Confirm</button><button class="alt" data-tx="${t.id}">Cancel</button>` : `<button class="alt" data-tx="${t.id}">Cancel</button>`;
        } else if (t.status === 'accepted') status = 'Trading…';
        else if (t.status === 'done') status = `Traded with <b>${esc(other)}</b>: you got <b>${monLine(get)}</b>`;
        else status = `<span class="muted">Trade with ${esc(other)} was ${t.status}.</span>`;
        const pics = `${t.offer ? monFace(t.offer.sp, t.offer.shiny) : ''}`;
        return `<div class="fcard">${pics}<div class="fi"><small>${status}</small></div><div class="acts">${acts}</div></div>`;
      }).join('');
    }
    // add
    const r = searchResult;
    return `<div class="searchrow"><input id="srIn" placeholder="Exact username" autocapitalize="off" autocomplete="off"><button id="srGo">Search</button></div>
      ${r ? `<div class="fcard">${r.showcase && r.showcase.main ? monFace(r.showcase.main.sp, r.showcase.main.shiny) : `<img class="face" src="${PX.url('friends')}" alt="">`}<div class="fi"><b>${esc(r.username)}</b><small>${esc(r.code || '')}</small><small>Pokédex ${(r.showcase && r.showcase.dex) || 0}</small></div>
        <div class="acts"><button id="srAdd">Add friend</button></div></div>` : ''}
      <p class="muted" id="srMsg">${esc(searchMsg || 'Usernames are unique, so search for the exact name your friend chose.')}</p>`;
  }
  function wireOnline() {
    const on = (sel, ev, fn) => sheet.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
    const safe = fn => async e => { try { await fn(e); } catch (er) { toast(er.message || String(er)); } };
    on('#onRetry', 'click', () => location.reload());
    on('#onSignIn', 'click', safe(async () => { await Online.signIn(); }));
    on('#onSignOut', 'click', safe(async () => { await Online.signOut(); toast('Signed out. Your progress stays on this device.'); }));
    on('[data-ot]', 'click', e => { onlineTab = e.currentTarget.dataset.ot; openOnline(); });
    on('[data-cf]', 'click', safe(async e => { await Online.resolveConflict(e.currentTarget.dataset.cf === 'cloud'); V.loaded = null; toast('Save chosen — synced to your account.'); openOnline(); }));
    const unIn = $('#unIn');
    if (unIn) {
      let t = null;
      unIn.addEventListener('input', () => {
        clearTimeout(t); const v = unIn.value.trim(), msg = $('#unMsg');
        if (!Online.NAME_RE.test(v)) { msg.textContent = '3–16 letters, numbers or _.'; msg.className = 'muted'; return; }
        t = setTimeout(async () => { const free = await Online.usernameFree(v).catch(() => null); if (unIn.value.trim() !== v) return; msg.textContent = free ? `"${v}" is available!` : `"${v}" is taken.`; msg.className = free ? 'note-ok' : 'note-bad'; }, 350);
      });
      on('#unGo', 'click', safe(async () => { const p = await Online.createProfile(unIn.value); toast(`Welcome, ${p.username}! Your ID is ${p.code}.`, 4500); if (gateOpen) openGate(); else openOnline('add'); }));
    }
    on('#srGo', 'click', safe(async () => {
      const v = $('#srIn').value; searchResult = await Online.findUser(v);
      searchMsg = searchResult ? '' : `No trainer called "${v}".`; openOnline('add');
    }));
    on('#srAdd', 'click', safe(async () => { await Online.addFriend(searchResult); searchMsg = `Friend request sent to ${searchResult.username}!`; searchResult = null; openOnline('add'); }));
    const req = id => ON().incoming.find(r => r.id === id) || ON().outgoing.find(r => r.id === id);
    on('[data-ra]', 'click', safe(async e => { await Online.respond(req(e.currentTarget.dataset.ra), true); toast('You are now friends!'); }));
    on('[data-rd]', 'click', safe(async e => { await Online.respond(req(e.currentTarget.dataset.rd), false); }));
    on('[data-rc]', 'click', safe(async e => { await Online.cancelRequest(req(e.currentTarget.dataset.rc)); }));
    const trade = id => ON().trades.find(t => t.id === id);
    on('[data-tx]', 'click', safe(async e => { await Online.declineTrade(trade(e.currentTarget.dataset.tx)); }));
    on('[data-tk]', 'click', safe(async e => { await Online.confirmTrade(trade(e.currentTarget.dataset.tk)); toast('Trade confirmed — swapping…'); }));
    on('[data-tc]', 'click', e => pickForTrade(`Pick a Pokémon to give ${trade(e.currentTarget.dataset.tc).fromName}`, async key => { await Online.counterTrade(trade(e.currentTarget.dataset.tc), key); toast('Sent! They just need to confirm.'); openOnline('trades'); }));
    on('[data-ft]', 'click', e => {
      const f = ON().friends[+e.currentTarget.dataset.ft];
      pickForTrade(`Offer a Pokémon to ${f.username}`, async key => { await Online.offerTrade(f, key); toast(`Offer sent to ${f.username}. Your Pokémon is locked until the trade is done.`, 4000); openOnline('trades'); });
    });
    on('[data-fb]', 'click', safe(async e => {
      const f = ON().friends[+e.currentTarget.dataset.fb];
      const team = await Online.friendTeam(f);
      if (!team || !team.main) { toast(`${f.username} doesn't have a main Pokémon yet.`); return; }
      if (!guard()) return;
      closeSheet(); onlineOpen = false; startFriendBattle(f, team.main);
    }));
  }
  function pickForTrade(title, onPick) {
    const list = Game.tradeable();
    if (!list.length) { toast('You need a Pokémon in your party or PC Box (not your main) to trade.'); return; }
    openSheet(head('Choose a Pokémon') + `<p class="muted">${esc(title)}. Your main can't be traded. The one you pick is locked until the trade finishes or is cancelled.</p>
      <div class="partylist">${list.map((x, i) => `<div class="pslot">${monFace(x.pet.sp, x.pet.shiny)}<div class="pi"><b>${monLine(x.pet)}</b><small>${x.where === 'box' ? 'PC Box' : 'Party'} · OT ${x.pet.ot ? esc(x.pet.ot.name) : '—'}</small></div><div class="acts"><button data-pick="${i}">Choose</button></div></div>`).join('')}</div>
      <div class="btns"><button class="btn alt" id="pickBack">← Back</button></div>`);
    sheet.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await onPick(list[+b.dataset.pick].pet.key); } catch (er) { toast(er.message || String(er)); b.disabled = false; }
    }));
    $('#pickBack').addEventListener('click', () => openOnline());
  }
  Online.on((s, ev) => {
    updateBadge();
    if (ev && ev.pulled) { V.loaded = null; V.anim = null; toast('{i:friends} Synced — loaded your latest progress from your account.', 3500); }
    if (ev && ev.adminEdit) { V.loaded = null; V.anim = null; toast('{i:wrench} An admin updated your Pokémon.', 4500); }
    if (ev && ev.traded) {
      const m = ev.received, sp = m && SPECIES_BY_ID[m.sp];
      if (ev.ok) { Sound.play('evolve'); toast(`{i:trade} Trade complete! You received ${sp ? sp.name : 'a Pokémon'}.`, 5000); }
    }
    if (s.battles.length) {
      Online.markBattlesSeen().then(list => list.forEach(b => toast(`{i:sword} ${b.fromName} battled your ${b.toMon && SPECIES_BY_ID[b.toMon.sp] ? SPECIES_BY_ID[b.toMon.sp].name : 'Pokémon'} and ${b.winner === s.user.uid ? 'lost' : 'won'}!`, 5000)));
    }
    if (s.conflict && !onlineOpen) openOnline();
    // refresh the friends screen if it's open (but not while typing)
    if (onlineOpen && !sheet.classList.contains('hidden') && sheet.querySelector('.trainer, #onSignIn, #unIn, [data-cf]') && !sheet.contains(document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement : null)) openOnline();
  });
  $('#friendsBtn').addEventListener('click', () => { if (!gateOpen) openOnline(); });

  // ---------- friend battle (uses your friend's current main) ----------
  function startFriendBattle(friend, theirs) {
    const p = Game.pet();
    panel.classList.remove('hidden');
    openArena(`{i:sword} vs ${friend.username}`);
    const me = Game.battler(p.sp, Game.level(), true);
    const opp = { id: theirs.sp, level: theirs.level, atk: theirs.atk, def: theirs.def, spd: theirs.spd, maxHp: Math.round(22 + theirs.level * 2.2 + theirs.def * .25), shiny: theirs.shiny, name: theirs.name || SPECIES_BY_ID[theirs.sp].name };
    const G = { state: 'battle', at: now(), meHp: me.maxHp, oppHp: opp.maxHp, act: null, actAt: 0, hurt: null, hurtAt: 0, over: false };
    preloadSpecies(opp.id, opp.shiny);
    say(`<b>${esc(friend.username)}</b> sends out <b>${esc(opp.name)}</b> (Lv ${opp.level})!`, `Your ${esc(petName())} is Lv ${me.level}.`);
    buttons([{ label: '{i:sword} Battle!', cls: 'red', fn: go }, { label: 'Not now', cls: 'alt', fn: () => G.finish(true) }]);
    function go() {
      let turn = me.spd >= opp.spd ? 'me' : 'opp';
      const step = () => {
        if (arenaGame !== G) return;
        const A = turn === 'me' ? me : opp, D = turn === 'me' ? opp : me, crit = Math.random() < .07;
        const dmg = Math.max(2, Math.round((A.atk / Math.max(1, D.def)) * (A.level * .45 + 6) * (.85 + Math.random() * .3) * (crit ? 1.5 : 1)));
        G.act = turn; G.actAt = now(); Sound.play('hit');
        setTimeout(() => {
          if (arenaGame !== G) return;
          if (turn === 'me') G.oppHp -= dmg; else G.meHp -= dmg;
          G.hurt = turn === 'me' ? 'opp' : 'me'; G.hurtAt = now();
          say(`${turn === 'me' ? esc(petName()) : `${esc(friend.username)}'s ${esc(opp.name)}`} attacks!${crit ? ' A critical hit!' : ''}`, `${dmg} damage`);
          if (G.oppHp <= 0 || G.meHp <= 0) return setTimeout(() => end(G.oppHp <= 0), 700);
          turn = turn === 'me' ? 'opp' : 'me'; setTimeout(step, 750);
        }, 380);
      };
      setTimeout(step, 400);
    }
    function end(won) {
      G.state = won ? 'won' : 'lost'; G.at = now(); Sound.play(won ? 'level' : 'sad');
      say(won ? `You beat ${esc(friend.username)}'s ${esc(opp.name)}!` : `${esc(friend.username)}'s ${esc(opp.name)} won this time…`, won ? `${esc(petName())} feels proud!` : 'Train in the Games menu and try again.');
      Online.recordBattle(friend, won, { sp: p.sp, level: me.level, shiny: !!p.shiny }, { sp: opp.id, level: opp.level, shiny: !!opp.shiny }).catch(() => {});
      Game.exploreEnd({ floor: 0, wins: won ? 1 : 0, lost: !won });
      buttons([{ label: 'Done', cls: 'red', fn: () => G.finish(true) }]);
    }
    G.finish = () => { if (G.over) return; G.over = true; closeArena(); Talk.say(G.state === 'won' ? 'exploreBack' : G.state === 'lost' ? 'exploreLose' : 'pet', { prio: 2 }); };
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), t = ms / 1000;
      if (!drawExploreBg({ state: 'battle', at: 0 }, ms)) { const g2 = ac.createLinearGradient(0, 0, 0, AH); g2.addColorStop(0, '#5aa0e6'); g2.addColorStop(.55, '#bfe3ff'); g2.addColorStop(.56, '#7cc35a'); g2.addColorStop(1, '#4f9a3f'); ac.fillStyle = g2; ac.fillRect(0, 0, AW, AH); }
      const size = Math.min(AW, AH) * .11, wx = AW * .72, wy = AH * .56, mx = AW * .28, my = AH * .84;
      const oh = G.hurt === 'opp' && ms - G.hurtAt < 450, oa = G.act === 'opp' && ms - G.actAt < 600, mh = G.hurt === 'me' && ms - G.hurtAt < 450, ma = G.act === 'me' && ms - G.actAt < 600;
      for (const [x, y, s2] of [[wx, wy, size * .8], [mx, my, size * .9]]) { ac.fillStyle = 'rgba(0,0,0,.22)'; ac.beginPath(); ac.ellipse(x, y, s2, s2 * .22, 0, 0, Math.PI * 2); ac.fill(); }
      drawCreature(ac, opp.id, { x: wx + (oa ? -size * .4 : 0), y: wy, size: size * .95, t, maxH: AH * .26, shiny: opp.shiny, dir: 'downleft', anim: oh ? 'Hurt' : oa ? 'Attack' : undefined, animT: oh ? (ms - G.hurtAt) / 1000 : oa ? (ms - G.actAt) / 1000 : undefined, alpha: (oh && Math.floor(ms / 80) % 2 ? .4 : 1) * (G.state === 'won' ? Math.max(0, 1 - (ms - G.at) / 800) : 1) });
      drawCreature(ac, p.sp, { x: mx + (ma ? size * .4 : 0), y: my, size, t, maxH: AH * .3, shiny: p.shiny, dir: 'downright', anim: mh ? 'Hurt' : ma ? 'Attack' : G.state === 'won' ? 'Hop' : undefined, animT: mh ? (ms - G.hurtAt) / 1000 : ma ? (ms - G.actAt) / 1000 : G.state === 'won' ? ((ms - G.at) / 1000) % Math.max(.4, animLength(p.sp, 'Hop') + .3) : undefined, alpha: mh && Math.floor(ms / 80) % 2 ? .4 : 1 });
      hpBox(ac, 10, 10, Math.min(250, AW * .62), `${friend.username}'s ${opp.name}`.slice(0, 22), opp.level, G.oppHp, opp.maxHp, false);
      hpBox(ac, AW - Math.min(250, AW * .62) - 10, AH - 70, Math.min(250, AW * .62), petName(), me.level, G.meHp, me.maxHp, true);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ======================= game events =======================
  Game.on((ev, d) => {
    if (ev === 'level') { toast(`{i:up} Level up! Lv ${d}`); Sound.play('level'); if (!Game.pet().asleep) Talk.say('level', { vars: { lv: d } }); }
    else if (ev === 'medal') { toast(`New medal: {i:${d.icon}} ${d.label}`, 3500); Sound.play('medal'); if (!Game.pet().asleep) Talk.say('medal', { vars: { medal: d.label } }); }
    else if (ev === 'milestone') { toast(`{i:flame} ${d}-day streak! Your eggs are getting luckier.`, 4000); Sound.play('medal'); Talk.say('milestone', { vars: { n: d }, prio: 2 }); }
    else if (ev === 'poop') { Sound.play('poop'); }
    else if (ev === 'slip') { toast('{i:warning} Slip-up! A need hit rock bottom — evolution delayed.', 3500); Sound.play('sad'); Talk.say('slip', { prio: 2 }); }
    else if (ev === 'def') { toast('{i:shield} 12 h of great care: DEF +1'); }
    else if (ev === 'hatch') { onHatched(); }
    else if (ev === 'away') {
      const a = d.before, b = d.after;
      let msg = `While you were away (${fmtDur(d.minutes)})`;
      if (a && b) {
        if (a.egg && !b.egg) msg += `: your egg hatched into ${SPECIES_BY_ID[b.sp].name}!`;
        else if (!b.egg && b.level > a.level) msg += `: it grew to Lv ${b.level}.`;
        else msg += '.';
        if (!b.egg && Math.min(b.food, b.joy, b.ene, b.hyg) < 25) msg += ' It really needs you now!';
      }
      toast(msg, 5000);
      if (b && !b.egg && !Game.pet().asleep) { awayGreeted = true; Talk.say(Math.min(b.food, b.joy, b.ene, b.hyg) < 25 ? 'backNeedy' : 'backHappy', { prio: 2 }); }
    }
  });

  // ======================= main loop =======================
  // ---------- talking on its own ----------
  let nextChat = now() + 25000, awayGreeted = false;
  function chatter(ms) {
    if (ms < nextChat || Talk.busy || arenaGame || V.anim || !sheet.classList.contains('hidden')) return;
    const p = Game.pet(); if (!p || p.egg || p.asleep || !ST().player.starterPicked) { nextChat = ms + 10000; return; }
    nextChat = ms + 35000 + Math.random() * 40000;
    if (p.food < 25) return Talk.say('hungry');
    if (p.hyg < 30 || p.poops >= 2) return Talk.say('dirty');
    if (p.ene < 20) return Talk.say('sleepy');
    if (p.joy < 30) return Talk.say('bored');
    const pool = [dayPhase() === 'night' ? 'chatNight' : 'chatDay', 'chatDay'];
    if (!Game.isFinal(p.sp)) pool.push('chatEvolve');
    if (p.bond >= 50) pool.push('chatBond', 'chatBond');
    if (ST().player.streak >= 3) pool.push('chatStreak');
    if (p.weight > 50) pool.push('chatFat');
    const k = pool[Math.floor(Math.random() * pool.length)];
    Talk.say(k, { prio: 0, vars: { n: ST().player.streak } });
  }
  function greet() {
    const p = Game.pet();
    if (awayGreeted || !p || p.egg || p.asleep || !ST().player.starterPicked) return;
    const h = new Date().getHours();
    Talk.say(h >= 5 && h < 11 ? 'greetMorning' : h < 17 ? 'greetDay' : h < 21 ? 'greetEvening' : 'greetNight');
  }

  let last = now(), hudAt = 0;
  function frame() {
    requestAnimationFrame(frame);            // schedule first: one bad frame must never stop the game
    try { frameBody(); } catch (e) { reportError(e); }
  }
  function frameBody() {
    const ms = now(), dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
    Game.update(Date.now());
    const cp = Game.pet();
    if (cp && !cp.egg && V.loaded !== cp.sp + ':' + cp.shiny) { V.loaded = cp.sp + ':' + cp.shiny; preloadSpecies(cp.sp, cp.shiny); SPECIES_BY_ID[cp.sp].next.forEach(n => preloadSpecies(n, cp.shiny)); }
    if (!arenaGame) { stepView(t, dt); draw(t, ms); }
    if (ms - hudAt > 250) { hudAt = ms; hud(); chatter(ms); }
  }
  // show (once) what went wrong, so it can be reported — the game keeps running regardless
  const seenErrors = new Set();
  function reportError(e) {
    const msg = (e && (e.message || e)) + '';
    console.error(e);
    if (seenErrors.has(msg)) return;
    seenErrors.add(msg);
    try { toast('Something went wrong (' + msg.slice(0, 80) + ') — the game kept running.', 6000); } catch (_) {}
  }
  window.__pocketPalError = reportError;
  // away from the phone or app closed -> the Pokémon goes to sleep right away (and the game is saved)
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.sleepNow(); });
  window.addEventListener('pagehide', () => Game.sleepNow());

  PX.hydrate();
  PX.onUpdate(() => { PX.hydrate(); if (els && els.name) els.name.dataset.sig = ''; }); // egg picture loaded
  // phones: stop double-tap zoom / pinch zoom from shifting the layout (text fields still work normally)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const t = Date.now();
    if (t - lastTouchEnd < 350 && !e.target.closest('input, textarea, select')) e.preventDefault();
    lastTouchEnd = t;
  }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  Talk.init({ sound: Sound.play, player: () => (ST().settings.player || '').trim() || 'partner' });
  Online.init(); updateBadge();
  if (!ST().player.starterPicked) startNewGame();
  else setTimeout(greet, 900);
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
    // a new version took over: reload once so every file is the new version
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true; Game.save(); location.reload();
    });
  }
})();
