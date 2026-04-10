const tagEntitlementService = require('./tagEntitlementService');

const PLAN_LIMITS = {
  gratuito: 1,
  basico: 1,
  inicial: 3,
  plus: 3,
  intermediario: 6,
  familia: 6,
  premium: 12,
};

function normalizarSlug(slug) {
  return String(slug || 'gratuito').trim().toLowerCase();
}

function limitePorPlano(slug) {
  const normalized = normalizarSlug(slug);
  return PLAN_LIMITS[normalized] || PLAN_LIMITS.gratuito;
}

async function obterLimiteUsuario(usuarioId) {
  const estado = await tagEntitlementService.obterEstadoPlano(usuarioId).catch(() => null);
  const planSlug = normalizarSlug(estado?.planSlug || 'gratuito');
  return {
    planSlug,
    limitePets: limitePorPlano(planSlug),
  };
}

module.exports = {
  PLAN_LIMITS,
  limitePorPlano,
  obterLimiteUsuario,
};
