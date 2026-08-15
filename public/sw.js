// ---------------------------------------------------------------------------
// Service worker — makes The Rebuild installable and offline-capable.
//
// Strategy: a "stale-while-revalidate"-ish app shell cache. We precache the
// core files on install, serve cached responses first for speed/offline, and
// refresh the cache in the background. Because Vite fingerprints built assets
// (e.g. index-abc123.js), we cache them on first fetch (runtime caching).
//
// NOTE: When you later add real push notifications, wire up `push` and
// `notificationclick` handlers here — that's the upgrade path from the
// best-effort in-page reminders to true background push.
// ---------------------------------------------------------------------------

const CACHE = 'rebuild-shell-v2'
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg']

// Cache the web fonts at runtime so the display face survives offline.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  // Google Fonts (cross-origin): cache-first so the display font works offline.
  const url = new URL(request.url)
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        }).catch(() => cached),
      ),
    )
    return
  }

  // Network-first for navigations (so you get fresh HTML when online),
  // falling back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html')),
    )
    return
  }

  // Cache-first with background refresh for everything else.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
