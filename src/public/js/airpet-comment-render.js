/**
 * Renderização consistente de comentários (Explorar, Feed, perfis)
 */
(function () {
  'use strict';

  function defaultEscapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function defaultRenderMencoes(texto) {
    var esc = defaultEscapeHtml(texto);
    return esc.replace(/@(\S+)/g, '<span class="mention" data-user="$1">@$1</span>');
  }

  function defaultTempoRelativo(dateStr) {
    if (!dateStr) return '';
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return 'há ' + Math.floor(diff / 60) + 'm';
    if (diff < 86400) return 'há ' + Math.floor(diff / 3600) + 'h';
    if (diff < 604800) return 'há ' + Math.floor(diff / 86400) + 'd';
    var d = new Date(dateStr);
    var meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return d.getDate() + ' ' + meses[d.getMonth()];
  }

  /**
   * @param {object} c - comentário da API
   * @param {object} opts
   * @param {number|null} opts.meuId
   * @param {function} [opts.escapeHtml]
   * @param {function} [opts.renderMencoes]
   * @param {function} [opts.tempoRelativo]
   * @param {boolean} [opts.useDataTimeAttr] - se true, data-time no span para atualizar depois
   * @param {string} [opts.deleteDataAttr='data-comment-id'] - atributo no botão apagar
   */
  function renderComentario(c, opts) {
    opts = opts || {};
    var meuId = opts.meuId != null ? opts.meuId : null;
    var escapeHtml = opts.escapeHtml || defaultEscapeHtml;
    var renderMencoes = opts.renderMencoes || defaultRenderMencoes;
    var tempoRelativo = opts.tempoRelativo || defaultTempoRelativo;
    var useDataTime = opts.useDataTimeAttr === true;
    var delAttr = opts.deleteDataAttr || 'data-comment-id';

    var cCor = c.cor_perfil || '#ec5a1c';
    var nome = c.nome || c.autor_nome || 'Usuário';
    var uid = c.usuario_id;
    var avatar;
    if (c.foto_perfil) {
      avatar =
        '<img src="' +
        escapeHtml(c.foto_perfil) +
        '" class="w-9 h-9 rounded-full object-cover airpet-comment-row__avatar" style="box-shadow:0 0 0 2px ' +
        escapeHtml(cCor) +
        '" alt="">';
    } else {
      avatar =
        '<span class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white airpet-comment-row__avatar bg-gray-400" style="box-shadow:0 0 0 2px ' +
        escapeHtml(cCor) +
        '">' +
        escapeHtml((nome || 'U').charAt(0).toUpperCase()) +
        '</span>';
    }

    var podeApagar = meuId != null && c.usuario_id === meuId && c.publicacao_id != null;
    if (opts.forceDeleteButton === true) {
      podeApagar = meuId != null && c.usuario_id === meuId;
    }

    var timeInner = useDataTime
      ? '<span class="airpet-comment-row__time tempo-relativo" data-time="' + escapeHtml(c.criado_em || '') + '">' + escapeHtml(tempoRelativo(c.criado_em)) + '</span>'
      : '<span class="airpet-comment-row__time">' + escapeHtml(tempoRelativo(c.criado_em)) + '</span>';

    var delBtn = '';
    if (podeApagar) {
      var did = c.id;
      delBtn =
        '<button type="button" class="shrink-0 p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity btn-del-comment" ' +
        delAttr +
        '="' +
        escapeHtml(String(did)) +
        '" aria-label="Excluir comentário"><i class="fa-solid fa-trash-can text-xs"></i></button>';
    }

    return (
      '<article class="airpet-comment-row group" data-comment-id="' +
      escapeHtml(String(c.id)) +
      '">' +
      '<a href="/explorar/perfil/' +
      escapeHtml(String(uid)) +
      '" class="airpet-comment-row__avatar shrink-0">' +
      avatar +
      '</a>' +
      '<div class="airpet-comment-row__body">' +
      '<div class="airpet-comment-row__meta">' +
      '<a href="/explorar/perfil/' +
      escapeHtml(String(uid)) +
      '" class="airpet-comment-row__name">' +
      escapeHtml(nome) +
      '</a>' +
      timeInner +
      '</div>' +
      '<p class="airpet-comment-row__text">' +
      renderMencoes(c.texto || '') +
      '</p>' +
      '</div>' +
      delBtn +
      '</article>'
    );
  }

  function renderList(comentarios, opts) {
    if (!comentarios || !comentarios.length) return '';
    var html = '<div class="airpet-modal__comments-stack">';
    for (var i = 0; i < comentarios.length; i++) {
      html += renderComentario(comentarios[i], opts);
    }
    html += '</div>';
    return html;
  }

  window.AIRPET_commentRender = {
    renderComentario: renderComentario,
    renderList: renderList,
    escapeHtml: defaultEscapeHtml,
    renderMencoes: defaultRenderMencoes,
    tempoRelativo: defaultTempoRelativo
  };
})();
