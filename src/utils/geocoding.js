const logger = require('./logger');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'AIRPET/1.0 (pet-identification-system)';

let lastRequestTime = 0;

async function reverseGeocode(lat, lng) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();

  try {
    const url = `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&zoom=16&addressdetails=1`;

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt' },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      logger.warn('Geocoding', `Nominatim retornou status ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data || !data.address) return null;

    const { suburb, neighbourhood, city_district, city, town, village, state } = data.address;
    const bairro = suburb || neighbourhood || city_district || null;
    const cidade = city || town || village || null;

    if (bairro && cidade) return `${bairro}, ${cidade}`;
    if (bairro) return bairro;
    if (cidade && state) return `${cidade} - ${state}`;
    if (cidade) return cidade;

    return data.display_name ? data.display_name.split(',').slice(0, 3).join(',').trim() : null;
  } catch (erro) {
    logger.error('Geocoding', 'Erro no reverse geocoding', erro);
    return null;
  }
}

module.exports = { reverseGeocode };
