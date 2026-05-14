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
 *   - Dono autenticado: ve TUDO (saude, NFC, scans, alertas, microchip)
 *     atraves das abas adicionais (?tab=saude|nfc|scans).
 *   - Dados sensiveis (microchip completo, telefone, lat/long de scans)
 *     NUNCA sao expostos sem sessao do dono.
 */

const Pet = require('../models/Pet');
const Publicacao = require('../models/Publicacao');
const SeguidorPet = require('../models/SeguidorPet');
const Usuario = require('../models/Usuario');
const PetPetshopLink = require('../models/PetPetshopLink');
const PetshopFollower = require('../models/PetshopFollower');
const NfcTag = require('../models/NfcTag');
const TagScan = require('../models/TagScan');
const Vacina = require('../models/Vacina');
const RegistroSaude = require('../models/RegistroSaude');
const PetPerdido = require('../models/PetPerdido');
const PetStatusHistory = require('../models/PetStatusHistory');
const PetTrackingEvent = require('../models/PetTrackingEvent');
const logger = require('../utils/logger');

const ABAS_VALIDAS = new Set(['posts', 'sobre', 'saude', 'nfc', 'scans']);
const ABAS_SOMENTE_DONO = new Set(['saude', 'nfc', 'scans']);

function baseUrl(req) {
  return process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function descricaoOg(pet) {
  const bio = (pet.bio_pet && String(pet.bio_pet).trim()) ? String(pet.bio_pet).trim() : '';
  if (bio) return `${bio.slice(0, 200)}${bio.length > 200 ? '…' : ''}`;
  const partes = [];
  if (pet.raca) partes.push(pet.raca);
  if (pet.tipo) partes.push(pet.tipo);
  if (pet.porte) partes.push(pet.porte);
  if (pet.dono_nome) partes.push(`tutor: ${pet.dono_nome}`);
  const base = partes.length > 0 ? partes.join(' · ') : 'Perfil oficial no AIRPET';
  const sufixo = pet.tem_tag_ativa ? ' — Pet protegido por tag NFC AIRPET.' : '';
  return `${base}${sufixo}`;
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento);
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  const diffMs = hoje - nasc;
  const anosFloat = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  const anos = Math.floor(anosFloat);
  const meses = Math.floor((anosFloat - anos) * 12);
  return { anos, meses };
}

async function buildContextoDono(pet, req) {
  const [scans, tags, alertaAtivo] = await Promise.all([
    TagScan.listarHistoricoPorPet(pet.id, 40),
    NfcTag.buscarPorUsuario(req.session.usuario.id).then((lista) => lista.filter((t) => t.pet_id === pet.id)),
    PetPerdido.buscarAtivoPorPet(pet.id).catch(() => null),
  ]);
  const tagsAtivas = (tags || []).filter((t) => t.status === 'active');
  const tagsHistorico = (tags || []).filter((t) => t.status !== 'active');

  let calendarioSaude = [];
  try {
    const [vacinas, registros] = await Promise.all([
      Vacina.buscarPorPet(pet.id),
      RegistroSaude.buscarPorPet(pet.id),
    ]);
    const hoje = new Date();
    vacinas.forEach((v) => {
      if (v.data_proxima && new Date(v.data_proxima) >= hoje) {
        calendarioSaude.push({ tipo: 'vacina', titulo: v.nome_vacina, data: v.data_proxima, icone: 'fa-syringe' });
      }
    });
    registros.forEach((r) => {
      if (r.data_proxima && new Date(r.data_proxima) >= hoje) {
        const icone = r.tipo === 'consulta' ? 'fa-stethoscope' : r.tipo === 'vermifugo' ? 'fa-pills' : 'fa-notes-medical';
        calendarioSaude.push({ tipo: r.tipo, titulo: r.descricao || r.tipo, data: r.data_proxima, icone });
      }
    });
    calendarioSaude.sort((a, b) => new Date(a.data) - new Date(b.data));
    calendarioSaude = calendarioSaude.slice(0, 6);
  } catch (_) {
    calendarioSaude = [];
  }

  return { scans, tagsAtivas, tagsHistorico, alertaAtivo, calendarioSaude };
}

/**
 * Monta timeline cronologica do pet a partir de:
 *  - pet_status_history (perdido/seguro)
 *  - pet_tracking_events publicos (nfc_scan, finder_report etc.)
 *  - posts fixados ou marcantes (primeiros, ativacao de tag)
 *  - data de criacao do pet (marco "Bem-vindo")
 *
 * Filtra automaticamente eventos com visibility='owner' para nao-donos.
 *
 * @param {object} pet
 * @param {Array} posts
 * @param {boolean} ehDono
 */
async function buildTimeline(pet, posts, ehDono) {
  const eventos = [];

  // 1. Marco inicial: criacao do perfil
  if (pet.criado_em || pet.data_criacao) {
    eventos.push({
      tipo: 'criacao_perfil',
      icone: 'fa-star',
      cor: 'amber',
      titulo: `${pet.nome} entrou no AIRPET`,
      descricao: 'Perfil oficial criado.',
      data: pet.criado_em || pet.data_criacao,
    });
  }

  // 2. Historico de status (perdido <-> seguro)
  try {
    const visibilidade = ehDono ? null : 'public';
    const historico = await PetStatusHistory.buscarPorPet(pet.id, 30);
    (historico || []).forEach((h) => {
      const perdido = h.new_status === 'perdido';
      eventos.push({
        tipo: perdido ? 'status_perdido' : 'status_seguro',
        icone: perdido ? 'fa-triangle-exclamation' : 'fa-heart',
        cor: perdido ? 'red' : 'green',
        titulo: perdido ? 'Marcado como perdido' : 'Encontrado em seguranca',
        descricao: h.descricao || (perdido ? 'Alerta da comunidade aberto.' : 'Voltou para casa.'),
        data: h.created_at,
      });
    });
    // Sufixo nao usado mas mantem a intencao de visibilidade publica
    void visibilidade;
  } catch (_) {
    // tabela ainda pode nao existir; tudo bem
  }

  // 3. Eventos de tracking (somente publicos para nao-donos)
  try {
    const tracking = await PetTrackingEvent.buscarPorPet(pet.id, {
      limite: 20,
      visibility: ehDono ? null : 'public',
    });
    (tracking || []).forEach((ev) => {
      let titulo = 'Evento registrado';
      let icone = 'fa-location-dot';
      let cor = 'blue';
      if (ev.event_type === 'nfc_scan') {
        titulo = 'Tag escaneada';
        icone = 'fa-shield-halved';
        cor = 'orange';
      } else if (ev.event_type === 'finder_report') {
        titulo = 'Avistamento da comunidade';
        icone = 'fa-binoculars';
        cor = 'amber';
      } else if (ev.event_type === 'manual_location') {
        titulo = 'Localizacao informada';
        icone = 'fa-map-pin';
        cor = 'blue';
      } else if (ev.event_type === 'status_change') {
        // ja contemplado em status_history; pular para evitar duplicacao
        return;
      }
      eventos.push({
        tipo: ev.event_type,
        icone,
        cor,
        titulo,
        descricao: ev.cidade || '',
        data: ev.event_at,
      });
    });
  } catch (_) {
    // tudo bem
  }

  // 4. Posts marcantes: primeiro post + fixados
  const postsOrdenados = (posts || []).slice().sort(
    (a, b) => new Date(a.criado_em) - new Date(b.criado_em)
  );
  if (postsOrdenados.length > 0) {
    const primeiro = postsOrdenados[0];
    eventos.push({
      tipo: 'primeiro_post',
      icone: 'fa-camera',
      cor: 'pink',
      titulo: 'Primeiro post',
      descricao: primeiro.legenda ? primeiro.legenda.slice(0, 80) : 'Primeira foto compartilhada.',
      data: primeiro.criado_em,
      postId: primeiro.id,
    });
  }
  (posts || []).filter((p) => p.fixada).forEach((p) => {
    eventos.push({
      tipo: 'post_fixado',
      icone: 'fa-thumbtack',
      cor: 'orange',
      titulo: 'Momento fixado',
      descricao: p.legenda ? p.legenda.slice(0, 80) : 'Post fixado pelo tutor.',
      data: p.criado_em,
      postId: p.id,
    });
  });

  // Ordena DESC (mais recente primeiro), remove invalidos
  return eventos
    .filter((ev) => ev.data && !Number.isNaN(new Date(ev.data).getTime()))
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .slice(0, 25);
}

const petPublicController = {

  /**
   * GET /p/:slug — perfil publico do pet (com abas via ?tab=).
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

      let abaAtiva = String(req.query.tab || 'posts').toLowerCase();
      if (!ABAS_VALIDAS.has(abaAtiva)) abaAtiva = 'posts';
      if (ABAS_SOMENTE_DONO.has(abaAtiva) && !ehDono) abaAtiva = 'posts';

      const [posts, totalSeguidores, totalSeguindo, estaSeguindo, petshopsVinculados, dono] = await Promise.all([
        Publicacao.buscarPorPet(pet.id, uid, 60),
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

      // Dados privados (saude/nfc/scans) so para dono.
      let contextoDono = { scans: [], tagsAtivas: [], tagsHistorico: [], alertaAtivo: null, calendarioSaude: [] };
      if (ehDono) {
        contextoDono = await buildContextoDono(pet, req);
      }

      const totalCurtidasAgregado = (posts || []).reduce((acc, p) => acc + (parseInt(p.total_curtidas, 10) || 0), 0);

      const perfilRestrito = !!(pet.privado && !ehDono && !estaSeguindo);

      // Destaques estilo Stories: ate 3 posts fixados (que possuem midia)
      const destaques = perfilRestrito
        ? []
        : (posts || [])
          .filter((p) => p.fixada && p.media_url)
          .slice(0, 3);

      // Timeline cronologica (so calculada se a aba 'sobre' for renderizada,
      // mas como o partial e leve, geramos sempre para nao re-fetchar)
      const timeline = perfilRestrito ? [] : await buildTimeline(pet, posts, ehDono);

      const url = `${baseUrl(req)}/p/${pet.slug}`;
      const ogImage = pet.foto || pet.foto_capa || null;

      res.render('perfil-pet/index', {
        titulo: pet.nome,
        pet,
        dono,
        posts,
        destaques,
        timeline,
        totalSeguidores,
        totalSeguindo,
        estaSeguindo,
        eMeuPet: ehDono,
        ehDono,
        ehVisitanteAnonimo: !uid,
        petshopsVinculados: petshopsVinculadosComFollow,
        abaAtiva,
        idadePet: calcularIdade(pet.data_nascimento),
        totalCurtidasAgregado,
        perfilRestrito,
        ...contextoDono,
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
