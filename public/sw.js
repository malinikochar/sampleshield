// SampleShield Static-Shell Service Worker
// SECURITY CONTRACT: Caches ONLY immutable static assets (_next/static, icons, manifest).
// NEVER caches /api/*, /auth/*, Supabase endpoints, or authenticated HTML/RSC payloads.

const CACHE_NAME = 'sampleshield-static-v1';
const PRECACHE_ASSETS = ['/manifest.webmanifest', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isSafeStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/app/') ||
    url.searchParams.has('_rsc')
  ) {
    return false;
  }
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/icon-192.svg' ||
    url.pathname === '/icon-512.svg'
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!isSafeStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
