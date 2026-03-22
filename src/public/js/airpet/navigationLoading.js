(function () {
  'use strict';

  function getLoading() {
    return window.AIRPET_LOADING;
  }

  function shouldShowForAnchor(a, e) {
    if (!a || a.tagName !== 'A') return false;
    if (e.defaultPrevented) return false;
    if (e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.hasAttribute('data-airpet-no-route-loader')) return false;
    if (a.target === '_blank') return false;
    if (a.hasAttribute('download')) return false;
    var href = a.getAttribute('href');
    if (!href || href === '#' || /^\s*javascript:/i.test(href)) return false;

    var u;
    try {
      u = new URL(href, window.location.href);
    } catch (err) {
      return false;
    }
    if (u.origin !== window.location.origin) return false;
    /* Mesma página, só âncora: não bloquear */
    if (
      u.pathname === window.location.pathname &&
      u.search === window.location.search &&
      u.hash
    ) {
      return false;
    }
    return true;
  }

  document.addEventListener(
    'click',
    function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!shouldShowForAnchor(a, e)) return;
      var L = getLoading();
      if (!L || typeof L.showRoute !== 'function') return;
      L.showRoute();
    },
    true
  );

  window.addEventListener('pageshow', function (ev) {
    var L = getLoading();
    if (L && typeof L.resetRouteOverlay === 'function') L.resetRouteOverlay();
  });

  window.addEventListener('load', function () {
    var L = getLoading();
    if (L && typeof L.resetRouteOverlay === 'function') L.resetRouteOverlay();
  });
})();
