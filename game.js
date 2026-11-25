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
  // a bond this strong (0-100; about 155 of 255 on the main games' friendship scale) lets it endure a knockout once per battle
  const ENDURE_BOND = 60;
  const PARTY_MAX = 6;                  // main + up to 5 resting in the background
  const NEW_EGG_LEVEL = 5;              // main must reach this level before you can take another egg

  // Settings the admin can change for everyone (Admin page → Game settings, stored in Firestore config/game).
  // These are the defaults; applyConfig() overrides them, clamped to safe ranges.
  const CFG_DEFAULT = {
    exploreFloors: 10, fragments: 20, exploreEnergy: 30,
    shinyMult: 1, legendMult: 1, treasureMult: 1, eggMult: 1, bossShinyMult: 1,
    // explore & battle tuning (Admin → Game settings)
    wildChance: 30,      // % a floor has a wild battle
    dropChance: 35,      // % a beaten wild Pokémon drops treasure
    floorHeal: 15,       // % HP your Pokémon recovers walking to the next floor
    runChance: 80,       // % "Run" works
    bossHpMult: 1.8,     // floor boss HP ×
    bossLegendMult: 1,   // × each map's legendary-boss %
    catchMult: 1,        // × every ball's catch rate (the Master Ball always catches)
    // visiting a friend (Friends → Visit): one try a day per friend at finding Pokécoins
    visitCoins: 500,     // Pokécoins found
    visitChance: 50,     // % chance the daily try finds them
    features: { explore: true, training: true, codes: true, shop: true, teamBackup: true, friendHelpers: true },
    announcement: '',
    // Poké Mart prices in Pokécoins (0 = not on the shelf), from items.js. The admin can change them.
    shopBuy: priceList('buy'), shopSell: priceList('sell'),
  };
  function priceList(k) {
    const out = {};
    Object.entries(typeof ITEM_DATA !== 'undefined' ? ITEM_DATA : {}).forEach(([key, it]) => { if (it[k] > 0) out[key] = it[k]; });
    return out;
  }
  const CFG = JSON.parse(JSON.stringify(CFG_DEFAULT));
  function applyConfig(c) {
    c = c || {};
    const num = (k, lo, hi) => { const v = Number(c[k]); CFG[k] = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : CFG_DEFAULT[k]; };
    num('exploreFloors', 3, 50); num('fragments', 1, 200); num('exploreEnergy', 0, 100);
    num('shinyMult', .1, 50); num('legendMult', 0, 100); num('treasureMult', 0, 5); num('eggMult', 0, 10); num('bossShinyMult', .1, 50);
    num('wildChance', 0, 100); num('dropChance', 0, 100); num('floorHeal', 0, 100); num('runChance', 0, 100);
    num('bossHpMult', .5, 5); num('bossLegendMult', 0, 50); num('catchMult', .1, 10);
    num('visitCoins', 0, 100000); num('visitChance', 0, 100); CFG.visitCoins = Math.round(CFG.visitCoins);
    CFG.exploreFloors = Math.round(CFG.exploreFloors); CFG.fragments = Math.round(CFG.fragments);
    CFG.features = Object.assign({}, CFG_DEFAULT.features, c.features || {});
    CFG.announcement = String(c.announcement || '').slice(0, 400);
    const prices = (def, over) => {
      const out = Object.assign({}, def);
      Object.entries(over || {}).forEach(([k, v]) => { const n = Math.round(Number(v)); if (ITEMS[k] && Number.isFinite(n)) out[k] = Math.max(0, Math.min(999999, n)); });
      return out;
    };
    CFG.shopBuy = prices(CFG_DEFAULT.shopBuy, c.shopBuy); CFG.shopSell = prices(CFG_DEFAULT.shopSell, c.shopSell);
    emit('config');
  }
  // the admin's broadcast message (config/news): { id, text }; each new id is shown once
  function applyNews(n) {
    CFG.news = n && n.text ? { id: String(n.id || n.text), text: String(n.text).slice(0, 400) } : null;
    emit('config');
  }
  // the developer's mail posts (config/devmail): [{ id, text, at }], shown in the mail box
  function applyDevMail(list) {
    CFG.devmail = (Array.isArray(list) ? list : []).filter(p => p && p.text).map(p => ({ id: String(p.id || p.at), text: String(p.text).slice(0, 2000), at: Number(p.at) || 0 }));
    emit('config');
  }
  const feature = k => CFG.features[k] !== false;
  const oneIn = (n, mult) => Math.random() * Math.max(1, n / mult) < 1;   // a "1 in n" chance, boosted by mult

  let S = null;
  const listeners = [];
  let quiet = false;
  // set when the app opens or comes back into view: the next update() wakes a rested Pokémon (energy over WAKE_ENERGY)
  let wakeCheck = false;
  const WAKE_ENERGY = 80;
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
    S.player.coins = Math.max(0, Math.floor(S.player.coins || 0));
    S.player.bgOwned = S.player.bgOwned || {};
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
    wakeCheck = true;
    if (S.settings.fast) { S.settings.fast = false; S.lastTick = Date.now(); }   // the old "fast time" testing switch is gone: back to real time
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
    if (!S.player.starterPicked || S.ceremony || !S.pet) { S.lastTick = now; wakeCheck = false; return 0; }
    const mpm = msPerMin();
    let n = Math.floor((now - S.lastTick) / mpm);
    if (n > OFFLINE_CAP) { S.lastTick = now - OFFLINE_CAP * mpm; n = OFFLINE_CAP; }
    const before = n > 0 ? snapshot() : null;
    if (n > 0) {                       // time away is spent asleep, so energy recharges
      quiet = n > 3; restMins = 0;
      const eggAway = n > 3 && S.pet && S.pet.egg;   // an egg can't sleep, but the rest of the team still rests while you're away
      for (let i = 0; i < n && !S.ceremony; i++) { S.lastTick += mpm; tick(); if (eggAway && S.pet && S.pet.egg) restMins++; }
      quiet = false;
      restTeam(restMins); restMins = 0;
    }
    // back in the app: a Pokémon that has slept enough (energy over WAKE_ENERGY) is already up; otherwise it keeps sleeping
    let woke = false;
    if (wakeCheck) {
      wakeCheck = false;
      const p = S.pet;
      if (p && !p.egg && p.asleep && !S.ceremony && p.ene > WAKE_ENERGY) { p.asleep = false; woke = true; }
    }
    if (n <= 0 && !woke) return 0;
    save();
    if (n > 3) emit('away', { minutes: n, before, after: snapshot(), woke, asleep: !!(S.pet && S.pet.asleep) });
    if (woke) emit('change');
    return Math.max(0, n);
  }
  /** the app came back into view (phone unlocked, switched back): check on the sleeping Pokémon at the next update */
  function resume() { wakeCheck = true; }
  function setFast(on) { S.settings.fast = !!on; S.lastTick = Date.now(); save(); }
  function snapshot() {
    const p = S.pet; if (!p) return null;
    return { egg: !!p.egg, sp: p.sp, level: level(), food: p.food, joy: p.joy, ene: p.ene, hyg: p.hyg, poops: p.poops };
  }

  // while your main sleeps (and the game counts time away as sleep), the rest of your Pokémon rest too
  let restMins = 0;
  function restTeam(mins) {
    if (mins <= 0) return;
    [...(S.player.party || []), ...(S.player.box || [])].forEach(m => {
      if (!m || m.egg) return;
      m.ene = clamp((m.ene || 0) + 6 * mins);
      if (m.asleep && m.ene > WAKE_ENERGY) m.asleep = false;
    });
  }
  function tick() {
    const p = S.pet; if (!p) return;
    p.ageMin++;
    if (p.egg) { if (p.ageMin >= EGG_AUTO_HATCH) hatch(); return; }
    const levelUp = p.ageMin % MIN_PER_LEVEL === 0;

    if (p.asleep) {
      p.ene = clamp(p.ene + 6); restMins++;
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
    return oneIn(denom, CFG.shinyMult);
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
  // ---- evolution (like the main games): rules live in evolution.js, shared with the Admin page.
  // Steps are { to, lv } (level up) or { to, item } (evolution item), each optionally limited to a time of day.
  const EV = typeof Evolution !== 'undefined' ? Evolution : null;
  /** how species `id` evolves: [{ to, lv, time } | { to, item, time }] (only species in the game) */
  const evoMethods = id => (EV ? EV.steps(id) : []).filter(m => SPECIES_BY_ID[m.to]);
  const timeOk = t => !EV || EV.timeOk(t);
  const pickFresh = list => { const fresh = list.filter(m => !registered(m.to)), pool = fresh.length ? fresh : list; return pool[rnd(pool.length)]; };
  /** what this evolution item turns Pokémon `id` into right now: { to } or { error: 'none' | <time of day> } */
  function evoTarget(k, id) {
    const rows = evoMethods(id).filter(m => m.item === k);
    if (!rows.length) return { error: 'none' };
    const ok = rows.filter(m => timeOk(m.time));
    if (!ok.length) return { error: rows[0].time };
    return { to: pickFresh(ok).to };
  }
  /** Pokémon (species ids) an evolution item works on */
  const evoUsers = k => (EV ? EV.users(k) : []).filter(id => SPECIES_BY_ID[id]);
  const levelSteps = id => evoMethods(id).filter(m => !m.item);
  /** the held item is ready to evolve it (it has levelled up since it was given) */
  function heldEvo() {
    const p = S.pet;
    if (!p || p.egg || !p.held || !ITEMS[p.held] || ITEMS[p.held].how !== 'hold') return null;
    if (level() < (p.heldLevel || 0)) return null;
    const r = evoTarget(p.held, p.sp);
    return r.to ? r.to : null;
  }
  /** the lowest level it can evolve at (slip-ups add to it), or null if it only evolves by item */
  function evoLevel() {
    const p = S.pet;
    if (!p || p.egg) return null;
    const ls = levelSteps(p.sp).filter(m => m.lv != null); if (!ls.length) return null;
    return Math.min(...ls.map(m => m.lv)) + p.mistakes;
  }
  /** level evolutions it can take right now (level reached and the right time of day) */
  function levelReady() {
    const p = S.pet; if (!p || p.egg) return [];
    const lv = level();
    // level steps need the level; friendship steps need a strong bond (like the games' friendship)
    return levelSteps(p.sp).filter(m => timeOk(m.time) && (m.bond != null ? (p.bond || 0) >= m.bond : lv >= m.lv + p.mistakes));
  }
  function canEvolve() {
    const p = S.pet;
    if (!p || p.egg || p.asleep || S.ceremony) return false;
    const lv = level();
    if (lowest() < 40 || lv <= p.declinedLevel) return false;
    return !!heldEvo() || levelReady().length > 0;
  }
  function evolve() {
    if (!canEvolve()) return null;
    const p = S.pet, from = p.sp, held = heldEvo();
    let to;
    if (held) { to = held; delete p.held; delete p.heldLevel; }
    else to = pickFresh(levelReady()).to;
    p.sp = to; p.declinedLevel = 0;
    register(to, p.shiny);
    checkMedals(); save();
    return { from, to };
  }
  function declineEvolve() { if (S.pet) { S.pet.declinedLevel = level(); save(); } }
  /** use an evolution item (how: 'use') on your main: it evolves straight away */
  function useEvoItem(k) {
    const p = S.pet, it = ITEMS[k];
    if (!it || it.kind !== 'evo' || it.how !== 'use' || !itemCount(k)) return { error: 'You have none left.' };
    if (!p || p.egg) return { error: 'Hatch your egg first.' };
    if (p.asleep || S.ceremony) return { error: 'Not right now — it\'s asleep.' };
    const r = evoTarget(k, p.sp);
    if (r.error) return { error: r.error === 'none' ? `It won't have any effect on ${p.name || sp().name}.` : `It only works ${EV ? EV.WHEN[r.error] : r.error}.` };
    S.player.bag[k]--;
    const from = p.sp; p.sp = r.to; p.declinedLevel = 0;
    register(r.to, p.shiny); checkMedals(); save();
    return { from, to: r.to };
  }
  /** give a held evolution item (how: 'hold') to your main; any item it was holding goes back to the Bag */
  function giveHeld(k) {
    const p = S.pet, it = ITEMS[k];
    if (!it || it.how !== 'hold' || !itemCount(k)) return { error: 'You have none left.' };
    if (!p || p.egg) return { error: 'Hatch your egg first.' };
    const r = evoTarget(k, p.sp), any = evoMethods(p.sp).some(m => m.item === k);
    if (!any) return { error: `${p.name || sp().name} can't use the ${it.name}.` };
    if (p.held) S.player.bag[p.held] = itemCount(p.held) + 1;
    S.player.bag[k]--; p.held = k; p.heldLevel = level() + 1; p.declinedLevel = 0;
    save(); emit('change');
    return { ok: true, when: r.error && r.error !== 'none' ? r.error : '' };
  }
  function takeHeld() {
    const p = S.pet; if (!p || !p.held) return false;
    S.player.bag[p.held] = itemCount(p.held) + 1; delete p.held; delete p.heldLevel; save(); emit('change'); return true;
  }

  // ---------------- endings ----------------
  // the farewell ending (a fully grown Pokémon leaving after 3 days) has been removed: your Pokémon stay with you
  function canFarewell() {
    return false;
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
  // every item (items.js); which Pokémon evolve how is in evodata.js / evolution.js
  const ITEMS = typeof ITEM_DATA !== 'undefined' ? ITEM_DATA : {};
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
  function rollLegend(map) {
    const m = map && EXPLORE_MAPS[map];
    if (m && m.noLegend) return null;                                   // this map has no legendaries
    const mo = monthLegends(map);
    if (mo) {                                                           // this month's line-up: featured one weighted higher
      const list = [[mo.main, mo.mainChance], ...mo.extras.map(id => [id, mo.extraChance])].filter(([id]) => id);
      const tot = list.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * tot, pick = list[0][0];
      if (tot > 0) for (const [id, w] of list) { if ((r -= w) < 0) { pick = id; break; } }
      return { sp: pick, level: Math.max(5, level()), shiny: rnd(100) === 0, legend: true, monthly: true };
    }
    if (m && m.beast && SPECIES_BY_ID[m.beast]) return { sp: m.beast, level: Math.max(5, level()), shiny: rnd(100) === 0, legend: true };   // only its own
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
    if (!feature('explore')) return { ok: false, why: 'Exploring is closed right now. Check back soon!' };
    if (p.ene < CFG.exploreEnergy) return { ok: false, why: `Too tired to explore — needs ${CFG.exploreEnergy}+ energy.` };
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
  function rollFloor(floor, map) {
    const r = Math.random(), m = EXPLORE_MAPS[map] || {};
    // a wandering legendary is very rare; maps whose legendary is "more likely" (beastChance 4) double it, the desert has none
    const mo = monthLegends(map), hot = mo ? mo.mainChance >= 4 : m.beastChance >= 4;
    const legend = m.noLegend ? 0 : (.0008 + floor * .0002) * CFG.legendMult * (hot ? 2 : 1), eggChance = Math.min(.4, (.002 + floor * .0003) * CFG.eggMult),   // Mystery Eggs in the grass: very rare
      treasure = Math.min(.55, (.2 + floor * .015) * CFG.treasureMult), wild = CFG.wildChance / 100;
    if (Math.random() < legend && SPECIES.some(s => isSpecial(s.id))) return 'legend';
    if (r < eggChance) return 'egg';
    if (r < eggChance + treasure) return 'treasure';
    if (r < eggChance + treasure + wild) return 'wild';
    return 'none';
  }
  function rollTreasure(floor) {
    // weights from items.js (`find`); deeper floors make rarer finds a little more likely
    const table = Object.entries(ITEMS).filter(([, it]) => it.find > 0)
      .map(([k, it]) => [k, it.find * (it.kind === 'evo' ? .3 : 1) * (k === 'oran' ? 1 : 1 + floor * (it.find < 2 ? .15 : .08))]);   // evolution items are rare
    let r = Math.random() * table.reduce((a, [, w]) => a + w, 0), pick = 'oran';
    for (const [k, w] of table) { if ((r -= w) < 0) { pick = k; break; } }
    // an evolution item leans toward one your main can use
    if (ITEMS[pick] && ITEMS[pick].kind === 'evo' && S.pet && !S.pet.egg && Math.random() < .4) {
      const mine = [...new Set(evoMethods(S.pet.sp).map(m => m.item).filter(k => k && ITEMS[k]))];
      if (mine.length) pick = mine[rnd(mine.length)];
    }
    return pick;
  }
  // Explore maps (defaults in maps.js). The plain Crystal Cave has every kind of Pokémon; the others favour types that
  // fit the place (weights pick a type first). The floor boss has a small chance (beastChance %) to be the map's legendary,
  // and each wild battle has chaseChance % to be the map's "main chase" Pokémon. The admin can change all of it (config/maps).
  const MAP_DEFAULTS = {};
  (typeof EXPLORE_MAP_DEFAULTS !== 'undefined' ? EXPLORE_MAP_DEFAULTS : [{ id: 'cave', types: null }]).forEach(m => {
    MAP_DEFAULTS[m.id] = { types: m.types ? Object.assign({}, m.types) : null, beast: m.beast || 0, beastChance: m.beastChance || 0,
      noLegend: !!m.noLegend, chase: m.chase || 0, chaseChance: m.chaseChance || 0, monthly: {} };
  });
  const EXPLORE_MAPS = JSON.parse(JSON.stringify(MAP_DEFAULTS));   // the live values (same object all along; overrides fill it in)
  const firstMap = () => EXPLORE_MAPS[Object.keys(EXPLORE_MAPS)[0]] || { types: null };   // an unknown map id falls back to the first map
  /** the admin's map overrides ({ [mapId]: { types, beast, beastChance, noLegend, chase, chaseChance } }), checked and clamped */
  function applyMaps(over) {
    over = over && typeof over === 'object' ? over : {};
    const pct = (v, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : d; };
    const sp = v => { const n = Math.round(Number(v)); return n && SPECIES_BY_ID[n] ? n : 0; };
    Object.keys(MAP_DEFAULTS).forEach(id => {
      const d = MAP_DEFAULTS[id], o = over[id] || {};
      let types = d.types;
      if (o.allTypes === true) types = null;
      else if (o.types && typeof o.types === 'object') {
        const t = {}; Object.entries(o.types).forEach(([el, w]) => { const n = pct(w, 0); if (n > 0) t[el] = n; });
        types = Object.keys(t).length ? t : d.types;
      }
      EXPLORE_MAPS[id] = {
        types: types ? Object.assign({}, types) : null,
        beast: 'beast' in o ? sp(o.beast) : d.beast,
        beastChance: 'beastChance' in o ? pct(o.beastChance, d.beastChance) : d.beastChance,
        noLegend: 'noLegend' in o ? !!o.noLegend : d.noLegend,
        chase: 'chase' in o ? sp(o.chase) : d.chase,
        chaseChance: 'chaseChance' in o ? pct(o.chaseChance, d.chaseChance) : d.chaseChance,
        monthly: cleanMonthly(o.monthly, sp, pct),
      };
    });
    emit('config');
  }
  // Monthly legendaries (Admin → Explore maps): { 'YYYY-MM': { main, mainChance, extras: [ids], extraChance } }.
  // During that month the map's boss is the featured legendary mainChance % of the time, and each of the
  // few lower-chance ones extraChance % of the time; they replace the map's usual legendary for the month.
  function cleanMonthly(mo, sp, pct) {
    const out = {};
    if (!mo || typeof mo !== 'object') return out;
    Object.entries(mo).forEach(([k, v]) => {
      if (!/^\d{4}-\d{2}$/.test(k) || !v || typeof v !== 'object') return;
      const main = sp(v.main), extras = [...new Set((Array.isArray(v.extras) ? v.extras : []).map(sp).filter(id => id && id !== main))].slice(0, 6);
      if (!main && !extras.length) return;
      out[k] = { main, mainChance: main ? pct(v.mainChance, 0) : 0, extras, extraChance: extras.length ? pct(v.extraChance, 0) : 0 };
    });
    return out;
  }
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  /** this month's legendary line-up for a map, or null (none set, or the map has no legendaries) */
  function monthLegends(map) {
    const m = EXPLORE_MAPS[map];
    if (!m || m.noLegend || !m.monthly) return null;
    const e = m.monthly[monthKey()];
    return e && (e.main || e.extras.length) ? e : null;
  }
  /** the species a map can show: every one for the plain cave, else one of its types (picked by weight) */
  function mapPool(map, list) {
    const m = EXPLORE_MAPS[map] || firstMap();
    if (!m.types) return list;
    const entries = Object.entries(m.types);
    let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0), el = entries[0][0];
    for (const [k, w] of entries) { if ((r -= w) < 0) { el = k; break; } }
    const mine = list.filter(s => s.el === el);
    return mine.length ? mine : list;
  }
  /** a wild Pokémon 3–5 levels below your main (never legendary), suited to the map */
  function rollWild(map) {
    const lv = Math.max(1, level() - (3 + rnd(3)));
    const mm = EXPLORE_MAPS[map];
    if (mm && mm.chase && SPECIES_BY_ID[mm.chase] && Math.random() * 100 < mm.chaseChance) {   // the map's main chase
      const leg = isSpecial(mm.chase);
      if (!leg || !mm.noLegend) return { sp: mm.chase, level: leg ? Math.max(5, level()) : lv, shiny: oneIn(200, CFG.shinyMult), legend: leg, chase: true };
    }
    const pool = mapPool(map, SPECIES.filter(s => !isSpecial(s.id)));
    // fit the stage to the level: low levels meet first stages, higher levels can meet evolved ones
    const fit = pool.filter(s => (s.stage === 1) || (s.stage === 2 && lv >= 18) || (s.stage >= 3 && lv >= 34));
    const list = fit.length ? fit : pool;
    const s = list[rnd(list.length)];
    return { sp: s.id, level: lv, shiny: oneIn(200, CFG.shinyMult) };
  }
  /** the boss waiting on the deepest floor. Usually a first-stage Pokémon;
   *  rare: a middle stage (12%) · very rare: a final stage (3%) · extremely rare: a legendary (0.5%).
   *  On a themed map it's one of that map's types, and its legendary beast turns up beastChance % of the time. */
  function rollBoss(map) {
    const m = EXPLORE_MAPS[map] || firstMap();
    const legendBoss = id => ({ sp: id, level: Math.max(5, level() + 3), shiny: oneIn(150, CFG.bossShinyMult), boss: true, bossTier: 'legend', legend: true });
    const mo = monthLegends(map);
    if (mo) {                                       // this month: featured legendary (higher %), then each lower-chance one
      const r = Math.random() * 100, k = CFG.bossLegendMult, top = mo.main ? mo.mainChance * k : 0;
      if (mo.main && r < top) return legendBoss(mo.main);
      const i = Math.floor((r - top) / Math.max(1e-9, mo.extraChance * k));
      if (r >= top && i < mo.extras.length) return legendBoss(mo.extras[i]);
    } else if (!m.noLegend && m.beast && SPECIES_BY_ID[m.beast] && Math.random() * 100 < m.beastChance * CFG.bossLegendMult) {
      return legendBoss(m.beast);
    }
    const r = Math.random() * 100;
    const normal = mapPool(map, SPECIES.filter(s => !isSpecial(s.id)));
    const pools = [
      ['legend', m.beast || m.noLegend || mo ? 0 : .5, SPECIES.filter(s => isSpecial(s.id))],   // themed maps: only their own beast (or none)
      ['final', 3.5, normal.filter(s => s.stage >= 2 && !s.next.length)],
      ['stage2', 15.5, normal.filter(s => s.stage === 2 && s.next.length)],
    ];
    let tier = 'stage1', pool = normal.filter(s => s.stage === 1 && !s.prev);
    for (const [t, upTo, list] of pools) if (r < upTo && list.length) { tier = t; pool = list; break; }
    const s = pool[rnd(pool.length)];
    return { sp: s.id, level: Math.max(5, level() + (tier === 'legend' ? 3 : 2)), shiny: oneIn(150, CFG.bossShinyMult), boss: true, bossTier: tier, legend: tier === 'legend' };
  }
  /** battle numbers for any Pokémon at a level (mine uses genes + training) */
  function battler(id, lv, mine) {
    const s = SPECIES_BY_ID[id], p = S.pet;
    const st = k => mine ? stat(k) : Math.floor(s.base[{ atk: 0, def: 1, spd: 2 }[k]] * (90 + rnd(21)) / 100) + lv;
    const def = st('def');
    return { id, level: lv, atk: st('atk'), def, spd: st('spd'), maxHp: Math.round(22 + lv * 2.2 + def * .25) };
  }
  /** battle numbers for one of your party Pokémon (the explore backup): its own genes, training and level */
  function memberBattler(m) {
    const s = SPECIES_BY_ID[m.sp], lv = memberLevel(m), g = m.genes || {}, tr = m.tr || {};
    const st = k => Math.floor(s.base[{ atk: 0, def: 1, spd: 2 }[k]] * (g[k] || 100) / 100) + lv + (tr[k] || 0);
    const def = st('def');
    return { id: m.sp, level: lv, atk: st('atk'), def, spd: st('spd'), maxHp: Math.round(22 + lv * 2.2 + def * .25) };
  }
  function addItem(k, n = 1) { S.player.bag[k] = (S.player.bag[k] || 0) + n; save(); }
  function itemCount(k) { return S.player.bag[k] || 0; }

  // ---------------- Poké Mart (inside the Bag) ----------------
  const coins = () => S.player.coins || 0;
  function buyItem(k, n = 1) {
    const price = CFG.shopBuy[k] || 0; n = Math.max(1, Math.min(99, n | 0));
    if (!feature('shop')) return { error: 'The shop is closed right now.' };
    if (!ITEMS[k] || !price) return { error: 'That isn\'t for sale.' };
    if (coins() < price * n) return { error: `Not enough Pokécoins (need ${price * n}).` };
    S.player.coins = coins() - price * n; S.player.bag[k] = itemCount(k) + n;
    save(); emit('coins'); return { ok: true, spent: price * n };
  }
  // ---- shop backgrounds (made on the Admin page): buy once, keep forever, switch any time
  const ownsBackground = id => !id || !!S.player.bgOwned[id];
  function buyBackground(id, price) {
    price = Math.max(0, Math.floor(price || 0));
    if (!id) return { error: 'none' };
    if (ownsBackground(id)) return { ok: true, owned: true };
    if (coins() < price) return { error: `Not enough Pokécoins (need ${price.toLocaleString()}).` };
    S.player.coins = coins() - price; S.player.bgOwned[id] = Date.now(); S.settings.bg = id;
    save(); emit('coins'); return { ok: true, spent: price };
  }
  function useBackground(id) {
    if (id && !ownsBackground(id)) return false;
    S.settings.bg = id || ''; save(); return true;
  }
  function sellItem(k, n = 1) {
    const price = CFG.shopSell[k] || 0; n = Math.max(1, Math.min(itemCount(k), n | 0));
    if (!feature('shop')) return { error: 'The shop is closed right now.' };
    if (!ITEMS[k] || !price) return { error: 'The shop doesn\'t buy that.' };
    if (!itemCount(k)) return { error: 'You don\'t have any.' };
    S.player.bag[k] -= n; S.player.coins = coins() + price * n;
    save(); emit('coins'); return { ok: true, earned: price * n };
  }
  function useItem(k, opts) {
    const p = S.pet, it = ITEMS[k];
    if (!it || !it.use || !itemCount(k)) return { error: 'none' };
    if (k === 'mysteryEgg') {
      if (!p || p.egg) return { error: 'Hatch your current egg first.' };
      if (p.locked) return { error: 'Your main is in a trade right now.' };
      const full = S.player.party.length + 1 >= PARTY_MAX;
      if (full && !(opts && opts.toBox)) return { error: `Your party is full (${PARTY_MAX}).`, full: true };
      S.player.bag[k]--;
      const id = pickMysterySpecies(), shiny = rollShiny();
      p.asleep = false; (full ? S.player.box : S.player.party).push(p); S.pet = Object.assign(makeEgg(id, shiny), { mystery: true }); S.lastTick = Date.now();
      save(); emit('newegg'); emit('party');
      return { egg: true, boxed: full };
    }
    const b = blocked(false); if (b) return { error: b === 'egg' ? 'Hatch your egg first.' : 'Not right now.' };
    S.player.bag[k]--;
    if (k === 'oran') { p.food = clamp(p.food + 25); p.joy = clamp(p.joy + 25); p.ene = clamp(p.ene + 25); p.hyg = clamp(p.hyg + 25); }
    if (k === 'rareCandy') { p.ageMin += MIN_PER_LEVEL - (p.ageMin % MIN_PER_LEVEL); emit('level', level()); }
    if (k === 'sitrus') p.food = clamp(p.food + 35);
    if (k === 'lemonade') p.ene = clamp(p.ene + 50);
    afterCare();
    return {};
  }
  /** a healing item (Potion…) used while exploring: takes one from the Bag; the dungeon restores the HP */
  function useHeal(k) {
    const it = ITEMS[k];
    if (!it || !it.heal || !itemCount(k)) return { error: 'You have none left.' };
    if (it.use) { const r = useItem(k); if (r.error) return r; }
    else { S.player.bag[k]--; save(); emit('change'); }
    return { heal: it.heal };
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
  /** gift-code reward (set by the admin): event Pokémon and/or items. Returns what was given. */
  function redeemGift(code, gift) {
    S.player.redeemed = S.player.redeemed || {};
    const out = { mons: [], items: [] };
    for (const g of gift.pokemon || []) {
      if (!SPECIES_BY_ID[g.sp]) continue;
      const m = makeCaught(g.sp, Math.max(1, Math.min(100, g.level || 5)), !!g.shiny);
      if (g.name) m.name = String(g.name).slice(0, 14);
      m.event = String(gift.label || code).slice(0, 40); m.gift = true;
      out.mons.push({ name: m.name || SPECIES_BY_ID[g.sp].name, shiny: m.shiny, where: keepPokemon(m) });
    }
    for (const [k, n] of Object.entries(gift.items || {})) {
      if (!ITEMS[k] || !(n > 0)) continue;
      S.player.bag[k] = (S.player.bag[k] || 0) + Math.min(99, n | 0); out.items.push({ k, n: Math.min(99, n | 0) });
    }
    const c = Math.max(0, Math.min(1000000, Math.floor(Number(gift.coins) || 0)));
    if (c) { S.player.coins = (S.player.coins || 0) + c; out.coins = c; }
    S.player.redeemed[code] = Date.now();
    save(); emit('party'); emit('change');
    return out;
  }
  const hasRedeemed = code => !!(S.player.redeemed && S.player.redeemed[code]);
  function addFragment(id) { S.player.fragments[id] = (S.player.fragments[id] || 0) + 1; save(); return S.player.fragments[id]; }
  function summonLegend(id) {
    if ((S.player.fragments[id] || 0) < CFG.fragments) return null;
    S.player.fragments[id] -= CFG.fragments;
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
    const card = m => m && !m.egg ? { sp: m.sp, shiny: !!m.shiny, name: m.name || '', level: memberLevel(m), ot: m.ot || null, id: m.key || '' } : null;
    // party cards carry their battle numbers too, so a friend can borrow one for exploring
    const withStats = m => { const c = card(m); if (!c) return null; const b = memberBattler(m); return Object.assign(c, { atk: b.atk, def: b.def, spd: b.spd }); };
    const main = S.pet && !S.pet.egg ? Object.assign(card(S.pet), { atk: stat('atk'), def: stat('def'), spd: stat('spd') }) : null;
    const party = S.player.party.map(withStats).filter(Boolean);
    const hk = helperKey(), helper = (main && main.id === hk && main) || party.find(c => c.id === hk) || null;
    // the home background they picked, so friends who visit see their place as they set it up
    const bg = S.settings.bg && ownsBackground(S.settings.bg) ? String(S.settings.bg) : '';
    return { main, party, helper, bg, dex: registeredCount(), updatedAt: Date.now() };
  }

  // ---------------- visiting friends (Friends → Visit) ----------------
  /** one try a day per friend at finding Pokécoins: { coins } (0 = none this time) or { already: true } */
  function visitReward(uid) {
    const v = S.player.visits;
    if (!v || v.day !== dayNum()) S.player.visits = { day: dayNum(), tried: {} };
    const tried = S.player.visits.tried;
    if (tried[uid]) { save(); return { already: true, coins: 0 }; }
    const coins = CFG.visitCoins > 0 && Math.random() * 100 < CFG.visitChance ? CFG.visitCoins : 0;
    tried[uid] = coins || -1;
    if (coins) S.player.coins = (S.player.coins || 0) + coins;
    save(); if (coins) emit('coins');
    return { coins };
  }

  // ---------------- friend helpers (borrowed for exploring) ----------------
  /** the Pokémon you lend to friends for exploring (by key); falls back to your main */
  function helperKey() {
    const k = S.player.helperKey, ok = k && [S.pet, ...S.player.party].some(m => m && !m.egg && m.key === k);
    return ok ? k : (S.pet && !S.pet.egg ? S.pet.key || '' : '');
  }
  function setHelper(key) { ensureKeys(); S.player.helperKey = key || ''; save(); emit('party'); }
  /** friend Pokémon you've already explored with today: { [friendUid]: [card ids] } (starts fresh each day) */
  function borrowedToday() {
    const b = S.player.borrowed;
    if (!b || b.day !== dayNum()) S.player.borrowed = { day: dayNum(), used: {} };
    return S.player.borrowed.used;
  }
  function markBorrowed(uid, id) {
    const used = borrowedToday(); used[uid] = [...new Set([...(used[uid] || []), id])]; save();
  }
  /** battle numbers for a friend's Pokémon from its showcase card */
  function cardBattler(c) {
    if (!(c.atk > 0 && c.def > 0 && c.spd > 0)) return battler(c.sp, c.level || 5, false);
    const lv = c.level || 5;
    return { id: c.sp, level: lv, atk: c.atk, def: c.def, spd: c.spd, maxHp: Math.round(22 + lv * 2.2 + c.def * .25) };
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
    ITEMS, EXPLORE_MAPS, applyMaps, ENDURE_BOND, get EXPLORE_MAX_FLOOR() { return CFG.exploreFloors; }, get FRAGMENTS_TO_SUMMON() { return CFG.fragments; }, isSpecial,
    applyConfig, applyNews, applyDevMail, feature, get config() { return CFG; }, redeemGift, hasRedeemed, coins, buyItem, sellItem, ownsBackground, buyBackground, useBackground,
    useEvoItem, giveHeld, takeHeld, evoTarget, evoUsers, heldEvo, evoMethods,
    /** admin edits to evolutions (Firestore config/evolutions) */
    applyEvolutions(o) { if (EV) { EV.setOverrides(o); emit('config'); } }, pickMysterySpecies, rollLegend, monthLegends, visitReward, rollBoss, catchLegend, addFragment, summonLegend,
    box, boxToParty, partyToBox, releaseBox, exploreCheck,
    setTrainer, findPet, tradeable, lockPet, unlockTrade, snapshot: tradeCopy, completeTrade, exportSave, importSave, showcase, exploreStep, rollFloor, rollTreasure, rollWild, battler, memberBattler, cardBattler, helperKey, setHelper, borrowedToday, markBorrowed, addItem, itemCount, useItem, useHeal, exploreEnd,
    resume, canFarewell, postponeFarewell, farewellIn, canRunaway, startEnding, finishEnding,
    stat, registered, registeredCount, shinyCount, careBonus, isFinal,
    LEGEND_UNLOCK, FAREWELL_AGE,
    _tick: tick, // for testing
  };
})();
