(function () {
  'use strict';

  // --- Mobile nav toggle ---
  var mobileMenuBtn = document.getElementById('mobileMenuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  var menuIcon = document.getElementById('menuIcon');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', function () {
      var isOpen = !mobileMenu.classList.contains('hidden');
      mobileMenu.classList.toggle('hidden');
      if (menuIcon) {
        menuIcon.className = isOpen
          ? 'fa-solid fa-bars text-xl'
          : 'fa-solid fa-xmark text-xl';
      }
    });
  }

  // --- Flash message behavior (auto-dismiss + close button) ---
  var flashContainer = document.getElementById('flashContainer');
  if (flashContainer) {
    var autoCloseMs = parseInt(flashContainer.getAttribute('data-flash-autoclose-ms') || '8000', 10);
    if (!Number.isFinite(autoCloseMs) || autoCloseMs < 0) autoCloseMs = 8000;

    function dismissFlash(el) {
      if (!el || el.dataset.closing === '1') return;
      el.dataset.closing = '1';
      el.classList.add('fade-out');
      setTimeout(function () { el.remove(); }, 400);
    }

    flashContainer.addEventListener('click', function (e) {
      var closeBtn = e.target.closest('[data-flash-close]');
      if (!closeBtn) return;
      dismissFlash(closeBtn.closest('.flash-msg'));
    });

    setTimeout(function () {
      var msgs = flashContainer.querySelectorAll('.flash-msg');
      msgs.forEach(function (el) {
        dismissFlash(el);
      });
    }, autoCloseMs);
  }

  // --- Geolocation helper (com suporte iOS) ---
  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function _geoErrorMsg(err) {
    if (!err) return 'Erro desconhecido ao obter localização';
    if (err.code === 1) {
      if (_isIOS) {
        return 'Localização bloqueada. No iPhone, vá em Ajustes → Privacidade → Serviços de Localização → Safari e selecione "Ao Usar o App".';
      }
      return 'Permissão de localização negada. Verifique as configurações do navegador.';
    }
    if (err.code === 2) return 'Localização indisponível. Verifique se o GPS está ativado.';
    if (err.code === 3) return 'Tempo esgotado ao obter localização. Tente novamente.';
    return err.message || 'Erro ao obter localização';
  }

  window.airpetGeo = {
    isIOS: _isIOS,
    getErrorMessage: _geoErrorMsg,

    getCurrentPosition: function (callback, errorCallback) {
      if (!navigator.geolocation) {
        if (errorCallback) errorCallback(new Error('Geolocalização não suportada'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          callback({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        function (err) {
          console.warn('[AIRPET] Geolocation error:', err.code, err.message);
          if (errorCallback) errorCallback(err);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
      );
    },

    watchPosition: function (callback, errorCallback) {
      if (!navigator.geolocation) return null;
      return navigator.geolocation.watchPosition(
        function (pos) {
          callback({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        function (err) {
          console.warn('[AIRPET] Watch error:', err.code, err.message);
          if (errorCallback) errorCallback(err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    }
  };

  // --- Method override for forms ---
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var methodInput = form.querySelector('input[name="_method"]');
    if (!methodInput) return;

    var method = methodInput.value.toUpperCase();
    if (method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
      e.preventDefault();
      var formData = new FormData(form);
      var action = form.action;
      var body = new URLSearchParams(formData);
      body.delete('_method');

      fetch(action, {
        method: method,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        credentials: 'same-origin'
      }).then(function (res) {
        if (res.redirected) {
          window.location.href = res.url;
        } else {
          window.location.reload();
        }
      }).catch(function () {
        window.location.reload();
      });
    }
  });
})();

window.compartilharWhatsApp = function(texto) {
  var url = 'https://wa.me/?text=' + encodeURIComponent(texto);
  window.open(url, '_blank');
};
