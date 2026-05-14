/**
 * mapaPrivacidadeService — Coordenadas públicas aproximadas e rótulos seguros para o mapa.
 *
 * Cada scan grava coords reais em tag_scans/localizacoes; o mapa público só expõe
 * pontos discretizados + jitter determinístico por pet (não é GPS do animal).
 */

const crypto = require('crypto');

const GRID_STEP = 0.003;
const JITTER_MAX = 0.0015;

function _bufPet(petId) {
  return crypto.createHash('sha256').update(String(petId)).digest();
}

function obfuscateLatLng(lat, lng, petId) {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
    return { lat: null, lng: null };
  }
  const buf = _bufPet(petId);
  const jLat = (buf[0] / 255 - 0.5) * 2 * JITTER_MAX;
  const jLng = (buf[1] / 255 - 0.5) * 2 * JITTER_MAX;
  const snappedLat = Math.round(latN / GRID_STEP) * GRID_STEP;
  const snappedLng = Math.round(lngN / GRID_STEP) * GRID_STEP;
  return {
    lat: snappedLat + jLat,
    lng: snappedLng + jLng,
  };
}

function labelLocal(cidade) {
  const c = cidade != null ? String(cidade).trim() : '';
  return c || 'Região aproximada';
}

/**
 * Pin público de último scan (tag_scans): não é rastreamento contínuo, só último avistamento ofuscado.
 *
 * - Pet **perdido** (`pets.status = 'perdido'` ou alerta aprovado em `pets_perdidos`, ver `tem_alerta_perdido_aprovado`):
 *   sempre elegível, **mesmo** com perfil privado (recuperação).
 * - Demais pets: elegíveis se o perfil **não** for privado (`privado === false`).
 * O campo legado `mostrar_ultimo_avistamento_mapa` **não** entra nesta regra.
 */
function petScanElegivelMapaPublico(row) {
  if (!row) return false;
  const alertaAprovado =
    row.tem_alerta_perdido_aprovado === true ||
    row.tem_alerta_perdido_aprovado === 't';
  if (row.pet_status === 'perdido' || alertaAprovado) return true;
  return !row.privado;
}

module.exports = {
  obfuscateLatLng,
  labelLocal,
  petScanElegivelMapaPublico,
};
