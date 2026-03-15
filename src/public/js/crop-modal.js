/**
 * Modal de recorte de imagem com Cropper.js.
 * Depende de Cropper (global) estar carregado.
 * Uso: openCropModal({ src, aspectRatio, maxSize, onConfirm, onCancel })
 */
(function () {
  'use strict';

  var modal = document.getElementById('cropModal');
  var overlay = document.getElementById('cropModalOverlay');
  var backdrop = document.getElementById('cropModalBackdrop');
  var modalBox = document.getElementById('cropModalBox');
  var cropImage = document.getElementById('cropImage');
  var btnClose = document.getElementById('cropModalClose');
  var btnCancel = document.getElementById('cropModalCancel');
  var btnApply = document.getElementById('cropModalApply');

  var cropperInstance = null;
  var currentOptions = null;

  function destroyCropper() {
    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }
  }

  function closeModal(confirmed) {
    var opts = currentOptions;
    if (!confirmed && opts && typeof opts.onCancel === 'function') opts.onCancel();
    destroyCropper();
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    cropImage.src = '';
    cropImage.removeAttribute('src');
    currentOptions = null;
  }

  function applyCrop() {
    if (!cropperInstance || !currentOptions || !currentOptions.onConfirm) {
      closeModal(true);
      return;
    }
    var opts = currentOptions;
    var maxW = (opts.maxWidth != null) ? opts.maxWidth : 1200;
    var maxH = (opts.maxHeight != null) ? opts.maxHeight : 1200;
    var canvas = cropperInstance.getCroppedCanvas({ maxWidth: maxW, maxHeight: maxH });
    if (!canvas) {
      closeModal(false);
      return;
    }
    canvas.toBlob(
      function (blob) {
        if (blob && opts.onConfirm) opts.onConfirm(blob);
        closeModal(true);
      },
      'image/jpeg',
      0.9
    );
  }

  if (overlay) overlay.addEventListener('click', function () { closeModal(false); });
  if (modalBox) modalBox.addEventListener('click', function (e) { e.stopPropagation(); });
  if (btnClose) btnClose.addEventListener('click', function () { closeModal(false); });
  if (btnCancel) btnCancel.addEventListener('click', function () { closeModal(false); });
  if (btnApply) btnApply.addEventListener('click', applyCrop);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal(false);
  });

  /**
   * Abre o modal de recorte.
   * @param {Object} options
   * @param {string} options.src - Data URL ou URL da imagem
   * @param {number} [options.aspectRatio=0] - Proporção (1 = 1:1, 0 = livre)
   * @param {number} [options.maxWidth=1200]
   * @param {number} [options.maxHeight=1200]
   * @param {function(Blob)} [options.onConfirm] - Callback com o blob recortado
   * @param {function()} [options.onCancel] - Callback ao cancelar
   */
  window.openCropModal = function (options) {
    if (!modal || !cropImage || typeof Cropper === 'undefined') {
      if (options.onCancel) options.onCancel();
      return;
    }
    currentOptions = options || {};
    var src = currentOptions.src;
    if (!src) {
      if (currentOptions.onCancel) currentOptions.onCancel();
      return;
    }

    destroyCropper();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    cropImage.onload = function () {
      var aspectRatio = currentOptions.aspectRatio;
      if (aspectRatio === undefined) aspectRatio = 0;
      function initCropper() {
        if (!currentOptions || !cropImage.src) return;
        cropperInstance = new Cropper(cropImage, {
          aspectRatio: aspectRatio,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.8,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: false
        });
      }
      if (cropImage.naturalWidth && cropImage.naturalHeight) {
        initCropper();
      } else {
        requestAnimationFrame(function () { requestAnimationFrame(initCropper); });
      }
    };
    cropImage.onerror = function () {
      if (currentOptions && typeof currentOptions.onCancel === 'function') currentOptions.onCancel();
      closeModal(false);
    };
    cropImage.src = src;
  };
})();
