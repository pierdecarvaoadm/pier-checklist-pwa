const CACHE_VERSION = 'pier-checklist-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './offline.html'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html'))));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response && response.status === 200) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    })));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'NETWORK_RESTORED') {
    self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      clients.forEach(client => client.postMessage({type: 'SYNC_REQUESTED'}));
    });
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'pier-sync-pending') {
    event.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(clients => {
      clients.forEach(client => client.postMessage({type: 'SYNC_REQUESTED'}));
    }));
  }
});
