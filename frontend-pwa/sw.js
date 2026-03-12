const CACHE_NAME = 'campuscopy-v3';
const ASSETS = ['/app.html', '/app.js', '/manifest.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  // Don't cache root — let index.html redirect work
  if (new URL(e.request.url).pathname === '/') return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
self.addEventListener('push', (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: 'CampusCopy', body: e.data.text() }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'CampusCopy', {
      body:    data.body || 'Your print job has been updated.',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/app.html' },
      actions: [{ action: 'view', title: '👁 View Status' }, { action: 'dismiss', title: 'Dismiss' }],
    })
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/app.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if (w.url.includes('campuscopy') && 'focus' in w) {
          w.focus(); w.postMessage({ type: 'NAVIGATE', url }); return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
