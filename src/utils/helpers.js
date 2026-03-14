/**
 * helpers.js — Funcoes utilitarias gerais do sistema
 *
 * Funcoes puras de formatacao, validacao e geracao de codigos
 * usadas em varios pontos da aplicacao.
 */

const crypto = require('crypto');

/**
 * Gera um codigo alfanumerico aleatorio no formato desejado.
 * Usado para tag_code e activation_code.
 *
 * @param {number} length - Tamanho do codigo
 * @returns {string} Codigo aleatorio em maiusculas
 */
function gerarCodigoAleatorio(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let resultado = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    resultado += chars[bytes[i] % chars.length];
  }
  return resultado;
}

/**
 * Gera tag_code no formato PET-XXXXXX
 * @returns {string} Ex: PET-82KJ91
 */
function gerarTagCode() {
  return `PET-${gerarCodigoAleatorio(6)}`;
}

/**
 * Gera activation_code no formato XXXX-XXXX
 * @returns {string} Ex: AX9P-72KQ
 */
function gerarActivationCode() {
  return `${gerarCodigoAleatorio(4)}-${gerarCodigoAleatorio(4)}`;
}

/**
 * Formata data para exibicao no padrao brasileiro
 * @param {Date|string} data
 * @returns {string} Ex: 13/03/2026
 */
function formatarData(data) {
  if (!data) return '';
  const d = new Date(data);
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para exibicao
 * @param {Date|string} data
 * @returns {string} Ex: 13/03/2026 14:30
 */
function formatarDataHora(data) {
  if (!data) return '';
  const d = new Date(data);
  return d.toLocaleString('pt-BR');
}

/**
 * Limpa e sanitiza string para prevenir XSS basico
 * @param {string} str
 * @returns {string} String sem tags HTML
 */
function sanitizar(str) {
  if (!str) return '';
  return str.replace(/[<>]/g, '');
}

module.exports = {
  gerarCodigoAleatorio,
  gerarTagCode,
  gerarActivationCode,
  formatarData,
  formatarDataHora,
  sanitizar,
};
