/**
 * Trava de scroll no body + Escape para fechar modais (ordem: lightbox > detalhe > comentários > novo post > repost)
 */
(function () {
  'use strict';

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

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.key !== 'Escape') return;

      var lb = document.getElementById('postImageLightbox');
      if (lb && !isHidden(lb) && typeof window.closePostImageLightbox === 'function') {
        e.preventDefault();
        window.closePostImageLightbox();
        refreshBodyScroll();
        return;
      }

      var pd = document.getElementById('postDetailModal');
      if (pd && !isHidden(pd)) {
        e.preventDefault();
        if (typeof window.AIRPET_fecharPostDetailModal === 'function') window.AIRPET_fecharPostDetailModal();
        else {
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
})();
