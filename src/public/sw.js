/**
 * Service Worker — AIRPET PWA
 *
 * Versao do cache — altere para forcar atualizacao em todos os clientes.
 *
 * Estrategias:
 *  - INSTALL: pre-cacheia shell da aplicacao (assets criticos)
 *  - ACTIVATE: limpa caches antigos
 *  - FETCH:
 *      Assets estaticos → Cache-First (rapido, atualiza em background)
 *      Navegacao (HTML)  → Network-First com fallback offline.html
 *      API / POST        → Network-Only (nunca cacheia)
 *  - PUSH: exibe notificacao nativa quando recebe push do servidor
 *  - NOTIFICATIONCLICK: abre a URL da notificacao ao clicar
 */

const CACHE_VERSION = 'airpet-v5';

const SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/css/output.css',
  '/css/theme-override.css',
  '/js/app.js',
  '/js/pwa.js',
  '/js/permissions.js',
  '/manifest.json',
  '/images/icons/icon-192.png',
  '/images/icons/icon-512.png',
];

// ========================
// INSTALL
// ========================
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// ========================
// ACTIVATE
// ========================
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_VERSION; }).map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// ========================
// FETCH
// ========================
self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  // Ignora requests que nao sao HTTP/HTTPS
  if (!url.protocol.startsWith('http')) return;

  // Ignora POST, PUT, DELETE — nunca cacheia
  if (req.method !== 'GET') return;

  // Ignora requests para APIs externas (Nominatim, etc)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req).catch(function () { return caches.match(req); }));
    return;
  }

  // Nunca intercepta/cacheia área administrativa.
  // Isso evita comportamento inconsistente em páginas sensíveis do painel.
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/petshops') ||
    url.pathname.startsWith('/petshop-panel') ||
    url.pathname.startsWith('/_painel_') ||
    url.pathname.indexOf('/_painel_') !== -1
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // Assets estaticos: Cache-First
  if (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff')
  ) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var fetchPromise = fetch(req).then(function (response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
          }
          return response;
        }).catch(function () { return cached; });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Navegacao HTML: Network-First com fallback offline
  if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(req).then(function (response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
        }
        return response;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  // Demais requests: Network-First com cache fallback
  event.respondWith(
    fetch(req).then(function (response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
      }
      return response;
    }).catch(function () {
      return caches.match(req);
    })
  );
});

// ========================
// PUSH NOTIFICATIONS
// ========================
self.addEventListener('push', function (event) {
  var data = { titulo: 'AIRPET', corpo: 'Você tem uma nova notificação', url: '/notificacoes', icone: '/images/icons/icon-192.png' };

  if (event.data) {
    try {
      var parsed = event.data.json();
      data.titulo = parsed.titulo || parsed.title || data.titulo;
      data.corpo = parsed.corpo || parsed.body || data.corpo;
      data.url = parsed.url || parsed.link || data.url;
      data.icone = parsed.icone || parsed.icon || data.icone;
      data.tag = parsed.tag || parsed.tipo || 'airpet-notif';
    } catch (e) {
      data.corpo = event.data.text() || data.corpo;
    }
  }

  var options = {
    body: data.corpo,
    icon: data.icone,
    badge: '/images/icons/icon-192.png',
    tag: data.tag || 'airpet-notif',
    renotify: true,
    requireInteraction: false,
    data: { url: data.url },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Fechar' }
    ],
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.titulo, options)
  );
});

// ========================
// NOTIFICATION CLICK
// ========================
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var url = '/notificacoes';
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1 && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
