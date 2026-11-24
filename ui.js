'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const now = () => performance.now();
  Game.load();
  const ST = () => Game.state;

  // ======================= sound =======================
  // volume settings (0–100): master scales everything, then music and sound effects each have their own
  const pct = (k, def) => { const v = ST().settings[k]; return (v == null ? def : v) / 100; };
  const masterVol = () => pct('masterVol', 100);
  const sfxVol = () => masterVol() * pct('sfxVol', 80);
  const Sound = (() => {
    let ac = null, sfx = null;
    // every sound effect plays through this one volume knob
    function out() {
      if (!sfx) { sfx = ac.createGain(); sfx.connect(ac.destination); }
      sfx.gain.setValueAtTime(sfxVol() * 1.25, ac.currentTime);
      return sfx;
    }
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
      if (!ST().settings.sound || sfxVol() <= 0 || !ac || ac.state === 'closed') return;
      const seq = SFX[n]; if (!seq) return;
      let t = ac.currentTime + .01;
      for (const [f, d] of seq) {
        if (f > 0) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square'; o.frequency.value = f;
          g.gain.setValueAtTime(n.startsWith('blip') ? .025 : .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
          o.connect(g); g.connect(out()); o.start(t); o.stop(t + d + .02);
        }
        t += d;
      }
    }
    // ---- battle sounds: noise-based swoosh and impact (retro handheld style) ----
    let noiseBuf = null;
    function noise() {
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
    }
    const ok = () => ST().settings.sound && sfxVol() > 0 && ac && ac.state !== 'closed';
    /** the attacker lunges: a quick rising swoosh */
    function attack() {
      try {
        if (!ok()) return;
        const t = ac.currentTime + .01, n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
        f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3200, t + .18);
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .06); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
        n.connect(f); f.connect(g); g.connect(out()); n.start(t); n.stop(t + .25);
      } catch (e) {}
    }
    /** the hit lands: a crunchy burst plus a falling thump; critical hits get a second, sharper crack */
    function damage(crit) {
      try {
        if (!ok()) return;
        const hit = (t, vol, top) => {
          const n = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
          f.type = 'lowpass'; f.frequency.setValueAtTime(top, t); f.frequency.exponentialRampToValueAtTime(300, t + .16);
          g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18);
          n.connect(f); f.connect(g); g.connect(out()); n.start(t); n.stop(t + .2);
          const o = ac.createOscillator(), og = ac.createGain();
          o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(55, t + .14);
          og.gain.setValueAtTime(vol * .7, t); og.gain.exponentialRampToValueAtTime(.0001, t + .16);
          o.connect(og); og.connect(out()); o.start(t); o.stop(t + .18);
        };
        const t = ac.currentTime + .01;
        hit(t, .22, 5000);
        if (crit) {
          hit(t + .09, .26, 9000);
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'square'; o.frequency.setValueAtTime(1600, t + .09); o.frequency.exponentialRampToValueAtTime(400, t + .2);
          g.gain.setValueAtTime(.05, t + .09); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
          o.connect(g); g.connect(out()); o.start(t + .09); o.stop(t + .24);
        }
      } catch (e) {}
    }
    /** a legendary's entrance: a deep rumble that swells, a rising whoosh, then a huge impact and a heroic chord */
    function legendIntro() {
      try {
        if (!ST().settings.sound || sfxVol() <= 0 || !ac || ac.state === 'closed') return;
        const t = ac.currentTime + .02, R = 2.7, dst = out();
        const nb = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        // rumble: low filtered noise that builds up until the reveal
        const rn = ac.createBufferSource(), rf = ac.createBiquadFilter(), rg = ac.createGain();
        rn.buffer = nb; rf.type = 'lowpass'; rf.frequency.setValueAtTime(90, t); rf.frequency.linearRampToValueAtTime(260, t + R);
        rg.gain.setValueAtTime(.0001, t); rg.gain.exponentialRampToValueAtTime(.9, t + R - .1); rg.gain.exponentialRampToValueAtTime(.0001, t + R + .1);
        rn.connect(rf); rf.connect(rg); rg.connect(dst); rn.start(t); rn.stop(t + R + .2);
        // a heartbeat-like low drum, getting faster
        for (let k = 0, x = .2; x < R - .2; k++, x += Math.max(.18, .6 - k * .06)) {
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(80, t + x); o.frequency.exponentialRampToValueAtTime(38, t + x + .2);
          g.gain.setValueAtTime(.25 + x / R * .25, t + x); g.gain.exponentialRampToValueAtTime(.0001, t + x + .25);
          o.connect(g); g.connect(dst); o.start(t + x); o.stop(t + x + .3);
        }
        // a rising sweep
        const so = ac.createOscillator(), sg = ac.createGain();
        so.type = 'sawtooth'; so.frequency.setValueAtTime(90, t + .8); so.frequency.exponentialRampToValueAtTime(1400, t + R);
        sg.gain.setValueAtTime(.0001, t + .8); sg.gain.exponentialRampToValueAtTime(.035, t + R - .05); sg.gain.exponentialRampToValueAtTime(.0001, t + R + .05);
        so.connect(sg); sg.connect(dst); so.start(t + .8); so.stop(t + R + .1);
        // the impact: a boom and a crash
        const bo = ac.createOscillator(), bg = ac.createGain();
        bo.type = 'sine'; bo.frequency.setValueAtTime(120, t + R); bo.frequency.exponentialRampToValueAtTime(30, t + R + .8);
        bg.gain.setValueAtTime(.7, t + R); bg.gain.exponentialRampToValueAtTime(.0001, t + R + 1);
        bo.connect(bg); bg.connect(dst); bo.start(t + R); bo.stop(t + R + 1.1);
        const cn = ac.createBufferSource(), cf = ac.createBiquadFilter(), cg = ac.createGain();
        cn.buffer = nb; cf.type = 'highpass'; cf.frequency.value = 2500;
        cg.gain.setValueAtTime(.3, t + R); cg.gain.exponentialRampToValueAtTime(.0001, t + R + 1.4);
        cn.connect(cf); cf.connect(cg); cg.connect(dst); cn.start(t + R, 1); cn.stop(t + R + 1.5);
        // a bold brass-like chord (D major) that rings out over the name banner
        [146.8, 220, 293.7, 370, 440].forEach((f, i) => {
          const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t + R + .05); lp.frequency.exponentialRampToValueAtTime(700, t + R + 1.6);
          g.gain.setValueAtTime(.0001, t + R + .05); g.gain.exponentialRampToValueAtTime(.03, t + R + .1); g.gain.exponentialRampToValueAtTime(.0001, t + R + 1.8 + i * .05);
          o.connect(lp); lp.connect(g); g.connect(dst); o.start(t + R + .05); o.stop(t + R + 2);
        });
      } catch (e) { /* audio hiccup */ }
    }
    return { unlock, play, attack, damage, legendIntro, ctx: () => ac };
  })();
  document.addEventListener('pointerdown', Sound.unlock, { capture: true });

  // ======================= music =======================
  // Home: an original, cozy loop. Dungeon and boss fights keep their chiptune themes.
  const Music = (() => {
    const NOTE = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); const i = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0); return 440 * Math.pow(2, (i + (+m[3] + 1) * 12 - 69) / 12); };

    // ---- Home: cozy — a plucked harp/guitar arpeggio, a warm pad, round bass, a light shaker and a soft
    //      flute-like melody with a music-box sparkle (16 bars at 80 bpm, ~48 s) ----
    // chords: [bass root, voicing for the arpeggio and pad]
    const H_CH = {
      Cadd9: ['C3', ['C4', 'E4', 'G4', 'D5']], Em7: ['E2', ['G3', 'B3', 'D4', 'E4']], Fmaj7: ['F2', ['F3', 'A3', 'C4', 'E4']],
      Gsus: ['G2', ['G3', 'C4', 'D4', 'G4']], Am7: ['A2', ['A3', 'C4', 'E4', 'G4']], Dm7: ['D3', ['D4', 'F4', 'A4', 'C5']],
      G7: ['G2', ['G3', 'B3', 'D4', 'F4']], C: ['C3', ['C4', 'E4', 'G4', 'C5']],
    };
    const H_BARS = ['Cadd9', 'Em7', 'Fmaj7', 'Gsus', 'Cadd9', 'Am7', 'Dm7', 'G7', 'Fmaj7', 'Em7', 'Am7', 'Cadd9', 'Dm7', 'Fmaj7', 'Gsus', 'C'];
    // melody: [note, length in eighths], 8 eighths per bar
    const H_MEL = [
      ['E4', 2], ['G4', 2], ['C5', 3], ['D5', 1],   ['E5', 4], ['D5', 2], ['B4', 2],
      ['C5', 3], ['A4', 1], ['F4', 2], ['A4', 2],   ['G4', 6], [null, 2],
      ['E4', 2], ['G4', 2], ['C5', 2], ['E5', 2],   ['D5', 3], ['C5', 1], ['A4', 4],
      ['F4', 2], ['A4', 2], ['D5', 2], ['C5', 2],   ['B4', 6], [null, 2],
      ['A4', 2], ['C5', 2], ['F5', 3], ['E5', 1],   ['D5', 2], ['E5', 2], ['G4', 4],
      ['C5', 2], ['E5', 2], ['D5', 2], ['C5', 2],   ['G4', 6], [null, 2],
      ['F4', 2], ['A4', 2], ['C5', 2], ['D5', 2],   ['E5', 3], ['D5', 1], ['C5', 4],
      ['D5', 2], ['C5', 1], ['D5', 1], ['B4', 4],   ['C5', 6], [null, 2],
    ];
    const H8 = 60 / 80 / 2; // eighth note at 80 bpm

    // ---- Dungeon: a slow, cozy minor-key cave tune with soft echoing drips (16 bars at 66 bpm, ~58 s) ----
    const D_MEL = [
      ['A4', 3], ['C5', 1], ['E5', 4],  ['D5', 2], ['C5', 2], ['B4', 4],
      ['G4', 3], ['B4', 1], ['D5', 4],  ['C5', 2], ['B4', 2], ['A4', 4],
      ['F4', 2], ['A4', 2], ['C5', 4],  ['B4', 2], ['G4', 2], ['E4', 4],
      ['A4', 2], ['B4', 2], ['C5', 2], ['E5', 2], ['D5', 6], [null, 2],
      ['E5', 3], ['D5', 1], ['C5', 4],  ['D5', 2], ['E5', 2], ['G5', 4],
      ['F5', 3], ['E5', 1], ['D5', 4],  ['C5', 2], ['B4', 2], ['G4', 4],
      ['A4', 2], ['C5', 2], ['F5', 4],  ['E5', 2], ['C5', 2], ['B4', 4],
      ['C5', 2], ['B4', 2], ['G4', 2], ['B4', 2], ['A4', 6], [null, 2],
    ];
    const D_CH = { Am: ['A2', ['A3', 'C4', 'E4']], G: ['G2', ['G3', 'B3', 'D4']], F: ['F2', ['F3', 'A3', 'C4']], Em: ['E2', ['E3', 'G3', 'B3']], C: ['C3', ['C4', 'E4', 'G4']], Dm: ['D3', ['D4', 'F4', 'A4']] };
    const D_BARS = ['Am', 'Am', 'G', 'Am', 'F', 'Em', 'Am', 'Em', 'C', 'G', 'Dm', 'Em', 'F', 'Am', 'Em', 'Am'];
    const D8 = 60 / 66 / 2;

    // ---- Boss: a driving, tense battle loop (8 bars at 148 bpm, ~13 s) ----
    const B_MEL = [
      ['E5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['A5', 2], ['G5', 1], ['F#5', 1],
      ['E5', 1], ['D5', 1], ['E5', 2], ['B4', 4],
      ['C5', 1], ['C5', 1], ['E5', 1], ['C5', 1], ['G5', 2], ['F#5', 1], ['E5', 1],
      ['D5', 1], ['C5', 1], ['D5', 2], ['B4', 2], ['D#5', 2],
      ['E5', 1], ['E5', 1], ['G5', 1], ['E5', 1], ['B5', 2], ['A5', 1], ['G5', 1],
      ['F#5', 1], ['G5', 1], ['A5', 2], ['G5', 2], ['F#5', 2],
      ['E5', 2], ['C5', 2], ['A4', 2], ['C5', 2],
      ['B4', 2], ['D#5', 2], ['F#5', 2], ['B5', 2],
    ];
    const B_BARS = ['E2', 'E2', 'C2', 'D2', 'E2', 'D2', 'A1', 'B1'];
    const B8 = 60 / 148 / 2;

    // ---- Legendary: an epic, heroic battle anthem in D minor — power-chord stabs, timpani, snare rolls
    //      and a soaring brass lead (16 bars at 156 bpm, ~25 s) ----
    const L_CH = {
      Dm: ['D2', ['D4', 'F4', 'A4']], Bb: ['A#1', ['A#3', 'D4', 'F4']], C: ['C2', ['C4', 'E4', 'G4']],
      Gm: ['G1', ['G3', 'A#3', 'D4']], A: ['A1', ['A3', 'C#4', 'E4']], F: ['F1', ['F3', 'A3', 'C4']],
    };
    const L_BARS = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Bb', 'C', 'Dm', 'F', 'Gm', 'Bb', 'A', 'A'];
    const L_MEL = [
      ['D5', 3], ['A4', 1], ['D5', 2], ['E5', 2],   ['F5', 4], ['E5', 2], ['D5', 2],
      ['F5', 3], ['G5', 1], ['F5', 2], ['D5', 2],   ['E5', 6], ['C5', 2],
      ['D5', 2], ['F5', 2], ['A5', 4],              ['G5', 2], ['F5', 2], ['E5', 2], ['F5', 2],
      ['G5', 3], ['A#5', 1], ['A5', 2], ['G5', 2],  ['A5', 4], ['G5', 2], ['E5', 2],
      ['F5', 3], ['D5', 1], ['A#4', 2], ['D5', 2],  ['E5', 3], ['C5', 1], ['G5', 4],
      ['A5', 3], ['F5', 1], ['D5', 2], ['A5', 2],   ['C6', 4], ['A5', 2], ['F5', 2],
      ['A#5', 3], ['A5', 1], ['G5', 2], ['D5', 2],  ['F5', 3], ['G5', 1], ['A#5', 4],
      ['A5', 4], ['C#6', 2], ['E6', 2],             ['D6', 6], [null, 2],
    ];
    const L8 = 60 / 156 / 2;

    let track = 'town', cur = 'town', switching = 0;
    let master = null, filt = null, timer = null, next = 0, step = 0, melIdx = 0, melLeft = 0;
    const want = () => ST().settings.music !== false && vol() > 0 && !document.hidden;
    const vol = () => masterVol() * pct('musicVol', 60);
    function tone(type, f, t, d, vol, dest) {
      const ac = Sound.ctx(), o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .015);
      g.gain.exponentialRampToValueAtTime(vol * .55, t + Math.min(.18, d * .5)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + .05);
    }
    // a cave drip: a short high ping that echoes away
    function drip(t, dest) {
      const f = 1400 + Math.random() * 900;
      for (let k = 0; k < 3; k++) tone('sine', f * (1 - k * .02), t + k * .28, .12, .03 * Math.pow(.45, k), dest);
    }
    // a soft drum hit for the boss theme (pitch-dropping triangle)
    function kick(t, dest, v) {
      const ac = Sound.ctx(), o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .16);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + .2);
    }
    // ---- cozy instruments ----
    /** a plucked string (harp / nylon guitar): a bright attack that rings out */
    function pluck(ac, f, t, v, dest) {
      for (const [type, m, vv, d] of [['triangle', 1, v, 1.1], ['sine', 2, v * .25, .45]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f * m;
        g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vv, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + d);
        o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + .05);
      }
    }
    /** a warm pad note that swells in and fades out */
    function pad(ac, f, t, d, v, dest) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + d * .35); g.gain.linearRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + .05);
    }
    /** a soft flute-like note with a gentle vibrato that comes in after the attack */
    function flute(ac, f, t, d, v, dest) {
      const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine'; o.frequency.value = f;
      lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(10, t + Math.min(.5, d * .6));   // cents
      lfo.connect(lg); lg.connect(o.detune);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .07);
      g.gain.setValueAtTime(v, t + Math.max(.08, d - .15)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + d + .05); lfo.start(t); lfo.stop(t + d + .05);
    }
    let nbuf = null;
    function noiseSrc(ac) {
      if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const n = ac.createBufferSource(); n.buffer = nbuf; return n;
    }
    /** a short burst of filtered noise (the shaker) */
    function noiseHit(ac, t, d, v, type, freq, dest, q = .7) {
      const n = noiseSrc(ac), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      n.connect(f); f.connect(g); g.connect(dest); n.start(t, Math.random() * .4); n.stop(t + d + .02);
    }
    /** a very soft, round kick */
    function softKick(ac, t, dest, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + .15);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .22);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + .25);
    }
    const ARP = [0, 1, 2, 3, 2, 1, 2, 3];   // the arpeggio's path through the chord, one note per eighth
    function stepHome(ac) {
      const bar = Math.floor(step / 8) % H_BARS.length, beat = step % 8, [root, voicing] = H_CH[H_BARS[bar]], t = next;
      if (melLeft <= 0) {
        const [n, len] = H_MEL[melIdx]; melIdx = (melIdx + 1) % H_MEL.length; melLeft = len;
        if (n) {
          flute(ac, NOTE(n), t, len * H8 * .98, .06, filt);
          if (len >= 3) pluck(ac, NOTE(n) * 2, t, .012, filt);           // music-box sparkle on the longer notes
        }
      }
      melLeft--;
      pluck(ac, NOTE(voicing[ARP[beat]]), t, beat === 0 ? .04 : .028, filt);   // gentle arpeggio
      if (beat === 0) voicing.slice(0, 3).forEach(n => pad(ac, NOTE(n), t, H8 * 8.3, .012, filt));   // warm pad
      if (beat === 0) tone('sine', NOTE(root), t, H8 * 3.5, .15, filt);                               // round bass
      if (beat === 4) tone('sine', NOTE(root) * 1.5, t, H8 * 3, .1, filt);
      if (beat === 0) softKick(ac, t, master, .12);
      noiseHit(ac, t, .05, beat % 2 ? .009 : .005, 'highpass', 5500, master);                         // light shaker
      next += H8; step = (step + 1) % (H_BARS.length * 8);
    }
    function stepDungeon(ac) {
      const bar = Math.floor(step / 8) % D_BARS.length, beat = step % 8, [root, tri] = D_CH[D_BARS[bar]];
      if (melLeft <= 0) {
        const [n, len] = D_MEL[melIdx]; melIdx = (melIdx + 1) % D_MEL.length; melLeft = len;
        if (n) { tone('triangle', NOTE(n), next, len * D8 * 1.1, .07, filt); tone('sine', NOTE(n) * 2, next + D8 * .75, len * D8 * .8, .012, filt); }
      }
      melLeft--;
      if (beat === 0) tone('sine', NOTE(root), next, D8 * 7.5, .14, filt);                 // long, warm bass
      if (beat === 0) tri.forEach(n => tone('sine', NOTE(n), next, D8 * 7.8, .018, filt));  // soft pad
      if (beat % 2 === 1) tone('sine', NOTE(tri[[0, 2, 1, 2][(beat >> 1) % 4]]) * 2, next, D8 * 1.4, .02, filt); // music-box twinkle
      if (Math.random() < .07) drip(next + Math.random() * D8, filt);
      next += D8; step = (step + 1) % (D_BARS.length * 8);
    }
    function stepBoss(ac) {
      const bar = Math.floor(step / 8) % B_BARS.length, beat = step % 8, root = NOTE(B_BARS[bar]);
      if (melLeft <= 0) {
        const [n, len] = B_MEL[melIdx]; melIdx = (melIdx + 1) % B_MEL.length; melLeft = len;
        if (n) tone('square', NOTE(n), next, len * B8 * .9, .04, filt);
      }
      melLeft--;
      tone('sawtooth', root * (beat % 2 ? 2 : 1), next, B8 * .8, .05, filt);                // chugging eighth-note bass
      if (beat === 0 || beat === 3 || beat === 4) kick(next, filt, .22);
      if (beat === 2 || beat === 6) tone('square', 3000 + Math.random() * 800, next, .03, .012, filt); // hi-hat tick
      if (beat === 0) tone('square', root * 4, next, B8 * 7, .012, filt);                   // tense high drone
      next += B8; step = (step + 1) % (B_BARS.length * 8);
    }
    /** a brassy lead: two detuned saws through a filter that opens on the attack */
    function brass(ac, f, t, d, v, dest) {
      const lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(2800, t + .06); lp.frequency.exponentialRampToValueAtTime(1300, t + Math.max(.1, d));
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .03); g.gain.setValueAtTime(v * .8, t + Math.max(.04, d - .08)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      lp.connect(g); g.connect(dest);
      for (const det of [-7, 7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + d + .05); }
    }
    function stepLegend(ac) {
      const bar = Math.floor(step / 8) % L_BARS.length, beat = step % 8, [root, tri] = L_CH[L_BARS[bar]], t = next, R0 = NOTE(root);
      if (melLeft <= 0) {
        const [n, len] = L_MEL[melIdx]; melIdx = (melIdx + 1) % L_MEL.length; melLeft = len;
        if (n) { brass(ac, NOTE(n), t, len * L8 * .95, .05, filt); tone('square', NOTE(n) / 2, t, len * L8 * .9, .012, filt); }
      }
      melLeft--;
      tone('sawtooth', R0 * (beat % 2 ? 2 : 1), t, L8 * .7, .055, filt);                          // galloping bass
      if (beat === 0 || beat === 3 || beat === 6) tri.forEach(n => tone('sawtooth', NOTE(n), t, L8 * (beat === 0 ? 1.6 : .8), .018, filt));   // power-chord stabs
      tone('sine', NOTE(tri[[0, 1, 2, 1][beat % 4]]) * 4, t, L8 * .6, .012, filt);                 // glittering arpeggio
      if (beat === 0 || beat === 4) { kick(t, filt, .3); tone('sine', R0 * 2, t, .35, .12, filt); } // timpani
      if (beat === 2 || beat === 6) noiseHit(ac, t, .12, .09, 'bandpass', 1800, master, 1.2);       // snare
      if (bar % 4 === 3 && beat >= 6) noiseHit(ac, t + L8 / 2, .08, .06, 'bandpass', 2000, master, 1.2);   // snare roll into the next phrase
      if (beat % 2) noiseHit(ac, t, .04, .012, 'highpass', 7000, master);                           // hi-hat
      if (bar % 8 === 0 && beat === 0) noiseHit(ac, t, 1.4, .05, 'highpass', 4500, master);         // cymbal crash
      next += L8; step = (step + 1) % (L_BARS.length * 8);
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
      if (track !== cur) {                                // fade out, then start the new tune from its first bar
        if (!switching) { switching = ac.currentTime + .6; master.gain.setTargetAtTime(0, ac.currentTime, .12); }
        if (ac.currentTime < switching) return;
        cur = track; switching = 0; step = 0; melIdx = 0; melLeft = 0; next = ac.currentTime + .05;
      } else switching = 0;
      if (cur === 'silent') { master.gain.setTargetAtTime(0, ac.currentTime, .15); return; }   // a hush before a legendary appears
      const P = Game.pet(), quiet = cur === 'town' && P && P.asleep;
      filt.frequency.setTargetAtTime(cur === 'dungeon' ? 1500 : cur === 'boss' ? 3200 : cur === 'legend' ? 4200 : 2600, ac.currentTime, .2);   // home: warm but clear
      master.gain.setTargetAtTime(vol() * (quiet ? .5 : cur === 'boss' || cur === 'legend' ? 1.1 : 1.2), ac.currentTime, .15);
      if (next < ac.currentTime) next = ac.currentTime + .1;
      const fn = cur === 'dungeon' ? stepDungeon : cur === 'boss' ? stepBoss : cur === 'legend' ? stepLegend : stepHome;
      while (next < ac.currentTime + .35) fn(ac);
    }
    function start() { if (!timer) timer = setInterval(() => { try { schedule(); } catch (e) { /* audio hiccup */ } }, 90); }
    /** pick the tune: 'town' (home), 'dungeon' (exploring), 'boss' (floor boss fight), 'legend' (legendary battle) or 'silent' */
    function set(name) { track = name; }
    return { start, set };
  })();
  document.addEventListener('pointerdown', () => { Sound.unlock(); Music.start(); }, { capture: true });

  // ======================= helpers =======================
  /** a pixel-art ground shadow: an oval built from square blocks the size of the sprite's pixels,
   *  with a darker core, so it matches the Pokémon above it instead of being a smooth blur */
  function pixelShadow(g, x, y, rx, ry, alpha, block) {
    const b = Math.max(1, Math.round(block));
    const cols = Math.max(3, Math.round(rx * 2 / b)), rows = Math.max(2, Math.round(ry * 2 / b));
    const x0 = Math.round(x - cols * b / 2), y0 = Math.round(y - rows * b / 2);
    // width of each row: a flattened oval that steps in at the ends, like classic handheld-game shadows
    const span = j => { const v = (j + .5) / rows * 2 - 1, h = Math.sqrt(Math.max(0, 1 - v * v * .55)) * cols / 2; return [Math.round(cols / 2 - h), Math.round(cols / 2 + h)]; };
    g.save();
    g.fillStyle = `rgba(0,0,0,${alpha * .7})`;
    for (let j = 0; j < rows; j++) { const [c0, c1] = span(j); if (c1 > c0) g.fillRect(x0 + c0 * b, y0 + j * b, (c1 - c0) * b, b); }
    // darker inner band, inset one block from the edge (classic pixel-art shading)
    g.fillStyle = `rgba(0,0,0,${alpha * .3})`;
    for (let j = 1; j < rows - 1 || (rows === 2 && j < 2); j++) {
      const [c0, c1] = span(j); if (c1 - c0 > 4) g.fillRect(x0 + (c0 + 2) * b, y0 + j * b, (c1 - c0 - 4) * b, rows === 2 ? b / 2 : b);
      if (rows === 2) break;
    }
    g.restore();
  }
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
    DPR = Math.min(3, window.devicePixelRatio || 1);   // full sharpness on 3× iPhone screens
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
  // the scene's lighting: full daylight while the Pokémon is awake, dimmed to night only while it sleeps
  // (dayPhase() still follows the clock for what the Pokémon says)
  function scenePhase() { const p = Game.pet(); return p && !p.egg && p.asleep ? 'night' : 'day'; }
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
  // a background bought in Options → Backgrounds (made on the Admin page), as an Image once it has loaded
  const shopBgImgs = {};
  // backgrounds that ship with the game (backgrounds/shop/): locked until bought in Options → Backgrounds
  const BUILTIN_BGS = [
    ['beach', 'Tropical Beach'], ['crystal-cavern', 'Crystal Cavern'], ['moonlit-forest', 'Moonlit Forest'],
    ['desert', 'Desert Dunes'], ['sky-kingdom', 'Sky Kingdom'], ['blossom', 'Blossom Grove'],
    ['savanna', 'Savanna'], ['snowy-woods', 'Snowy Woods'], ['volcano', 'Volcano'],
  ].map(([k, name]) => ({ id: 'pp-' + k, name, price: 5000, src: `backgrounds/shop/${k}.jpg`, thumb: `backgrounds/shop/thumb/${k}.jpg` }));
  function shopBgImage(id) {
    let im = shopBgImgs[id];
    if (!im) {
      im = shopBgImgs[id] = new Image();
      const own = BUILTIN_BGS.find(b => b.id === id);
      if (own) im.src = own.src;
      else Online.backgroundImage(id).then(url => { if (url) im.src = url; });   // one try per session (a deleted background just shows the classic one)
    }
    return im;
  }
  function drawCustomBg(scene, phase) {
    const cfg = typeof BACKGROUNDS !== 'undefined' ? BACKGROUNDS : null;
    const pick = ST().settings.bg;
    let im = null;
    if (pick && Game.ownsBackground(pick)) { im = shopBgImage(pick); if (!im.complete || !im.naturalWidth) im = null; }   // classic picture until it loads
    const file = !im && cfg && cfg.assign && (cfg.assign[scene] || cfg.assign.default);
    if (!im && !file) return false;
    if (!im) { im = bgImgs[file]; if (!im) { im = bgImgs[file] = new Image(); im.src = 'backgrounds/' + encodeURIComponent(file); } }
    if (!im.complete || !im.naturalWidth) return false;          // built-in scenery until it loads
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight); // cover the whole stage
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    cx.drawImage(im, (W - w) / 2, (H - h) * .5, w, h);            // centred, so the top of the scene isn't cut off
    V.bg = { x: (W - w) / 2, y: (H - h) * .5, w, h };              // where the picture landed (party stands on its back lawn)
    if (!cfg || cfg.night !== false) {
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
    // background Pokémon only walk, idle, sleep and hop: load just those, after the main has had a head start
    setTimeout(() => party.forEach(m => preloadSpecies(m.sp, m.shiny, ['Idle', 'Walk', 'Sleep', 'Hop'])), 1200);
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
    // they stay put when the chat box opens (only the main Pokémon rises above it)
    const fy = far ? Math.max(H * .3, bg.y + bg.h * (.43 + (p.depth - .62) * .5)) : H * p.depth;
    const x = far ? Math.max(bg.x, 0) + Math.min(bg.w, W) * (.18 + (p.x - .1) / .8 * .62) : p.x * W;
    const size = baseSize() * (far ? .55 : .85);
    // every party Pokémon shares one pixel size (snapped to whole device pixels), so their sprite
    // pixels line up and each species keeps its natural PMD size relative to the others
    const pxScale = Math.max(1, Math.round(baseSize() * (far ? 1.1 : 1.75) / 28 * DPR)) / DPR;
    const maxH = baseSize() * (far ? 2.45 : 3.6);
    pixelShadow(cx, x, fy, size * .8, size * .16, .14, pxScale);
    const sleeping = p.act === 'sleep', playing = p.act === 'play' && !p.moving;
    const pos = drawCreature(cx, p.sp, {
      x, y: fy, size, t: t + p.depth * 10, pxScale, maxH, dpr: DPR, shiny: p.shiny, sleep: sleeping, walking: p.moving, flip: p.flip,
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
      pixelShadow(cx, W / 2, fy, sz * .7, sz * .16, .18, sz / 10);
      const eggPx = Math.round(sz * 2.2 / 32) * 32 || 64, wob = ms < V.eggWobbleUntil ? Math.sin(t * 22) * .18 : Math.sin(t * 1.5) * .04;
      cx.save(); cx.translate(W / 2, fy - eggPx * .08); cx.rotate(wob);
      PX.draw(cx, `egg_${s.tier || 'common'}_${Math.min(2, p.taps)}`, 0, -eggPx * .45, eggPx);
      cx.restore();
      return;
    }
    const size = petSize();
    const x = V.x * W;
    pixelShadow(cx, x, fy, size * .85, size * .18, .18, size / 10);
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
      cx.fillStyle = '#fff'; cx.font = `800 ${Math.round(size * .35)}px "Nunito", system-ui, sans-serif`;
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
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = '800 17px "Nunito", system-ui, sans-serif';
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
    const phase = scenePhase();
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
    sub: $('#petSub'), avatar: $('#avatar'),
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
      els.sub.innerHTML = p.egg ? esc(`${TIER_LABEL[s.tier || 'common']} egg`) : `${p.name ? esc(s.name) + ' ' : ''}<span class="typ" style="background:${ELEMENTS[s.el].color}">${ELEMENTS[s.el].label}</span>`;
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
    document.querySelectorAll('#actions button').forEach(b => {
      const a = b.dataset.act;
      const off = (p.egg && a !== 'dex' && a !== 'party') || (asleep && a === 'explore');
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
    // removed by an admin: say so once, above the sign-in / new-username step
    const removed = o.removedMsg && (ph.startsWith('signin') || ph === 'username')
      ? `<p class="note-bad">${o.removedMsg === 'banned' ? 'This account was removed by an admin and can\'t play right now.' : 'Your account was deleted by an admin. You can start again as a new trainer.'}</p>` : '';
    if (removed && ph === 'username') Online.clearRemovedMsg();
    openSheet(`<div class="gate"><img class="gate-egg" src="${PX.url('egg_common_0')}" alt=""><h2>Welcome to Pocket Pals!</h2>${removed}${body}</div>`, { dialog: true, locked: true });
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
      <div class="btns"><button class="btn gold" id="wgCopy">{i:widget} Copy widget script</button></div>
      <h4 style="font-family:var(--pixel);margin:16px 0 6px">Mac desktop app</h4>
      <p class="muted" style="margin:0">The Pocket Pals desktop app (Mac or Windows) lets your Pokémon walk around your computer's desktop. When it asks for your key, paste this:</p>
      <div class="btns"><button class="btn alt" id="wgKey">{i:widget} Copy key for desktop app</button></div>
      <p class="muted" style="margin-top:10px">Keep the script to yourself: it has your private widget key. Tapping the widget opens the game.</p>
      <p class="muted">Android: widgets need an installed app, so for now add the game to your home screen from Chrome's ⋮ menu → <b>Add to Home screen</b>.</p>`);
    $('#wgKey').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(token); toast('Key copied! Paste it into the Pocket Pals desktop app.', 3500); }
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
      Install.suggestAfterStarter(SPECIES_BY_ID[+b.dataset.st].name);
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
    if (bagTab === 'shop') return openShop();
    if (!guard()) return;
    const p = Game.pet(), s = Game.sp();
    const known = p.berryKnown;
    openSheet(head('Feed') + `<div class="foods">
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
  // PC Box sort order (remembered on this device)
  const BOX_SORTS = [['fav', '★ Favorites first'], ['recent', 'Recent catch'], ['older', 'Older catch'], ['az', 'A–Z'], ['level', 'High Lv → Low']];
  let boxSort = (() => { try { return localStorage.getItem('pocketpal.boxSort') || 'recent'; } catch (e) { return 'recent'; } })();
  function sortedBox() {
    const when = m => m.receivedAt || m.hatchedAt || 0;   // when it joined you (hatched, caught or traded)
    const list = Game.box().map((m, i) => ({ m, i }));
    const by = {
      recent: (a, b) => (when(b.m) - when(a.m)) || (b.i - a.i),
      older: (a, b) => (when(a.m) - when(b.m)) || (a.i - b.i),
      az: (a, b) => memberName(a.m).localeCompare(memberName(b.m)) || (a.i - b.i),
      level: (a, b) => (Game.memberLevel(b.m) - Game.memberLevel(a.m)) || memberName(a.m).localeCompare(memberName(b.m)),
      fav: (a, b) => (!!b.m.fav - !!a.m.fav) || (when(b.m) - when(a.m)) || (b.i - a.i),   // starred ones first, then newest
    }[boxSort] || (() => 0);
    return list.sort(by);
  }
  /** a small, clean menu for one Pokémon: portrait + name, one or two clear actions, a favorite star,
   *  and a quiet "Release" link at the bottom. Closing (✕ or tapping outside) goes back via onClose. */
  function monMenu({ m, meta, note, actions = [], fav = null, danger = null, onClose }) {
    const face = portraitUrl(m.sp, m.shiny, 'Normal');
    const pic = face ? `<img class="mm-face" src="${face}" alt="">` : miniCanvas(m.sp, { px: 72, shiny: m.shiny });
    openSheet(`<div class="mm">
      <button class="mm-x" data-mmx aria-label="Close">✕</button>
      <div class="mm-top">${pic}<div class="mm-id"><h2>${m.shiny ? '{i:sparkle}' : ''}${esc(memberName(m))}</h2><small>${meta}</small>${note ? `<span>${note}</span>` : ''}</div></div>
      <div class="mm-acts">${fav ? `<button class="mm-fav ${fav.on ? 'on' : ''}" data-mmfav aria-label="${fav.on ? 'Remove from favorites' : 'Add to favorites'}" title="Favorite">{i:star}</button>` : ''}
        <div class="mm-main">${actions.map((a, k) => `<button class="btn ${a.cls || ''}" data-mma="${k}">${a.label}</button>`).join('')}</div></div>
      ${danger ? `<button class="mm-danger" data-mmdanger>${danger.label}</button>` : ''}
    </div>`, { dialog: true });
    sheet.querySelector('[data-mmx]').addEventListener('click', () => { closeSheet(); onClose && onClose(); });
    sheet.querySelectorAll('[data-mma]').forEach(el => el.addEventListener('click', () => { closeSheet(); actions[+el.dataset.mma].fn(); }));
    const fb = sheet.querySelector('[data-mmfav]'); if (fb) fb.addEventListener('click', () => fav.fn());
    const db = sheet.querySelector('[data-mmdanger]'); if (db) db.addEventListener('click', () => { closeSheet(); danger.fn(); });
  }
  function openParty() {
    const p = Game.pet(), party = Game.party();
    const needBar = m => {
      if (m.egg) return '';
      const v = Math.min(m.food, m.joy, m.ene, m.hyg), col = v > 50 ? 'var(--hp-hi)' : v > 20 ? 'var(--hp-mid)' : 'var(--hp-lo)';
      return `<div class="mini"><i style="width:${v}%;background:${col}"></i></div>`;
    };
    // which Pokémon friends can borrow as their explore Backup (only matters once you're signed in)
    const lending = ON().enabled && ON().profile, hk = Game.helperKey();
    const isHelper = m => lending && !m.egg && m.key && m.key === hk;
    // one clean row per Pokémon: tap it for its options
    const slot = (m, i, isMain) => {
      const s = SPECIES_BY_ID[m.sp];
      const face = !m.egg && portraitUrl(m.sp, m.shiny, m.joy < 25 ? 'Sad' : 'Normal');
      const pic = m.egg ? `<img class="face" src="${PX.url(`egg_${s.tier || 'common'}_${Math.min(2, m.taps || 0)}`)}" alt="">` : face ? `<img class="face" src="${face}" alt="">` : miniCanvas(m.sp, { px: 56, shiny: m.shiny });
      const badges = (isMain ? '<i class="pb main">Main</i>' : '') + (isHelper(m) ? '<i class="pb helper">Helper</i>' : '') + (m.locked ? '<i class="pb lock">Trading</i>' : '');
      return `<button class="prow ${isMain ? 'main' : ''}" data-pm="${i}">${pic}<span class="pi"><b>${m.egg ? 'Egg' : esc(memberName(m))}${m.shiny && !m.egg ? '{i:sparkle}' : ''}</b>
        <small>${m.egg ? 'Waiting to hatch' : `${ELEMENTS[s.el].label} · Lv ${Game.memberLevel(m)}`}</small>${needBar(m)}</span>
        <span class="pbs">${badges}</span><span class="chev" aria-hidden="true">›</span></button>`;
    };
    const roomInParty = party.length + 1 < Game.PARTY_MAX;
    // the PC Box is a grid, three to a row; tap one to move it to the party or release it
    const boxSlot = (m, i) => {
      const s = SPECIES_BY_ID[m.sp], face = portraitUrl(m.sp, m.shiny, 'Normal');
      return `<button class="boxtile ${m.locked ? 'locked' : ''}" data-box="${i}">${face ? `<img class="face" src="${face}" alt="">` : miniCanvas(m.sp, { px: 56, shiny: m.shiny })}
        <b>${esc(memberName(m))}</b><small>Lv ${Game.memberLevel(m)} · ${ELEMENTS[s.el].label}</small>
        ${m.shiny ? '<span class="boxshiny">{i:sparkle}</span>' : ''}${m.fav ? '<span class="boxfav">{i:star}</span>' : ''}${m.locked ? '<span class="boxlock">{i:lock}</span>' : ''}</button>`;
    };
    const empties = Math.max(0, Game.PARTY_MAX - 1 - party.length);
    openSheet(head('Party') + `<p class="muted" style="margin-top:0">Up to ${Game.PARTY_MAX} Pokémon. Tap a Pokémon for options. Resting Pokémon don't get hungry or tired.</p>
      <div class="partylist">${p ? slot(p, -1, true) : ''}${party.map((m, i) => slot(m, i, false)).join('')}${'<div class="prow empty">Empty slot</div>'.repeat(empties)}</div>
      ${Game.box().length ? `<h4 style="font-family:var(--pixel);margin:18px 0 4px">PC Box (${Game.box().length})</h4><p class="muted" style="margin:0 0 8px">Tap a Pokémon to move it to your party or release it.</p>
        <label class="boxsortsel"><span>Sort by</span><select id="boxSortSel">${BOX_SORTS.map(([k, l]) => `<option value="${k}" ${boxSort === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="boxgrid">${sortedBox().map(({ m, i }) => boxSlot(m, i)).join('')}</div>` : ''}`);
    // tapping a row opens a small menu with just the actions that make sense for it
    sheet.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.pm, isMain = i < 0, m = isMain ? Game.pet() : party[i]; if (!m) return;
      Sound.play('tap');
      if (m.egg) { toast('Hatch your egg first.'); return; }
      const nm = esc(memberName(m)), s = SPECIES_BY_ID[m.sp];
      if (m.locked) { toast(`${nm} is in a trade right now.`); return; }
      const acts = [];
      if (!isMain) acts.push({ label: '{i:arrow} Make main', cls: 'red', fn: () => {
        const pp = Game.pet(); if (!pp || pp.egg) { toast('Hatch your egg first, then you can switch.'); return openParty(); }
        doSwitch(i); openParty();
      } });
      if (lending && !isHelper(m)) acts.push({ label: '{i:friends} Lend to friends', cls: isMain ? 'red' : 'alt', fn: () => {
        Game.setHelper(m.key); Sound.play('medal'); Online.uploadSave(true).catch(() => {});
        toast(`{i:friends} Friends can now take ${nm} exploring!`); openParty();
      } });
      if (!isMain) acts.push({ label: 'Move to PC Box', cls: 'alt', fn: () => { Game.partyToBox(i); openParty(); } });
      const note = isMain ? 'Your main Pokémon' : isHelper(m) ? 'Resting · your friends can take it exploring' : 'Resting in your party';
      monMenu({ m, meta: `${ELEMENTS[s.el].label} · Lv ${Game.memberLevel(m)}`, note, actions: acts, onClose: openParty });
    }));
    const sortSel = sheet.querySelector('#boxSortSel');
    if (sortSel) sortSel.addEventListener('change', () => {
      boxSort = sortSel.value; try { localStorage.setItem('pocketpal.boxSort', boxSort); } catch (e) {}
      const y = sheet.scrollTop; openParty(); sheet.scrollTop = y;   // keep your place in the list
    });
    sheet.querySelectorAll('[data-box]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.box, m = Game.box()[i]; if (!m) return;
      const s = SPECIES_BY_ID[m.sp];
      if (m.locked) { toast(`${memberName(m)} is in a trade right now.`); return; }
      const nm = esc(memberName(m));
      Sound.play('tap');
      const show = () => monMenu({
        m, meta: `${ELEMENTS[s.el].label} · Lv ${Game.memberLevel(m)}`, note: 'Resting in your PC Box',
        actions: [{ label: '{i:pokeball} Add to party', cls: 'red', fn: () => { if (!roomInParty) { toast('Your party is full.'); return openParty(); } Game.boxToParty(i); Sound.play('tap'); openParty(); } }],
        fav: { on: !!m.fav, fn: () => { m.fav = !m.fav; Game.save(); Sound.play(m.fav ? 'medal' : 'tap'); show(); } },
        danger: { label: 'Release', fn: () => dialog(`Release ${nm}?`, `${m.fav ? 'It\'s one of your favorites! ' : ''}${nm} goes back to the wild. This can't be undone.`, [
          { label: 'Cancel', cls: 'alt', fn: show },
          { label: 'Release', cls: 'red', fn: () => { Game.releaseBox(i); toast(`${nm} went back to the wild.`); openParty(); } },
        ]) },
        onClose: openParty,
      });
      show();
    }));
    sheet.querySelectorAll('[data-sw]').forEach(b => b.addEventListener('click', () => {   // stays on the Party tab
      const pp = Game.pet();
      if (!pp || pp.egg) { toast('Hatch your egg first, then you can switch.'); return; }
      doSwitch(+b.dataset.sw); openParty();
    }));
    sheet.querySelectorAll('[data-tobox]').forEach(b => b.addEventListener('click', () => { Game.partyToBox(+b.dataset.tobox); openParty(); }));
    sheet.querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => {
      const m = party[+b.dataset.rel];
      dialog(`Release ${esc(memberName(m))}?`, 'It goes back to the wild and is remembered under Companions in the Pokédex. This can\'t be undone.', [
        { label: 'Cancel', cls: 'alt', fn: () => openParty() },
        { label: 'Release', cls: 'red', fn: () => { Game.releaseMember(+b.dataset.rel); toast(`${memberName(m)} was released. Bye!`); openParty(); } },
      ]);
    }));
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
      const face = portraitUrl(p.sp, p.shiny, Game.lowest() < 25 ? 'Sad' : p.bond >= 60 ? 'Happy' : 'Normal');   // its portrait, like the Party list
      body = `<div class="hero">${face ? `<img class="portrait" src="${face}" alt="">` : miniCanvas(p.sp, { px: 104, shiny: p.shiny })}<div>
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
          <div class="row"><span>Personality</span><b>${Talk.natureLabel(p)}</b></div>
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
      const nextMs = [3, 7, 30, 100].find(x => x > S.player.streak);
      const end = S.player.lastEnd;
      body = `<div class="rows">
        <div class="row"><span>Dex</span><b>${Game.registeredCount()} / ${SPECIES.length}</b></div>
        <div class="row"><span>Shinies</span><b>${Game.shinyCount()} / ${SPECIES.length}</b></div>
        <div class="row"><span>Streak</span><b>{i:flame} ${S.player.streak} days (best ${S.player.bestStreak})</b></div>
        <div class="row"><span>Next milestone</span><b>${nextMs ? nextMs + ' days' : 'All reached!'}</b></div>
        <div class="row"><span>Evolution</span><b>${need == null ? (Game.evoMethods(p.sp).some(m => m.bond != null) ? `When its bond reaches ${Math.min(...Game.evoMethods(p.sp).filter(m => m.bond != null).map(m => m.bond))} (now ${p.bond || 0})` : Game.evoMethods(p.sp).length ? 'With an item' : 'Final form') : `At Lv ${need}${p.mistakes ? ` (+${p.mistakes} for slip-ups)` : ''}${Game.evoMethods(p.sp).filter(m => !m.item && m.time).length ? ' · ' + [...new Set(Game.evoMethods(p.sp).filter(m => !m.item && m.time).map(m => Evolution.SHORT[m.time]))].join(' / ') + ' only' : ''}`}</b></div>
        ${Game.evoMethods(p.sp).some(m => m.item) ? `<div class="row"><span>Items</span><b>${Game.evoMethods(p.sp).filter(m => m.item).map(m => `${ic(Game.ITEMS[m.item].icon)} ${Game.ITEMS[m.item].name}${m.time ? ` (${Evolution.SHORT[m.time]})` : ''}`).join(', ')}</b></div>` : ''}
        ${need == null ? '' : '<div class="row"><span>Also needs</span><b>Awake, every need ≥ 40</b></div>'}
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
      return `<button class="dexcell" data-dex="${s.id}"><span class="no">${String(s.of || s.id).padStart(4, '0')}</span>${sh ? ic('sparkle').replace('class="ic"', 'class="ic st"') : ''}${pic}<small>${reg ? esc(s.name) : '???'}</small></button>`;
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
    openSheet(head(`#${String(s.of || id).padStart(2, '0')} ${s.name}`) + `
      <div class="pair"><figure>${miniCanvas(id, { px: 120 })}Normal</figure><figure>${miniCanvas(id, { px: 120, shiny: true, sil: !hasShiny })}${hasShiny ? 'Shiny {i:sparkle}' : 'Shiny ???'}</figure></div>
      <div class="rows">
        <div class="row"><span>Element</span><b><span class="pill" style="background:${el.color}">${el.label}</span></b></div>
        <div class="row"><span>Egg rarity</span><b>${TIER_LABEL[SPECIES_BY_ID[s.lineBase].tier]}</b></div>
        <div class="row"><span>Evolves</span><b>${evoText(id) || 'Final form'}</b></div>
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
      <label class="toggle"><span><b>Master volume</b><small id="setMasterVolTxt">${S.settings.masterVol == null ? 100 : S.settings.masterVol}%</small></span><input type="range" id="setMasterVol" min="0" max="100" step="5" value="${S.settings.masterVol == null ? 100 : S.settings.masterVol}" style="width:150px;accent-color:#e3350d"></label>
      <label class="toggle"><span><b>Music</b><small>Cozy background tune</small></span><span class="sw"><input type="checkbox" id="setMusic" ${S.settings.music !== false ? 'checked' : ''}><i></i></span></label>
      <label class="toggle"><span><b>Music volume</b><small id="setMusicVolTxt">${S.settings.musicVol == null ? 60 : S.settings.musicVol}%</small></span><input type="range" id="setMusicVol" min="0" max="100" step="5" value="${S.settings.musicVol == null ? 60 : S.settings.musicVol}" style="width:150px;accent-color:#e3350d"></label>
      <label class="toggle"><span><b>Sound effects</b><small>Retro beeps and battle sounds</small></span><span class="sw"><input type="checkbox" id="setSound" ${S.settings.sound ? 'checked' : ''}><i></i></span></label>
      <label class="toggle"><span><b>Sound effects volume</b><small id="setSfxVolTxt">${S.settings.sfxVol == null ? 80 : S.settings.sfxVol}%</small></span><input type="range" id="setSfxVol" min="0" max="100" step="5" value="${S.settings.sfxVol == null ? 80 : S.settings.sfxVol}" style="width:150px;accent-color:#e3350d"></label>
      <div class="btns">${Online.state.enabled && Game.feature('codes') ? '<button class="btn gold" id="openCode">{i:sparkle} Redeem a code</button>' : ''}<button class="btn alt" id="openBgs">{i:image} Backgrounds</button><button class="btn alt" id="openOnline">{i:friends} Account &amp; friends</button><button class="btn alt" id="openWidget">{i:widget} Home-screen widget</button>${Install.available() ? '<button class="btn gold" id="openInstall">{i:up} Add to Home Screen</button>' : ''}<button class="btn alt" id="howTo">{i:book} How to play</button><button class="btn alt" id="openCredits">{i:credits} Credits</button><button class="btn alt" id="openCard">{i:card} Stat card</button>${REMOTE_SPRITES ? '' : '<a class="btn alt" href="dashboard.html" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box">{i:wrench} Sprite dashboard</a>'}<button class="btn red" id="resetBtn">Reset game</button></div>
      <p class="muted" style="margin-top:12px">Progress is saved in this browser. Add it to your home screen to play it like an app.</p>
      <p class="muted" style="margin-top:6px;text-align:center;font-size:12px;opacity:.75">Pocket Pals · Version ${esc(String(window.APP_VERSION || '?'))}${window.APP_BUILD ? ' · ' + esc(window.APP_BUILD) : ''}</p>`);
    $('#setSound').addEventListener('change', e => { S.settings.sound = e.target.checked; Game.save(); });
    $('#setMusic').addEventListener('change', e => { S.settings.music = e.target.checked; Game.save(); });
    $('#setMusicVol').addEventListener('input', e => { S.settings.musicVol = +e.target.value; $('#setMusicVolTxt').textContent = e.target.value + '%'; if (+e.target.value > 0 && S.settings.music === false) { S.settings.music = true; $('#setMusic').checked = true; } Game.save(); });
    $('#setMasterVol').addEventListener('input', e => { S.settings.masterVol = +e.target.value; $('#setMasterVolTxt').textContent = e.target.value + '%'; Game.save(); });
    $('#setSfxVol').addEventListener('input', e => { S.settings.sfxVol = +e.target.value; $('#setSfxVolTxt').textContent = e.target.value + '%'; if (+e.target.value > 0 && !S.settings.sound) { S.settings.sound = true; $('#setSound').checked = true; } Game.save(); });
    // let go of a slider: play a beep so you hear the new level
    ['#setMasterVol', '#setSfxVol'].forEach(id => $(id).addEventListener('change', () => Sound.play('tap')));
    $('#setPlayer').addEventListener('input', e => { S.settings.player = e.target.value.slice(0, 14); Game.save(); });
    $('#howTo').addEventListener('click', openManual);
    $('#openCredits').addEventListener('click', openCredits);
    if ($('#openInstall')) $('#openInstall').addEventListener('click', () => Install.start(openSettings));
    if ($('#openCode')) $('#openCode').addEventListener('click', openRedeem);
    $('#openOnline').addEventListener('click', () => openOnline());
    $('#openWidget').addEventListener('click', openWidget);
    $('#openBgs').addEventListener('click', openBackgrounds);
    $('#openCard').addEventListener('click', () => openCard());
    $('#resetBtn').addEventListener('click', () => dialog('Reset everything?', 'Your creature, Dex, streak and medals will be erased.', [
      { label: 'Cancel', cls: 'alt' },
      { label: 'Erase', cls: 'red', fn: () => { Game.reset(); V.anim = null; V.x = .5; startNewGame(); } },
    ]));
  }
  // ---------- backgrounds: buy once with Pokécoins, then switch any time ----------
  function openBackgrounds() {
    const S = ST(), list = BUILTIN_BGS.concat(Online.state.backgrounds || []), cur = S.settings.bg || '';
    const classic = typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.assign && BACKGROUNDS.assign.default ? 'backgrounds/' + encodeURIComponent(BACKGROUNDS.assign.default) : '';
    const card = (id, name, price, thumb) => {
      const owned = Game.ownsBackground(id), using = cur === id || (!id && !cur);
      return `<button class="bgcard ${using ? 'using' : ''} ${owned ? '' : 'locked'}" data-bg="${esc(id)}" data-price="${price}">
        <span class="bgwrap"><span class="bgthumb" style="${thumb ? `background-image:url('${thumb}')` : ''}"></span>${owned ? '' : '<span class="bglock">{i:lock}</span>'}</span>
        <b>${esc(name)}</b><span class="bgstate">${using ? '✓ Using' : owned ? 'Owned · tap to use' : `{i:coin}${price.toLocaleString()} · tap to unlock`}</span></button>`;
    };
    openSheet(head('Backgrounds') + `
      <div class="shophead">{i:image}<div><b>Backgrounds</b><small>Locked backgrounds unlock when you buy them. Buy once, keep forever, switch any time.</small></div>${coinsHtml()}</div>
      <div class="bggrid">${card('', 'Classic', 0, classic)}${list.map(b => card(b.id, b.name, b.price, b.thumb)).join('')}</div>
      <div class="btns"><button class="btn alt" id="bgBack">← Back to Options</button></div>`);
    $('#bgBack').addEventListener('click', openSettings);
    sheet.querySelectorAll('[data-bg]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.bg, price = +b.dataset.price, bg = list.find(x => x.id === id);
      if (Game.ownsBackground(id)) { Game.useBackground(id); Sound.play('tap'); toast(id ? `Now using ${bg ? bg.name : 'this background'}.` : 'Back to the classic scenery.'); return openBackgrounds(); }
      dialog(`Buy ${esc(bg ? bg.name : 'this background')}?`, `It costs ${price.toLocaleString()} Pokécoins, one time. You have ${Game.coins().toLocaleString()}.`, [
        { label: 'Not now', cls: 'alt', fn: openBackgrounds },
        { label: `{i:coin} Buy`, cls: 'gold', fn: () => {
          const r = Game.buyBackground(id, price);
          if (r.error) { toast(r.error); Sound.play('no'); return openBackgrounds(); }
          Sound.play('medal'); toast(`{i:image} ${bg ? bg.name : 'Background'} is yours! It's on now.`, 3500); openBackgrounds();
        } },
      ]);
    }));
  }

  // ---------- gift codes (event Pokémon set by the admin) ----------
  // ---------- add to the home screen ----------
  // Browsers never install a website without the player's tap, so the game offers it: on Android / Chrome / Edge
  // the Install button opens the browser's own install prompt; on iPhone / iPad (no prompt there) it shows the
  // Share → "Add to Home Screen" steps. The bar appears after a starter is chosen (or shortly after opening for
  // returning players), unless the game is already running from the home screen or the player recently closed it.
  const Install = (() => {
    const KEY = 'pp-install-dismissed', SNOOZE = 3 * 864e5;
    let evt = window.__ppInstall || null, bar = null, partner = '';
    const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const snoozed = () => { try { return Date.now() - (+localStorage.getItem(KEY) || 0) < SNOOZE; } catch (e) { return false; } };
    const available = () => !standalone() && (!!evt || ios);
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); evt = e; autoShow(); });
    window.addEventListener('appinstalled', () => { evt = null; hide(); toast('{i:sparkle} Pocket Pals is on your home screen!', 4000); });
    function hide() { if (bar) { bar.remove(); bar = null; } }
    function dismiss() { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} hide(); }
    function iosSteps(back) {
      openSheet(head('Add to Home Screen') + `
        <p class="muted" style="margin-top:0">Play Pocket Pals like an app — full screen, one tap from your home screen.</p>
        <ol class="installsteps">
          <li>Tap the <b>Share</b> button <span class="shareic" aria-hidden="true"></span> in Safari's toolbar${/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) ? ' (in Chrome it\'s at the top right)' : ''}.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. Pocket Pals appears on your home screen!</li>
        </ol>
        <div class="btns"><button class="btn alt" id="instBack">${back ? '← Back' : 'Got it'}</button></div>`);
      $('#instBack').addEventListener('click', () => (back ? back() : closeSheet()));
    }
    async function start(back) {
      if (evt) {
        const e = evt; evt = null; hide();
        try { e.prompt(); const r = await e.userChoice; if (r && r.outcome !== 'accepted') dismiss(); } catch (er) {}
        return;
      }
      if (ios) { hide(); iosSteps(back); return; }
      toast('Use your browser menu → "Install app" or "Add to Home screen".', 4500);
    }
    function show() {
      if (bar || !available()) return;
      bar = document.createElement('div'); bar.id = 'installBar';
      bar.innerHTML = icons(`<img src="icons/icon-192.png" alt=""><div class="ib"><b>${partner ? 'Keep ' + esc(partner) + ' on your Home Screen' : 'Add Pocket Pals to your Home Screen'}</b><small>Play it like an app, full screen</small></div>
        <button class="ibgo">${ios ? 'How?' : 'Install'}</button><button class="ibx" aria-label="Close">✕</button>`);
      bar.querySelector('.ibgo').addEventListener('click', () => start());
      bar.querySelector('.ibx').addEventListener('click', dismiss);
      document.body.appendChild(bar);
    }
    let timer = null;
    function autoShow() {
      if (!ST().player.starterPicked || snoozed() || standalone()) return;
      clearTimeout(timer); timer = setTimeout(show, 3500);
    }
    autoShow();
    return { available, start, show, suggestAfterStarter: name => { partner = name || ''; autoShow(); } };
  })();

  // ---------- credits ----------
  // ---------- developer mail: patch notes (patchnotes.js) + messages from the developer (Admin → Developer mail) ----------
  const PATCHES = (typeof window.PATCH_NOTES !== 'undefined' ? window.PATCH_NOTES : []).slice().sort((a, b) => b.version - a.version);
  const latestPatch = () => (PATCHES[0] ? PATCHES[0].version : 0);
  const devPosts = () => (Game.config.devmail || []);
  const latestDev = () => devPosts().reduce((m, p) => Math.max(m, p.at), 0);
  const mailUnread = () => {
    const S = ST().settings;
    return (latestPatch() > (S.seenPatch || 0)) || (latestDev() > (S.seenDevAt || 0));
  };
  function updateMailDot() { const b = $('#mailBtn'); if (b) b.classList.toggle('unread', mailUnread()); }
  function openMail() {
    const S = ST().settings, seenP = S.seenPatch || 0, seenD = S.seenDevAt || 0;
    const day = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? 0 : d.getTime(); };   // start of the day, so same-day developer posts sort above
    const fmt = ms => ms ? new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const items = PATCHES.map(p => ({ t: day(p.date), isNew: p.version > seenP, title: p.title || 'Update', meta: `v${p.version} · ${fmt(day(p.date))}`,
        body: `<ul>${(p.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>` }))
      .concat(devPosts().map(p => ({ t: p.at, isNew: p.at > seenD, title: 'Game developer', dev: true, meta: fmt(p.at),
        body: `<p class="devmsg">${esc(p.text).replace(/\n/g, '<br>')}</p>` })))
      .sort((a, b) => b.t - a.t)
      .slice(0, 5);                                    // only the 5 most recent
    openSheet(head('Game Patch Updates') + `<div class="mail">${items.length ? items.map((m, i) => `
      <details class="${m.dev ? 'dev' : ''}" ${i === 0 || m.isNew ? 'open' : ''}><summary><b>${m.dev ? '✉️ ' : ''}${esc(m.title)}</b>${m.isNew ? '<span class="new">NEW</span>' : ''}<small>${esc(m.meta)}</small></summary>${m.body}</details>`).join('')
      : '<p class="muted">No mail yet.</p>'}
      <p class="muted" style="text-align:center;font-size:12px">You're on version ${esc(String(window.APP_VERSION || '?'))}.</p></div>`);
    S.seenPatch = latestPatch(); S.seenDevAt = latestDev(); Game.save(); updateMailDot();
  }

  function openCredits() {
    const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    openSheet(head('Credits') + `
      <div class="credits">
        <p><b>Pocket Pals is a free, fan-made game.</b> It is not official and is not made, endorsed or supported by Nintendo, Creatures Inc., GAME FREAK or The Pokémon Company.</p>
        <p>Pokémon and all Pokémon character names, designs and related marks are © and ™ Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company. <b>All credit for Pokémon goes to The Pokémon Company</b> and its partners.</p>
        <h4>Pokémon sprites &amp; portraits</h4>
        <p>All Pokémon sprites and portraits come from the <b>PMD Sprite Collab</b> project, drawn by its many artists. Thank you to every contributor!<br>
          ${link('https://sprites.pmdcollab.org/#/Contributors', '{i:star} See all sprite &amp; portrait contributors')}</p>
        <h4>Data &amp; fonts</h4>
        <p>Pokémon evolution and stat data: ${link('https://pokeapi.co', 'PokéAPI')}.<br>
          Number font: Jersey 15 (SIL Open Font License). Pixelify Sans and Nunito from Google Fonts (SIL Open Font License).</p>
        <p class="muted">Made with love by fans, for fans. Please support the official Pokémon games!</p>
      </div>
      <div class="btns"><button class="btn alt" id="credBack">← Back</button></div>`);
    $('#credBack').addEventListener('click', openSettings);
  }
  function openRedeem() {
    const signedIn = !!(Online.state.user && Online.state.profile);
    openSheet(head('Redeem a code') + `
      <p class="muted" style="margin-top:0">Got a code from an event? Enter it to receive a special Pokémon or items. Each code works once per account.</p>
      ${signedIn ? '' : '<p class="muted"><b>Sign in first</b> under Options → Account &amp; friends.</p>'}
      <input id="codeIn" maxlength="24" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ENTER-CODE"
        style="width:100%;box-sizing:border-box;border:2px solid var(--line);border-radius:12px;padding:12px;font:inherit;font-family:var(--pixel);font-size:20px;text-align:center;letter-spacing:2px;text-transform:uppercase">
      <p class="muted" id="codeMsg" style="min-height:1.4em;text-align:center"></p>
      <div class="btns two"><button class="btn alt" id="codeBack">Back</button><button class="btn gold" id="codeGo" ${signedIn ? '' : 'disabled'}>Redeem</button></div>`);
    const inp = $('#codeIn'), go = $('#codeGo');
    $('#codeBack').addEventListener('click', openSettings);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') go.click(); });
    go.addEventListener('click', async () => {
      if (!inp.value.trim()) return;
      go.disabled = true; $('#codeMsg').textContent = 'Checking…';
      try {
        const r = await Online.redeemCode(inp.value);
        Sound.play('evolve');
        const mons = r.mons.map(m => `${m.shiny ? '{i:sparkle}' : ''}<b>${esc(m.name)}</b> (${m.where === 'party' ? 'joined your party' : 'sent to your PC Box'})`);
        const items = r.items.map(i => `{i:${Game.ITEMS[i.k].icon}} ${Game.ITEMS[i.k].name} ×${i.n}`);
        if (r.coins) items.push(`{i:coin} ${r.coins.toLocaleString()} Pokécoins`);
        dialog(icons(`{i:sparkle} ${esc(r.label)}`), icons((r.message ? esc(r.message) + '<br><br>' : '') + 'You received: ' + ([...mons, ...items].join(', ') || 'nothing this time') + '!'), [{ label: 'Yay!', cls: 'gold' }]);
      } catch (e) {
        Sound.play('no'); $('#codeMsg').textContent = e.message; go.disabled = false;
      }
    });
    setTimeout(() => inp.focus(), 50);
  }

  // ---------- admin announcement: shown once per new message ----------
  // Broadcasts (Admin → Announcement) pop up live; if a window is open, it waits until it's closed.
  let newsTimer = null;
  function showAnnouncement() {
    clearTimeout(newsTimer);
    const n = Game.config.news; if (!n || !ST().player.starterPicked || ST().settings.seenNewsId === n.id) return;
    if (!sheet.classList.contains('hidden')) { newsTimer = setTimeout(showAnnouncement, 4000); return; }
    ST().settings.seenNewsId = n.id; Game.save();
    Sound.play('medal');
    dialog(icons('{i:sparkle} News'), esc(n.text).replace(/\n/g, '<br>'), [{ label: 'OK', cls: 'gold' }]);
  }

  function openManual() {
    openSheet(head('How to play') + `<div class="manual">
      <h4>Time</h4><ul><li>1 real minute = 1 game minute. +1 level every hour.</li><li>It keeps living while the app is closed (up to 2 weeks of catch-up).</li></ul>
      <h4>Needs</h4><ul><li>FOOD −2/min, ENE −1/min, HYG −1/min (−4 more per poop), HAPPY −1/min (faster if hungry or dirty).</li><li>Letting a need drop to 10 or less is a <b>slip-up</b>: it delays evolution by 1 level and cools the bond.</li></ul>
      <h4>Care</h4><ul><li>{i:pecha}{i:aspear}{i:cheri} <b>Pecha, Aspear and Cheri Berries</b> +25 food. One is its hidden favourite (+35 food, +happy, bond).</li><li>{i:poffin} <b>Poffin</b> +food +happy but adds weight. Over 50 weight = sluggish.</li><li>{i:pokeball} <b>Poké Ball Catch</b> trains SPEED and burns weight. {i:rock} <b>Rock Smash</b> trains ATTACK. {i:shield} <b>Protect</b> trains DEFENCE.</li><li>{i:bath} <b>Bath</b> clears poops. {i:hand} <b>Tap</b> to pet it. {i:sleep} <b>Sleep</b> restores energy; needs drop much slower.</li></ul>
      <h4>Evolution</h4><ul><li>When it reaches its evolution level and every need is ≥ 40, a button appears — you choose to evolve or keep its form.</li></ul>
      <h4>Endings</h4><ul><li>{i:rain} <b>Run-away</b>: all needs at 0 for 1 hour. One act of care cancels it. Curses the next egg.</li><li>{i:hand} <b>Release</b>: hold your finger on it for 3 seconds.</li></ul>
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
    if (e.target.closest('#cerBtns button, #mailBtn')) return;
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
    if (a === 'bag') { if (!guard(false)) return; return openFeed('items'); }
    if (a === 'care') return openCare();
    if (a === 'explore') return openAdventure();
  }));
  function doBath() {
    if (!guard(false)) return;
    if (now() < V.bathUntil) return;
    V.bathUntil = now() + 2400; Sound.play('bath');
    const stinky = Game.pet().poops >= 2 || Game.pet().hyg < 30;
    setTimeout(() => { Game.clean(); if (!Game.pet().asleep) Talk.say(stinky ? 'bathStinky' : 'bath'); }, 1800);
  }
  function doLight() {
    if (!guard(false)) return;
    const r = Game.toggleSleep(); if (r.error) return;
    Sound.play(r.asleep ? 'sleep' : 'wake');
    Talk.say(r.asleep ? 'sleep' : Game.pet().ene < 50 ? 'wakeTired' : 'wake');
  }
  const optCard = (data, icon, title, desc, off) => `<button class="food${off ? ' dim' : ''}" ${data} style="grid-column:1/-1">${ic(icon).replace('class="ic"', 'class="px"')}<span><b>${title}</b><small>${desc}</small></span></button>`;
  // ---------- Care: feed, bath and sleep in one place ----------
  function openCare() {
    if (!guard(false)) return;
    const p = Game.pet(), asleep = p.asleep, v = k => Math.round(p[k]);
    openSheet(head('Care') + `<div class="foods">
      ${optCard('data-care="feed"', 'oran', 'Feed', asleep ? 'It\'s asleep — wake it up first' : `Berries &amp; Poffins · Food ${v('food')}`, asleep)}
      ${optCard('data-care="bath"', 'bath', 'Bath', `Wash up and clean the area · Hygiene ${v('hyg')}`)}
      ${optCard('data-care="light"', asleep ? 'wake' : 'sleep', asleep ? 'Wake up' : 'Sleep', asleep ? `Rise and shine · Energy ${v('ene')}` : `Lights out to refill energy · Energy ${v('ene')}`)}
      </div>`);
    sheet.querySelectorAll('[data-care]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.care;
      if (a === 'feed') { if (Game.pet().asleep) { toast(blockedMsg.asleep); Sound.play('no'); return; } return openFeed('berries'); }
      closeSheet();
      if (a === 'bath') doBath(); else doLight();
    }));
  }
  // ---------- Explore: dungeon or training ----------
  function openAdventure() {
    if (!guard()) return;
    const ex = Game.feature('explore'), tr = Game.feature('training');
    openSheet(head('Explore') + `<div class="foods">
      ${ex ? optCard('data-adv="dungeon"', 'map', 'Explore a dungeon', 'Battle wild Pokémon and find treasure') : ''}
      ${tr ? optCard('data-adv="training"', 'pokeball', 'Training', 'Mini-games that build ATK, DEF &amp; SPD') : ''}
      </div><p class="muted" style="margin-top:12px">${ex || tr ? 'These use some energy.' : 'Exploring and training are closed right now. Check back soon!'}</p>`);
    sheet.querySelectorAll('[data-adv]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.adv === 'training') return openGames();
      openMaps();
    }));
  }
  // ---------- Explore: pick a map (the maps are in maps.js; the admin can change their Pokémon in Admin → Explore maps) ----------
  const EXPLORE_MAP_UI = (typeof EXPLORE_MAP_DEFAULTS !== 'undefined' ? EXPLORE_MAP_DEFAULTS : [{ id: 'cave', name: 'Crystal Cave' }])
    .map(m => ({ id: m.id, name: m.name, src: m.src, thumb: m.thumb }));
  function openMaps() {
    EXPLORE_MAP_UI.forEach(m => { if (m.src) new Image().src = m.src; });   // start loading the big pictures now
    const MAPS = Game.EXPLORE_MAPS || {}, floors = Game.EXPLORE_MAX_FLOOR;
    const card = m => {
      const def = MAPS[m.id] || {}, types = def.types ? Object.keys(def.types) : null;
      const chips = types ? types.map(el => `<i style="background:${(ELEMENTS[el] || {}).color || '#777'}">${(ELEMENTS[el] || {}).label || el}</i>`).join('') : '<i class="all">All types</i>';
      const beast = def.beast && SPECIES_BY_ID[def.beast], chase = def.chase && def.chaseChance > 0 && SPECIES_BY_ID[def.chase];
      return `<button class="mapcard" data-map="${m.id}">
        <span class="mapimg" style="background-image:url('${m.thumb}')"></span><span class="mapshade"></span>
        <span class="mapboss">${def.noLegend ? 'No legendaries' : `{i:sparkle} ${beast ? `Rare boss: ${beast.name}` : 'Any legendary'}`}</span>
        <span class="mapinfo"><b class="mapname">${m.name}</b>${chase ? `<span class="mapchase">{i:star} Main chase: ${esc(chase.name)}</span>` : ''}<span class="mapchips">${chips}</span></span></button>`;
    };
    openSheet(head('Choose a map') + `
      <p class="mapsub">{i:map} ${floors} floors deep · battles, treasure and a boss at the bottom</p>
      <div class="maplist">${EXPLORE_MAP_UI.map(card).join('')}</div>
      <div class="btns"><button class="btn alt" id="mapBack">← Back</button></div>`);
    $('#mapBack').addEventListener('click', openAdventure);
    sheet.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => openTeam(b.dataset.map)));
  }
  // ---------- Explore: pick a team of two — a Main that explores and a Backup that takes over if it faints ----------
  function openTeam(mapId) {
    const main = Game.pet();
    const pool = [{ m: main, i: -1 }, ...Game.party().map((m, i) => ({ m, i }))].filter(x => x.m && !x.m.egg && !x.m.locked && SPECIES_BY_ID[x.m.sp]);
    const friendPool = () => friendPicks();
    let fpool = friendPool();
    if (pool.length < 2 && !fpool.length) { closeSheet(); return startExplore({ map: mapId }); }   // nobody to bring along
    // own Pokémon are pool[0..n-1]; friends' Pokémon follow at n.. (they can only be the Backup)
    const n = pool.length, all = () => pool.concat(fpool);
    const nm = x => x.friend ? x.c.name || SPECIES_BY_ID[x.c.sp].name : x.m.name || SPECIES_BY_ID[x.m.sp].name;
    const lv = x => x.friend ? x.c.level || 1 : x.i < 0 ? Game.level() : Game.memberLevel(x.m);
    const cfg = Game.config || {};
    const whyNot = x => x.friend ? 'friend' : x.m.asleep ? 'Asleep' : x.m.ene < (cfg.exploreEnergy || 0) ? 'Too tired' : x.m.food < 20 ? 'Too hungry' : '';
    let lead = 0, sub = n > 1 ? 1 : n, role = 'sub';   // no other Pokémon of your own: start with the first friend's
    if (sub >= all().length) sub = null;
    const render = () => {
      const A = all();
      const card = (x, k) => {
        const tag = k === lead ? '<em class="tl">MAIN</em>' : k === sub ? '<em class="ts">BACKUP</em>' : '', no = x.friend ? '' : whyNot(x);
        const sp = x.friend ? x.c.sp : x.m.sp, shiny = x.friend ? x.c.shiny : x.m.shiny;
        const sub2 = x.friend ? `Lv ${lv(x)} · ${esc(x.owner)}${x.rec === 'helper' ? '' : ' · {i:sparkle}new pick'}` : `Lv ${lv(x)}${no ? ` · ${no}` : ''}`;
        return `<button class="teamcard${k === lead ? ' lead' : k === sub ? ' sub' : ''}${x.friend ? ' friend' : ''}" data-k="${k}">${tag}${monFace(sp, shiny)}
          <b>${shiny ? '{i:sparkle}' : ''}${esc(nm(x))}</b><small>${sub2}</small></button>`;
      };
      const fsec = fpool.length ? `<h4 class="teamh">{i:friends} Friends' Pokémon <small>Backup only</small></h4>
        <div class="teamgrid">${fpool.map((x, j) => card(x, n + j)).join('')}</div>
        <p class="muted">Each friend lends you their helper. Already explored with it today? You'll get one of their other Pokémon instead.</p>` : '';
      openSheet(head('Choose your team') + `
        <p class="mapsub">Pick a <b>Main</b> to explore and a <b>Backup</b> who jumps in if the Main faints.</p>
        <div class="tabs"><button data-role="lead" class="${role === 'lead' ? 'on' : ''}">Main: ${esc(nm(A[lead]))}</button><button data-role="sub" class="${role === 'sub' ? 'on' : ''}">Backup: ${sub == null ? 'none' : esc(nm(A[sub]))}</button></div>
        <h4 class="teamh">Your Pokémon</h4>
        <div class="teamgrid">${pool.map(card).join('')}</div>
        ${fsec}
        <p class="muted">Tap a tab, then tap a Pokémon. Tap the Backup again to go without one.${pool[lead].i >= 0 ? ' Your Main becomes the Pokémon you look after at home.' : ''}</p>
        <div class="btns two"><button class="btn alt" id="teamBack">← Back</button><button class="btn red" id="teamGo">{i:map} Explore!</button></div>`);
      sheet.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { role = b.dataset.role; Sound.play('tap'); render(); }));
      sheet.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
        const k = +b.dataset.k, X = all()[k]; Sound.play('tap');
        if (role === 'lead') {
          if (X.friend) { toast('A friend\'s Pokémon can only come along as your Backup.'); Sound.play('no'); role = 'sub'; sub = k; return render(); }
          if (whyNot(X)) { toast(`${esc(nm(X))} can't lead: ${whyNot(X).toLowerCase()}.`); Sound.play('no'); return; }
          if (k === sub) sub = lead;
          lead = k; role = 'sub';
        } else if (k === sub) sub = null;
        else if (k === lead) { if (sub == null || sub >= n || whyNot(pool[sub])) { toast('Pick a different Pokémon as the Backup.'); return; } [lead, sub] = [sub, lead]; }
        else sub = k;
        render();
      }));
      $('#teamBack').addEventListener('click', openMaps);
      $('#teamGo').addEventListener('click', () => {
        const L = pool[lead], S2 = sub == null ? null : all()[sub];
        if (L.i >= 0 && !Game.switchMain(Game.party().indexOf(L.m))) { toast('Couldn\'t switch your Main right now.'); Sound.play('no'); return; }
        let subOpt = null;
        if (S2 && S2.friend) { Game.markBorrowed(S2.uid, S2.id); subOpt = { friend: true, card: S2.c, owner: S2.owner }; }
        else if (S2) subOpt = S2.m;
        closeSheet(); startExplore({ map: mapId, sub: subOpt });
      });
    };
    render();
    // friends may have changed their helper since you signed in: fetch their latest teams and refresh the list
    if (ON().enabled && ON().profile && ON().friends.length) {
      Promise.all(ON().friends.map(f => Online.friendTeam(f).then(sc => { if (sc) f.showcase = sc; }).catch(() => {}))).then(() => {
        if (!sheet.querySelector('#teamGo')) return;            // the picker was closed meanwhile
        const keep = sub != null && sub >= n ? all()[sub] : null;
        fpool = friendPool();
        if (keep) { const j = fpool.findIndex(x => x.uid === keep.uid && x.id === keep.id); sub = j >= 0 ? n + j : null; }
        const y = sheet.scrollTop; render(); sheet.scrollTop = y;
      });
    }
  }
  /** one recommended Pokémon per friend: their chosen helper, or — once you've explored with that today —
   *  a random other one from their team (the same pick all day, so it doesn't change every time you look) */
  function friendPicks() {
    const O = ON(); if (!O.enabled || !O.profile || !O.friends) return [];
    const used = Game.borrowedToday(), day = Math.floor(Date.now() / 864e5);
    const out = [];
    O.friends.forEach(f => {
      const sc = f.showcase; if (!sc) return;
      const cards = [sc.main, ...(sc.party || [])].filter(c => c && SPECIES_BY_ID[c.sp]).map((c, i) => Object.assign({}, c, { id: c.id || `${c.sp}-${i}` }));
      if (!cards.length) return;
      const done = new Set(used[f.uid] || []);
      const helper = sc.helper && SPECIES_BY_ID[sc.helper.sp] ? Object.assign({}, sc.helper, { id: sc.helper.id || `${sc.helper.sp}-h` }) : cards[0];
      let c = null, rec = 'helper';
      if (!done.has(helper.id)) c = helper;
      else {
        const rest = cards.filter(x => !done.has(x.id) && x.id !== helper.id);
        if (!rest.length) return;                                // you've explored with all of them today
        let h = 0; for (const ch of f.uid + day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        c = rest[h % rest.length]; rec = 'random';
      }
      out.push({ friend: true, c, id: c.id, uid: f.uid, owner: f.username || 'Friend', rec });
      preloadSpecies(c.sp, c.shiny);
    });
    return out;
  }
  $('#nameBtn').addEventListener('click', () => openCard());
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#mailBtn').addEventListener('click', () => { Sound.play('tap'); openMail(); });
  updateMailDot();

  // ======================= minigames =======================
  const arena = $('#arena'), acv = $('#arenaCanvas'), ac = acv.getContext('2d');
  let AW = 1, AH = 1, arenaGame = null;
  function openArena(title) {
    $('#arenaTitle').innerHTML = icons(esc(title)); arena.classList.remove('hidden');
    const r = acv.getBoundingClientRect(), d = Math.min(3, window.devicePixelRatio || 1);
    AW = r.width; AH = r.height; acv.width = AW * d; acv.height = AH * d; ac.setTransform(d, 0, 0, d, 0, 0);
  }
  function closeArena() { Music.set('town'); arena.classList.add('hidden'); $('#arenaPanel').classList.add('hidden'); arenaGame = null; }
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
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = 1 - pp.age * 2; ac.fillStyle = '#fff'; ac.font = '800 18px "Nunito", system-ui, sans-serif'; ac.fillText('+1', pp.x - 8, pp.y - pp.age * 60); ac.globalAlpha = 1; return pp.age < .5; });
      drawCreature(ac, p.sp, { x: dispX * AW, y: AH - size * .35, size, t, maxH: AH * .25, shiny: p.shiny, flip: d < -.002, walking: Math.abs(d) > .01, dir: Math.abs(d) > .01 ? undefined : 'front' });
      $('#arenaInfo').innerHTML = icons(`{i:pokeball}${G.score} &nbsp;${'{i:heart}'.repeat(Math.max(0, G.lives))}${'{i:heartEmpty}'.repeat(3 - Math.max(0, G.lives))} &nbsp;${Math.ceil(left / 1000)}s`);
      if (G.over) {
        ac.fillStyle = 'rgba(0,0,0,.45)'; ac.fillRect(0, 0, AW, AH);
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '800 28px "Nunito", system-ui, sans-serif';
        ac.fillText(`${G.score} caught!`, AW / 2, AH * .42);
        ac.font = '800 16px \"Nunito\", system-ui, sans-serif'; ac.fillText(`Speed training +${(G.result && G.result.spd) || 0}`, AW / 2, AH * .42 + 30); ac.textAlign = 'left';
      } else if (ms - G.t0 < 1800) {
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '800 16px \"Nunito\", system-ui, sans-serif';
        ac.fillText('Drag to catch the falling Poké Balls!', AW / 2, AH * .35); ac.textAlign = 'left';
      }
      requestAnimationFrame(G.loop);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- training games menu ----------
  function openGames() {
    if (!guard()) return;
    if (!Game.feature('training')) { toast('Training is closed right now. Check back soon!'); return; }
    const p = Game.pet();
    const card = (id, icon, title, stat, desc) => `<button class="food" data-game="${id}" style="grid-column:1/-1">${ic(icon).replace('class="ic"', 'class="px"')}<span><b>${title}</b><small>${stat} · ${desc}</small></span></button>`;
    openSheet(head('Training') + `<div class="foods">
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

  // ---------- premium training visuals (Rock Smash, Protect): chunky pixel scenery, debris, shake ----------
  // one scenery pixel = PXS (4) screen px; PXS is shared with the dungeon scenery below
  const sceneCache = {};
  const snap = v => Math.round(v / PXS) * PXS;
  /** paint(g, w, h) draws on a small w×h canvas once per arena size; it is scaled up without smoothing so it stays pixel art */
  function pixelScene(key, paint) {
    const w = Math.ceil(AW / PXS), h = Math.ceil(AH / PXS), id = `${key}_${w}x${h}`;
    if (!sceneCache[id]) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); sceneCache[id] = c; }
    ac.save(); ac.imageSmoothingEnabled = false; ac.drawImage(sceneCache[id], 0, 0, w * PXS, h * PXS); ac.restore();
  }
  // shared painting helpers for the small scenery canvas
  const seeded = seed => () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const sPx = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  function sEll(g, cx, cy, rx, ry, c) {
    g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  }
  /** vertical colour bands with a checker dither where two bands meet */
  function sBands(g, w, y0, y1, cols) {
    for (let y = y0; y < y1; y++) {
      const f = (y - y0) / Math.max(1, y1 - y0) * (cols.length - 1), i = Math.floor(f), t = f - i;
      for (let x = 0; x < w; x++) sPx(g, x, y, cols[Math.min(cols.length - 1, i + ((t > .75 || (t > .4 && (x + y) % 2 === 0)) ? 1 : 0))]);
    }
  }
  function sVignette(g, w, h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const e = Math.min(x, y, w - 1 - x, h - 1 - y); if (e < 4 && (x + y) % (e + 2) === 0) sPx(g, x, y, 'rgba(8,4,20,.4)'); }
  }
  function burst(G, x, y, colors, n = 14, power = 260, grav = 900) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = power * (.35 + Math.random() * .65);
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? power * .35 : 0), age: 0, life: .45 + Math.random() * .35, c: colors[i % colors.length], s: PXS * (Math.random() < .35 ? 2 : 1), g: grav });
    }
  }
  function drawParts(G, dt) {
    G.parts = G.parts.filter(q => {
      q.age += dt; if (q.age >= q.life) return false;
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      ac.globalAlpha = Math.min(1, 2 * (1 - q.age / q.life)); ac.fillStyle = q.c; ac.fillRect(snap(q.x), snap(q.y), q.s, q.s); ac.globalAlpha = 1;
      return true;
    });
  }
  function shake(G, ms) { const k = Math.max(0, G.shakeUntil - ms) / 200; if (k > 0) ac.translate(snap((Math.random() - .5) * 12 * k), snap((Math.random() - .5) * 12 * k)); }
  /** a gold pixel timer bar along the top of the arena (turns red near the end) */
  function timerBar(frac) {
    const x = 14, y = 12, w = AW - 28, h = 12, fw = Math.round(w * Math.max(0, Math.min(1, frac)) / PXS) * PXS;
    ac.fillStyle = '#1d1530'; ac.fillRect(x - 4, y - 4, w + 8, h + 8);
    ac.fillStyle = '#3a3358'; ac.fillRect(x, y, w, h);
    ac.fillStyle = frac < .2 ? '#ff5a5a' : '#f2c14e'; ac.fillRect(x, y, fw, h);
    ac.fillStyle = frac < .2 ? '#ffb0b0' : '#fff0b0'; ac.fillRect(x, y, fw, 4);
    ac.fillStyle = frac < .2 ? '#c42f3a' : '#c98a1e'; ac.fillRect(x, y + h - 4, fw, 4);
  }
  /** text with a thick dark outline, centred */
  function outlined(txt, x, y, px, fill = '#fff') {
    ac.font = `800 ${px}px "Nunito", system-ui, sans-serif`; ac.textAlign = 'center'; ac.fillStyle = '#1d1530';
    for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]]) ac.fillText(txt, x + dx, y + dy);
    ac.fillStyle = fill; ac.fillText(txt, x, y); ac.textAlign = 'left';
  }
  /** the end-of-game card: a gold-framed navy panel */
  function resultPanel(title, sub, cy) {
    ac.fillStyle = 'rgba(10,8,25,.55)'; ac.fillRect(0, 0, AW, AH);
    const w = snap(Math.min(AW - 40, 300)), h = 112, x = snap((AW - w) / 2), y = snap(cy - h / 2);
    ac.fillStyle = '#1d1530'; ac.fillRect(x - 4, y - 4, w + 8, h + 8);
    ac.fillStyle = '#f2c14e'; ac.fillRect(x, y, w, h);
    ac.fillStyle = '#c98a1e'; ac.fillRect(x, y + h - 4, w, 4);
    ac.fillStyle = '#2c2a66'; ac.fillRect(x + 8, y + 8, w - 16, h - 16);
    ac.fillStyle = '#3b3a8c'; ac.fillRect(x + 8, y + 8, w - 16, 8);
    [[x, y], [x + w - 8, y], [x, y + h - 8], [x + w - 8, y + h - 8]].forEach(([a, b]) => { ac.fillStyle = '#fff0b0'; ac.fillRect(a, b, 4, 4); });
    outlined(title, AW / 2, y + 52, 28, '#ffffff');
    outlined(sub, AW / 2, y + 86, 17, '#ffe27a');
  }
  // Rock Smash: a quarry floor with a strata wall, flagstones, moss and nine holes
  function paintQuarry(g, w, h, holes) {
    const r = seeded(11), wall = Math.round(h * .12);
    sBands(g, w, 0, h, ['#7d6248', '#735a42', '#69523c', '#5f4a36', '#544130']);
    const strata = ['#4a3d5c', '#5a4b6c', '#4f4262', '#3e3350'];
    for (let y = 0; y < wall; y++) for (let x = 0; x < w; x++) sPx(g, x, y, strata[(Math.floor((y + Math.round(Math.sin(x * .3 + y))) / 3) + 4) % strata.length]);
    for (let x = 0; x < w; x++) { const d = wall + Math.round(Math.sin(x * .45) * 1.5 + r()); for (let y = wall - 1; y <= d; y++) sPx(g, x, y, '#3e3350'); sPx(g, x, d + 1, '#2a2238'); }
    for (let y = 0; y < wall - 2; y++) for (let x = 0; x < w; x++) if (r() < .03) sPx(g, x, y, r() < .3 ? '#7fe3ff' : '#6d5d82');   // glints in the wall
    for (let i = 0; i < w * h / 26; i++) sPx(g, Math.floor(r() * w), wall + 2 + Math.floor(r() * (h - wall)), r() < .5 ? '#866a4e' : '#5a4532');   // soil grain
    for (let i = 0; i < w * h / 340; i++) {   // flat stones set in the ground: shadow, body, lit top edge
      const x = 2 + r() * (w - 4), y = wall + 4 + r() * (h - wall - 6), rx = 2 + r() * 3.5, ry = 1.2 + r() * 1.6, c = ['#9a8a78', '#8c7d6c', '#a89886'][Math.floor(r() * 3)];
      sEll(g, x + .5, y + .8, rx, ry, '#3f3024'); sEll(g, x, y, rx, ry, c); sEll(g, x - .4, y - .5, rx * .7, ry * .5, '#c2b4a2');
    }
    for (let i = 0; i < w * h / 60; i++) sPx(g, Math.floor(r() * w), wall + 3 + Math.floor(r() * (h - wall)), r() < .5 ? '#a8916f' : '#4a3a2b');
    for (let i = 0; i < w / 5; i++) { const x = Math.floor(r() * w), y = wall + 4 + Math.floor(r() * (h - wall - 4)); sPx(g, x, y, '#5f9a3e'); sPx(g, x + 1, y, '#6fb04a'); sPx(g, x, y - 1, '#8fd462'); }
    for (const s of holes) {
      const cx = s.x / PXS, cy = (s.y + 18) / PXS;
      sEll(g, cx, cy + .6, 12, 4.8, '#3a2c20'); sEll(g, cx, cy, 11.5, 4.2, '#b39470'); sEll(g, cx, cy - .4, 11, 3.6, '#cdb08a');
      sEll(g, cx, cy, 10, 3.4, '#1e1610'); sEll(g, cx, cy - .8, 9, 2.4, '#120c08');
    }
    sVignette(g, w, h);
  }
  // Protect: a starry night arena with a diamond-tiled floor and a glowing platform under the pet
  function paintNight(g, w, h, px, py) {
    const r = seeded(5), floorY = Math.round(h * .64);
    sBands(g, w, 0, floorY, ['#100e28', '#15133a', '#1b1948', '#222058', '#2a2866']);
    for (let i = 0; i < w * floorY / 70; i++) {
      const x = Math.floor(r() * w), y = Math.floor(r() * (floorY - 8)), c = r() < .25 ? '#ffffff' : r() < .6 ? '#bcd0ff' : '#6e78c0';
      sPx(g, x, y, c); if (r() < .06) { sPx(g, x - 1, y, '#6e78c0'); sPx(g, x + 1, y, '#6e78c0'); sPx(g, x, y - 1, '#6e78c0'); sPx(g, x, y + 1, '#6e78c0'); }
    }
    sEll(g, w * .8, floorY * .22, 5, 5, '#fff3c4'); sEll(g, w * .8 + 2, floorY * .22 - 1, 4, 4, '#15133a');   // crescent moon
    for (let x = 0; x < w; x++) {
      const top = floorY - Math.round(7 + Math.sin(x * .11) * 3 + Math.sin(x * .29 + 1) * 2);
      for (let y = top; y < floorY; y++) sPx(g, x, y, y === top ? '#3a3884' : '#1c1a48');
    }
    for (let y = floorY; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y - floorY, line = ((x + 2 * k) % 14 + 14) % 14 === 0 || ((x - 2 * k) % 14 + 14) % 14 === 0;
      sPx(g, x, y, k === 0 ? '#5a5ac0' : line ? '#34327a' : (k < 6 ? '#2a2866' : '#232150'));
    }
    sEll(g, px, py, 20, 6, '#14122e'); sEll(g, px, py - .5, 18.5, 5.2, '#3b3a8c'); sEll(g, px, py - 1, 16, 4, '#5a5ac0');
    sEll(g, px, py - 1, 13.5, 3, '#3b3a8c'); sEll(g, px, py - 1.2, 10, 2, '#4c4cb0');
    sVignette(g, w, h);
  }

  // ---------- Rock Smash (ATTACK) ----------
  function startRockSmash() {
    if (!guard()) return;
    openArena('{i:rock} Rock Smash');
    const p = Game.pet();
    const G = { hits: 0, misses: 0, t0: now(), dur: 20000, rocks: [], next: 0, over: false, endAt: 0, pops: [], attackAt: -9, parts: [], shakeUntil: 0, combo: 0, lastHitAt: -9 };
    const cols = 3, rows = 3;
    const slot = i => ({ x: AW * (.2 + (i % cols) * .3), y: AH * (.2 + Math.floor(i / cols) * .2) });
    G.down = pos => {
      if (G.over) return;
      const r = G.rocks.find(r => !r.smashed && Math.hypot(pos.x - r.x, pos.y - r.y) < 46);
      if (!r) return;
      const t = now();
      r.smashed = true; r.smashAt = t; G.hits++; G.attackAt = t; Sound.play('hit');
      G.combo = t - G.lastHitAt < 900 ? G.combo + 1 : 1; G.lastHitAt = t; G.shakeUntil = t + 140;
      burst(G, r.x, r.y, ['#b7bdcc', '#8d93a6', '#636a7e', '#6fe3ff', '#fff6c2'], 16);
      G.pops.push({ txt: G.combo >= 3 ? `+1  x${G.combo}` : '+1', x: r.x, y: r.y - 30, age: 0 });
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
      // draw: a quarry with 9 holes; rocks rise out of them
      ac.save(); shake(G, ms);
      pixelScene('quarry', (g, w, h) => paintQuarry(g, w, h, [...Array(cols * rows).keys()].map(slot)));
      for (const r of G.rocks) {
        const age = ms - r.born, up = Math.min(1, age / 140), down = r.smashed ? 0 : Math.max(0, 1 - (r.life - age) / 160);
        if (r.smashed) { PX.draw(ac, 'rubble', r.x, r.y + 6, 64, { alpha: Math.max(0, 1 - (ms - r.smashAt) / 400) }); continue; }
        ac.save(); ac.beginPath(); ac.rect(r.x - 50, r.y - 80, 100, 102); ac.clip();   // hide the part still inside the hole
        PX.draw(ac, 'rock', r.x, r.y + 18 - 26 * up * (1 - down), 64);
        ac.restore();
      }
      const size = Math.min(AW, AH) * .12, atk = (ms - G.attackAt) / 1000;
      drawCreature(ac, p.sp, { x: AW / 2, y: AH * .9, size, t, maxH: AH * .22, shiny: p.shiny, dir: 'front',
        anim: atk < animLength(p.sp, 'Attack') ? 'Attack' : undefined, animT: atk < animLength(p.sp, 'Attack') ? atk : undefined });
      drawParts(G, dt);
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = Math.max(0, 1 - pp.age * 1.8); outlined(pp.txt, pp.x, pp.y - pp.age * 60, 22, '#ffe27a'); ac.globalAlpha = 1; return pp.age < .55; });
      ac.restore();
      timerBar(left / G.dur);
      $('#arenaInfo').innerHTML = icons(`{i:rock}${G.hits} &nbsp;{i:sword}+${Math.min(18, Math.floor(G.hits / 2))} &nbsp;${Math.ceil(left / 1000)}s`);
      if (G.over) resultPanel(`${G.hits} rocks smashed!`, `Attack training +${(G.result && G.result.atk) || 0}`, AH * .45);
      else if (ms - G.t0 < 2200) outlined('Tap the rocks to smash them!', AW / 2, AH * .74, 18);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- Protect (DEFENCE) ----------
  function startProtect() {
    if (!guard()) return;
    openArena('{i:shield} Protect');
    const p = Game.pet();
    const G = { blocks: 0, lives: 3, t0: now(), dur: 25000, orbs: [], next: 0, over: false, endAt: 0, pops: [], hitAt: -9, shieldAt: -9, parts: [], shakeUntil: 0 };
    const center = () => ({ x: AW / 2, y: AH * .55 });
    G.down = pos => {
      if (G.over) return;
      let best = null, bd = 56;
      for (const o of G.orbs) { const d = Math.hypot(pos.x - o.x, pos.y - o.y); if (!o.dead && d < bd) { best = o; bd = d; } }
      if (!best) return;
      best.dead = true; best.blockAt = now(); G.blocks++; G.shieldAt = now(); G.shakeUntil = now() + 90; Sound.play('catch');
      burst(G, best.x, best.y, ['#c79bff', '#ffffff', '#8b46e0', '#9fb4ff'], 14, 220, 0);
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
        if (d < 34) { o.dead = true; o.hit = true; G.lives--; G.hitAt = ms; G.shakeUntil = ms + 260; burst(G, o.x, o.y, ['#ff5a6e', '#ffb0b0', '#8b46e0'], 12, 200, 0); Sound.play('miss'); continue; }
        o.x += dx / d * o.speed * dt; o.y += dy / d * o.speed * dt;
        if (Math.random() < .7) G.parts.push({ x: o.x + (Math.random() - .5) * 10, y: o.y + (Math.random() - .5) * 10, vx: 0, vy: 0, age: 0, life: .3, c: Math.random() < .5 ? '#8b46e0' : '#c79bff', s: PXS, g: 0 });
      }
      G.orbs = G.orbs.filter(o => !o.dead || (o.blockAt && ms - o.blockAt < 300));
      // draw: a starry night arena, a rune ring that turns around the pet, orbs with trails
      const size = Math.min(AW, AH) * .1, hurt = ms - G.hitAt < 400;
      ac.save(); shake(G, ms);
      pixelScene('night', (g, w, h) => paintNight(g, w, h, c.x / PXS, (c.y + size * .8) / PXS + 1));
      for (let i = 0; i < 24; i++) {
        const a = t * .8 + i * Math.PI / 12, rr = 64 + Math.sin(t * 3) * 3;
        const sx = snap(c.x + Math.cos(a) * rr) - 2, sy = snap(c.y + Math.sin(a) * rr * .9) - 2;
        ac.globalAlpha = .25; ac.fillStyle = '#6f7fe0'; ac.fillRect(sx - PXS, sy - PXS, PXS * 3, PXS * 3);   // soft glow
        ac.globalAlpha = .6 + .4 * Math.sin(t * 4 + i); ac.fillStyle = i % 3 ? '#bcd0ff' : '#ffe27a'; ac.fillRect(sx, sy, PXS, PXS);
      }
      ac.globalAlpha = 1;
      drawParts(G, dt);
      drawCreature(ac, p.sp, { x: c.x, y: c.y + size * .8, size, t, maxH: AH * .18, shiny: p.shiny, dir: 'front', anim: hurt ? 'Hurt' : undefined, animT: hurt ? (ms - G.hitAt) / 1000 : undefined, alpha: hurt && Math.floor(ms / 80) % 2 ? .4 : 1 });
      if (ms - G.shieldAt < 300) {   // shield bubble: a pixel ring that flashes and fades
        const k = 1 - (ms - G.shieldAt) / 300, R = 50 + (1 - k) * 10;
        ac.globalAlpha = k * .18; ac.fillStyle = '#8fc0ff'; ac.beginPath(); ac.arc(c.x, c.y, R, 0, Math.PI * 2); ac.fill();
        ac.globalAlpha = k; ac.fillStyle = '#d6e8ff';
        for (let i = 0; i < 40; i++) { const a = i * Math.PI / 20; ac.fillRect(snap(c.x + Math.cos(a) * R) - 2, snap(c.y + Math.sin(a) * R) - 2, PXS, PXS); }
        ac.globalAlpha = 1;
        PX.draw(ac, 'shield', c.x, c.y, 64, { alpha: k });
      }
      for (const o of G.orbs) {
        if (o.blockAt) PX.draw(ac, 'sparkle', o.x, o.y, 32, { alpha: 1 - (ms - o.blockAt) / 300 });
        else PX.draw(ac, 'orb', o.x, o.y, 40 + Math.round(Math.sin(t * 10 + o.speed)) * 4);   // pulses; not rotated so it stays pixel-crisp
      }
      G.pops = G.pops.filter(pp => { pp.age += dt; ac.globalAlpha = Math.max(0, 1 - pp.age * 1.8); outlined(pp.txt, pp.x, pp.y - 20 - pp.age * 50, 17, '#bfe0ff'); ac.globalAlpha = 1; return pp.age < .55; });
      ac.restore();
      if (ms - G.hitAt < 320) {   // red flash at the edges when an attack gets through
        const k = 1 - (ms - G.hitAt) / 320; ac.fillStyle = `rgba(255,40,70,${.4 * k})`;
        ac.fillRect(0, 0, AW, 16); ac.fillRect(0, AH - 16, AW, 16); ac.fillRect(0, 0, 16, AH); ac.fillRect(AW - 16, 0, 16, AH);
      }
      timerBar(left / G.dur);
      $('#arenaInfo').innerHTML = icons(`{i:shield}${G.blocks} &nbsp;${'{i:heart}'.repeat(Math.max(0, G.lives))}${'{i:heartEmpty}'.repeat(3 - Math.max(0, G.lives))} &nbsp;${Math.ceil(left / 1000)}s`);
      if (G.over) resultPanel(`${G.blocks} blocked!`, `Defence training +${(G.result && G.result.def) || 0}`, AH * .3);
      else if (ms - G.t0 < 2200) outlined('Tap the attacks before they hit!', AW / 2, AH * .18, 18);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ---------- bag: items found while exploring ----------
  // berries live under Care → Feed; the Bag holds Items and the Poké Mart (Shop)
  function bagTabs() {
    if (!Game.feature('shop')) return '';
    return `<div class="tabs"><button data-bag="items" class="${bagTab === 'items' ? 'on' : ''}">{i:bag} Items</button><button data-bag="shop" class="${bagTab === 'shop' ? 'on' : ''}">{i:shop} Shop</button></div>`;
  }
  const coinsHtml = () => `<span class="coins">{i:coin}<b>${Game.coins().toLocaleString()}</b></span>`;
  // ---------- Poké Mart: a 3-column grid; tap an item to see it and choose how many ----------
  let martMode = 'buy', martCat = 'all';
  function martLists() {
    const IT = Game.ITEMS, C = Game.config, P = Game.pet();
    const forMain = k => P && !P.egg && IT[k].kind === 'evo' && Game.evoUsers(k).includes(P.sp);
    const buy = Object.keys(C.shopBuy).filter(k => IT[k] && C.shopBuy[k] > 0);
    const sell = Object.keys(C.shopSell).filter(k => IT[k] && C.shopSell[k] > 0 && Game.itemCount(k) > 0);
    return { IT, C, P, forMain, buy, sell };
  }
  function openShop() {
    if (!Game.feature('shop')) { bagTab = 'items'; return openItems(); }
    const { IT, C, P, forMain, buy, sell } = martLists();
    const cats = martMode === 'buy'
      ? [['all', 'All'], ...(buy.some(forMain) ? [['mine', `For ${esc(petName())}`]] : []), ['supplies', 'Supplies'], ['evo', 'Evolution']]
      : [['all', 'All'], ['treasure', 'Treasure'], ['other', 'Other']];
    if (!cats.some(([k]) => k === martCat)) martCat = 'all';
    const inCat = k => martCat === 'all' || (martCat === 'mine' && forMain(k)) || (martCat === 'supplies' && IT[k].kind !== 'evo')
      || (martCat === 'evo' && IT[k].kind === 'evo') || (martCat === 'treasure' && IT[k].kind === 'value') || (martCat === 'other' && IT[k].kind !== 'value');
    let list = (martMode === 'buy' ? buy : sell).filter(inCat);
    if (martMode === 'buy') list.sort((a, b) => (forMain(b) - forMain(a)) || ((IT[a].kind === 'evo') - (IT[b].kind === 'evo')));
    const prices = martMode === 'buy' ? C.shopBuy : C.shopSell;
    const card = k => {
      const it = IT[k], price = prices[k], have = Game.itemCount(k), poor = martMode === 'buy' && Game.coins() < price;
      return `<button class="mcard ${poor ? 'poor' : ''} ${forMain(k) && martMode === 'buy' ? 'mine' : ''}" data-mk="${k}">
        ${have ? `<span class="have">×${have}</span>` : ''}${forMain(k) && martMode === 'buy' ? '<span class="fits">✓</span>' : ''}
        ${ic(it.icon).replace('class="ic"', 'class="px"')}<b>${it.name}</b><span class="mprice">{i:coin}${price.toLocaleString()}</span></button>`;
    };
    const empty = martMode === 'buy' ? 'Nothing here right now.'
      : 'Nothing to sell yet. Explore dungeons to find treasure like <b>Pearls</b>, <b>Stardust</b>, <b>Nuggets</b> and ancient <b>Relics</b>!';
    openSheet(head('Bag') + bagTabs() + `
      <div class="shophead">{i:shop}<div><b>Poké Mart</b><small>${martMode === 'buy' ? 'Tap an item to see it and buy.' : 'Tap an item to sell it for Pokécoins.'}</small></div>${coinsHtml()}</div>
      <div class="seg"><button data-mm="buy" class="${martMode === 'buy' ? 'on' : ''}">{i:cart} Buy</button><button data-mm="sell" class="${martMode === 'sell' ? 'on' : ''}">{i:coin} Sell${sell.length ? ` (${sell.length})` : ''}</button></div>
      <div class="mchips">${cats.map(([k, l]) => `<button data-mc="${k}" class="${martCat === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      ${list.length ? `<div class="mart">${list.map(card).join('')}</div>` : `<p class="muted" style="text-align:center;margin:18px 0">${empty}</p>`}`);
    wireBagTabs();
    sheet.querySelectorAll('[data-mm]').forEach(b => b.addEventListener('click', () => { martMode = b.dataset.mm; martCat = 'all'; openShop(); }));
    sheet.querySelectorAll('[data-mc]').forEach(b => b.addEventListener('click', () => { martCat = b.dataset.mc; openShop(); }));
    sheet.querySelectorAll('[data-mk]').forEach(b => b.addEventListener('click', () => openMartItem(b.dataset.mk, 1)));
  }
  /** one item: picture, what it does, how many, total, Buy / Sell */
  function openMartItem(k, n) {
    const { IT, C } = martLists(), it = IT[k], buying = martMode === 'buy';
    const price = buying ? C.shopBuy[k] : C.shopSell[k];
    if (!it || !price) return openShop();
    const have = Game.itemCount(k), max = buying ? Math.max(1, Math.min(99, Math.floor(Game.coins() / price))) : Math.max(1, have);
    n = Math.max(1, Math.min(buying ? 99 : have, n || 1));
    const total = price * n, can = buying ? Game.coins() >= total : have >= n;
    openSheet(head(buying ? 'Buy' : 'Sell') + `
      <div class="mdetail">${ic(it.icon).replace('class="ic"', 'class="px"')}
        <div><b>${it.name}</b><small>${it.desc}</small>${it.kind === 'evo' ? evoNote(k) : ''}
        <small class="price">{i:coin} ${price.toLocaleString()} each · you have ×${have}</small></div></div>
      <div class="mqty">
        <button class="alt" data-n="${n - 1}" ${n <= 1 ? 'disabled' : ''}>−</button><span>${n}</span>
        <button class="alt" data-n="${n + 1}" ${n >= (buying ? 99 : have) ? 'disabled' : ''}>+</button>
        <button class="alt max" data-n="${max}" ${n === max ? 'disabled' : ''}>Max</button>
      </div>
      <div class="mtotal"><span>${buying ? 'Total' : 'You get'}</span><b>{i:coin} ${total.toLocaleString()}</b></div>
      ${buying && !can ? `<p class="muted" style="text-align:center;margin:0 0 8px">You need {i:coin}${(total - Game.coins()).toLocaleString()} more. Sell some treasure first!</p>` : ''}
      <div class="btns two"><button class="btn alt" id="mBack">← Back</button><button class="btn ${buying ? 'red' : 'gold'}" id="mGo" ${can ? '' : 'disabled'}>${buying ? `Buy ×${n}` : `Sell ×${n}`}</button></div>
      <p class="muted" style="text-align:center;margin-top:10px">${coinsHtml()}</p>`);
    sheet.querySelectorAll('[data-n]').forEach(b => b.addEventListener('click', () => openMartItem(k, +b.dataset.n)));
    $('#mBack').addEventListener('click', openShop);
    $('#mGo').addEventListener('click', () => {
      const r = buying ? Game.buyItem(k, n) : Game.sellItem(k, n);
      if (r.error) { toast(r.error); Sound.play('no'); return; }
      Sound.play(buying ? 'catch' : 'medal');
      toast(buying ? `Bought {i:${it.icon}} ${it.name} ×${n} for {i:coin}${r.spent.toLocaleString()}` : `Sold {i:${it.icon}} ${it.name} ×${n} for {i:coin}${r.earned.toLocaleString()}`);
      if (!buying && Game.itemCount(k) === 0) return openShop();
      openMartItem(k, 1);
    });
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
  // "Gardevoir (Lv 30) / Gallade ({i:dawnStone} Dawn Stone)"
  function evoText(id) {
    return Game.evoMethods(id).map(m => `${Game.registered(m.to) ? SPECIES_BY_ID[m.to].name : '???'} (${m.item ? `${ic(Game.ITEMS[m.item].icon)} ${Game.ITEMS[m.item].name}` : m.bond != null ? `{i:heart} bond ${m.bond}` : 'Lv ' + m.lv}${m.time ? ', ' + Evolution.SHORT[m.time] : ''})`).join(' / ');
  }
  // who an evolution item works on, for its Bag / shop row
  function evoNote(k) {
    const p = Game.pet(), users = Game.evoUsers(k), it = Game.ITEMS[k];
    const mine = p && !p.egg && users.includes(p.sp);
    const names = users.slice(0, 4).map(id => Game.registered(id) ? SPECIES_BY_ID[id].name : '???').join(', ') + (users.length > 4 ? ` +${users.length - 4} more` : '');
    return `<small class="evonote ${mine ? 'mine' : ''}">${mine ? `✓ Works on your ${esc(petName())}! ` : ''}${it.how === 'hold' ? 'Hold it, then level up' : 'Use it'} · ${names || '—'}</small>`;
  }
  function openItems() {
    const IT = Game.ITEMS, keys = Object.keys(IT), p = Game.pet();
    const have = keys.filter(k => Game.itemCount(k) > 0);
    // a grid of tiles, three to a row; tap a tile (not its button) to read what the item does
    const fits = k => IT[k].kind === 'evo' && p && !p.egg && Game.evoUsers(k).includes(p.sp);
    const tile = k => `<div class="itemtile" data-info="${k}"><span class="icnt">×${Game.itemCount(k)}</span>${fits(k) ? '<span class="ifit">✓</span>' : ''}
        ${ic(IT[k].icon).replace('class="ic"', 'class="px"')}<b>${IT[k].name}</b>
        ${IT[k].use ? `<button data-use="${k}">Use</button>` : IT[k].kind === 'evo' ? (IT[k].how === 'hold' ? `<button class="gold" data-hold="${k}">Give</button>` : `<button data-evo="${k}">Use</button>`) : `<span class="inote">${IT[k].kind === 'ball' ? 'Catch wheel' : IT[k].heal ? 'Use in Explore' : IT[k].kind === 'value' ? 'Treasure' : ''}</span>`}</div>`;
    const group = (title, list) => list.length ? `<h4 class="shoph">${title}</h4><div class="itemgrid">${list.map(tile).join('')}</div>` : '';
    const kindOf = k => IT[k].kind || 'basic';
    const heldRow = p && !p.egg && p.held && IT[p.held] ? `<div class="itemrow held">${ic(IT[p.held].icon).replace('class="ic"', 'class="px"')}
        <div class="ii"><b>${esc(petName())} is holding a ${IT[p.held].name}</b><small>${Game.heldEvo() ? 'It can evolve now — keep its needs at 40+!' : 'It evolves at its next level-up' + (Evolution.WHEN[Game.evoMethods(p.sp).filter(m => m.item === p.held).map(m => m.time)[0]] ? ' ' + Evolution.WHEN[Game.evoMethods(p.sp).filter(m => m.item === p.held).map(m => m.time)[0]] : '') + '.'}</small></div>
        <button class="alt" data-take="1">Take</button></div>` : '';
    openSheet(head('Bag') + bagTabs() + heldRow + (have.length || Object.keys(ST().player.fragments || {}).length
      ? group('{i:bag} Items', have.filter(k => kindOf(k) === 'basic' || kindOf(k) === 'ball'))
        + group('{i:sparkle} Evolution items', have.filter(k => kindOf(k) === 'evo'))
        + group('{i:coin} Treasure', have.filter(k => kindOf(k) === 'value'))
      : '<p class="muted">No items yet. Go <b>Explore</b> to find treasure, Rare Candy and Mystery Eggs!</p>')
      + fragmentsHtml()
      + `<p class="muted" style="margin-top:12px">Deepest floor reached: B${ST().player.exploreBest || 0}F · Wild battles won: ${ST().player.wildWins || 0}</p>`);
    wireBagTabs();
    sheet.querySelectorAll('[data-info]').forEach(t => t.addEventListener('click', e => {
      if (e.target.closest('button')) return;                      // the tile's own Use / Give button
      const k = t.dataset.info, it = IT[k];
      dialog(`${ic(it.icon)} ${it.name} ×${Game.itemCount(k)}`, `${it.desc}${it.kind === 'evo' ? '<br>' + evoNote(k) : ''}${it.kind === 'value' ? '<br><small class="muted">Sell it at the Poké Mart for Pokécoins.</small>' : ''}`,
        [{ label: 'Close', cls: 'alt', fn: () => openFeed('items') }]);
    }));
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
    sheet.querySelectorAll('[data-evo]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.evo, it = IT[k], pp = Game.pet();
      const t = pp && !pp.egg ? Game.evoTarget(k, pp.sp) : { error: 'egg' };
      if (t.error) { const r = Game.useEvoItem(k); toast(r.error || 'It won\'t have any effect.'); Sound.play('no'); return; }
      dialog(`Use the ${it.name}?`, `Use it on ${esc(petName())}? It will evolve!`, [
        { label: 'Not now', cls: 'alt', fn: () => openFeed('items') },
        { label: `{i:${it.icon}} Use`, cls: 'red', fn: () => {
          const r = Game.useEvoItem(k);
          if (r.error) { toast(r.error); Sound.play('no'); return; }
          V.anim = { type: 'evolve', from: r.from, to: r.to, start: now(), dur: 5200 }; Sound.play('evolve');
        } },
      ]);
    }));
    sheet.querySelectorAll('[data-hold]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.hold, r = Game.giveHeld(k);
      if (r.error) { toast(r.error); Sound.play('no'); return; }
      Sound.play('catch');
      toast(`{i:${IT[k].icon}} ${petName()} is holding the ${IT[k].name}. It evolves at its next level-up${r.when ? ' ' + Evolution.WHEN[r.when] : ''}!`, 4500);
      openFeed('items');
    }));
    sheet.querySelectorAll('[data-take]').forEach(b => b.addEventListener('click', () => { Game.takeHeld(); toast('Put back in the Bag.'); openFeed('items'); }));
    const afterUse = (k, r) => {
      closeSheet();
      if (k === 'oran') { startEat('#4a86e8', 'oran'); addHearts(4); toast('{i:oran} Every need +25!'); Talk.say('fav', { vars: { berry: 'Oran Berry' } }); }
      if (k === 'rareCandy') { startEat('#4a7fe0', 'rareCandy'); addSparkles(V.x * W, feetY() - petSize(), 18); toast(`{i:rareCandy} ${petName()} grew to Lv ${Game.level()}!`); }
      if (k === 'sitrus') { startEat('#f2d23a', 'sitrus'); addHearts(2); toast('{i:sitrus} Food +35!'); }
      if (k === 'lemonade') { startEat('#f7e36b', 'lemonade'); addSparkles(V.x * W, feetY() - petSize(), 10); toast('{i:lemonade} Refreshing! Energy +50!'); }
      if (r.egg) { V.x = .5; V.loaded = null; Talk.clear(); Sound.play('hatch'); toast(`{i:egg_legend_0} The Mystery Egg is your new main${r.boxed ? ` (${esc(r.prevName)} went to the PC Box)` : ''} — tap it 3 times!`, 4500); Talk.say('newEgg', { prio: 2 }); }
    };
    sheet.querySelectorAll('[data-use]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.use, prevName = petName(), r = Game.useItem(k);
      if (r.full) {   // party is full: ask before sending the main to the PC Box
        Sound.play('no');
        dialog('Your party is full', `Your party already has ${Game.PARTY_MAX} Pokémon, so there's no room for the Mystery Egg. Send ${esc(prevName)} to the PC Box and start the egg, or make room in your Party first.`, [
          { label: 'Not now', cls: 'alt', fn: () => openFeed('items') },
          { label: '{i:party} Open Party', cls: 'alt', fn: () => openParty() },
          { label: `Send ${esc(prevName)} to PC`, cls: 'gold', fn: () => {
            const r2 = Game.useItem(k, { toBox: true });
            if (r2.error) { toast(r2.error === 'none' ? 'You have none left.' : r2.error); return; }
            afterUse(k, Object.assign(r2, { prevName }));
          } },
        ]);
        return;
      }
      if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return; }
      afterUse(k, Object.assign(r, { prevName }));
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
  const WALK_MS = 1700;   // how long the walk to each new floor takes
  const LEGEND_INTRO_MS = 4600, LEGEND_REVEAL_MS = 2700;   // the legendary entrance, and when it bursts into colour
  const SWAP_OUT_MS = 900, SWAP_IN_MS = 1300;             // the fainted Main fades out, then the Backup runs in from the left
  /** a cinematic overlay for a legendary's entrance: darkness, rumble, light beams, a flash and a name banner */
  function drawLegendIntro(G, ms, wx, wy, size, layer) {
    const e = ms - G.intro.at, R = LEGEND_REVEAL_MS, D = LEGEND_INTRO_MS;
    if (e > D + 600) return;
    const cy = wy - size * 1.1;
    if (layer === 'back') {
    // darkness that closes in, then lifts after the reveal
    const dark = e < R ? Math.min(.82, e / 900 * .82) : Math.max(0, .82 * (1 - (e - R) / 500));
    if (dark > 0) { ac.fillStyle = `rgba(6,2,18,${dark})`; ac.fillRect(-20, -20, AW + 40, AH + 40); }
    // a golden aura that pulses faster and faster around the shadow
    if (e < R + 400) {
      const k = Math.min(1, e / R), pulse = .5 + .5 * Math.sin(e / (140 - k * 90));
      const gr = ac.createRadialGradient(wx, cy, 4, wx, cy, size * (1.6 + k * 1.6));
      gr.addColorStop(0, `rgba(255,214,90,${(.25 + .45 * k) * (.6 + .4 * pulse)})`); gr.addColorStop(1, 'rgba(255,214,90,0)');
      ac.fillStyle = gr; ac.fillRect(wx - size * 4, cy - size * 4, size * 8, size * 8);
    }
    // light beams sweeping out from the Pokémon, growing until the flash
    if (e > 700 && e < R + 900) {
      const k = Math.min(1, (e - 700) / (R - 700)), fade = e > R ? 1 - (e - R) / 900 : 1, n = 12;
      ac.save(); ac.translate(wx, cy); ac.rotate(e / 900); ac.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, L = Math.max(AW, AH) * (.3 + k * .9), wd = .05 + .04 * Math.sin(e / 200 + i);
        ac.beginPath(); ac.moveTo(0, 0); ac.lineTo(Math.cos(a - wd) * L, Math.sin(a - wd) * L); ac.lineTo(Math.cos(a + wd) * L, Math.sin(a + wd) * L); ac.closePath();
        ac.fillStyle = `rgba(255,${200 + (i % 2) * 40},${120 + (i % 3) * 40},${.22 * k * fade})`; ac.fill();
      }
      ac.restore();
    }
    // sparks sucked inward before the reveal
    if (e < R) for (let i = 0; i < 26; i++) {
      const life = ((e / 900 + rng(i * 7)) % 1), a = rng(i * 3) * Math.PI * 2, r = (1 - life) * size * 4;
      PX.draw(ac, 'sparkle', wx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, 12 + Math.round(rng(i) * 8), { alpha: Math.min(1, life * 2) * Math.min(1, e / 600) });
    }
    return;
    }
    // ---- front layer (over the Pokémon) ----
    // the reveal: a white flash, a shockwave ring and a burst of stars
    if (e >= R) {
      const f = e - R;
      if (f < 500) { ac.fillStyle = `rgba(255,255,255,${1 - f / 500})`; ac.fillRect(-20, -20, AW + 40, AH + 40); }
      for (let ring = 0; ring < 2; ring++) {
        const rk = (f - ring * 180) / 900; if (rk <= 0 || rk >= 1) continue;
        ac.beginPath(); ac.ellipse(wx, wy - size * .3, rk * AW * .7, rk * AW * .25, 0, 0, Math.PI * 2);
        ac.lineWidth = 8 * (1 - rk); ac.strokeStyle = `rgba(255,230,140,${1 - rk})`; ac.stroke();
      }
      if (f < 1400) for (let i = 0; i < 18; i++) {
        const a = i / 18 * Math.PI * 2 + rng(i) * .3, r = f / 1400 * size * (3 + rng(i + 4) * 2.5);
        PX.draw(ac, 'sparkle', wx + Math.cos(a) * r, cy + Math.sin(a) * r * .8, 18, { alpha: 1 - f / 1400 });
      }
    }
    // cinematic letterbox bars
    const bar = AH * .11 * (e < 400 ? e / 400 : e > D ? Math.max(0, 1 - (e - D) / 500) : 1);
    ac.fillStyle = '#05030d'; ac.fillRect(-20, -20, AW + 40, bar + 20); ac.fillRect(-20, AH - bar, AW + 40, bar + 20);
    // the name banner slams in from the right after the reveal
    if (e > R + 150) {
      const f = e - R - 150, inK = Math.min(1, f / 280), outK = e > D - 300 ? Math.min(1, (e - (D - 300)) / 500) : 0;
      const by = AH * .36, bh = 74, x = (1 - inK) * AW * 1.2 - outK * AW * 1.2;
      ac.save(); ac.translate(x, 0);
      ac.beginPath(); ac.moveTo(-10, by + 8); ac.lineTo(AW + 10, by - 8); ac.lineTo(AW + 10, by + bh - 8); ac.lineTo(-10, by + bh + 8); ac.closePath();
      const bg = ac.createLinearGradient(0, 0, AW, 0); bg.addColorStop(0, 'rgba(120,20,30,.92)'); bg.addColorStop(.5, 'rgba(30,10,40,.95)'); bg.addColorStop(1, 'rgba(120,20,30,.92)');
      ac.fillStyle = bg; ac.fill(); ac.lineWidth = 3; ac.strokeStyle = '#ffcb05'; ac.stroke();
      ac.textAlign = 'center'; ac.fillStyle = '#ffcb05'; ac.font = '800 15px \"Nunito\", system-ui, sans-serif';
      ac.fillText('★  L E G E N D A R Y  ★', AW / 2, by + 24);
      const nameTxt = G.wild ? G.wild.name.toUpperCase() : '';
      ac.font = `800 ${Math.min(36, AW / Math.max(6, nameTxt.length) * 1.3)}px "Nunito", system-ui, sans-serif`;
      ac.lineWidth = 5; ac.strokeStyle = '#1a0610'; ac.strokeText(nameTxt, AW / 2, by + 60);
      ac.fillStyle = Math.floor(f / 90) % 2 && f < 700 ? '#fff6c8' : '#ffffff'; ac.fillText(nameTxt, AW / 2, by + 60);
      ac.textAlign = 'left'; ac.restore();
    }
  }
  // where the Pokémon stand in a battle (share of the arena height): both on the floor of the picture
  const WILD_Y = .7, ME_Y = .86;
  /** a strong bond (Game.ENDURE_BOND) lets your Pokémon hold on with 1% HP instead of fainting, once per battle */
  function bondEndure(G, maxHp) {
    const p = G.team ? G.team[G.cur].mon : Game.pet();   // exploring: whoever is fighting right now
    if (G.meHp > 0 || G.endured || !p || p.egg || (p.bond || 0) < Game.ENDURE_BOND) return false;
    G.endured = true; G.meHp = Math.max(1, Math.round(maxHp * .01)); G.endureAt = now();
    setTimeout(() => Sound.play('pet'), 250);
    return true;
  }
  /** the heart that pops over your Pokémon when it endures */
  function drawEndure(G, ms, x, top) {
    const e = ms - (G.endureAt || -1e9); if (e > 1600) return;
    const k = e / 1600; PX.draw(ac, 'heart', x, top - 10 - k * 26, 32, { alpha: Math.min(1, (1 - k) * 2) });
  }
  function drawExploreBg(G, ms) {
    const file = typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.assign && BACKGROUNDS.assign.explore;
    const src = G.bgSrc || (file ? 'backgrounds/' + encodeURIComponent(file) : null);   // the chosen map's picture, or the dashboard's
    if (!src) return false;
    if (!exploreImg || exploreImg._src !== src) { exploreImg = new Image(); exploreImg._src = src; exploreImg.src = src; }
    if (!exploreImg.complete || !exploreImg.naturalWidth) return false;
    ac.imageSmoothingEnabled = false;
    const iw = exploreImg.naturalWidth, ih = exploreImg.naturalHeight;
    if (iw / ih > 1.3) {
      // wide panorama: one journey through the picture, from the entrance on the left to the far end on the right,
      // reached on the last floor. Each floor's walk carries the view one step further; it holds still for battles.
      // The camera: zoomed out to the whole picture while exploring (walking, chests, between floors) so the scenery
      // shows, and eased in for battles so the Pokémon stand big on the ground. Anchored to the bottom of the picture.
      const want = G.wild || G.state === 'battle' ? 1.25 : 1;
      const zdt = Math.min(.05, (ms - (G.zoomAt || ms)) / 1000); G.zoomAt = ms;
      G.zoom = G.zoom == null ? want : G.zoom + (want - G.zoom) * Math.min(1, zdt * 5);
      const ZOOM = G.zoom;
      const h = AH * ZOOM, s2 = h / ih, w = iw * s2, span = Math.max(0, w - AW), maxF = Math.max(1, Game.EXPLORE_MAX_FLOOR);
      const at = f => span * Math.max(0, Math.min(1, f / maxF));
      const k = G.state === 'walk' ? Math.min(1, (ms - G.at) / WALK_MS) : 1;   // steady walking pace
      const pan = at(G.floor - 1) + (at(G.floor) - at(G.floor - 1)) * k;
      const bob = G.state === 'walk' && k < 1 ? Math.round(Math.abs(Math.sin(ms / 160)) * 3) : 0;
      ac.drawImage(exploreImg, -Math.round(pan), Math.min(0, Math.round(AH - h * .96)) + bob, w, h);
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
    g.fillStyle = '#2b2d42'; g.font = '800 16px \"Nunito\", system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText(name, x + 10, y + 20); g.textAlign = 'right'; g.font = '800 14px \"Nunito\", system-ui, sans-serif'; g.fillText('Lv' + lv, x + w - 10, y + 20); g.textAlign = 'left';
    const bx = x + 34, by = y + 28, bw = w - 44, k = Math.max(0, hp / max);
    g.fillStyle = '#2f3448'; roundRect(g, x + 8, by - 1, 24, 12, 4); g.fill();
    g.fillStyle = '#ffcb05'; g.font = '800 10px \"Nunito\", system-ui, sans-serif'; g.fillText('HP', x + 12, by + 9);
    roundRect(g, bx, by, bw, 10, 5); g.fillStyle = '#4a4e66'; g.fill(); g.strokeStyle = '#2f3448'; g.lineWidth = 2; g.stroke();
    if (k > 0) { roundRect(g, bx + 2, by + 2, (bw - 4) * k, 6, 3); g.fillStyle = k > .5 ? '#48d048' : k > .2 ? '#f8c030' : '#f85838'; g.fill(); }
    if (showNums) { g.fillStyle = '#2b2d42'; g.font = '800 13px \"Nunito\", system-ui, sans-serif'; g.textAlign = 'right'; g.fillText(`${Math.max(0, Math.ceil(hp))}/${max}`, x + w - 10, y + 52); g.textAlign = 'left'; }
  }

  function startExplore(opts = {}) {
    const chk = Game.exploreCheck();
    if (!chk.ok) { toast(chk.why); Sound.play('no'); if (/tired/.test(chk.why)) Talk.say('tooTired'); return; }
    const p = Game.pet();
    panel.classList.remove('hidden');
    const D = DUNGEONS[Math.floor(Math.random() * DUNGEONS.length)];
    const map = EXPLORE_MAP_UI.find(m => m.id === opts.map) || EXPLORE_MAP_UI[0];
    const caveName = map.id !== 'cave' ? map.name : typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS.assign && BACKGROUNDS.assign.explore ? 'Crystal Cave' : D.name;
    openArena(`{i:map} ${caveName}`);
    const me = Game.battler(p.sp, Game.level(), true);
    const G = {
      D, caveName, floor: 0, state: 'walk', at: now(), me, meHp: me.maxHp, wins: 0, finds: {}, wild: null, wildHp: 0,
      act: null, actAt: 0, hurt: null, hurtAt: 0, chest: null, over: false, seedInt: 1 + Math.floor(Math.random() * 100000), scroll: 0,
      map: map.id, bgSrc: map.src || null,
    };
    // the team: [0] the Main (your home Pokémon), [1] the Backup that takes over if the Main faints
    const fr = opts.sub && opts.sub.friend && opts.sub.card && SPECIES_BY_ID[opts.sub.card.sp] ? opts.sub : null;   // borrowed from a friend
    const subM = !fr && opts.sub && !opts.sub.egg && opts.sub !== p && SPECIES_BY_ID[opts.sub.sp] ? opts.sub : fr ? fr.card : null;
    G.team = [{ mon: p, sp: p.sp, shiny: p.shiny, nm: () => petName() }];
    if (fr) G.team.push({ mon: { bond: 0 }, sp: subM.sp, shiny: !!subM.shiny, owner: fr.owner, nm: () => subM.name || SPECIES_BY_ID[subM.sp].name, battler: Game.cardBattler(subM) });
    else if (subM) G.team.push({ mon: subM, sp: subM.sp, shiny: subM.shiny, nm: () => subM.name || SPECIES_BY_ID[subM.sp].name, battler: Game.memberBattler(subM) });
    G.cur = 0;
    preloadSpecies(p.sp, p.shiny);
    if (subM) preloadSpecies(subM.sp, subM.shiny);
    Sound.play('wake'); Talk.say('exploreGo');
    const name = () => G.team[G.cur].nm();
    const info = () => { $('#arenaInfo').innerHTML = icons(`B${G.floor}F &nbsp;{i:energy}${Math.round(Game.pet().ene)}`); };

    function nextFloor() {
      G.floor++; G.state = 'walk'; G.at = now(); G.wild = null; G.chest = null;
      G.meHp = Math.min(G.me.maxHp, G.meHp + Math.round(G.me.maxHp * .15));  // catches its breath between floors
      G.tired = !Game.exploreStep();
      info(); say(`B${G.floor}F — ${esc(name())} explores…`); buttons([]);
      setTimeout(() => { if (arenaGame === G) resolveFloor(); }, WALK_MS);
    }
    function resolveFloor() {
      if (G.floor >= Game.EXPLORE_MAX_FLOOR) return encounter(Game.rollBoss(G.map));   // the end of the map: floor boss
      const ev = Game.rollFloor(G.floor, G.map);
      if (ev === 'wild') return encounter();
      if (ev === 'legend') { const L = Game.rollLegend(G.map); return encounter(L || undefined); }
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
      G.endured = false;   // the bond endure works once per battle
      const w = preset || Game.rollWild(G.map), ws = SPECIES_BY_ID[w.sp];
      G.wild = Object.assign(Game.battler(w.sp, w.level, false), { shiny: w.shiny, name: ws.name, legend: !!w.legend, boss: !!w.boss, raw: w });
      if (w.legend && !w.boss) G.wild.maxHp = Math.round(G.wild.maxHp * 1.2);   // legendaries are a little tougher
      if (w.boss) {                                                    // floor boss: lots of HP and hits hard
        G.wild.maxHp = Math.round(G.wild.maxHp * 1.8);
        G.wild.atk = Math.round(G.wild.atk * 1.15); G.wild.def = Math.round(G.wild.def * 1.15);
      }
      G.wildHp = G.wild.maxHp; G.state = 'encounter'; G.at = now(); G.legendAt = w.boss && !w.legend ? now() : 0; G.throw = null; G.wheel = null;
      preloadSpecies(w.sp, w.shiny);
      G.wildFirst = false;
      if (w.legend) {                                   // legendary: a cinematic entrance before the fight
        G.intro = { at: now(), dur: LEGEND_INTRO_MS };
        Sound.legendIntro();
        say('{i:sparkle} The ground is shaking…', 'Something incredibly powerful is coming!');
        buttons([]);
        setTimeout(() => { if (arenaGame === G && G.state === 'encounter') { announce(w, ws); encounterButtons(); } }, LEGEND_INTRO_MS);
        return;
      }
      G.intro = null;
      Sound.play(w.boss ? 'evolve' : 'sad');
      announce(w, ws);
      encounterButtons();
    }
    function announce(w, ws) {
      const frag = Game.state.player.fragments[w.sp] || 0;
      if (w.boss && w.legend) say(`{i:sparkle} The floor boss is a <b>LEGENDARY</b> Pokémon — ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level})!`,
        `An extremely rare boss! Win the battle to spin the catch wheel.${frag ? ` You have ${frag}/${Game.FRAGMENTS_TO_SUMMON} of its fragments.` : ''}`);
      else if (w.legend) say(`{i:sparkle} A <b>legendary</b> Pokémon appeared! It's ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level})!`,
        `Win the battle to spin the catch wheel.${frag ? ` You have ${frag}/${Game.FRAGMENTS_TO_SUMMON} of its fragments.` : ''}`);
      else if (w.boss) say(`{i:sword} The <b>floor boss</b> blocks the way! It's a mighty ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level})!`,
        (w.bossTier === 'final' ? '{i:sparkle} A very rare fully evolved boss! ' : w.bossTier === 'stage2' ? 'A rare evolved boss! ' : '') + 'It\'s much stronger than usual. Beat it to spin the catch wheel!');
      else if (w.chase) say(`{i:star} The main chase! A wild ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level}) appeared!`, `${ELEMENTS[ws.el].label} type · the Pokémon everyone hunts on this map`);
      else say(`A wild ${w.shiny ? '{i:sparkle}' : ''}<b>${esc(ws.name)}</b> (Lv ${w.level}) appeared!`, `${ELEMENTS[ws.el].label} type · ${esc(name())} is Lv ${G.me.level}`);
    }
    function encounterButtons() {
      buttons([
        { label: '{i:sword} Fight', cls: 'red', fn: () => fight(G.wildFirst) },
        { label: '{i:oran} Items', cls: 'alt', fn: () => showItems(true) },
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
        G.act = turn; G.actAt = now(); Sound.attack();
        const an = turn === 'me' ? esc(name()) : `The wild ${esc(G.wild.name)}`;
        setTimeout(() => {
          if (arenaGame !== G) return;
          if (turn === 'me') G.wildHp -= dmg; else G.meHp -= dmg;
          const endured = turn !== 'me' && bondEndure(G, G.me.maxHp);
          G.hurt = turn === 'me' ? 'wild' : 'me'; G.hurtAt = now(); Sound.damage(crit);
          say(`${an} attacks!${crit ? ' A critical hit!' : ''}${endured ? ` {i:heart} ${esc(name())} endured the hit for you!` : ''}`, endured ? `${dmg} damage · its bond with you kept it standing at 1% HP` : `${dmg} damage`);
          if (G.wildHp <= 0) return setTimeout(win, 700);
          if (G.meHp <= 0) return setTimeout(G.cur === 0 && G.team[1] ? swapIn : lose, 700);
          turn = turn === 'me' ? 'wild' : 'me';
          setTimeout(step, 750);
        }, 380);
      };
      setTimeout(step, 600);
    }
    function win() {
      if (G.wild.legend || G.wild.boss) { G.wins++; return startWheel(); }
      G.wins++; G.state = 'won'; G.at = now(); Sound.play('level');
      let sub = `${esc(name())} feels proud!`;
      if (Math.random() < .35) { const k = Game.rollTreasure(G.floor); Game.addItem(k); G.finds[k] = (G.finds[k] || 0) + 1; sub = `It dropped ${/^[AEIOU]/.test(Game.ITEMS[k].name) ? 'an' : 'a'} {i:${Game.ITEMS[k].icon}} ${Game.ITEMS[k].name}!`; }
      say(`The wild ${esc(G.wild.name)} fainted! ${esc(name())} won!`, sub);
      afterFloor();
    }
    /** the Main fainted: it's recalled and the Backup jumps into the battle at full HP */
    function swapIn() {
      if (arenaGame !== G) return;
      const out = G.team[0], bk = G.team[1];
      out.fainted = true; G.swapAt = now(); Sound.play('sad');
      say(`${esc(out.nm())} fainted!`, `Hang in there… ${esc(bk.nm())}, it's your turn!`);
      setTimeout(() => {
        if (arenaGame !== G) return;
        G.cur = 1; G.me = bk.battler; G.meHp = bk.battler.maxHp; G.endured = false; G.hurt = null; G.act = null;
        Sound.play('wake');
      }, SWAP_OUT_MS + 350);
      setTimeout(() => {
        if (arenaGame !== G) return;
        Sound.play('level');
        say(`Go, <b>${esc(bk.nm())}</b>! ${bk.owner ? `${esc(bk.owner)}'s Pokémon jumps in to help!` : 'Your backup jumps in!'}`, `Lv ${bk.battler.level} · full HP · the battle goes on`);
        G.state = 'encounter'; G.wildFirst = false;
        encounterButtons();
      }, SWAP_OUT_MS + SWAP_IN_MS);
    }
    function lose() {
      G.state = 'lost'; G.at = now(); Sound.play('sad');
      if (G.team[1]) say(`${esc(G.team[1].nm())} is out of strength too…`, `${esc(G.team[0].nm())} and ${esc(G.team[1].nm())} head back home to rest.`);
      else say(`${esc(name())} is out of strength…`, 'It heads back home to rest.');
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
    const BALL_RANK = { poke: 0, great: 1, ultra: 2, master: 3 };
    const BALL_ITEMS = ['greatBall', 'ultraBall', 'masterBall'];
    function startWheel() {
      G.state = 'wheel'; G.at = now(); G.wheel = { offset: Math.floor(Math.random() * SEGS.length), spinning: false, result: null, segs: SEGS.slice(), boosted: null, boostAt: 0 };
      Sound.play('medal');
      const who = G.wild.legend ? `The legendary <b>${esc(G.wild.name)}</b>` : `The boss <b>${esc(G.wild.name)}</b>`;
      say(`${esc(name())} won! ${who} is weakened…`, 'Spin the wheel to choose your ball — you get one throw! Got a ball in your bag? Use it first to upgrade the wheel.');
      wheelButtons();
    }
    function wheelButtons() {
      const list = [{ label: '{i:pokeball} Spin!', cls: 'gold', fn: spin }];
      if (!G.wheel.boosted) BALL_ITEMS.forEach(k => {
        const n = Game.itemCount(k), it = Game.ITEMS[k];
        if (n) list.push({ label: `{i:${it.icon}} Use ${it.name} ×${n}`, cls: 'alt', fn: () => boostWheel(k) });
      });
      buttons(list, list.length > 2);
    }
    /** using a ball from the bag: every weaker slot on the wheel becomes that ball */
    function boostWheel(k) {
      const it = Game.ITEMS[k], b = it.wheel;
      if (!Game.itemCount(k) || G.wheel.boosted) return;
      Game.state.player.bag[k]--; Game.save();
      G.wheel.segs = G.wheel.segs.map(x => BALL_RANK[x] < BALL_RANK[b] ? b : x);
      G.wheel.boosted = b; G.wheel.boostAt = now(); Sound.play('evolve');
      say(`You used the {i:${it.icon}} <b>${it.name}</b>! The wheel is now full of ${b === 'master' ? 'Master Balls — a sure catch' : it.name + 's or better'}!`, 'Spin it!');
      wheelButtons();
    }
    function spin() {
      const SG = G.wheel.segs, W0 = G.wheel, n = SG.length, idx = Math.floor(Math.random() * n);
      // slide the strip 4–5 laps and stop with the chosen ball under the pointer
      const from = W0.offset || 0, base = Math.ceil(from) + n * 4;
      const to = base + (((idx - base) % n) + n) % n;
      W0.from = from; W0.to = to;
      W0.spinning = true; W0.t0 = now(); W0.dur = 3400; W0.result = SG[idx]; W0.lastSeg = Math.round(from);
      say('Spinning…'); buttons([]);
      setTimeout(() => {
        if (arenaGame !== G) return;
        W0.spinning = false; W0.offset = W0.to;
        const b = BALLS[W0.result]; Sound.play('level');
        say(`It's a {i:${b.icon}} <b>${b.name}</b>!`, W0.result === 'master' ? 'The Master Ball never misses!' : 'Here goes…');
        setTimeout(() => { if (arenaGame === G && G.state === 'wheel') throwBall(); }, 700);   // thrown straight away
      }, W0.dur + 100);
    }
    function throwBall() {
      const b = BALLS[G.wheel.result];
      // legendaries are much harder to hold (except with a Master Ball)
      const rate = G.wild.legend && G.wheel.result !== 'master' ? b.rate * .5 : b.rate;
      const caught = Math.random() < rate;
      G.state = 'throw'; G.at = now(); G.lastShake = -1; G.throw = { ball: b.icon, kind: G.wheel.result, caught, shakes: caught ? 3 : 1 + Math.floor(Math.random() * 3) };
      Sound.play('tap'); say(`You threw the ${b.name}!`);
      const total = 700 + 500 + G.throw.shakes * SHAKE_MS;
      setTimeout(() => {
        if (arenaGame !== G) return;
        const w = G.wild.raw;
        if (caught) {
          const where = Game.catchLegend(w);
          G.state = 'caught'; G.at = now(); Sound.play('evolve');
          say(`Gotcha! <b>${esc(G.wild.name)}</b> was caught! {i:sparkle}`, where === 'party' ? 'It joined your party.' : 'Your party is full — it was sent to your PC Box (Party → PC Box).');
          G.wild = null;
        } else if (!w.legend) {
          G.state = 'fled'; G.at = now(); Sound.play('sad');
          say(`Oh no! The boss ${esc(G.wild.name)} broke free and ran off…`, 'Better luck at the end of your next exploration!');
          setTimeout(() => { if (G.state === 'fled') G.wild = null; }, 1000);
        } else {
          const n = Game.addFragment(w.sp);
          G.state = 'fled'; G.at = now(); Sound.play('sad');
          say(`Oh no! ${esc(G.wild.name)} broke free and fled…`,
            `It left behind a {i:fragment} ${esc(G.wild.name)} Fragment (${Math.min(n, Game.FRAGMENTS_TO_SUMMON)}/${Game.FRAGMENTS_TO_SUMMON}). ${n >= Game.FRAGMENTS_TO_SUMMON ? 'You can summon it from Bag → Items!' : `Collect ${Game.FRAGMENTS_TO_SUMMON} to summon it.`}`);
          setTimeout(() => { if (G.state === 'fled') G.wild = null; }, 1000);
        }
        afterFloor();
      }, total);
    }
    /** a Poké Ball for the catch reel and throws: the ball pictures (assets/ui/*ball.png, the same icons as the Bag) */
    const SHAKE_MS = 1000;            // each wobble of the thrown ball lasts one second
    const BALL_PIC = { poke: 'pokeball', great: 'greatball', ultra: 'ultraball', master: 'masterball' };
    function drawBall(g, kind, x, y, r, rot = 0) {
      const c = PX.get(BALL_PIC[kind] || 'pokeball'), d = Math.round(r * 2.3);   // the picture has a little padding round the ball
      const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
      if (rot) { g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(rot); g.drawImage(c, -d / 2, -d / 2, d, d); g.restore(); }
      else g.drawImage(c, Math.round(x - d / 2), Math.round(y - d / 2), d, d);
      g.imageSmoothingEnabled = sm;
    }
    /** arcade-style catch reel: an arch of balls slides sideways and stops under the pointer */
    function drawWheel(ms) {
      const W0 = G.wheel; if (!W0) return;
      const SG = W0.segs || SEGS, n = SG.length;
      if (W0.spinning) {
        const k = Math.min(1, (ms - W0.t0) / W0.dur), e = 1 - Math.pow(1 - k, 4);
        W0.offset = W0.from + (W0.to - W0.from) * e;
        const at = Math.round(W0.offset);
        if (at !== W0.lastSeg) { W0.lastSeg = at; Sound.play('blip'); }
      }
      const off = W0.offset || 0;
      ac.fillStyle = 'rgba(10,8,30,.35)'; ac.fillRect(0, 0, AW, AH);
      const r = Math.max(16, Math.min(26, AW * .062)), band = r * 2.7;
      const RB = AW * 1.05, cx0 = AW / 2, apex = AH * .32, cy0 = apex + RB;              // a wide, gentle arch
      const span = Math.asin(Math.min(.98, (AW * .56) / RB));
      const top = -Math.PI / 2;
      // the band
      ac.lineCap = 'round';
      ac.beginPath(); ac.arc(cx0, cy0, RB, top - span, top + span); ac.strokeStyle = '#2b2d42'; ac.lineWidth = band + 6; ac.stroke();
      ac.beginPath(); ac.arc(cx0, cy0, RB, top - span, top + span); ac.strokeStyle = '#ecebe6'; ac.lineWidth = band; ac.stroke();
      ac.beginPath(); ac.arc(cx0, cy0, RB - band * .32, top - span, top + span); ac.strokeStyle = 'rgba(0,0,0,.06)'; ac.lineWidth = band * .3; ac.stroke();
      ac.lineCap = 'butt';
      // the balls
      const step = (r * 2.5) / RB, first = Math.floor(off - span / step) - 1, last = Math.ceil(off + span / step) + 1;
      for (let k = first; k <= last; k++) {
        const ang = top + (k - off) * step;
        if (Math.abs(ang - top) > span - step * .2) continue;
        const kind = SG[((k % n) + n) % n], d = Math.abs(k - off);
        const sc = d < .5 ? 1.18 - d * .36 : 1;                                             // the one under the pointer pops a little
        drawBall(ac, kind, cx0 + Math.cos(ang) * RB, cy0 + Math.sin(ang) * RB, r * sc);
      }
      // pointer
      const py = apex - band / 2 - 4;
      ac.beginPath(); ac.moveTo(cx0 - 13, py - 16); ac.lineTo(cx0 + 13, py - 16); ac.lineTo(cx0, py + 4); ac.closePath();
      ac.fillStyle = '#ffcb05'; ac.fill(); ac.lineWidth = 3; ac.lineJoin = 'round'; ac.strokeStyle = '#2b2d42'; ac.stroke();
      if (W0.boostAt && ms - W0.boostAt < 900) { ac.fillStyle = `rgba(255,255,255,${.7 * (1 - (ms - W0.boostAt) / 900)})`; ac.fillRect(0, 0, AW, AH); }
    }
    function drawThrow(ms, wx, wy, size) {
      const T = G.throw; if (!T) return null;
      const e = ms - G.at, sx = AW * .2, sy = AH * .8;
      if (e < 700) {                                   // the ball flies in an arc
        const k = e / 700, x = sx + (wx - sx) * k, y = sy + (wy - size * 1.4 - sy) * k - Math.sin(k * Math.PI) * AH * .25;
        drawBall(ac, T.kind, x, y, 16, k * 12);
        return 'show';
      }
      if (e < 1200) {                                  // the Pokémon is pulled into the ball
        const k = (e - 700) / 500;
        ac.fillStyle = `rgba(255,255,255,${.6 * (1 - k)})`; ac.fillRect(0, 0, AW, AH);
        drawBall(ac, T.kind, wx, wy - 14, 16);
        return k < .5 ? 'flash' : 'hide';
      }
      const se = e - 1200, shake = Math.floor(se / SHAKE_MS), within = (se % SHAKE_MS) / SHAKE_MS;
      if (shake < T.shakes) {                          // wobble… wobble…
        const rot = within < .5 ? Math.sin(within * Math.PI * 4) * .4 : 0;
        if (within < .1 && G.lastShake !== shake) { G.lastShake = shake; Sound.play('tap'); }
        drawBall(ac, T.kind, wx, wy - 14, 16, rot);
        return 'hide';
      }
      return T.caught ? 'hide' : 'show';
    }
    function drawThrowState(ms) { return drawThrow(ms, AW * .72, AH * WILD_Y, Math.min(AW, AH) * .11); }

    function afterFloor() {
      if (G.floor >= Game.EXPLORE_MAX_FLOOR) {
        say(epMsg.innerHTML + '<small>You reached the end of the map!</small>');
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
    // inBattle: used while a wild Pokémon is waiting; it then gets to attack first
    function showItems(inBattle) {
      G.itemsInBattle = !!inBattle;
      const p = Game.pet(), hpPct = Math.round(Math.max(0, G.meHp) / G.me.maxHp * 100);
      say(`Use an item? <small>HP ${hpPct}% · Food ${Math.round(p.food)} · Energy ${Math.round(p.ene)}${inBattle ? ' · the wild Pokémon will attack first' : ''}</small>`);
      const list = [];
      // healing items from the Bag first (Potions, Sitrus Berry, Oran Berry)
      Object.keys(Game.ITEMS).filter(k => Game.ITEMS[k].heal && Game.itemCount(k)).forEach(k => {
        const it = Game.ITEMS[k];
        list.push({ label: `{i:${it.icon}} ${it.name.replace(' Berry', '')} ×${Game.itemCount(k)}`, cls: 'gold', fn: () => useInDungeon('heal', k) });
      });
      if (Game.itemCount('oran')) list.push({ label: `{i:oran} Oran ×${Game.itemCount('oran')}`, cls: 'gold', fn: () => useInDungeon('oran') });
      if (Game.itemCount('lemonade')) list.push({ label: `{i:lemonade} Lemonade ×${Game.itemCount('lemonade')}`, cls: 'gold', fn: () => useInDungeon('lemonade') });
      if (Game.itemCount('rareCandy')) list.push({ label: `{i:rareCandy} Candy ×${Game.itemCount('rareCandy')}`, cls: 'alt', fn: () => useInDungeon('rareCandy') });
      FLAVORS.forEach((f, i) => list.push({ label: `{i:${f.icon}} ${f.label.replace(' Berry', '')}`, cls: 'alt', fn: () => useInDungeon('berry', i) }));
      list.push({ label: '{i:poffin} Poffin', cls: 'alt', fn: () => useInDungeon('poffin') });
      list.push({ label: '← Back', cls: 'red', fn: () => { if (inBattle) { say(`The wild ${esc(G.wild.name)} is waiting…`); encounterButtons(); } else { say('What next?'); afterFloor(); } } });
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
      } else if (kind === 'heal') {
        const it = Game.ITEMS[i], before = Math.max(0, G.meHp), r = Game.useHeal(i);
        if (r.error) { toast(r.error); return showItems(G.itemsInBattle); }
        healHp(r.heal); Sound.play('level');
        msg = `${nm} used ${/^[AEIOU]/.test(it.name) ? 'an' : 'a'} {i:${it.icon}} ${it.name}! <small>+${Math.round(G.meHp - before)} HP${i === 'sitrus' ? ' · +35 food' : ''}</small>`;
      } else if (kind === 'lemonade') {
        const r = Game.useItem('lemonade'); if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return showItems(); }
        Sound.play('level'); msg = `${nm} drank a {i:lemonade} Lemonade! <small>+50 energy</small>`;
      } else if (kind === 'rareCandy') {
        const ratio = Math.max(0, G.meHp) / G.me.maxHp, r = Game.useItem('rareCandy');
        if (r.error) { toast(r.error === 'none' ? 'You have none left.' : r.error); return showItems(); }
        const p = Game.pet();
        if (G.cur === 0) { G.me = Game.battler(p.sp, Game.level(), true); G.meHp = Math.round(G.me.maxHp * ratio); }   // the candy levels your Main
        Sound.play('level'); msg = `${nm} grew to Lv ${Game.level()}! {i:sparkle} <small>Its battle stats went up</small>`;
      }
      G.tired = Game.pet().ene < 8;
      $('#arenaInfo').innerHTML = icons(`B${G.floor}F &nbsp;{i:energy}${Math.round(Game.pet().ene)}`);
      if (G.itemsInBattle && G.wild) {           // mid-encounter: the wild Pokémon gets the first move
        G.wildFirst = true; say(msg + `<small>The wild ${esc(G.wild.name)} is getting ready…</small>`);
        return encounterButtons();
      }
      say(msg);
      if (G.tired) return buttons([{ label: '{i:map} Too tired — go home', cls: 'gold', fn: () => finish(true) }]);
      afterFloor();
    }
    function finish(early, lost) {
      if (G.over) return; G.over = true;
      Game.exploreEnd({ floor: G.floor, wins: G.wins, lost: !!lost });
      closeArena();
      const found = Object.entries(G.finds).map(([k, n]) => `{i:${Game.ITEMS[k].icon}}${n > 1 ? '×' + n : ''}`).join(' ');
      const thanks = G.team[1] && G.team[1].owner ? ` · thanks, ${esc(G.team[1].owner)}'s ${esc(G.team[1].nm())}!` : '';
      toast(`Explored to B${G.floor}F${G.wins ? ` · won ${G.wins} battle${G.wins > 1 ? 's' : ''}` : ''}${found ? ' · found ' + found : ''}${thanks}`, 5000);
      Talk.clear(); setTimeout(() => Talk.say(lost ? 'exploreLose' : 'exploreBack', { prio: 2 }), 300);
    }
    G.finish = early => finish(early, false);

    let last2 = now();
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), t = ms / 1000;
      const P = Game.pet(); if (!P) return;
      const live = G.wild && G.state !== 'fled' && G.state !== 'caught';
      const intro = G.intro && G.wild ? ms - G.intro.at : -1, introOn = intro >= 0 && intro < LEGEND_INTRO_MS + 600;
      Music.set(introOn && intro < LEGEND_REVEAL_MS ? 'silent' : live && G.wild.legend ? 'legend' : live && G.wild.boss ? 'boss' : 'dungeon');
      const walking = G.state === 'walk';
      if (walking) G.scroll = (G.scroll || 0) + 70 * Math.min(.05, (ms - last2) / 1000);
      last2 = ms;
      // the ground rumbles as a legendary approaches, and jolts when it appears
      let shx = 0, shy = 0;
      if (introOn) {
        const amp = intro < LEGEND_REVEAL_MS ? 1 + intro / LEGEND_REVEAL_MS * 4 : Math.max(0, 10 * (1 - (intro - LEGEND_REVEAL_MS) / 700));
        shx = (Math.random() - .5) * amp * 2; shy = (Math.random() - .5) * amp * 2;
      }
      ac.save(); ac.translate(Math.round(shx), Math.round(shy));
      drawCave(G, ms, walking);
      const size = Math.min(AW, AH) * .11, meX = (G.wild || G.state === 'won') ? AW * .28 : AW * .4, meY = Math.round(AH * ME_Y);
      const wx = AW * .72, wy = AH * WILD_Y;
      // the wild Pokémon (top-right) and its HP box
      const drawWild = () => {
        if (G.state === 'caught' && ms - G.at < 2500 && G.throw) {   // celebration stars over the ball
          drawBall(ac, G.throw.kind, wx, wy - 14, 16);
          for (let i = 0; i < 3; i++) PX.draw(ac, 'sparkle', wx + Math.cos(ms / 200 + i * 2) * 30, wy - 40 + Math.sin(ms / 200 + i * 2) * 12, 18);
        }
        const throwing = G.state === 'throw' ? drawThrowState(ms) : null;
        if (!((G.wild && G.state !== 'won' && throwing !== 'hide') || (G.state === 'won' && ms - G.at < 900))) return;
        const hurt = G.hurt === 'wild' && ms - G.hurtAt < 450, att = G.act === 'wild' && ms - G.actAt < 600;
        const fade = G.state === 'won' ? Math.max(0, 1 - (ms - G.at) / 800) : G.state === 'fled' ? Math.max(0, 1 - (ms - G.at) / 900) : 1;
        const shadow = introOn && intro < LEGEND_REVEAL_MS;                      // still a dark shape before the reveal
        const pop = introOn && intro >= LEGEND_REVEAL_MS ? 1 + .18 * Math.max(0, 1 - (intro - LEGEND_REVEAL_MS) / 450) : 1;
        if (G.wild.boss && !G.wild.legend && G.state !== 'fled') { const gr = ac.createRadialGradient(wx, wy - size, 4, wx, wy - size, size * 2.4); gr.addColorStop(0, 'rgba(255,90,70,.4)'); gr.addColorStop(1, 'rgba(255,90,70,0)'); ac.fillStyle = gr; ac.fillRect(wx - size * 3, wy - size * 3.5, size * 6, size * 6); }
        if (G.wild.legend && G.state !== 'fled' && !shadow) { const gr = ac.createRadialGradient(wx, wy - size, 4, wx, wy - size, size * 2.4); gr.addColorStop(0, 'rgba(255,220,120,.45)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); ac.fillStyle = gr; ac.fillRect(wx - size * 3, wy - size * 3.5, size * 6, size * 6); }
        const fled = G.state === 'fled', runX = fled ? Math.pow((ms - G.at) / 900, 1.4) * AW * .4 : 0;   // dashes off to the right
        pixelShadow(ac, wx + runX, wy, size * .8, size * .18, .22 * fade, size / 10);
        drawCreature(ac, G.wild.id, { x: wx + (att ? -size * .4 : 0) + runX, y: wy, size: size * (G.wild.boss ? 1.25 : .95) * pop, silhouette: throwing === 'flash' ? '#ffffff' : shadow ? '#0d0820' : false, t, maxH: AH * .26 * pop, shiny: G.wild.shiny, dir: fled ? 'right' : 'downleft', walking: fled,
          anim: hurt ? 'Hurt' : att ? 'Attack' : undefined, animT: hurt ? (ms - G.hurtAt) / 1000 : att ? (ms - G.actAt) / 1000 : undefined, alpha: (hurt && Math.floor(ms / 80) % 2 ? .4 : 1) * fade * (shadow ? Math.min(1, intro / 900) : 1) });
        if (!['wheel', 'throw', 'fled'].includes(G.state) && !introOn) hpBox(ac, 10, 10, Math.min(250, AW * .62), (G.wild.legend ? '★ ' : G.wild.boss ? 'BOSS ' : '') + G.wild.name, G.wild.level, G.wildHp, G.wild.maxHp, false);
      };
      // your team: the fighter in front, the Backup following along behind while exploring
      const A = G.team[G.cur];
      const celebrate = (G.state === 'chest' && G.chest && G.chest.open) || G.state === 'egg', ce = ms - G.at;
      const jumpH = celebrate && ce < 2600 ? Math.abs(Math.sin(ce / 1000 * Math.PI * 2.3)) * size * .7 : 0;   // happy jumps, facing you
      const hopT = ((ms - G.at) / 1000) % Math.max(.4, animLength(A.sp, 'Hop') + .3);
      const drawMember = (M, x, sc, extra) => {
        const hopY = extra.hop || 0, k = Math.max(.35, 1 - hopY / (size * 1.6));
        if (extra.alpha !== 0) pixelShadow(ac, x, meY, size * .9 * sc * k, size * .2 * sc * k, .22 * (extra.alpha == null ? 1 : extra.alpha), size / 10);
        return drawCreature(ac, M.sp, Object.assign({ x, y: meY, size: size * sc, t, maxH: AH * .3 * sc, shiny: M.shiny }, extra));
      };
      const drawMe = () => {
        const hurtMe = G.hurt === 'me' && ms - G.hurtAt < 450, attMe = G.act === 'me' && ms - G.actAt < 600;
        const baseDir = walking ? 'right' : celebrate ? 'front' : G.wild || G.state === 'won' || G.state === 'lost' ? 'upright' : 'downright';
        const sw = G.swapAt ? ms - G.swapAt : -1;
        if (sw >= 0 && sw < SWAP_OUT_MS + SWAP_IN_MS) {
          if (sw < SWAP_OUT_MS + 350) {             // the Main faints: slumps, flickers and fades away
            const k = Math.min(1, sw / SWAP_OUT_MS);
            drawMember(G.team[0], meX, 1, { dir: 'upright', anim: 'Hurt', animT: Math.min(.6, sw / 1000), alpha: (1 - k) * (Math.floor(sw / 90) % 2 ? .5 : 1), hop: -k * size * .15 });
          }
          if (sw >= SWAP_OUT_MS) {                  // the Backup dashes in from the left side of the screen
            const f = sw - SWAP_OUT_MS, runK = Math.min(1, f / 800), ease = 1 - Math.pow(1 - runK, 2);
            const x = -size * 1.5 + (meX + size * 1.5) * ease, arrived = runK >= 1;
            for (let i = 0; i < 3 && !arrived; i++) {   // dust puffs kicked up behind it
              const dk = ((f / 260) + i / 3) % 1;
              ac.fillStyle = `rgba(230,225,210,${.45 * (1 - dk)})`; ac.beginPath(); ac.arc(x - size * (.5 + dk * .8), meY - 4 - dk * 10, size * (.12 + dk * .18), 0, Math.PI * 2); ac.fill();
            }
            const hop = arrived ? Math.abs(Math.sin(Math.min(1, (f - 800) / 400) * Math.PI)) * size * .4 : 0;   // a ready-to-fight hop on arrival
            drawMember(G.team[1], x, 1, { dir: arrived ? 'upright' : 'right', walking: !arrived, hop });
          }
        } else {
          drawMember(A, meX + (attMe ? size * .4 : 0), 1, { dir: baseDir, walking, hop: jumpH,
            anim: G.state === 'lost' ? 'Hurt' : hurtMe ? 'Hurt' : attMe ? 'Attack' : (G.state === 'won' || celebrate) ? 'Hop' : undefined,
            animT: hurtMe ? (ms - G.hurtAt) / 1000 : attMe ? (ms - G.actAt) / 1000 : (G.state === 'won' || celebrate) ? hopT : undefined,
            alpha: hurtMe && Math.floor(ms / 80) % 2 ? .4 : 1 });
          if (celebrate && ce < 3000) for (let i = 0; i < 3; i++) {   // little hearts float up while it jumps for joy
            const hk = ((ce / 1000 + i * .33) % 1);
            PX.draw(ac, 'heart', meX + (i - 1) * size * .55, meY - size * 1.9 - jumpH - hk * size * .9, 18, { alpha: Math.min(1, (1 - hk) * 2) * Math.min(1, (3000 - ce) / 400) });
          }
        }
        drawEndure(G, ms, meX, meY - size * 2.2);
        if ((G.wild || G.state === 'won' || G.state === 'lost') && !introOn) {
          const bw = Math.min(250, AW * .62), bxp = AW - bw - 10;
          hpBox(ac, bxp, AH - 70, bw, A.nm(), G.me.level, G.meHp, G.me.maxHp, true);
          if (G.team[1]) G.team.forEach((M, i) => {   // one ball per team member; a fainted one is dimmed
            ac.globalAlpha = M.fainted ? .3 : 1; drawBall(ac, 'poke', bxp + 14 + i * 20, AH - 80, 7); ac.globalAlpha = 1;
          });
        }
      };
      if (introOn) {            // legendary entrance: you, then the darkness and beams, then its shadow, then the flash and banner
        drawMe(); drawLegendIntro(G, ms, wx, wy, size, 'back'); drawWild(); drawLegendIntro(G, ms, wx, wy, size, 'front');
      } else { drawWild(); drawMe(); }
      if (G.legendAt && ms - G.legendAt < 1200) { ac.fillStyle = `rgba(255,240,190,${.75 * (1 - (ms - G.legendAt) / 1200)})`; ac.fillRect(0, 0, AW, AH); }
      if (G.state === 'wheel') drawWheel(ms);
      // treasure / egg props
      if (G.state === 'chest' && G.chest) {
        const cxp = AW * .68, cyp = AH * .7;
        PX.draw(ac, 'chest', cxp, cyp, 64, { rot: G.chest.open ? 0 : Math.sin(ms / 60) * .06 });
        if (G.chest.item) { const k = Math.min(1, (ms - G.at) / 600); PX.draw(ac, Game.ITEMS[G.chest.item].icon, cxp, cyp - 30 - k * 34, 48); }
      }
      if (G.state === 'egg') PX.draw(ac, 'egg_legend_0', AW * .68, AH * .66 - Math.abs(Math.sin(t * 3)) * 6, 64);
      ac.restore();
      // floor label
      if (walking) {
        const k = Math.min(1, (ms - G.at) / 400);
        ac.globalAlpha = k; ac.fillStyle = 'rgba(15,20,45,.6)'; ac.fillRect(0, AH * .14, AW, 54);
        ac.fillStyle = '#fff'; ac.textAlign = 'center'; ac.font = '800 30px \"Nunito\", system-ui, sans-serif';
        ac.fillText(`${G.caveName}  B${G.floor}F`, AW / 2, AH * .14 + 38); ac.textAlign = 'left'; ac.globalAlpha = 1;
      }
    };
    arenaGame = G; requestAnimationFrame(G.loop);
    if (opts.demo === 'legend') { G.floor = 3; info(); encounter(Game.rollLegend(G.map) || undefined); return; }
    if (opts.demo === 'swap' && G.team[1]) { G.floor = 2; info(); encounter(Game.rollWild(G.map)); G.state = 'battle'; buttons([]); G.meHp = 0; swapIn(); return; }
    if (opts.demo === 'chest') {
      G.floor = 2; info(); const k = Game.rollTreasure(2);
      G.state = 'chest'; G.chest = { open: true, item: k }; G.at = now(); say(`Found {i:${Game.ITEMS[k].icon}} <b>${Game.ITEMS[k].name}</b>!`); return;
    }
    if (opts.demo) {
      G.floor = Game.EXPLORE_MAX_FLOOR; info(); encounter(Game.rollBoss(G.map));
      if (/^wheel/.test(opts.demo)) { G.wildHp = 1; G.wins++; if (opts.demo === 'wheel') ['greatBall', 'ultraBall', 'masterBall'].forEach(k => { if (!Game.itemCount(k)) Game.addItem(k); }); startWheel(); const k = { wheelgreat: 'greatBall', wheelultra: 'ultraBall', wheelmaster: 'masterBall' }[opts.demo]; if (k) { Game.addItem(k); boostWheel(k); G.wheel.boostAt = 0; } }
      if (opts.demo === 'throw') { G.wildHp = 1; G.wins++; startWheel(); G.wheel.result = 'great'; throwBall(); }
      return;
    }
    nextFloor();
  }

  // ======================= online: account, friends, trades, battles =======================
  const ON = () => Online.state;
  let onlineTab = 'friends', onlineOpen = false, searchResult = null, searchMsg = '';
  const fmtTrainer = t => t ? `${esc(t.name)}${t.code ? ` <span class="muted">(${esc(t.code)})</span>` : ''}` : '—';
  function monFace(sp, shiny) { const f = portraitUrl(sp, shiny, 'Normal'); return f ? `<img class="face" src="${f}" alt="">` : miniCanvas(sp, { px: 52, shiny }); }
  /** your current main Pokémon's face, in a Poké Ball ring (egg picture while it's still an egg) */
  function trainerFace() {
    const p = Game.pet(), f = p && !p.egg && portraitUrl(p.sp, p.shiny, 'Normal');
    const src = f || (p ? PX.url(`egg_${SPECIES_BY_ID[p.sp].tier || 'common'}_0`) : PX.url('friends'));
    return `<span class="tface"><img src="${src}" alt="" class="${f ? '' : 'egg'}"></span>`;
  }
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
      body = `<div class="trainer">${trainerFace()}<div class="sp"><b>${esc(P.username)}</b><small>ID ${esc(P.code)}</small></div><button class="btn alt" id="onSignOut" style="width:auto;padding:8px 12px">Sign out</button></div>
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
    on('[data-tc]', 'click', e => {
      // read the trade now: e.currentTarget is null by the time a Pokémon is picked
      const id = e.currentTarget.dataset.tc, t = trade(id);
      if (!t) { toast('That trade is no longer available.'); openOnline('trades'); return; }
      pickForTrade(`Pick a Pokémon to give ${t.fromName}`, async key => {
        const cur = trade(id);
        if (!cur || cur.status !== 'offered') throw new Error('That trade is no longer available.');
        await Online.counterTrade(cur, key); toast('Sent! They just need to confirm.'); openOnline('trades');
      }, () => openOnline('trades'));
    });
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
  function pickForTrade(title, onPick, onBack) {
    const list = Game.tradeable();
    if (!list.length) { toast('You need a Pokémon in your party or PC Box (not your main) to trade.'); return; }
    openSheet(head('Choose a Pokémon') + `<p class="muted">${esc(title)}. Your main can't be traded. The one you pick is locked until the trade finishes or is cancelled.</p>
      <div class="partylist">${list.map((x, i) => `<div class="pslot">${monFace(x.pet.sp, x.pet.shiny)}<div class="pi"><b>${monLine(x.pet)}</b><small>${x.where === 'box' ? 'PC Box' : 'Party'} · OT ${x.pet.ot ? esc(x.pet.ot.name) : '—'}</small></div><div class="acts"><button data-pick="${i}">Choose</button></div></div>`).join('')}</div>
      <div class="btns"><button class="btn alt" id="pickBack">← Back</button></div>`);
    sheet.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await onPick(list[+b.dataset.pick].pet.key); } catch (er) { toast(er.message || String(er)); b.disabled = false; }
    }));
    $('#pickBack').addEventListener('click', () => (onBack ? onBack() : openOnline()));
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
    Music.set('boss');                                   // trainer battles get the boss theme (closeArena switches back)
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
        G.act = turn; G.actAt = now(); Sound.attack();
        setTimeout(() => {
          if (arenaGame !== G) return;
          if (turn === 'me') G.oppHp -= dmg; else G.meHp -= dmg;
          const endured = turn !== 'me' && bondEndure(G, me.maxHp);
          G.hurt = turn === 'me' ? 'opp' : 'me'; G.hurtAt = now(); Sound.damage(crit);
          say(`${turn === 'me' ? esc(petName()) : `${esc(friend.username)}'s ${esc(opp.name)}`} attacks!${crit ? ' A critical hit!' : ''}${endured ? ` {i:heart} ${esc(petName())} endured the hit for you!` : ''}`, endured ? `${dmg} damage · its bond with you kept it standing at 1% HP` : `${dmg} damage`);
          if (G.oppHp <= 0 || G.meHp <= 0) return setTimeout(() => end(G.oppHp <= 0), 700);
          turn = turn === 'me' ? 'opp' : 'me'; setTimeout(step, 750);
        }, 380);
      };
      setTimeout(step, 400);
    }
    function end(won) {
      G.state = won ? 'won' : 'lost'; G.at = now(); Sound.play(won ? 'level' : 'sad');
      say(won ? `You beat ${esc(friend.username)}'s ${esc(opp.name)}!` : `${esc(friend.username)}'s ${esc(opp.name)} won this time…`, won ? `${esc(petName())} feels proud!` : 'Train in Explore → Training and try again.');
      Online.recordBattle(friend, won, { sp: p.sp, level: me.level, shiny: !!p.shiny }, { sp: opp.id, level: opp.level, shiny: !!opp.shiny }).catch(() => {});
      Game.exploreEnd({ floor: 0, wins: won ? 1 : 0, lost: !won });
      buttons([{ label: 'Done', cls: 'red', fn: () => G.finish(true) }]);
    }
    G.finish = () => { if (G.over) return; G.over = true; closeArena(); Talk.say(G.state === 'won' ? 'exploreBack' : G.state === 'lost' ? 'exploreLose' : 'pet', { prio: 2 }); };
    G.loop = () => {
      if (arenaGame !== G) return;
      requestAnimationFrame(G.loop);
      const ms = now(), t = ms / 1000;
      if (!drawExploreBg({ state: 'battle', at: 0, floor: 0 }, ms)) { const g2 = ac.createLinearGradient(0, 0, 0, AH); g2.addColorStop(0, '#5aa0e6'); g2.addColorStop(.55, '#bfe3ff'); g2.addColorStop(.56, '#7cc35a'); g2.addColorStop(1, '#4f9a3f'); ac.fillStyle = g2; ac.fillRect(0, 0, AW, AH); }
      const size = Math.min(AW, AH) * .11, wx = AW * .72, wy = AH * WILD_Y, mx = AW * .28, my = AH * ME_Y;
      const oh = G.hurt === 'opp' && ms - G.hurtAt < 450, oa = G.act === 'opp' && ms - G.actAt < 600, mh = G.hurt === 'me' && ms - G.hurtAt < 450, ma = G.act === 'me' && ms - G.actAt < 600;
      for (const [x, y, s2] of [[wx, wy, size * .8], [mx, my, size * .9]]) { pixelShadow(ac, x, y, s2, s2 * .22, .22, s2 / 8.5); }
      drawCreature(ac, opp.id, { x: wx + (oa ? -size * .4 : 0), y: wy, size: size * .95, t, maxH: AH * .26, shiny: opp.shiny, dir: 'downleft', anim: oh ? 'Hurt' : oa ? 'Attack' : undefined, animT: oh ? (ms - G.hurtAt) / 1000 : oa ? (ms - G.actAt) / 1000 : undefined, alpha: (oh && Math.floor(ms / 80) % 2 ? .4 : 1) * (G.state === 'won' ? Math.max(0, 1 - (ms - G.at) / 800) : 1) });
      drawCreature(ac, p.sp, { x: mx + (ma ? size * .4 : 0), y: my, size, t, maxH: AH * .3, shiny: p.shiny, dir: 'upright', anim: mh ? 'Hurt' : ma ? 'Attack' : G.state === 'won' ? 'Hop' : undefined, animT: mh ? (ms - G.hurtAt) / 1000 : ma ? (ms - G.actAt) / 1000 : G.state === 'won' ? ((ms - G.at) / 1000) % Math.max(.4, animLength(p.sp, 'Hop') + .3) : undefined, alpha: mh && Math.floor(ms / 80) % 2 ? .4 : 1 });
      drawEndure(G, ms, mx, my - size * 2.2);
      hpBox(ac, 10, 10, Math.min(250, AW * .62), `${friend.username}'s ${opp.name}`.slice(0, 22), opp.level, G.oppHp, opp.maxHp, false);
      hpBox(ac, AW - Math.min(250, AW * .62) - 10, AH - 70, Math.min(250, AW * .62), petName(), me.level, G.meHp, me.maxHp, true);
    };
    arenaGame = G; requestAnimationFrame(G.loop);
  }

  // ======================= game events =======================
  Game.on((ev, d) => {
    if (ev === 'config') { setTimeout(showAnnouncement, 1500); updateMailDot(); return; }
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
        if (!b.egg && d.woke) msg += ` It slept the whole time and woke up rested (energy ${b.ene}).`;
        else if (!b.egg && d.asleep) msg += ` It's still asleep, recharging (energy ${b.ene}).`;
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
    // this Pokémon's own chatter: its personality and its type
    pool.push('chatNature', 'chatNature', 'chatType', 'chatType');
    // the day of the week and the time of year
    const d = new Date(), dow = d.getDay(), md = (d.getMonth() + 1) * 100 + d.getDate();
    if (dow === 0 || dow === 6) pool.push('chatWeekend'); else if (dow === 1) pool.push('chatMonday'); else if (dow === 5) pool.push('chatFriday');
    if (md >= 1220 && md <= 1226) pool.push('chatChristmas', 'chatChristmas');
    if (md >= 1231 || md <= 102) pool.push('chatNewYear', 'chatNewYear');
    if (md >= 1025 && md <= 1031) pool.push('chatHalloween', 'chatHalloween');
    if (md === 214) pool.push('chatValentine', 'chatValentine');
    // who it is and who it lives with
    const friends = (ST().player.party || []).filter(m => m && !m.egg && m.sp !== p.sp);
    const friend = friends.length ? friends[Math.floor(Math.random() * friends.length)] : null;
    if (friend) pool.push('chatParty');
    if (p.shiny) pool.push('chatShiny');
    if (SPECIES_BY_ID[p.sp] && SPECIES_BY_ID[p.sp].tier === 'legend') pool.push('chatLegend');
    const days = Math.floor((Date.now() - (p.hatchedAt || Date.now())) / 86400000);
    if (days >= 3) pool.push('chatTogether');
    if (ST().player.streak >= 7) pool.push('chatStreakLong');
    const k = pool[Math.floor(Math.random() * pool.length)];
    Talk.say(k, { prio: 0, vars: { n: ST().player.streak, days, friend: friend ? (friend.name || (SPECIES_BY_ID[friend.sp] || {}).name || 'my friend') : 'my friend' } });
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
    if (cp && !cp.egg && V.loaded !== cp.sp + ':' + cp.shiny) { V.loaded = cp.sp + ':' + cp.shiny; preloadSpecies(cp.sp, cp.shiny);
      // what it could evolve into: just the idle pose (for the evolution animation), a little later
      const evoTo = [...new Set(Game.evoMethods(cp.sp).map(m => m.to))];
      setTimeout(() => evoTo.forEach(n => preloadSpecies(n, cp.shiny, ['Idle'])), 4000); }
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.sleepNow(); else Game.resume(); });
  window.addEventListener('pagehide', () => Game.sleepNow());

  // the dock / header icons are drawn as smooth SVG, then re-rendered small so they read as chunky pixel art
  function pixelizeIcons() {
    const defs = document.querySelector('#dkDefs defs');
    document.querySelectorAll('svg.dk').forEach(svg => {
      const css = svg.getBoundingClientRect().width || 32, n = Math.max(16, Math.round(css * .75));
      const c = svg.cloneNode(true);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', '48'); c.setAttribute('height', '48');
      if (defs) c.insertBefore(defs.cloneNode(true), c.firstChild);
      const im = new Image();
      im.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = cv.height = n;
          const g = cv.getContext('2d'); g.drawImage(im, 0, 0, n, n);
          const d = g.getImageData(0, 0, n, n), a = d.data;
          for (let i = 3; i < a.length; i += 4) a[i] = a[i] < 110 ? 0 : 255;   // hard pixel edges
          g.putImageData(d, 0, 0);
          const out = new Image(); out.className = 'dk'; out.alt = ''; out.setAttribute('aria-hidden', 'true'); out.src = cv.toDataURL();
          svg.replaceWith(out);
        } catch (e) { /* keep the smooth icon */ }
      };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    });
  }
  pixelizeIcons();
  PX.hydrate();
  if (window.PP_PREVIEW) {                                  // ?preview&demo=boss|wheel|wheelgreat|wheelmaster|legend|swap|chest|team[&map=thunder|sea|volcano]: jump straight to a dungeon moment
    const qs = new URLSearchParams(location.search), demo = qs.get('demo');
    if (demo) setTimeout(() => {
      const p = Game.pet(); if (p && p.asleep) Game.toggleSleep(); if (p) { p.ene = Math.max(p.ene, 80); p.food = Math.max(p.food, 80); }
      if (demo === 'team') return openTeam(qs.get('map') || 'cave');                     // the Main + Backup picker
      startExplore({ demo, map: qs.get('map'), sub: Game.party()[0] });                 // demo=legend|swap|chest bring a Backup
    }, 1500);
  }
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
  setTimeout(showAnnouncement, 2500);
  if (!ST().player.starterPicked) startNewGame();
  else setTimeout(greet, 900);
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadController = !!navigator.serviceWorker.controller;
    // the player tapped Refresh and the new version took over: reload once so every file is the new version
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true; Game.save(); location.reload();
    });
    // A new version was published: offer a Refresh bar (checked every minute and whenever the game comes back into view).
    let updateBar = null;
    const offerUpdate = w => {
      if (!w || !navigator.serviceWorker.controller || updateBar) return;
      updateBar = document.createElement('div'); updateBar.id = 'updateBar';
      updateBar.innerHTML = icons(`<img src="icons/icon-192.png?v=2" alt=""><div class="ib"><b>A new version of Pocket Pals is ready</b><small>Refresh to update. Your progress is saved.</small></div>
        <button class="ibgo">Refresh</button><button class="ibx" aria-label="Later">✕</button>`);
      updateBar.querySelector('.ibgo').addEventListener('click', () => { Game.save(); w.postMessage('skipWaiting'); setTimeout(() => location.reload(), 3000); });
      updateBar.querySelector('.ibx').addEventListener('click', () => { updateBar.remove(); });
      document.body.appendChild(updateBar);
    };
    navigator.serviceWorker.register('sw.js').then(reg => {
      if (reg.waiting) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed') offerUpdate(w); });
      });
      const check = () => reg.update().catch(() => {});
      check(); setInterval(check, 60000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    }).catch(() => {});
  }
})();
