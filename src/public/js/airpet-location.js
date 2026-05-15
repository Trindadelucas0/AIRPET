(function () {
  'use strict';

  function hasValidCoords(lat, lng) {
    if (lat == null || lng == null || lat === '' || lng === '') return false;
    var la = Number(lat);
    var ln = Number(lng);
    return Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
  }

  function formatCoordPair(lat, lng, decimals) {
    var d = decimals == null ? 5 : decimals;
    return Number(lat).toFixed(d) + ', ' + Number(lng).toFixed(d);
  }

  function formatLocationLabel(opts) {
    opts = opts || {};
    var cidade = opts.cidade != null ? String(opts.cidade).trim() : '';
    if (cidade) return cidade;
    if (hasValidCoords(opts.latitude, opts.longitude)) {
      return formatCoordPair(opts.latitude, opts.longitude);
    }
    return opts.fallback || 'Localizacao nao informada';
  }

  function googleMapsViewUrl(lat, lng) {
    if (!hasValidCoords(lat, lng)) return '';
    var q = encodeURIComponent(String(lat) + ',' + String(lng));
    return 'https://www.google.com/maps?q=' + q + '&z=15';
  }

  function googleMapsDirectionsUrl(lat, lng) {
    if (!hasValidCoords(lat, lng)) return '';
    return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
  }

  function reverseGeocodeLabel(lat, lng) {
    if (!hasValidCoords(lat, lng)) return Promise.resolve(null);
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' +
      encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&accept-language=pt-BR&addressdetails=1';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return formatCoordPair(lat, lng);
        if (data.display_name) {
          return String(data.display_name).split(',').slice(0, 3).join(',').trim();
        }
        return formatCoordPair(lat, lng);
      })
      .catch(function () {
        return formatCoordPair(lat, lng);
      });
  }

  window.AIRPET_location = {
    hasValidCoords: hasValidCoords,
    formatCoordPair: formatCoordPair,
    formatLocationLabel: formatLocationLabel,
    googleMapsViewUrl: googleMapsViewUrl,
    googleMapsDirectionsUrl: googleMapsDirectionsUrl,
    reverseGeocodeLabel: reverseGeocodeLabel,
  };
})();
