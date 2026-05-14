/**
 * permissionSheet.js — Folhas de permissão JIT (localização, câmera, notificações)
 * Persistência por recurso + checkbox "Não mostrar novamente".
 */
(function () {
  'use strict';

  var LEGACY_KEY = 'airpet_permissions_done';
  var META_KEY = 'airpet_perm_meta_v1';
  var STORAGE_KEYS = {
    location: 'airpet_perm_location',
    camera: 'airpet_perm_camera',
    notifications: 'airpet_perm_notifications'
  };

  var COOLDOWN_MS = 72 * 60 * 60 * 1000;
  var MAX_AUTO_PROMPTS = 5;

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  var COPY = {
    location: {
      title: 'Ative sua localização',
      subtitle: 'Veja pets perto de você e ajude a encontrar animais perdidos.',
      bullets: [
        'Encontrar pets próximos',
        'Receber alertas importantes',
        'Ajudar outros tutores'
      ],
      icon: 'fa-location-dot',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-500',
      fallbackTitle: 'Ative a localização nas configurações',
      fallbackBody: 'Assim o mapa pode mostrar pets perto de você.'
    },
    camera: {
      title: 'Ative a câmera',
      subtitle: 'Tire fotos na hora ou escaneie tags para ajudar pets.',
      bullets: [
        'Fotografar avistamentos',
        'Enviar imagens mais rápido',
        'Ajudar tutores com clareza'
      ],
      icon: 'fa-camera',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-500',
      fallbackTitle: 'Ative a câmera nas configurações',
      fallbackBody: 'Assim pode tirar fotos direto pelo AIRPET.'
    },
    notifications: {
      title: 'Ative as notificações',
      subtitle: 'Receba alertas quando um pet precisar de ajuda perto de você.',
      bullets: [
        'Alertas de pet perdido',
        'Avisos importantes do AIRPET',
        'Menos coisas importantes perdidas'
      ],
      icon: 'fa-bell',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-500',
      fallbackTitle: 'Ative as notificações nas configurações',
      fallbackBody: 'Assim você não perde alertas urgentes.'
    }
  };

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(json) {
    try {
      return JSON.parse(json);
    } catch (_) {
      return null;
    }
  }

  function migrate() {
    try {
      if (localStorage.getItem(META_KEY) === '1') return;
      if (localStorage.getItem(LEGACY_KEY) === '3') {
        ['location', 'camera', 'notifications'].forEach(function (t) {
          setRecord(t, { ui: 'accepted', updatedAt: nowIso() });
        });
      }
      localStorage.setItem(META_KEY, '1');
    } catch (_) {}
  }

  function getRecord(type) {
    try {
      var raw = localStorage.getItem(STORAGE_KEYS[type]);
      if (!raw) return { ui: null, updatedAt: null, lastSoftDenialAt: null, autoPromptCount: 0 };
      var o = safeParse(raw);
      if (!o || typeof o !== 'object') return { ui: null, updatedAt: null, lastSoftDenialAt: null, autoPromptCount: 0 };
      return {
        ui: o.ui || null,
        updatedAt: o.updatedAt || null,
        lastSoftDenialAt: o.lastSoftDenialAt || null,
        autoPromptCount: typeof o.autoPromptCount === 'number' ? o.autoPromptCount : 0
      };
    } catch (_) {
      return { ui: null, updatedAt: null, lastSoftDenialAt: null, autoPromptCount: 0 };
    }
  }

  function setRecord(type, patch) {
    try {
      var cur = getRecord(type);
      var next = {
        ui: patch.ui !== undefined ? patch.ui : cur.ui,
        updatedAt: patch.updatedAt !== undefined ? patch.updatedAt : (patch.ui ? nowIso() : cur.updatedAt),
        lastSoftDenialAt: patch.lastSoftDenialAt !== undefined ? patch.lastSoftDenialAt : cur.lastSoftDenialAt,
        autoPromptCount: patch.autoPromptCount !== undefined ? patch.autoPromptCount : cur.autoPromptCount
      };
      if (!next.updatedAt) next.updatedAt = nowIso();
      localStorage.setItem(STORAGE_KEYS[type], JSON.stringify(next));
    } catch (_) {}
  }

  function bumpAutoPrompt(type) {
    var r = getRecord(type);
    setRecord(type, { autoPromptCount: r.autoPromptCount + 1 });
  }

  function queryPermissionApi(name) {
    return new Promise(function (resolve) {
      if (!navigator.permissions || !navigator.permissions.query) {
        resolve(null);
        return;
      }
      navigator.permissions.query({ name: name }).then(function (r) {
        resolve(r.state === 'granted' ? 'granted' : r.state === 'denied' ? 'denied' : 'prompt');
      }).catch(function () { resolve(null); });
    });
  }

  function syncOsState(type) {
    return new Promise(function (resolve) {
      if (type === 'location') {
        if (!navigator.geolocation) return resolve('unsupported');
        queryPermissionApi('geolocation').then(function (api) {
          if (api === 'granted' || api === 'denied') return resolve(api);
          if (api === 'prompt') return resolve('prompt');
          resolve(isIOS ? 'prompt' : 'prompt');
        });
        return;
      }
      if (type === 'notifications') {
        if (!('Notification' in window)) return resolve('unsupported');
        var p = Notification.permission;
        if (p === 'granted') return resolve('granted');
        if (p === 'denied') return resolve('denied');
        return resolve('prompt');
      }
      if (type === 'camera') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return resolve('unsupported');
        queryPermissionApi('camera').then(function (api) {
          if (api != null) return resolve(api);
          resolve('prompt');
        });
        return;
      }
      resolve('unsupported');
    });
  }

  function promoteIfOsGranted(type, os) {
    if (os === 'granted') {
      setRecord(type, { ui: 'accepted' });
      return true;
    }
    return false;
  }

  function shouldAutoShow(type) {
    return syncOsState(type).then(function (os) {
      if (os === 'granted') {
        promoteIfOsGranted(type, os);
        return false;
      }
      if (os === 'unsupported') return false;
      if (os === 'unsupported') return false;
      var r = getRecord(type);
      if (r.ui === 'accepted' || r.ui === 'denied_permanent') return false;
      if (r.autoPromptCount >= MAX_AUTO_PROMPTS) return false;
      if (r.ui === 'denied' && r.lastSoftDenialAt) {
        var t = new Date(r.lastSoftDenialAt).getTime();
        if (!isNaN(t) && Date.now() - t < COOLDOWN_MS) return false;
      }
      return true;
    });
  }

  function requestGeolocation() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(false);
      navigator.geolocation.getCurrentPosition(
        function () { resolve(true); },
        function (err) { resolve(!(err && (err.code === 1 || err.code === 2))); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  function requestCameraStream() {
    return new Promise(function (resolve) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        resolve(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
        stream.getTracks().forEach(function (t) { t.stop(); });
        resolve(true);
      }).catch(function () { resolve(false); });
    });
  }

  function requestNotifications() {
    return new Promise(function (resolve) {
      if (!('Notification' in window)) return resolve(false);
      if (Notification.permission === 'granted') return resolve(true);
      if (Notification.permission === 'denied') return resolve(false);
      Notification.requestPermission().then(function (p) {
        resolve(p === 'granted');
      }).catch(function () { resolve(false); });
    });
  }

  function closeSheet(overlay, modal, onDone) {
    if (!overlay) {
      if (onDone) onDone();
      return;
    }
    overlay.style.opacity = '0';
    modal.style.transform = 'translateY(110%)';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (onDone) onDone();
    }, 280);
  }

  function createSheetShell() {
    var overlay = document.createElement('div');
    overlay.id = 'airpet-perm-sheet-overlay';
    overlay.className = 'airpet-perm-overlay airpet-perm-sheet-overlay';
    overlay.setAttribute('role', 'presentation');

    var modal = document.createElement('div');
    modal.id = 'airpet-perm-sheet-modal';
    modal.className = 'airpet-perm-modal airpet-perm-sheet-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.style.transform = 'translateY(110%)';
    requestAnimationFrame(function () {
      overlay.style.opacity = '1';
      modal.style.transform = 'translateY(0)';
    });

    return { overlay: overlay, modal: modal };
  }

  function renderSheetContent(type) {
    var c = COPY[type];
    if (!c) return '';
    var bulletsHtml = c.bullets.map(function (b) {
      return '<li class="airpet-perm-sheet-li"><i class="fa-solid fa-check text-emerald-500 mr-2"></i>' + escapeHtml(b) + '</li>';
    }).join('');
    return (
      '<div class="airpet-perm-sheet-inner">' +
        '<div class="airpet-perm-sheet-hero">' +
          '<div class="airpet-perm-sheet-icon-wrap ' + c.iconBg + '">' +
            '<i class="fa-solid ' + c.icon + ' ' + c.iconColor + ' airpet-perm-sheet-icon"></i>' +
          '</div>' +
          '<h2 id="airpet-perm-sheet-title" class="airpet-perm-sheet-title">' + escapeHtml(c.title) + '</h2>' +
          '<p class="airpet-perm-sheet-sub">' + escapeHtml(c.subtitle) + '</p>' +
        '</div>' +
        '<ul class="airpet-perm-sheet-bullets">' + bulletsHtml + '</ul>' +
        '<div class="airpet-perm-sheet-actions">' +
          '<button type="button" class="airpet-main-action" id="airpet-perm-sheet-allow">Permitir</button>' +
          '<button type="button" class="airpet-secondary-action" id="airpet-perm-sheet-defer">Agora não</button>' +
        '</div>' +
        '<label class="airpet-perm-sheet-nomore">' +
          '<input type="checkbox" id="airpet-perm-sheet-nomore" class="airpet-perm-sheet-checkbox">' +
          '<span>Não mostrar novamente</span>' +
        '</label>' +
        '<p class="airpet-perm-sheet-hint">Você pode ativar depois nas configurações do navegador ou do app.</p>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * @returns {Promise<'granted'|'dismissed'|'dismissed_permanent'|'denied'>}
   */
  function showJitSheet(type) {
    return new Promise(function (resolve) {
      var c = COPY[type];
      if (!c) return resolve('dismissed');

      var shell = createSheetShell();
      var modal = shell.modal;
      var overlay = shell.overlay;
    modal.innerHTML = renderSheetContent(type);
    modal.setAttribute('aria-labelledby', 'airpet-perm-sheet-title');

    var btnAllow = modal.querySelector('#airpet-perm-sheet-allow');
      var btnDefer = modal.querySelector('#airpet-perm-sheet-defer');
      var chk = modal.querySelector('#airpet-perm-sheet-nomore');

      function finish(outcome) {
        closeSheet(overlay, modal, function () { resolve(outcome); });
      }

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          var permanent = chk && chk.checked;
          if (permanent) {
            setRecord(type, { ui: 'denied_permanent', lastSoftDenialAt: nowIso() });
            finish('dismissed_permanent');
          } else {
            setRecord(type, { ui: 'denied', lastSoftDenialAt: nowIso() });
            finish('dismissed');
          }
        }
      });

      btnDefer.addEventListener('click', function () {
        var permanent = chk && chk.checked;
        if (permanent) {
          setRecord(type, { ui: 'denied_permanent', lastSoftDenialAt: nowIso() });
          finish('dismissed_permanent');
        } else {
          setRecord(type, { ui: 'denied', lastSoftDenialAt: nowIso() });
          finish('dismissed');
        }
      });

      btnAllow.addEventListener('click', function () {
        btnAllow.disabled = true;
        btnDefer.disabled = true;
        var label = btnAllow.textContent;
        btnAllow.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Aguarde…';

        var p = type === 'location' ? requestGeolocation()
          : type === 'camera' ? requestCameraStream()
            : requestNotifications();

        p.then(function (ok) {
          if (ok) {
            setRecord(type, { ui: 'accepted' });
            finish('granted');
          } else {
            setRecord(type, { ui: 'denied', lastSoftDenialAt: nowIso() });
            finish('denied');
          }
        }).catch(function () {
          setRecord(type, { ui: 'denied', lastSoftDenialAt: nowIso() });
          finish('denied');
        }).finally(function () {
          btnAllow.textContent = label;
        });
      });
    });
  }

  function tryAutoShow(type, opts) {
    opts = opts || {};
    var defer = typeof opts.deferMs === 'number' ? opts.deferMs : 500;
    return new Promise(function (resolve) {
      setTimeout(function () {
        shouldAutoShow(type).then(function (show) {
          if (!show) return resolve({ shown: false, outcome: null });
          bumpAutoPrompt(type);
          showJitSheet(type).then(function (outcome) {
            resolve({ shown: true, outcome: outcome });
          });
        });
      }, defer);
    });
  }

  function mountFallbackBanner(container, type, options) {
    options = options || {};
    if (!container) return null;
    var existing = container.querySelector('.airpet-perm-fallback-banner');
    if (existing) existing.remove();

    var c = COPY[type];
    if (!c) return null;

    var wrap = document.createElement('div');
    wrap.className = 'airpet-perm-fallback-banner';
    wrap.setAttribute('role', 'status');
    wrap.innerHTML =
      '<div class="airpet-perm-fallback-inner">' +
        '<i class="fa-solid ' + c.icon + ' airpet-perm-fallback-ico"></i>' +
        '<div class="airpet-perm-fallback-text">' +
          '<strong>' + escapeHtml(c.fallbackTitle) + '</strong>' +
          '<span>' + escapeHtml(c.fallbackBody) + '</span>' +
        '</div>' +
        '<button type="button" class="airpet-perm-fallback-btn" data-airpet-settings>' +
          'Abrir configurações' +
        '</button>' +
        '<button type="button" class="airpet-perm-fallback-close" aria-label="Fechar">&times;</button>' +
      '</div>';

    var styleHint = settingsHintText(type);
    wrap.querySelector('[data-airpet-settings]').addEventListener('click', function () {
      openSettingsHelp(type, styleHint);
    });
    wrap.querySelector('.airpet-perm-fallback-close').addEventListener('click', function () {
      wrap.remove();
      if (options.onDismiss) options.onDismiss();
    });

    container.insertBefore(wrap, container.firstChild);
    return wrap;
  }

  function settingsHintText(type) {
    if (type === 'location') {
      if (isIOS) {
        return isStandalone
          ? 'No iPhone: Ajustes → AIRPET (ou Safari) → Localização → Ao usar o App.'
          : 'No iPhone: Ajustes → Privacidade → Serviços de Localização → Safari → Ao usar o App.';
      }
      if (isAndroid) {
        return isStandalone
          ? 'No Android: Ajustes → Apps → AIRPET → Permissões → Localização.'
          : 'No Chrome: toque no cadeado na barra de endereço → Permissões → Localização.';
      }
      return 'Use o ícone de cadeado ou informações do site na barra do navegador para permitir localização.';
    }
    if (type === 'camera') {
      if (isIOS) {
        return isStandalone
          ? 'Ajustes → AIRPET → Câmera → ativar.'
          : 'Ajustes → Safari → Câmera → permitir para este site.';
      }
      if (isAndroid) {
        return 'Ajustes → Apps → AIRPET (ou Chrome) → Permissões → Câmera.';
      }
      return 'Permita a câmera nas configurações do site (ícone de cadeado na barra).';
    }
    if (type === 'notifications') {
      if (isIOS) {
        return 'Ajustes → Notificações → AIRPET (ou Safari) → permitir alertas.';
      }
      if (isAndroid) {
        return 'Ajustes → Apps → AIRPET → Notificações → ativar.';
      }
      return 'Permita notificações nas configurações do site (cadeado na barra de endereço).';
    }
    return '';
  }

  function openSettingsHelp(type, hint) {
    if (hint) {
      try {
        window.alert(hint);
      } catch (_) {}
    }
  }

  /**
   * Mapa: centralização inicial + banner se bloqueado de vez.
   */
  function mapPageBootstrap(opts) {
    opts = opts || {};
    var requestLocate = opts.requestLocate;
    var defaultView = opts.defaultView;
    var mapContainer = opts.mapContainer;

    function runDefault() {
      if (typeof defaultView === 'function') defaultView();
    }

    function runLocate() {
      if (typeof requestLocate === 'function') requestLocate();
      else runDefault();
    }

    return syncOsState('location').then(function (os) {
      if (os === 'granted') {
        promoteIfOsGranted('location', os);
        runLocate();
        return;
      }
      var r = getRecord('location');
      if (r.ui === 'denied_permanent' || os === 'denied') {
        runDefault();
        if (mapContainer && (r.ui === 'denied_permanent' || os === 'denied')) {
          mountFallbackBanner(mapContainer, 'location');
        }
        return;
      }
      return shouldAutoShow('location').then(function (show) {
        if (!show) {
          if (r.ui === 'accepted') runLocate();
          else runDefault();
          return;
        }
        bumpAutoPrompt('location');
        return showJitSheet('location').then(function (outcome) {
          if (outcome === 'granted') runLocate();
          else {
            runDefault();
            if (outcome === 'dismissed_permanent' || outcome === 'denied') {
              if (mapContainer) mountFallbackBanner(mapContainer, 'location');
            }
          }
        });
      });
    });
  }

  /**
   * Antes de abrir file input com captura opcional (câmera nativa do SO).
   */
  function prepareFilePickerWithCameraHint(fileInput) {
    if (!fileInput) return Promise.resolve();
    return syncOsState('camera').then(function (os) {
      if (os === 'granted') {
        promoteIfOsGranted('camera', os);
        try { fileInput.setAttribute('capture', 'environment'); } catch (_) {}
        return;
      }
      if (os === 'unsupported') {
        try { fileInput.removeAttribute('capture'); } catch (_) {}
        return;
      }
      var r = getRecord('camera');
      if (r.ui === 'denied_permanent' || os === 'denied') {
        try { fileInput.removeAttribute('capture'); } catch (_) {}
        return;
      }
      return shouldAutoShow('camera').then(function (show) {
        if (!show) {
          if (r.ui === 'accepted') {
            try { fileInput.setAttribute('capture', 'environment'); } catch (_) {}
          }
          return;
        }
        bumpAutoPrompt('camera');
        return showJitSheet('camera').then(function (outcome) {
          if (outcome === 'granted') {
            try { fileInput.setAttribute('capture', 'environment'); } catch (_) {}
          } else {
            try { fileInput.removeAttribute('capture'); } catch (_) {}
          }
        });
      });
    });
  }

  migrate();

  window.airpetPermissionSheet = {
    migrate: migrate,
    getRecord: getRecord,
    setRecord: setRecord,
    syncOsState: syncOsState,
    shouldAutoShow: shouldAutoShow,
    showJitSheet: showJitSheet,
    tryAutoShow: tryAutoShow,
    mapPageBootstrap: mapPageBootstrap,
    mountFallbackBanner: mountFallbackBanner,
    prepareFilePickerWithCameraHint: prepareFilePickerWithCameraHint,
    requestGeolocation: requestGeolocation,
    requestNotifications: requestNotifications,
    settingsHintText: settingsHintText,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isStandalone: isStandalone
  };
})();
