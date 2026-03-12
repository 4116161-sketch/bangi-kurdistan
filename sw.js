// Service Worker - کاتەکانی بانگ v4
const CACHE = 'bangi-v4';
const FILES = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    ).then(()=> clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});

// ── پێگری ئاگادارکردنەوە لە ئەپ ──
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'PRAYER_TIMES'){
    // کاتەکانی بانگ لە SW ذەخیرە دەکرێن
    self.prayerTimes = e.data.times;
    self.cityName = e.data.city || '';

    // ئەگەر alarm interval هەیە پاکی بکەوە
    if(self.prayerInterval) clearInterval(self.prayerInterval);
    self.lastNotified = self.lastNotified || -1;

    // هەر ٣٠ چرکەیەک پشکنین
    self.prayerInterval = setInterval(()=>{
      if(!self.prayerTimes) return;
      const now = new Date();
      const curMin = now.getHours()*60 + now.getMinutes();
      const curSec = now.getSeconds();

      if(curSec > 30) return; // تەنها لە نیوەی یەکەمی خولەکە

      self.prayerTimes.forEach(pt => {
        const pMin = pt.h*60 + pt.m;
        if(curMin === pMin && self.lastNotified !== pMin){
          self.lastNotified = pMin;
          self.registration.showNotification('🕌 کاتی بانگ — ' + pt.name, {
            body: 'ئێستا کاتی بانگی ' + pt.name + 'ە  ⏰ ' + pt.timeStr,
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'prayer-' + pt.name,
            vibrate: [300,100,300,100,300],
            requireInteraction: true,
            silent: false,
            data: { url: './' }
          });
        }
      });
    }, 30000);
  }

  // ئاگادارکردنەوەی فەوری (کاتی کراوەبوونی ئەپ)
  if(e.data.type === 'PRAYER_NOTIFICATION'){
    self.registration.showNotification(e.data.title || '🕌 کاتی بانگ', {
      body: e.data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'prayer',
      vibrate: [300,100,300,100,300],
      requireInteraction: true,
      silent: false,
      data: { url: './' }
    });
  }
});

// کلیکی ئاگادارکردنەوە
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(cs => {
      for(const c of cs){
        if(c.url.includes('bangi') || c.url.includes('index')){
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
