// Service Worker: chạy offline + nhắc nền (periodic sync) + xử lý bấm thông báo.
const VERSION = 'v1.0.0';
const CORE = `thaptrai-core-${VERSION}`;
const RUNTIME = 'thaptrai-runtime';
const SCHEDULE = 'thaptrai-schedule';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/lunar.js',
  './js/fasting.js',
  './js/events.js',
  './js/store.js',
  './js/notify.js',
  './js/ui.js',
  './js/views/today.js',
  './js/views/calendar.js',
  './js/views/events.js',
  './js/views/settings.js',
  './assets/buddha.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('thaptrai-core-') && k !== CORE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Font Google: cache-first để chạy offline
  if (url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Tài nguyên app: mạng trước, rơi về cache khi offline
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CORE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

// Periodic Background Sync (Chrome Android, khi PWA đã cài): hiện các nhắc đến hạn
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'thaptrai-check') e.waitUntil(checkDue());
});

async function checkDue() {
  const cache = await caches.open(SCHEDULE);
  const res = await cache.match('schedule.json');
  if (!res) return;
  const list = await res.json();
  const shownRes = await cache.match('shown.json');
  const shown = shownRes ? await shownRes.json() : {};
  const now = Date.now();
  for (const n of list) {
    if (n.fireAt <= now && now - n.fireAt < 6 * 3600 * 1000 && !shown[n.id]) {
      await self.registration.showNotification(n.title, {
        body: n.body,
        tag: n.id,
        icon: 'icons/icon-192.png',
        data: { target: n.target },
        actions: n.fasting ? [{ action: 'done', title: 'Đã ăn chay' }] : [],
      });
      shown[n.id] = now;
    }
  }
  await cache.put('shown.json', new Response(JSON.stringify(shown)));
}

// R9: bấm "Đã ăn chay" ngay trên thông báo → mở app và ghi nhận
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = e.notification.data && e.notification.data.target;
  const url = e.action === 'done' && target ? `./?done=${target}#/hom-nay` : './#/hom-nay';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (e.action === 'done' && target) w.postMessage({ type: 'mark-done', target });
        return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
