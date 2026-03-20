(function () {
  'use strict';

  var socket = io('/admin');
  var listEl = document.getElementById('mensagensList');
  var countBadge = document.getElementById('pendingCount');
  var emptyState = document.getElementById('emptyState');
  var pendingIds = Object.create(null);

  function updateCount(delta) {
    if (!countBadge) return;
    var current = parseInt(countBadge.textContent, 10) || 0;
    var next = Math.max(0, current + delta);
    countBadge.textContent = next;

    if (emptyState) {
      emptyState.style.display = next === 0 ? '' : 'none';
    }
  }

  // --- Receive new pending messages ---
  socket.on('nova_mensagem_pendente', function (msg) {
    if (!listEl) return;

    if (emptyState) emptyState.style.display = 'none';

    var card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-sm border border-gray-100 p-5 msg-card';
    card.setAttribute('data-id', msg.id);

    var tipoClass = msg.tipo === 'foto'
      ? 'bg-blue-100 text-blue-600'
      : 'bg-gray-100 text-gray-500';

    var conteudoHtml = '';
    if (msg.tipo === 'foto' && (msg.foto_url || msg.conteudo)) {
      var imgSrc = msg.foto_url || msg.conteudo;
      imgSrc = imgSrc.indexOf('/') === 0 ? imgSrc : '/images/chat/' + imgSrc;
      conteudoHtml = '<div class="mb-3"><img src="' + escapeHtml(imgSrc) + '" alt="Foto" class="max-h-40 rounded-lg border border-gray-200"></div>';
    } else {
      conteudoHtml = '<p class="text-sm text-gray-800 bg-gray-50 rounded-lg px-4 py-3 mb-3">' + escapeHtml(msg.conteudo) + '</p>';
    }

    card.innerHTML =
      '<div class="flex items-start justify-between gap-4">' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-3 mb-2">' +
            '<span class="text-xs font-mono text-gray-400">Conversa #' + msg.conversa_id + '</span>' +
            '<span class="text-xs text-gray-300">|</span>' +
            '<span class="text-sm font-medium text-gray-700">' + escapeHtml(msg.remetente_nome || 'Usuário') + '</span>' +
            '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ' + tipoClass + '">' + (msg.tipo || 'texto') + '</span>' +
          '</div>' +
          conteudoHtml +
          '<p class="text-xs text-gray-400">' + new Date().toLocaleString('pt-BR') + '</p>' +
        '</div>' +
        '<div class="flex flex-col gap-2 flex-shrink-0">' +
          '<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors btn-aprovar" data-id="' + msg.id + '">' +
            '<i class="fa-solid fa-check"></i> Aprovar</button>' +
          '<button class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors btn-rejeitar" data-id="' + msg.id + '">' +
            '<i class="fa-solid fa-xmark"></i> Rejeitar</button>' +
        '</div>' +
      '</div>';

    listEl.prepend(card);
    updateCount(1);

    bindCardButtons(card);
  });

  // --- Bind approve/reject buttons ---
  function bindCardButtons(card) {
    var btnAprovar = card.querySelector('.btn-aprovar');
    var btnRejeitar = card.querySelector('.btn-rejeitar');

    if (btnAprovar) {
      btnAprovar.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        if (pendingIds[id]) return;
        pendingIds[id] = true;
        socket.emit('moderar_mensagem', { id: id, acao: 'aprovar' });
        this.disabled = true;
      });
    }

    if (btnRejeitar) {
      btnRejeitar.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        if (pendingIds[id]) return;
        pendingIds[id] = true;
        socket.emit('moderar_mensagem', { id: id, acao: 'rejeitar' });
        this.disabled = true;
      });
    }
  }

  // --- Remove card from DOM ---
  function removeCard(id) {
    var card = document.querySelector('.msg-card[data-id="' + id + '"]');
    if (card) {
      card.classList.add('fade-out');
      setTimeout(function () { card.remove(); }, 400);
    }
    updateCount(-1);
  }

  // --- Confirmation from server ---
  socket.on('mensagem_moderada', function (data) {
    if (data && data.id) delete pendingIds[data.id];
    removeCard(data.id);
  });

  socket.on('erro', function (payload) {
    var msg = payload && payload.mensagem ? payload.mensagem : 'Nao foi possivel moderar a mensagem.';
    alert(msg);
    pendingIds = Object.create(null);
    var buttons = document.querySelectorAll('.btn-aprovar, .btn-rejeitar');
    buttons.forEach(function (btn) { btn.disabled = false; });
  });

  // --- Bind existing cards ---
  var existingCards = document.querySelectorAll('.msg-card');
  existingCards.forEach(function (card) {
    var id = card.getAttribute('data-id');

    var btnAprovar = card.querySelector('.btn-aprovar');
    var btnRejeitar = card.querySelector('.btn-rejeitar');

    if (btnAprovar && !btnAprovar.getAttribute('data-id')) {
      btnAprovar.setAttribute('data-id', id);
    }
    if (btnRejeitar && !btnRejeitar.getAttribute('data-id')) {
      btnRejeitar.setAttribute('data-id', id);
    }

    bindCardButtons(card);
  });

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
