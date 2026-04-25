(function () {
  'use strict';

  function mapaDeferred(workFn, message) {
    var L = window.AIRPET_LOADING;
    if (L && typeof L.withDeferredOverlay === 'function') {
      return L.withDeferredOverlay(workFn, { message: message || 'Ainda a processar…' });
    }
    return Promise.resolve().then(workFn);
  }

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
    showCoverageOnHover: false,
    disableClusteringAtZoom: 17
  });
  map.addLayer(clusterGroup);

  /* ─── Ícones genéricos ─── */
  var iconConfig = {
    petshop:         { color: '#10b981', icon: 'fa-store' },
    ponto_interesse: { color: '#3b82f6', icon: 'fa-map-pin' },
    pet_perdido:     { color: '#dc2626', icon: 'fa-triangle-exclamation' },
    avistamento:     { color: '#f59e0b', icon: 'fa-eye' },
    pet_scan:        { color: '#ec5a1c', icon: 'fa-paw' },
    pet_seguido:     { color: '#8b5cf6', icon: 'fa-heart' },
    default:         { color: '#6b7280', icon: 'fa-map-pin' }
  };

  var layerMapping = {
    petshops:   'petshop',
    perdidos:   'pet_perdido',
    avistamentos: 'avistamento',
    pontos:     'ponto_interesse',
    pet_scans:  'pet_scan',
    social:     'pet_seguido'
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

  /* ─── Pin personalizado com foto do pet ─── */
  function makePetPhotoIcon(foto, petStatus, horasAtras) {
    var borderColor;
    if (petStatus === 'perdido') {
      borderColor = '#dc2626'; // vermelho: perdido
    } else if (horasAtras !== null && horasAtras > 48) {
      borderColor = '#9ca3af'; // cinza: localização antiga (>48h)
    } else {
      borderColor = '#ec5a1c'; // laranja: ativo e recente
    }

    var shadow = petStatus === 'perdido'
      ? '0 0 0 3px rgba(220,38,38,0.25), 0 2px 8px rgba(0,0,0,.3)'
      : '0 2px 8px rgba(0,0,0,.3)';

    var inner;
    if (foto) {
      // Escapa a URL para uso seguro dentro do HTML inline
      var safeUrl = foto.replace(/"/g, '&quot;');
      var fallbackHtml = '<div style=\\"background:' + borderColor + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:50%\\"><i class=\\"fa-solid fa-paw\\" style=\\"color:#fff;font-size:14px\\"></i></div>';
      inner = '<img src="' + safeUrl + '" loading="lazy" '
        + 'style="width:100%;height:100%;object-fit:cover;border-radius:50%" '
        + 'onerror="this.outerHTML=\'' + fallbackHtml + '\'">';
    } else {
      inner = '<div style="background:' + borderColor + ';width:100%;height:100%;'
        + 'display:flex;align-items:center;justify-content:center;border-radius:50%">'
        + '<i class="fa-solid fa-paw" style="color:#fff;font-size:14px"></i></div>';
    }

    var lostRing = petStatus === 'perdido'
      ? '<div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid #dc2626;opacity:.5;animation:petPinRing 1.6s ease-in-out infinite"></div>'
      : '';

    return L.divIcon({
      className: 'pet-photo-pin',
      html: '<div style="position:relative;width:44px;height:44px">'
        + lostRing
        + '<div style="width:44px;height:44px;border-radius:50%;border:3px solid ' + borderColor + ';overflow:hidden;box-shadow:' + shadow + '">'
        + inner
        + '</div></div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -26]
    });
  }

  /* ─── Bottom Sheet ─── */
  var bottomSheet = document.getElementById('mapaBottomSheet');
  var bsContent   = document.getElementById('mapaBottomSheetContent');
  var bsClose     = document.getElementById('mapaBottomSheetClose');

  function abrirBottomSheet(html) {
    if (!bottomSheet || !bsContent) return;
    bsContent.innerHTML = html;
    bottomSheet.classList.remove('hidden');
    bottomSheet.classList.add('active');
  }

  function fecharBottomSheet() {
    if (!bottomSheet) return;
    bottomSheet.classList.remove('active');
    setTimeout(function() { bottomSheet.classList.add('hidden'); }, 280);
  }

  if (bsClose) bsClose.addEventListener('click', fecharBottomSheet);
  if (bottomSheet) {
    bottomSheet.addEventListener('click', function(e) {
      if (e.target === bottomSheet) fecharBottomSheet();
    });
  }

  function tempoAtras(isoDate) {
    if (!isoDate) return '';
    var diff = (Date.now() - new Date(isoDate).getTime()) / 1000;
    if (diff < 60) return 'agora';
    if (diff < 3600) return Math.floor(diff / 60) + 'min atrás';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h atrás';
    return Math.floor(diff / 86400) + 'd atrás';
  }

  function gerarLinkRota(lat, lng) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
  }

  function buildBottomSheetHtml(props, lat, lng) {
    var tipo = props.tipo || 'default';
    var html = '';

    if (tipo === 'pet_scan' || tipo === 'pet_seguido') {
      var statusBadge = props.pet_status === 'perdido'
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.04em;animation:petPinRing 1.4s ease-in-out infinite">'
          + '<i class="fa-solid fa-triangle-exclamation" style="font-size:9px"></i> PERDIDO</span> '
        : '';
      var fotoHtml = props.foto
        ? '<img src="' + props.foto.replace(/"/g, '&quot;') + '" loading="lazy" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #f3f4f6">'
        : '<div style="width:52px;height:52px;border-radius:12px;background:#f97316;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-paw" style="color:#fff;font-size:20px"></i></div>';
      var cidadeHtml = props.cidade
        ? '<p style="font-size:12px;color:#6b7280;margin-top:3px"><i class="fa-solid fa-map-pin" style="color:#ec5a1c;font-size:10px;margin-right:3px"></i>' + esc(props.cidade) + '</p>'
        : '';
      var dataHtml = props.data
        ? '<p style="font-size:12px;color:#6b7280;margin-top:2px"><i class="fa-regular fa-clock" style="font-size:10px;margin-right:3px"></i>Visto ' + tempoAtras(props.data) + '</p>'
        : '';
      html = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">'
        + fotoHtml
        + '<div style="flex:1;min-width:0">'
        + statusBadge
        + '<p style="font-size:16px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(props.nome || 'Pet') + '</p>'
        + cidadeHtml + dataHtml
        + '</div></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
        + '<a href="/pets/' + encodeURIComponent(props.id) + '" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#ec5a1c;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-paw"></i> Ver perfil</a>'
        + '<a href="' + gerarLinkRota(lat, lng) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-diamond-turn-right"></i> Rota</a>'
        + '</div>';

    } else if (tipo === 'petshop') {
      var logoHtml = props.imagem_url
        ? '<img src="' + props.imagem_url.replace(/"/g, '&quot;') + '" loading="lazy" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #f3f4f6">'
        : '<div style="width:52px;height:52px;border-radius:12px;background:#10b981;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-store" style="color:#fff;font-size:20px"></i></div>';
      var telHtml = props.telefone
        ? '<a href="tel:' + esc(props.telefone) + '" style="font-size:12px;color:#ec5a1c;margin-top:3px;display:block"><i class="fa-solid fa-phone" style="font-size:10px;margin-right:3px"></i>' + esc(props.telefone) + '</a>'
        : '';
      html = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">'
        + logoHtml
        + '<div style="flex:1;min-width:0">'
        + '<p style="font-size:16px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(props.nome || 'Petshop') + '</p>'
        + (props.endereco ? '<p style="font-size:12px;color:#6b7280;margin-top:2px">' + esc(props.endereco) + '</p>' : '')
        + telHtml
        + '</div></div>'
        + '<a href="' + esc(props.perfil_url || '#') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#10b981;color:#fff;font-weight:600;font-size:13px;text-decoration:none;width:100%"><i class="fa-solid fa-store"></i> Ver petshop</a>';

    } else if (tipo === 'pet_perdido') {
      var pfoto = props.foto
        ? '<img src="' + props.foto.replace(/"/g, '&quot;') + '" loading="lazy" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #fecaca">'
        : '<div style="width:52px;height:52px;border-radius:12px;background:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-triangle-exclamation" style="color:#fff;font-size:20px"></i></div>';
      html = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">'
        + pfoto
        + '<div style="flex:1;min-width:0">'
        + '<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-bottom:4px">🚨 PERDIDO</span>'
        + '<p style="font-size:16px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(props.nome || 'Pet') + '</p>'
        + (props.dono ? '<p style="font-size:12px;color:#6b7280;margin-top:2px">Tutor: ' + esc(props.dono) + '</p>' : '')
        + '</div></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
        + '<a href="/pets-perdidos" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#dc2626;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-triangle-exclamation"></i> Ver alerta</a>'
        + '<a href="' + gerarLinkRota(lat, lng) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#1d4ed8;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-diamond-turn-right"></i> Rota</a>'
        + '</div>';

    } else {
      html = '<p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:8px">' + esc(props.nome || 'Ponto') + '</p>'
        + (props.endereco ? '<p style="font-size:13px;color:#6b7280">' + esc(props.endereco) + '</p>' : '');
    }

    return html;
  }

  function esc(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  /* ─── Estado dos layers ─── */
  var loadedIds = {};
  var markers = {};
  var activeLayers = {
    petshops: true,
    perdidos: true,
    avistamentos: true,
    pontos: false,
    pet_scans: true,
    social: false
  };
  var locMarker = null;

  var debounceTimer = null;
  function debounce(fn, delay) {
    return function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fn, delay);
    };
  }

  function quantizeCoord(n, digits) {
    var d = digits == null ? 2 : digits;
    var factor = Math.pow(10, d);
    return Math.round(n * factor) / factor;
  }

  var currentBBoxKey = null;

  function isLayerVisible(tipo) {
    for (var key in layerMapping) {
      if (layerMapping[key] === tipo) return activeLayers[key] !== false;
    }
    return true;
  }

  /* ─── Renderiza features GeoJSON no mapa ─── */
  function renderFeatures(data, tipoOverride) {
    var features = data && (data.features || data) ? (data.features || data) : [];
    if (!Array.isArray(features)) return;

    features.forEach(function (feature) {
      var props = feature.properties || feature;
      var geom  = feature.geometry;

      // Para a camada social o tipo vem do servidor como 'pet_seguido'
      if (tipoOverride) props = Object.assign({}, props, { tipo: tipoOverride });

      var tipo = props.tipo || props.categoria || 'default';
      var id   = props.id + '_' + tipo;
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

      var icon;
      if (tipo === 'pet_scan' || tipo === 'pet_seguido') {
        icon = makePetPhotoIcon(props.foto, props.pet_status, props.horas_atras);
      } else {
        icon = makeIcon(tipo);
      }

      var marker = L.marker([lat, lng], { icon: icon });
      marker._airpetTipo  = tipo;
      marker._airpetProps = props;
      marker._airpetLat   = lat;
      marker._airpetLng   = lng;

      marker.on('click', function () {
        abrirBottomSheet(buildBottomSheetHtml(props, lat, lng));
      });

      markers[id] = marker;

      if (isLayerVisible(tipo)) {
        clusterGroup.addLayer(marker);
      }
    });
  }

  /* ─── Adiciona ou atualiza um pin de pet em tempo real (SSE) ─── */
  function upsertPetScanPin(data) {
    var id = data.petId + '_pet_scan';
    if (markers[id]) {
      // Remove marcador antigo e desfaz o cache para permitir re-render
      clusterGroup.removeLayer(markers[id]);
      delete markers[id];
      delete loadedIds[id];
    }
    renderFeatures([{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [data.lng, data.lat] },
      properties: {
        id: data.petId,
        tipo: 'pet_scan',
        nome: data.nome || 'Pet',
        foto: data.foto || null,
        pet_status: data.petStatus || 'ativo',
        cidade: data.cidade || null,
        data: new Date().toISOString(),
        horas_atras: 0
      }
    }]);
  }

  /* ─── Fetch de pins (polling) ─── */
  function fetchPins() {
    var bounds = map.getBounds();
    var swLat = bounds.getSouthWest().lat;
    var swLng = bounds.getSouthWest().lng;
    var neLat = bounds.getNorthEast().lat;
    var neLng = bounds.getNorthEast().lng;
    var params = new URLSearchParams({ swLat: swLat, swLng: swLng, neLat: neLat, neLng: neLng });

    var bboxKey = [
      quantizeCoord(swLat), quantizeCoord(swLng),
      quantizeCoord(neLat), quantizeCoord(neLng)
    ].join(',');

    currentBBoxKey = bboxKey;
    var requestKey = 'mapPins:' + bboxKey;

    if (globalThis.AIRPET_REQ_COORDINATOR && requestKey) {
      try { globalThis.AIRPET_REQ_COORDINATOR.cancelGroup('mapPins'); } catch (_) {}
    }

    if (typeof swrFetchGet === 'function') {
      swrFetchGet({
        key: requestKey,
        url: '/mapa/api/pins?' + params.toString(),
        priority: globalThis.AIRPET_REQ_COORDINATOR && globalThis.AIRPET_REQ_COORDINATOR.PRIORITY
          ? globalThis.AIRPET_REQ_COORDINATOR.PRIORITY.HIGH : 'HIGH',
        staleTimeMs: 120000,  // 2 min
        cacheTimeMs: 300000,  // 5 min
        group: 'mapPins',
        onUpdate: function (data) {
          if (!currentBBoxKey || requestKey !== ('mapPins:' + currentBBoxKey)) return;
          renderFeatures(data);
        }
      }).then(function (res) {
        renderFeatures(res.data);
      }).catch(function () {
        if (Object.keys(markers).length === 0) mostrarErroPinsRede();
      });
      return;
    }

    fetch('/mapa/api/pins?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(renderFeatures)
      .catch(function (err) {
        console.error('[MAPA] Erro ao carregar pins:', err);
        if (Object.keys(markers).length === 0) mostrarErroPinsRede();
      });
  }

  /* ─── Fetch da camada social ─── */
  function fetchSocialPins() {
    if (!activeLayers.social) return;
    fetch('/mapa/api/pins/social', { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) {
          // Não logado — desativar camada silenciosamente
          activeLayers.social = false;
          var btn = document.querySelector('[data-layer="social"]');
          if (btn) btn.classList.remove('active');
          return null;
        }
        return res.json();
      })
      .then(function (data) {
        if (data) renderFeatures(data, 'pet_seguido');
      })
      .catch(function (err) {
        console.warn('[MAPA] Erro ao carregar pets seguidos:', err);
      });
  }

  /* ─── Toggle de camada ─── */
  function toggleLayer(layerName) {
    activeLayers[layerName] = !activeLayers[layerName];
    var tipoAlvo = layerMapping[layerName];

    // Carregar pins sociais sob demanda ao ativar
    if (layerName === 'social' && activeLayers.social) {
      fetchSocialPins();
    }

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

  /* ─── SSE: atualizações em tempo real ─── */
  var _sseRetryCount = 0;
  var _sseRetryTimer = null;

  function conectarSSE() {
    if (!window.EventSource) return;

    var bounds = map.getBounds();
    var swLat = bounds.getSouthWest().lat;
    var swLng = bounds.getSouthWest().lng;
    var neLat = bounds.getNorthEast().lat;
    var neLng = bounds.getNorthEast().lng;

    var url = '/mapa/api/stream?swLat=' + swLat + '&swLng=' + swLng
      + '&neLat=' + neLat + '&neLng=' + neLng;

    var es = new EventSource(url);

    es.addEventListener('nfc_scan', function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data && data.lat && data.lng) {
          upsertPetScanPin(data);
        }
      } catch (_) {}
    });

    es.addEventListener('close', function () { es.close(); });

    es.onerror = function () {
      es.close();
      _sseRetryCount++;
      var delay = Math.min(5000 * Math.pow(2, _sseRetryCount - 1), 60000);
      clearTimeout(_sseRetryTimer);
      _sseRetryTimer = setTimeout(conectarSSE, delay);
    };

    es.onopen = function () { _sseRetryCount = 0; };

    // Reconectar ao mover o mapa (nova bbox pode ter outros pets)
    map.once('moveend', function () { es.close(); });
  }

  // Iniciar SSE após a primeira carga dos pins
  setTimeout(conectarSSE, 2000);
  map.on('moveend', debounce(function () {
    clearTimeout(_sseRetryTimer);
    fetchPins();
    setTimeout(conectarSSE, 500);
  }, 400));

  /* ─── Botão de localização ─── */
  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var btnLoc = document.getElementById('btnMinhaLocalizacao');
  if (btnLoc) {
    btnLoc.addEventListener('click', function () {
      if (!navigator.geolocation) { mostrarErroGeo({ code: 1 }); return; }
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

  /* ─── Toasts de erro ─── */
  function mostrarErroPinsRede() {
    var toast = document.getElementById('airpet-mapa-pins-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'airpet-mapa-pins-toast';
    toast.style.cssText = 'position:fixed;bottom:88px;left:16px;right:16px;z-index:9999;background:#7c2d12;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:420px;margin:0 auto;animation:slideUpMapaToast 0.3s ease-out;font-size:13px;line-height:1.5;';
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px;">'
        + '<i class="fa-solid fa-wifi" style="font-size:18px;margin-top:2px;flex-shrink:0;opacity:.9"></i>'
        + '<div><strong>Não foi possível carregar os pontos</strong><br>'
        + '<span style="opacity:.92">Verifique a ligação à internet e mova ou amplie o mapa para tentar de novo.</span></div>'
        + '<button type="button" aria-label="Fechar" onclick="this.parentNode.parentNode.remove()" style="background:none;border:none;color:#fdba74;font-size:18px;cursor:pointer;flex-shrink:0;padding:0 0 0 4px;">✕</button>'
      + '</div>';

    var styleEl = document.getElementById('airpet-mapa-toast-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'airpet-mapa-toast-style';
      styleEl.textContent = '@keyframes slideUpMapaToast{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}'
        + '@keyframes petPinRing{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.4)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}';
      document.head.appendChild(styleEl);
    }
    document.body.appendChild(toast);

    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.transition = 'opacity 0.3s';
        toast.style.opacity = '0';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 10000);
  }

  function mostrarErroGeo(err) {
    if (!err || err.code !== 1) return;
    if (!_isIOS) return;
    var toast = document.getElementById('airpet-geo-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'airpet-geo-toast';
    toast.style.cssText = 'position:fixed;top:16px;left:16px;right:16px;z-index:9999;background:#1e40af;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);max-width:420px;margin:0 auto;animation:slideDown 0.3s ease-out;font-size:13px;line-height:1.5;';
    toast.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:10px;">'
        + '<i class="fa-solid fa-location-dot" style="font-size:18px;margin-top:2px;flex-shrink:0;"></i>'
        + '<div><strong>Localização bloqueada</strong><br>'
        + 'No iPhone, vá em <strong>Ajustes → Privacidade → Serviços de Localização → Safari</strong> e selecione "Ao Usar o App".</div>'
        + '<button onclick="this.parentNode.parentNode.remove()" style="background:none;border:none;color:#93c5fd;font-size:18px;cursor:pointer;flex-shrink:0;padding:0 0 0 4px;">✕</button>'
      + '</div>';

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

  /* ─── Localizar por Estado / Cidade / Bairro ─── */
  var painelLocalizar    = document.getElementById('painelLocalizar');
  var btnToggleLocalizar = document.getElementById('btnToggleLocalizar');
  if (btnToggleLocalizar && painelLocalizar) {
    if (window.matchMedia('(max-width: 767px)').matches) {
      painelLocalizar.classList.add('collapsed');
    }
    btnToggleLocalizar.addEventListener('click', function () {
      painelLocalizar.classList.toggle('collapsed');
    });
  }

  var mapaEstado        = document.getElementById('mapaEstado');
  var mapaCidade        = document.getElementById('mapaCidade');
  var mapaBairro        = document.getElementById('mapaBairro');
  var btnMostrarNoMapa  = document.getElementById('btnMostrarNoMapa');
  var btnMostrarNoMapaText = document.getElementById('btnMostrarNoMapaText');
  var mapaLocalizarMsg  = document.getElementById('mapaLocalizarMsg');

  function atualizarBtnMostrarNoMapa() {
    var estado = mapaEstado && mapaEstado.value;
    var cidade = mapaCidade && mapaCidade.value;
    if (btnMostrarNoMapa) btnMostrarNoMapa.disabled = !estado || !cidade;
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

  if (mapaCidade) mapaCidade.addEventListener('change', atualizarBtnMostrarNoMapa);

  if (btnMostrarNoMapa) {
    btnMostrarNoMapa.addEventListener('click', function () {
      if (this.disabled) return;
      var estadoOpt = mapaEstado && mapaEstado.options[mapaEstado.selectedIndex];
      var sigla  = estadoOpt ? estadoOpt.getAttribute('data-sigla') : '';
      var cidade = mapaCidade ? mapaCidade.value.trim() : '';
      var bairro = mapaBairro ? mapaBairro.value.trim() : '';
      if (!sigla || !cidade) return;
      var queryStr = bairro
        ? bairro + ', ' + cidade + ', ' + sigla + ', Brasil'
        : cidade + ', ' + sigla + ', Brasil';
      if (mapaLocalizarMsg) { mapaLocalizarMsg.classList.add('hidden'); mapaLocalizarMsg.textContent = ''; }
      this.disabled = true;
      if (btnMostrarNoMapaText) btnMostrarNoMapaText.textContent = 'Buscando...';
      var btn = this;
      mapaDeferred(function () {
        return fetch('https://nominatim.openstreetmap.org/search?format=json&q='
          + encodeURIComponent(queryStr) + '&limit=1&countrycodes=br', {
          headers: { 'Accept': 'application/json', 'Accept-Language': 'pt-BR', 'User-Agent': 'AIRPET/1.0 (mapa localizar)' }
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data || !data.length) {
              if (mapaLocalizarMsg) {
                mapaLocalizarMsg.textContent = 'Endereco nao encontrado. Tente outro bairro ou apenas cidade e estado.';
                mapaLocalizarMsg.classList.remove('hidden');
              }
              return;
            }
            var lat = parseFloat(data[0].lat);
            var lon = parseFloat(data[0].lon);
            var displayName = data[0].display_name || queryStr;
            if (locMarker && map.hasLayer(locMarker)) map.removeLayer(locMarker);
            locMarker = L.marker([lat, lon], {
              icon: L.divIcon({
                className: 'custom-pin-localizar',
                html: '<div style="background:#ec5a1c;width:36px;height:36px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-location-dot" style="color:#fff;font-size:14px"></i></div>',
                iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -18]
              })
            }).addTo(map);
            locMarker.bindPopup('<div style="min-width:180px"><strong>Local buscado</strong><br><small style="color:#666">'
              + displayName.replace(/</g, '&lt;').substring(0, 120) + '</small></div>');
            map.setView([lat, lon], 14);
          })
          .catch(function () {
            if (mapaLocalizarMsg) {
              mapaLocalizarMsg.textContent = 'Erro ao buscar endereco. Tente novamente.';
              mapaLocalizarMsg.classList.remove('hidden');
            }
            throw new Error('nominatim');
          });
      }, 'A localizar no mapa…')
        .finally(function () {
          btn.disabled = false;
          if (btnMostrarNoMapaText) btnMostrarNoMapaText.textContent = 'Mostrar no mapa';
        });
    });
  }

  /* ─── Auto-localizar ao abrir ─── */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      map.setView([pos.coords.latitude, pos.coords.longitude], 13);
    }, function (err) {
      // Fallback: São Paulo em vez do Brasil inteiro
      map.setView([-23.5505, -46.6333], 12);
      console.warn('[MAPA] Geoloc auto falhou:', err.code, err.message);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  /* ─── Iniciar ─── */
  fetchPins();
})();
