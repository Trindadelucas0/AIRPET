(function () {
  'use strict';

  var TOTAL = 6;
  var root = document.getElementById('listaEsperaWizard');
  if (!root) return;

  var state = {
    step: 1,
    nome: '',
    email: '',
    telefone: '',
    cidade: '',
    estado: '',
    respostas: {
      tipo_pet: '',
      qtd_pets: '',
      ja_perdeu_pet: '',
      metodos_busca: [],
      prioridades: [],
      beta_interesse: '',
    },
  };

  var progressLabel = document.getElementById('leProgressLabel');
  var progressPct = document.getElementById('leProgressPct');
  var progressBar = document.getElementById('leProgressBar');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function steps() {
    return root.querySelectorAll('.le-step');
  }

  function currentSection() {
    return root.querySelector('.le-step[data-step="' + state.step + '"]');
  }

  function updateProgress() {
    var pct = Math.round((state.step / TOTAL) * 100);
    if (progressLabel) progressLabel.textContent = 'Passo ' + state.step + ' de ' + TOTAL;
    if (progressPct) progressPct.textContent = pct + '%';
    if (progressBar) progressBar.style.width = pct + '%';
  }

  function showStep(next) {
    var prev = state.step;
    if (next < 1 || next > TOTAL || next === prev) return;

    var sections = steps();
    var fromEl = root.querySelector('.le-step[data-step="' + prev + '"]');
    var toEl = root.querySelector('.le-step[data-step="' + next + '"]');
    if (!toEl) return;

    function apply() {
      sections.forEach(function (sec) {
        sec.classList.add('hidden');
        sec.classList.remove('le-enter', 'le-exit');
      });
      toEl.classList.remove('hidden');
      state.step = next;
      updateProgress();
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    if (reducedMotion || !fromEl) {
      apply();
      return;
    }

    fromEl.classList.add('le-exit');
    setTimeout(function () {
      fromEl.classList.add('hidden');
      fromEl.classList.remove('le-exit');
      toEl.classList.remove('hidden');
      toEl.classList.add('le-enter');
      requestAnimationFrame(function () {
        toEl.classList.remove('le-enter');
      });
      state.step = next;
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 280);
  }

  function showErr(step, msg) {
    var el = document.getElementById('errStep' + step);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function syncFields() {
    var nomeEl = document.getElementById('leNome');
    var emailEl = document.getElementById('leEmail');
    var telEl = document.getElementById('leTelefone');
    var cidadeEl = document.getElementById('leCidade');
    var estadoEl = document.getElementById('leEstado');
    if (nomeEl) state.nome = nomeEl.value.trim();
    if (emailEl) state.email = emailEl.value.trim();
    if (telEl) state.telefone = telEl.value.trim();
    if (cidadeEl) state.cidade = cidadeEl.value.trim();
    if (estadoEl) state.estado = estadoEl.value.trim().toUpperCase().slice(0, 2);
  }

  function validateStep(n) {
    syncFields();
    showErr(n, '');

    if (n === 1) {
      if (!state.nome) {
        showErr(1, 'Informe seu nome.');
        return false;
      }
      if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        showErr(1, 'Informe um e-mail válido.');
        return false;
      }
    }
    if (n === 2) {
      if (!state.respostas.tipo_pet) {
        showErr(2, 'Escolha o tipo de pet.');
        return false;
      }
      if (!state.respostas.qtd_pets) {
        showErr(2, 'Quantos pets você tem?');
        return false;
      }
    }
    if (n === 3 && !state.respostas.ja_perdeu_pet) {
      showErr(3, 'Escolha uma opção.');
      return false;
    }
    if (n === 4 && (!state.respostas.metodos_busca || !state.respostas.metodos_busca.length)) {
      showErr(4, 'Marque pelo menos uma opção.');
      return false;
    }
    if (n === 5 && (!state.respostas.prioridades || !state.respostas.prioridades.length)) {
      showErr(5, 'Escolha pelo menos uma prioridade.');
      return false;
    }
    if (n === 6 && !state.respostas.beta_interesse) {
      showErr(6, 'Escolha uma opção sobre as vagas do AIRPET.');
      return false;
    }
    return true;
  }

  function bindSingle(groupEl, key) {
    if (!groupEl) return;
    var buttons = groupEl.querySelectorAll('[data-value]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) {
          b.classList.remove('le-selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('le-selected');
        btn.setAttribute('aria-pressed', 'true');
        state.respostas[key] = btn.getAttribute('data-value');
        showErr(parseInt(groupEl.closest('.le-step').getAttribute('data-step'), 10), '');
      });
    });
  }

  function bindMulti(groupEl, key, max) {
    if (!groupEl) return;
    var inputs = groupEl.querySelectorAll('.le-check-input');
    inputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var list = state.respostas[key] || [];
        var val = input.value;
        if (input.checked) {
          if (max && list.length >= max) {
            input.checked = false;
            if (key === 'prioridades') {
              showErr(5, 'Escolha só 2 — precisamos da sua prioridade real.');
            }
            return;
          }
          if (list.indexOf(val) === -1) list.push(val);
        } else {
          list = list.filter(function (v) {
            return v !== val;
          });
        }
        state.respostas[key] = list;
        if (key === 'prioridades') showErr(5, '');
        else showErr(4, '');
      });
    });
  }

  bindSingle(root.querySelector('[data-single="tipo_pet"]'), 'tipo_pet');
  bindSingle(root.querySelector('[data-single="qtd_pets"]'), 'qtd_pets');
  bindSingle(root.querySelector('[data-single="ja_perdeu_pet"]'), 'ja_perdeu_pet');
  bindSingle(root.querySelector('[data-single="beta_interesse"]'), 'beta_interesse');
  bindMulti(root.querySelector('[data-multi="metodos_busca"]'), 'metodos_busca', 0);
  bindMulti(root.querySelector('[data-multi="prioridades"]'), 'prioridades', 2);

  root.querySelectorAll('.le-next').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!validateStep(state.step)) return;
      showStep(state.step + 1);
    });
  });

  root.querySelectorAll('.le-prev').forEach(function (btn) {
    btn.addEventListener('click', function () {
      syncFields();
      showErr(state.step, '');
      showStep(state.step - 1);
    });
  });

  var submitBtn = document.getElementById('leSubmit');
  var submitSpinner = document.getElementById('leSubmitSpinner');

  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled = on;
    if (submitSpinner) submitSpinner.classList.toggle('hidden', !on);
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', function () {
      if (!validateStep(6)) return;

      var website = document.getElementById('leWebsite');
      var payload = {
        nome: state.nome,
        email: state.email,
        telefone: state.telefone || undefined,
        cidade: state.cidade || undefined,
        estado: state.estado || undefined,
        origem: 'lista-espera-wizard',
        wizard_completo: true,
        respostas: state.respostas,
        user_agent: navigator.userAgent,
        website: website ? website.value : '',
      };

      setLoading(true);
      showErr(6, '');

      fetch('/api/lista-espera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data && result.data.success) {
            window.location.href = '/obrigado';
            return;
          }
          var msg =
            (result.data && (result.data.error || result.data.mensagem)) ||
            'Algo deu errado — tente de novo';
          showErr(6, msg);
        })
        .catch(function () {
          showErr(6, 'Algo deu errado — tente de novo');
        })
        .finally(function () {
          setLoading(false);
        });
    });
  }

  updateProgress();
})();
