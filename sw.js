// FORGE service worker
// Bump CACHE_VERSION on every deploy. The activate handler deletes every
// cache that doesn't match, which is what forces a clean slate.
const CACHE_VERSION = 'v17';
const CACHE_NAME = 'forge-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/figures.css',
  './js/config.js',
  './js/data.js',
  './js/figures.js',
  './js/moves.js',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './favicon-32.png'
];

// App code must be fresh when the network is up. Everything else (images,
// fonts, CDN icons) can come straight from cache.
function isAppCode(url) {
  return url.origin === self.location.origin &&
         /\.(html|js|css|json)$/.test(url.pathname);
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const navigating = e.request.mode === 'navigate';

  if (navigating || isAppCode(url)) {
    // NETWORK FIRST. Online, you always get the deployed version. Offline,
    // you fall back to the last copy that worked. No more one-load lag.
    // cache:'no-store' bypasses the BROWSER's HTTP cache, not just this
    // worker's. GitHub Pages sends max-age=600 on assets, so without it the
    // browser serves a ten-minute-old copy before the network is consulted
    // and a deploy appears to do nothing.
    const fresh = new Request(e.request.url, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    e.respondWith(
      fetch(fresh)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(e.request).then(cached =>
            cached || caches.match('./index.html')
          )
        )
    );
    return;
  }

  // CACHE FIRST for static assets, refreshed quietly in the background.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Lets the page force an update without a reinstall: FORGE can post
// {type:'SKIP_WAITING'} to take the new worker immediately.
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
