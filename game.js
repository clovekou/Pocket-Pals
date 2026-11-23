'use strict';
// Pocket Pal — game state and rules (no DOM). 1 tick = 1 game minute.

const MEDALS = [
  { id: 'lv10',    icon: 'badgeBoulder', label: 'Level 10',      desc: 'Reach level 10' },
  { id: 'lv25',    icon: 'badgeCascade', label: 'Level 25',      desc: 'Reach level 25' },
  { id: 'lv50',    icon: 'badgeThunder', label: 'Level 50',      desc: 'Reach level 50' },
  { id: 'berry',   icon: 'badgeRainbow', label: 'Favourite',     desc: 'Find its favourite berry' },
  { id: 'streak7', icon: 'badgeVolcano', label: '7-day streak',  desc: 'Care 7 days in a row' },
  { id: 'bond',    icon: 'badgeSoul', label: 'Best friends',  desc: 'Max out the bond' },
  { id: 'final',   icon: 'badgeEarth', label: 'Final form',    desc: 'Reach a final form' },
  { id: 'fit',     icon: 'badgeMarsh', label: 'Fit',           desc: 'Lv 5+, weight 0, no slip-ups' },
];

const Game = (() => {
  const SAVE_KEY = typeof window !== 'undefined' && window.PP_PREVIEW ? 'pocketpal.preview.v1' : 'pocketpal.save.v1';
  const MIN_PER_LEVEL = 60;
  const FAREWELL_AGE = 3 * 24 * 60;     // final form + 3 days
  const RUNAWAY_TICKS = 60;             // all four stats at 0 for 1 h
  const OFFLINE_CAP = 14 * 24 * 60;     // catch up at most 2 weeks
  const EGG_AUTO_HATCH = 3;             // minutes
  // registered species before legendaries appear (capped so small rosters can still get them)
  const LEGEND_UNLOCK = Math.max(1, Math.min(15, SPECIES.filter(s => s.tier !== 'legend').length));
  const BOND_DAILY_CAP = 20;
  const PARTY_MAX = 6;                  // main + up to 5 resting in the background
  const NEW_EGG_LEVEL = 5;              // main must reach this level before you can take another egg

  let S = null;
  const listeners = [];
  let quiet = false;
  const emit = (ev, d) => {
    if (quiet && ev !== 'save') return;
    // a UI error while reacting to an event must never break the game state
    listeners.forEach(f => { try { f(ev, d); } catch (e) { if (typeof window !== 'undefined' && window.__pocketPalError) window.__pocketPalError(e); } });
  };
  const clamp = v => Math.max(0, Math.min(100, v));
  const dropTo = (v, amt, floor) => (v <= floor ? v : Math.max(floor, v - amt));
  const rnd = n => Math.floor(Math.random() * n);
  const dayNum = (ms = Date.now()) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);

  function freshPlayer() {
    return {
      streak: 0, bestStreak: 0, lastCareDay: 0, lastMilestone: 0, totalMedals: 0,
      lastEnd: 'none', dex: {}, shiny: {}, favKnown: {}, history: [],
      gameHi: 0, strHi: 0, starterPicked: false, party: [],
      bag: {}, exploreBest: 0, wildWins: 0, fragments: {}, box: [], caught: 0,
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
    if (typeof window !== 'undefined' && window.PP_PREVIEW && !S.player.starterPicked) {   // ?preview: a sample team to look at
      const mon = sp => ({ egg: false, sp, shiny: false, name: '', ageMin: 600, food: 85, joy: 90, ene: 80, hyg: 90, poops: 0, weight: 0,
        genes: { atk: 100, def: 100, spd: 100 }, tr: { atk: 0, def: 0, spd: 0 }, berryKnown: false, bond: 20, bondToday: 0, bondDay: dayNum(), medals: [],
        mistakes: 0, mistakeCd: 0, goodTicks: 0, neglect: 0, asleep: false, declinedLevel: 0, farewellAt: FAREWELL_AGE, hatchedAt: Date.now() });
      S.player.starterPicked = true; S.player.starterGift = true;
      S.pet = mon(155);
      S.player.party = [1, 25, 143, 95, 133].map(mon);
      [155, 1, 25, 143, 95, 133].forEach(id => { S.player.dex[id] = 1; });
    }
    // drop anything that refers to species no longer in the roster
    const known = id => !!SPECIES_BY_ID[id];
    for (const k of ['dex', 'shiny', 'favKnown']) for (const id of Object.keys(S.player[k])) if (!known(id)) delete S.player[k][id];
    S.player.history = S.player.history.filter(h => known(h.sp));
    S.player.bag = S.player.bag || {};
    S.player.fragments = S.player.fragments || {};
    S.player.box = (S.player.box || []).filter(m => m && known(m.sp));
    S.player.party = (S.player.party || []).filter(m => m && !m.egg && known(m.sp)).slice(0, PARTY_MAX - 1);
    if (S.pet && !known(S.pet.sp)) { S.pet = null; S.ceremony = null; S.player.starterPicked = false; }
    if (S.ceremony) finishEnding();
    ensureKeys();
    // a broken streak shows as 0 straight away
    if (S.player.lastCareDay && dayNum() > S.player.lastCareDay + 1) { S.player.streak = 0; S.player.lastMilestone = 0; }
    // the app was closed without saying goodbye (killed / crashed): it fell asleep the moment you left
    if (S.pet && !S.pet.egg && !S.pet.asleep && Date.now() - S.lastTick > 2 * 60000) S.pet.asleep = true;
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
    const first = !S.player.starterPicked;
    S.player.starterPicked = true;
    // welcome gift: a Mystery Egg with a random first-stage Pokémon (Bag)
    if (first && !S.player.starterGift) { S.player.starterGift = true; S.player.bag = S.player.bag || {}; S.player.bag.mysteryEgg = (S.player.bag.mysteryEgg || 0) + 1; }
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
      declinedLevel: 0, farewellAt: FAREWELL_AGE, hatchedAt: Date.now(), key: newKey(), ot: trainer(),
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
  function trainDefense(blocks) {
    const b = blocked(); if (b) return { error: b };
    const p = S.pet; registerCare();
    const before = p.tr.def;
    p.tr.def = Math.min(100, p.tr.def + Math.min(18, Math.floor(blocks / 3)));
    p.ene = dropTo(p.ene, 12, 5); p.food = dropTo(p.food, 5, 5);
    p.weight = Math.max(0, p.weight - Math.floor(blocks / 3));
    p.joy = clamp(p.joy + 6);
    const hi = blocks > (S.player.defHi || 0); if (hi) S.player.defHi = blocks;
    addBond(2);
    afterCare(); return { def: p.tr.def - before, hi, hearts: blocks >= 15 };
  }
  function toggleSleep() {
    const b = blocked(false); if (b) return { error: b };
    S.pet.asleep = !S.pet.asleep; save(); emit('change');
    return { asleep: S.pet.asleep };
  }
  /** player left (phone locked, app switched or closed): settle the time so far, then it dozes off straight away */
  function sleepNow() {
    const p = S.pet;
    if (p && !p.egg && !p.asleep && !S.ceremony) { update(); if (S.pet === p && !S.ceremony) { p.asleep = true; emit('change'); } }
    save();
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

  // ---------------- party ----------------
  // Party members rest in the background: their needs and age are paused until they become the main again.
  function party() { return S.player.party; }
  function eggCheck() {
    const p = S.pet;
    if (!p || S.ceremony) return { ok: false, why: 'Not right now.' };
    if (p.egg) return { ok: false, why: 'Hatch your current egg first.' };
    if (S.player.party.length + 1 >= PARTY_MAX) return { ok: false, why: `Your party is full (${PARTY_MAX}). Release one to make room.` };
    if (level() < NEW_EGG_LEVEL) return { ok: false, why: `Raise ${p.name || sp().name} to Lv ${NEW_EGG_LEVEL} first.` };
    return { ok: true };
  }
  function takeEgg() {
    if (!eggCheck().ok) return false;
    const id = pickEggSpecies(), shiny = rollShiny();
    S.pet.asleep = false;
    S.player.party.push(S.pet);
    S.pet = makeEgg(id, shiny);
    S.lastTick = Date.now();
    save(); emit('newegg'); emit('party');
    return true;
  }
  function switchMain(i) {
    const p = S.pet, m = S.player.party[i];
    if (!p || p.egg || S.ceremony || !m || m.locked) return false;
    p.asleep = false;
    S.player.party[i] = p;
    S.pet = m;
    S.lastTick = Date.now();
    save(); emit('party'); emit('change');
    return true;
  }
  function releaseMember(i) {
    const m = S.player.party[i]; if (!m || m.locked) return false;
    S.player.history.unshift({ sp: m.sp, shiny: m.shiny, name: m.name, level: 1 + Math.floor(m.ageMin / MIN_PER_LEVEL), ageMin: m.ageMin, end: 'release', date: Date.now(), medals: (m.medals || []).length });
    S.player.history = S.player.history.slice(0, 60);
    S.player.party.splice(i, 1);
    save(); emit('party');
    return true;
  }
  const memberLevel = m => 1 + Math.floor(m.ageMin / MIN_PER_LEVEL);

  // ---------------- explore ----------------
  const ITEMS = {
    oran:      { name: 'Oran Berry',  icon: 'oran',          use: true,  desc: 'Restores every need by 25.' },
    rareCandy: { name: 'Rare Candy',  icon: 'rareCandy',     use: true,  desc: 'Your main grows 1 level.' },
    mysteryEgg:{ name: 'Mystery Egg', icon: 'egg_legend_0',  use: true,  desc: 'A new egg — no Lv 5 needed (needs a free party slot).' },
    pearl:     { name: 'Pearl',       icon: 'pearl',         use: false, desc: 'A pretty pearl. A collector\'s item.' },
    starPiece: { name: 'Star Piece',  icon: 'starPiece',     use: false, desc: 'A shard of a shooting star. A collector\'s item.' },
    nugget:    { name: 'Nugget',      icon: 'nugget',        use: false, desc: 'A nugget of pure gold. A collector\'s item.' },
    // catch-wheel balls: use one before spinning (after beating a floor boss or a legendary)
    greatBall: { name: 'Great Ball',  icon: 'greatball',     use: false, wheel: 'great',  desc: 'Use it on the catch wheel: every Poké Ball slot becomes a Great Ball.' },
    ultraBall: { name: 'Ultra Ball',  icon: 'ultraball',     use: false, wheel: 'ultra',  desc: 'Very rare. On the catch wheel, every weaker slot becomes an Ultra Ball.' },
    masterBall:{ name: 'Master Ball', icon: 'masterball',    use: false, wheel: 'master', desc: 'Extremely rare. Turns the whole catch wheel into Master Balls — a sure catch!' },
  };
  const EXPLORE_MAX_FLOOR = 10;
  const FRAGMENTS_TO_SUMMON = 20;
  // Ultra Beasts and Paradox Pokémon aren't flagged legendary in the data, but count as "special"
  const SPECIAL_IDS = new Set([793, 794, 795, 796, 797, 798, 799, 803, 804, 805, 806,
    984, 985, 986, 987, 988, 989, 990, 991, 992, 993, 994, 995, 1005, 1006, 1009, 1010, 1020, 1021, 1022, 1023]);
  function isSpecial(id) {
    const s = SPECIES_BY_ID[id];
    return !s || s.tier === 'legend' || SPECIES_BY_ID[s.lineBase].tier === 'legend' || SPECIAL_IDS.has(id);
  }
  /** Mystery Egg: any first-stage Pokémon that isn't legendary/mythical/Ultra Beast/Paradox */
  function pickMysterySpecies() {
    const pool = SPECIES.filter(s => !s.prev && !isSpecial(s.id));
    return pool[rnd(pool.length)].id;
  }
  function rollLegend() {
    const pool = SPECIES.filter(s => isSpecial(s.id));
    if (!pool.length) return null;
    const s = pool[rnd(pool.length)];
    return { sp: s.id, level: Math.max(5, level()), shiny: rnd(100) === 0, legend: true };
  }
  function exploreCheck() {
    const p = S.pet;
    if (!p || S.ceremony) return { ok: false, why: 'Not right now.' };
    if (p.egg) return { ok: false, why: 'Hatch your egg first!' };
    if (p.asleep) return { ok: false, why: 'It\'s asleep. Wake it up first.' };
    if (p.ene < 30) return { ok: false, why: 'Too tired to explore — needs 30+ energy.' };
    if (p.food < 20) return { ok: false, why: 'Too hungry to explore — feed it first.' };
    return { ok: true };
  }
  /** costs of walking one floor; returns false when too tired to continue */
  function exploreStep() {
    const p = S.pet; if (!p || p.egg) return false;
    p.ene = clamp(p.ene - 6); p.food = clamp(p.food - 3); p.hyg = clamp(p.hyg - 2);
    save(); emit('change');
    return p.ene >= 8;
  }
  /** what happens on a floor: 'none' | 'wild' | 'treasure' | 'egg' */
  function rollFloor(floor) {
    const r = Math.random();
    const legend = .0008 + floor * .0002, eggChance = .05 + floor * .006, treasure = .2 + floor * .015, wild = .3;
    if (Math.random() < legend && SPECIES.some(s => isSpecial(s.id))) return 'legend';
    if (r < eggChance) return 'egg';
    if (r < eggChance + treasure) return 'treasure';
    if (r < eggChance + treasure + wild) return 'wild';
    return 'none';
  }
  function rollTreasure(floor) {
    const table = [['oran', 40], ['pearl', 18], ['starPiece', 14 + floor], ['nugget', 8 + floor * 1.5], ['rareCandy', 6 + floor * 1.5], ['mysteryEgg', 2 + floor * .5],
      ['greatBall', 5 + floor * .3], ['ultraBall', 1 + floor * .15], ['masterBall', .08 + floor * .01]];   // rare / very rare / extremely rare
    let r = Math.random() * table.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of table) { if ((r -= w) < 0) return k; }
    return 'oran';
  }
  /** a wild Pokémon 3–5 levels below your main (never legendary) */
  function rollWild() {
    const lv = Math.max(1, level() - (3 + rnd(3)));
    const pool = SPECIES.filter(s => !isSpecial(s.id));
    // fit the stage to the level: low levels meet first stages, higher levels can meet evolved ones
    const fit = pool.filter(s => (s.stage === 1) || (s.stage === 2 && lv >= 18) || (s.stage >= 3 && lv >= 34));
    const list = fit.length ? fit : pool;
    const s = list[rnd(list.length)];
    return { sp: s.id, level: lv, shiny: rnd(200) === 0 };
  }
  /** the boss waiting on the deepest floor. Usually a first-stage Pokémon;
   *  rare: a middle stage (12%) · very rare: a final stage (3%) · extremely rare: a legendary (0.5%) */
  function rollBoss() {
    const r = Math.random() * 100;
    const normal = SPECIES.filter(s => !isSpecial(s.id));
    const pools = [
      ['legend', .5, SPECIES.filter(s => isSpecial(s.id))],
      ['final', 3.5, normal.filter(s => s.stage >= 2 && !s.next.length)],
      ['stage2', 15.5, normal.filter(s => s.stage === 2 && s.next.length)],
    ];
    let tier = 'stage1', pool = normal.filter(s => s.stage === 1 && !s.prev);
    for (const [t, upTo, list] of pools) if (r < upTo && list.length) { tier = t; pool = list; break; }
    const s = pool[rnd(pool.length)];
    return { sp: s.id, level: Math.max(5, level() + (tier === 'legend' ? 3 : 2)), shiny: rnd(150) === 0, boss: true, bossTier: tier, legend: tier === 'legend' };
  }
  /** battle numbers for any Pokémon at a level (mine uses genes + training) */
  function battler(id, lv, mine) {
    const s = SPECIES_BY_ID[id], p = S.pet;
    const st = k => mine ? stat(k) : Math.floor(s.base[{ atk: 0, def: 1, spd: 2 }[k]] * (90 + rnd(21)) / 100) + lv;
    const def = st('def');
    return { id, level: lv, atk: st('atk'), def, spd: st('spd'), maxHp: Math.round(22 + lv * 2.2 + def * .25) };
  }
  function addItem(k, n = 1) { S.player.bag[k] = (S.player.bag[k] || 0) + n; save(); }
  function itemCount(k) { return S.player.bag[k] || 0; }
  function useItem(k) {
    const p = S.pet, it = ITEMS[k];
    if (!it || !it.use || !itemCount(k)) return { error: 'none' };
    if (k === 'mysteryEgg') {
      if (!p || p.egg) return { error: 'Hatch your current egg first.' };
      if (S.player.party.length + 1 >= PARTY_MAX) return { error: `Your party is full (${PARTY_MAX}). Release one first.` };
      S.player.bag[k]--;
      const id = pickMysterySpecies(), shiny = rollShiny();
      p.asleep = false; S.player.party.push(p); S.pet = Object.assign(makeEgg(id, shiny), { mystery: true }); S.lastTick = Date.now();
      save(); emit('newegg'); emit('party');
      return { egg: true };
    }
    const b = blocked(false); if (b) return { error: b === 'egg' ? 'Hatch your egg first.' : 'Not right now.' };
    S.player.bag[k]--;
    if (k === 'oran') { p.food = clamp(p.food + 25); p.joy = clamp(p.joy + 25); p.ene = clamp(p.ene + 25); p.hyg = clamp(p.hyg + 25); }
    if (k === 'rareCandy') { p.ageMin += MIN_PER_LEVEL - (p.ageMin % MIN_PER_LEVEL); emit('level', level()); }
    afterCare();
    return {};
  }
  /** a fully grown Pokémon (caught or summoned) at a given level */
  function makeCaught(id, lv, shiny) {
    register(id, shiny);
    return {
      egg: false, sp: id, shiny: !!shiny, name: '', ageMin: Math.max(0, lv - 1) * MIN_PER_LEVEL,
      food: 80, joy: 80, ene: 80, hyg: 100, poops: 0, weight: 0,
      genes: { atk: 95 + rnd(16), def: 95 + rnd(16), spd: 95 + rnd(16) }, tr: { atk: 0, def: 0, spd: 0 },
      berryKnown: false, bond: 0, bondToday: 0, bondDay: dayNum(), medals: [], mistakes: 0, mistakeCd: 0, goodTicks: 0,
      neglect: 0, asleep: false, declinedLevel: 0, farewellAt: FAREWELL_AGE, hatchedAt: Date.now(), caught: true,
      key: newKey(), ot: trainer(),
    };
  }
  /** add to the party if there's room, otherwise to the PC box */
  function keepPokemon(m) {
    S.player.caught = (S.player.caught || 0) + 1;
    if (S.player.party.length + 1 < PARTY_MAX) { S.player.party.push(m); save(); emit('party'); return 'party'; }
    S.player.box.push(m); save(); emit('party'); return 'box';
  }
  function catchLegend(w) { return keepPokemon(makeCaught(w.sp, w.level, w.shiny)); }
  function addFragment(id) { S.player.fragments[id] = (S.player.fragments[id] || 0) + 1; save(); return S.player.fragments[id]; }
  function summonLegend(id) {
    if ((S.player.fragments[id] || 0) < FRAGMENTS_TO_SUMMON) return null;
    S.player.fragments[id] -= FRAGMENTS_TO_SUMMON;
    if (!S.player.fragments[id]) delete S.player.fragments[id];
    return keepPokemon(makeCaught(id, Math.max(5, level() || 5), false));
  }
  function box() { return S.player.box; }
  function boxToParty(i) {
    const m = S.player.box[i]; if (!m) return false;
    if (S.player.party.length + 1 >= PARTY_MAX) return false;
    S.player.box.splice(i, 1); S.player.party.push(m); save(); emit('party'); return true;
  }
  function partyToBox(i) {
    const m = S.player.party[i]; if (!m || m.locked) return false;
    S.player.party.splice(i, 1); S.player.box.push(m); save(); emit('party'); return true;
  }
  function releaseBox(i) {
    const m = S.player.box[i]; if (!m || m.locked) return false;
    S.player.history.unshift({ sp: m.sp, shiny: m.shiny, name: m.name, level: memberLevel(m), ageMin: m.ageMin, end: 'release', date: Date.now(), medals: (m.medals || []).length });
    S.player.box.splice(i, 1); save(); emit('party'); return true;
  }

  function exploreEnd(r) {
    const p = S.pet; if (!p || p.egg) return;
    if (r.floor > S.player.exploreBest) S.player.exploreBest = r.floor;
    S.player.wildWins += r.wins || 0;
    registerCare();
    if (r.lost) { p.ene = clamp(p.ene - 15); p.joy = clamp(p.joy - 8); }
    else { p.joy = clamp(p.joy + 6 + (r.wins || 0) * 3); addBond(2); }
    afterCare();
  }

  // ---------------- identity, trainers, trading ----------------
  function newKey() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  let currentTrainer = null;                 // set by the online module when signed in
  function trainer() { return currentTrainer ? { ...currentTrainer } : { name: (S && S.settings && S.settings.player) || 'You' }; }
  function allPets() { return [S.pet, ...(S.player.party || []), ...(S.player.box || [])].filter(Boolean); }
  function ensureKeys() { allPets().forEach(m => { if (!m.egg && !m.key) m.key = newKey(); if (!m.egg && !m.ot) m.ot = trainer(); }); }
  /** called when signed in: Pokémon you raised before signing in get your account as their Original Trainer */
  function setTrainer(t) {
    currentTrainer = t ? { name: t.name, code: t.code } : null;
    if (!t) return;
    allPets().forEach(m => { if (!m.egg && (!m.ot || (!m.ot.code && !m.receivedFrom))) m.ot = { name: t.name, code: t.code }; });
    save();
  }
  function findPet(key) {
    if (S.pet && S.pet.key === key) return { where: 'main', pet: S.pet };
    let i = S.player.party.findIndex(m => m.key === key); if (i >= 0) return { where: 'party', index: i, pet: S.player.party[i] };
    i = S.player.box.findIndex(m => m.key === key); if (i >= 0) return { where: 'box', index: i, pet: S.player.box[i] };
    return null;
  }
  /** Pokémon you may offer in a trade: never your main, never one already locked in another trade */
  function tradeable() {
    return [...S.player.party.map((m, i) => ({ where: 'party', index: i, pet: m })), ...S.player.box.map((m, i) => ({ where: 'box', index: i, pet: m }))]
      .filter(x => !x.pet.egg && !x.pet.locked);
  }
  function lockPet(key, tradeId) { const f = findPet(key); if (!f || f.where === 'main') return false; f.pet.locked = tradeId; save(); emit('party'); return true; }
  function unlockTrade(tradeId) { let n = 0; allPets().forEach(m => { if (m.locked === tradeId) { delete m.locked; n++; } }); if (n) { save(); emit('party'); } return n; }
  function tradeCopy(m) { if (!m) return null; const c = JSON.parse(JSON.stringify(m)); delete c.locked; return c; }
  /** finish a trade: give away `key`, receive `incoming` (keeps its Original Trainer) */
  function completeTrade(key, incoming, fromTrainer) {
    const f = findPet(key);
    if (!f || f.where === 'main') return false;
    if (f.where === 'party') S.player.party.splice(f.index, 1); else S.player.box.splice(f.index, 1);
    const m = tradeCopy(incoming);
    m.key = m.key || newKey(); m.receivedFrom = fromTrainer; m.receivedAt = Date.now(); m.asleep = false;
    if (!m.ot) m.ot = fromTrainer;
    register(m.sp, m.shiny);
    if (S.player.party.length + 1 < PARTY_MAX) S.player.party.push(m); else S.player.box.push(m);
    S.player.trades = (S.player.trades || 0) + 1;
    save(); emit('party');
    return true;
  }
  /** for cloud saves */
  function widgetToken() {
    if (!S.player.widgetToken) {
      const abc = 'abcdefghijkmnpqrstuvwxyz23456789', a = new Uint32Array(24); crypto.getRandomValues(a);
      S.player.widgetToken = [...a].map(n => abc[n % abc.length]).join(''); save();
    }
    return S.player.widgetToken;
  }
  function exportSave() { return JSON.stringify(S); }
  function importSave(json) {
    try { localStorage.setItem(SAVE_KEY, typeof json === 'string' ? json : JSON.stringify(json)); } catch (e) { return false; }
    load(); S.lastTick = Math.min(S.lastTick || Date.now(), Date.now()); save(); emit('change'); emit('party');
    return true;
  }
  /** what friends see: your main + party, as battle-ready numbers */
  function showcase() {
    const card = m => m && !m.egg ? { sp: m.sp, shiny: !!m.shiny, name: m.name || '', level: memberLevel(m), ot: m.ot || null } : null;
    const main = S.pet && !S.pet.egg ? Object.assign(card(S.pet), { atk: stat('atk'), def: stat('def'), spd: stat('spd') }) : null;
    return { main, party: S.player.party.map(card).filter(Boolean), dex: registeredCount(), updatedAt: Date.now() };
  }

  // ---------------- battle stats ----------------
  function stat(k) {
    const p = S.pet; if (!p || p.egg) return 0;
    const i = { atk: 0, def: 1, spd: 2 }[k];
    return Math.floor(sp().base[i] * p.genes[k] / 100) + level() + p.tr[k];
  }

  return {
    load, save, reset, update, setFast, widgetToken, on: f => listeners.push(f),
    get state() { return S; }, pet, sp, level, lowest, msPerMin,
    pickStarter, eggTap, feedBerry, feedCandy, playResult, trainStrength, trainDefense, toggleSleep, sleepNow, clean, caress, rename,
    canEvolve, evolve, declineEvolve, evoLevel,
    party, eggCheck, takeEgg, switchMain, releaseMember, memberLevel, PARTY_MAX, NEW_EGG_LEVEL,
    ITEMS, EXPLORE_MAX_FLOOR, FRAGMENTS_TO_SUMMON, isSpecial, pickMysterySpecies, rollLegend, rollBoss, catchLegend, addFragment, summonLegend,
    box, boxToParty, partyToBox, releaseBox, exploreCheck,
    setTrainer, findPet, tradeable, lockPet, unlockTrade, snapshot: tradeCopy, completeTrade, exportSave, importSave, showcase, exploreStep, rollFloor, rollTreasure, rollWild, battler, addItem, itemCount, useItem, exploreEnd,
    canFarewell, postponeFarewell, farewellIn, canRunaway, startEnding, finishEnding,
    stat, registered, registeredCount, shinyCount, careBonus, isFinal,
    LEGEND_UNLOCK, FAREWELL_AGE,
    _tick: tick, // for testing
  };
})();
