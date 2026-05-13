/**
 * petPublicController.js — Perfil publico do pet em /p/:slug
 *
 * Esta e a porta de entrada canonica do perfil do pet — acessivel sem
 * autenticacao, com URL bonita (/p/<slug>) e meta-tags OpenGraph para
 * link rico em WhatsApp, iMessage, Twitter etc.
 *
 * Substitui (por redirect 301) as antigas URLs /pets/:id e /explorar/pet/:id.
 *
 * Regras de visibilidade:
 *   - Visitante anonimo OU usuario logado nao-dono: ve foto, nome, selo,
 *     status, raca, idade, tutor (nome + link), posts e contadores publicos.
 *   - Dono autenticado: ve TUDO (saude, NFC, scans, alertas, microchip).
 *   - Dados sensiveis (microchip completo, telefone, lat/long de scans)
 *     NUNCA sao expostos sem sessao do dono.
 */

const Pet = require('../models/Pet');
const Publicacao = require('../models/Publicacao');
const SeguidorPet = require('../models/SeguidorPet');
const Usuario = require('../models/Usuario');
const PetPetshopLink = require('../models/PetPetshopLink');
const PetshopFollower = require('../models/PetshopFollower');
const logger = require('../utils/logger');

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function descricaoOg(pet) {
  const partes = [];
  if (pet.raca) partes.push(pet.raca);
  if (pet.tipo) partes.push(pet.tipo);
  if (pet.porte) partes.push(pet.porte);
  if (pet.dono_nome) partes.push(`tutor: ${pet.dono_nome}`);
  const base = partes.length > 0 ? partes.join(' · ') : 'Perfil oficial no AIRPET';
  const sufixo = pet.tem_tag_ativa ? ' — Pet protegido por tag NFC AIRPET.' : '';
  return `${base}${sufixo}`;
}

const petPublicController = {

  /**
   * GET /p/:slug — perfil publico do pet.
   */
  async mostrarPerfil(req, res) {
    try {
      const { slug } = req.params;
      const pet = await Pet.buscarPorSlug(slug);

      if (!pet) {
        return res.status(404).render('partials/erro', {
          titulo: 'Pet nao encontrado',
          mensagem: 'Este perfil de pet nao existe ou foi removido.',
          codigo: 404,
        });
      }

      const uid = req.session && req.session.usuario ? req.session.usuario.id : null;
      const ehDono = !!(uid && uid === pet.usuario_id);

      const [posts, totalSeguidores, totalSeguindo, estaSeguindo, petshopsVinculados, dono] = await Promise.all([
        Publicacao.buscarPorPet(pet.id, uid, 50),
        SeguidorPet.contarSeguidores(pet.id),
        SeguidorPet.contarSeguindo(pet.usuario_id),
        uid ? SeguidorPet.estaSeguindo(uid, pet.id) : false,
        PetPetshopLink.listarPorPet(pet.id),
        Usuario.buscarPorId(pet.usuario_id),
      ]);

      const petshopsVinculadosComFollow = await Promise.all(
        (petshopsVinculados || []).map(async (item) => ({
          ...item,
          usuario_segue: uid ? await PetshopFollower.usuarioSegue(item.petshop_id, uid) : false,
        }))
      );

      const url = `${baseUrl(req)}/p/${pet.slug}`;
      const ogImage = pet.foto || pet.foto_capa || null;

      res.render('explorar/perfil-pet', {
        titulo: pet.nome,
        pet,
        dono,
        posts,
        totalSeguidores,
        totalSeguindo,
        estaSeguindo,
        eMeuPet: ehDono,
        ehDono,
        ehVisitanteAnonimo: !uid,
        petshopsVinculados: petshopsVinculadosComFollow,
        canonicalUrl: url,
        ogUrl: url,
        ogTitle: `${pet.nome} | AIRPET`,
        ogDescription: descricaoOg(pet),
        ogImage,
        ogType: 'profile',
      });
    } catch (err) {
      logger.error('PET_PUBLIC', 'Erro ao carregar perfil publico do pet', err);
      res.status(500).render('partials/erro', {
        titulo: 'Erro ao carregar perfil',
        mensagem: 'Nao foi possivel exibir este perfil agora. Tente novamente em instantes.',
        codigo: 500,
      });
    }
  },

  /**
   * Redirect 301 de /pets/:id e /explorar/pet/:id para /p/:slug.
   * Usa Pet.garantirSlug para o caso (raro) de pet antigo sem slug.
   */
  async redirecionarPorId(req, res) {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(404).end();

      const slug = await Pet.garantirSlug(id);
      if (!slug) return res.status(404).end();

      const qs = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
      return res.redirect(301, `/p/${slug}${qs}`);
    } catch (err) {
      logger.error('PET_PUBLIC', 'Falha no redirect por id', err);
      return res.status(404).end();
    }
  },
};

module.exports = petPublicController;
