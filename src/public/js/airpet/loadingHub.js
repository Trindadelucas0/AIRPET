(function (global) {
  'use strict';

  if (global.AIRPET_LOADING) return;

  var DEFAULT_MICROCOPY = [
    'Carregando novidades do seu pet…',
    'Buscando amigos peludos…',
    'Preparando a casinha digital…',
    'Reunindo patinhas e ronrons…'
  ];

  var microcopy = DEFAULT_MICROCOPY.slice();
  var routeDepth = 0;
  var microInterval = null;
  var microIndex = 0;
  var screens = {};

  function reducedMotion() {
    try {
      return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
      return false;
    }
  }

  function getOverlay() {
    return document.getElementById('airpetRouteOverlay');
  }

  function getMicroEl() {
    return document.getElementById('airpetRouteMicrocopy');
  }

  function stopMicrocopyRotation() {
    if (microInterval) {
      clearInterval(microInterval);
      microInterval = null;
    }
  }

  function applyMicrocopyIndex() {
    var el = getMicroEl();
    if (!el || !microcopy.length) return;
    el.textContent = microcopy[microIndex % microcopy.length];
  }

  function startMicrocopyRotation() {
    stopMicrocopyRotation();
    microIndex = 0;
    applyMicrocopyIndex();
    if (reducedMotion() || microcopy.length < 2) return;
    microInterval = setInterval(function () {
      microIndex++;
      applyMicrocopyIndex();
    }, 2800);
  }

  function showRoute() {
    var el = getOverlay();
    if (!el) return;
    routeDepth++;
    if (routeDepth === 1) {
      el.classList.remove('airpet-route-overlay--hide');
      el.setAttribute('aria-hidden', 'false');
      document.body.classList.add('airpet-route-loading');
      startMicrocopyRotation();
    }
  }

  function hideRoute() {
    var el = getOverlay();
    routeDepth = Math.max(0, routeDepth - 1);
    if (routeDepth === 0) {
      stopMicrocopyRotation();
      if (el) {
        el.classList.add('airpet-route-overlay--hide');
        el.setAttribute('aria-hidden', 'true');
      }
      document.body.classList.remove('airpet-route-loading');
    }
  }

  /** Nova página ou bfcache: força overlay fechado */
  function resetRouteOverlay() {
    routeDepth = 0;
    stopMicrocopyRotation();
    var el = getOverlay();
    if (el) {
      el.classList.add('airpet-route-overlay--hide');
      el.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('airpet-route-loading');
  }

  function setMicrocopyMessages(arr) {
    if (arr && arr.length) microcopy = arr.slice();
  }

  function setScreen(id, loading) {
    if (!id) return;
    screens[id] = !!loading;
  }

  function isScreenLoading(id) {
    return !!screens[id];
  }

  /**
   * @param {object} opts
   * @param {HTMLElement} [opts.button]
   * @param {string} [opts.busyText] HTML interno durante busy
   * @param {boolean} [opts.disable=true]
   * @param {() => Promise<any>} workFn
   */
  function runLocked(opts, workFn) {
    if (typeof opts === 'function') {
      workFn = opts;
      opts = {};
    }
    opts = opts || {};
    var btn = opts.button;
    var busyText = opts.busyText != null ? opts.busyText : '<span class="airpet-inline-dots">Enviando</span>';
    var disable = opts.disable !== false;
    var prevHtml = null;
    var prevDisabled = null;
    if (btn) {
      prevHtml = btn.innerHTML;
      prevDisabled = btn.disabled;
      if (disable) btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      btn.classList.add('airpet-btn-loading');
      btn.innerHTML = busyText;
    }
    return Promise.resolve()
      .then(workFn)
      .finally(function () {
        if (btn) {
          btn.removeAttribute('aria-busy');
          btn.classList.remove('airpet-btn-loading');
          btn.innerHTML = prevHtml;
          if (disable) btn.disabled = prevDisabled;
        }
      });
  }

  function debounce(fn, waitMs) {
    var t = null;
    var w = Number(waitMs) > 0 ? Number(waitMs) : 300;
    function wrapped() {
      var ctx = this;
      var args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        fn.apply(ctx, args);
      }, w);
    }
    wrapped.cancel = function () {
      if (t) {
        clearTimeout(t);
        t = null;
      }
    };
    return wrapped;
  }

  global.AIRPET_LOADING = {
    showRoute: showRoute,
    hideRoute: hideRoute,
    resetRouteOverlay: resetRouteOverlay,
    reducedMotion: reducedMotion,
    runLocked: runLocked,
    debounce: debounce,
    setMicrocopyMessages: setMicrocopyMessages,
    setScreen: setScreen,
    isScreenLoading: isScreenLoading
  };
})(window);
