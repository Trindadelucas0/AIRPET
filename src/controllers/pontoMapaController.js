/**
 * pontoMapaController.js — Controller de Pontos do Mapa do AIRPET
 *
 * Gerencia operações administrativas sobre os pontos de interesse
 * exibidos no mapa público. Todas as rotas são exclusivas do admin.
 *
 * Tipos de pontos de interesse:
 *   - abrigo: abrigos de animais
 *   - ong: organizações não governamentais de proteção animal
 *   - clinica: clínicas veterinárias
 *   - parque: parques pet-friendly
 *   - hospital: hospitais veterinários
 *   - outro: outros pontos relevantes
 *
 * Cada ponto possui:
 *   - Informações descritivas (nome, descrição, categoria, endereço)
 *   - Coordenadas geográficas (latitude, longitude)
 *   - Status de ativação (ativo/inativo)
 *
 * Pontos inativos não aparecem no mapa público,
 * mas ficam visíveis no painel administrativo.
 *
 * Rotas (todas requerem role 'admin'):
 *   POST   /admin/pontos-mapa           → criar
 *   PUT    /admin/pontos-mapa/:id       → atualizar
 *   POST   /admin/pontos-mapa/:id/toggle → ativarDesativar
 *   DELETE /admin/pontos-mapa/:id       → deletar
 */

const PontoMapa = require('../models/PontoMapa');
const logger = require('../utils/logger');

/**
 * criar — Cria um novo ponto de interesse no mapa
 *
 * Rota: POST /admin/pontos-mapa
 *
 * Fluxo:
 *   1. Extrai os dados do formulário (nome, descrição, categoria, etc.)
 *   2. Valida os campos obrigatórios
 *   3. Cria o ponto no banco com as coordenadas geográficas
 *   4. Redireciona para a página de gerenciamento do mapa
 *
 * A coluna geography (PostGIS) é calculada automaticamente
 * no model a partir da latitude e longitude fornecidas.
 *
 * @param {object} req - Requisição Express com body { nome, descricao, categoria, endereco, latitude, longitude }
 * @param {object} res - Resposta Express
 */
async function criar(req, res) {
  try {
    const { nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos } = req.body;

    if (!nome || !categoria || !latitude || !longitude) {
      req.session.flash = { tipo: 'erro', mensagem: 'Nome, categoria, latitude e longitude são obrigatórios.' };
      return res.redirect('/admin/gerenciar-mapa');
    }

    const servicosArray = servicos
      ? servicos.split(',').map(s => s.trim()).filter(Boolean)
      : null;

    const ponto = await PontoMapa.criar({
      nome,
      descricao: descricao || null,
      categoria,
      endereco: endereco || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      telefone: telefone || null,
      whatsapp: whatsapp || null,
      servicos: servicosArray,
    });

    logger.info('PontoMapaController', `Ponto criado: ${ponto.nome} (categoria: ${categoria})`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Ponto "${ponto.nome}" adicionado ao mapa com sucesso!` };
    return res.redirect('/admin/gerenciar-mapa');
  } catch (erro) {
    logger.error('PontoMapaController', 'Erro ao criar ponto no mapa', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao criar o ponto no mapa. Tente novamente.' };
    return res.redirect('/admin/gerenciar-mapa');
  }
}

/**
 * atualizar — Atualiza os dados de um ponto de interesse
 *
 * Rota: PUT /admin/pontos-mapa/:id
 *
 * Atualiza todos os campos do ponto, incluindo a localização geográfica.
 * Se latitude/longitude mudaram, o PostGIS recalcula a coluna geography.
 *
 * @param {object} req - Requisição Express com params.id e body com dados
 * @param {object} res - Resposta Express
 */
async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const { nome, descricao, categoria, endereco, latitude, longitude, telefone, whatsapp, servicos } = req.body;

    const pontoExistente = await PontoMapa.buscarPorId(id);

    if (!pontoExistente) {
      req.session.flash = { tipo: 'erro', mensagem: 'Ponto não encontrado.' };
      return res.redirect('/admin/gerenciar-mapa');
    }

    const servicosArray = servicos
      ? servicos.split(',').map(s => s.trim()).filter(Boolean)
      : pontoExistente.servicos;

    await PontoMapa.atualizar(id, {
      nome: nome || pontoExistente.nome,
      descricao: descricao || pontoExistente.descricao,
      categoria: categoria || pontoExistente.categoria,
      endereco: endereco || pontoExistente.endereco,
      latitude: latitude ? parseFloat(latitude) : pontoExistente.latitude,
      longitude: longitude ? parseFloat(longitude) : pontoExistente.longitude,
      telefone: telefone || pontoExistente.telefone,
      whatsapp: whatsapp || pontoExistente.whatsapp,
      servicos: servicosArray,
    });

    logger.info('PontoMapaController', `Ponto atualizado: ${id}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Ponto atualizado com sucesso!' };
    return res.redirect('/admin/gerenciar-mapa');
  } catch (erro) {
    logger.error('PontoMapaController', 'Erro ao atualizar ponto', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar o ponto. Tente novamente.' };
    return res.redirect('/admin/gerenciar-mapa');
  }
}

/**
 * ativarDesativar — Alterna o status ativo/inativo de um ponto
 *
 * Rota: POST /admin/pontos-mapa/:id/toggle
 *
 * Se o ponto está ativo, desativa (some do mapa público).
 * Se está inativo, ativa (aparece no mapa público).
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function ativarDesativar(req, res) {
  try {
    const { id } = req.params;

    /* Busca o ponto para saber o status atual */
    const ponto = await PontoMapa.buscarPorId(id);

    if (!ponto) {
      req.session.flash = { tipo: 'erro', mensagem: 'Ponto não encontrado.' };
      return res.redirect('/admin/gerenciar-mapa');
    }

    /* Inverte o status: se ativo → inativo, se inativo → ativo */
    const novoStatus = !ponto.ativo;
    await PontoMapa.ativarDesativar(id, novoStatus);

    const statusTexto = novoStatus ? 'ativado' : 'desativado';
    logger.info('PontoMapaController', `Ponto ${id} ${statusTexto}`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Ponto "${ponto.nome}" ${statusTexto} com sucesso.` };
    return res.redirect('/admin/gerenciar-mapa');
  } catch (erro) {
    logger.error('PontoMapaController', 'Erro ao alternar status do ponto', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao alterar o status do ponto.' };
    return res.redirect('/admin/gerenciar-mapa');
  }
}

/**
 * deletar — Remove permanentemente um ponto de interesse do mapa
 *
 * Rota: DELETE /admin/pontos-mapa/:id
 *
 * ATENÇÃO: esta operação é irreversível.
 * Considere desativar o ponto (ativarDesativar) ao invés de deletar,
 * para manter o histórico. A exclusão é para casos excepcionais.
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function deletar(req, res) {
  try {
    const { id } = req.params;

    /* Busca o ponto para confirmar existência e logar o nome */
    const ponto = await PontoMapa.buscarPorId(id);

    if (!ponto) {
      req.session.flash = { tipo: 'erro', mensagem: 'Ponto não encontrado.' };
      return res.redirect('/admin/gerenciar-mapa');
    }

    await PontoMapa.deletar(id);

    logger.info('PontoMapaController', `Ponto removido: ${ponto.nome} (ID: ${id})`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Ponto "${ponto.nome}" removido permanentemente.` };
    return res.redirect('/admin/gerenciar-mapa');
  } catch (erro) {
    logger.error('PontoMapaController', 'Erro ao deletar ponto', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao remover o ponto do mapa.' };
    return res.redirect('/admin/gerenciar-mapa');
  }
}

/* Exporta os métodos do controller */
module.exports = {
  criar,
  atualizar,
  ativarDesativar,
  deletar,
};
