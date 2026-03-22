const bcrypt = require('bcrypt');
const { withTransaction } = require('../config/database');
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

async function garantirSlugUnico(base, client = null) {
  let slug = base || 'petshop';
  let i = 1;
  while (await Petshop.existeSlug(slug, client)) {
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

    const senhaInicial = Math.random().toString(36).slice(2, 10) + 'A1!';
    const hashNovaConta = await bcrypt.hash(senhaInicial, 10);

    const petshopRow = await withTransaction(async (client) => {
      const row = petshopExistente
        ? await Petshop.atualizarDeSolicitacaoAprovada(petshopExistente.id, dadosComuns, client)
        : await Petshop.criarAtivoPorSolicitacaoAprovada(dadosComuns, client);
      const petshopId = row.id;

      let account = await PetshopAccount.buscarPorPetshopId(petshopId, client);
      if (!account) {
        account = await PetshopAccount.criar({
          petshop_id: petshopId,
          email: request.email,
          password_hash: hashNovaConta,
          status: 'ativo',
        }, client);
      } else {
        await PetshopAccount.atualizarStatusPorPetshopId(petshopId, 'ativo', client);
        account = await PetshopAccount.buscarPorPetshopId(petshopId, client);
      }

      if (account && !account.usuario_id) {
        const emailLogin = account.email;
        let usuario = await Usuario.buscarPorEmail(emailLogin, client);
        if (!usuario) {
          usuario = await Usuario.criar({
            nome: request.responsavel_nome || request.empresa_nome || 'Parceiro',
            email: emailLogin,
            senha_hash: account.password_hash,
            telefone: request.telefone || null,
            role: 'tutor',
          }, client);
        }
        await PetshopAccount.atualizarUsuarioId(account.id, usuario.id, client);
      }

      await PetshopProfile.upsert(petshopId, {
        descricao_curta: request.descricao || '',
        descricao_longa: request.descricao || '',
        instagram_url: request.redes_sociais && request.redes_sociais.instagram,
        facebook_url: request.redes_sociais && request.redes_sociais.facebook,
        website_url: request.redes_sociais && request.redes_sociais.website,
        whatsapp_publico: request.telefone,
      }, client);

      await PetshopPartnerRequest.vincularPetshopSeNulo(requestId, petshopId, client);
      await PetshopPartnerRequest.atualizarStatus(
        requestId,
        'aprovado',
        'Solicitação aprovada.',
        null,
        adminEmail,
        client
      );
      return row;
    });

    const account = await PetshopAccount.buscarPorPetshopId(petshopRow.id);
    const contatoEmail = request.email || (account && account.email);
    if (contatoEmail) {
      try {
        await emailService.enviarParceiroAprovado({
          to: contatoEmail,
          empresaNome: request.empresa_nome,
        });
      } catch (emailErro) {
        /* não falha a aprovação por erro de e-mail */
      }
    }

    return { petshop: petshopRow };
  },

  async rejeitarSolicitacao(requestId, motivo, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);

    let atualizado;
    if (request && request.petshop_id) {
      atualizado = await withTransaction(async (client) => {
        await Petshop.marcarParceriaRejeitada(request.petshop_id, client);
        await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'rejeitado', client);
        return PetshopPartnerRequest.atualizarStatus(
          requestId,
          'rejeitado',
          'Solicitação rejeitada pela administração.',
          motivo || 'Não informado.',
          adminEmail,
          client
        );
      });
    } else {
      atualizado = await PetshopPartnerRequest.atualizarStatus(
        requestId,
        'rejeitado',
        'Solicitação rejeitada pela administração.',
        motivo || 'Não informado.',
        adminEmail
      );
    }

    if (request && request.email) {
      try {
        await emailService.enviarParceiroRejeitado({
          to: request.email,
          empresaNome: request.empresa_nome,
          motivo: motivo || 'Não informado.',
        });
      } catch (emailErro) {
        /* não falha o fluxo por erro de e-mail */
      }
    }

    return atualizado;
  },

  async colocarEmAnalise(requestId, observacao, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);

    if (request && request.petshop_id) {
      return withTransaction(async (client) => {
        await Petshop.marcarParceriaEmAnalise(request.petshop_id, client);
        await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'em_analise', client);
        return PetshopPartnerRequest.atualizarStatus(
          requestId,
          'em_analise',
          observacao || null,
          null,
          adminEmail,
          client
        );
      });
    }

    return PetshopPartnerRequest.atualizarStatus(requestId, 'em_analise', observacao || null, null, adminEmail);
  },
};

module.exports = petshopModerationService;
