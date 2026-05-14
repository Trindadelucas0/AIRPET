const logger = require('../utils/logger');
const Hashtag = require('../models/Hashtag');
const Desafio = require('../models/Desafio');
const SeguidorPet = require('../models/SeguidorPet');
const Pet = require('../models/Pet');
const PetCheckin = require('../models/PetCheckin');

function getNotificacaoService() {
  try { return require('./notificacaoService'); } catch (_) { return null; }
}

/**
 * Pós-processamento de um post recém-criado: hashtags, desafio ativo, notifica seguidores do pet.
 */
async function aposCriarPublicacao({ postId, petId, autorUserId, texto, legenda, lat, lng, local_nome }) {
  const textoCompleto = [texto, legenda].filter(Boolean).join(' ');
  try {
    await Hashtag.syncPublicacao(postId, textoCompleto);
  } catch (e) {
    logger.error('SOCIAL_HOOK', 'sync hashtags', e);
  }

  if (petId) {
    try {
      const la = lat != null && lat !== '' ? parseFloat(lat) : NaN;
      const lo = lng != null && lng !== '' ? parseFloat(lng) : NaN;
      if (Number.isFinite(la) && Number.isFinite(lo)) {
        await PetCheckin.criar({
          pet_id: petId,
          autor_user_id: autorUserId,
          publicacao_id: postId,
          lat: la,
          lng: lo,
          precisao: 'bairro',
          local_nome: local_nome ? String(local_nome).slice(0, 150) : null,
        });
      }
    } catch (e) {
      logger.error('SOCIAL_HOOK', 'checkin', e);
    }

    try {
      const desafio = await Desafio.buscarAtivo();
      if (desafio && desafio.hashtag) {
        const tag = String(desafio.hashtag).toLowerCase().replace(/^#/, '');
        const re = new RegExp(`#${tag}\\b`, 'i');
        if (re.test(textoCompleto)) {
          await Desafio.vincularDesafioNaPublicacao(postId, desafio.id);
          await Desafio.registrarParticipacao(desafio.id, petId, autorUserId, postId);
        }
      }
    } catch (e) {
      logger.error('SOCIAL_HOOK', 'desafio', e);
    }
  }

  if (!petId) return;
  try {
    const pet = await Pet.buscarPorId(petId);
    if (!pet || !pet.slug) return;
    const seguidores = await SeguidorPet.listarUsuarioIdsQueSeguemPetExcetoDono(petId);
    if (!seguidores.length) return;
    const svc = getNotificacaoService();
    if (!svc) return;
    const prev = (textoCompleto || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const msg = prev ? `${pet.nome} publicou: ${prev}` : `${pet.nome} publicou uma nova foto.`;
    const link = `/p/${pet.slug}#post-${postId}`;
    const limite = 80;
    const slice = seguidores.slice(0, limite);
    for (const uid of slice) {
      if (uid === autorUserId) continue;
      svc.criar(uid, 'post_pet', msg, link, { remetente_id: autorUserId, publicacao_id: postId, pet_id: petId }).catch(() => {});
    }
  } catch (e) {
    logger.error('SOCIAL_HOOK', 'notificar seguidores pet', e);
  }
}

module.exports = { aposCriarPublicacao };
