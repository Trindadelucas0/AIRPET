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
const PetshopProfile = require('../models/PetshopProfile');
const PetshopProduct = require('../models/PetshopProduct');
const PetshopPost = require('../models/PetshopPost');
const PetshopPublication = require('../models/PetshopPublication');
const PetshopFollower = require('../models/PetshopFollower');
const PetshopReview = require('../models/PetshopReview');
const PetshopService = require('../models/PetshopService');
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
    let petshops = await Petshop.listarAtivos();
    if (req.query.apoio === '1') {
      petshops = petshops.filter((p) => p.ponto_de_apoio);
    }

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
    const isNumeric = /^\d+$/.test(String(id));

    let petshop = null;
    if (isNumeric) {
      petshop = await Petshop.buscarPorId(id);
    } else {
      petshop = await Petshop.buscarPorSlug(id);
    }

    /* Se o petshop não existe, exibe 404 */
    if (!petshop || petshop.ativo === false) {
      return res.status(404).render('partials/erro', {
        titulo: 'Petshop não encontrado',
        mensagem: 'O petshop que você procura não existe ou foi removido.',
        codigo: 404,
      });
    }

    const [profile, servicos, products, posts, publicacoes, reviews, reviewSummary, followerCount] = await Promise.all([
      PetshopProfile.buscarPorPetshopId(petshop.id),
      PetshopService.listarAtivos(petshop.id).catch(() => []),
      PetshopProduct.listarAtivosPorPetshop(petshop.id),
      PetshopPost.listarPublicosPorPetshop(petshop.id),
      PetshopPublication.listarPublicacoesParaGradePorPetshop(petshop.id).catch(() => []),
      PetshopReview.listarPorPetshop(petshop.id),
      PetshopReview.resumoPorPetshop(petshop.id),
      PetshopFollower.contarSeguidores(petshop.id),
    ]);

    const usuarioId = req.session && req.session.usuario && req.session.usuario.id;
    const userSegue = usuarioId ? await PetshopFollower.usuarioSegue(petshop.id, usuarioId) : false;

    return res.render('petshops/detalhes', {
      titulo: `${petshop.nome} - AIRPET`,
      petshop,
      profile,
      servicos,
      products,
      posts,
      publicacoes,
      reviews,
      reviewSummary,
      followerCount,
      userSegue,
    });
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao exibir detalhes do petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os detalhes do petshop.' };
    return res.redirect('/petshops');
  }
}

async function mapa(req, res) {
  try {
    const petshops = await Petshop.listarAtivos();
    return res.render('petshops/mapa', {
      titulo: 'Mapa de Petshops Parceiros',
      petshops,
    });
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao carregar mapa de petshops', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível carregar o mapa de petshops.' };
    return res.redirect('/petshops');
  }
}

async function seguir(req, res) {
  try {
    const usuario = req.session && req.session.usuario;
    const wantsJson = req.xhr || (req.headers.accept || '').includes('application/json');
    if (!usuario) {
      if (wantsJson) return res.status(401).json({ sucesso: false, mensagem: 'Sessão expirada. Faça login novamente.' });
      return res.redirect('/auth/login');
    }

    const { id } = req.params;
    const petshopId = parseInt(id, 10);
    const jaSegue = await PetshopFollower.usuarioSegue(petshopId, usuario.id);
    if (jaSegue) {
      await PetshopFollower.deixarDeSeguir(petshopId, usuario.id);
    } else {
      await PetshopFollower.seguir(petshopId, usuario.id);
    }
    const seguidores = await PetshopFollower.contarSeguidores(petshopId);
    if (wantsJson) {
      return res.json({ sucesso: true, seguindo: !jaSegue, seguidores });
    }
    req.session.flash = { tipo: 'sucesso', mensagem: jaSegue ? 'Você deixou de seguir este petshop.' : 'Você agora segue este petshop.' };
    return res.redirect('/petshops/' + id);
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao seguir petshop', erro);
    if (req.xhr || (req.headers.accept || '').includes('application/json')) {
      return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o seguimento.' });
    }
    req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível seguir o petshop.' };
    return res.redirect('/petshops');
  }
}

async function avaliar(req, res) {
  try {
    const usuario = req.session && req.session.usuario;
    if (!usuario) return res.redirect('/auth/login');
    const { id } = req.params;
    const rating = parseInt(req.body.rating, 10);
    if (![1, 2, 3, 4, 5].includes(rating)) {
      req.session.flash = { tipo: 'erro', mensagem: 'Avaliação inválida. Use de 1 a 5 estrelas.' };
      return res.redirect('/petshops/' + id);
    }

    await PetshopReview.criarOuAtualizar({
      petshop_id: parseInt(id, 10),
      usuario_id: usuario.id,
      pet_id: req.body.pet_id || null,
      rating,
      comentario: req.body.comentario || null,
    });

    req.session.flash = { tipo: 'sucesso', mensagem: 'Obrigado pela sua avaliação.' };
    return res.redirect('/petshops/' + id);
  } catch (erro) {
    logger.error('PetshopController', 'Erro ao avaliar petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível salvar sua avaliação.' };
    return res.redirect('/petshops');
  }
}

/* Exporta os métodos do controller */
module.exports = {
  listar,
  mostrarDetalhes,
  mapa,
  seguir,
  avaliar,
};
