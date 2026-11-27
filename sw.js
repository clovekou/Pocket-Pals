// Offline cache for Pocket Pal
const CACHE = 'pocketpal-v116';
const FILES = ['./', './index.html', './style.css', './assets/fonts/Jersey15-Regular.ttf', './items.js', './evodata.js', './evolution.js', './pixelart.js', './backgrounds.js', './sprites.js', './species.js', './creatures.js', './maps.js', './battle-data.js', './battle.js', './game.js', './version.js', './patchnotes.js', './online-config.js', './online.js', './talk.js', './ui.js', './icon.svg', './assets/egg.png', ...['oran','rareCandy','pearl','starPiece','nugget','pokeball','greatball','ultraball','masterball','pecha','aspear','cheri','chest','map','coin','shop','cart'].map(n => './assets/ui/' + n + '.png'), './manifest.webmanifest'];
// install: fetch every file fresh (skipping the browser's HTTP cache), so a new version never mixes in old files
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))); });
// a new version waits until the player taps "Refresh" on the update bar (ui.js), so it never swaps mid-game
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== MEDIA).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Pictures, fonts, Pokémon sprites and the Firebase library hardly ever change, so they come straight
// from the cache (fetched once, then instant). They live in their own cache so updates don't re-download them.
// If you redraw pictures (icons, backgrounds), bump MEDIA's version so phones fetch the new ones.
const MEDIA = 'pocketpal-media-v4';
const isMedia = url => /\.(png|jpe?g|webp|gif|svg|ttf|woff2?)$/i.test(url.pathname)
  || url.hostname === 'raw.githubusercontent.com' || url.hostname === 'www.gstatic.com'
  || url.hostname === 'fonts.gstatic.com';

// The game's own code (HTML, JS, CSS) comes straight from this version's cache, so the game opens instantly
// even on a slow connection. Updates still arrive: every release changes CACHE above, the browser notices the new
// sw.js, installs the new files in the background, and the game reloads once onto them (ui.js, controllerchange).
function codeFirst(e, req) {
  return caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) c.put(e.request, r.clone());
    return r;
  })));
}
function cacheFirst(e) {
  return caches.open(MEDIA).then(c => caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());
    return r;
  })));
}
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  if (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') return;   // Firebase data: always live
  if (isMedia(url)) { e.respondWith(cacheFirst(e).catch(() => caches.match(e.request))); return; }
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && /\/(admin|dashboard)\.html$/.test(url.pathname)) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
  const req = sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(codeFirst(e, req).catch(() => fetch(e.request)));
});
