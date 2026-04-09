(function () {
  'use strict';

  var store = window.AIRPET_TAG_LOJA || {};
  var pets = Array.isArray(store.pets) ? store.pets : [];
  var qtdInput = document.getElementById('quantidade_tags');
  var orderTypeSelect = document.getElementById('order_type');
  var selectorsRoot = document.getElementById('pet-selectors');
  var form = document.getElementById('form-tag-order');
  var submitBtn = document.getElementById('submit-order-btn');
  var submitLabel = document.getElementById('submit-order-label');

  if (!qtdInput || !orderTypeSelect || !selectorsRoot) return;

  function buildOption(pet, selectedId) {
    var selectedAttr = Number(selectedId) === Number(pet.id) ? 'selected' : '';
    return '<option value="' + pet.id + '" ' + selectedAttr + '>' + pet.nome + '</option>';
  }

  function renderSelectors() {
    var isAssinatura = orderTypeSelect.value === 'assinatura_recorrente';
    var qtd = isAssinatura ? 0 : Math.min(10, Math.max(1, Number(qtdInput.value || 1)));
    qtdInput.disabled = isAssinatura;
    if (isAssinatura) qtdInput.value = 1;

    var selected = Array.from(selectorsRoot.querySelectorAll('select[name="pet_ids"]')).map(function (el) {
      return el.value;
    });

    if (!pets.length && !isAssinatura) {
      selectorsRoot.innerHTML = '<p class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">Voce precisa cadastrar ao menos 1 pet para continuar.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < qtd; i += 1) {
      var options = pets.map(function (pet) { return buildOption(pet, selected[i]); }).join('');
      html += '<label class="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">' +
        '<span class="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Tag #' + (i + 1) + '</span>' +
        '<select name="pet_ids" required class="tc-select">' + options + '</select>' +
        '</label>';
    }

    if (isAssinatura) {
      html = '<p class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Renovacao sem compra de hardware. Nenhum pet precisa ser selecionado.</p>';
    }

    selectorsRoot.innerHTML = html;
  }

  if (form && submitBtn && submitLabel) {
    form.addEventListener('submit', function () {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-70', 'cursor-not-allowed');
      submitLabel.textContent = 'Redirecionando...';
    });
  }

  qtdInput.addEventListener('change', renderSelectors);
  orderTypeSelect.addEventListener('change', renderSelectors);
  renderSelectors();
})();
