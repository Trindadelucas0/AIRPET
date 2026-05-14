/**
 * post-modal.js — Bridge entre o grid de posts (estilo Instagram) e o
 * modal de detalhe do post (partial `post-detail-modal`).
 *
 * Responsabilidades:
 *   - Captura clique em qualquer `.pp-grid__cell[data-post-id]`.
 *   - Reaproveita `window.AIRPET_openPostDetailFromArticle` exposto por
 *     `airpet-post-detail-organic.js` (UI completa de detalhe).
 *   - pushState com `/p/:slug/post/:id` para link compartilhavel.
 *   - Navegacao por setas <- e -> entre posts do mesmo grid.
 *   - ESC fecha o modal (delegado para o modal subjacente).
 *   - popstate (back) fecha o modal sem sair do perfil.
 *
 * Compativel com qualquer pagina que inclua o partial
 * `partials/post-detail-modal` e o script `airpet-post-detail-organic.js`.
 */
(function () {
  'use strict';

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /*
   * Coleta TODAS as celulas com modal em qualquer parte da pagina,
   * incluindo o grid principal (#petPostsGrid) e grids do perfil do tutor
   * (vários tutorPostsGrid_<petId>). A navegacao por setas segue a ordem
   * em que aparecem no DOM.
   */
  function gridCells() {
    return $$('.pp-grid__cell[data-post-id][data-explorar-meta]');
  }

  function gridSlug() {
    var grid = document.getElementById('petPostsGrid');
    if (grid) return grid.getAttribute('data-pet-slug') || '';
    // Fallback: pegar do cell ativo, se houver.
    var ativo = document.querySelector('.pp-grid__cell[data-pp-current="1"]');
    return ativo ? (ativo.getAttribute('data-pet-slug') || '') : '';
  }

  function abrirArticleVirtual(metaJson) {
    if (typeof window.AIRPET_openPostDetailFromArticle !== 'function') return false;
    var article = document.createElement('article');
    article.setAttribute('data-explorar-meta', metaJson);
    article.setAttribute('data-post-modal-virtual', '1');
    window.AIRPET_openPostDetailFromArticle(article);
    return true;
  }

  function pushHistoria(postId, cell) {
    var slug = '';
    if (cell && cell.getAttribute) slug = cell.getAttribute('data-pet-slug') || '';
    if (!slug) slug = gridSlug();
    if (!slug || !postId) return;
    try {
      history.pushState({ ppPostModal: true, postId: postId, slug: slug },
                        '',
                        '/p/' + slug + '/post/' + postId);
    } catch (_) {
      // ignore
    }
  }

  function fecharModalSafe() {
    try {
      if (typeof window.AIRPET_requestClosePostDetailOrganic === 'function') {
        window.AIRPET_requestClosePostDetailOrganic();
      } else if (typeof window.AIRPET_fecharPostDetailModal === 'function') {
        window.AIRPET_fecharPostDetailModal();
      }
    } catch (_) {}
  }

  function abrirPorIdComHistoria(postId, opts) {
    var cells = gridCells();
    var cell = null;
    for (var i = 0; i < cells.length; i += 1) {
      if (String(cells[i].getAttribute('data-post-id')) === String(postId)) {
        cell = cells[i];
        break;
      }
    }
    if (!cell) return false;
    var meta = cell.getAttribute('data-explorar-meta');
    if (!meta) return false;
    var ok = abrirArticleVirtual(meta);
    if (!ok) return false;
    cell.setAttribute('data-pp-current', '1');
    cells.forEach(function (c) { if (c !== cell) c.removeAttribute('data-pp-current'); });
    if (!(opts && opts.skipHistory)) pushHistoria(postId, cell);
    return true;
  }

  function navegarRelativo(delta) {
    var cells = gridCells();
    if (!cells.length) return;
    var idxAtual = -1;
    for (var i = 0; i < cells.length; i += 1) {
      if (cells[i].getAttribute('data-pp-current') === '1') { idxAtual = i; break; }
    }
    if (idxAtual < 0) return;
    var next = idxAtual + delta;
    if (next < 0 || next >= cells.length) return;
    var postId = cells[next].getAttribute('data-post-id');
    abrirPorIdComHistoria(postId);
  }

  function onKeydownGlobal(e) {
    var modal = document.getElementById('postDetailModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); navegarRelativo(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navegarRelativo(-1); }
  }

  function onClickGridDelegado(e) {
    var cell = e.target.closest('.pp-grid__cell[data-post-id]');
    if (!cell) return;
    e.preventDefault();
    var postId = cell.getAttribute('data-post-id');
    abrirPorIdComHistoria(postId);
  }

  function onPopState(e) {
    var modal = document.getElementById('postDetailModal');
    var aberto = modal && !modal.classList.contains('hidden');
    var state = e && e.state ? e.state : null;
    if (aberto && !(state && state.ppPostModal)) {
      // Saiu do estado de modal — fechar overlay mas permanecer no perfil.
      fecharModalSafe();
    } else if (!aberto && state && state.ppPostModal && state.postId) {
      // Voltou para um state com modal aberto — reabrir.
      abrirPorIdComHistoria(state.postId, { skipHistory: true });
    }
  }

  function init() {
    // Delegacao em document para suportar qualquer grid (.pp-grid__cell).
    document.addEventListener('click', onClickGridDelegado);
    document.addEventListener('keydown', onKeydownGlobal, true);
    window.addEventListener('popstate', onPopState);

    // Se a URL atual ja for /p/:slug/post/:id, abrir o modal automaticamente
    // depois do AIRPET_openPostDetailFromArticle estar disponivel.
    var path = window.location.pathname || '';
    var match = path.match(/^\/p\/[^/]+\/post\/(\d+)$/);
    if (match) {
      var pid = match[1];
      var trySoon = function (tentativas) {
        if (typeof window.AIRPET_openPostDetailFromArticle !== 'function') {
          if (tentativas > 0) setTimeout(function () { trySoon(tentativas - 1); }, 80);
          return;
        }
        abrirPorIdComHistoria(pid, { skipHistory: true });
      };
      trySoon(10);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
