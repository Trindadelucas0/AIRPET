(function () {
  'use strict';

  function variant() {
    try {
      var m = document.cookie.match(/(?:^|; )lp_variant=([^;]*)/);
      return m ? decodeURIComponent(m[1]).toUpperCase() : '';
    } catch (e) {
      return '';
    }
  }

  function payload(name, data) {
    return Object.assign({ event: name, variant: variant() || undefined }, data || {});
  }

  function plausible(name, props) {
    var domain = (window.FUNIL_PLAUSIBLE_DOMAIN || '').trim();
    if (!domain || typeof window.plausible !== 'function') return;
    try {
      if (props && Object.keys(props).length) {
        window.plausible(name, { props: props });
      } else {
        window.plausible(name);
      }
    } catch (e) {}
  }

  function ga4(name, params) {
    var mid = (window.FUNIL_GA_MEASUREMENT_ID || '').trim();
    if (!mid || typeof window.gtag !== 'function') return;
    try {
      window.gtag('event', name, params || {});
    } catch (e) {}
  }

  function emit(name, data) {
    var p = payload(name, data);
    if (window.FUNIL_DEBUG === true || window.FUNIL_DEBUG === 'true') {
      try {
        console.debug('[funil]', p);
      } catch (e) {}
    }
    plausible(name, p);
    ga4(name, p);
  }

  emit('lp_view', { path: window.location.pathname });

  var scroll50 = false;
  window.addEventListener(
    'scroll',
    function () {
      if (scroll50) return;
      var h = document.documentElement;
      var pct = ((h.scrollTop + h.clientHeight) / Math.max(h.scrollHeight, 1)) * 100;
      if (pct >= 50) {
        scroll50 = true;
        emit('lp_scroll_50', { path: window.location.pathname });
      }
    },
    { passive: true }
  );

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-funil-cta]') : null;
    if (!t) return;
    emit('lp_cta_click', {
      cta: t.getAttribute('data-funil-cta') || 'unknown',
      href: t.getAttribute('href') || '',
    });
  });

  window.FunilAnalytics = {
    emit: emit,
    variant: variant,
    wizardStepView: function (step, label) {
      emit('wizard_step_view', { step: step, label: label || '' });
    },
    wizardStepComplete: function (step) {
      emit('wizard_step_complete', { step: step });
    },
    wizardPartialLead: function () {
      emit('wizard_partial_lead', {});
    },
    wizardSubmitOk: function () {
      emit('wizard_submit_ok', {});
    },
    wizardSubmitErr: function (msg) {
      emit('wizard_submit_err', { message: (msg || '').slice(0, 200) });
    },
  };
})();
