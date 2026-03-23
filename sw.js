[23/03/2026 08:11] Haidar Salih: // بانگی کوردستان — Service Worker v4 (Offline First)
// ── ڕێگای ڕاستی GitHub Pages ──
const CACHE = 'bangi-v4';
const BASE = '/bangi-kurdistan/';

// فایلەکانی سەرەکی بۆ کاشکردن
const CORE_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'azan.mp3',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  // فۆنتەکان
  'https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;900&family=Scheherazade+New:wght@400;700&display=swap',
];

// ── دامەزراندن — فایلە سەرەکییەکان کاش بکە ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        // یەک یەک بار بکە — ئەگەر یەکێک شکست هێنا بەقیانەکان بماننەوە
        return Promise.allSettled(
          CORE_ASSETS.map(url => cache.add(url).catch(()=>{}))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── چالاکبوون — کاشی کۆن بسڕەوە ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch — Cache First بۆ ئەپ، Network First بۆ API ──
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API کاڵەکان — Network First + کاش بۆ ئۆفلاین
  if(
    url.includes('aladhan.com') ||
    url.includes('open-meteo.com') ||
    url.includes('openweathermap.org') ||
    url.includes('alquran.cloud')
  ){
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          const fresh = fetch(e.request)
            .then(res => {
              if(res && res.ok) cache.put(e.request, res.clone());
              return res;
            })
            .catch(() => cached);
          // ئەگەر کاشی هەیە — ڕاستەوخۆ وەری بگرە، لە پاشەوە نوێ بکەرەوە
          return cached || fresh;
        })
      )
    );
    return;
  }

  // فایلە سەرەکییەکانی ئەپ — Cache First
  if(
    url.includes('bangi-kurdistan') ||
    url.includes('fonts.googleapis.com') ||
    url.includes('fonts.gstatic.com') ||
    url.includes('cdnjs.cloudflare.com')
  ){
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res && res.ok){
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => {
          // ئۆفلاین — index.html بگەڕێنەوە
          if(e.request.mode === 'navigate'){
            return caches.match(BASE + 'index.html') ||
                   caches.match(BASE);
          }
        });
      })
    );
    return;
  }

  // هەموو شتی تر — Network بە کاشی فاڵباک
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res && res.ok && e.request.method === 'GET'){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── پەیامەکان لە index.html ──
let prayerTimes = [];
let azanScheduled = [];

self.addEventListener('message', e => {
  if(!e.data) return;

  if(e.data.type === 'PRAYER_TIMES'){
    prayerTimes = e.data.times || [];
    // کاش بکە بۆ ئۆفلاین
    caches.open(CACHE).then(c => {
      const r = new Response(JSON.stringify(prayerTimes), {
        headers: {'Content-Type': 'application/json'}
      });
      c.put('prayer-times-offline', r);
    });
    schedulePrayerAlarms();
  }

  if(e.data.type === 'PRAYER_NOTIFICATION'){
    self.registration.showNotification(e.data.title || '🕌 کاتی بانگ', {
      body: e.data.body || '',
      icon: 'https://4116161-sketch.github.io/bangi-kurdistan/icon-192.png',
[23/03/2026 08:11] Haidar Salih: badge: 'https://4116161-sketch.github.io/bangi-kurdistan/icon-192.png',
      tag: 'prayer-azan',
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [400,150,400,150,800],
      data: { url: 'https://4116161-sketch.github.io/bangi-kurdistan/' }
    });
  }

  if(e.data.type === 'WIDGET_NOTIF'){
    self.registration.showNotification(e.data.title || '🕌 کاتەکانی بانگ', {
      body: e.data.body || '',
      icon: 'https://4116161-sketch.github.io/bangi-kurdistan/icon-192.png',
      badge: 'https://4116161-sketch.github.io/bangi-kurdistan/icon-192.png',
      tag: 'prayer-widget',
      silent: true,
      renotify: false,
      data: { url: 'https://4116161-sketch.github.io/bangi-kurdistan/' }
    });
  }

  if(e.data.type === 'KEEPALIVE'){}
});

// ── باڵاندنی بانگ ──
function schedulePrayerAlarms(){
  azanScheduled.forEach(id => clearTimeout(id));
  azanScheduled = [];
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  prayerTimes.forEach(prayer => {
    if(!prayer || prayer.name === 'گزنگ') return;
    const pMin = (prayer.h0) * 60 + (prayer.m0);
    let diff = (pMin - nowMin) * 60000 - now.getSeconds() * 1000;
    if(diff < 0) diff += 86400000;
    if(diff < 86400000){
      const id = setTimeout(() => {
        self.registration.showNotification('🕌 کاتی بانگی ' + (prayer.name||'نوێژ'), {
          body: 'دەنگی بانگ گوێ بگرە',
          icon: 'https://4116161-sketch.github.io/bangi-kurdistan/icon-192.png',
          tag: 'azan-' + (prayer.name||''),
          renotify: true, requireInteraction: true, silent: false,
          vibrate: [500,200,500,200,500],
          data: { url: 'https://4116161-sketch.github.io/bangi-kurdistan/' }
        });
        self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs =>
          cs.forEach(c => c.postMessage({type:'TRIGGER_AZAN', prayerName: prayer.name}))
        );
      }, diff);
      azanScheduled.push(id);
    }
  });
}

// ── کلیک لەسەر نۆتیفیکەیشن ──
const APP_URL = 'https://4116161-sketch.github.io/bangi-kurdistan/';
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if(e.action === 'dismiss') return;
  const target = (e.notification.data && e.notification.data.url) ? e.notification.data.url : APP_URL;
  e.waitUntil(
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      for(const c of list){
        if(c.url.includes('bangi-kurdistan') && 'focus' in c){
          c.focus();
          c.postMessage({type:'TRIGGER_AZAN', prayerName: e.notification.tag});
          return;
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
