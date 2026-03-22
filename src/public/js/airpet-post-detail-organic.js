/**
 * Modal de detalhe de post (organic) para páginas que não carregam o script completo do Explorar.
 * Espera #postDetailModal (partial post-detail-modal) e articles com data-explorar-meta.
 */
(function () {
  'use strict';

  var meuId = null;
  var rawUid = document.body && document.body.getAttribute('data-usuario-id');
  if (rawUid && String(rawUid).trim() !== '') {
    var n = parseInt(rawUid, 10);
    meuId = Number.isFinite(n) ? n : null;
  }

  var postDetailCommentPostId = null;

  function tempoRelativo(dateStr) {
    var d = new Date(dateStr);
    var diff = Date.now() - d.getTime();
    if (diff < 0) return 'agora';
    var seg = Math.floor(diff / 1000);
    if (seg < 60) return 'agora';
    var min = Math.floor(seg / 60);
    if (min < 60) return min + 'min';
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + 'h';
    var dias = Math.floor(hrs / 24);
    if (dias < 7) return dias + 'd';
    return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderMencoes(texto) {
    return escapeHtml(texto).replace(/@(\S+)/g, '<span class="mention" data-user="$1">@$1</span>');
  }

  function carregarComentariosPostDetail(postId) {
    var list = document.getElementById('postDetailCommentList');
    if (!list) return;
    list.innerHTML = '<div class="text-center py-6 text-sm text-gray-400">Carregando…</div>';
    fetch('/explorar/post/' + postId + '/comentarios', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.sucesso || !data.comentarios || !data.comentarios.length) {
          list.innerHTML = '<div class="text-center py-8 text-sm text-gray-400">Nenhum comentário ainda.</div>';
          return;
        }
        if (window.AIRPET_commentRender && window.AIRPET_commentRender.renderList) {
          list.innerHTML = window.AIRPET_commentRender.renderList(data.comentarios, {
            meuId: meuId,
            escapeHtml: escapeHtml,
            renderMencoes: renderMencoes,
            tempoRelativo: tempoRelativo,
            useDataTimeAttr: true,
          });
        }
      })
      .catch(function () {
        list.innerHTML = '<div class="text-center py-8 text-sm text-red-400">Erro ao carregar.</div>';
      });
  }

  function fecharPostDetailOwnerDropdown() {
    var dd = document.getElementById('postDetailOwnerDropdown');
    var btn = document.getElementById('btnPostDetailOwnerMenu');
    if (dd) dd.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function fecharPostDetailModal() {
    var el = document.getElementById('postDetailModal');
    if (!el) return;
    fecharPostDetailOwnerDropdown();
    el.classList.remove('is-open');
    setTimeout(function () {
      if (!el.classList.contains('is-open')) {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        if (window.AIRPET_modalUi) window.AIRPET_modalUi.refreshBodyScroll();
      }
    }, 220);
  }

  function abrirPostDetailModal() {
    var el = document.getElementById('postDetailModal');
    if (!el) return;
    var wasHidden = el.classList.contains('hidden');
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
    if (window.AIRPET_modalUi) window.AIRPET_modalUi.refreshBodyScroll();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-open');
      });
    });
    if (wasHidden && typeof window.AIRPET_modalHistory_afterPostDetailOpen === 'function') {
      window.AIRPET_modalHistory_afterPostDetailOpen();
    }
  }

  function requestClosePostDetailOrganic() {
    if (typeof window.AIRPET_modalHistory_closePostDetail === 'function') {
      window.AIRPET_modalHistory_closePostDetail();
    } else {
      fecharPostDetailModal();
    }
  }

  function fixarPost(postId, isFixed) {
    fetch('/explorar/post/' + postId + '/fixar', {
      method: isFixed ? 'DELETE' : 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    }).then(function () {
      location.reload();
    });
  }

  function deletarPost(postId) {
    if (!confirm('Excluir publicação?')) return;
    fetch('/explorar/post/' + postId, { method: 'DELETE', headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (d.sucesso) {
          requestClosePostDetailOrganic();
          var el = document.getElementById('post-' + postId) || document.querySelector('article[data-post-id="' + postId + '"]');
          if (el) {
            el.style.transition = 'opacity 0.3s, transform 0.3s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
            setTimeout(function () {
              el.remove();
            }, 300);
          }
        }
      });
  }

  function enviarComentarioOrganico(postId, texto, inputEl) {
    if (!texto) return;
    fetch('/explorar/post/' + postId + '/comentar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ texto: texto }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (d) {
        if (!d.sucesso) return;
        if (inputEl) inputEl.value = '';
        if (postDetailCommentPostId === postId || postDetailCommentPostId === String(postId)) {
          carregarComentariosPostDetail(postId);
        }
      });
  }

  function openPostDetailFromArticle(article) {
    if (!article) return;
    var raw = article.getAttribute('data-explorar-meta');
    if (!raw) return;
    var meta;
    try {
      meta = JSON.parse(decodeURIComponent(raw));
    } catch (err) {
      return;
    }
    if (meta.kind !== 'organic') return;
    postDetailCommentPostId = meta.postId;
    var titleEl = document.getElementById('postDetailTitle');
    if (titleEl) {
      titleEl.textContent = meta.pet_nome || meta.autor_nome || 'Publicação';
    }
    var imgEl = document.getElementById('postDetailImg');
    var fbEl = document.getElementById('postDetailImgFallback');
    if (meta.foto && imgEl && fbEl) {
      imgEl.src = meta.foto;
      imgEl.classList.remove('hidden');
      fbEl.classList.add('hidden');
    } else if (imgEl && fbEl) {
      imgEl.classList.add('hidden');
      imgEl.removeAttribute('src');
      fbEl.classList.remove('hidden');
    }
    var row = document.getElementById('postDetailAuthorRow');
    if (row) {
      row.innerHTML = '';
      var cor = meta.cor_perfil || '#ec5a1c';
      var oHasPet = meta.pet_id && meta.pet_nome;
      if (oHasPet) {
        var pav = meta.pet_foto
          ? '<img src="' + escapeHtml(meta.pet_foto) + '" alt="" class="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-primary-200 shadow-sm">'
          : '<span class="w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0 bg-primary-50 text-primary-500 ring-2 ring-primary-200/80">🐾</span>';
        row.innerHTML =
          '<div class="flex items-center gap-3 min-w-0"><a href="/explorar/pet/' +
          meta.pet_id +
          '" class="shrink-0">' +
          pav +
          '</a><div class="min-w-0 flex-1"><a href="/explorar/pet/' +
          meta.pet_id +
          '" class="font-display font-bold text-gray-900 truncate block">' +
          escapeHtml(meta.pet_nome) +
          '</a><p class="text-xs text-gray-500 truncate mt-0.5">por <a href="/explorar/perfil/' +
          meta.usuario_id +
          '" class="font-semibold text-gray-600 hover:text-primary-600">' +
          escapeHtml(meta.autor_nome) +
          '</a></p></div></div>';
      } else {
        var av = meta.foto_perfil
          ? '<img src="' + escapeHtml(meta.foto_perfil) + '" alt="" class="w-10 h-10 rounded-full object-cover shrink-0" style="box-shadow:0 0 0 2px ' + escapeHtml(cor) + '">'
          : '<span class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 bg-gray-400" style="box-shadow:0 0 0 2px ' + escapeHtml(cor) + '">' + escapeHtml((meta.autor_nome || 'U').charAt(0).toUpperCase()) + '</span>';
        row.innerHTML =
          '<a href="/explorar/perfil/' + meta.usuario_id + '" class="flex items-center gap-3 min-w-0">' + av + '<span class="font-semibold text-gray-900 truncate">' + escapeHtml(meta.autor_nome) + '</span></a>';
      }
    }
    var dateEl = document.getElementById('postDetailDate');
    if (dateEl) dateEl.textContent = meta.criado_em ? tempoRelativo(meta.criado_em) : '';
    var extra = document.getElementById('postDetailExtra');
    if (extra) extra.classList.add('hidden');
    var tw = document.getElementById('postDetailTextWrap');
    var tp = document.getElementById('postDetailText');
    var texto = meta.texto || '';
    if (tw && tp) {
      if (texto) {
        tp.innerHTML = renderMencoes(texto);
        tw.classList.remove('hidden');
      } else {
        tp.innerHTML = '';
        tw.classList.add('hidden');
      }
    }
    var cs = document.getElementById('postDetailCommentsSection');
    var comp = document.getElementById('postDetailCommentComposer');
    var hint = document.getElementById('postDetailLoginHint');
    var inpDetail = document.getElementById('postDetailCommentInput');
    var btnDet = document.getElementById('postDetailBtnEnviar');
    var ppc = document.getElementById('postDetailPetsContainer');
    if (ppc) ppc.classList.add('hidden');
    if (cs) cs.classList.remove('hidden');
    if (meuId && comp && hint && inpDetail && btnDet) {
      comp.classList.remove('hidden');
      hint.classList.add('hidden');
      inpDetail.disabled = false;
      inpDetail.setAttribute('data-post-id', postDetailCommentPostId);
      inpDetail.value = '';
      btnDet.disabled = true;
    } else if (comp && hint) {
      comp.classList.add('hidden');
      hint.classList.remove('hidden');
      if (inpDetail) {
        inpDetail.disabled = true;
        inpDetail.value = '';
      }
      if (btnDet) btnDet.disabled = true;
    }
    carregarComentariosPostDetail(postDetailCommentPostId);
    var ownerWrap = document.getElementById('postDetailOwnerMenuWrap');
    var ownerDd = document.getElementById('postDetailOwnerDropdown');
    fecharPostDetailOwnerDropdown();
    if (ownerWrap) {
      if (meuId && Number(meta.usuario_id) === Number(meuId)) {
        ownerWrap.classList.remove('hidden');
        var bf = ownerWrap.querySelector('.btn-post-detail-fixar');
        var bd = ownerWrap.querySelector('.btn-post-detail-deletar');
        var idStr = String(meta.postId);
        if (bf) {
          bf.setAttribute('data-post-id', idStr);
          var fx = !!meta.fixada;
          bf.setAttribute('data-fixada', fx ? '1' : '0');
          var sp = bf.querySelector('span');
          if (sp) sp.textContent = fx ? 'Desafixar' : 'Fixar';
        }
        if (bd) bd.setAttribute('data-post-id', idStr);
      } else {
        ownerWrap.classList.add('hidden');
      }
    }
    if (ownerDd) ownerDd.classList.add('hidden');

    abrirPostDetailModal();
  }

  function init() {
    var postDetailModal = document.getElementById('postDetailModal');
    if (!postDetailModal) return;

    var postDetailOverlayFeed = document.getElementById('postDetailOverlayEl');
    if (postDetailOverlayFeed) postDetailOverlayFeed.addEventListener('click', requestClosePostDetailOrganic);
    var closePostDetailFeed = document.getElementById('closePostDetail');
    if (closePostDetailFeed) closePostDetailFeed.addEventListener('click', requestClosePostDetailOrganic);
    var closePostDetailBackFeed = document.getElementById('closePostDetailBack');
    if (closePostDetailBackFeed) closePostDetailBackFeed.addEventListener('click', requestClosePostDetailOrganic);

    (function setupPostDetailOwnerMenuFeed() {
      var btn = document.getElementById('btnPostDetailOwnerMenu');
      var dd = document.getElementById('postDetailOwnerDropdown');
      var wrap = document.getElementById('postDetailOwnerMenuWrap');
      if (!btn || !dd) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willShow = dd.classList.contains('hidden');
        if (willShow) dd.classList.remove('hidden');
        else dd.classList.add('hidden');
        btn.setAttribute('aria-expanded', willShow ? 'true' : 'false');
      });
      dd.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      document.addEventListener('click', function (e) {
        if (!wrap || wrap.classList.contains('hidden')) return;
        if (e.target.closest('#postDetailOwnerMenuWrap')) return;
        fecharPostDetailOwnerDropdown();
      });
    })();

    postDetailModal.addEventListener('click', function (e) {
      var bf = e.target.closest('.btn-post-detail-fixar');
      if (bf) {
        e.preventDefault();
        fecharPostDetailOwnerDropdown();
        fixarPost(bf.getAttribute('data-post-id'), bf.getAttribute('data-fixada') === '1');
        return;
      }
      var bdel = e.target.closest('.btn-post-detail-deletar');
      if (bdel) {
        e.preventDefault();
        fecharPostDetailOwnerDropdown();
        deletarPost(bdel.getAttribute('data-post-id'));
      }
    });

    var postDetailCommentInputEl = document.getElementById('postDetailCommentInput');
    var postDetailBtnEnviarEl = document.getElementById('postDetailBtnEnviar');
    if (postDetailCommentInputEl && postDetailBtnEnviarEl) {
      postDetailCommentInputEl.addEventListener('input', function () {
        postDetailBtnEnviarEl.disabled = !postDetailCommentInputEl.value.trim();
      });
      postDetailCommentInputEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var pid = postDetailCommentInputEl.getAttribute('data-post-id');
        var t = postDetailCommentInputEl.value.trim();
        if (pid && t) enviarComentarioOrganico(pid, t, postDetailCommentInputEl);
      });
      postDetailBtnEnviarEl.addEventListener('click', function () {
        var pid = postDetailCommentInputEl.getAttribute('data-post-id');
        var t = postDetailCommentInputEl.value.trim();
        if (pid && t) enviarComentarioOrganico(pid, t, postDetailCommentInputEl);
      });
    }

    var postDetailCommentListEl = document.getElementById('postDetailCommentList');
    if (postDetailCommentListEl) {
      postDetailCommentListEl.addEventListener('click', function (e) {
        var b = e.target.closest('.btn-del-comment');
        if (!b) return;
        var cid = b.getAttribute('data-comment-id');
        if (!cid || !confirm('Excluir comentário?')) return;
        fetch('/explorar/comentario/' + cid, {
          method: 'DELETE',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d.sucesso && postDetailCommentPostId) carregarComentariosPostDetail(postDetailCommentPostId);
          });
      });
    }

    var mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('click', function (e) {
        var im = e.target.closest('img.post-photo, img.post-embed-img');
        if (!im || !mainEl.contains(im)) return;
        var art = im.closest('article[data-explorar-meta]');
        if (!art || !mainEl.contains(art)) return;
        if (e.target.closest('button')) return;
        if (e.target.closest('a[href]')) return;
        e.preventDefault();
        e.stopPropagation();
        openPostDetailFromArticle(art);
      });
    }

    window.AIRPET_fecharPostDetailModal = fecharPostDetailModal;
    window.AIRPET_requestClosePostDetailOrganic = requestClosePostDetailOrganic;
    window.AIRPET_openPostDetailFromArticle = openPostDetailFromArticle;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
