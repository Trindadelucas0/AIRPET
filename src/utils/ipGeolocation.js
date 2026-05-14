/**
 * Geolocalização aproximada pelo endereço IP (HTTP / servidor).
 * Usada no scan público da tag NFC para não depender de navigator.geolocation.
 */

const logger = require('./logger');

function normalizeClientIp(ip) {
  if (!ip || typeof ip !== 'string') return null;
  let s = ip.trim();
  if (s.startsWith('::ffff:')) s = s.slice(7);
  if (s === '::1' || s === '127.0.0.1') return null;
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(s)) return null;
  return s;
}

/**
 * @param {string} reqIp - req.ip ou equivalente
 * @returns {Promise<{ latitude: number, longitude: number, cidade: string|null }|null>}
 */
async function lookupApproximate(reqIp) {
  const ip = normalizeClientIp(reqIp);
  if (!ip) return null;

  try {
    const url = 'https://ipwho.is/' + encodeURIComponent(ip);
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) {
      logger.warn('IpGeolocation', `ipwho.is status ${response.status} para ${ip}`);
      return null;
    }
    const data = await response.json();
    if (!data || data.success !== true) return null;

    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

    var cidade = null;
    if (data.city && data.region) cidade = data.city + ' - ' + data.region;
    else if (data.city) cidade = data.city;
    else if (data.region) cidade = data.region;
    else if (data.country) cidade = data.country;

    return { latitude: lat, longitude: lng, cidade: cidade || null };
  } catch (e) {
    logger.warn('IpGeolocation', e && e.message ? e.message : 'lookup falhou');
    return null;
  }
}

function cookieNameForTagIpGeo(tagCode) {
  var safe = String(tagCode || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  return 'airpet_nfi_' + safe;
}

module.exports = {
  normalizeClientIp,
  lookupApproximate,
  cookieNameForTagIpGeo,
};
