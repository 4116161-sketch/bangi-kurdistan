// Service Worker - بانگی کوردستان
const CACHE_NAME = 'bangi-v6';
const ASSETS = ['/', '/index.html', '/azan.mp3', '/manifest.json', '/icon-192.png', '/icon-512.png'];

// Install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

// Prayer times data
let prayerTimes = [];
let cityName = '';
let azanScheduled = [];

// Message from main app
self.addEventListener('message', e => {
  if(e.data.type === 'PRAYER_TIMES'){
    prayerTimes = e.data.times || [];
    cityName = e.data.city || '';
    schedulePrayerAlarms();
  }
  if(e.data.type === 'KEEPALIVE'){
    // SW زیندوو بمێنێت
  }
  if(e.data.type === 'PLAY_AZAN'){
    playAzanNotification(e.data.prayerName);
  }
});

// Schedule prayer notifications
function schedulePrayerAlarms(){
  // پاککردنەوەی timeout ی کۆن
  azanScheduled.forEach(id => clearTimeout(id));
  azanScheduled = [];

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  prayerTimes.forEach(prayer => {
    if(prayer.name === 'گزنگ') return; // Sunrise — بانگ نادرێت
    const pMin = prayer.h * 60 + prayer.m;
    let diff = (pMin - nowMin) * 60 * 1000 - now.getSeconds() * 1000;
    if(diff < 0) diff += 24 * 60 * 60 * 1000; // بۆ سبەی
    if(diff < 24 * 60 * 60 * 1000){
      const id = setTimeout(() => {
        playAzanNotification(prayer.name);
      }, diff);
      azanScheduled.push(id);
    }
  });
}

// Play azan via notification
function playAzanNotification(prayerName){
  // ئاگادارکردنەوە بنێرە
  self.registration.showNotification('🕌 کاتی بانگی ' + prayerName, {
    body: 'دەنگی بانگ گوێ بگرە',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'azan-' + prayerName,
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [500, 200, 500, 200, 500]
  });

  // بانگ بدە لە هەموو clientsەکان
  self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'TRIGGER_AZAN',
        prayerName: prayerName
      });
    });
  });
}

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({type: 'window'}).then(clients => {
      if(clients.length > 0){
        clients[0].focus();
        clients[0].postMessage({type: 'TRIGGER_AZAN', prayerName: e.notification.tag});
      } else {
        self.clients.openWindow('/');
      }
    })
  );
});
