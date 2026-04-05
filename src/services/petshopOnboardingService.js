const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const Petshop = require('../models/Petshop');
const PetshopAccount = require('../models/PetshopAccount');
const bcrypt = require('bcrypt');
const { withTransaction } = require('../config/database');

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
      arquivos.fotos.forEach((f) => {
        const url = f.storagePublicUrl || (f.filename ? `/images/petshops/${f.filename}` : null);
        if (url) fotos.push(url);
      });
    }

    const logoUrl = arquivos.logo && arquivos.logo[0]
      ? (arquivos.logo[0].storagePublicUrl || `/images/petshops/${arquivos.logo[0].filename}`)
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

    const senhaHash = await bcrypt.hash(senha, 10);

    return withTransaction(async (client) => {
      const contaExistente = await PetshopAccount.buscarPorEmail(emailLogin, client);
      if (contaExistente) {
        throw new Error('Já existe uma conta com este e-mail de acesso.');
      }

      const baseSlug = gerarSlug(reqBody.empresa_nome) || 'petshop';
      let slugFinal = baseSlug;
      let tentativa = 1;
      while (await Petshop.existeSlug(slugFinal, client)) {
        tentativa += 1;
        slugFinal = `${baseSlug}-${tentativa}`;
      }

      const petshop = await Petshop.criarRascunhoCadastroPublico({
        nome: reqBody.empresa_nome,
        endereco,
        telefone: reqBody.telefone,
        emailContato: reqBody.email || null,
        latitude,
        longitude,
        slug: slugFinal,
        descricao: reqBody.descricao || null,
        logoUrl,
        fotoCapaUrl: fotos[0] || null,
      }, client);

      await PetshopAccount.criar({
        petshop_id: petshop.id,
        email: emailLogin,
        password_hash: senhaHash,
        status: 'pendente_aprovacao',
      }, client);

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
      }, client);
    });
  },
};

module.exports = petshopOnboardingService;
