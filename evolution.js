'use strict';
// Pocket Pals: how every Pokémon evolves. Shared by the game (game.js) and the Admin page.
// A Pokémon's evolution steps are:  { to, lv } (level up)  or  { to, item } (evolution item),
// each with an optional time of day: '' (any time), 'morning', 'afternoon', 'night' or 'day' (morning + afternoon).
// Defaults come from species.js (level evolutions) and evoitems.js (item evolutions). The admin can replace
// any Pokémon's steps (Admin → Evolutions); those edits are stored in Firestore config/evolutions and
// handed to Evolution.setOverrides().

const Evolution = (() => {
  const PERIODS = {
    '': 'Any time',
    morning: 'Morning (5:00–11:59)',
    afternoon: 'Afternoon (12:00–17:59)',
    night: 'Night (18:00–4:59)',
    day: 'Day (morning + afternoon)',
  };
  const WHEN = { morning: 'in the morning', afternoon: 'in the afternoon', night: 'at night', day: 'during the day' };
  const SHORT = { morning: 'morning', afternoon: 'afternoon', night: 'night', day: 'day' };

  /** the time of day right now on this device */
  function periodNow(d) {
    const h = (d || new Date()).getHours();
    return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 18 ? 'afternoon' : 'night';
  }
  function timeOk(t, now) {
    if (!t) return true;
    now = now || periodNow();
    return t === now || (t === 'day' && now !== 'night');
  }

  const SPECIES_LIST = typeof SPECIES_CONFIG !== 'undefined' ? SPECIES_CONFIG : [];
  const BY_ID = {}; SPECIES_LIST.forEach(s => { BY_ID[s.id] = s; });
  const ITEMS = typeof ITEM_DATA !== 'undefined' ? ITEM_DATA : {};
  const EVO = typeof EVO_ITEMS !== 'undefined' ? EVO_ITEMS : {};

  /** the built-in steps for species `id` (before any admin edits) */
  function defaults(id) {
    const s = BY_ID[id]; if (!s) return [];
    const items = [];
    Object.entries(EVO).forEach(([k, rows]) => rows.forEach(([f, to, time]) => {
      if (f === id && BY_ID[to] && ITEMS[k] && !items.some(m => m.to === to && m.item === k)) items.push({ to, item: k, time: time || '' });
    }));
    const itemTo = new Set(items.map(m => m.to));
    return (s.next || []).filter(n => BY_ID[n] && !itemTo.has(n)).map(to => ({ to, lv: s.evo || 1, time: '' })).concat(items);
  }

  // ---- admin edits
  let overrides = {};
  let usersCache = null;
  function clean(list) {
    return (Array.isArray(list) ? list : []).map(m => {
      const to = Math.round(Number(m && m.to)); if (!BY_ID[to]) return null;
      const time = PERIODS[m.time] !== undefined ? (m.time || '') : '';
      if (m.item) return ITEMS[m.item] && ITEMS[m.item].kind === 'evo' ? { to, item: m.item, time } : null;
      const lv = Math.max(1, Math.min(100, Math.round(Number(m.lv) || 1)));
      return { to, lv, time };
    }).filter(Boolean);
  }
  /** replace the admin edits: { speciesId: [steps] } */
  function setOverrides(o) {
    overrides = {};
    Object.entries(o || {}).forEach(([id, list]) => { if (BY_ID[+id]) overrides[+id] = clean(list); });
    usersCache = null;
  }
  const edited = id => Object.prototype.hasOwnProperty.call(overrides, id);

  /** how species `id` evolves (admin edits win over the defaults) */
  function steps(id) { return edited(id) ? overrides[id].slice() : defaults(id); }

  /** species ids an evolution item works on */
  function users(k) {
    if (!usersCache) {
      usersCache = {};
      SPECIES_LIST.forEach(s => steps(s.id).forEach(m => { if (m.item) (usersCache[m.item] = usersCache[m.item] || new Set()).add(s.id); }));
    }
    return [...(usersCache[k] || [])];
  }

  return { PERIODS, WHEN, SHORT, periodNow, timeOk, defaults, steps, users, setOverrides, edited, clean, get overrides() { return overrides; } };
})();
