const TagSubscription = require('../models/TagSubscription');

const GRACE_HOURS = parseInt(process.env.TAG_SUBSCRIPTION_GRACE_HOURS || '72', 10);

const tagEntitlementService = {
  async obterEstadoPlano(usuarioId) {
    const sub = await TagSubscription.estaAtivaComGrace(usuarioId);
    if (!sub) {
      return {
        planoAtivo: false,
        emGrace: false,
        planSlug: 'basico',
        validUntil: null,
        graceUntil: null,
      };
    }
    return {
      planoAtivo: Boolean(sub.ativo || sub.em_grace),
      emGrace: Boolean(sub.em_grace && !sub.ativo),
      planSlug: sub.plan_slug || 'basico',
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
          mensagem: 'Seu plano premium está inativo. Renove para continuar usando este recurso.',
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
