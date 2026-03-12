// Service Worker - کاتەکانی بانگ v3
const CACHE = 'bangi-v3';
const FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// پێگری ئاگادارکردنەوەی بانگ لە ئەپ
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'PRAYER_NOTIFICATION'){
    self.registration.showNotification(e.data.title || '🕌 کاتی بانگ', {
      body: e.data.body || '',
      icon: e.data.icon || './icon-192.png',
      badge: './icon-192.png',
      tag: 'prayer',
      vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      actions: [{ action: 'open', title: '📖 کراوەکردن' }]
    });
  }
});

// کلیکی ئاگادارکردنەوە — ئەپەکە دەکاتەوە
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window'}).then(cs => {
      if(cs.length) return cs[0].focus();
      return clients.openWindow('./');
    })
  );
});
