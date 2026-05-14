/**
 * permissions.js — Compatibilidade com código legado.
 * O fluxo JIT de permissões está em permissionSheet.js.
 */
(function () {
  'use strict';

  var LEGACY_KEY = 'airpet_permissions_done';
  var META_KEY = 'airpet_perm_meta_v1';
  var KEYS = ['airpet_perm_location', 'airpet_perm_camera', 'airpet_perm_notifications'];

  function limparTudo() {
    try {
      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(META_KEY);
      KEYS.forEach(function (k) { localStorage.removeItem(k); });
    } catch (_) {}
  }

  var PS = window.airpetPermissionSheet || {};

  window.airpetPermissions = {
    resetar: limparTudo,
    /** Mantido para compat; o modal pós-login foi substituído por folhas JIT. */
    verificar: function () {
      if (window.airpetPermissionSheet && window.airpetPermissionSheet.migrate) {
        window.airpetPermissionSheet.migrate();
      }
    },
    isIOS: !!PS.isIOS,
    isAndroid: !!PS.isAndroid,
    isStandalone: !!PS.isStandalone
  };
})();
