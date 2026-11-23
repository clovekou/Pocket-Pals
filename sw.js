// Offline cache for Pocket Pal
const CACHE = 'pocketpal-v78';
const FILES = ['./', './index.html', './style.css', './assets/fonts/Jersey15-Regular.ttf', './items.js', './evodata.js', './evolution.js', './pixelart.js', './backgrounds.js', './sprites.js', './species.js', './creatures.js', './game.js', './online-config.js', './online.js', './talk.js', './ui.js', './icon.svg', './assets/egg.png', ...['oran','rareCandy','pearl','starPiece','nugget','pokeball','greatball','ultraball','masterball','pecha','aspear','cheri','chest','map','coin','shop','cart'].map(n => './assets/ui/' + n + '.png'), './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
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

// The game's own code (HTML, JS, CSS) is checked with the server so updates show up straight away,
// but if the network is slow we don't wait more than 2.5 s: the cached copy is used and refreshed in the background.
function networkFirst(e, req) {
  const net = fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  });
  const slow = new Promise(res => setTimeout(res, 2500)).then(() => caches.match(e.request));
  return Promise.race([net.catch(() => caches.match(e.request)), slow.then(c => c || net)]).then(r => r || net);
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
  const req = sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(networkFirst(e, req));
});
