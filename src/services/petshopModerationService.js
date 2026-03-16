const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const PetshopAccount = require('../models/PetshopAccount');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const PetshopProfile = require('../models/PetshopProfile');

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
  while (true) {
    const exists = await query('SELECT 1 FROM petshops WHERE slug = $1', [slug]);
    if (!exists.rows.length) return slug;
    i += 1;
    slug = `${base}-${i}`;
  }
}

const petshopModerationService = {
  async aprovarSolicitacao(requestId, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (!request) throw new Error('Solicitação não encontrada.');

    const petshopExistente = request.petshop_id
      ? await query(`SELECT * FROM petshops WHERE id = $1`, [request.petshop_id]).then((r) => r.rows[0] || null)
      : null;
    const slug = petshopExistente
      ? (petshopExistente.slug || await garantirSlugUnico(toSlug(request.empresa_nome)))
      : await garantirSlugUnico(toSlug(request.empresa_nome));

    const petshop = petshopExistente
      ? await query(
        `UPDATE petshops
         SET nome = $2,
             endereco = $3,
             telefone = $4,
             whatsapp = $5,
             email_contato = $6,
             latitude = $7::numeric,
             longitude = $8::numeric,
             localizacao = CASE
               WHEN $7::numeric IS NOT NULL AND $8::numeric IS NOT NULL
               THEN ST_SetSRID(ST_MakePoint($8::double precision, $7::double precision), 4326)::geography
               ELSE localizacao
             END,
             descricao = COALESCE($9, descricao),
             logo_url = COALESCE($10, logo_url),
             foto_capa_url = COALESCE($11, foto_capa_url),
             ativo = true,
             ponto_de_apoio = true,
             status_parceria = 'ativo',
             slug = COALESCE(slug, $12),
             data_atualizacao = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          petshopExistente.id,
          request.empresa_nome,
          request.endereco,
          request.telefone,
          request.telefone,
          request.email,
          request.latitude,
          request.longitude,
          request.descricao || null,
          request.logo_url || null,
          (request.fotos_urls && request.fotos_urls[0]) || null,
          slug,
        ]
      )
      : await query(
        `INSERT INTO petshops (
          nome, endereco, telefone, whatsapp, email_contato,
          latitude, longitude, localizacao, ativo, ponto_de_apoio,
          descricao, logo_url, foto_capa_url, status_parceria, slug, data_atualizacao
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6::numeric, $7::numeric,
          CASE
            WHEN $6::numeric IS NOT NULL AND $7::numeric IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($7::double precision, $6::double precision), 4326)::geography
            ELSE NULL
          END,
          true, true,
          $8, $9, $10, 'ativo', $11, NOW()
        )
        RETURNING *`,
        [
          request.empresa_nome,
          request.endereco,
          request.telefone,
          request.telefone,
          request.email,
          request.latitude,
          request.longitude,
          request.descricao || null,
          request.logo_url || null,
          (request.fotos_urls && request.fotos_urls[0]) || null,
          slug,
        ]
      );

    const petshopId = petshop.rows[0].id;
    const accountExists = await query(`SELECT id FROM petshop_accounts WHERE petshop_id = $1 LIMIT 1`, [petshopId]);
    if (!accountExists.rows.length) {
      const senhaInicial = Math.random().toString(36).slice(2, 10) + 'A1!';
      const hash = await bcrypt.hash(senhaInicial, 10);
      await PetshopAccount.criar({
        petshop_id: petshopId,
        email: request.email,
        password_hash: hash,
        status: 'ativo',
      });
    } else {
      await PetshopAccount.atualizarStatusPorPetshopId(petshopId, 'ativo');
    }

    await PetshopProfile.upsert(petshopId, {
      descricao_curta: request.descricao || '',
      descricao_longa: request.descricao || '',
      instagram_url: request.redes_sociais && request.redes_sociais.instagram,
      facebook_url: request.redes_sociais && request.redes_sociais.facebook,
      website_url: request.redes_sociais && request.redes_sociais.website,
      whatsapp_publico: request.telefone,
    });

    await query(
      `UPDATE petshop_partner_requests
       SET petshop_id = COALESCE(petshop_id, $2)
       WHERE id = $1`,
      [requestId, petshopId]
    );
    await PetshopPartnerRequest.atualizarStatus(requestId, 'aprovado', 'Solicitação aprovada.', null, adminEmail);
    return { petshop: petshop.rows[0] };
  },

  async rejeitarSolicitacao(requestId, motivo, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (request && request.petshop_id) {
      await query(
        `UPDATE petshops
         SET status_parceria = 'rejeitado', ativo = false, data_atualizacao = NOW()
         WHERE id = $1`,
        [request.petshop_id]
      );
      await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'rejeitado');
    }
    return PetshopPartnerRequest.atualizarStatus(
      requestId,
      'rejeitado',
      'Solicitação rejeitada pela administração.',
      motivo || 'Não informado.',
      adminEmail
    );
  },

  async colocarEmAnalise(requestId, observacao, adminEmail) {
    const request = await PetshopPartnerRequest.buscarPorId(requestId);
    if (request && request.petshop_id) {
      await query(
        `UPDATE petshops
         SET status_parceria = 'em_analise', data_atualizacao = NOW()
         WHERE id = $1`,
        [request.petshop_id]
      );
      await PetshopAccount.atualizarStatusPorPetshopId(request.petshop_id, 'em_analise');
    }
    return PetshopPartnerRequest.atualizarStatus(requestId, 'em_analise', observacao || null, null, adminEmail);
  },
};

module.exports = petshopModerationService;
