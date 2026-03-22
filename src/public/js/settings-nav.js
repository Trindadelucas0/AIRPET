(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('a.settings-internal-nav').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (!href || href.indexOf('/perfil/') !== 0) return;
        e.preventDefault();
        var ov = document.getElementById('settingsHubNavLoader');
        if (ov) {
          ov.classList.remove('settings-route-loader--hide');
          ov.setAttribute('aria-hidden', 'false');
        }
        window.location.href = href;
      });
    });
  });
})();
