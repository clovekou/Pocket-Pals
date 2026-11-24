'use strict';
// Pocket Pal — online play: Google sign-in, unique usernames + UIDs, cloud saves,
// friends, trading and friend battles. Backed by Firebase (Auth + Firestore).
// Configure it in online-config.js; until then the game simply stays offline.

const Online = (() => {
  const SDK = '10.12.2';
  const cfg = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !window.PP_PREVIEW ? FIREBASE_CONFIG : null;
  const st = {
    enabled: !!cfg, ready: false, error: null,
    user: null, profile: null, needsUsername: false,
    removedMsg: (() => { try { return sessionStorage.getItem('pocketpal.removedMsg') || ''; } catch (e) { return ''; } })(),
    incoming: [], outgoing: [], friends: [], trades: [], battles: [],
  };
  const subs = [];
  let db = null, auth = null, unsub = [], syncTimer = null, widgetTimer = null, lastSynced = '', cloudChecked = false;
  // multi-device sync: every upload is stamped with this device and a revision time, so a device
  // (or Safari, opened from the widget) can tell when another device saved newer progress
  const DEVICE = (() => { try { let d = localStorage.getItem('pocketpal.device'); if (!d) { d = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('pocketpal.device', d); } return d; } catch (e) { return 'x'; } })();
  const lastRevKey = () => 'pocketpal.syncRev.' + me();
  const lastRev = () => { try { return +localStorage.getItem(lastRevKey()) || 0; } catch (e) { return 0; } };
  const setLastRev = r => { try { localStorage.setItem(lastRevKey(), String(r || 0)); } catch (e) {} };
  let pulling = false;
  function takeCloud(cloud, why) {
    Game.importSave(cloud.data); lastSynced = cloud.data; setLastRev(cloud.rev); setApplied(cloud.adminRev);
    if (st.profile) Game.setTrainer({ name: st.profile.username, code: st.profile.code });
    subs.forEach(f => { try { f(st, { pulled: why }); } catch (e) {} });
  }
  /** the game came back on screen: load newer progress saved by another device */
  async function pullIfNewer() {
    if (!db || !me() || !st.profile || !cloudChecked || st.conflict || pulling) return;
    pulling = true;
    try {
      const snap = await db.collection('saves').doc(me()).get();
      const c = snap.exists && snap.data();
      if (c && c.data && c.device !== DEVICE && (c.rev || 0) > lastRev() && c.data !== Game.exportSave()) takeCloud(c, 'resume');
    } catch (e) {} finally { pulling = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) uploadSave(false).catch(() => {}); // leaving: save now, so the widget and other devices are up to date
    else pullIfNewer();
  });
  addEventListener('pagehide', () => { uploadSave(false).catch(() => {}); });

  // admin edits: the save document carries adminRev; we remember the last one we applied on this device
  const revKey = () => 'pocketpal.adminRev.' + me();
  const appliedRev = () => { try { return +localStorage.getItem(revKey()) || 0; } catch (e) { return 0; } };
  const setApplied = r => { try { localStorage.setItem(revKey(), String(r || 0)); } catch (e) {} };
  function applyAdminSave(d) {
    setApplied(d.adminRev); Game.importSave(d.data); lastSynced = d.data;
    if (st.profile) Game.setTrainer({ name: st.profile.username, code: st.profile.code });
    subs.forEach(f => { try { f(st, { adminEdit: true }); } catch (e) {} });
  }
  const emit = () => subs.forEach(f => { try { f(st); } catch (e) { console.error(e); } });

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
  }
  // ---------------- admin game settings (Firestore config/game) ----------------
  // Applied from the last-known copy straight away (works offline), then refreshed live from Firestore.
  const CFG_KEY = 'pocketpal.gameConfig';
  try { const c = localStorage.getItem(CFG_KEY); if (c) Game.applyConfig(JSON.parse(c)); } catch (e) {}
  const DEVMAIL_KEY = 'pocketpal.devmail';
  try { const c = localStorage.getItem(DEVMAIL_KEY); if (c) Game.applyDevMail(JSON.parse(c)); } catch (e) {}
  // admin edits to evolutions (Admin → Evolutions), same caching as the game settings
  const EVO_KEY = 'pocketpal.evolutions';
  try { const c = localStorage.getItem(EVO_KEY); if (c) Game.applyEvolutions(JSON.parse(c)); } catch (e) {}
  function watchEvolutions() {
    db.collection('config').doc('evolutions').onSnapshot(d => {
      const steps = (d.exists && d.data().steps) || {};
      Game.applyEvolutions(steps);
      try { localStorage.setItem(EVO_KEY, JSON.stringify(steps)); } catch (e) {}
      emit();
    }, () => {});
  }
  // ---------------- shop backgrounds (Admin → Backgrounds) ----------------
  // The list comes live from Firestore; a full picture is fetched only when it's needed, and the one
  // in use is kept on the device so it shows straight away (and offline) next time.
  st.backgrounds = [];
  try { st.backgrounds = JSON.parse(localStorage.getItem('pocketpal.bgList') || '[]'); } catch (e) {}
  function watchBackgrounds() {
    db.collection('shopBackgrounds').onSnapshot(q => {
      st.backgrounds = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(b => b.active !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)))
        .map(b => ({ id: b.id, name: b.name || 'Background', price: Math.max(0, b.price | 0), thumb: b.thumb || '' }));
      try { localStorage.setItem('pocketpal.bgList', JSON.stringify(st.backgrounds)); } catch (e) {}
      emit();
    }, () => {});
  }
  const bgImages = {};
  function backgroundImage(id) {
    if (bgImages[id]) return bgImages[id];
    const key = 'pocketpal.bgImage.' + id;
    let cached = null; try { cached = localStorage.getItem(key); } catch (e) {}
    if (cached) return (bgImages[id] = Promise.resolve(cached));
    if (!db) return Promise.resolve(null);
    return (bgImages[id] = db.collection('shopBackgroundImages').doc(id).get().then(d => {
      const url = d.exists ? d.data().image : null;
      if (url) { try { Object.keys(localStorage).filter(k => k.startsWith('pocketpal.bgImage.') && k !== key).forEach(k => localStorage.removeItem(k)); localStorage.setItem(key, url); } catch (e) {} }
      return url;
    }).catch(() => { delete bgImages[id]; return null; }));
  }
  function watchConfig() {
    db.collection('config').doc('game').onSnapshot(d => {
      const c = d.exists ? d.data() : {};
      delete c.updatedAt; delete c.updatedBy;
      Game.applyConfig(c);
      try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
      emit();
    }, () => {});
    // broadcasts from Admin → Announcement arrive live, while people are playing
    db.collection('config').doc('news').onSnapshot(d => {
      const n = d.exists ? d.data() : null;
      Game.applyNews(n && n.text ? { id: n.id, text: n.text } : null);
    }, () => {});
    // messages from Admin → Developer mail, shown in the mail box on the home screen
    db.collection('config').doc('devmail').onSnapshot(d => {
      const posts = d.exists ? d.data().posts : [];
      Game.applyDevMail(posts);
      try { localStorage.setItem(DEVMAIL_KEY, JSON.stringify(posts || [])); } catch (e) {}
    }, () => {});
  }

  // ---------------- gift codes (made by the admin, entered in Options) ----------------
  // Each account can redeem a code once: the claim document and the use counter are written together,
  // and the Firestore rules check the code is active, not expired and not used up.
  async function redeemCode(raw) {
    const code = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) throw new Error("That doesn't look like a code.");
    if (!db) throw new Error('Codes need online play, which isn\'t set up in this game.');
    if (!me()) throw new Error('Sign in first (Options → Account & friends) to redeem codes.');
    if (!Game.feature('codes')) throw new Error('Codes are switched off right now.');
    if (Game.hasRedeemed(code)) throw new Error('You already redeemed this code.');
    const ref = db.collection('giftCodes').doc(code), claim = ref.collection('claims').doc(me());
    const gift = await db.runTransaction(async tx => {
      const d = await tx.get(ref);
      if (!d.exists) throw new Error('That code doesn\'t exist. Check the spelling.');
      const g = d.data();
      if (g.active === false) throw new Error('This code isn\'t active any more.');
      if (g.expires && Date.now() > g.expires) throw new Error('This code has expired.');
      if (g.maxUses && (g.uses || 0) >= g.maxUses) throw new Error('This code has been fully claimed.');
      if ((await tx.get(claim)).exists) throw new Error('You already redeemed this code.');
      tx.update(ref, { uses: (g.uses || 0) + 1 });
      tx.set(claim, { at: now(), username: (st.profile && st.profile.username) || '' });
      return g;
    }).catch(e => { throw new Error(/permission/i.test(e.code || e.message) ? 'This code can\'t be redeemed right now.' : friendly(e)); });
    const out = Game.redeemGift(code, gift);
    uploadSave(true).catch(() => {});
    return { ...out, label: gift.label || code, message: gift.message || '' };
  }

  async function init() {
    if (!cfg) { emit(); return; }
    try {
      const base = `https://www.gstatic.com/firebasejs/${SDK}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
      firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
      auth.getRedirectResult().catch(e => { st.error = friendly(e); emit(); });
      auth.onAuthStateChanged(onUser);
      watchConfig(); watchEvolutions(); watchBackgrounds();
      st.ready = true; emit();
    } catch (e) { st.error = friendly(e); emit(); }
  }
  const friendly = e => (e && (e.message || e.code) || String(e)).replace(/^Firebase: /, '');
  const now = () => firebase.firestore.FieldValue.serverTimestamp();
  const me = () => st.user && st.user.uid;

  // ---------------- sign in / out ----------------
  async function signIn() {
    if (!auth) throw new Error('Online play is not set up yet.');
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      // home-screen apps and some phones block popups: fall back to a full-page redirect
      if (/popup|operation-not-supported|web-storage/i.test(e.code || e.message || '')) return auth.signInWithRedirect(provider);
      throw new Error(friendly(e));
    }
  }
  async function signOut() { await uploadSave(true).catch(() => {}); return auth && auth.signOut(); }

  async function onUser(user) {
    unsub.forEach(u => u()); unsub = []; clearInterval(syncTimer); clearInterval(widgetTimer);
    Object.assign(st, { user, profile: null, needsUsername: false, incoming: [], outgoing: [], friends: [], trades: [], battles: [] });
    cloudChecked = false; st.cloudChecked = false;
    if (!user) { Game.setTrainer(null); emit(); return; }
    try {
      const gone = await db.collection('removed').doc(user.uid).get().catch(() => null);
      if (gone && gone.exists) return accountRemoved(user, gone.data());
      const doc = await db.collection('users').doc(user.uid).get();
      if (!doc.exists) { st.needsUsername = true; emit(); return; }
      startSession(doc.data());
    } catch (e) { st.error = friendly(e); emit(); }
  }
  // ---------------- removed by an admin (Admin → Players → Delete player) ----------------
  // The admin deletes the account's cloud data and leaves a note at removed/{uid}. This device then wipes its own
  // copy of the save too, so the deleted progress can't be uploaded again. Deleted: the player can start over as new.
  // Banned: they're signed out, and every later sign-in ends the same way until an admin lifts the ban.
  let removing = false;
  async function accountRemoved(user, note) {
    if (removing) return; removing = true;
    unsub.forEach(u => u()); unsub = []; clearInterval(syncTimer); clearInterval(widgetTimer);
    st.profile = null; cloudChecked = false; st.cloudChecked = false; lastSynced = '';
    try { ['pocketpal.syncRev.', 'pocketpal.adminRev.'].forEach(k => localStorage.removeItem(k + user.uid)); } catch (e) {}
    Game.reset();
    const banned = !!(note && note.ban);
    try { sessionStorage.setItem('pocketpal.removedMsg', banned ? 'banned' : 'deleted'); } catch (e) {}
    if (banned) await auth.signOut().catch(() => {});
    else await db.collection('removed').doc(user.uid).delete().catch(() => {});   // seen: it can start again as a new player
    location.reload();
  }
  /** the welcome screen has shown the "removed" message */
  function clearRemovedMsg() { st.removedMsg = ''; try { sessionStorage.removeItem('pocketpal.removedMsg'); } catch (e) {} }
  function startSession(profile) {
    st.profile = profile; st.needsUsername = false;
    Game.setTrainer({ name: profile.username, code: profile.code });
    listen(); emit();
    checkCloudSave();
    syncTimer = setInterval(() => uploadSave(false), 20000);
    // the home-screen widget and desktop apps: publish your main's stats every 10 s (only when they've changed)
    widgetTimer = setInterval(() => syncWidget(false).catch(() => {}), 10000);
  }

  // ---------------- unique username + UID ----------------
  const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
  function randomCode() {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint32Array(8); crypto.getRandomValues(a);
    return 'PP-' + [...a].map(n => abc[n % abc.length]).join('');
  }
  async function usernameFree(name) {
    if (!NAME_RE.test(name)) return false;
    return !(await db.collection('usernames').doc(name.toLowerCase()).get()).exists;
  }
  async function createProfile(name) {
    name = String(name || '').trim();
    if (!NAME_RE.test(name)) throw new Error('3–16 letters, numbers or _ only.');
    const uid = me(); if (!uid) throw new Error('Sign in first.');
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      try {
        const profile = await db.runTransaction(async tx => {
          const nRef = db.collection('usernames').doc(name.toLowerCase()), cRef = db.collection('codes').doc(code), uRef = db.collection('users').doc(uid);
          const [n, c, u] = await Promise.all([tx.get(nRef), tx.get(cRef), tx.get(uRef)]);
          if (u.exists) return u.data();
          if (n.exists) throw new Error('TAKEN');
          if (c.exists) throw new Error('CODE');
          const p = { username: name, usernameLower: name.toLowerCase(), code, createdAt: now(), showcase: Game.showcase() };
          tx.set(nRef, { uid }); tx.set(cRef, { uid }); tx.set(uRef, p);
          return p;
        });
        startSession(profile); return profile;
      } catch (e) {
        if (e.message === 'TAKEN') throw new Error(`"${name}" is already taken — try another.`);
        if (e.message !== 'CODE') throw new Error(friendly(e));
      }
    }
    throw new Error('Could not create a unique ID, please try again.');
  }

  // ---------------- cloud save ----------------
  async function checkCloudSave() {
    const snap = await db.collection('saves').doc(me()).get().catch(() => null);
    cloudChecked = true; st.cloudChecked = true;
    if (!snap || !snap.exists) { emit(); uploadSave(true); return; }
    const cloud = snap.data();
    const local = JSON.parse(Game.exportSave());
    const hasLocal = local.player && local.player.starterPicked;
    if (hasLocal && (cloud.adminRev || 0) > appliedRev() && cloud.data) { applyAdminSave(cloud); emit(); return; }
    if (!hasLocal) setApplied(cloud.adminRev);
    if (!hasLocal || cloud.data === Game.exportSave()) { Game.importSave(cloud.data); lastSynced = cloud.data; setLastRev(cloud.rev); Game.setTrainer({ name: st.profile.username, code: st.profile.code }); emit(); return; }
    // this device already plays on this account: no question needed, keep whichever is newer
    if (cloud.device === DEVICE || (!cloud.device && !cloud.adminRev)) { emit(); uploadSave(true); return; } // ours, or saved before devices were tracked
    if (lastRev() && cloud.data) {
      if ((cloud.rev || 0) > lastRev()) { takeCloud(cloud, 'login'); emit(); return; }
      emit(); uploadSave(true); return;
    }
    setApplied(cloud.adminRev); // either choice starts from the account's latest admin version
    st.conflict = { cloud, cloudInfo: describe(JSON.parse(cloud.data)), localInfo: describe(local) };
    emit();
  }
  function describe(s) {
    const p = s.pet, sp = p && SPECIES_BY_ID[p.sp];
    return { name: !p ? 'No Pokémon' : p.egg ? 'An egg' : `${p.name || (sp ? sp.name : '?')} Lv ${1 + Math.floor(p.ageMin / 60)}`, dex: Object.keys((s.player && s.player.dex) || {}).length, party: ((s.player && s.player.party) || []).length };
  }
  async function resolveConflict(useCloud) {
    const c = st.conflict; st.conflict = null;
    if (useCloud && c) { Game.importSave(c.cloud.data); lastSynced = c.cloud.data; setLastRev(c.cloud.rev); Game.setTrainer({ name: st.profile.username, code: st.profile.code }); }
    else await uploadSave(true);
    emit();
  }
  // ---------------- home-screen widget ----------------
  let lastWidget = '';
  function widgetCard() {
    const S = Game.state, p = S.pet; if (!p) return null;
    const sd = typeof SPRITE_DATA !== 'undefined' && SPRITE_DATA[p.sp], sp = SPECIES_BY_ID[p.sp];
    const r = v => Math.round(v || 0), food = r(p.food), joy = r(p.joy), ene = r(p.ene), hyg = r(p.hyg);
    const low = Math.min(food, joy, ene, hyg), avg = (food + joy + ene + hyg) / 4;
    let emo = 'Normal';
    if (!p.egg && !p.asleep) emo = low < 15 ? 'Crying' : low < 30 ? 'Sad' : avg >= 85 ? 'Joyous' : avg >= 65 ? 'Happy' : 'Normal';
    let face = 'https://clovekou.github.io/Pocket-Pals/assets/egg.png';
    if (!p.egg && sd) {
      const shiny = !!(p.shiny && sd.ps), mask = shiny ? sd.ps : sd.p;
      if (mask) {
        let i = EMOTIONS.indexOf(emo);
        if (i < 0 || !(mask & (1 << i))) i = mask & 1 ? 0 : Math.log2(mask & -mask);
        face = `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/${shiny ? collabShiny(p.sp) : collabPath(p.sp)}/${EMOTIONS[i]}.png`;
      }
    }
    const name = p.egg ? 'Egg' : (p.name || (sp ? sp.name : 'Pokémon'));
    const mood = p.egg ? 'Tap it 3 times to hatch!' : p.asleep ? 'Sleeping… Zzz' : food < 30 ? 'Hungry! Feed me a berry' : joy < 30 ? 'Bored… let\'s play!'
      : ene < 30 ? 'So sleepy…' : hyg < 30 ? 'Needs a bath!' : avg >= 80 ? 'Feeling great!' : 'Doing okay';
    return { uid: me(), trainer: st.profile.username, name, sp: p.sp, shiny: !!p.shiny, egg: !!p.egg, asleep: !!p.asleep,
      level: p.egg ? 0 : Game.level(), food, joy, ene, hyg, face, mood,
      path: collabPath(p.sp),   // SpriteCollab folder (regional forms aren't just a Pokédex number), for the desktop apps
      party: (S.player.party || []).filter(m => m && !m.egg).slice(0, 5).map(m => ({ sp: m.sp, shiny: !!m.shiny, path: collabPath(m.sp), name: m.name || (SPECIES_BY_ID[m.sp] ? SPECIES_BY_ID[m.sp].name : 'Pokémon') })) };
  }
  async function syncWidget(force) {
    const token = Game.state.player.widgetToken;
    if (!db || !me() || !st.profile || !token) return;
    const c = widgetCard(); if (!c) return;
    const sig = JSON.stringify(c); if (!force && sig === lastWidget) return;
    lastWidget = sig;
    await db.collection('widgets').doc(token).set({ ...c, updated: Date.now() });
  }
  async function uploadSave(force) {
    if (!db || !me() || !st.profile || !cloudChecked || st.conflict || pulling) return;
    const data = Game.exportSave();
    if (!force && data === lastSynced) return;
    lastSynced = data;
    const rev = Date.now();
    await db.collection('saves').doc(me()).set({ data, updatedAt: now(), adminRev: appliedRev(), rev, device: DEVICE });
    setLastRev(rev);
    await db.collection('users').doc(me()).update({ showcase: Game.showcase() });
    await syncWidget().catch(() => {});
  }

  // ---------------- live lists ----------------
  function listen() {
    const uid = me();
    const map = q => q.docs.map(d => ({ id: d.id, ...d.data() }));
    // removed by an admin while playing: act on it straight away
    unsub.push(db.collection('removed').doc(uid).onSnapshot(d => { if (d.exists && st.user) accountRemoved(st.user, d.data()); }, () => {}));
    unsub.push(db.collection('friendRequests').where('to', '==', uid).onSnapshot(q => { st.incoming = map(q).filter(r => r.status === 'pending'); emit(); }, err));
    unsub.push(db.collection('friendRequests').where('from', '==', uid).onSnapshot(q => { st.outgoing = map(q).filter(r => r.status === 'pending'); emit(); }, err));
    unsub.push(db.collection('friendships').where('members', 'array-contains', uid).onSnapshot(async q => {
      const list = map(q);
      st.friends = await Promise.all(list.map(async f => {
        const other = f.members.find(m => m !== uid);
        const p = await db.collection('users').doc(other).get().catch(() => null);
        return { id: f.id, uid: other, ...(p && p.exists ? p.data() : { username: (f.names || {})[other] || '?' }) };
      }));
      emit();
    }, err));
    unsub.push(db.collection('trades').where('members', 'array-contains', uid).onSnapshot(q => { st.trades = map(q); emit(); processTrades(); }, err));
    unsub.push(db.collection('saves').doc(uid).onSnapshot(d => {
      const v = d.exists && d.data();
      if (v && v.data && (v.adminRev || 0) > appliedRev()) applyAdminSave(v);
    }, () => {}));
    unsub.push(db.collection('battles').where('to', '==', uid).onSnapshot(q => { st.battles = map(q).filter(b => !b.seen); emit(); }, err));
  }
  function err(e) { st.error = friendly(e); emit(); }

  // ---------------- friends ----------------
  async function findUser(name) {
    name = String(name || '').trim().toLowerCase();
    if (!name) return null;
    const n = await db.collection('usernames').doc(name).get();
    if (!n.exists) return null;
    const p = await db.collection('users').doc(n.data().uid).get();
    return p.exists ? { uid: n.data().uid, ...p.data() } : null;
  }
  const pairId = (a, b) => [a, b].sort().join('_');
  async function addFriend(user) {
    const uid = me();
    if (user.uid === uid) throw new Error("That's you!");
    if (st.friends.some(f => f.uid === user.uid)) throw new Error('You are already friends.');
    if (st.outgoing.some(r => r.to === user.uid)) throw new Error('Request already sent.');
    const back = st.incoming.find(r => r.from === user.uid);
    if (back) return respond(back, true);
    await db.collection('friendRequests').add({ from: uid, fromName: st.profile.username, fromCode: st.profile.code, to: user.uid, toName: user.username, status: 'pending', createdAt: now() });
  }
  async function respond(req, accept) {
    await db.collection('friendRequests').doc(req.id).update({ status: accept ? 'accepted' : 'declined' });
    if (accept) {
      await db.collection('friendships').doc(pairId(req.from, req.to)).set({
        members: [req.from, req.to], names: { [req.from]: req.fromName, [req.to]: req.toName || st.profile.username }, requestId: req.id, since: now(),
      });
    }
  }
  async function cancelRequest(req) { await db.collection('friendRequests').doc(req.id).delete(); }
  async function removeFriend(f) { await db.collection('friendships').doc(f.id).delete(); }

  // ---------------- trades ----------------
  // offered -> (friend picks theirs) countered -> (offerer confirms) accepted -> both swap -> done
  async function offerTrade(friend, key) {
    const f = Game.findPet(key);
    if (!f || f.where === 'main') throw new Error('You can only trade Pokémon that are not your main.');
    if (f.pet.locked) throw new Error('That Pokémon is already in another trade.');
    const ref = db.collection('trades').doc();
    Game.lockPet(key, ref.id);
    await ref.set({
      members: [me(), friend.uid], from: me(), to: friend.uid, fromName: st.profile.username, fromCode: st.profile.code, toName: friend.username, toCode: friend.code || '',
      offer: Game.snapshot(f.pet), offerKey: key, status: 'offered', createdAt: now(),
    }).catch(e => { Game.unlockTrade(ref.id); throw e; });
    uploadSave(true);
  }
  async function counterTrade(trade, key) {
    const f = Game.findPet(key);
    if (!f || f.where === 'main') throw new Error('Pick a Pokémon that is not your main.');
    if (f.pet.locked) throw new Error('That Pokémon is already in another trade.');
    Game.lockPet(key, trade.id);
    await db.collection('trades').doc(trade.id).update({ counter: Game.snapshot(f.pet), counterKey: key, status: 'countered' })
      .catch(e => { Game.unlockTrade(trade.id); throw e; });
    uploadSave(true);
  }
  async function confirmTrade(trade) { await db.collection('trades').doc(trade.id).update({ status: 'accepted' }); }
  async function declineTrade(trade) { await db.collection('trades').doc(trade.id).update({ status: trade.from === me() ? 'cancelled' : 'declined' }); }
  const applied = new Set();
  async function processTrades() {
    const uid = me();
    for (const t of st.trades) {
      if (['declined', 'cancelled'].includes(t.status)) { if (Game.unlockTrade(t.id)) uploadSave(true); continue; }
      if (t.status !== 'accepted' || applied.has(t.id)) continue;
      const mine = t.from === uid ? 'fromDone' : 'toDone';
      if (t[mine]) continue;
      applied.add(t.id);
      const giveKey = t.from === uid ? t.offerKey : t.counterKey;
      const getPet = t.from === uid ? t.counter : t.offer;
      const fromTrainer = t.from === uid ? { name: t.toName, code: t.toCode || '' } : { name: t.fromName, code: t.fromCode || '' };
      const ok = Game.completeTrade(giveKey, getPet, fromTrainer);
      const other = t.from === uid ? 'toDone' : 'fromDone';
      await db.collection('trades').doc(t.id).update({ [mine]: ok || 'missing', ...(t[other] ? { status: 'done' } : {}) }).catch(() => {});
      await uploadSave(true);
      subs.forEach(f => { try { f(st, { traded: t, received: getPet, ok }); } catch (e) {} });
    }
  }

  // ---------------- battles ----------------
  async function friendTeam(friend) {
    const p = await db.collection('users').doc(friend.uid).get();
    return p.exists ? p.data().showcase : null;
  }
  async function recordBattle(friend, won, myCard, theirCard) {
    await db.collection('battles').add({ members: [me(), friend.uid], from: me(), fromName: st.profile.username, to: friend.uid, toName: friend.username,
      winner: won ? me() : friend.uid, fromMon: myCard, toMon: theirCard, seen: false, createdAt: now() });
  }
  async function markBattlesSeen() {
    const list = st.battles.slice(); st.battles = []; emit();
    await Promise.all(list.map(b => db.collection('battles').doc(b.id).update({ seen: true }).catch(() => {})));
    return list;
  }

  /** things waiting for you (for the badge) */
  function pending() {
    const uid = me();
    const tradeActs = st.trades.filter(t => (t.status === 'offered' && t.to === uid) || (t.status === 'countered' && t.from === uid)).length;
    return st.incoming.length + tradeActs + st.battles.length;
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) uploadSave(false).catch(() => {}); });
  return {
    get state() { return st; }, on: f => subs.push(f), init, signIn, signOut, createProfile, usernameFree, NAME_RE,
    resolveConflict, uploadSave, syncWidget, findUser, addFriend, respond, cancelRequest, removeFriend,
    offerTrade, counterTrade, confirmTrade, declineTrade, friendTeam, recordBattle, markBattlesSeen, pending, redeemCode, backgroundImage, clearRemovedMsg,
  };
})();
