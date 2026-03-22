/**
 * Trava de scroll no body + Escape para fechar modais (ordem: lightbox > detalhe > comentários > novo post > repost)
 * + history.pushState para o botão Voltar do celular fechar o modal e voltar à tela anterior.
 */
(function () {
  'use strict';

  var postDetailPushes = 0;
  var lightboxPushes = 0;

  function isHidden(el) {
    if (!el) return true;
    if (el.classList.contains('hidden')) return true;
    if (el.style && String(el.style.display).toLowerCase() === 'none') return true;
    return false;
  }

  function anyModalOpen() {
    var ids = ['postDetailModal', 'commentModal', 'commentsModal', 'newPostModal', 'repostModal'];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el && !isHidden(el)) return true;
    }
    var lb = document.getElementById('postImageLightbox');
    if (lb && !isHidden(lb)) return true;
    return false;
  }

  function refreshBodyScroll() {
    document.body.style.overflow = anyModalOpen() ? 'hidden' : '';
  }

  function hideModalEl(el) {
    if (!el) return;
    el.classList.add('hidden');
    if (el.style && el.style.display && el.style.display !== 'none') {
      el.style.display = '';
    }
  }

  /**
   * Chamar ao abrir o modal de detalhe do post (após ficar visível).
   */
  window.AIRPET_modalHistory_afterPostDetailOpen = function () {
    try {
      history.pushState({ airpetPd: 1 }, '', location.href);
      postDetailPushes++;
    } catch (err) {}
  };

  /**
   * Fechar detalhe do post: usa Voltar do navegador se houver entrada no histórico.
   */
  window.AIRPET_modalHistory_closePostDetail = function () {
    var pd = document.getElementById('postDetailModal');
    if (!pd || isHidden(pd)) return;
    if (postDetailPushes > 0) {
      try {
        history.back();
      } catch (err) {
        postDetailPushes = 0;
        if (typeof window.AIRPET_fecharPostDetailModal === 'function') window.AIRPET_fecharPostDetailModal();
      }
    } else if (typeof window.AIRPET_fecharPostDetailModal === 'function') {
      window.AIRPET_fecharPostDetailModal();
    }
  };

  window.AIRPET_modalHistory_afterLightboxOpen = function () {
    try {
      history.pushState({ airpetLb: 1 }, '', location.href);
      lightboxPushes++;
    } catch (err) {}
  };

  window.AIRPET_modalHistory_closeLightbox = function () {
    var lb = document.getElementById('postImageLightbox');
    if (!lb || isHidden(lb)) return;
    if (lightboxPushes > 0) {
      try {
        history.back();
      } catch (err) {
        lightboxPushes = 0;
        if (typeof window.closePostImageLightbox === 'function') window.closePostImageLightbox();
      }
    } else if (typeof window.closePostImageLightbox === 'function') {
      window.closePostImageLightbox();
    }
  };

  window.addEventListener('popstate', function () {
    var lb = document.getElementById('postImageLightbox');
    if (lb && !isHidden(lb)) {
      if (lightboxPushes > 0) lightboxPushes--;
      if (typeof window.closePostImageLightbox === 'function') window.closePostImageLightbox();
      refreshBodyScroll();
      return;
    }
    var pd = document.getElementById('postDetailModal');
    if (pd && !isHidden(pd)) {
      if (postDetailPushes > 0) postDetailPushes--;
      if (typeof window.AIRPET_fecharPostDetailModal === 'function') window.AIRPET_fecharPostDetailModal();
      refreshBodyScroll();
    }
  });

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Escape') return;

      var lb = document.getElementById('postImageLightbox');
      if (lb && !isHidden(lb)) {
        e.preventDefault();
        if (typeof window.AIRPET_modalHistory_closeLightbox === 'function') {
          window.AIRPET_modalHistory_closeLightbox();
        } else if (typeof window.closePostImageLightbox === 'function') {
          window.closePostImageLightbox();
          refreshBodyScroll();
        }
        return;
      }

      var pd = document.getElementById('postDetailModal');
      if (pd && !isHidden(pd)) {
        e.preventDefault();
        if (typeof window.AIRPET_modalHistory_closePostDetail === 'function') {
          window.AIRPET_modalHistory_closePostDetail();
        } else if (typeof window.AIRPET_fecharPostDetailModal === 'function') {
          window.AIRPET_fecharPostDetailModal();
        } else {
          hideModalEl(pd);
          refreshBodyScroll();
        }
        return;
      }

      var cm = document.getElementById('commentModal');
      if (cm && !isHidden(cm)) {
        e.preventDefault();
        if (typeof window.AIRPET_fecharCommentModal === 'function') window.AIRPET_fecharCommentModal();
        else {
          hideModalEl(cm);
          refreshBodyScroll();
        }
        return;
      }

      var csm = document.getElementById('commentsModal');
      if (csm && !isHidden(csm)) {
        e.preventDefault();
        if (typeof window.AIRPET_fecharCommentsModalPerfil === 'function') window.AIRPET_fecharCommentsModalPerfil();
        else {
          hideModalEl(csm);
          refreshBodyScroll();
        }
        return;
      }

      var np = document.getElementById('newPostModal');
      if (np && !isHidden(np)) {
        e.preventDefault();
        hideModalEl(np);
        refreshBodyScroll();
        return;
      }

      var rp = document.getElementById('repostModal');
      if (rp && !isHidden(rp)) {
        e.preventDefault();
        hideModalEl(rp);
        refreshBodyScroll();
      }
    },
    true
  );

  window.AIRPET_modalUi = {
    refreshBodyScroll: refreshBodyScroll,
    anyModalOpen: anyModalOpen
  };

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#postDetailBtnFecharMobile')) {
      e.preventDefault();
      if (typeof window.AIRPET_modalHistory_closePostDetail === 'function') {
        window.AIRPET_modalHistory_closePostDetail();
      }
    }
  });
})();
