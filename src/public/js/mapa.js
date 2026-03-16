(function () {
  'use strict';

  var mapEl = document.getElementById('mapaFull');
  if (!mapEl) return;

  var map = L.map('mapaFull', { zoomControl: false }).setView([-15.78, -47.93], 5);

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19
  }).addTo(map);

  var clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  map.addLayer(clusterGroup);

  var iconConfig = {
    petshop:        { color: '#10b981', icon: 'fa-store' },
    ponto_interesse:{ color: '#3b82f6', icon: 'fa-map-pin' },
    pet_perdido:    { color: '#dc2626', icon: 'fa-triangle-exclamation' },
    avistamento:    { color: '#f59e0b', icon: 'fa-eye' },
    pet_scan:       { color: '#ec5a1c', icon: 'fa-paw' },
    default:        { color: '#6b7280', icon: 'fa-map-pin' }
  };

  var layerMapping = {
    petshops: 'petshop',
    perdidos: 'pet_perdido',
    avistamentos: 'avistamento',
    pontos: 'ponto_interesse',
    pet_scans: 'pet_scan'
  };

  function makeIcon(tipo) {
    var cfg = iconConfig[tipo] || iconConfig.default;
    return L.divIcon({
      className: 'custom-pin',
      html: '<div style="background:' + cfg.color + ';width:30px;height:30px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">' +
            '<i class="fa-solid ' + cfg.icon + '" style="color:#fff;font-size:12px"></i></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -18]
    });
  }

  var loadedIds = {};
  var markers = {};
  var activeLayers = { petshops: true, perdidos: true, avistamentos: true, pontos: false, pet_scans: true };
  var locMarker = null;

  var debounceTimer = null;
  function debounce(fn, delay) {
    return function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, delay);
    };
  }

  function fetchPins() {
    var bounds = map.getBounds();
    var params = new URLSearchParams({
      swLat: bounds.getSouthWest().lat,
      swLng: bounds.getSouthWest().lng,
      neLat: bounds.getNorthEast().lat,
      neLng: bounds.getNorthEast().lng
    });

    fetch('/mapa/api/pins?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var features = data.features || data || [];
        if (!Array.isArray(features)) return;

        features.forEach(function (feature) {
          var props = feature.properties || feature;
          var geom = feature.geometry;

          var id = props.id + '_' + (props.tipo || 'default');
          if (loadedIds[id]) return;
          loadedIds[id] = true;

          var lat, lng;
          if (geom && geom.coordinates) {
            lng = geom.coordinates[0];
            lat = geom.coordinates[1];
          } else {
            lat = props.latitude;
            lng = props.longitude;
          }

          if (!lat || !lng) return;

          var tipo = props.tipo || props.categoria || 'default';
          var marker = L.marker([lat, lng], { icon: makeIcon(tipo) });

          var popup = '<div style="min-width:160px">' +
            '<strong>' + (props.nome || 'Ponto') + '</strong>';
          if (props.categoria) {
            popup += '<br><span style="font-size:11px;color:#888;text-transform:capitalize">' +
                     props.categoria.replace(/_/g, ' ') + '</span>';
          }
          if (props.endereco) {
            popup += '<br><small style="color:#666">' + props.endereco + '</small>';
          }
          if (props.telefone) {
            popup += '<br><a href="tel:' + props.telefone + '" style="color:#ec5a1c;font-size:12px">' +
                     '<i class="fa-solid fa-phone"></i> ' + props.telefone + '</a>';
          }
          if (props.tipo === 'petshop') {
            if (props.imagem_url) {
              popup = '<div style="min-width:190px">' +
                '<img src="' + props.imagem_url + '" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px">' +
                popup.replace('<div style="min-width:160px">', '');
            }
            if (props.perfil_url) {
              popup += '<br><a href="' + props.perfil_url + '" style="display:inline-block;margin-top:6px;background:#ec5a1c;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">Ver perfil</a>';
            }
          }
          if (props.tipo === 'pet_perdido' && props.foto) {
            popup = '<div style="min-width:180px"><img src="' + props.foto +
                    '" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px">' + popup.replace('<div style="min-width:160px">', '');
          }
          if (props.tipo === 'pet_scan') {
            popup = '<div style="min-width:180px">';
            if (props.foto) {
              popup += '<img src="' + props.foto + '" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:6px" alt="">';
            }
            popup += '<strong>Última leitura da tag</strong><br><span>' + (props.nome || 'Pet') + '</span>';
            if (props.cidade) popup += '<br><small style="color:#666"><i class="fa-solid fa-map-pin"></i> ' + props.cidade + '</small>';
            popup += '</div>';
          }
          if (props.tipo !== 'pet_scan') popup += '</div>';

          marker.bindPopup(popup);
          marker._airpetTipo = tipo;
          markers[id] = marker;

          var visible = isLayerVisible(tipo);
          if (visible) {
            clusterGroup.addLayer(marker);
          }
        });
      })
      .catch(function (err) {
        console.error('[MAPA] Erro ao carregar pins:', err);
      });
  }

  function isLayerVisible(tipo) {
    for (var key in layerMapping) {
      if (layerMapping[key] === tipo) return activeLayers[key] !== false;
    }
    return true;
  }

  function toggleLayer(layerName) {
    activeLayers[layerName] = !activeLayers[layerName];
    var tipoAlvo = layerMapping[layerName];

    for (var id in markers) {
      var m = markers[id];
      if (m._airpetTipo === tipoAlvo) {
        if (activeLayers[layerName]) {
          clusterGroup.addLayer(m);
        } else {
          clusterGroup.removeLayer(m);
        }
      }
    }
  }

  document.querySelectorAll('.layer-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var layer = this.getAttribute('data-layer');
      toggleLayer(layer);
      this.classList.toggle('active');
      if (this.classList.contains('active')) {
        this.classList.remove('text-gray-600');
      } else {
        this.classList.add('text-gray-600');
      }
    });
  });

  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function mostrarErroGeo(err) {
    if (!err || err.code !== 1) return;
    if (!_isIOS) return;

    var toast = document.getElementById('airpet-geo-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'airpet-geo-toast';
    toast.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;z-index:9999;background:#1e40af;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:420px;margin:0 auto;animation:slideDown 0.3s ease-out;font-size:13px;line-height:1.5;';
    toast.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px;">' +
        '<i class="fa-solid fa-location-dot" style="font-size:18px;margin-top:2px;flex-shrink:0;"></i>' +
        '<div>' +
          '<strong>Localização bloqueada</strong><br>' +
          'No iPhone, vá em <strong>Ajustes → Privacidade → Serviços de Localização → Safari</strong> e selecione "Ao Usar o App".' +
        '</div>' +
        '<button onclick="this.parentNode.parentNode.remove()" style="background:none;border:none;color:#93c5fd;font-size:18px;cursor:pointer;flex-shrink:0;padding:0 0 0 4px;">✕</button>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = '@keyframes slideDown{from{transform:translateY(-100px);opacity:0}to{transform:translateY(0);opacity:1}}';
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 12000);
  }

  var btnLoc = document.getElementById('btnMinhaLocalizacao');
  if (btnLoc) {
    btnLoc.addEventListener('click', function () {
      if (!navigator.geolocation) {
        mostrarErroGeo({ code: 1 });
        return;
      }
      btnLoc.querySelector('i').className = 'fa-solid fa-spinner fa-spin text-lg';
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
          btnLoc.querySelector('i').className = 'fa-solid fa-location-crosshairs text-lg';
        },
        function (err) {
          btnLoc.querySelector('i').className = 'fa-solid fa-location-crosshairs text-lg';
          mostrarErroGeo(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  fetchPins();
  map.on('moveend', debounce(fetchPins, 400));

  /* ---------- Localizar por Estado / Cidade / Bairro ---------- */
  var painelLocalizar = document.getElementById('painelLocalizar');
  var btnToggleLocalizar = document.getElementById('btnToggleLocalizar');
  if (btnToggleLocalizar && painelLocalizar) {
    if (window.matchMedia('(max-width: 767px)').matches) {
      painelLocalizar.classList.add('collapsed');
    }
    btnToggleLocalizar.addEventListener('click', function () {
      painelLocalizar.classList.toggle('collapsed');
    });
  }

  var mapaEstado = document.getElementById('mapaEstado');
  var mapaCidade = document.getElementById('mapaCidade');
  var mapaBairro = document.getElementById('mapaBairro');
  var btnMostrarNoMapa = document.getElementById('btnMostrarNoMapa');
  var btnMostrarNoMapaText = document.getElementById('btnMostrarNoMapaText');
  var mapaLocalizarMsg = document.getElementById('mapaLocalizarMsg');

  function atualizarBtnMostrarNoMapa() {
    var estado = mapaEstado && mapaEstado.value;
    var cidade = mapaCidade && mapaCidade.value;
    if (btnMostrarNoMapa) {
      btnMostrarNoMapa.disabled = !estado || !cidade;
    }
  }

  if (mapaEstado) {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(function (r) { return r.json(); })
      .then(function (estados) {
        estados.forEach(function (e) {
          var opt = document.createElement('option');
          opt.value = e.id;
          opt.setAttribute('data-sigla', e.sigla);
          opt.textContent = e.nome;
          mapaEstado.appendChild(opt);
        });
      })
      .catch(function () {
        if (mapaLocalizarMsg) {
          mapaLocalizarMsg.textContent = 'Nao foi possivel carregar os estados. Tente novamente.';
          mapaLocalizarMsg.classList.remove('hidden');
        }
      });
    mapaEstado.addEventListener('change', function () {
      var id = this.value;
      var sigla = this.options[this.selectedIndex] && this.options[this.selectedIndex].getAttribute('data-sigla');
      if (mapaCidade) {
        mapaCidade.disabled = !id;
        mapaCidade.innerHTML = '<option value="">Selecione a cidade</option>';
        mapaCidade.value = '';
        if (id) {
          mapaCidade.disabled = true;
          fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/' + id + '/municipios?orderBy=nome')
            .then(function (r) { return r.json(); })
            .then(function (municipios) {
              municipios.forEach(function (m) {
                var opt = document.createElement('option');
                opt.value = m.nome;
                opt.textContent = m.nome;
                mapaCidade.appendChild(opt);
              });
              mapaCidade.disabled = false;
            })
            .catch(function () {
              mapaCidade.disabled = false;
              if (mapaLocalizarMsg) {
                mapaLocalizarMsg.textContent = 'Nao foi possivel carregar as cidades.';
                mapaLocalizarMsg.classList.remove('hidden');
              }
            });
        }
      }
      atualizarBtnMostrarNoMapa();
    });
  }
  if (mapaCidade) {
    mapaCidade.addEventListener('change', atualizarBtnMostrarNoMapa);
  }

  if (btnMostrarNoMapa) {
    btnMostrarNoMapa.addEventListener('click', function () {
      if (this.disabled) return;
      var estadoOpt = mapaEstado && mapaEstado.options[mapaEstado.selectedIndex];
      var sigla = estadoOpt ? estadoOpt.getAttribute('data-sigla') : '';
      var cidade = mapaCidade ? mapaCidade.value.trim() : '';
      var bairro = mapaBairro ? mapaBairro.value.trim() : '';
      if (!sigla || !cidade) return;
      var query = bairro ? bairro + ', ' + cidade + ', ' + sigla + ', Brasil' : cidade + ', ' + sigla + ', Brasil';
      if (mapaLocalizarMsg) {
        mapaLocalizarMsg.classList.add('hidden');
        mapaLocalizarMsg.textContent = '';
      }
      this.disabled = true;
      if (btnMostrarNoMapaText) btnMostrarNoMapaText.textContent = 'Buscando...';
      var btn = this;
      fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=1&countrycodes=br', {
        headers: { 'Accept': 'application/json', 'Accept-Language': 'pt-BR', 'User-Agent': 'AIRPET/1.0 (mapa localizar)' }
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          btn.disabled = false;
          if (btnMostrarNoMapaText) btnMostrarNoMapaText.textContent = 'Mostrar no mapa';
          if (!data || !data.length) {
            if (mapaLocalizarMsg) {
              mapaLocalizarMsg.textContent = 'Endereco nao encontrado. Tente outro bairro ou apenas cidade e estado.';
              mapaLocalizarMsg.classList.remove('hidden');
            }
            return;
          }
          var lat = parseFloat(data[0].lat);
          var lon = parseFloat(data[0].lon);
          var displayName = data[0].display_name || query;
          if (locMarker && map.hasLayer(locMarker)) {
            map.removeLayer(locMarker);
          }
          locMarker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: 'custom-pin-localizar',
              html: '<div style="background:#ec5a1c;width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-location-dot" style="color:#fff;font-size:14px"></i></div>',
              iconSize: [36, 36],
              iconAnchor: [18, 18],
              popupAnchor: [0, -18]
            })
          }).addTo(map);
          locMarker.bindPopup('<div style="min-width:180px"><strong>Local buscado</strong><br><small style="color:#666">' + displayName.replace(/</g, '&lt;').substring(0, 120) + '</small></div>');
          map.setView([lat, lon], 14);
        })
        .catch(function () {
          btn.disabled = false;
          if (btnMostrarNoMapaText) btnMostrarNoMapaText.textContent = 'Mostrar no mapa';
          if (mapaLocalizarMsg) {
            mapaLocalizarMsg.textContent = 'Erro ao buscar endereco. Tente novamente.';
            mapaLocalizarMsg.classList.remove('hidden');
          }
        });
    });
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    }, function (err) {
      console.warn('[MAPA] Geoloc auto falhou:', err.code, err.message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }
})();
