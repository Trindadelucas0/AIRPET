const bcrypt = require('bcrypt');
const Petshop = require('../models/Petshop');
const PetshopAccount = require('../models/PetshopAccount');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const PetshopProfile = require('../models/PetshopProfile');
const Usuario = require('../models/Usuario');
const emailService = require('../services/emailService');

function toSlug(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 170);
}

async function garantirSlugUnico(base) {
  let slug = base || 'petshop';
  let i = 1;
  while (await Petshop.existeSlug(slug)) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

const petshopModerationService = {
  async aprovarSolicitacao(requestId, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (!request) throw new Error('Solicitação não encontrada.');

    const petshopExistente = request.petshop_id
      ? await Petshop.buscarPorId(request.petshop_id)
      : null;
    const slug = petshopExistente
      ? (petshopExistente.slug || await garantirSlugUnico(toSlug(request.empresa_nome)))
      : await garantirSlugUnico(toSlug(request.empresa_nome));

    const dadosComuns = {
      nome: request.empresa_nome,
      endereco: request.endereco,
      telefone: request.telefone,
      email: request.email,
      latitude: request.latitude,
      longitude: request.longitude,
      descricao: request.descricao || null,
      logoUrl: request.logo_url || null,
      fotoCapaUrl: (request.fotos_urls && request.fotos_urls[0]) || null,
      slug,
    };

    const petshopRow = petshopExistente
      ? await Petshop.atualizarDeSolicitacaoAprovada(petshopExistente.id, dadosComuns)
      : await Petshop.criarAtivoPorSolicitacaoAprovada(dadosComuns);

    const petshopId = petshopRow.id;
    let account = await PetshopAccount.buscarPorPetshopId(petshopId);
    if (!account) {
      const senhaInicial = Math.random().toString(36).slice(2, 10) + 'A1!';
      const hash = await bcrypt.hash(senhaInicial, 10);
      account = await PetshopAccount.criar({
        petshop_id: petshopId,
        email: request.email,
        password_hash: hash,
        status: 'ativo',
      });
    } else {
      await PetshopAccount.atualizarStatusPorPetshopId(petshopId, 'ativo');
      account = await PetshopAccount.buscarPorPetshopId(petshopId);
    }

    if (account && !account.usuario_id) {
      const emailLogin = account.email;
      let usuario = await Usuario.buscarPorEmail(emailLogin);
      if (!usuario) {
        usuario = await Usuario.criar({
          nome: request.responsavel_nome || request.empresa_nome || 'Parceiro',
          email: emailLogin,
          senha_hash: account.password_hash,
          telefone: request.telefone || null,
          role: 'tutor',
        });
      }
      await PetshopAccount.atualizarUsuarioId(account.id, usuario.id);
    }

    await PetshopProfile.upsert(petshopId, {
      descricao_curta: request.descricao || '',
      descricao_longa: request.descricao || '',
      instagram_url: request.redes_sociais && request.redes_sociais.instagram,
      facebook_url: request.redes_sociais && request.redes_sociais.facebook,
      website_url: request.redes_sociais && request.redes_sociais.website,
      whatsapp_publico: request.telefone,
    });

    await PetshopPartnerRequest.vincularPetshopSeNulo(requestId, petshopId);
    await PetshopPartnerRequest.atualizarStatus(requestId, 'aprovado', 'Solicitação aprovada.', null, adminEmail);

    const contatoEmail = request.email || (account && account.email);
    if (contatoEmail) {
      try {
        await emailService.enviarParceiroAprovado({
          to: contatoEmail,
          empresaNome: request.empresa_nome,
        });
      } catch (emailErro) {
        // Não falha a aprovação por erro de e-mail
      }
    }

    return { petshop: petshopRow };
  },

  async rejeitarSolicitacao(requestId, motivo, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (request && request.petshop_id) {
      await Petshop.marcarParceriaRejeitada(request.petshop_id);
      await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'rejeitado');
    }
    const atualizado = await PetshopPartnerRequest.atualizarStatus(
      requestId,
      'rejeitado',
      'Solicitação rejeitada pela administração.',
      motivo || 'Não informado.',
      adminEmail
    );

    if (request && request.email) {
      try {
        await emailService.enviarParceiroRejeitado({
          to: request.email,
          empresaNome: request.empresa_nome,
          motivo: motivo || 'Não informado.',
        });
      } catch (emailErro) {
        // Não falha o fluxo por erro de e-mail
      }
    }

    return atualizado;
  },

  async colocarEmAnalise(requestId, observacao, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (request && request.petshop_id) {
      await Petshop.marcarParceriaEmAnalise(request.petshop_id);
      await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'em_analise');
    }
    return PetshopPartnerRequest.atualizarStatus(requestId, 'em_analise', observacao || null, null, adminEmail);
  },
};

module.exports = petshopModerationService;
