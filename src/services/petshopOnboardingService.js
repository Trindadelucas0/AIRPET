const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const bcrypt = require('bcrypt');
const { query } = require('../config/database');

function gerarSlug(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 170);
}

const petshopOnboardingService = {
  async criarSolicitacao(reqBody, arquivos = {}) {
    const fotos = [];
    if (Array.isArray(arquivos.fotos)) {
      arquivos.fotos.forEach((f) => fotos.push(`/images/petshops/${f.filename}`));
    }

    const logoUrl = arquivos.logo && arquivos.logo[0]
      ? `/images/petshops/${arquivos.logo[0].filename}`
      : null;

    const endereco = String(reqBody.endereco || '').trim();
    const bairro = String(reqBody.bairro || '').trim();
    const cidade = String(reqBody.cidade || '').trim();
    const estado = String(reqBody.estado || '').trim().toUpperCase().slice(0, 2);
    const cep = String(reqBody.cep || '').trim();

    const latRaw = reqBody.latitude;
    const lngRaw = reqBody.longitude;
    const latitude = latRaw === undefined || latRaw === '' ? null : parseFloat(latRaw);
    const longitude = lngRaw === undefined || lngRaw === '' ? null : parseFloat(lngRaw);

    if (!endereco) {
      throw new Error('Endereço é obrigatório.');
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Localização inválida.');
    }

    const emailLogin = String(reqBody.email_login || reqBody.email || '').trim().toLowerCase();
    const senha = String(reqBody.senha || '');
    const confirmarSenha = String(reqBody.confirmar_senha || '');
    if (!emailLogin) throw new Error('Informe um e-mail de acesso.');
    if (senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    if (senha !== confirmarSenha) throw new Error('A confirmação de senha não confere.');

    const emailExiste = await query('SELECT 1 FROM petshop_accounts WHERE email = $1', [emailLogin]);
    if (emailExiste.rows.length) throw new Error('Já existe uma conta com este e-mail de acesso.');

    const baseSlug = gerarSlug(reqBody.empresa_nome) || 'petshop';
    let slugFinal = baseSlug;
    let tentativa = 1;
    while (true) {
      const check = await query('SELECT 1 FROM petshops WHERE slug = $1', [slugFinal]);
      if (!check.rows.length) break;
      tentativa += 1;
      slugFinal = `${baseSlug}-${tentativa}`;
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const petshopResult = await query(
      `INSERT INTO petshops (
        nome, endereco, telefone, whatsapp, email_contato,
        latitude, longitude, localizacao, ativo, status_parceria, slug, descricao, logo_url, foto_capa_url, data_atualizacao
      )
      VALUES (
        $1, $2, $3, $3, $4,
        $5::numeric, $6::numeric,
        CASE
          WHEN $5::numeric IS NOT NULL AND $6::numeric IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($6::double precision, $5::double precision), 4326)::geography
          ELSE NULL
        END,
        false, 'pendente', $7, $8, $9, $10, NOW()
      )
      RETURNING *`,
      [
        reqBody.empresa_nome,
        endereco,
        reqBody.telefone,
        reqBody.email || null,
        latitude,
        longitude,
        slugFinal,
        reqBody.descricao || null,
        logoUrl,
        fotos[0] || null,
      ]
    );
    const petshop = petshopResult.rows[0];

    await query(
      `INSERT INTO petshop_accounts (petshop_id, email, password_hash, status)
       VALUES ($1, $2, $3, 'pendente_aprovacao')`,
      [petshop.id, emailLogin, senhaHash]
    );

    return PetshopPartnerRequest.criar({
      petshop_id: petshop.id,
      ...reqBody,
      endereco,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      cep: cep || null,
      latitude,
      longitude,
      slug_sugerido: gerarSlug(reqBody.empresa_nome),
      logo_url: logoUrl,
      fotos_urls: fotos,
      redes_sociais: {
        instagram: reqBody.instagram || null,
        facebook: reqBody.facebook || null,
        website: reqBody.website || null,
      },
      servicos: reqBody.servicos ? String(reqBody.servicos).split(',').map(s => s.trim()).filter(Boolean) : [],
      horario_funcionamento: { descricao: reqBody.horario_funcionamento || null },
    });
  },
};

module.exports = petshopOnboardingService;
