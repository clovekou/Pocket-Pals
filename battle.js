'use strict';
// Pocket Pals — battle engine (no DOM). Pokémon-style turn-based battles: elements, moves with PP, stats with
// stages, statuses, critical hits, priority, an enemy AI, plus explore recommendations. Numbers live in battle-data.js.
// A "battler" is a plain object made by Battle.make(); Battle.turn() plays one turn and returns a list of events
// for the screen to show one by one ({ t: 'use' | 'dmg' | 'miss' | 'msg' | 'heal' | 'status' | 'stat' | 'faint' … }).

const Battle = (() => {
  const D = window.PP_BATTLE, B = D.BALANCE, E = D.ELEMENTS;
  const EL_IDS = Object.keys(E);
  const STAGE_KEYS = ['atk', 'def', 'spa', 'sdef', 'spe', 'acc', 'eva'];
  const STAT_LABEL = { atk: 'Attack', def: 'Defence', spa: 'Sp. Atk', sdef: 'Sp. Def', spe: 'Speed', acc: 'accuracy', eva: 'evasion', hp: 'HP' };
  const STATUS_LABEL = { brn: 'burned', psn: 'poisoned', par: 'paralysed', slp: 'asleep', frz: 'frozen' };
  const STATUS_TAG = { brn: 'BRN', psn: 'PSN', par: 'PAR', slp: 'SLP', frz: 'FRZ' };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
  let rng = Math.random;
  const R = () => rng();

  // ---------------- types (the Pokémon type chart in battle-data.js) ----------------
  /** a species' types: [first] or [first, second] (species.js el / el2) */
  function typesOf(spId) {
    const s = typeof SPECIES_BY_ID !== 'undefined' ? SPECIES_BY_ID[spId] : null;
    const a = s && E[s.el] ? s.el : 'normal', b = s && s.el2 && E[s.el2] && s.el2 !== a ? s.el2 : null;
    return b ? [a, b] : [a];
  }
  const elementOf = spId => typesOf(spId)[0];
  /** one attacking type against one defending type: 2, 1, ½ or 0 */
  function single(a, d) {
    const A = E[a]; if (!A || !E[d]) return 1;
    if (A.none.includes(d)) return B.noEffect;
    if (A.se.includes(d)) return B.superEffective;
    if (A.nve.includes(d)) return B.notVeryEffective;
    return 1;
  }
  /** an attack of type a against a Pal with type(s) d (a string or a list): the numbers multiply (4×, ¼×, 0×…) */
  function mult(a, d) {
    if (!a || !E[a]) return 1;
    return (Array.isArray(d) ? d : [d]).reduce((m, t) => m * single(a, t), 1);
  }
  /** for a Pal with these types: strong (its types hit these hard), weak (takes 2× or 4×), resist (½ or ¼), immune (0×) */
  function relations(types) {
    const T = Array.isArray(types) ? types : [types];
    return {
      strong: EL_IDS.filter(d => T.some(t => single(t, d) > 1)),
      weak4: EL_IDS.filter(a => mult(a, T) >= 4), weak: EL_IDS.filter(a => mult(a, T) > 1),
      resist: EL_IDS.filter(a => mult(a, T) > 0 && mult(a, T) < 1), immune: EL_IDS.filter(a => mult(a, T) === 0),
    };
  }
  const elInfo = el => E[el] || E.normal;

  // ---------------- moves ----------------
  function move(id) {
    const m = D.MOVES[id]; if (!m) return null;
    return Object.assign({ id, pri: 0 }, m, { name: D.MOVE_NAMES[id] || m.name });
  }
  const isDamaging = mv => mv && mv.power > 0;

  // ---------------- stats ----------------
  /** six base stats derived from the species' three (ATK, DEF, SPD), leaning special or physical by element */
  const baseCache = {};
  function baseStats(spId) {
    if (baseCache[spId]) return baseCache[spId];
    const s = SPECIES_BY_ID[spId], [A, Df, S] = (s && s.base) || [50, 50, 50];
    const ts = typesOf(spId), lean = ts.reduce((a, t) => a + (B.specialLean[t] || 1), 0) / ts.length * (.95 + (hash(spId) % 11) / 100);
    const out = {
      hp: Math.round((A + Df) / 2 + 18 + hash(spId * 7) % 14),
      atk: Math.round(A * (2 - lean)), spa: Math.round(A * lean),
      def: Math.round(Df * (1.5 - lean / 2)), sdef: Math.round(Df * (.5 + lean / 2)),
      spe: S,
    };
    return (baseCache[spId] = out);
  }
  /** a Pal's stats at a level, with its genes (90-110%) and training (0-100) */
  function stats(spId, level, genes = {}, tr = {}) {
    const b = baseStats(spId), lv = clamp(level | 0, 1, 100);
    const g = k => (genes[k] || 100) / 100;
    const ev = t => Math.floor((t || 0) * B.trainingEV / 4 * lv / 100);
    const f = (base, gk, t) => Math.floor(2 * base * g(gk) * lv / 100) + 5 + ev(t);
    return {
      hp: Math.floor(2 * b.hp * (g('atk') + g('def')) / 2 * lv / 100) + lv + 10 + Math.floor(ev(tr.def) / 2),
      atk: f(b.atk, 'atk', tr.atk), spa: f(b.spa, 'atk', tr.atk),
      def: f(b.def, 'def', tr.def), sdef: f(b.sdef, 'def', tr.def),
      spe: f(b.spe, 'spd', tr.spd),
    };
  }

  // ---------------- learnsets ----------------
  const learnCache = {};
  /** [{ lv, id }] every move this species can learn, by level */
  function learnset(spId) {
    if (learnCache[spId]) return learnCache[spId];
    const s = SPECIES_BY_ID[spId]; if (!s) return [];
    const L = D.LEARN, ts = typesOf(spId), el = ts[0], b = baseStats(spId), h = hash(spId);
    const [A, Df, Sp] = s.base || [50, 50, 50];
    const fast = Sp >= 70, sturdy = Df >= 70, strong = A >= 80, special = b.spa > b.atk;
    const out = [], add = (lv, id) => { if (D.MOVES[id]) out.push({ lv, id }); };
    add(L.start, h % 2 ? 'scratch' : 'tackle');
    add(L.support1, A >= Df ? 'growl' : 'tailWhip');
    (D.ELEMENT_MOVES[el] || []).forEach((id, i) => add(L.element[i] || 50, id));
    if (ts[1]) (D.ELEMENT_MOVES[ts[1]] || []).slice(0, 3).forEach((id, i) => add(L.second[i] || 50, id));   // its second type
    add(L.build, fast ? 'quickAttack' : sturdy ? 'harden' : A >= Df ? 'tailWhip' : 'growl');
    const tm = (D.TYPE_MOVES[el] || []).concat(ts[1] ? (D.TYPE_MOVES[ts[1]] || []).slice(0, 1) : []);
    if (tm[0]) add(L.type1, tm[0]);
    if (tm[1]) add(L.type2, tm[1]);
    if (tm[2]) add(L.type2 + 8, tm[2]);
    add(L.support2, fast ? 'agility' : special ? 'calmMind' : sturdy ? 'protect' : 'harden');
    add(L.bulk, strong ? 'takeDown' : 'bodySlam');
    if (el !== 'normal') add(L.element[1] + 4, 'swift');
    add(L.extra, 'protect');
    if (s.tier === 'legend' || ts.includes('fairy') || ts.includes('psychic')) add(40, 'recover');
    if (A + Df + Sp >= 230 || s.tier === 'legend') add(L.finale, 'hyperBeam');
    if (ts.includes('fire') && strong) add(L.element[2] + 6, 'flareBlitz');
    const seen = {}, list = [];
    out.sort((a, c) => a.lv - c.lv).forEach(x => { if (!seen[x.id]) { seen[x.id] = 1; list.push(x); } });
    return (learnCache[spId] = list);
  }
  const learnedBy = (spId, level) => learnset(spId).filter(x => x.lv <= level).map(x => x.id);
  /** a sensible set of four: its newest strong moves of different elements, plus one support move */
  function defaultMoves(spId, level) {
    const ids = learnedBy(spId, level).reverse(), ts = typesOf(spId);
    const dmg = ids.filter(id => isDamaging(D.MOVES[id])), sup = ids.filter(id => !isDamaging(D.MOVES[id]));
    const pick = [];
    const stab = dmg.filter(id => ts.includes(D.MOVES[id].el));
    if (stab[0]) pick.push(stab[0]);
    dmg.forEach(id => { if (pick.length < 3 && !pick.includes(id) && !pick.some(p => D.MOVES[p].el === D.MOVES[id].el && D.MOVES[p].power >= D.MOVES[id].power)) pick.push(id); });
    if (stab[1] && pick.length < 3 && !pick.includes(stab[1])) pick.push(stab[1]);
    if (sup[0] && pick.length < 4) pick.push(sup[0]);
    ids.forEach(id => { if (pick.length < 4 && !pick.includes(id)) pick.push(id); });
    return pick.slice(0, 4);
  }
  /** make sure a saved Pal has a valid move list ({ id, pp }); returns true if it changed */
  function ensureMoves(m, level) {
    if (!m || m.egg || !SPECIES_BY_ID[m.sp]) return false;
    const ok = Array.isArray(m.moves) && m.moves.length && m.moves.every(x => x && D.MOVES[x.id] && x.id !== B.struggle);
    if (ok) { m.moves = m.moves.slice(0, 4); m.moves.forEach(x => { x.pp = clamp(Math.round(Number(x.pp) || 0), 0, D.MOVES[x.id].pp); }); return false; }
    m.moves = defaultMoves(m.sp, level).map(id => ({ id, pp: D.MOVES[id].pp }));
    return true;
  }

  // ---------------- battlers ----------------
  /** o: { sp, level, genes, tr, moves: [{id, pp}], hpFrac, name, shiny, bond, care: {food, joy, ene, hyg}, mine } */
  function make(o) {
    const lv = clamp(o.level | 0, 1, 100), st = stats(o.sp, lv, o.genes, o.tr), types = typesOf(o.sp), el = types[0];
    const care = o.care, avg = care ? (care.food + care.joy + care.ene + care.hyg) / 4 : 0;
    const cared = !!(o.mine && care && avg >= B.care.goodAvg), happy = !!(o.mine && care && care.joy >= B.care.happyJoy);
    const moves = (o.moves && o.moves.length ? o.moves : defaultMoves(o.sp, lv).map(id => ({ id, pp: D.MOVES[id].pp })))
      .filter(x => D.MOVES[x.id]).slice(0, 4).map(x => ({ id: x.id, pp: clamp(x.pp == null ? D.MOVES[x.id].pp : x.pp, 0, D.MOVES[x.id].pp), max: D.MOVES[x.id].pp }));
    const bond = o.mine ? o.bond || 0 : 0;
    const maxHp = st.hp, frac = o.hpFrac == null ? 1 : clamp(o.hpFrac, 0, 1);
    return {
      id: o.sp, sp: o.sp, name: o.name || (SPECIES_BY_ID[o.sp] || {}).name || '?', shiny: !!o.shiny, level: lv, elem: el, types,
      stats: st, maxHp, hp: Math.max(frac > 0 ? 1 : 0, Math.round(maxHp * frac)), moves,
      stages: { atk: 0, def: 0, spa: 0, sdef: 0, spe: 0, acc: 0, eva: 0 }, status: null, slpTurns: 0, vol: {},
      mine: !!o.mine, bond, cared, happy, statMult: cared ? 1 + B.care.goodBonus : 1, critBonus: happy ? B.care.happyCrit : 0,
      accBonus: o.mine ? bond / 100 * B.care.bondAcc : 0,
      canEndure: !!o.mine && bond >= B.endureBond, canAwaken: !!o.mine && bond >= B.awakenBond,
    };
  }
  const stageMult = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
  const accMult = s => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
  function speedOf(b) {
    let s = b.stats.spe * stageMult(b.stages.spe);
    if (b.status === 'par') s *= B.paralysisSpeed;
    if (b.vol.awaken) s *= B.awaken.mult;
    return s;
  }
  const usable = b => b.moves.filter(x => x.pp > 0);

  // ---------------- damage ----------------
  function calc(s, t, mv, crit, roll) {
    const phys = mv.cat === 'phys';
    const aS = phys ? s.stages.atk : s.stages.spa, dS = phys ? t.stages.def : t.stages.sdef;
    let atk = (phys ? s.stats.atk : s.stats.spa) * stageMult(crit ? Math.max(0, aS) : aS) * s.statMult * (s.vol.awaken ? B.awaken.mult : 1);
    const def = (phys ? t.stats.def : t.stats.sdef) * stageMult(crit ? Math.min(0, dS) : dS) * t.statMult;
    const base = Math.floor(Math.floor(Math.floor(2 * s.level / 5 + 2) * mv.power * atk / Math.max(1, def)) / 50) + 2;
    const eff = mv.struggle ? 1 : mult(mv.el, t.types), stab = !mv.struggle && s.types.includes(mv.el) ? B.stab : 1;
    const burn = phys && s.status === 'brn' ? B.burnPhysical : 1;
    if (eff === 0) return { dmg: 0, eff, stab: stab > 1 };
    const dmg = Math.max(1, Math.floor(base * stab * eff * (crit ? B.critMult : 1) * roll * burn * (B.damageScale || 1)));
    return { dmg, eff, stab: stab > 1 };
  }
  /** expected damage of a move (no crit, average roll): for the AI, the move buttons and recommendations */
  function estimate(s, t, id) {
    const mv = move(id); if (!isDamaging(mv)) return 0;
    const hits = mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1;
    return calc(s, t, mv, false, (1 + B.randomMin) / 2).dmg * hits;
  }

  // ---------------- one turn ----------------
  /** act: { type: 'move', idx } | { type: 'struggle' } | { type: 'pass' }, plus awaken: true to use Bond Awakening first */
  function turn(me, foe, actMe, actFoe) {
    const ev = [];
    const sides = [{ s: me, t: foe, a: actMe, side: 'me' }, { s: foe, t: me, a: actFoe, side: 'foe' }];
    sides.forEach(x => { x.s.vol.flinch = false; x.s.vol.protect = false; });
    sides.forEach(x => { if (x.a && x.a.awaken) awaken(x.s, x.side, ev); });
    const pri = x => {
      if (!x.a || x.a.type === 'pass') return 99;
      if (x.s.vol.charging || x.s.vol.recharge) return 0;
      const mv = x.a.type === 'struggle' ? move(B.struggle) : move((x.s.moves[x.a.idx] || {}).id);
      return mv ? mv.pri || 0 : 0;
    };
    const order = sides.slice().sort((x, y) => pri(y) - pri(x) || speedOf(y.s) - speedOf(x.s) || (R() < .5 ? -1 : 1));
    for (const x of order) {
      if (!x.a || x.a.type === 'pass' || x.s.hp <= 0 || x.t.hp <= 0) continue;
      act(x.s, x.t, x.a, x.side, ev);
    }
    // end of turn: burn and poison, Bond Awakening wears off
    sides.forEach(x => {
      const b = x.s; if (b.hp <= 0) return;
      if (b.status === 'brn' || b.status === 'psn') {
        const d = Math.max(1, Math.floor(b.maxHp * (b.status === 'brn' ? B.burnTick : B.poisonTick)));
        b.hp = Math.max(0, b.hp - d);
        ev.push({ t: 'dot', side: x.side, amount: d, status: b.status, hp: b.hp, text: `${b.name} is hurt by its ${b.status === 'brn' ? 'burn' : 'poison'}!` });
        if (b.hp <= 0) ev.push({ t: 'faint', side: x.side, text: `${b.name} fainted!` });
      }
      if (b.vol.awaken) { b.vol.awaken--; if (!b.vol.awaken) ev.push({ t: 'awakenEnd', side: x.side, text: `${b.name}'s Bond Awakening faded.` }); }
    });
    return ev;
  }
  function awaken(b, side, ev) {
    if (!b.canAwaken || b.vol.awakenUsed || b.hp <= 0) return;
    b.vol.awakenUsed = true; b.vol.awaken = B.awaken.turns;
    const h = Math.round(b.maxHp * B.awaken.heal); b.hp = Math.min(b.maxHp, b.hp + h);
    ev.push({ t: 'awaken', side, hp: b.hp, text: `${b.name}'s bond with you awakens its true power!` });
  }
  function act(s, t, a, side, ev) {
    const other = side === 'me' ? 'foe' : 'me';
    if (s.vol.recharge) { s.vol.recharge = false; ev.push({ t: 'msg', side, text: `${s.name} must recharge!` }); return; }
    // what it's using
    let slot = null, mv;
    if (s.vol.charging) { mv = move(s.vol.charging); }
    else if (a.type === 'struggle' || !usable(s).length) { mv = move(B.struggle); }
    else { slot = s.moves[a.idx]; if (!slot || slot.pp <= 0) slot = usable(s)[0]; mv = move(slot.id); }
    // can it move?
    if (s.status === 'slp') {
      if (s.slpTurns > 0) { s.slpTurns--; ev.push({ t: 'msg', side, text: `${s.name} is fast asleep.` }); s.vol.charging = null; return; }
      s.status = null; ev.push({ t: 'cure', side, text: `${s.name} woke up!` });
    }
    if (s.status === 'frz') {
      if (R() < B.freezeThaw || (mv.el === 'fire' && isDamaging(mv))) { s.status = null; ev.push({ t: 'cure', side, text: `${s.name} thawed out!` }); }
      else { ev.push({ t: 'msg', side, text: `${s.name} is frozen solid!` }); return; }
    }
    if (s.vol.flinch) { s.vol.flinch = false; s.vol.charging = null; ev.push({ t: 'msg', side, text: `${s.name} flinched and couldn't move!` }); return; }
    if (s.status === 'par' && R() < B.paralysisSkip) { s.vol.charging = null; ev.push({ t: 'msg', side, text: `${s.name} is paralysed! It can't move!` }); return; }
    // pay the PP (a charged move was paid for on the first turn)
    const second = !!s.vol.charging;
    if (slot && !second) slot.pp = Math.max(0, slot.pp - 1);
    if (!mv.protect) s.vol.protectedLast = false;
    ev.push({ t: 'use', side, move: mv.id, el: mv.el, text: `${s.name} used ${mv.name}!` });
    if (mv.struggle && !second && a.type !== 'struggle') ev.push({ t: 'msg', side, text: `${s.name} has no PP left!` });
    if (mv.charge && !second) { s.vol.charging = mv.id; ev.push({ t: 'msg', side, text: `${s.name} is soaking up sunlight!` }); return; }
    s.vol.charging = null;
    // moves on itself
    if (mv.protect) {
      if (s.vol.protectedLast && R() > 1 / 3) { s.vol.protectedLast = false; ev.push({ t: 'msg', side, text: 'But it failed!' }); return; }
      s.vol.protect = true; s.vol.protectedLast = true; ev.push({ t: 'protect', side, text: `${s.name} protected itself!` }); return;
    }
    const targetsFoe = isDamaging(mv) || mv.foe || ['slp', 'par', 'psn', 'brn', 'frz'].some(k => mv[k] && mv.cat === 'status');
    if (targetsFoe && t.vol.protect) { ev.push({ t: 'msg', side: other, text: `${t.name} protected itself!` }); return; }
    if (targetsFoe && mv.acc > 0) {
      const chance = mv.acc / 100 * accMult(clamp(s.stages.acc - t.stages.eva, -6, 6)) * (1 + s.accBonus);
      if (R() >= chance) { ev.push({ t: 'miss', side, text: `${s.name}'s attack missed!` }); return; }
    }
    if (mv.heal) {
      if (s.hp >= s.maxHp) { ev.push({ t: 'msg', side, text: 'But its HP is already full!' }); }
      else { const h = Math.round(s.maxHp * mv.heal); s.hp = Math.min(s.maxHp, s.hp + h); ev.push({ t: 'heal', side, hp: s.hp, text: `${s.name} restored its HP!` }); }
    }
    if (mv.self) stageChange(s, mv.self, side, ev);
    if (!isDamaging(mv)) {
      if (mv.el === 'electric' && ['slp', 'par', 'psn', 'brn', 'frz'].some(k => mv[k]) && mult('electric', t.types) === 0) { ev.push({ t: 'msg', side: other, text: `It doesn't affect ${t.name}…` }); return; }
      if (mv.foe) stageChange(t, mv.foe, other, ev, true);
      ['slp', 'par', 'psn', 'brn', 'frz'].forEach(k => { if (mv[k]) inflict(t, k, other, ev, true); });
      return;
    }
    // a type that can't touch it (Ground vs Flying, Normal vs Ghost…): nothing happens
    if (!mv.struggle && mult(mv.el, t.types) === 0) { ev.push({ t: 'msg', side: other, text: `It doesn't affect ${t.name}…` }); return; }
    // damage, hit by hit
    const hits = mv.hits ? mv.hits[0] + Math.floor(R() * (mv.hits[1] - mv.hits[0] + 1)) : 1;
    let total = 0, n = 0;
    for (let i = 0; i < hits && t.hp > 0; i++) {
      const stage = (mv.crit || 0) + s.critBonus + (s.vol.awaken ? B.awaken.critStage : 0);
      const crit = R() < B.critChance[clamp(stage, 0, B.critChance.length - 1)];
      const r = calc(s, t, mv, crit, B.randomMin + R() * (1 - B.randomMin));
      t.hp = Math.max(0, t.hp - r.dmg); total += r.dmg; n++;
      let endured = false;
      if (t.hp <= 0 && t.canEndure && !t.vol.endured) { t.hp = 1; t.vol.endured = true; endured = true; }
      ev.push({ t: 'dmg', side: other, amount: r.dmg, eff: r.eff, crit, hp: t.hp, hit: hits > 1 ? i + 1 : 0,
        text: crit ? 'A critical hit!' : '' });
      if (endured) ev.push({ t: 'endure', side: other, text: `${t.name} endured the hit thanks to its bond with you!` });
    }
    const eff = mult(mv.el, t.types);
    if (!mv.struggle && eff > 1) ev.push({ t: 'msg', side: other, text: eff >= 4 ? 'It\'s extremely effective!' : 'It\'s super effective!' });
    else if (!mv.struggle && eff < 1) ev.push({ t: 'msg', side: other, text: 'It\'s not very effective…' });
    if (hits > 1) ev.push({ t: 'msg', side, text: `Hit ${n} time${n > 1 ? 's' : ''}!` });
    if (t.hp <= 0) ev.push({ t: 'faint', side: other, text: `${t.name} fainted!` });
    // after the hit
    if (mv.drain && total > 0 && s.hp < s.maxHp) { const h = Math.max(1, Math.round(total * mv.drain)); s.hp = Math.min(s.maxHp, s.hp + h); ev.push({ t: 'heal', side, hp: s.hp, text: `${t.name} had its energy drained!` }); }
    if ((mv.recoil || mv.struggle) && total > 0) {
      const d = Math.max(1, Math.round(mv.struggle ? s.maxHp * B.struggleRecoil : total * mv.recoil));
      s.hp = Math.max(0, s.hp - d); ev.push({ t: 'recoil', side, amount: d, hp: s.hp, text: `${s.name} is hit with recoil!` });
      if (s.hp <= 0) ev.push({ t: 'faint', side, text: `${s.name} fainted!` });
    }
    if (mv.recharge) s.vol.recharge = true;
    if (t.hp > 0) {
      if (t.status === 'frz' && mv.el === 'fire') { t.status = null; ev.push({ t: 'cure', side: other, text: `${t.name} thawed out!` }); }
      ['brn', 'par', 'psn', 'frz', 'slp'].forEach(k => { if (mv[k] && R() * 100 < mv[k]) inflict(t, k, other, ev, false); });
      if (mv.flinch && R() * 100 < mv.flinch) t.vol.flinch = true;
      if (mv.foe && R() * 100 < (mv.foe.chance || 100)) stageChange(t, mv.foe, other, ev, false);
    }
  }
  function inflict(t, k, side, ev, loud) {
    if (t.hp <= 0) return;
    if (t.status) { if (loud) ev.push({ t: 'msg', side, text: 'But it failed!' }); return; }
    if ((D.STATUS_IMMUNE[k] || []).some(ty => t.types.includes(ty))) { if (loud) ev.push({ t: 'msg', side, text: `It doesn't affect ${t.name}…` }); return; }
    t.status = k;
    if (k === 'slp') t.slpTurns = B.sleepTurns[0] + Math.floor(R() * (B.sleepTurns[1] - B.sleepTurns[0] + 1));
    ev.push({ t: 'status', side, status: k, text: `${t.name} is ${k === 'slp' ? 'now asleep' : STATUS_LABEL[k]}!` });
  }
  function stageChange(b, changes, side, ev, loud) {
    Object.entries(changes).forEach(([k, d]) => {
      if (k === 'chance' || !STAGE_KEYS.includes(k)) return;
      const before = b.stages[k], after = clamp(before + d, -6, 6);
      if (after === before) { if (loud !== false) ev.push({ t: 'msg', side, text: `${b.name}'s ${STAT_LABEL[k]} won't go any ${d > 0 ? 'higher' : 'lower'}!` }); return; }
      b.stages[k] = after;
      const n = Math.abs(after - before);
      ev.push({ t: 'stat', side, stat: k, delta: after - before, text: `${b.name}'s ${STAT_LABEL[k]} ${d > 0 ? (n > 1 ? 'rose sharply' : 'rose') : (n > 1 ? 'harshly fell' : 'fell')}!` });
    });
  }

  // ---------------- enemy AI ----------------
  /** scores every usable move and usually picks the best (smart = chance of the best pick) */
  function choose(s, t, smart = .7) {
    if (s.vol.charging || s.vol.recharge) return { type: 'move', idx: 0 };
    const opts = s.moves.map((x, idx) => ({ x, idx })).filter(o => o.x.pp > 0);
    if (!opts.length) return { type: 'struggle' };
    const hpK = s.hp / s.maxHp;
    const scored = opts.map(o => {
      const mv = move(o.x.id); let sc = 0;
      if (isDamaging(mv)) {
        const est = estimate(s, t, mv.id) * (mv.acc ? mv.acc / 100 : 1);
        sc = est / Math.max(1, t.maxHp) * 100;
        if (est >= t.hp) sc += 60 + (mv.pri > 0 ? 30 : 0);
        if (mv.charge) sc *= .55; if (mv.recharge) sc *= est >= t.hp ? 1 : .6;
        if (mv.drain && hpK < .6) sc *= 1.25;
        if (mv.recoil && hpK < .3) sc *= .7;
        if (mult(mv.el, t.types) === 0) sc = 0; else if (mult(mv.el, t.types) < 1) sc *= .8;
      } else {
        if (mv.heal) sc = hpK < .45 ? 70 : hpK < .7 ? 15 : 0;
        else if (mv.protect) sc = s.vol.protectedLast ? 0 : (t.status === 'psn' || t.status === 'brn' ? 30 : 8);
        else if (mv.self) sc = hpK > .6 && Object.keys(mv.self).every(k => s.stages[k] < 2) ? 26 : 2;
        else if (mv.foe) sc = Object.keys(mv.foe).filter(k => k !== 'chance').every(k => t.stages[k] > -2) ? 14 : 1;
        ['slp', 'par', 'psn', 'brn', 'frz'].forEach(k => { if (mv[k]) sc = t.status ? 0 : (k === 'slp' ? 45 : 32) * (mv.acc ? mv.acc / 100 : 1); });
      }
      return { idx: o.idx, sc: Math.max(0, sc) };
    }).sort((a, b) => b.sc - a.sc);
    if (R() < smart || scored.length === 1) return { type: 'move', idx: scored[0].idx };
    const pool = scored.filter(x => x.sc > 0), tot = pool.reduce((a, x) => a + x.sc, 0);
    if (!pool.length || !tot) return { type: 'move', idx: scored[0].idx };
    let r = R() * tot; for (const x of pool) if ((r -= x.sc) < 0) return { type: 'move', idx: x.idx };
    return { type: 'move', idx: scored[0].idx };
  }

  // ---------------- catching ----------------
  function catchChance(t, ballRate, mult2 = 1) {
    if (ballRate >= 1) return 1;
    const hpK = clamp(t.hp / t.maxHp, 0, 1), st = t.status ? B.capture.statusBonus[t.status] || 1 : 1;
    return clamp(ballRate * (.6 + 1.6 * (1 - hpK)) * st * mult2, 0, 1);
  }

  // ---------------- explore recommendations ----------------
  /** pool: [{ types: [a, b?], share }] — the Pals you can meet in an area (shares add up to 1).
   *  Returns the same combos merged, plus how common each single type is there. */
  function enemyPool(pool) {
    const combos = {}, byType = {};
    pool.forEach(p => {
      const k = p.types.join('/'); combos[k] = combos[k] || { types: p.types, share: 0 }; combos[k].share += p.share;
      p.types.forEach(t => { byType[t] = (byType[t] || 0) + p.share; });
    });
    const tot = Object.values(byType).reduce((a, b) => a + b, 0) || 1;
    return {
      combos: Object.values(combos).sort((a, b) => b.share - a.share),
      byType: Object.entries(byType).map(([el, n]) => ({ el, share: n / tot })).sort((a, b) => b.share - a.share),
    };
  }
  /** what an area's Pals do to you: the worst of their types against yours */
  const taken = (combo, mine) => Math.max(...combo.types.map(t => mult(t, mine)));
  /** types that hit the area hard and take little back, and types that struggle there */
  function areaAdvice(E2) {
    const rows = EL_IDS.map(el => {
      const atk = E2.combos.reduce((a, c) => a + c.share * mult(el, c.types), 0);
      const tak = E2.combos.reduce((a, c) => a + c.share * taken(c, [el]), 0);
      return { el, atk, tak, score: atk - tak };
    });
    const good = rows.filter(r => r.score > .1 && r.atk > 1).sort((a, b) => b.score - a.score).slice(0, 3).map(r => r.el);
    const bad = rows.filter(r => r.tak > 1.15).sort((a, b) => b.tak - a.tak).slice(0, 3).map(r => r.el);
    return { good, bad };
  }
  /**
   * score Pals for an area. c: [{ key, name, sp, level, moves, hpFrac, ene, bond, eligible, why }]
   * returns the same list with { types, compat 0-100, reasons: [{ good, text }], warnings: [text] }, best first
   */
  function recommend(E2, rec, cands) {
    const top = E2.byType[0];
    return cands.map(c => {
      const ts = typesOf(c.sp), reasons = [], warnings = [];
      const mv = (c.moves || []).map(x => ({ x, m: move(x.id) })).filter(o => o.m);
      const dm = mv.filter(o => isDamaging(o.m) && o.x.pp > 0);
      // offence: its best usable move against each kind of Pal there (type match, STAB and a bit of power)
      let off = 0;
      E2.combos.forEach(cb => {
        let best = 0;
        dm.forEach(o => { const v = mult(o.m.el, cb.types) * (ts.includes(o.m.el) ? B.stab : 1) * Math.min(1.2, o.m.power / 80); if (v > best) best = v; });
        off += cb.share * Math.min(3, best) / 3;
      });
      let bestTop = null;
      if (top) dm.forEach(o => { const v = mult(o.m.el, [top.el]) * (ts.includes(o.m.el) ? B.stab : 1); if (!bestTop || v > bestTop.v) bestTop = { v, m: o.m }; });
      // defence: how hard their types hit it
      const take = E2.combos.reduce((a, cb) => a + cb.share * taken(cb, ts), 0);
      const def = clamp(1 - (take - .25) / 2.5, 0, 1);
      const lvK = clamp(c.level / Math.max(1, rec), 0, 1.25) / 1.25;
      const ppAll = mv.filter(o => isDamaging(o.m)), ppK = ppAll.length ? ppAll.reduce((a, o) => a + o.x.pp / o.m.pp, 0) / ppAll.length : 0;
      const hpK = clamp(c.hpFrac == null ? 1 : c.hpFrac, 0, 1), eneK = clamp((c.ene || 0) / 100, 0, 1), bondK = clamp((c.bond || 0) / 100, 0, 1);
      let compat = 100 * (.3 * off + .22 * def + .22 * lvK + .1 * hpK + .08 * ppK + .04 * eneK + .04 * bondK);
      if (!c.eligible) compat *= .5;
      compat = Math.round(clamp(compat, 1, 99));
      // why
      if (top && bestTop && bestTop.v >= 2) reasons.push({ good: true, text: `${bestTop.m.name} is super effective on ${elInfo(top.el).label} Pals` });
      else if (top && bestTop && bestTop.v >= 1.5) reasons.push({ good: true, text: `${bestTop.m.name} lands solid hits` });
      if (top) { const m = mult(top.el, ts); if (m === 0) reasons.push({ good: true, text: `Immune to ${elInfo(top.el).label} moves` }); else if (m < 1) reasons.push({ good: true, text: `Resists ${elInfo(top.el).label} moves` }); }
      if (c.level >= rec) reasons.push({ good: true, text: `Lv ${c.level} meets the recommended Lv ${rec}` });
      if (c.bond >= B.awakenBond) reasons.push({ good: true, text: 'Max bond: Bond Awakening ready' });
      else if (c.bond >= B.endureBond) reasons.push({ good: true, text: `Strong bond (${c.bond})` });
      const weakTo = E2.byType.filter(e => e.share >= .15 && mult(e.el, ts) > 1);
      if (weakTo.length) warnings.push(`${weakTo.some(e => mult(e.el, ts) >= 4) ? 'Very weak' : 'Weak'} to ${weakTo.map(e => elInfo(e.el).label).join(' and ')} Pals here`);
      if (c.level < rec) warnings.push(`Lv ${c.level} is below the recommended Lv ${rec}`);
      if (hpK < .5) warnings.push(`Low HP (${Math.round(hpK * 100)}%)`);
      if (ppAll.length && ppK < .35) warnings.push('Low PP: rest at home to restore it');
      if (!dm.length) warnings.push('No attacking moves with PP left');
      if (!c.eligible) warnings.push(c.why || 'Can\'t explore right now');
      if (!reasons.length) reasons.push({ good: true, text: 'A steady all-rounder' });
      return Object.assign({}, c, { types: ts, el: ts[0], compat, reasons, warnings });
    }).sort((a, b) => (b.eligible - a.eligible) || b.compat - a.compat);
  }

  return {
    ELEMENTS: E, EL_IDS, STAT_LABEL, STATUS_TAG, typesOf, elementOf, elInfo, mult, relations, move, isDamaging, baseStats, stats,
    learnset, learnedBy, defaultMoves, ensureMoves, make, turn, choose, estimate, speedOf, usable, catchChance,
    enemyPool, areaAdvice, recommend, B, D,
    _seed(f) { rng = typeof f === 'function' ? f : Math.random; },   // tests: a predictable random
  };
})();
if (typeof window !== 'undefined') window.Battle = Battle;
