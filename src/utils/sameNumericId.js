'use strict';

/**
 * Compara IDs numéricos que podem vir como number (pg) ou string (sessão, params).
 * Evita falhas de `===` entre "12" e 12 que escondem UI de dono ou bloqueiam rotas.
 */
function sameNumericId(a, b) {
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return String(a) === String(b);
}

module.exports = { sameNumericId };
