/**
 * logger.js — Sistema de log padronizado
 *
 * Centraliza logs com prefixos e timestamps para facilitar debug.
 * Em producao, poderia ser substituido por Winston ou Pino.
 */

function info(modulo, mensagem) {
  console.log(`[${new Date().toISOString()}] [${modulo}] ${mensagem}`);
}

function error(modulo, mensagem, err) {
  console.error(`[${new Date().toISOString()}] [${modulo}] ERRO: ${mensagem}`, err?.message || '');
}

function warn(modulo, mensagem) {
  console.warn(`[${new Date().toISOString()}] [${modulo}] AVISO: ${mensagem}`);
}

module.exports = { info, error, warn };
