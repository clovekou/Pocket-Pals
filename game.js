'use strict';
// Pocket Pal — game state and rules (no DOM). 1 tick = 1 game minute.

const MEDALS = [
  { id: 'lv10',    icon: 'medalBronze', label: 'Level 10',      desc: 'Reach level 10' },
  { id: 'lv25',    icon: 'medalSilver', label: 'Level 25',      desc: 'Reach level 25' },
  { id: 'lv50',    icon: 'medalGold', label: 'Level 50',      desc: 'Reach level 50' },
  { id: 'berry',   icon: 'berrySweet', label: 'Favourite',     desc: 'Find its favourite berry' },
  { id: 'streak7', icon: 'flame', label: '7-day streak',  desc: 'Care 7 days in a row' },
  { id: 'bond',    icon: 'heart', label: 'Best friends',  desc: 'Max out the bond' },
  { id: 'final',   icon: 'crown', label: 'Final form',    desc: 'Reach a final form' },
  { id: 'fit',     icon: 'dumbbell', label: 'Fit',           desc: 'Lv 5+, weight 0, no slip-ups' },
];

const Game = (() => {
  const SAVE_KEY = 'pocketpal.save.v1';
  const MIN_PER_LEVEL = 60;
  const FAREWELL_AGE = 3 * 24 * 60;     // final form + 3 days
  const RUNAWAY_TICKS = 60;             // all four stats at 0 for 1 h
  const OFFLINE_CAP = 14 * 24 * 60;     // catch up at most 2 weeks
  const EGG_AUTO_HATCH = 3;             // minutes
  // registered species before legendaries appear (capped so small rosters can still get them)
  const LEGEND_UNLOCK = Math.max(1, Math.min(15, SPECIES.filter(s => s.tier !== 'legend').length));
  const BOND_DAILY_CAP = 20;

  let S = null;
  const listeners = [];
  let quiet = false;
  const emit = (ev, d) => { if (!quiet || ev === 'save') listeners.forEach(f => f(ev, d)); };
  const clamp = v => Math.max(0, Math.min(100, v));
  const dropTo = (v, amt, floor) => (v <= floor ? v : Math.max(floor, v - amt));
  const rnd = n => Math.floor(Math.random() * n);
  const dayNum = (ms = Date.now()) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);

  function freshPlayer() {
    return {
      streak: 0, bestStreak: 0, lastCareDay: 0, lastMilestone: 0, totalMedals: 0,
      lastEnd: 'none', dex: {}, shiny: {}, favKnown: {}, history: [],
      gameHi: 0, strHi: 0, starterPicked: false,
    };
  }
  function fresh() {
    return { v: 1, lastTick: Date.now(), settings: { sound: true, fast: false }, player: freshPlayer(), pet: null, ceremony: null };
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        S = Object.assign(fresh(), d);
        S.player = Object.assign(freshPlayer(), d.player || {});
        S.settings = Object.assign({ sound: true, fast: false }, d.settings || {});
      }
    } catch (e) { S = null; }
    if (!S) S = fresh();
    // drop anything that refers to species no longer in the roster
    const known = id => !!SPECIES_BY_ID[id];
    for (const k of ['dex', 'shiny', 'favKnown']) for (const id of Object.keys(S.player[k])) if (!known(id)) delete S.player[k][id];
    S.player.history = S.player.history.filter(h => known(h.sp));
    if (S.pet && !known(S.pet.sp)) { S.pet = null; S.ceremony = null; S.player.starterPicked = false; }
    if (S.ceremony) finishEnding();
    // a broken streak shows as 0 straight away
    if (S.player.lastCareDay && dayNum() > S.player.lastCareDay + 1) { S.player.streak = 0; S.player.lastMilestone = 0; }
    return S;
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } }
  function reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} S = fresh(); save(); }

  const msPerMin = () => (S.settings.fast ? 1000 : 60000);
  const pet = () => S.pet;
  const sp = () => (S.pet ? SPECIES_BY_ID[S.pet.sp] : null);
  const level = () => (S.pet && !S.pet.egg ? 1 + Math.floor(S.pet.ageMin / MIN_PER_LEVEL) : 0);
  const lowest = () => { const p = S.pet; return Math.min(p.food, p.joy, p.ene, p.hyg); };
  const isFinal = id => SPECIES_BY_ID[id].next.length === 0;
  const registered = id => !!S.player.dex[id];
  const registeredCount = () => Object.keys(S.player.dex).length;
  const shinyCount = () => Object.keys(S.player.shiny).length;

  // ---------------- time ----------------
  function update(now = Date.now()) {
    if (!S.player.starterPicked || S.ceremony || !S.pet) { S.lastTick = now; return 0; }
    const mpm = msPerMin();
    let n = Math.floor((now - S.lastTick) / mpm);
    if (n <= 0) return 0;
    if (n > OFFLINE_CAP) { S.lastTick = now - OFFLINE_CAP * mpm; n = OFFLINE_CAP; }
    quiet = n > 3;
    const before = snapshot();
    for (let i = 0; i < n && !S.ceremony; i++) { S.lastTick += mpm; tick(); }
    quiet = false;
    save();
    if (n > 3) emit('away', { minutes: n, before, after: snapshot() });
    return n;
  }
  function setFast(on) { S.settings.fast = !!on; S.lastTick = Date.now(); save(); }
  function snapshot() {
    const p = S.pet; if (!p) return null;
    return { egg: !!p.egg, sp: p.sp, level: level(), food: p.food, joy: p.joy, ene: p.ene, hyg: p.hyg, poops: p.poops };
  }

  function tick() {
    const p = S.pet; if (!p) return;
    p.ageMin++;
    if (p.egg) { if (p.ageMin >= EGG_AUTO_HATCH) hatch(); return; }
    const levelUp = p.ageMin % MIN_PER_LEVEL === 0;

    if (p.asleep) {
      p.ene = clamp(p.ene + 6);
      if (p.weight > 0 && p.ageMin % 3 === 0) p.weight--;
      if (p.ageMin % 2 === 0) { p.food = dropTo(p.food, 1, 30); p.joy = dropTo(p.joy, 1, 35); }
      if (p.ageMin % 3 === 0) p.hyg = dropTo(p.hyg, 1, 45);
      if (levelUp) emit('level', level());
      checkMedals();
      return;
    }

    p.food = clamp(p.food - 2);
    p.ene = clamp(p.ene - 1);
    if (p.food > 40 && p.poops < 3 && Math.random() < .15) { p.poops++; emit('poop'); }
    p.hyg = clamp(p.hyg - 1 - 4 * p.poops);
    if (p.weight > 50) p.ene = clamp(p.ene - 1);
    if (p.weight > 0 && p.ageMin % 3 === 0) p.weight--;

    if (lowest() >= 40) { if (++p.goodTicks >= 720) { p.goodTicks = 0; p.tr.def = Math.min(100, p.tr.def + 1); emit('def'); } }
    else p.goodTicks = 0;

    let dJoy = -1;
    if (p.food < 30) dJoy -= 2;
    if (p.hyg < 30) dJoy -= 2;
    p.joy = clamp(p.joy + dJoy);

    if (p.mistakeCd > 0) p.mistakeCd--;
    if (lowest() <= 10 && p.mistakeCd === 0) {
      p.mistakes++; p.mistakeCd = 60;
      if (p.bond > 1) p.bond--;
      emit('slip');
    }
    if (levelUp) emit('level', level());
    checkMedals();

    if (p.food === 0 && p.joy === 0 && p.ene === 0 && p.hyg === 0) { if (p.neglect < RUNAWAY_TICKS) p.neglect++; }
    else p.neglect = 0;
  }

  // ---------------- eggs ----------------
  function careBonus() {
    const st = Math.min(30, S.player.streak);
    const bond = S.pet && !S.pet.egg ? S.pet.bond : 0;
    return Math.floor(st / 3) + Math.floor(bond / 25);
  }
  function lineHasUnregistered(id) {
    if (!registered(id)) return true;
    return SPECIES_BY_ID[id].next.some(lineHasUnregistered);
  }
  function pickEggSpecies() {
    if (registeredCount() === 0) return STARTERS[rnd(STARTERS.length)];
    let tier = 0;
    if (S.player.lastEnd !== 'runaway') {
      const blessed = S.player.lastEnd === 'farewell';
      const rare = (blessed ? 45 : 27) + careBonus();
      const leg = registeredCount() >= LEGEND_UNLOCK ? (blessed ? 10 : 3) + Math.floor(careBonus() / 3) : 0;
      const r = rnd(100);
      if (r < leg) tier = 2; else if (r < leg + rare) tier = 1;
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let t = tier; t >= 0; t--) {
        const cand = SPECIES.filter(s => !s.prev && s.tier === TIER_ORDER[t] && (pass === 1 || lineHasUnregistered(s.id)));
        if (cand.length) return cand[rnd(cand.length)].id;
      }
    }
    return STARTERS[rnd(STARTERS.length)];
  }
  function rollShiny() {
    const denom = Math.max(8, (S.player.lastEnd === 'farewell' ? 24 : 48) - careBonus() * 3);
    return rnd(denom) === 0;
  }
  function makeEgg(id, shiny) { return { egg: true, sp: id, shiny, ageMin: 0, taps: 0 }; }
  function newEgg() {
    const id = pickEggSpecies();
    const shiny = rollShiny();
    S.pet = makeEgg(id, shiny);
    emit('newegg');
  }
  function pickStarter(id) {
    S.player.starterPicked = true;
    S.pet = makeEgg(id, rollShiny());
    S.lastTick = Date.now();
    save();
  }
  function eggTap() {
    const p = S.pet; if (!p || !p.egg) return false;
    p.taps++;
    if (p.taps >= 3) { hatch(); return 'hatched'; }
    save(); return p.taps;
  }
  function register(id, shiny) {
    S.player.dex[id] = (S.player.dex[id] || 0) + 1;
    if (shiny) S.player.shiny[id] = (S.player.shiny[id] || 0) + 1;
  }
  function hatch() {
    const e = S.pet;
    S.pet = {
      egg: false, sp: e.sp, shiny: e.shiny, name: '', ageMin: 0,
      food: 80, joy: 80, ene: 80, hyg: 100, poops: 0, weight: 0,
      genes: { atk: 90 + rnd(21), def: 90 + rnd(21), spd: 90 + rnd(21) },
      tr: { atk: 0, def: 0, spd: 0 },
      berryKnown: false, bond: 0, bondToday: 0, bondDay: dayNum(), medals: [],
      mistakes: 0, mistakeCd: 0, goodTicks: 0, neglect: 0, asleep: false,
      declinedLevel: 0, farewellAt: FAREWELL_AGE, hatchedAt: Date.now(),
    };
    register(e.sp, e.shiny);
    checkMedals();
    save();
    emit('hatch', { sp: e.sp, shiny: e.shiny });
  }

  // ---------------- care ----------------
  function registerCare() {
    const p = S.pet, P = S.player;
    if (!p || p.egg || S.ceremony) return;
    const d = dayNum();
    if (p.bondDay !== d) { p.bondDay = d; p.bondToday = 0; }
    if (d === P.lastCareDay) return;
    if (!P.lastCareDay || d === P.lastCareDay + 1) P.streak++;
    else { P.streak = 1; P.lastMilestone = 0; }
    P.lastCareDay = d;
    if (P.streak > P.bestStreak) P.bestStreak = P.streak;
    p.bond = clamp(p.bond + 4);
    const ms = P.streak >= 100 ? 100 : P.streak >= 30 ? 30 : P.streak >= 7 ? 7 : P.streak >= 3 ? 3 : 0;
    if (ms > P.lastMilestone) { P.lastMilestone = ms; emit('milestone', ms); }
    emit('streak', P.streak);
  }
  function addBond(n) {
    const p = S.pet;
    if (p.bondToday >= BOND_DAILY_CAP) return;
    p.bond = clamp(p.bond + n); p.bondToday += n;
  }
  function blocked(needAwake = true) {
    const p = S.pet;
    if (!p || S.ceremony) return 'busy';
    if (p.egg) return 'egg';
    if (needAwake && p.asleep) return 'asleep';
    return null;
  }
  // any act of care cancels a pending run-away
  function afterCare() { if (S.pet) S.pet.neglect = 0; checkMedals(); save(); emit('change'); }

  function feedBerry(i) {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    const fav = sp().fav === i;
    if (fav) {
      p.food = clamp(p.food + 35); p.joy = clamp(p.joy + 10);
      const first = !p.berryKnown;
      p.berryKnown = true; S.player.favKnown[p.sp] = true;
      addBond(2);
      afterCare(); return { fav: true, first };
    }
    p.food = clamp(p.food + 25);
    afterCare(); return { fav: false };
  }
  function feedCandy() {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    p.food = clamp(p.food + 10); p.joy = clamp(p.joy + 12); p.weight = clamp(p.weight + 12);
    afterCare(); return {};
  }
  function playResult(score) {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    const sc = Math.min(255, score);
    const before = p.tr.spd;
    p.tr.spd = Math.min(100, p.tr.spd + Math.floor(sc / 5));
    p.joy = clamp(p.joy + 5 + (sc > 15 ? 30 : sc * 2));
    p.ene = dropTo(p.ene, 10 + Math.floor(sc / 2), 5);
    p.food = dropTo(p.food, 5, 5);
    p.weight = Math.max(0, p.weight - sc * 2);
    const hi = score > S.player.gameHi; if (hi) S.player.gameHi = score;
    addBond(2);
    afterCare(); return { spd: p.tr.spd - before, hi, hearts: sc >= 5 };
  }
  function trainStrength(hits) {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    const before = p.tr.atk;
    p.tr.atk = Math.min(100, p.tr.atk + Math.min(18, Math.floor(hits / 4)));
    p.ene = dropTo(p.ene, 12, 5);
    p.food = dropTo(p.food, 5, 5);
    p.weight = Math.max(0, p.weight - Math.floor(hits / 3));
    p.joy = clamp(p.joy + 6);
    const hi = hits > S.player.strHi; if (hi) S.player.strHi = hits;
    addBond(2);
    afterCare(); return { atk: p.tr.atk - before, hi, hearts: hits >= 20 };
  }
  function toggleSleep() {
    const b = blocked(false); if (b) return { error: b };
    S.pet.asleep = !S.pet.asleep; save(); emit('change');
    return { asleep: S.pet.asleep };
  }
  function clean() {
    const b = blocked(false); if (b) return { error: b };
    const p = S.pet; registerCare();
    p.poops = 0; p.hyg = 100; addBond(1);
    afterCare(); return {};
  }
  function caress() {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    p.joy = clamp(p.joy + 5); addBond(1);
    afterCare(); return {};
  }
  function rename(name) {
    if (!S.pet || S.pet.egg) return;
    S.pet.name = String(name || '').trim().slice(0, 12);
    save(); emit('change');
  }

  // ---------------- medals ----------------
  function checkMedals() {
    const p = S.pet; if (!p || p.egg) return;
    const has = new Set(p.medals);
    const want = [];
    const lv = level();
    if (lv >= 10) want.push('lv10');
    if (lv >= 25) want.push('lv25');
    if (lv >= 50) want.push('lv50');
    if (p.berryKnown) want.push('berry');
    if (S.player.streak >= 7) want.push('streak7');
    if (p.bond >= 100) want.push('bond');
    if (isFinal(p.sp)) want.push('final');
    if (p.weight === 0 && lv >= 5 && p.mistakes === 0) want.push('fit');
    const gained = want.filter(m => !has.has(m));
    if (gained.length) {
      p.medals.push(...gained);
      S.player.totalMedals += gained.length;
      gained.forEach(m => emit('medal', MEDALS.find(x => x.id === m)));
    }
  }

  // ---------------- evolution ----------------
  function evoLevel() {
    const p = S.pet, s = sp();
    if (!p || p.egg || !s.next.length) return null;
    return s.evo + p.mistakes;
  }
  function canEvolve() {
    const p = S.pet;
    if (!p || p.egg || p.asleep || S.ceremony) return false;
    const need = evoLevel(); if (need == null) return false;
    const lv = level();
    return lv >= need && lowest() >= 40 && lv > p.declinedLevel;
  }
  function evolve() {
    if (!canEvolve()) return null;
    const p = S.pet, s = sp(), from = p.sp;
    let to = s.next[0];
    if (s.next.length > 1) {
      const missing = s.next.filter(n => !registered(n));
      const pool = missing.length ? missing : s.next;
      to = pool[rnd(pool.length)];
    }
    p.sp = to; p.declinedLevel = 0;
    register(to, p.shiny);
    checkMedals(); save();
    return { from, to };
  }
  function declineEvolve() { if (S.pet) { S.pet.declinedLevel = level(); save(); } }

  // ---------------- endings ----------------
  function canFarewell() {
    const p = S.pet;
    return !!p && !p.egg && !p.asleep && !S.ceremony && isFinal(p.sp) && p.ageMin >= p.farewellAt;
  }
  function postponeFarewell() { if (S.pet) { S.pet.farewellAt = S.pet.ageMin + 24 * 60; save(); } }
  function farewellIn() {
    const p = S.pet; if (!p || p.egg || !isFinal(p.sp)) return null;
    return Math.max(0, p.farewellAt - p.ageMin);
  }
  function canRunaway() {
    const p = S.pet;
    return !!p && !p.egg && !p.asleep && !S.ceremony && p.neglect >= RUNAWAY_TICKS;
  }
  function startEnding(type) {
    const p = S.pet; if (!p || p.egg || S.ceremony) return false;
    S.player.lastEnd = type;
    S.ceremony = { type, at: Date.now() };
    save(); return true;
  }
  function finishEnding() {
    const p = S.pet, c = S.ceremony;
    if (p && !p.egg && c) {
      S.player.history.unshift({
        sp: p.sp, shiny: p.shiny, name: p.name, level: level(), ageMin: p.ageMin,
        end: c.type, date: Date.now(), medals: p.medals.length,
      });
      S.player.history = S.player.history.slice(0, 60);
    }
    // the egg roll uses streak + this pet's bond, so roll before clearing it
    const id = pickEggSpecies(), shiny = rollShiny();
    S.ceremony = null;
    S.pet = makeEgg(id, shiny);
    S.lastTick = Date.now();
    save();
    emit('newegg');
  }

  // ---------------- battle stats ----------------
  function stat(k) {
    const p = S.pet; if (!p || p.egg) return 0;
    const i = { atk: 0, def: 1, spd: 2 }[k];
    return Math.floor(sp().base[i] * p.genes[k] / 100) + level() + p.tr[k];
  }

  return {
    load, save, reset, update, setFast, on: f => listeners.push(f),
    get state() { return S; }, pet, sp, level, lowest, msPerMin,
    pickStarter, eggTap, feedBerry, feedCandy, playResult, trainStrength, toggleSleep, clean, caress, rename,
    canEvolve, evolve, declineEvolve, evoLevel,
    canFarewell, postponeFarewell, farewellIn, canRunaway, startEnding, finishEnding,
    stat, registered, registeredCount, shinyCount, careBonus, isFinal,
    LEGEND_UNLOCK, FAREWELL_AGE,
    _tick: tick, // for testing
  };
})();
