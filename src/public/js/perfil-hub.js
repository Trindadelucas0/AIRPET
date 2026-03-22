(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', function () {
    var btnAbrirFoto = document.getElementById('btnAbrirFotoPerfil');
    var inputFoto = document.getElementById('foto_perfil');
    var fotoAcoes = document.getElementById('fotoPerfilAcoes');
    var previewFoto = document.getElementById('previewFotoPerfil');
    var btnSalvarFoto = document.getElementById('btnSalvarFotoPerfil');
    var btnCancelarFoto = document.getElementById('btnCancelarFotoPerfil');
    var fotoBlob = null;
    var fotoOrigSrc = previewFoto ? (previewFoto.src || '') : '';

    if (btnAbrirFoto && inputFoto) {
      btnAbrirFoto.addEventListener('click', function () { inputFoto.click(); });
    }

    if (inputFoto && previewFoto && fotoAcoes) {
      inputFoto.addEventListener('change', function () {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          if (typeof openCropModal === 'function') {
            openCropModal({
              src: ev.target.result, aspectRatio: 1, maxWidth: 600, maxHeight: 600,
              onConfirm: function (blob) {
                fotoBlob = blob;
                var url = URL.createObjectURL(blob);
                if (previewFoto.tagName === 'IMG') { previewFoto.src = url; } else {
                  var img = document.createElement('img');
                  img.src = url;
                  img.id = 'previewFotoPerfil';
                  img.className = previewFoto.className;
                  img.style.cssText = previewFoto.style.cssText;
                  previewFoto.parentNode.replaceChild(img, previewFoto);
                  previewFoto = img;
                }
                fotoAcoes.classList.remove('hidden');
              },
            });
          } else {
            fotoBlob = file;
            if (previewFoto.tagName === 'IMG') { previewFoto.src = ev.target.result; }
            fotoAcoes.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }

    if (btnCancelarFoto && fotoAcoes && previewFoto) {
      btnCancelarFoto.addEventListener('click', function () {
        fotoAcoes.classList.add('hidden');
        fotoBlob = null;
        if (previewFoto.tagName === 'IMG' && fotoOrigSrc) previewFoto.src = fotoOrigSrc;
      });
    }

    if (btnSalvarFoto) {
      btnSalvarFoto.addEventListener('click', function () {
        if (!fotoBlob) return;
        var fd = new FormData();
        fd.append('foto_perfil', new File([fotoBlob], 'foto.jpg', { type: 'image/jpeg' }));
        fd.append('return_to', '/perfil');
        var work = function () {
          return fetch('/perfil?_method=PUT', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
        };
        var chain;
        if (window.AIRPET_LOADING && typeof window.AIRPET_LOADING.runLocked === 'function') {
          chain = window.AIRPET_LOADING.runLocked({
            button: btnSalvarFoto,
            busyText: '<span class="airpet-inline-dots">Salvando</span>'
          }, work);
        } else {
          btnSalvarFoto.disabled = true;
          btnSalvarFoto.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Salvando...';
          chain = work();
        }
        Promise.resolve(chain).then(function (d) {
            if (d.sucesso) {
              fotoAcoes.classList.add('hidden');
              fotoBlob = null;
              btnSalvarFoto.innerHTML = '<i class="fa-solid fa-check"></i>Salvo!';
              setTimeout(function () {
                btnSalvarFoto.innerHTML = '<i class="fa-solid fa-check"></i>Salvar';
                btnSalvarFoto.disabled = false;
              }, 1500);
            } else {
              alert(d.mensagem || 'Erro ao salvar.');
              btnSalvarFoto.disabled = false;
              btnSalvarFoto.innerHTML = '<i class="fa-solid fa-check"></i>Salvar';
            }
          })
          .catch(function () {
            alert('Erro ao salvar.');
            btnSalvarFoto.disabled = false;
            btnSalvarFoto.innerHTML = '<i class="fa-solid fa-check"></i>Salvar';
          });
      });
    }

    var btnAbrirCapa = document.getElementById('btnAbrirCapa');
    var inputCapa = document.getElementById('foto_capa');
    var capaAcoes = document.getElementById('capaAcoes');
    var btnSalvarCapa = document.getElementById('btnSalvarCapa');
    var btnCancelarCapa = document.getElementById('btnCancelarCapa');
    var capaBlob = null;
    var bannerWrap = document.getElementById('bannerPreviewWrap');

    if (btnAbrirCapa && inputCapa) btnAbrirCapa.addEventListener('click', function () { inputCapa.click(); });

    if (inputCapa && bannerWrap && capaAcoes) {
      inputCapa.addEventListener('change', function () {
        var file = this.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          capaBlob = file;
          bannerWrap.style.backgroundImage = 'url(' + ev.target.result + ')';
          bannerWrap.style.backgroundSize = 'cover';
          bannerWrap.style.backgroundPosition = 'center';
          capaAcoes.classList.remove('hidden');
          var img = bannerWrap.querySelector('img');
          if (img) { img.src = ev.target.result; }
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }

    if (btnCancelarCapa && capaAcoes) {
      btnCancelarCapa.addEventListener('click', function () {
        capaAcoes.classList.add('hidden');
        capaBlob = null;
      });
    }

    if (btnSalvarCapa) {
      btnSalvarCapa.addEventListener('click', function () {
        if (!capaBlob) return;
        var fd = new FormData();
        fd.append('foto_capa', new File([capaBlob], 'capa.jpg', { type: 'image/jpeg' }));
        fd.append('return_to', '/perfil');
        var workCapa = function () {
          return fetch('/perfil?_method=PUT', { method: 'POST', body: fd, headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json(); });
        };
        var chainCapa;
        if (window.AIRPET_LOADING && typeof window.AIRPET_LOADING.runLocked === 'function') {
          chainCapa = window.AIRPET_LOADING.runLocked({
            button: btnSalvarCapa,
            busyText: '<span class="airpet-inline-dots">Salvando</span>'
          }, workCapa);
        } else {
          btnSalvarCapa.disabled = true;
          btnSalvarCapa.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Salvando...';
          chainCapa = workCapa();
        }
        Promise.resolve(chainCapa).then(function (d) {
            if (d.sucesso) {
              capaAcoes.classList.add('hidden');
              capaBlob = null;
              btnSalvarCapa.innerHTML = '<i class="fa-solid fa-check"></i>Salvo!';
              setTimeout(function () {
                btnSalvarCapa.innerHTML = '<i class="fa-solid fa-check"></i>Salvar capa';
                btnSalvarCapa.disabled = false;
              }, 1500);
            } else {
              alert(d.mensagem || 'Erro.');
              btnSalvarCapa.disabled = false;
              btnSalvarCapa.innerHTML = '<i class="fa-solid fa-check"></i>Salvar capa';
            }
          })
          .catch(function () {
            alert('Erro ao salvar.');
            btnSalvarCapa.disabled = false;
            btnSalvarCapa.innerHTML = '<i class="fa-solid fa-check"></i>Salvar capa';
          });
      });
    }
  });
})();
