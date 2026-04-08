(function (global) {
  'use strict';

  if (global.AIRPET_LOADING) return;

  var DEFAULT_MICROCOPY = [
    'Carregando novidades do seu pet…',
    'Buscando amigos peludos…',
    'Preparando a casinha digital…',
    'Reunindo patinhas e ronrons…'
  ];

  var DEFERRED_OVERLAY_MS = 2000;

  var microcopy = DEFAULT_MICROCOPY.slice();
  var routeDepth = 0;
  var longWaitDepth = 0;
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

  function overlayShouldShow() {
    return routeDepth > 0 || longWaitDepth > 0;
  }

  function showOverlayShell() {
    var el = getOverlay();
    if (!el) return;
    el.classList.remove('airpet-route-overlay--hide');
    el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('airpet-route-loading');
  }

  function hideOverlayShell() {
    var el = getOverlay();
    stopMicrocopyRotation();
    if (el) {
      el.classList.add('airpet-route-overlay--hide');
      el.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('airpet-route-loading');
    applyMicrocopyIndex();
  }

  function showRoute() {
    var el = getOverlay();
    if (!el) return;
    routeDepth++;
    showOverlayShell();
    if (longWaitDepth === 0) {
      startMicrocopyRotation();
    }
  }

  function hideRoute() {
    routeDepth = Math.max(0, routeDepth - 1);
    if (routeDepth > 0) return;
    if (longWaitDepth > 0) {
      stopMicrocopyRotation();
      return;
    }
    hideOverlayShell();
  }

  /** Nova página ou bfcache: força overlay fechado */
  function resetRouteOverlay() {
    routeDepth = 0;
    longWaitDepth = 0;
    hideOverlayShell();
  }

  /**
   * Overlay por operação longa (ex.: após 2s). Independente de routeDepth.
   * @param {string} [message] texto fixo no microcopy
   */
  function beginLongWaitOverlay(message) {
    longWaitDepth++;
    showOverlayShell();
    stopMicrocopyRotation();
    var m = getMicroEl();
    if (m) {
      m.textContent = message || 'Ainda a processar…';
    }
  }

  function endLongWaitOverlay() {
    longWaitDepth = Math.max(0, longWaitDepth - 1);
    if (longWaitDepth > 0) return;
    if (routeDepth > 0) {
      startMicrocopyRotation();
      return;
    }
    hideOverlayShell();
  }

  /**
   * @param {() => Promise<any>} workFn
   * @param {object} [opts]
   * @param {number} [opts.thresholdMs]
   * @param {string} [opts.message]
   */
  function withDeferredOverlay(workFn, opts) {
    opts = opts || {};
    var threshold = Number.isFinite(opts.thresholdMs) ? opts.thresholdMs : DEFERRED_OVERLAY_MS;
    var message = opts.message != null ? opts.message : 'Ainda a processar…';
    var timer = null;
    var shown = false;
    timer = setTimeout(function () {
      if (shown) return;
      shown = true;
      beginLongWaitOverlay(message);
    }, threshold);
    return Promise.resolve()
      .then(workFn)
      .finally(function () {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (shown) endLongWaitOverlay();
      });
  }

  /**
   * Executa operação com overlay diferido e timeout máximo.
   * Evita overlays presos quando promessas nunca resolvem.
   * @param {() => Promise<any>} workFn
   * @param {object} [opts]
   * @param {number} [opts.timeoutMs]
   */
  function withDeferredOverlayTimeout(workFn, opts) {
    opts = opts || {};
    var timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 15000;
    var timer = null;
    return withDeferredOverlay(function () {
      var timeoutPromise = new Promise(function (_, reject) {
        timer = setTimeout(function () {
          reject(new Error('overlay_timeout'));
        }, timeoutMs);
      });
      return Promise.race([
        Promise.resolve().then(workFn),
        timeoutPromise
      ]).finally(function () {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      });
    }, opts);
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
    DEFERRED_OVERLAY_MS: DEFERRED_OVERLAY_MS,
    showRoute: showRoute,
    hideRoute: hideRoute,
    resetRouteOverlay: resetRouteOverlay,
    beginLongWaitOverlay: beginLongWaitOverlay,
    endLongWaitOverlay: endLongWaitOverlay,
    withDeferredOverlay: withDeferredOverlay,
    withDeferredOverlayTimeout: withDeferredOverlayTimeout,
    reducedMotion: reducedMotion,
    runLocked: runLocked,
    debounce: debounce,
    setMicrocopyMessages: setMicrocopyMessages,
    setScreen: setScreen,
    isScreenLoading: isScreenLoading
  };
})(window);
