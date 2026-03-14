/**
 * petshopController.js — Controller de Petshops Parceiros do AIRPET
 *
 * Gerencia a exibição pública dos petshops parceiros.
 * Estes são os petshops cadastrados no sistema que oferecem
 * serviços como banho, tosa, consulta veterinária, etc.
 *
 * Os petshops são exibidos em duas views:
 *   1. Lista geral — todos os petshops ativos ordenados por nome
 *   2. Página de detalhes — informações completas de um petshop
 *
 * Apenas petshops com status 'ativo' são exibidos para os tutores.
 * Petshops inativos são visíveis apenas no painel administrativo.
 *
 * Rotas:
 *   GET /petshops      → listar (lista pública)
 *   GET /petshops/:id  → mostrarDetalhes (página do petshop)
 */

const Petshop = require('../models/Petshop');
const logger = require('../utils/logger');

/**
 * listar — Lista todos os petshops ativos para exibição pública
 *
 * Rota: GET /petshops
 * View: petshops/lista
 *
 * Busca apenas petshops com ativo = true (não exibe inativos).
 * Ordena por nome em ordem alfabética para facilitar a busca.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listar(req, res) {
  try {
    /* Busca somente petshops ativos — inativos ficam ocultos do público */
    const petshops = await Petshop.listarAtivos();

    /* Renderiza a lista de petshops parceiros */
    return res.render('petshops/lista', {
      titulo: 'Petshops Parceiros - AIRPET',
      petshops,
    });
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao listar petshops', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de petshops.' };
    return res.redirect('/');
  }
}

/**
 * mostrarDetalhes — Exibe a página de detalhes de um petshop
 *
 * Rota: GET /petshops/:id
 * View: petshops/detalhes
 *
 * Mostra informações completas do petshop:
 *   - Nome, endereço, telefone, email
 *   - Localização no mapa (latitude/longitude)
 *   - Serviços oferecidos (se disponível)
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function mostrarDetalhes(req, res) {
  try {
    const { id } = req.params;

    /* Busca o petshop pelo ID */
    const petshop = await Petshop.buscarPorId(id);

    /* Se o petshop não existe, exibe 404 */
    if (!petshop) {
      return res.status(404).render('partials/erro', {
        titulo: 'Petshop não encontrado',
        mensagem: 'O petshop que você procura não existe ou foi removido.',
        codigo: 404,
      });
    }

    /* Renderiza a página de detalhes com todas as informações */
    return res.render('petshops/detalhes', {
      titulo: `${petshop.nome} - AIRPET`,
      petshop,
    });
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao exibir detalhes do petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os detalhes do petshop.' };
    return res.redirect('/petshops');
  }
}

/* Exporta os métodos do controller */
module.exports = {
  listar,
  mostrarDetalhes,
};
