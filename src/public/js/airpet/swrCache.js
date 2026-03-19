(function (global) {
  'use strict';

  if (global.AIRPET_SWR_CACHE) return;

  var coordinator = global.AIRPET_REQ_COORDINATOR && global.AIRPET_REQ_COORDINATOR.instance
    ? global.AIRPET_REQ_COORDINATOR.instance
    : null;
  if (!coordinator) {
    throw new Error('AIRPET_SWR: requestCoordinator not found. Load requestCoordinator.js first.');
  }

  var mem = new Map(); // key -> { value, updatedAt }
  var metrics = global.AIRPET_METRICS = global.AIRPET_METRICS || {};
  metrics.cache = metrics.cache || {
    hitsFresh: {}, // endpoint -> count
    hitsStale: {}, // endpoint -> count
    misses: {}, // endpoint -> count
    revalidationsQueued: {}, // endpoint -> count
    revalidationsSuccess: {} // endpoint -> count
  };

  function endpointFromKey(key) {
    return String(key || '').split(':')[0] || 'unknown';
  }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (_) { return null; }
  }

  function storageKey(key) {
    return 'airpet_swr_' + String(key);
  }

  function getPersisted(key) {
    try {
      var raw = localStorage.getItem(storageKey(key));
      if (!raw) return null;
      var parsed = safeJsonParse(raw);
      if (!parsed || typeof parsed.updatedAt !== 'number') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function setPersisted(key, value, updatedAt, cacheTimeMs) {
    try {
      var payload = { value: value, updatedAt: updatedAt, expiresAt: updatedAt + cacheTimeMs };
      localStorage.setItem(storageKey(key), JSON.stringify(payload));
    } catch (_) {}
  }

  function isExpired(entry, cacheTimeMs) {
    if (!entry || typeof entry.updatedAt !== 'number') return true;
    return (Date.now() - entry.updatedAt) > cacheTimeMs;
  }

  function getCached(key, cacheTimeMs) {
    if (!cacheTimeMs || !Number.isFinite(cacheTimeMs) || cacheTimeMs <= 0) return null;
    var k = String(key);
    var entry = mem.get(k) || getPersisted(k);
    if (!entry) return null;
    if (isExpired(entry, cacheTimeMs)) {
      mem.delete(k);
      try { localStorage.removeItem(storageKey(k)); } catch (_) {}
      return null;
    }
    return entry;
  }

  function setCached(key, value, cacheTimeMs) {
    var k = String(key);
    var updatedAt = Date.now();
    mem.set(k, { value: value, updatedAt: updatedAt });
    setPersisted(k, value, updatedAt, cacheTimeMs);
  }

  /**
   * stale-while-revalidate:
   * - if fresh -> return cache
   * - if stale -> return cache, revalidate in background
   * - if missing/expired -> fetch
   */
  function swrFetchGet(opts) {
    opts = opts || {};
    var key = opts.key;
    if (!key) return Promise.reject(new Error('swrFetchGet: missing key'));

    var endpoint = endpointFromKey(key);

    // Alguns fluxos (autocomplete de menções) precisam de consistência:
    // se o cache estiver stale, não queremos renderizar um resultado possivelmente desatualizado.
    var serveStale = typeof opts.serveStale === 'boolean' ? opts.serveStale : true;

    var url = opts.url;
    var priority = opts.priority || global.AIRPET_REQ_COORDINATOR.PRIORITY.MEDIUM;
    var staleTimeMs = Number.isFinite(opts.staleTimeMs) ? opts.staleTimeMs : 300000; // 5 min
    var cacheTimeMs = Number.isFinite(opts.cacheTimeMs) ? opts.cacheTimeMs : 1800000; // 30 min
    var group = opts.group || 'swr';
    var fetchFn = opts.fetchFn;
    var headers = opts.headers || null;
    var credentials = opts.credentials || 'same-origin';
    var shouldRevalidate = typeof opts.shouldRevalidate === 'function' ? opts.shouldRevalidate : function () { return true; };
    var onUpdate = opts.onUpdate;

    if (!fetchFn) {
      if (!url) return Promise.reject(new Error('swrFetchGet: missing url or fetchFn'));
      fetchFn = function (signal) {
        return fetch(url, {
          method: 'GET',
          headers: headers || { 'Accept': 'application/json' },
          credentials: credentials,
          signal: signal
        }).then(function (r) { return r.json(); });
      };
    }

    var cached = getCached(key, cacheTimeMs);
    if (cached) {
      var age = Date.now() - cached.updatedAt;
      var isFresh = age <= staleTimeMs;
      if (isFresh) {
        metrics.cache.hitsFresh[endpoint] = (metrics.cache.hitsFresh[endpoint] || 0) + 1;
        return Promise.resolve({ data: cached.value, fromCache: true, revalidated: false, isFresh: true });
      }

      // stale: return cached immediately, but revalidate in background (if allowed).
      metrics.cache.hitsStale[endpoint] = (metrics.cache.hitsStale[endpoint] || 0) + 1;

      if (!serveStale) {
        // Não servir stale: busca agora e só renderiza quando vier resposta revalidada.
        if (!shouldRevalidate()) {
          return Promise.resolve({ data: null, fromCache: true, revalidated: false, isFresh: false, staleNotServed: true });
        }

        metrics.cache.revalidationsQueued[endpoint] = (metrics.cache.revalidationsQueued[endpoint] || 0) + 1;
        return coordinator.enqueue({
          key: String(key) + ':revalidate',
          priority: priority,
          group: group,
          fetchFn: function (signal) { return fetchFn(signal); }
        }).then(function (data) {
          setCached(key, data, cacheTimeMs);
          metrics.cache.revalidationsSuccess[endpoint] = (metrics.cache.revalidationsSuccess[endpoint] || 0) + 1;
          if (typeof onUpdate === 'function') onUpdate(data, { fromCache: false, revalidated: true });
          return { data: data, fromCache: false, revalidated: true, isFresh: false };
        }).catch(function () {
          return { data: null, fromCache: false, revalidated: false, isFresh: false };
        });
      }

      if (shouldRevalidate()) {
        try {
          metrics.cache.revalidationsQueued[endpoint] = (metrics.cache.revalidationsQueued[endpoint] || 0) + 1;
          coordinator.enqueue({
            key: String(key) + ':revalidate',
            priority: priority,
            group: group,
            fetchFn: function (signal) {
              return fetchFn(signal);
            }
          }).then(function (data) {
            setCached(key, data, cacheTimeMs);
            metrics.cache.revalidationsSuccess[endpoint] = (metrics.cache.revalidationsSuccess[endpoint] || 0) + 1;
            if (typeof onUpdate === 'function') onUpdate(data, { fromCache: false, revalidated: true });
          }).catch(function () {
            // Ignore background revalidate errors (offline / abort / etc).
          });
        } catch (_) {}
      }

      return Promise.resolve({ data: cached.value, fromCache: true, revalidated: true, isFresh: false });
    }

    metrics.cache.misses[endpoint] = (metrics.cache.misses[endpoint] || 0) + 1;

    // Missing cache -> fetch and store.
    return coordinator.enqueue({
      key: String(key) + ':fetch',
      priority: priority,
      group: group,
      fetchFn: function (signal) { return fetchFn(signal); }
    }).then(function (data) {
      setCached(key, data, cacheTimeMs);
      return { data: data, fromCache: false, revalidated: false, isFresh: false };
    });
  }

  global.AIRPET_SWR_CACHE = {
    getCached: getCached,
    setCached: setCached,
    swrFetchGet: swrFetchGet
  };

  // Small convenience alias.
  global.swrFetchGet = swrFetchGet;
})(window);

