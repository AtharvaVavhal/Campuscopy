// ─── CampusCopy Service Worker v4 ────────────────────────────
// Strategy:
//   App shell (HTML/CSS/JS/icons) → Cache First
//   API GET requests              → Network First, fallback to cache
//   API POST/PATCH                → Network only (never cache mutations)
//   Google Fonts                  → Cache First (long TTL)

const CACHE_SHELL   = 'campuscopy-shell-v4';
const CACHE_API     = 'campuscopy-api-v4';
const CACHE_FONTS   = 'campuscopy-fonts-v4';

const SHELL_ASSETS = [
  '/app.html',
  '/signup.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

const API_BASE = 'https://campuscopy-api.onrender.com';

// ─── Offline fallback responses ───────────────────────────────
const OFFLINE_JOB = JSON.stringify({
  error: 'offline',
  message: 'You are offline. Please check your connection.',
  offline: true,
});

const OFFLINE_JOBS_LIST = JSON.stringify({
  jobs: [],
  offline: true,
  message: 'Showing cached data. Connect to internet for latest status.',
});

// ─── Install ──────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  const VALID = [CACHE_SHELL, CACHE_API, CACHE_FONTS];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !VALID.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET entirely for mutations
  if (request.method !== 'GET') return;

  // Skip root redirect
  if (url.pathname === '/') return;

  // Google Fonts — Cache First
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // API calls — Network First with offline fallback
  if (request.url.startsWith(API_BASE)) {
    e.respondWith(networkFirstAPI(request));
    return;
  }

  // App shell — Cache First
  e.respondWith(cacheFirst(request, CACHE_SHELL));
});

// ─── Cache First ──────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/app.html');
      return fallback || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

// ─── Network First (API) ──────────────────────────────────────
async function networkFirstAPI(request) {
  const url = new URL(request.url);

  try {
    const response = await fetch(request);

    // Cache successful GET responses for offline use
    if (response.ok) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, response.clone());
    }
    return response;

  } catch {
    // Offline — try cache first
    const cached = await caches.match(request);
    if (cached) return cached;

    // Tailored offline responses
    if (url.pathname.includes('/api/jobs/by-phone/')) {
      return new Response(OFFLINE_JOBS_LIST, {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname.match(/\/api\/jobs\/[^/]+$/)) {
      return new Response(OFFLINE_JOB, {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─── Background Sync ─────────────────────────────────────────
// When connectivity is restored, notify open tabs so they can re-poll
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-job-status') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_ONLINE' }));
      })
    );
  }
});

// ─── Push Notifications ───────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'CampusCopy', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'CampusCopy', {
      body:    data.body    || 'Your print job has been updated.',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [200, 100, 200],
      tag:     data.jobId   || 'campuscopy-job',
      renotify: true,
      data:    { url: data.url || '/app.html' },
      actions: [
        { action: 'view',    title: '👁 View Status' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ─── Notification Click ───────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;

  const url = e.notification.data?.url || '/app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('campuscopy') && 'focus' in w) {
          w.focus();
          w.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── Message from app ─────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();

  // Register background sync when app detects connection restored
  if (e.data?.type === 'REGISTER_SYNC') {
    self.registration.sync?.register('sync-job-status').catch(() => {});
  }
});
