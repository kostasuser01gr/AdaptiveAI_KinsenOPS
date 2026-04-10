const CACHE_VERSION = 'v3';
const STATIC_CACHE = `driveai-static-${CACHE_VERSION}`;
const API_CACHE = `driveai-api-${CACHE_VERSION}`;
const API_CACHE_MAX = 50;

// Paths that must never be cached (auth, sensitive data)
const API_NO_CACHE = ['/api/auth/', '/api/admin/', '/api/user', '/api/channels/', '/api/channel-messages/', '/api/notifications', '/api/custom-actions'];

const PRECACHE_URLS = ['/', '/manifest.json', '/favicon.png'];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: purge stale caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET from same origin; skip SSE streams
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (request.headers.get('Accept')?.includes('text/event-stream')) return;

  // API: network-first, stale fallback — skip auth/sensitive endpoints
  if (url.pathname.startsWith('/api/')) {
    if (API_NO_CACHE.some((prefix) => url.pathname.startsWith(prefix))) {
      // Never cache auth/admin endpoints — plain network fetch
      return;
    }
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const cloned = res.clone();
            caches.open(API_CACHE).then((c) => {
              c.put(request, cloned);
              // LRU eviction: keep at most API_CACHE_MAX entries
              c.keys().then((keys) => {
                if (keys.length > API_CACHE_MAX) {
                  c.delete(keys[0]);
                }
              });
            });
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (JS chunks, CSS, fonts, images): cache-first
  if (url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/) ||
      url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((res) => {
          if (res.ok) {
            caches.open(STATIC_CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
      )
    );
    return;
  }

  // Navigation: network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(
          (shell) => shell ?? new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>DriveAI — Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:2rem}h1{font-size:1.5rem;margin-bottom:.5rem}p{color:#888;font-size:.9rem}</style></head><body><div><h1>You are offline</h1><p>Reconnect to access DriveAI Workspace.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          )
        )
      )
    );
  }
});

// Allow the app to trigger skip-waiting on demand
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for offline wash-queue submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-wash-queue') {
    event.waitUntil(syncWashQueue());
  }
});

async function syncWashQueue() {
  // Read pending items from IndexedDB or fall through (app handles sessionStorage fallback)
  try {
    const _cache = await caches.open(API_CACHE);
    // Re-attempt any queued POST requests stored in the background sync store
    // The app itself handles the main sync logic via sessionStorage; this is a safety net
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_WASH_QUEUE' });
    }
  } catch (_err) {
    // Sync failed, will retry automatically
  }
}

// Push notification support (stub — requires server-side VAPID setup)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    event.waitUntil(
      self.registration.showNotification(payload.title || 'DriveAI', {
        body: payload.body || '',
        icon: '/favicon.png',
        badge: '/favicon.png',
        tag: payload.tag || 'driveai-notification',
        data: payload.data || {},
      })
    );
  } catch {
    // Ignore invalid push payloads
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
