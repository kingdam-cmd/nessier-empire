/* NESSIER EMPIRE — service worker
   Makes the shop installable as an app and available offline.
   Strategy: network-first for the pages and the catalogue (so updates show
   quickly), cache-first for static assets (icons, fonts). */
const CACHE = 'nessier-v2';
const CORE = [
  '/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache Supabase (auth + live catalogue) — always go to the network.
  if (url.hostname.endsWith('supabase.co')) return;
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isProducts = url.pathname.endsWith('products.json');

  if (isHTML || isProducts) {
    // network-first: keep pages and catalogue fresh, fall back to cache offline
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(c => c || caches.match('/')))
    );
  } else {
    // cache-first: fast static assets
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(r => {
        const cp = r.clone(); caches.open(CACHE).then(ca => ca.put(req, cp)); return r;
      }))
    );
  }
});
