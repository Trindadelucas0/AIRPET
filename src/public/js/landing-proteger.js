(function () {
  'use strict';

  document.querySelectorAll('[data-scroll]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var sel = btn.getAttribute('data-scroll');
      if (!sel) return;
      var el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var form = document.getElementById('landingSignupForm');
  if (!form) return;

  var submitBtn = document.getElementById('landingSubmitBtn');
  var messageEl = document.getElementById('landingFormMessage');

  function showMessage(text, type) {
    if (!messageEl) return;
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.setAttribute('data-type', type || 'info');
  }

  function hideMessage() {
    if (!messageEl) return;
    messageEl.hidden = true;
    messageEl.textContent = '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideMessage();

    var emailInput = form.querySelector('[name="email"]');
    var email = (emailInput && emailInput.value ? emailInput.value : '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showMessage('Informe um e-mail válido.', 'erro');
      if (emailInput) emailInput.focus();
      return;
    }

    var origemEl = form.querySelector('[name="origem"]');
    var websiteEl = form.querySelector('[name="website"]');
    var payload = {
      email: email,
      origem: origemEl ? origemEl.value : 'proteger-meu-pet',
      website: websiteEl ? websiteEl.value : '',
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando…';
    }

    fetch('/api/proteger-meu-pet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (result.ok && data.sucesso) {
          showMessage(data.mensagem || 'Recebemos. Entraremos em contato em breve.', data.jaInscrito ? 'info' : 'sucesso');
          form.reset();
          if (origemEl) origemEl.value = 'proteger-meu-pet';
          return;
        }
        if (result.status === 429) {
          showMessage(data.mensagem || 'Muitas tentativas. Aguarde alguns minutos.', 'erro');
          return;
        }
        showMessage(data.mensagem || 'Não foi possível enviar. Tente novamente.', 'erro');
      })
      .catch(function () {
        showMessage('Erro de conexão. Verifique a internet e tente de novo.', 'erro');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Quero proteger meu pet';
        }
      });
  });
})();
