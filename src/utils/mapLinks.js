/**
 * URLs e rótulos de localização (Google Maps + labels legíveis).
 */

function hasValidCoords(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return false;
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180;
}

function formatCoordPair(lat, lng, decimals) {
  const d = decimals == null ? 5 : decimals;
  return Number(lat).toFixed(d) + ', ' + Number(lng).toFixed(d);
}

/**
 * @param {{ cidade?: string|null, latitude?: *, longitude?: *, fallback?: string }} opts
 */
function formatLocationLabel(opts) {
  const o = opts || {};
  const cidade = o.cidade != null ? String(o.cidade).trim() : '';
  if (cidade) return cidade;
  if (hasValidCoords(o.latitude, o.longitude)) {
    return formatCoordPair(o.latitude, o.longitude);
  }
  return o.fallback || 'Localização não informada';
}

function googleMapsViewUrl(lat, lng) {
  if (!hasValidCoords(lat, lng)) return '';
  const q = encodeURIComponent(String(lat) + ',' + String(lng));
  return 'https://www.google.com/maps?q=' + q + '&z=15';
}

function googleMapsDirectionsUrl(lat, lng) {
  if (!hasValidCoords(lat, lng)) return '';
  return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
}

/** Enriquece scan ou alerta com label e URLs para views EJS (sem require no template). */
function enrichScan(scan, fallbackLabel) {
  if (!scan) return scan;
  const lat = scan.latitude;
  const lng = scan.longitude;
  const mapsUrl = googleMapsViewUrl(lat, lng);
  return Object.assign({}, scan, {
    locLabel: formatLocationLabel({
      cidade: scan.cidade,
      latitude: lat,
      longitude: lng,
      fallback: fallbackLabel || 'Leitura registrada (localização não informada)',
    }),
    mapsUrl,
    mapsDirectionsUrl: googleMapsDirectionsUrl(lat, lng),
    hasMaps: !!mapsUrl,
  });
}

function enrichAlerta(alerta) {
  if (!alerta) return alerta;
  const lat = alerta.latitude != null ? alerta.latitude : alerta.ultima_lat;
  const lng = alerta.longitude != null ? alerta.longitude : alerta.ultima_lng;
  const mapsUrl = googleMapsViewUrl(lat, lng);
  return Object.assign({}, alerta, {
    latitude: lat,
    longitude: lng,
    locLabel: formatLocationLabel({
      cidade: alerta.cidade,
      latitude: lat,
      longitude: lng,
      fallback: 'Sem localização',
    }),
    mapsUrl,
    mapsDirectionsUrl: googleMapsDirectionsUrl(lat, lng),
    hasMaps: !!mapsUrl,
  });
}

function enrichScans(lista, fallbackLabel) {
  if (!Array.isArray(lista)) return [];
  return lista.map((s) => enrichScan(s, fallbackLabel));
}

module.exports = {
  hasValidCoords,
  formatCoordPair,
  formatLocationLabel,
  googleMapsViewUrl,
  googleMapsDirectionsUrl,
  enrichScan,
  enrichAlerta,
  enrichScans,
};
