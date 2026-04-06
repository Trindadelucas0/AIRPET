/**
 * Invalida cache SWR de /api/v1/me* após mutações de seguir/deixar de seguir (JSON).
 * Depende de swrCache.js (AIRPET_SWR_CACHE).
 */
(function (global) {
  'use strict';

  if (global.AIRPET_SYNC_CACHE_HOOKS) return;

  var origFetch = global.fetch;
  if (typeof origFetch !== 'function') return;

  function maybeInvalidateFollowing(url, res) {
    if (!res || !res.ok) return;
    var s = typeof url === 'string' ? url : (url && url.url) || '';
    if (s.indexOf('/explorar/seguir/') === -1 && s.indexOf('/explorar/pet/') === -1) return;
    var c = global.AIRPET_SWR_CACHE;
    if (c && typeof c.invalidateKeysContaining === 'function') {
      c.invalidateKeysContaining('/api/v1/me/following');
    }
  }

  global.fetch = function (input, init) {
    var method = (init && init.method) || 'GET';
    if (typeof method === 'string') method = method.toUpperCase();
    return origFetch.apply(this, arguments).then(function (res) {
      if (method === 'POST' || method === 'DELETE') {
        try {
          var u = typeof input === 'string' ? input : (input && input.url) || '';
          maybeInvalidateFollowing(u, res);
        } catch (_) {}
      }
      return res;
    });
  };

  global.AIRPET_SYNC_CACHE_HOOKS = { installed: true };
})(window);
