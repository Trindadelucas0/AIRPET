const PetshopFollower = require('../models/PetshopFollower');
const PetshopPostLike = require('../models/PetshopPostLike');
const PetshopPostComment = require('../models/PetshopPostComment');
const PetshopMetricEvent = require('../models/PetshopMetricEvent');

const ALLOWED_PERIODS = [7, 30, 90];

function parsePeriodDays(input) {
  const n = Number(input);
  if (ALLOWED_PERIODS.includes(n)) return n;
  return 7;
}

function periodStart(days) {
  const now = Date.now();
  return new Date(now - (days * 24 * 60 * 60 * 1000));
}

const petshopMetricsService = {
  parsePeriodDays,

  async resumirKPIs(petshopId, periodInput) {
    const periodDays = parsePeriodDays(periodInput);
    const inicioPeriodo = periodStart(periodDays);
    const [views, likes, comments, novosSeguidores] = await Promise.all([
      PetshopMetricEvent.contarEventosDesde(petshopId, 'profile_view', inicioPeriodo),
      PetshopPostLike.contarPorPetshopDesde(petshopId, inicioPeriodo),
      PetshopPostComment.contarPorPetshopDesde(petshopId, inicioPeriodo),
      PetshopFollower.contarNovosSeguidoresDesde(petshopId, inicioPeriodo),
    ]);

    const interacoes = Number(likes || 0) + Number(comments || 0);
    const engajamentoTotal = interacoes + Number(novosSeguidores || 0);
    const taxaEngajamento = Number(views || 0) > 0
      ? Number(((interacoes / views) * 100).toFixed(1))
      : 0;

    return {
      periodDays,
      inicioPeriodo,
      views: Number(views || 0),
      likes: Number(likes || 0),
      comments: Number(comments || 0),
      novosSeguidores: Number(novosSeguidores || 0),
      engajamentoTotal,
      taxaEngajamento,
    };
  },
};

module.exports = petshopMetricsService;
