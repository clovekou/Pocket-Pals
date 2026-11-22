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
    return { unlock, play };
  })();
  document.addEventListener('pointerdown', Sound.unlock, { capture: true });

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
    cx.drawImage(im, (W - w) / 2, H - h, w, h);                   // keep the bottom (the ground) in view
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
    pals.forEach((p, i) => {
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
    const fy = H * p.depth - V.lift * .5;
    const size = baseSize() * .55 * stageScale(p.sp), x = p.x * W;
    cx.fillStyle = 'rgba(0,0,0,.14)'; cx.beginPath(); cx.ellipse(x, fy, size * .8, size * .16, 0, 0, Math.PI * 2); cx.fill();
    const sleeping = p.act === 'sleep', playing = p.act === 'play' && !p.moving;
    const pos = drawCreature(cx, p.sp, {
      x, y: fy, size, t: t + p.depth * 10, maxH: H * .22, shiny: p.shiny, sleep: sleeping, walking: p.moving, flip: p.flip,
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
    if (!drawCustomBg(scene, phase)) { drawSky(t, phase); drawBiome(scene, t, phase); }
    if (p && !p.egg) for (let i = 0; i < p.poops; i++) drawPoop(POOP_X[i] * W, feetY() - 2 + i * 4, t, i);
    if (V.anim && V.anim.type === 'evolve') drawEvolve(t, ms);
    else if (V.anim) drawEnding(t, ms);
    else { V.pals.slice().sort((a, b) => a.depth - b.depth).forEach(p => drawPal(p, t)); drawPet(t, ms); drawBath(t, ms); }
    drawFx();
  }

  // ======================= HUD =======================
  const els = {
    name: $('#petName'), lv: $('#petLevel'), streak: $('#streakNum'), cer: $('#cerBtns'), hint: $('#hint'),
    lightIcon: $('#lightIcon'), lightLbl: $('#lightLbl'), sub: $('#petSub'), avatar: $('#avatar'),
    bars: [...document.querySelectorAll('.bar')].map(b => ({ k: b.dataset.k, el: b, fill: b.querySelector('i'), val: b.querySelector('.bv') })),
  };
  let cerSig = '';
  function hud() {
    const p = Game.pet(), S = ST();
    els.streak.textContent = S.player.streak;
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
      const off = (p.egg && a !== 'dex' && a !== 'party') || (asleep && ['feed', 'play', 'train'].includes(a));
      b.classList.toggle('off', off);
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
  function closeSheet() { sheet.className = 'hidden'; scrim.classList.add('hidden'); sheet.innerHTML = ''; sheetLocked = false; }
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

  // ---------- starter ----------
  function openStarter() {
    openSheet(`<h2 style="margin:0 0 4px">${STARTERS.length > 1 ? 'Choose your first partner' : 'Meet your partner'}</h2>
      <p class="muted">Raise it, evolve it, and fill your Dex with all ${SPECIES.length} creatures (shinies too!).</p>
      <div class="starters">${STARTERS.map(id => { const s = SPECIES_BY_ID[id]; return `<button data-st="${id}">${miniCanvas(id, { px: 96 })}${esc(s.name)}<small>${ELEMENTS[s.el].label}</small></button>`; }).join('')}</div>`, { dialog: true, locked: true });
    sheet.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
      Game.pickStarter(+b.dataset.st); closeSheet(); Sound.play('hatch');
      toast('Your egg is here! Tap it 3 times to hatch.', 3500);
      setTimeout(() => toast('Tip: swipe ← → for the Dex, ↑ for its card, ↓ for settings.', 4500), 3800);
    }));
  }

  // ---------- feed ----------
  function openFeed() {
    if (!guard()) return;
    const p = Game.pet(), s = Game.sp();
    const known = p.berryKnown;
    openSheet(head('Berries') + `<div class="foods">
      ${FLAVORS.map((f, i) => `<button class="food" data-f="${i}">${ic(f.icon).replace('class="ic"', 'class="px"')}<span><b>${f.label}</b><small>${f.taste} · +25 food${known && s.fav === i ? ' · favourite!' : ''}</small></span>${known && s.fav === i ? '<span class="heart">{i:heart}</span>' : ''}</button>`).join('')}
      <button class="food" data-f="candy">${ic('poffin').replace('class="ic"', 'class="px"')}<span><b>Poffin</b><small>Treat · +12 happy, fattening</small></span></button>
      </div><p class="muted" style="margin-top:12px">${known ? `Its favourite is the ${FLAVORS[s.fav].label} (${FLAVORS[s.fav].taste.toLowerCase()}).` : 'Every Pokémon has a hidden favourite berry. Try them all!'}</p>`);
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
        <div class="acts">${isMain ? '<span class="tag">{i:arrow}Main</span>' : `<button data-sw="${i}">Make main</button><button class="alt" data-rel="${i}">Release</button>`}</div></div>`;
    };
    const empties = Math.max(0, Game.PARTY_MAX - 1 - party.length);
    openSheet(head('Party') + `<p class="muted" style="margin-top:0">Up to ${Game.PARTY_MAX} Pokémon. Your main is the one you care for; the others rest and play in the background (their needs pause while resting). Tap one on the home screen to switch.</p>
      <div class="partylist">${p ? slot(p, -1, true) : ''}${party.map((m, i) => slot(m, i, false)).join('')}${'<div class="pslot empty">Empty slot</div>'.repeat(empties)}</div>
      <div class="btns"><button class="btn ${chk.ok ? 'gold' : 'alt'}" id="takeEgg" ${chk.ok ? '' : 'disabled'}>{i:egg_rare_0} Get a new egg</button></div>
      <p class="muted" style="text-align:center">${chk.ok ? 'Your main joins the party and the egg becomes your new main.' : esc(chk.why)}</p>`);
    sheet.querySelectorAll('[data-sw]').forEach(b => b.addEventListener('click', () => { closeSheet(); doSwitch(+b.dataset.sw); }));
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
          <div class="row"><span>Slip-ups</span><b>${p.mistakes}</b></div>
          <div class="row"><span>Genes</span><b>ATK ${p.genes.atk}% · DEF ${p.genes.def}% · SPD ${p.genes.spd}%</b></div>
        </div>`;
    } else if (cardTab === 'battle') {
      const row = (k, label, col, note) => { const v = Game.stat(k); return `<div class="stat"><div class="top"><span>${label}</span><span>${v}</span></div><div class="trk"><i style="width:${Math.min(100, v / 2.5)}%;background:${col}"></i></div><small>${note}</small></div>`; };
      const defLeft = 720 - p.goodTicks;
      body = row('atk', '{i:sword} Attack', '#e8503a', `Strength training ${p.tr.atk}/100 — from the training bag`) +
        row('def', '{i:shield} Defence', '#4f93c4', `Discipline ${p.tr.def}/100 — +1 per 12 h of good care (next in ${fmtDur(defLeft)} if every need stays ≥ 40)`) +
        row('spd', '{i:speed} Speed', '#58b868', `Speed training ${p.tr.spd}/100 — from Poké Ball Catch`) +
        `<p class="muted">Stat = species base × genes + level + training.</p>
        <div class="rows"><div class="row"><span>Best Poké Ball Catch</span><b>${S.player.gameHi}</b></div><div class="row"><span>Most bag hits</span><b>${S.player.strHi}</b></div></div>
        <div class="btns"><button class="btn red" id="goTrain">{i:train} Train strength</button></div>`;
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
    const gt = $('#goTrain'); if (gt) gt.addEventListener('click', () => { closeSheet(); startTrain(); });
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
      <label class="toggle"><span><b>Sound</b><small>Retro beeps</small></span><span class="sw"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}><i></i></span></label>
      <label class="toggle"><span><b>Fast time (testing)</b><small>1 second = 1 game minute. Normally 1 real minute = 1 game minute.</small></span><span class="sw"><input type="checkbox" id="setFast" ${S.settings.fast ? 'checked' : ''}><i></i></span></label>
      <div class="btns"><button class="btn alt" id="howTo">{i:book} How to play</button><button class="btn alt" id="openCard">{i:card} Stat card</button>${REMOTE_SPRITES ? '' : '<a class="btn alt" href="dashboard.html" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box">{i:wrench} Sprite dashboard</a>'}<button class="btn red" id="resetBtn">Reset game</button></div>
      <p class="muted" style="margin-top:12px">Progress is saved in this browser. Add it to your home screen to play it like an app.</p>`);
    $('#setSound').addEventListener('change', e => { S.settings.sound = e.target.checked; Game.save(); });
    $('#setPlayer').addEventListener('input', e => { S.settings.player = e.target.value.slice(0, 14); Game.save(); });
    $('#setFast').addEventListener('change', e => { Game.setFast(e.target.checked); toast(e.target.checked ? 'Fast time ON' : 'Fast time OFF'); });
    $('#howTo').addEventListener('click', openManual);
    $('#openCard').addEventListener('click', () => openCard());
    $('#resetBtn').addEventListener('click', () => dialog('Reset everything?', 'Your creature, Dex, streak and medals will be erased.', [
      { label: 'Cancel', cls: 'alt' },
      { label: 'Erase', cls: 'red', fn: () => { Game.reset(); V.anim = null; V.x = .5; openStarter(); } },
    ]));
  }
  function openManual() {
    openSheet(head('How to play') + `<div class="manual">
      <h4>Time</h4><ul><li>1 real minute = 1 game minute. +1 level every hour.</li><li>It keeps living while the app is closed (up to 2 weeks of catch-up).</li></ul>
      <h4>Needs</h4><ul><li>FOOD −2/min, ENE −1/min, HYG −1/min (−4 more per poop), HAPPY −1/min (faster if hungry or dirty).</li><li>Letting a need drop to 10 or less is a <b>slip-up</b>: it delays evolution by 1 level and cools the bond.</li></ul>
      <h4>Care</h4><ul><li>{i:pecha}{i:aspear}{i:cheri} <b>Pecha, Aspear and Cheri Berries</b> +25 food. One is its hidden favourite (+35 food, +happy, bond).</li><li>{i:poffin} <b>Poffin</b> +food +happy but adds weight. Over 50 weight = sluggish.</li><li>{i:pokeball} <b>Poké Ball Catch</b> trains SPEED and burns weight. {i:train} <b>Bag</b> trains ATTACK.</li><li>{i:bath} <b>Bath</b> clears poops. {i:hand} <b>Tap</b> to pet it. {i:sleep} <b>Sleep</b> restores energy; needs drop much slower.</li></ul>
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
    const a = b.dataset.act;
    if (a === 'dex') return openDex();
    if (a === 'party') return openParty();
    if (V.anim) return;
    if (a === 'feed') return openFeed();
    if (a === 'play') { if (!guard()) return; if (Game.pet().ene < 10) { Talk.say('tooTired'); Sound.play('no'); return; } return startCatch(); }
    if (a === 'train') { if (!guard()) return; if (Game.pet().ene < 15) { Talk.say('tooTired'); Sound.play('no'); return; } return startTrain(); }
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
  $('#streak').addEventListener('click', () => toast(`{i:flame} ${ST().player.streak}-day care streak (best ${ST().player.bestStreak}). Care at least once a day!`));

  // ======================= minigames =======================
  const arena = $('#arena'), acv = $('#arenaCanvas'), ac = acv.getContext('2d');
  let AW = 1, AH = 1, arenaGame = null;
  function openArena(title) {
    $('#arenaTitle').innerHTML = icons(esc(title)); arena.classList.remove('hidden');
    const r = acv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    AW = r.width; AH = r.height; acv.width = AW * d; acv.height = AH * d; ac.setTransform(d, 0, 0, d, 0, 0);
  }
  function closeArena() { arena.classList.add('hidden'); arenaGame = null; }
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

  function startTrain() {
    if (!guard()) return;
    if (Game.pet().ene < 15) { toast('Too tired to train… let it sleep.'); return; }
    openArena('{i:train} Training Bag');
    const p = Game.pet();
    const G = { hits: 0, t0: now(), dur: 15000, a: 0, av: 0, punchAt: 0, over: false, endAt: 0, pops: [] };
    const size = Math.min(AW, AH) * .12;
    G.down = () => {
      if (G.over) return;
      G.hits++; G.av += 3.2 + Math.random(); G.punchAt = now(); Sound.play('hit');
      const pop = G.hits % 4 === 0 && G.hits / 4 <= 18 ? 'STR +1' : '+1';
      G.pops.push({ txt: pop, x: AW * .62 + (Math.random() - .5) * 40, y: AH * .45, age: 0 });
    };
    G.finish = early => {
      if (G.over) { if (early) closeArena(); return; }
      G.over = true; G.endAt = now();
      G.result = Game.trainStrength(G.hits);
      if (early) { closeArena(); report(); }
    };
    const report = () => {
      const r = G.result || {};
      if (r.hearts) addHearts(5);
      toast(`{i:train} ${G.hits} hits! ATK training +${r.atk || 0}${r.hi ? ' · New record!' : ''}`, 3500);
      Talk.say(G.hits >= 20 ? 'trainGood' : 'trainBad');
    };
    let last = now();
    G.loop = () => {
      if (arenaGame !== G) return;
      const ms = now(), dt = Math.min(.05, (ms - last) / 1000); last = ms; const t = ms / 1000;
      const left = Math.max(0, G.dur - (ms - G.t0));
      if (!G.over && left <= 0) G.finish(false);
      if (G.over && ms - G.endAt > 1800) { closeArena(); report(); return; }
      G.av += -G.a * 28 * dt; G.av *= Math.pow(.2, dt); G.a += G.av * dt; G.a = Math.max(-1.1, Math.min(1.1, G.a));
      // draw
      ac.fillStyle = '#f3ecdc'; ac.fillRect(0, 0, AW, AH);
      ac.fillStyle = '#d9cdb2'; ac.fillRect(0, AH * .8, AW, AH * .2);
      ac.fillStyle = '#8a6c48'; ac.fillRect(0, 0, AW, 14);
      const bw = size * 1.1, bh = size * 2.4;
      const ax = AW * .62, ay = 14, len = Math.max(20, AH * .8 - size * .35 - bh - ay);
      ac.save(); ac.translate(ax, ay); ac.rotate(-G.a * .12);
      ac.strokeStyle = '#2b2438'; ac.lineWidth = 3; ac.beginPath(); ac.moveTo(0, 0); ac.lineTo(0, len); ac.stroke();
      ac.imageSmoothingEnabled = false;
      ac.drawImage(PX.get('bag'), 0, 0, 32, 32, -bh / 2, len, bh, bh);
      ac.restore();
      const punch = Math.max(0, 1 - (ms - G.punchAt) / 160);
      const idle = spriteAnim(p.sp, p.shiny, 'Idle');
      const px = AW * .62 - bw * .5 - Math.min(idle.fw * (size / 10), AW * .5) * .42;
      const atkT = (ms - G.punchAt) / 1000, atk = atkT < animLength(p.sp, 'Attack');
      drawCreature(ac, p.sp, { x: px, y: AH * .8, size, t, maxH: AH * .35, shiny: p.shiny, dir: 'right', anim: atk ? 'Attack' : 'Idle', animT: atk ? atkT : undefined });
      if (punch > .3) star(ac, AW * .62 - bw * .55, AH * .8 - size * 1.1, size * .25 * punch, t, '#ffd23d');
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = Math.max(0, 1 - pp.age * 1.6); ac.fillStyle = pp.txt === '+1' ? '#2b2438' : '#e8503a'; ac.font = '800 20px system-ui'; ac.fillText(pp.txt, pp.x, pp.y - pp.age * 70); ac.globalAlpha = 1; return pp.age < .6; });
      $('#arenaInfo').innerHTML = icons(`{i:train}${G.hits} &nbsp;{i:sword}+${Math.min(18, Math.floor(G.hits / 4))} &nbsp;${Math.ceil(left / 1000)}s`);
      ac.textAlign = 'center';
      if (G.over) {
        ac.fillStyle = 'rgba(0,0,0,.45)'; ac.fillRect(0, 0, AW, AH);
        ac.fillStyle = '#fff'; ac.font = '800 28px system-ui'; ac.fillText(`${G.hits} hits!`, AW / 2, AH * .42);
        ac.font = '700 16px system-ui'; ac.fillText(`Attack training +${(G.result && G.result.atk) || 0}`, AW / 2, AH * .42 + 30);
      } else if (ms - G.t0 < 2000) {
        ac.fillStyle = '#2b2438'; ac.font = '700 16px system-ui'; ac.fillText('Tap fast! ~4 hits = +1 strength', AW / 2, AH * .9);
      }
      ac.textAlign = 'left';
      requestAnimationFrame(G.loop);
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(); });
  window.addEventListener('pagehide', () => Game.save());

  PX.hydrate();
  // phones: stop double-tap zoom / pinch zoom from shifting the layout (text fields still work normally)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', e => {
    const t = Date.now();
    if (t - lastTouchEnd < 350 && !e.target.closest('input, textarea, select')) e.preventDefault();
    lastTouchEnd = t;
  }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  Talk.init({ sound: Sound.play, player: () => (ST().settings.player || '').trim() || 'partner' });
  if (!ST().player.starterPicked) openStarter();
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
