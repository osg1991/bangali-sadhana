const CACHE_NAME = 'bengali-sadhana-v1.6.2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './learning/srs.css',
  './learning/track.css',
  './learning/curriculum.css',
  './content/base-content.js',
  './content/complete-script.js',
  './content/generated/ramprasad-content.js',
  './content/generated/curriculum-content.js',
  './learning/srs-engine.js',
  './learning/track-engine.js',
  './learning/curriculum-engine.js',
  './learning/srs-app.js',
  './app.js',
  './learning/track-ui.js',
  './learning/curriculum-app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();

    // Reload already-open tabs and installed PWA windows once so they stop
    // executing JavaScript supplied by the previous service worker.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(async client => {
      try {
        await client.navigate(client.url);
      } catch {
        // A client can disappear while an update activates; ignore it.
      }
    }));
  })());
});

async function cacheResponse(request, response) {
  if (!response || (response.status !== 200 && response.type !== 'opaque')) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    return await cacheResponse(request, await fetch(request));
  } catch {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isAppAsset = url.origin === self.location.origin;

  // App HTML, JavaScript, CSS and generated data must prefer the deployed
  // version while online. External audio/media remains cache-first.
  event.respondWith(isAppAsset ? networkFirst(event.request) : cacheFirst(event.request));
});
