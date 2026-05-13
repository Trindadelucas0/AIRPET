/**
 * slug.js — Geracao de slugs amigaveis para URLs publicas.
 *
 * O slug do pet aparece em /p/:slug — precisa ser determinístico,
 * curto e estavel mesmo quando o nome muda (por isso o sufixo).
 */

const crypto = require('crypto');

const MAP_DIACRITICS = {
  a: 'aàáâãäåāăą',
  c: 'cçćčĉċ',
  d: 'dďđ',
  e: 'eèéêëēėęě',
  g: 'gğĝġģ',
  i: 'iìíîïīįĳı',
  l: 'lľĺļł',
  n: 'nñńňņ',
  o: 'oòóôõöøōőŏ',
  r: 'rřŕŗ',
  s: 'sśšşŝș',
  t: 'tťţțŧ',
  u: 'uùúûüũūůűųŭ',
  w: 'wŵ',
  y: 'yỳýŷÿ',
  z: 'zžźż',
};

const NORMALIZE_MAP = (() => {
  const out = {};
  for (const [base, group] of Object.entries(MAP_DIACRITICS)) {
    for (const ch of group) {
      out[ch] = base;
      out[ch.toUpperCase()] = base;
    }
  }
  return out;
})();

function slugify(input) {
  if (input == null) return '';
  const text = String(input)
    .split('')
    .map((c) => NORMALIZE_MAP[c] || c)
    .join('');
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Gera sufixo curto baseado em random crypto (6 chars hex).
 * Garante unicidade pratica do slug sem dependencia de DB.
 */
function gerarSufixoSlug() {
  return crypto.randomBytes(3).toString('hex');
}

/**
 * Compoe slug final no formato: <slug-do-nome>-<sufixo>.
 * Se o nome for vazio/invalido, usa 'pet'.
 */
function gerarSlugPet(nome) {
  const base = slugify(nome) || 'pet';
  return `${base}-${gerarSufixoSlug()}`;
}

module.exports = {
  slugify,
  gerarSufixoSlug,
  gerarSlugPet,
};
