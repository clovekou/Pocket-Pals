// Offline cache for Pocket Pal
const CACHE = 'pocketpal-v26';
const FILES = ['./', './index.html', './style.css', './pixelart.js', './backgrounds.js', './sprites.js', './species.js', './creatures.js', './game.js', './online-config.js', './online.js', './talk.js', './ui.js', './icon.svg', './assets/egg.png', './manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
// Network first, always revalidating with the server (GitHub Pages lets browsers reuse files
// for 10 minutes, which kept showing old versions after an update). Cache only when offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const sameOrigin = url.origin === self.location.origin;
  const req = sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
