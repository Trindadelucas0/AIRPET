(function () {
  'use strict';

  var TOTAL = 6;
  var DRAFT_KEY = 'airpet:waitlist:draft';
  var root = document.getElementById('listaEsperaWizard');
  if (!root) return;

  var autoAdvance = root.getAttribute('data-autoadvance') === 'true';
  var referralOrigem = String(root.getAttribute('data-referral') || '').trim().slice(0, 32);

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
  var progressWrap = document.getElementById('leProgressBarWrap');
  var liveRegion = document.getElementById('leLiveRegion');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fa(name, label) {
    if (window.FunilAnalytics && typeof window.FunilAnalytics.wizardStepView === 'function') {
      window.FunilAnalytics.wizardStepView(name, label);
    }
  }

  function announce(msg) {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    setTimeout(function () {
      liveRegion.textContent = msg || '';
    }, 50);
  }

  function loadDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      state.step = Math.min(TOTAL, Math.max(1, parseInt(d.step, 10) || 1));
      state.nome = d.nome || '';
      state.email = d.email || '';
      state.telefone = d.telefone || '';
      state.cidade = d.cidade || '';
      state.estado = d.estado || '';
      if (d.respostas && typeof d.respostas === 'object') {
        state.respostas = Object.assign(state.respostas, d.respostas);
      }
    } catch (e) {
      /* ignore */
    }
  }

  function saveDraft() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          step: state.step,
          nome: state.nome,
          email: state.email,
          telefone: state.telefone,
          cidade: state.cidade,
          estado: state.estado,
          respostas: state.respostas,
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function applyDraftToDom() {
    var nomeEl = document.getElementById('leNome');
    var emailEl = document.getElementById('leEmail');
    var telEl = document.getElementById('leTelefone');
    var cidadeEl = document.getElementById('leCidade');
    var estadoEl = document.getElementById('leEstado');
    if (nomeEl) nomeEl.value = state.nome;
    if (emailEl) emailEl.value = state.email;
    if (telEl) telEl.value = state.telefone;
    if (cidadeEl) cidadeEl.value = state.cidade;
    if (estadoEl) estadoEl.value = state.estado;

    Object.keys(state.respostas).forEach(function (key) {
      var val = state.respostas[key];
      if (key === 'metodos_busca' || key === 'prioridades') {
        if (!Array.isArray(val)) return;
        val.forEach(function (v) {
          var inp = root.querySelector('.le-check-input[value="' + v + '"]');
          if (inp) inp.checked = true;
        });
        return;
      }
      if (!val) return;
      var btn = root.querySelector('[data-single="' + key + '"] [data-value="' + val + '"]');
      if (btn) {
        btn.classList.add('le-selected');
        btn.setAttribute('aria-pressed', 'true');
      }
    });
  }

  loadDraft();
  applyDraftToDom();
  updatePrioridadesUi();

  function steps() {
    return root.querySelectorAll('.le-step');
  }

  function stepLabelFor(n) {
    var sec = root.querySelector('.le-step[data-step="' + n + '"]');
    return sec ? sec.getAttribute('data-step-label') || '' : '';
  }

  function updateProgress() {
    var pct = Math.round((state.step / TOTAL) * 100);
    var label = stepLabelFor(state.step);
    if (progressLabel) {
      progressLabel.textContent = 'Passo ' + state.step + ' de ' + TOTAL + ' — ' + label;
    }
    if (progressPct) progressPct.textContent = pct + '%';
    if (progressBar) progressBar.style.width = pct + '%';
    if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(state.step));
    announce('Passo ' + state.step + ' de ' + TOTAL + (label ? ' — ' + label : ''));
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
      saveDraft();
      fa(next, stepLabelFor(next));
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
      saveDraft();
      fa(next, stepLabelFor(next));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 280);
  }

  function showErr(step, msg) {
    var el = document.getElementById('errStep' + step);
    if (!el) return;
    if (msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
      announce(msg);
      if (window.FunilAnalytics && window.FunilAnalytics.wizardSubmitErr) {
        window.FunilAnalytics.wizardSubmitErr(msg);
      }
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
        showErr(1, 'Como a gente te chama? Preenche seu nome.');
        return false;
      }
      if (!state.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
        showErr(1, 'Precisamos de um e-mail válido pra te avisar.');
        return false;
      }
    }
    if (n === 2) {
      if (!state.respostas.tipo_pet) {
        showErr(2, 'Escolhe se é cachorro, gato ou outro — a gente quer saber.');
        return false;
      }
      if (!state.respostas.qtd_pets) {
        showErr(2, 'Quantos pets moram com você? Marca uma opção.');
        return false;
      }
    }
    if (n === 3 && !state.respostas.ja_perdeu_pet) {
      showErr(3, 'Marca uma das três opções — ajuda a gente a te ouvir melhor.');
      return false;
    }
    if (n === 4 && (!state.respostas.metodos_busca || !state.respostas.metodos_busca.length)) {
      showErr(4, 'Marca pelo menos um jeito que você usaria de verdade.');
      return false;
    }
    if (n === 5 && (!state.respostas.prioridades || !state.respostas.prioridades.length)) {
      showErr(5, 'Escolhe pelo menos uma coisa que faria diferença pra você.');
      return false;
    }
    if (n === 6 && !state.respostas.beta_interesse) {
      showErr(6, 'Marca se quer ser avisado cedo quando chegar na sua região.');
      return false;
    }
    return true;
  }

  function postListaEspera(payload) {
    return fetch('/api/lista-espera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    });
  }

  function savePartialAfterStep1() {
    if (!state.nome || !state.email) return;
    var payload = {
      nome: state.nome,
      email: state.email,
      origem: 'lista-espera-wizard',
      wizard_completo: false,
      respostas: state.respostas,
      user_agent: navigator.userAgent,
      website: document.getElementById('leWebsite') ? document.getElementById('leWebsite').value : '',
    };
    if (referralOrigem) payload.referral_origem = referralOrigem;
    postListaEspera(payload).then(function (result) {
      if (result.ok && result.data && result.data.success) {
        if (window.FunilAnalytics && window.FunilAnalytics.wizardPartialLead) {
          window.FunilAnalytics.wizardPartialLead();
        }
      }
    });
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
        var stepNum = parseInt(groupEl.closest('.le-step').getAttribute('data-step'), 10);
        showErr(stepNum, '');
        saveDraft();
        if (autoAdvance && key !== 'beta_interesse' && stepNum !== 2) {
          setTimeout(function () {
            if (validateStep(stepNum)) {
              if (window.FunilAnalytics && window.FunilAnalytics.wizardStepComplete) {
                window.FunilAnalytics.wizardStepComplete(stepNum);
              }
              showStep(stepNum + 1);
            }
          }, 260);
        }
      });
    });
  }

  function updatePrioridadesUi() {
    var group = root.querySelector('[data-multi="prioridades"]');
    if (!group) return;
    var list = state.respostas.prioridades || [];
    var atMax = list.length >= 2;
    group.querySelectorAll('.le-prio').forEach(function (label) {
      var inp = label.querySelector('.le-check-input');
      if (!inp) return;
      if (atMax && !inp.checked) {
        label.classList.add('le-option-disabled');
      } else {
        label.classList.remove('le-option-disabled');
      }
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
              showErr(5, 'No máximo duas — escolhe as que mais pesam no seu coração.');
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
        if (key === 'prioridades') {
          showErr(5, '');
          updatePrioridadesUi();
        } else {
          showErr(4, '');
        }
        saveDraft();
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
      if (state.step === 1) {
        savePartialAfterStep1();
      }
      if (window.FunilAnalytics && window.FunilAnalytics.wizardStepComplete) {
        window.FunilAnalytics.wizardStepComplete(state.step);
      }
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
      if (referralOrigem) payload.referral_origem = referralOrigem;

      setLoading(true);
      showErr(6, '');

      postListaEspera(payload)
        .then(function (result) {
          if (result.ok && result.data && result.data.success) {
            clearDraft();
            if (window.FunilAnalytics && window.FunilAnalytics.wizardSubmitOk) {
              window.FunilAnalytics.wizardSubmitOk();
            }
            window.location.href = '/obrigado';
            return;
          }
          var msg =
            (result.data && (result.data.error || result.data.mensagem)) ||
            'Não rolou dessa vez — tenta de novo daqui a pouco.';
          showErr(6, msg);
        })
        .catch(function () {
          showErr(6, 'Falhou a conexão. Confere a internet e tenta de novo.');
        })
        .finally(function () {
          setLoading(false);
        });
    });
  }

  if (state.step > 1) {
    var target = state.step;
    var all = steps();
    all.forEach(function (sec) {
      sec.classList.add('hidden');
    });
    var cur = root.querySelector('.le-step[data-step="' + target + '"]');
    if (cur) cur.classList.remove('hidden');
    state.step = target;
  }
  updateProgress();
  if (window.FunilAnalytics && typeof window.FunilAnalytics.wizardStepView === 'function') {
    window.FunilAnalytics.wizardStepView(state.step, stepLabelFor(state.step));
  }
})();
