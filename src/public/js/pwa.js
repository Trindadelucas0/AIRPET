/**
 * pwa.js — Service Worker registration + Install prompt + Push subscription
 */

(function () {
  'use strict';

  var swRegistration = null;

  if ('serviceWorker' in navigator) {
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
  } else {
    console.warn('[PWA] Service Worker indisponivel neste contexto');
  }

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
        var PS = window.airpetPermissionSheet;
        if (PS && typeof PS.tryAutoShow === 'function') {
          PS.tryAutoShow('notifications', { deferMs: 2000 }).then(function (res) {
            if (res && res.outcome === 'granted') {
              doSubscribe(reg, vapidKey);
            }
          });
        } else {
          Notification.requestPermission().then(function (permission) {
            if (permission === 'granted') {
              doSubscribe(reg, vapidKey);
            }
          });
        }
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
    var body = JSON.stringify({ subscription: subscription.toJSON() });
    var run = function () {
      return fetch('/notificacoes/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: body
      });
    };
    var L = window.AIRPET_LOADING;
    var p = L && typeof L.withDeferredOverlay === 'function'
      ? L.withDeferredOverlay(run, { message: 'A ativar notificações…' })
      : run();
    p.then(function (res) {
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

  /* Install prompt banner + manual install actions */
  var deferredPrompt = null;
  var suppressAutoInstallBanner = false;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!suppressAutoInstallBanner) showInstallBanner();
  });

  function isStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }

  function isSafariBrowser() {
    var ua = window.navigator.userAgent || '';
    var isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    return isSafari;
  }

  function getInstallStatusEl() {
    return document.querySelector('[data-install-status]');
  }

  function setInstallStatus(message) {
    var statusEl = getInstallStatusEl();
    if (statusEl) statusEl.textContent = message || '';
  }

  function hideInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
  }

  function showInstallHelpModal(title, description, steps) {
    var existingModal = document.getElementById('pwa-install-help-modal');
    if (existingModal) existingModal.remove();

    var listHtml = '';
    (steps || []).forEach(function (step) {
      listHtml += '<li>' + step + '</li>';
    });

    var modal = document.createElement('div');
    modal.id = 'pwa-install-help-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML =
      '<div style="max-width:420px;width:100%;background:#111827;color:#fff;border-radius:16px;padding:20px;border:1px solid rgba(255,255,255,0.08)">' +
        '<h3 style="margin:0 0 10px;font-size:18px;font-weight:700">' + title + '</h3>' +
        '<p style="margin:0 0 10px;color:#d1d5db;font-size:14px;line-height:1.5">' + description + '</p>' +
        '<ol style="margin:0 0 16px 18px;padding:0;color:#e5e7eb;font-size:14px;line-height:1.6">' + listHtml + '</ol>' +
        '<button id="pwa-install-help-close" style="width:100%;background:#ec5a1c;color:#fff;border:none;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer">Entendi</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('pwa-install-help-close').addEventListener('click', function () {
      modal.remove();
    });
  }

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    if (isStandaloneMode()) return;
    if (suppressAutoInstallBanner) return;

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
        suppressAutoInstallBanner = true;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          banner.remove();
        });
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', function () {
      banner.remove();
    });
  }

  window.addEventListener('appinstalled', function () {
    console.log('[PWA] App instalado!');
    hideInstallBanner();
    setInstallStatus('AIRPET instalado na tela inicial.');
    deferredPrompt = null;
  });

  function showIosInstructions() {
    suppressAutoInstallBanner = true;
    hideInstallBanner();

    if (isStandaloneMode()) {
      setInstallStatus('O AIRPET ja esta instalado na tela inicial.');
      return Promise.resolve('already-installed');
    }

    if (!isIOSDevice()) {
      setInstallStatus('Este passo e para iOS. Use o botao Android neste dispositivo.');
      showInstallHelpModal(
        'Instalacao iOS',
        'Este botao funciona apenas em iPhone/iPad.',
        ['Abra esta pagina no iPhone ou iPad.', 'No iPhone, toque em Compartilhar.', 'Depois toque em "Adicionar a Tela de Inicio".']
      );
      return Promise.resolve('wrong-platform');
    }

    if (!isSafariBrowser()) {
      setInstallStatus('No iOS, abra no Safari para adicionar a tela inicial.');
      showInstallHelpModal(
        'Abra no Safari',
        'No iOS, a instalacao so aparece no Safari.',
        ['Copie o link desta pagina.', 'Abra o Safari e cole o link.', 'Toque em Compartilhar e em "Adicionar a Tela de Inicio".']
      );
      return Promise.resolve('open-safari');
    }

    showInstallHelpModal(
      'Instalar no iOS',
      'No Safari, siga estes passos para adicionar na tela inicial:',
      ['Toque no botao Compartilhar.', 'Escolha "Adicionar a Tela de Inicio".', 'Confirme para instalar o AIRPET.']
    );

    setInstallStatus('Siga os passos no Safari para adicionar na tela inicial.');
    return Promise.resolve('ios-guided');
  }

  function installAndroid() {
    suppressAutoInstallBanner = true;
    hideInstallBanner();

    if (isStandaloneMode()) {
      setInstallStatus('O AIRPET ja esta instalado na tela inicial.');
      return Promise.resolve('already-installed');
    }

    if (!deferredPrompt) {
      setInstallStatus('Instalacao indisponivel agora. Abra no Chrome Android para instalar.');
      showInstallHelpModal(
        'Instalacao no Android',
        'Nao foi possivel abrir o popup automatico agora.',
        ['Use Chrome no Android.', 'Toque no menu do navegador.', 'Escolha "Instalar app" ou "Adicionar a tela inicial".']
      );
      return Promise.resolve('prompt-unavailable');
    }

    setInstallStatus('Abrindo instalacao...');
    deferredPrompt.prompt();
    return deferredPrompt.userChoice.then(function (choiceResult) {
      deferredPrompt = null;
      if (choiceResult && choiceResult.outcome === 'accepted') {
        setInstallStatus('Instalacao iniciada no Android.');
        return 'accepted';
      }
      setInstallStatus('Instalacao cancelada.');
      return 'dismissed';
    }).catch(function () {
      setInstallStatus('Nao foi possivel abrir a instalacao agora.');
      return 'error';
    });
  }

  function bindInstallButtons() {
    var buttons = document.querySelectorAll('[data-install-platform]');
    if (!buttons || !buttons.length) return;

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var platform = button.getAttribute('data-install-platform');
        if (platform === 'android') {
          installAndroid();
          return;
        }
        if (platform === 'ios') {
          showIosInstructions();
        }
      });
    });

    if (isStandaloneMode()) {
      setInstallStatus('O AIRPET ja esta instalado na tela inicial.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindInstallButtons);
  } else {
    bindInstallButtons();
  }

  window.airpetPush = {
    subscribe: function () {
      if (swRegistration) subscribePush(swRegistration);
    },
    getRegistration: function () {
      return swRegistration;
    }
  };

  window.airpetPwa = {
    installAndroid: installAndroid,
    showIosInstructions: showIosInstructions,
    hideInstallBanner: hideInstallBanner,
    isStandalone: isStandaloneMode
  };
})();
