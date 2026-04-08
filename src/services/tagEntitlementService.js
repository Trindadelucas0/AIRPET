const TagSubscription = require('../models/TagSubscription');
const PlanDefinition = require('../models/PlanDefinition');
const { PLANOS_PADRAO } = require('../config/planos');

const GRACE_HOURS = parseInt(process.env.TAG_SUBSCRIPTION_GRACE_HOURS || '72', 10);

function normalizarPlanSlug(slug) {
  const valor = String(slug || 'basico').toLowerCase();
  return PLANOS_PADRAO.find((plano) => plano.slug === valor)?.slug || 'basico';
}

function nomeComercialPorSlug(slug) {
  const normalizado = normalizarPlanSlug(slug);
  return PLANOS_PADRAO.find((plano) => plano.slug === normalizado)?.nome || 'AIRPET Essencial';
}

async function obterMatrizRecursos() {
  const planosDb = await PlanDefinition.listarAtivos().catch(() => []);
  if (Array.isArray(planosDb) && planosDb.length) {
    return planosDb.reduce((acc, plano) => {
      acc[normalizarPlanSlug(plano.slug)] = Object.assign({}, plano.features_json || {});
      return acc;
    }, {});
  }
  return PLANOS_PADRAO.reduce((acc, plano) => {
    acc[plano.slug] = Object.assign({}, plano.features || {});
    return acc;
  }, {});
}

const tagEntitlementService = {
  async obterEstadoPlano(usuarioId) {
    const matrizRecursos = await obterMatrizRecursos();
    const recursosBasicos = Object.assign({}, matrizRecursos.basico || {});
    const sub = await TagSubscription.estaAtivaComGrace(usuarioId);
    if (!sub) {
      return {
        planoAtivo: false,
        emGrace: false,
        planSlug: 'basico',
        planSlugOriginal: 'basico',
        nomePlano: nomeComercialPorSlug('basico'),
        recursos: recursosBasicos,
        validUntil: null,
        graceUntil: null,
      };
    }
    const assinaturaAtiva = Boolean(sub.ativo || sub.em_grace);
    const planSlugOriginal = normalizarPlanSlug(sub.plan_slug || 'basico');
    const planSlugEfetivo = assinaturaAtiva ? planSlugOriginal : 'basico';
    const recursosPlano = Object.assign({}, matrizRecursos[planSlugEfetivo] || recursosBasicos);
    return {
      planoAtivo: assinaturaAtiva,
      emGrace: Boolean(sub.em_grace && !sub.ativo),
      planSlug: planSlugEfetivo,
      planSlugOriginal,
      nomePlano: nomeComercialPorSlug(planSlugEfetivo),
      recursos: recursosPlano,
      validUntil: sub.valid_until || null,
      graceUntil: sub.grace_until || null,
      subscription: sub,
    };
  },

  async renovarPorPagamento(usuarioId, planSlug, transactionNsu) {
    const sub = await TagSubscription.renovarOuCriar(usuarioId, planSlug, transactionNsu);
    return sub;
  },

  async requirePlanoAtivo(req, res, next) {
    try {
      const usuarioId = req.session?.usuario?.id;
      if (!usuarioId) {
        return res.redirect('/auth/login');
      }
      const estado = await this.obterEstadoPlano(usuarioId);
      req.tagEntitlement = estado;
      if (!estado.planoAtivo) {
        req.session.flash = {
          tipo: 'erro',
          mensagem: 'Seu plano AIRPET está inativo. Renove para continuar usando este recurso.',
        };
        return res.redirect('/tags/pedidos');
      }
      return next();
    } catch (err) {
      return next(err);
    }
  },

  graceHours() {
    return GRACE_HOURS;
  },
};

module.exports = tagEntitlementService;
