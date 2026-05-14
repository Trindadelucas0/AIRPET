(function () {
  'use strict';

  function formSubmitGuard() {
    document.querySelectorAll('form.js-perfil-form').forEach(function (form) {
      form.addEventListener('submit', function () {
        var btn = form.querySelector('button[type="submit"]');
        if (btn && !btn.disabled) {
          btn.disabled = true;
          var orig = btn.innerHTML;
          btn.setAttribute('data-orig-html', orig);
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Salvando…';
        }
      });
    });
  }

  function bioCounter() {
    var bioEl = document.getElementById('bio');
    var bioCount = document.getElementById('bioCount');
    if (bioEl && bioCount) {
      bioEl.addEventListener('input', function () { bioCount.textContent = this.value.length; });
    }
  }

  function aparencia() {
    var swatches = document.querySelectorAll('.color-swatch');
    var inputCor = document.getElementById('inputCor');
    var corPreview = document.getElementById('corPreview');
    var aparenciaRingDemo = document.getElementById('aparenciaRingDemo');

    function syncAparenciaRing(hex) {
      if (!aparenciaRingDemo || !hex) return;
      var h = String(hex).trim();
      if (!/^#/.test(h)) h = '#' + h;
      aparenciaRingDemo.style.boxShadow = '0 0 0 3px ' + h + '66';
    }

    swatches.forEach(function (s) {
      s.addEventListener('click', function () {
        swatches.forEach(function (x) { x.classList.remove('active'); });
        s.classList.add('active');
        var c = s.getAttribute('data-cor');
        inputCor.value = c;
        corPreview.style.background = c;
        syncAparenciaRing(c);
      });
    });

    if (inputCor) {
      inputCor.addEventListener('input', function () {
        corPreview.style.background = this.value;
        swatches.forEach(function (x) { x.classList.remove('active'); });
        syncAparenciaRing(this.value);
      });
    }

    if (inputCor && aparenciaRingDemo) syncAparenciaRing(inputCor.value);
  }

  function cepGeo() {
    var cepInput = document.getElementById('cep');
    if (cepInput) {
      cepInput.addEventListener('input', function () {
        var v = this.value.replace(/\D/g, '');
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5, 8);
        this.value = v;
      });
    }

    var btnBuscarCep = document.getElementById('btnBuscarCep');
    if (btnBuscarCep && cepInput) {
      btnBuscarCep.addEventListener('click', function () {
        var btn = this;
        var cep = (cepInput.value || '').replace(/\D/g, '');
        if (cep.length !== 8) { alert('CEP inválido.'); return; }
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        fetch('https://viacep.com.br/ws/' + cep + '/json/')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.erro) { alert('CEP não encontrado.'); return; }
            var end = document.getElementById('endereco');
            var bairro = document.getElementById('bairro');
            var cidade = document.getElementById('cidade');
            var estado = document.getElementById('estado');
            if (d.logradouro && end) end.value = d.logradouro;
            if (d.bairro && bairro) bairro.value = d.bairro;
            if (d.localidade && cidade) cidade.value = d.localidade;
            if (d.uf && estado) estado.value = d.uf;
          })
          .catch(function () { alert('Erro ao buscar CEP.'); })
          .finally(function () { btn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>'; });
      });
    }

    var btnGeo = document.getElementById('btnGeolocalizacao');
    if (btnGeo) {
      btnGeo.addEventListener('click', function () {
        if (!navigator.geolocation) { alert('Geolocalização não suportada.'); return; }
        var btn = this;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Obtendo localização...';
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            fetch('https://nominatim.openstreetmap.org/reverse?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&format=json&accept-language=pt-BR')
              .then(function (r) { return r.json(); })
              .then(function (d) {
                var a = d.address || {};
                var end = document.getElementById('endereco');
                var bairro = document.getElementById('bairro');
                var cidade = document.getElementById('cidade');
                if (a.road && end) end.value = a.road + (a.house_number ? ', ' + a.house_number : '');
                if ((a.suburb || a.neighbourhood) && bairro) bairro.value = a.suburb || a.neighbourhood;
                if ((a.city || a.town || a.municipality) && cidade) cidade.value = a.city || a.town || a.municipality;
                btn.innerHTML = '<i class="fa-solid fa-check"></i>Localização obtida!';
                setTimeout(function () {
                  btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>Usar localização atual';
                  btn.disabled = false;
                }, 2000);
              });
          },
          function () {
            alert('Não foi possível obter localização.');
            btn.innerHTML = '<i class="fa-solid fa-crosshairs"></i>Usar localização atual';
            btn.disabled = false;
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }
  }

  // Galeria solta foi descontinuada — toda foto agora e um post no
  // perfil do pet. Nao ha mais inicializacao de pagina /perfil/galeria.

  document.addEventListener('DOMContentLoaded', function () {
    formSubmitGuard();
    bioCounter();
    aparencia();
    cepGeo();
  });
})();
