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
 * - Pet **perdido** ou alerta aprovado: sempre no mapa (recuperação), mesmo perfil privado.
 * - Demais: perfil **não** privado e sem opt-out explícito em `mostrar_ultimo_avistamento_mapa`
 *   (coluna em `pets`; default `true` desde a migration 1776270000000 — só oculta quando o
 *   tutor desliga explicitamente nas preferências do pet).
 */
function petScanElegivelMapaPublico(row) {
  if (!row) return false;
  const alertaAprovado =
    row.tem_alerta_perdido_aprovado === true ||
    row.tem_alerta_perdido_aprovado === 't';
  if (row.pet_status === 'perdido' || alertaAprovado) return true;
  if (row.privado === true || row.privado === 't') return false;
  if (row.mostrar_ultimo_avistamento_mapa === false || row.mostrar_ultimo_avistamento_mapa === 'f') return false;
  return true;
}

module.exports = {
  obfuscateLatLng,
  labelLocal,
  petScanElegivelMapaPublico,
};
