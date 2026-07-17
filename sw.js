/* Service worker: офлайн-кэш для установленной PWA-версии.
   Стратегия «stale-while-revalidate»: страница мгновенно получает кэш,
   а свежая версия скачивается фоном и попадает в кэш для следующего
   запуска. Обновления подтягиваются сами — чистить кэш не нужно. */
'use strict';

const CACHE = 'ast-v2';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './css/style.css',
  './js/core/utils.js',
  './js/core/audio.js',
  './js/core/save.js',
  './js/data/names.js',
  './js/data/cars.js',
  './js/data/faults.js',
  './js/data/parts.js',
  './js/data/suppliers.js',
  './js/data/upgrades.js',
  './js/data/research.js',
  './js/data/events.js',
  './js/data/missions.js',
  './js/data/achievements.js',
  './js/game/state.js',
  './js/game/time.js',
  './js/game/economy.js',
  './js/game/inventory.js',
  './js/game/staff.js',
  './js/game/clients.js',
  './js/game/repair.js',
  './js/game/garage.js',
  './js/game/research.js',
  './js/game/missions.js',
  './js/game/achievements.js',
  './js/game/events.js',
  './js/game/contracts.js',
  './js/game/loop.js',
  './js/ui/modal.js',
  './js/ui/fx.js',
  './js/ui/charts.js',
  './js/ui/scene.js',
  './js/ui/panels-garage.js',
  './js/ui/panels-business.js',
  './js/ui/panels-meta.js',
  './js/ui/ui.js',
  './js/ui/tutorial.js',
  './js/main.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      // фоновая ревалидация: тянем свежую версию и обновляем кэш
      const fresh = fetch(e.request).then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) {
          cache.put(e.request, res.clone());
        }
        return res;
      }).catch(() => hit);
      // отдаём кэш мгновенно (офлайн работает), иначе — сеть
      return hit || fresh;
    })
  );
});
