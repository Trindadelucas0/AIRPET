/**
 * usuarioController.js — Controller de Usuário/Perfil do AIRPET
 *
 * Gerencia as operações relacionadas ao perfil do usuário logado:
 *   - Visualização do perfil
 *   - Atualização de dados pessoais (nome, email, telefone)
 *   - Atualização de localização geográfica (API)
 *
 * A atualização de localização é uma rota de API usada pelo
 * frontend para enviar a posição GPS do dispositivo do tutor.
 * Essa informação é usada para:
 *   - Notificar o tutor quando um pet perdido é avistado próximo
 *   - Calcular distâncias para petshops e pontos de interesse
 *   - Exibir dados de proximidade no mapa
 *
 * Rotas:
 *   GET  /perfil            → mostrarPerfil
 *   PUT  /perfil            → atualizar
 *   PUT  /api/localizacao   → atualizarLocalizacao (API, JSON)
 */

const Usuario = require('../models/Usuario');
const logger = require('../utils/logger');

/**
 * mostrarPerfil — Renderiza a página de perfil do usuário logado
 *
 * Rota: GET /perfil (quando usar este controller)
 * View: perfil (mesma view do perfilController — espera perfil e pets)
 *
 * Busca os dados atualizados do usuário no banco (não usa apenas
 * os dados da sessão, pois estes podem estar desatualizados).
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function mostrarPerfil(req, res) {
  try {
    const usuarioId = req.session.usuario.id;

    /* Busca os dados completos e atualizados do banco */
    const usuario = await Usuario.buscarPorId(usuarioId);

    if (!usuario) {
      /*
       * Caso raro: o usuário tem sessão ativa mas foi removido do banco.
       * Redireciona para logout para limpar a sessão inválida.
       */
      req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado. Faça login novamente.' };
      return res.redirect('/auth/logout');
    }

    return res.render('perfil/hub', {
      titulo: 'Configurações',
      perfil: usuario,
      extraHead: '<link rel="stylesheet" href="/css/perfil-settings.css">',
    });
  } catch (erro) {
    logger.error('UsuarioController', 'Erro ao exibir perfil', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seu perfil.' };
    return res.redirect('/');
  }
}

/**
 * atualizar — Atualiza os dados pessoais do usuário
 *
 * Rota: PUT /perfil
 *
 * Fluxo:
 *   1. Extrai os novos dados do corpo da requisição
 *   2. Atualiza os dados no banco de dados
 *   3. Atualiza a sessão com os novos dados (para refletir imediatamente)
 *   4. Redireciona para o perfil com mensagem de sucesso
 *
 * Dados atualizáveis: nome, email, telefone.
 * A senha e o role não são alterados aqui — possuem fluxos específicos.
 *
 * @param {object} req - Requisição Express com body { nome, email, telefone }
 * @param {object} res - Resposta Express
 */
async function atualizar(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const { nome, email, telefone } = req.body;

    /* Validação dos campos obrigatórios */
    if (!nome || !email) {
      req.session.flash = { tipo: 'erro', mensagem: 'Nome e email são obrigatórios.' };
      return res.redirect('/perfil');
    }

    /*
     * Verifica se o novo email já está em uso por outro usuário.
     * Isso evita conflitos de email duplicado no banco.
     */
    const emailExistente = await Usuario.buscarPorEmail(email);
    if (emailExistente && emailExistente.id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Este email já está em uso por outro usuário.' };
      return res.redirect('/perfil');
    }

    /* Atualiza os dados no banco de dados */
    const usuarioAtualizado = await Usuario.atualizar(usuarioId, {
      nome,
      email,
      telefone: telefone || null,
    });

    /*
     * Atualiza a sessão com os novos dados para que
     * mudanças reflitam imediatamente em toda a aplicação.
     * Sem isso, o nome antigo continuaria aparecendo no header
     * até o próximo login ou refresh da sessão.
     */
    req.session.usuario = {
      ...req.session.usuario,
      nome: usuarioAtualizado.nome,
      email: usuarioAtualizado.email,
    };

    logger.info('UsuarioController', `Perfil atualizado: ${usuarioId}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Perfil atualizado com sucesso!' };
    return res.redirect('/perfil');
  } catch (erro) {
    logger.error('UsuarioController', 'Erro ao atualizar perfil', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar seu perfil. Tente novamente.' };
    return res.redirect('/perfil');
  }
}

/**
 * atualizarLocalizacao — Atualiza a localização geográfica do usuário
 *
 * Rota: PUT /api/localizacao
 * Tipo: API (retorna JSON)
 *
 * Recebe latitude e longitude do dispositivo do tutor via API.
 * O frontend chama esta rota periodicamente (ou por evento)
 * para manter a localização do usuário atualizada.
 *
 * A localização é armazenada como geography (PostGIS) para
 * permitir consultas espaciais de proximidade, como:
 *   - "Notifique este tutor porque há um pet perdido a 500m"
 *   - "Mostre petshops próximos a este tutor"
 *
 * @param {object} req - Requisição Express com body { latitude, longitude }
 * @param {object} res - Resposta Express (JSON)
 */
async function atualizarLocalizacao(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const { latitude, longitude } = req.body;

    /* Validação: latitude e longitude são obrigatórios */
    if (!latitude || !longitude) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Latitude e longitude são obrigatórios.',
      });
    }

    /* Converte para números e valida */
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Latitude e longitude devem ser números válidos.',
      });
    }

    /* Valida se as coordenadas estão dentro dos limites geográficos */
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Coordenadas fora dos limites geográficos válidos.',
      });
    }

    /* Atualiza a localização no banco com PostGIS */
    await Usuario.atualizarLocalizacao(usuarioId, lat, lng);

    logger.info('UsuarioController', `Localização atualizada: ${usuarioId} (${lat}, ${lng})`);

    /* Retorna sucesso */
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Localização atualizada com sucesso.',
    });
  } catch (erro) {
    logger.error('UsuarioController', 'Erro ao atualizar localização', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao atualizar a localização.',
    });
  }
}

/* Exporta os métodos do controller */
module.exports = {
  mostrarPerfil,
  atualizar,
  atualizarLocalizacao,
};
