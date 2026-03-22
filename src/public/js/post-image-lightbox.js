(function () {
  'use strict';

  var root = document.getElementById('postImageLightbox');
  var overlay = document.getElementById('postImageLightboxOverlay');
  var btnClose = document.getElementById('postImageLightboxClose');
  var imgEl = document.getElementById('postImageLightboxImg');

  if (!root || !overlay || !btnClose || !imgEl) return;

  var prevBodyOverflow = '';
  var lastFocusEl = null;

  function isOpen() {
    return !root.classList.contains('hidden');
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      closePostImageLightbox();
    }
  }

  function closePostImageLightbox() {
    if (!isOpen()) return;
    root.classList.add('hidden');
    root.setAttribute('aria-hidden', 'true');
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    document.body.style.overflow = prevBodyOverflow;
    document.removeEventListener('keydown', onKeydown, true);
    if (lastFocusEl && typeof lastFocusEl.focus === 'function') {
      try {
        lastFocusEl.focus();
      } catch (err) {}
    }
    lastFocusEl = null;
  }

  function openPostImageLightbox(src, alt) {
    var url = String(src || '').trim();
    if (!url) return;

    var wasClosed = !isOpen();
    if (wasClosed) {
      lastFocusEl = document.activeElement;
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKeydown, true);
    }

    imgEl.src = url;
    imgEl.alt = alt ? String(alt) : 'Imagem do post';

    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');

    setTimeout(function () {
      btnClose.focus();
    }, 0);
  }

  btnClose.addEventListener('click', function (e) {
    e.preventDefault();
    closePostImageLightbox();
  });

  overlay.addEventListener('click', function () {
    closePostImageLightbox();
  });

  imgEl.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  window.openPostImageLightbox = openPostImageLightbox;
  window.closePostImageLightbox = closePostImageLightbox;
})();
