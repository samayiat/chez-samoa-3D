// Chez Samoa 3D — service worker
// Bump CACHE when you want clients to drop old cached assets.
const CACHE = 'chez-samoa-v1';

self.addEventListener('install', (event) => {
  // Activate this SW as soon as it finishes installing.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Runtime caching (stale-while-revalidate) for same-origin GET requests.
// This gives us an offline-capable app shell without knowing hashed filenames
// ahead of time, which is what makes the app installable.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => null);

      // Serve cached immediately if present, otherwise wait for network.
      const res = cached || (await network);
      if (res) return res;

      // Offline navigation fallback: serve the cached app shell.
      if (req.mode === 'navigate') {
        const shell = await cache.match('index.html');
        if (shell) return shell;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })()
  );
});
