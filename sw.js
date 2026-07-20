// Jaycy CRM V3 - Service Worker
const CACHE_NAME = 'jaycy-crm-v3-v1';
const STATIC_ASSETS = [
  '/jaycy-crm/',
  '/jaycy-crm/index.html',
  '/jaycy-crm/css/base.css',
  '/jaycy-crm/js/utils.js',
  '/jaycy-crm/js/supabase-client.js',
  '/jaycy-crm/js/store.js',
  '/jaycy-crm/js/templates.js',
  '/jaycy-crm/js/dashboard.js',
  '/jaycy-crm/js/wa-module.js',
  '/jaycy-crm/js/xl-module.js',
  '/jaycy-crm/js/ai-service.js',
  '/jaycy-crm/js/settings.js',
  '/jaycy-crm/js/notification.js',
  '/jaycy-crm/js/router.js',
  '/jaycy-crm/js/app.js',
  '/jaycy-crm/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 不缓存 Supabase API 请求
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // 缓存优先
      if (cached) {
        // 后台更新
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request);
    })
  );
});

// Push 通知
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'Jaycy CRM', body: '你有新的待办事项' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/jaycy-crm/icons/icon-192.png',
      badge: '/jaycy-crm/icons/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/jaycy-crm/')
  );
});
