/**
 * pwa.js — Service Worker registration + Install prompt + Push subscription
 */

(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var swRegistration = null;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      console.log('[PWA] SW registrado:', reg.scope);
      swRegistration = reg;

      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              if (confirm('Nova versao do AIRPET disponivel! Deseja atualizar?')) {
                window.location.reload();
              }
            }
          });
        }
      });

      subscribePush(reg);
    }).catch(function (err) {
      console.warn('[PWA] Erro SW:', err);
    });
  });

  function subscribePush(reg) {
    var isLogado = document.body && document.body.getAttribute('data-logado') === 'true';
    if (!isLogado) return;

    if (!('PushManager' in window)) {
      console.warn('[PWA] Push não suportado neste navegador');
      return;
    }

    var vapidKey = document.body.getAttribute('data-vapid-key');
    if (!vapidKey) {
      console.warn('[PWA] VAPID key não encontrada');
      return;
    }

    reg.pushManager.getSubscription().then(function (existingSub) {
      if (existingSub) {
        sendSubscriptionToServer(existingSub);
        return;
      }

      if (Notification.permission === 'granted') {
        doSubscribe(reg, vapidKey);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(function (permission) {
          if (permission === 'granted') {
            doSubscribe(reg, vapidKey);
          }
        });
      }
    }).catch(function (err) {
      console.warn('[PWA] Erro ao verificar subscription:', err);
    });
  }

  function doSubscribe(reg, vapidKey) {
    var applicationServerKey = urlBase64ToUint8Array(vapidKey);

    reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    }).then(function (subscription) {
      console.log('[PWA] Push subscription criada');
      sendSubscriptionToServer(subscription);
    }).catch(function (err) {
      console.warn('[PWA] Erro ao criar push subscription:', err);
    });
  }

  function sendSubscriptionToServer(subscription) {
    fetch('/notificacoes/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ subscription: subscription.toJSON() })
    }).then(function (res) {
      if (res.ok) console.log('[PWA] Subscription enviada ao servidor');
    }).catch(function (err) {
      console.warn('[PWA] Erro ao enviar subscription:', err);
    });
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /* Install prompt banner */
  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:9999;background:#1f2937;color:#fff;border-radius:16px;padding:16px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:420px;margin:0 auto;animation:slideUp 0.3s ease-out;';

    banner.innerHTML =
      '<div style="flex-shrink:0;width:44px;height:44px;border-radius:12px;background:#ec5a1c;display:flex;align-items:center;justify-content:center">' +
        '<i class="fa-solid fa-paw" style="color:#fff;font-size:20px;"></i>' +
      '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<p style="font-weight:700;font-size:14px;margin:0">Instalar AIRPET</p>' +
        '<p style="font-size:12px;color:#9ca3af;margin:2px 0 0">Acesso rapido na tela inicial</p>' +
      '</div>' +
      '<button id="pwa-install-btn" style="flex-shrink:0;background:#ec5a1c;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer">Instalar</button>' +
      '<button id="pwa-dismiss-btn" style="flex-shrink:0;background:none;border:none;color:#6b7280;cursor:pointer;padding:4px;font-size:18px">&times;</button>';

    var style = document.createElement('style');
    style.textContent = '@keyframes slideUp{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () { deferredPrompt = null; banner.remove(); });
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', function () {
      banner.remove();
    });
  }

  window.addEventListener('appinstalled', function () {
    console.log('[PWA] App instalado!');
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    deferredPrompt = null;
  });

  window.airpetPush = {
    subscribe: function () {
      if (swRegistration) subscribePush(swRegistration);
    },
    getRegistration: function () {
      return swRegistration;
    }
  };
})();
