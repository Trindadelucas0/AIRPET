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
    if (typeof window !== 'undefined' && window.AIRPET_socialTextoLinkify && typeof window.AIRPET_socialTextoLinkify.linkifyHashtagsInEscaped === 'function') {
      esc = window.AIRPET_socialTextoLinkify.linkifyHashtagsInEscaped(esc);
    }
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

  function buildTreeFromFlat(rows) {
    if (!rows || !rows.length) return [];
    var byId = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      byId[r.id] = Object.assign({}, r, { respostas: [] });
    }
    var roots = [];
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      var node = byId[row.id];
      var pid = row.parent_id;
      if (pid != null && byId[pid]) {
        byId[pid].respostas.push(node);
      } else {
        roots.push(node);
      }
    }
    function sortRec(n) {
      n.respostas.sort(function (a, b) {
        return new Date(a.criado_em) - new Date(b.criado_em);
      });
      for (var k = 0; k < n.respostas.length; k++) sortRec(n.respostas[k]);
    }
    roots.sort(function (a, b) {
      return new Date(a.criado_em) - new Date(b.criado_em);
    });
    for (var m = 0; m < roots.length; m++) sortRec(roots[m]);
    return roots;
  }

  function renderThread(nodes, opts, depth) {
    var html = '';
    for (var i = 0; i < nodes.length; i++) {
      var c = nodes[i];
      var ml = '';
      if (depth > 0) {
        ml =
          'margin-left:' +
          Math.min(depth * 14, 56) +
          'px;padding-left:10px;border-left:2px solid #e5e7eb';
      }
      html +=
        '<div class="airpet-comment-thread-branch"' +
        (ml ? ' style="' + ml + '"' : '') +
        '>';
      html += renderComentario(c, opts);
      if (c.respostas && c.respostas.length) {
        html += renderThread(c.respostas, opts, depth + 1);
      }
      html += '</div>';
    }
    return html;
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
   * @param {boolean} [opts.allowReply] - botão Responder (comentários orgânicos)
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

    var replyBtn = '';
    if (opts.allowReply === true && meuId != null && c.publicacao_id != null) {
      replyBtn =
        '<button type="button" class="mt-0.5 text-xs font-semibold text-gray-500 hover:text-primary-600 btn-reply-comment" data-comment-id="' +
        escapeHtml(String(c.id)) +
        '" data-author-name="' +
        escapeHtml(nome) +
        '">Responder</button>';
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
      replyBtn +
      '</div>' +
      delBtn +
      '</article>'
    );
  }

  function renderList(comentarios, opts) {
    if (!comentarios || !comentarios.length) return '';
    opts = opts || {};
    var tree = comentarios;
    if (!Object.prototype.hasOwnProperty.call(comentarios[0], 'respostas')) {
      tree = buildTreeFromFlat(comentarios);
    }
    var html = '<div class="airpet-modal__comments-stack">';
    html += renderThread(tree, opts, 0);
    html += '</div>';
    return html;
  }

  window.AIRPET_commentRender = {
    renderComentario: renderComentario,
    renderList: renderList,
    renderThread: renderThread,
    buildTreeFromFlat: buildTreeFromFlat,
    escapeHtml: defaultEscapeHtml,
    renderMencoes: defaultRenderMencoes,
    tempoRelativo: defaultTempoRelativo
  };
})();
