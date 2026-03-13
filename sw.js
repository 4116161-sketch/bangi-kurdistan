// Service Worker - کاتەکانی بانگ v5
const CACHE = 'bangi-v5';
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

// ── پێگری ئاگادارکردنەوە ──
self.prayerTimes = null;
self.cityName = '';
self.lastNotified = -1;

function checkPrayerTimes(){
  if(!self.prayerTimes) return;
  const now = new Date();
  const curMin = now.getHours()*60 + now.getMinutes();

  self.prayerTimes.forEach(pt => {
    const pMin = pt.h*60 + pt.m;
    if(curMin === pMin && self.lastNotified !== pMin){
      self.lastNotified = pMin;
      self.registration.showNotification('🕌 کاتی بانگ — ' + pt.name, {
        body: 'ئێستا کاتی بانگی ' + pt.name + 'ە  ⏰ ' + pt.timeStr,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'prayer-' + pMin,
        vibrate: [500,200,500,200,500,200,500,200,1000],
        requireInteraction: true,
        silent: false,
        data: { url: './' }
      });
    }
  });
}

// هەر ٣٠ چرکەیەک پشکنین — بەردەوام کار دەکات
self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'PRAYER_TIMES'){
    self.prayerTimes = e.data.times;
    self.cityName = e.data.city || '';
    self.lastNotified = self.lastNotified || -1;

    // پاککردنەوەی interval ی کۆن
    if(self.prayerInterval){ clearInterval(self.prayerInterval); self.prayerInterval = null; }

    // هەر ٣٠ چرکەیەک — بە waitUntil تا SW نەمرێت
    self.prayerInterval = setInterval(()=>{
      // e.waitUntil نییە ئێرە — بەڵام periodic background sync بەکاردەهێنین
      checkPrayerTimes();
    }, 30000);
    
    // یەکەم پشکنین ئێستا
    checkPrayerTimes();
  }

  // ئاگادارکردنەوەی فەوری
  if(e.data.type === 'PRAYER_NOTIFICATION'){
    self.registration.showNotification(e.data.title || '🕌 کاتی بانگ', {
      body: e.data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'prayer',
      vibrate: [500,200,500,200,500,200,500,200,1000],
      requireInteraction: true,
      silent: false,
      data: { url: './' }
    });
  }

  // KEEPALIVE — ئەپ هەر ٢٠ چرکەیەک پەیام دەنێرێت تا SW زیندوو بمێنێت
  if(e.data.type === 'KEEPALIVE'){
    checkPrayerTimes();
  }
});

// Periodic Background Sync — بۆ براوزەرە پشتگیریکارەکان
self.addEventListener('periodicsync', e => {
  if(e.tag === 'prayer-check'){
    e.waitUntil(checkPrayerTimes());
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
