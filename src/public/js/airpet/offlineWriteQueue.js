/**
 * Fila opcional de writes (PATCH/POST) em IndexedDB para reenvio ao voltar online.
 * Use Idempotency-Key alinhado ao servidor (PATCH /api/v1/me) para evitar duplicação.
 *
 * Ex.: AIRPET_OFFLINE_QUEUE.enqueue({ url: '/api/v1/me', method: 'PATCH', body: JSON.stringify({ bio: 'x' }), idempotencyKey: crypto.randomUUID() })
 */
(function (global) {
  'use strict';

  if (global.AIRPET_OFFLINE_QUEUE) return;

  var DB_NAME = 'airpet_offline';
  var STORE = 'writes';
  var VERSION = 1;

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(DB_NAME, VERSION);
      req.onerror = function () { reject(req.error); };
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: 'id' });
          os.createIndex('byStatus', 'status', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
    });
  }

  function enqueue(entry) {
    if (!global.indexedDB) return Promise.reject(new Error('IndexedDB indisponível'));
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var id = 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        var row = {
          id: id,
          url: String(entry.url || ''),
          method: String(entry.method || 'PATCH').toUpperCase(),
          headers: entry.headers && typeof entry.headers === 'object' ? entry.headers : {},
          body: entry.body != null ? String(entry.body) : '',
          idempotencyKey: entry.idempotencyKey ? String(entry.idempotencyKey).slice(0, 128) : '',
          status: 'pending',
          createdAt: Date.now(),
          attempts: 0
        };
        var tx = db.transaction(STORE, 'readwrite');
        tx.oncomplete = function () { resolve(id); };
        tx.onerror = function () { reject(tx.error); };
        tx.objectStore(STORE).add(row);
      });
    });
  }

  function listPending(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readonly');
      var os = tx.objectStore(STORE);
      var idx = os.index('byStatus');
      var r = idx.getAll('pending');
      r.onsuccess = function () { resolve(r.result || []); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function remove(db, id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
      tx.objectStore(STORE).delete(id);
    });
  }

  function flush() {
    if (!global.indexedDB) return Promise.resolve({ ok: false, reason: 'no_idb' });
    if (global.navigator && global.navigator.onLine === false) {
      return Promise.resolve({ ok: false, reason: 'offline' });
    }
    return openDb().then(function (db) {
      return listPending(db).then(function (rows) {
        var p = Promise.resolve();
        rows.forEach(function (row) {
          p = p.then(function () {
            var h = Object.assign(
              { 'Content-Type': 'application/json', Accept: 'application/json' },
              row.headers
            );
            if (row.idempotencyKey) h['Idempotency-Key'] = row.idempotencyKey;
            return global
              .fetch(row.url, {
                method: row.method,
                headers: h,
                body: row.body || undefined,
                credentials: 'same-origin'
              })
              .then(function (res) {
                if (res.ok) return remove(db, row.id);
                if (res.status >= 400 && res.status < 500) return remove(db, row.id);
                throw new Error('airpet_offline_retry');
              });
          });
        });
        return p;
      });
    })
      .then(function () { return { ok: true }; })
      .catch(function () { return { ok: false }; });
  }

  global.addEventListener('online', function () {
    flush();
  });

  global.AIRPET_OFFLINE_QUEUE = {
    enqueue: enqueue,
    flush: flush,
    openDb: openDb
  };
})(window);
