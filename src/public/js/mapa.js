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
    disableClusteringAtZoom: 17,
    iconCreateFunction: function (cluster) {
      var childMarkers = cluster.getAllChildMarkers();
      var hasLost = false;
      for (var i = 0; i < childMarkers.length; i++) {
        var p = childMarkers[i]._airpetProps;
        if (p && (p.pet_status === 'perdido' || p.tipo === 'pet_perdido')) {
          hasLost = true;
          break;
        }
      }
      var n = cluster.getChildCount();
      var size = hasLost ? 52 : 44;
      var bg = hasLost ? '#dc2626' : '#ec5a1c';
      var ring = hasLost ? '0 0 0 4px rgba(220,38,38,0.35)' : '0 2px 10px rgba(0,0,0,.28)';
      return L.divIcon({
        className: 'airpet-cluster-ico',
        html: '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + bg + ';color:#fff;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:' + ring + '">' + n + '</div>',
        iconSize: L.point(size, size),
      });
    },
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
    social:     'pet_seguido',
    heatmap:    '__heatmap__'
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

  /** Miniatura no mapa: mesmo “cartão” 52px do bottom sheet dos petshops (borda + sombra), âncora na base. */
  var MAP_THUMB = 52;
  var MAP_THUMB_R = 12;

  function makePetPhotoIcon(foto, petStatus, horasAtras, iconOpts) {
    iconOpts = iconOpts || {};
    var accent = iconOpts.accent === 'social' ? 'social' : 'pet';
    var ringColor;
    if (petStatus === 'perdido') ringColor = '#dc2626';
    else if (horasAtras !== null && horasAtras > 48) ringColor = '#9ca3af';
    else if (accent === 'social') ringColor = '#8b5cf6';
    else ringColor = '#ec5a1c';

    var fotoUrl = resolveMapAssetUrl(foto);
    var shadow = petStatus === 'perdido'
      ? '0 4px 14px rgba(220,38,38,0.35), 0 2px 8px rgba(0,0,0,.2)'
      : '0 4px 14px rgba(15,23,42,0.12), 0 2px 8px rgba(0,0,0,.18)';

    var inner;
    if (fotoUrl) {
      var safeUrl = fotoUrl.replace(/"/g, '&quot;');
      var fb = '<div style=\\"background:' + ringColor + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:' + MAP_THUMB_R + 'px\\"><i class=\\"fa-solid fa-paw\\" style=\\"color:#fff;font-size:20px\\"></i></div>';
      inner = '<img src="' + safeUrl + '" loading="lazy" referrerpolicy="no-referrer" '
        + 'style="width:100%;height:100%;object-fit:cover;border-radius:' + (MAP_THUMB_R - 2) + 'px;display:block" '
        + 'onerror="this.outerHTML=\'' + fb + '\'">';
    } else {
      inner = '<div style="background:' + ringColor + ';width:100%;height:100%;'
        + 'display:flex;align-items:center;justify-content:center;border-radius:' + (MAP_THUMB_R - 2) + 'px">'
        + '<i class="fa-solid fa-paw" style="color:#fff;font-size:20px"></i></div>';
    }

    var lostRing = petStatus === 'perdido'
      ? '<div style="position:absolute;inset:-3px;border-radius:' + (MAP_THUMB_R + 2) + 'px;border:2px solid #dc2626;opacity:.55;animation:petPinRing 1.6s ease-in-out infinite;pointer-events:none"></div>'
      : '';

    return L.divIcon({
      className: 'pet-photo-pin',
      html: '<div style="position:relative;width:' + MAP_THUMB + 'px;height:' + MAP_THUMB + 'px">'
        + lostRing
        + '<div style="width:' + MAP_THUMB + 'px;height:' + MAP_THUMB + 'px;border-radius:' + MAP_THUMB_R + 'px;'
        + 'border:2px solid #f3f4f6;box-shadow:' + shadow + ';outline:3px solid ' + ringColor + ';outline-offset:0;overflow:hidden;background:#fff">'
        + inner
        + '</div></div>',
      iconSize: [MAP_THUMB, MAP_THUMB],
      iconAnchor: [MAP_THUMB / 2, MAP_THUMB],
      popupAnchor: [0, -MAP_THUMB - 4]
    });
  }

  function makePetshopPhotoIcon(imagemUrl) {
    var url = resolveMapAssetUrl(imagemUrl);
    var ring = '#10b981';
    var shadow = '0 4px 14px rgba(16,185,129,0.22), 0 2px 8px rgba(0,0,0,.15)';
    var inner;
    if (url) {
      var safe = url.replace(/"/g, '&quot;');
      var fb = '<div style=\\"background:' + ring + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:' + MAP_THUMB_R + 'px\\"><i class=\\"fa-solid fa-store\\" style=\\"color:#fff;font-size:20px\\"></i></div>';
      inner = '<img src="' + safe + '" loading="lazy" referrerpolicy="no-referrer" '
        + 'style="width:100%;height:100%;object-fit:cover;border-radius:' + (MAP_THUMB_R - 2) + 'px;display:block" '
        + 'onerror="this.outerHTML=\'' + fb + '\'">';
    } else {
      inner = '<div style="background:' + ring + ';width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:' + (MAP_THUMB_R - 2) + 'px">'
        + '<i class="fa-solid fa-store" style="color:#fff;font-size:20px"></i></div>';
    }
    return L.divIcon({
      className: 'pet-photo-pin',
      html: '<div style="position:relative;width:' + MAP_THUMB + 'px;height:' + MAP_THUMB + 'px">'
        + '<div style="width:' + MAP_THUMB + 'px;height:' + MAP_THUMB + 'px;border-radius:' + MAP_THUMB_R + 'px;'
        + 'border:2px solid #f3f4f6;box-shadow:' + shadow + ';outline:3px solid ' + ring + ';outline-offset:0;overflow:hidden;background:#fff">'
        + inner
        + '</div></div>',
      iconSize: [MAP_THUMB, MAP_THUMB],
      iconAnchor: [MAP_THUMB / 2, MAP_THUMB],
      popupAnchor: [0, -MAP_THUMB - 4]
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

  /** Abre a zona no Google Maps (coordenadas aproximadas do pin). */
  function gerarLinkRegiaoExterna(lat, lng) {
    var q = encodeURIComponent(String(lat) + ',' + String(lng));
    return 'https://www.google.com/maps?q=' + q + '&z=15';
  }

  function buildBottomSheetHtml(props, lat, lng) {
    var tipo = props.tipo || 'default';
    var html = '';

    if (tipo === 'pet_scan' || tipo === 'pet_seguido') {
      var statusBadge = props.pet_status === 'perdido'
        ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.04em;animation:petPinRing 1.4s ease-in-out infinite">'
          + '<i class="fa-solid fa-triangle-exclamation" style="font-size:9px"></i> PERDIDO</span> '
        : '';
      var fotoUrl = resolveMapAssetUrl(props.foto);
      var fotoHtml = fotoUrl
        ? '<img src="' + fotoUrl.replace(/"/g, '&quot;') + '" loading="lazy" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #f3f4f6">'
        : '<div style="width:52px;height:52px;border-radius:12px;background:#f97316;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-paw" style="color:#fff;font-size:20px"></i></div>';
      var localLabel = props.label_local || props.cidade || 'Região aproximada';
      var localHtml = '<p style="font-size:12px;color:#6b7280;margin-top:3px"><i class="fa-solid fa-map-pin" style="color:#ec5a1c;font-size:10px;margin-right:3px"></i>Última vez visto em: ' + esc(localLabel) + '</p>';
      var dataHtml = props.data
        ? '<p style="font-size:12px;color:#6b7280;margin-top:2px"><i class="fa-regular fa-clock" style="font-size:10px;margin-right:3px"></i>' + esc(tempoAtras(props.data)) + '</p>'
        : '';
      var perfilHref = String(props.perfil_url || ('/pets/' + props.id)).replace(/"/g, '&quot;');
      html = '<p style="font-size:11px;color:#64748b;margin:0 0 10px;line-height:1.45">A localização reflete um escaneamento da tag com GPS do celular de quem encontrou — não é rastreamento em tempo real do pet.</p>'
        + '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">'
        + fotoHtml
        + '<div style="flex:1;min-width:0">'
        + statusBadge
        + '<p style="font-size:16px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(props.nome || 'Pet') + '</p>'
        + localHtml + dataHtml
        + '</div></div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
        + '<a href="' + perfilHref + '" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#ec5a1c;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-paw"></i> Ver perfil</a>'
        + '<a href="' + perfilHref + '" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:12px;background:#0f766e;color:#fff;font-weight:600;font-size:13px;text-decoration:none"><i class="fa-solid fa-message"></i> Contatar tutor</a>'
        + '</div>'
        + '<a href="' + String(gerarLinkRegiaoExterna(lat, lng)).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 12px;border-radius:12px;border:2px solid #1d4ed8;background:#eff6ff;color:#1e3a8a;font-weight:700;font-size:13px;text-decoration:none;width:100%;box-sizing:border-box"><i class="fa-solid fa-map-location-dot" style="color:#1d4ed8"></i> Abrir no Google Maps</a>';

    } else if (tipo === 'petshop') {
      var logoResolved = resolveMapAssetUrl(props.imagem_url);
      var logoHtml = logoResolved
        ? '<img src="' + logoResolved.replace(/"/g, '&quot;') + '" loading="lazy" referrerpolicy="no-referrer" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #f3f4f6">'
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
      var perdFoto = resolveMapAssetUrl(props.foto);
      var pfoto = perdFoto
        ? '<img src="' + perdFoto.replace(/"/g, '&quot;') + '" loading="lazy" style="width:52px;height:52px;border-radius:12px;object-fit:cover;flex-shrink:0;border:2px solid #fecaca">'
        : '<div style="width:52px;height:52px;border-radius:12px;background:#dc2626;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fa-solid fa-triangle-exclamation" style="color:#fff;font-size:20px"></i></div>';
      html = '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">'
        + pfoto
        + '<div style="flex:1;min-width:0">'
        + '<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;margin-bottom:4px">🚨 PERDIDO</span>'
        + '<p style="font-size:16px;font-weight:700;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(props.nome || 'Pet') + '</p>'
        + (props.dono ? '<p style="font-size:12px;color:#6b7280;margin-top:2px">Tutor: ' + esc(props.dono) + '</p>' : '')
        + '</div></div>'
        + '<p style="font-size:11px;color:#64748b;margin:0 0 12px;line-height:1.45">O pin no AIRPET mostra uma <strong style="color:#475569">zona aproximada</strong> — não é a posição exata do pet em tempo real.</p>'
        + '<div style="display:flex;flex-direction:column;gap:10px">'
        + '<a href="/pets-perdidos" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 14px;border-radius:12px;background:#dc2626;color:#fff;font-weight:700;font-size:14px;text-decoration:none;box-shadow:0 4px 14px rgba(220,38,38,0.25)"><i class="fa-solid fa-triangle-exclamation"></i> Ver alerta</a>'
        + '<a href="' + String(gerarLinkRegiaoExterna(lat, lng)).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 14px;border-radius:12px;border:2px solid #1d4ed8;background:#eff6ff;color:#1e3a8a;font-weight:700;font-size:13px;text-decoration:none;box-sizing:border-box"><i class="fa-solid fa-map-location-dot" style="color:#1d4ed8"></i> Abrir no Google Maps</a>'
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
    social: typeof document !== 'undefined' && document.body && document.body.getAttribute('data-logado') === 'true',
    heatmap: false
  };
  var locMarker = null;

  var heatLayer = null;

  function removeHeatLayer() {
    if (heatLayer && map.hasLayer(heatLayer)) {
      map.removeLayer(heatLayer);
    }
    heatLayer = null;
  }

  function loadHeatmapPins() {
    if (!activeLayers.heatmap || typeof L.heatLayer !== 'function') return;
    var bounds = map.getBounds();
    var params = new URLSearchParams({
      swLat: bounds.getSouthWest().lat,
      swLng: bounds.getSouthWest().lng,
      neLat: bounds.getNorthEast().lat,
      neLng: bounds.getNorthEast().lng,
    });
    fetch('/mapa/api/heatmap-scans?' + params.toString())
      .then(function (res) { return res.json(); })
      .then(function (j) {
        if (!activeLayers.heatmap) return;
        removeHeatLayer();
        var pts = j.pontos || [];
        if (!pts.length) return;
        heatLayer = L.heatLayer(pts, { radius: 28, blur: 20, max: 0.85, minOpacity: 0.3 });
        map.addLayer(heatLayer);
      })
      .catch(function () {});
  }

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

  /** Limpa cache SWR dos pins para o próximo fetch ir à rede (ex.: após SSE nfc_scan). */
  function invalidateMapPinsSwrCache() {
    try {
      var C = globalThis.AIRPET_SWR_CACHE;
      if (C && typeof C.invalidateKeysContaining === 'function') {
        C.invalidateKeysContaining('mapPins');
      }
    } catch (_) {}
  }

  function isLayerVisible(tipo) {
    for (var key in layerMapping) {
      if (layerMapping[key] === tipo) return activeLayers[key] !== false;
    }
    return true;
  }

  /**
   * Resolve URL de imagem para o mapa (Leaflet + /mapa).
   * - Raiz relativa (/uploads/...) vira absoluta com origin (evita edge cases).
   * - Protocol-relative (//cdn...) recebe o protocolo da página.
   * - uploads/... sem barra inicial vira /uploads/...
   */
  function resolveMapAssetUrl(u) {
    if (u == null || u === '') return null;
    var s = String(u).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^\/\//.test(s)) {
      var pr = (typeof window !== 'undefined' && window.location && window.location.protocol) ? window.location.protocol : 'https:';
      s = pr + s;
      return s;
    }
    if (s.charAt(0) !== '/') s = '/' + s.replace(/^\.?\//, '');
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin + s;
    }
    return s;
  }

  function parseGeomLatLng(lat, lng) {
    var la = typeof lat === 'number' ? lat : parseFloat(lat);
    var lo = typeof lng === 'number' ? lng : parseFloat(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    return { lat: la, lng: lo };
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

      var latRaw, lngRaw;
      if (geom && geom.coordinates) {
        lngRaw = geom.coordinates[0];
        latRaw = geom.coordinates[1];
      } else {
        latRaw = props.latitude;
        lngRaw = props.longitude;
      }
      var coord = parseGeomLatLng(latRaw, lngRaw);
      if (!coord) return;

      if (loadedIds[id]) {
        if ((tipo === 'pet_scan' || tipo === 'pet_seguido') && markers[id]) {
          var mUp = markers[id];
          var iconUp = makePetPhotoIcon(props.foto, props.pet_status, props.horas_atras, {
            accent: tipo === 'pet_seguido' ? 'social' : 'pet'
          });
          mUp.setLatLng([coord.lat, coord.lng]);
          mUp.setIcon(iconUp);
          mUp._airpetProps = props;
          mUp._airpetLat = coord.lat;
          mUp._airpetLng = coord.lng;
          mUp.off('click');
          mUp.on('click', function () {
            abrirBottomSheet(buildBottomSheetHtml(props, coord.lat, coord.lng));
          });
          if (isLayerVisible(tipo) && clusterGroup && !clusterGroup.hasLayer(mUp)) {
            clusterGroup.addLayer(mUp);
          }
        }
        return;
      }
      loadedIds[id] = true;

      var lat = coord.lat;
      var lng = coord.lng;

      var icon;
      if (tipo === 'pet_scan' || tipo === 'pet_seguido') {
        icon = makePetPhotoIcon(props.foto, props.pet_status, props.horas_atras, {
          accent: tipo === 'pet_seguido' ? 'social' : 'pet'
        });
      } else if (tipo === 'petshop' && resolveMapAssetUrl(props.imagem_url)) {
        icon = makePetshopPhotoIcon(props.imagem_url);
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

  function animarMarcadorPara(marker, toLat, toLng, durationMs) {
    if (!marker || !marker.getLatLng) return;
    var from = marker.getLatLng();
    var t0 = Date.now();
    function step() {
      var t = Math.min(1, (Date.now() - t0) / (durationMs || 400));
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      marker.setLatLng([
        from.lat + (toLat - from.lat) * e,
        from.lng + (toLng - from.lng) * e,
      ]);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ─── Adiciona ou atualiza um pin de pet em tempo real (SSE) ─── */
  function upsertPetScanPin(data) {
    var id = data.petId + '_pet_scan';
    var lat = parseFloat(data.lat);
    var lng = parseFloat(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    var prev = markers[id];
    var startLL = prev && prev.getLatLng ? prev.getLatLng() : L.latLng(lat, lng);
    if (markers[id]) {
      clusterGroup.removeLayer(markers[id]);
      delete markers[id];
      delete loadedIds[id];
    }
    var scanIso = data.data ? String(data.data) : new Date(data.ts || Date.now()).toISOString();
    var slug = data.slug || null;
    renderFeatures([{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: data.petId,
        tipo: 'pet_scan',
        nome: data.nome || 'Pet',
        foto: data.foto || null,
        pet_status: data.petStatus || 'ativo',
        cidade: data.cidade || null,
        label_local: data.labelLocal || data.cidade || null,
        slug: slug,
        perfil_url: slug ? ('/p/' + encodeURIComponent(slug)) : ('/pets/' + encodeURIComponent(data.petId)),
        data: scanIso,
        horas_atras: 0,
      },
    }]);
    var m = markers[id];
    if (m && prev && startLL && (Math.abs(startLL.lat - lat) > 1e-7 || Math.abs(startLL.lng - lng) > 1e-7)) {
      m.setLatLng(startLL);
      animarMarcadorPara(m, lat, lng, 450);
    }
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
        staleTimeMs: 30000, // 30 s — pins mudam com scans; evita JSON “fresco” 2 min sem rede
        cacheTimeMs: 300000, // 5 min
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
    if (layerName === 'heatmap') {
      activeLayers.heatmap = !activeLayers.heatmap;
      if (!activeLayers.heatmap) removeHeatLayer();
      else loadHeatmapPins();
      return;
    }

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
        var la = data && parseFloat(data.lat);
        var lo = data && parseFloat(data.lng);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          upsertPetScanPin(data);
          invalidateMapPinsSwrCache();
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
    if (activeLayers.heatmap) loadHeatmapPins();
    setTimeout(conectarSSE, 500);
  }, 400));

  /* ─── Botão de localização ─── */
  var _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var btnLoc = document.getElementById('btnMinhaLocalizacao');
  if (btnLoc) {
    btnLoc.addEventListener('click', function () {
      var PS = window.airpetPermissionSheet;
      function doGeo() {
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
      }
      if (!PS || !PS.syncOsState) {
        doGeo();
        return;
      }
      PS.syncOsState('location').then(function (os) {
        if (os === 'granted') {
          doGeo();
          return;
        }
        var r = PS.getRecord('location');
        var wrap = mapEl && mapEl.parentNode;
        if (r.ui === 'denied_permanent' || os === 'denied') {
          if (wrap) PS.mountFallbackBanner(wrap, 'location');
          return;
        }
        return PS.showJitSheet('location').then(function (out) {
          if (out === 'granted') doGeo();
          else if (out === 'denied' || out === 'dismissed_permanent') {
            if (wrap) PS.mountFallbackBanner(wrap, 'location');
          }
        });
      });
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

  /* ─── Auto-localizar ao abrir (JIT via permissionSheet) ─── */
  function initUserLocationOnMap() {
    if (!navigator.geolocation) {
      map.setView([-23.5505, -46.6333], 12);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        map.setView([pos.coords.latitude, pos.coords.longitude], 13);
      },
      function (err) {
        map.setView([-23.5505, -46.6333], 12);
        console.warn('[MAPA] Geoloc auto falhou:', err.code, err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  var PS = window.airpetPermissionSheet;
  if (PS && typeof PS.mapPageBootstrap === 'function') {
    PS.mapPageBootstrap({
      mapContainer: mapEl && mapEl.parentNode,
      requestLocate: initUserLocationOnMap,
      defaultView: function () {
        map.setView([-23.5505, -46.6333], 12);
      }
    });
  } else {
    initUserLocationOnMap();
  }

  /* ─── Iniciar ─── */
  fetchPins();
  if (activeLayers.social) fetchSocialPins();
})();
