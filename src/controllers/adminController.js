/**
 * adminController.js — Controller Administrativo do AIRPET
 *
 * Gerencia todas as funcionalidades do painel administrativo.
 * Apenas usuários com role 'admin' podem acessar estas rotas
 * (protegido pelo middleware adminMiddleware).
 *
 * Funcionalidades do painel admin:
 *   - Dashboard com métricas gerais do sistema
 *   - Gestão de usuários, pets, petshops
 *   - Aprovação de alertas de pets perdidos
 *   - Moderação de mensagens do chat
 *   - Configurações globais do sistema
 *   - Gestão de pontos no mapa
 *   - Escalação de alertas de pets perdidos
 *
 * O dashboard agrega contadores de diversas tabelas usando
 * Promise.all para executar as queries em paralelo.
 *
 * Rotas:
 *   GET  /admin/dashboard           → dashboard
 *   GET  /admin/usuarios            → listarUsuarios
 *   GET  /admin/pets                → listarPets
 *   GET  /admin/petshops            → listarPetshops
 *   GET  /admin/pets-perdidos       → listarPerdidos
 *   POST /admin/pets-perdidos/:id/aprovar   → aprovarPerdido
 *   POST /admin/pets-perdidos/:id/escalar   → escalarAlerta
 *   GET  /admin/moderacao           → mostrarModeracao
 *   GET  /admin/configuracoes       → mostrarConfiguracoes
 *   POST /admin/configuracoes       → salvarConfiguracoes
 *   GET  /admin/gerenciar-mapa      → mostrarGerenciarMapa
 *   GET  /admin/mapa                → mostrarMapa
 */

const Usuario = require('../models/Usuario');
const Pet = require('../models/Pet');
const Petshop = require('../models/Petshop');
const PetPerdido = require('../models/PetPerdido');
const MensagemChat = require('../models/MensagemChat');
const Notificacao = require('../models/Notificacao');
const ConfigSistema = require('../models/ConfigSistema');
const CronExecucao = require('../models/CronExecucao');
const PontoMapa = require('../models/PontoMapa');
const Localizacao = require('../models/Localizacao');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const PetshopPost = require('../models/PetshopPost');
const PetshopAccount = require('../models/PetshopAccount');
const ManualBoost = require('../models/ManualBoost');
const notificacaoService = require('../services/notificacaoService');
const adminAnalyticsService = require('../services/adminAnalyticsService');
const petshopModerationService = require('../services/petshopModerationService');
const petshopPublishingService = require('../services/petshopPublishingService');
const petshopRecoveryIntegrationService = require('../services/petshopRecoveryIntegrationService');
const logger = require('../utils/logger');

const getAdminPath = () => process.env.ADMIN_PATH || '/admin';

function extrairFiltrosPerfil(origem = {}) {
  return {
    estado: (origem.estado || '').trim(),
    cidade: (origem.cidade || '').trim(),
    bairro: (origem.bairro || '').trim(),
    cep: (origem.cep || '').trim(),
    endereco: (origem.endereco || '').trim(),
  };
}

function temAlgumFiltroPerfil(filtros = {}) {
  return !!(filtros.estado || filtros.cidade || filtros.bairro || filtros.cep || filtros.endereco);
}

/**
 * dashboard — Exibe o painel administrativo com métricas gerais
 *
 * Rota: GET /admin/dashboard
 * View: admin/dashboard
 *
 * Agrega contadores de diversas tabelas:
 *   - Total de usuários cadastrados
 *   - Total de pets cadastrados
 *   - Total de pets perdidos (alertas ativos)
 *   - Total de petshops parceiros
 *   - Total de mensagens pendentes de moderação
 *   - Total de alertas pendentes de aprovação
 *
 * Todas as queries são executadas em PARALELO via Promise.all
 * para minimizar o tempo de carregamento da página.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function dashboard(req, res) {
  try {
    const maxUsuarios = parseInt(process.env.MAX_USUARIOS || '0', 10);

    const [
      totalUsuarios,
      pets,
      perdidos,
      petshops,
      mensagens,
      alertasPendentes,
      usuariosPorEstado,
      ultimosUsuarios,
    ] = await Promise.all([
      Usuario.contarTotal(),
      Pet.contarTotal(),
      PetPerdido.contarAtivos(),
      Petshop.contarTotal(),
      MensagemChat.contarPendentes(),
      PetPerdido.listarPendentes().then(lista => lista.length),
      Usuario.contarPorEstado(),
      Usuario.listarRecentes(8),
    ]);

    return res.render('admin/dashboard', {
      titulo: 'Painel Administrativo - AIRPET',
      stats: {
        usuarios: totalUsuarios,
        maxUsuarios: maxUsuarios > 0 ? maxUsuarios : null,
        pets,
        perdidos,
        petshops,
        mensagens,
        alertasPendentes,
      },
      usuariosPorEstado,
      ultimosUsuarios,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar dashboard', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o painel administrativo.' };
    return res.redirect('/');
  }
}

async function mostrarAnalyticsAvancado(req, res) {
  try {
    const periodoGlobal = req.query.periodo || 'week';
    const periodoInfluentes = periodoGlobal;
    const periodoRisco = req.query.risco || 'month';
    const periodoViral = req.query.viral || 'today';
    const periodoRacas = req.query.racas || periodoGlobal;
    const periodoCidades = req.query.cidades || periodoGlobal;

    const [
      influentes,
      engajamentoMedio,
      taxaResposta,
      perigosos,
      viralHoje,
      trendingRacas,
      cidades,
      timeline,
      postsVistos,
      resumoViews,
    ] = await Promise.all([
      adminAnalyticsService.topUsuariosInfluentes(periodoInfluentes, 10),
      adminAnalyticsService.topUsuariosPorEngajamentoMedio(periodoInfluentes, 10),
      adminAnalyticsService.topUsuariosPorResposta(periodoInfluentes, 10),
      adminAnalyticsService.usuariosPerigosos(periodoRisco, 10),
      adminAnalyticsService.conteudoViralPorPeriodo(periodoViral, 20),
      adminAnalyticsService.trendingBreeds(periodoRacas, 15),
      adminAnalyticsService.cidadesMaisAtivas(periodoCidades, 15),
      adminAnalyticsService.timelineCrescimento(30),
      adminAnalyticsService.postsMaisVistosDetalhado(periodoInfluentes, 20),
      adminAnalyticsService.resumoViewsOrganicoBoost(periodoInfluentes),
    ]);

    return res.render('admin/analytics', {
      titulo: 'Analytics avançado - AIRPET',
      influentes,
      engajamentoMedio,
      taxaResposta,
      perigosos,
      viralHoje,
      trendingRacas,
      cidades,
      timeline,
      postsVistos,
      resumoViews,
      periodoGlobal,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar analytics avançado', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar analytics.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * listarUsuarios — Lista todos os usuários do sistema
 *
 * Rota: GET /admin/usuarios
 * View: admin/usuarios
 *
 * Exibe todos os usuários (tutores e admins) com seus dados.
 * Ordenados do mais recente ao mais antigo.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listarUsuarios(req, res) {
  try {
    const { estado, cidade, status } = req.query;
    const filtros = {};
    if (estado) filtros.estado = estado;
    if (cidade) filtros.cidade = cidade;
    if (status === 'bloqueado') filtros.bloqueado = true;
    else if (status === 'ativo') filtros.bloqueado = false;

    const petshopParceirosQuery = PetshopAccount.listarParceirosResponsaveisAtivos(filtros);

    const [usuarios, estados, totalUsuarios, petshopParceiros] = await Promise.all([
      Object.keys(filtros).length ? Usuario.listarComFiltros(filtros) : Usuario.listarTodos(),
      Usuario.listarEstados(),
      Usuario.contarTotal(),
      petshopParceirosQuery,
    ]);

    const adminEmail = process.env.ADMIN_EMAIL || '';
    const maxUsuarios = parseInt(process.env.MAX_USUARIOS || '0', 10);
    const tab = req.query.tab === 'petshops' ? 'petshops' : 'usuarios';

    return res.render('admin/usuarios', {
      titulo: 'Usuários - AIRPET',
      usuarios,
      petshopParceiros: Array.isArray(petshopParceiros) ? petshopParceiros : [],
      petshopParceirosCount: (Array.isArray(petshopParceiros) ? petshopParceiros : []).length,
      adminEmail,
      estados: estados || [],
      filtros: { estado: estado || '', cidade: cidade || '', status: status || 'todos' },
      totalUsuarios,
      maxUsuarios: maxUsuarios > 0 ? maxUsuarios : null,
      tab,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar usuários', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de usuários.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * listarPets — Lista todos os pets do sistema
 *
 * Rota: GET /admin/pets
 * View: admin/pets
 *
 * Exibe todos os pets com o nome do dono (via JOIN).
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listarPets(req, res) {
  try {
    const pets = await Pet.listarTodos();

    return res.render('admin/pets', {
      titulo: 'Pets - AIRPET',
      pets,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar pets', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de pets.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * listarPetshops — Lista todos os petshops (ativos e inativos)
 *
 * Rota: GET /admin/petshops
 * View: admin/petshops
 *
 * Diferente da lista pública, o admin vê TODOS os petshops,
 * incluindo os inativos que não aparecem no mapa.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listarPetshops(req, res) {
  try {
    /* listarTodos() retorna ativos E inativos */
    const petshops = await Petshop.listarTodos();

    return res.render('admin/petshops', {
      titulo: 'Petshops - AIRPET',
      petshops,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar petshops', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de petshops.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * excluirPetshop — Remove permanentemente um petshop do sistema.
 * Rota: POST /admin/petshops/:id/excluir
 */
async function excluirPetshop(req, res) {
  const adminPath = getAdminPath();
  const { id } = req.params;

  try {
    const petshop = await Petshop.buscarPorId(id);

    if (!petshop) {
      req.session.flash = { tipo: 'erro', mensagem: 'Petshop não encontrado.' };
      return res.redirect(adminPath + '/petshops');
    }

    // Excluir petshop parceiro deve remover também a conta vinculada no sistema (como no delete de usuário).
    // O vínculo existe via petshop_accounts.usuario_id.
    const contaPetshop = await PetshopAccount.buscarPorPetshopId(id);
    if (contaPetshop && contaPetshop.usuario_id) {
      const usuarioVinculado = await Usuario.buscarPorId(contaPetshop.usuario_id);
      const adminEmail = process.env.ADMIN_EMAIL || '';
      if (adminEmail && usuarioVinculado && usuarioVinculado.email === adminEmail) {
        req.session.flash = { tipo: 'erro', mensagem: 'Não é possível excluir a conta do administrador.' };
        return res.redirect(adminPath + '/petshops');
      }
      await Usuario.deletar(contaPetshop.usuario_id);
    }

    await Petshop.deletar(id);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Petshop excluído permanentemente.' };
    return res.redirect(adminPath + '/petshops');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao excluir petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível excluir o petshop. Tente novamente.' };
    return res.redirect(adminPath + '/petshops');
  }
}

async function listarSolicitacoesPetshop(req, res) {
  try {
    const status = req.query.status || 'pendente';
    const [solicitacoes, promocoesPendentes, contagens] = await Promise.all([
      status === 'todas' ? PetshopPartnerRequest.listarTodas() : PetshopPartnerRequest.listarPorStatus(status),
      PetshopPost.listarModeracaoPendentes(),
      PetshopPartnerRequest.listarTodas().then((lista) => {
        return lista.reduce(
          (acc, item) => {
            acc.total += 1;
            if (item.status === 'pendente') acc.pendente += 1;
            else if (item.status === 'em_analise') acc.em_analise += 1;
            else if (item.status === 'aprovado') acc.aprovado += 1;
            else if (item.status === 'rejeitado') acc.rejeitado += 1;
            return acc;
          },
          { total: 0, pendente: 0, em_analise: 0, aprovado: 0, rejeitado: 0 }
        );
      }),
    ]);

    return res.render('admin/petshops-solicitacoes', {
      titulo: 'Solicitações de Parceria - AIRPET',
      solicitacoes,
      promocoesPendentes,
      filtroStatus: status,
      contagens,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar solicitações de petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar solicitações de petshop.' };
    return res.redirect(getAdminPath());
  }
}

async function aprovarSolicitacaoPetshop(req, res) {
  try {
    const { id } = req.params;
    await petshopModerationService.aprovarSolicitacao(id, req.session.admin && req.session.admin.email);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação aprovada e parceiro ativado.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao aprovar solicitação de petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: erro.message || 'Erro ao aprovar solicitação.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  }
}

async function rejeitarSolicitacaoPetshop(req, res) {
  try {
    const { id } = req.params;
    await petshopModerationService.rejeitarSolicitacao(
      id,
      req.body.motivo || null,
      req.session.admin && req.session.admin.email
    );
    req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação rejeitada.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao rejeitar solicitação de petshop', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao rejeitar solicitação.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  }
}

async function colocarSolicitacaoPetshopEmAnalise(req, res) {
  try {
    const { id } = req.params;
    await petshopModerationService.colocarEmAnalise(
      id,
      req.body.observacao || null,
      req.session.admin && req.session.admin.email
    );
    req.session.flash = { tipo: 'sucesso', mensagem: 'Solicitação movida para em análise.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao mover solicitação para análise', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar status da solicitação.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  }
}

async function contatarSuportePetshop(req, res) {
  req.session.flash = {
    tipo: 'sucesso',
    mensagem: 'Ticket de suporte registrado para contato com o petshop.',
  };
  return res.redirect(getAdminPath() + '/petshops/solicitacoes');
}

async function aprovarPromocaoPetshop(req, res) {
  try {
    const post = await PetshopPost.atualizarAprovacao(req.params.id, 'aprovado');
    if (post) {
      await petshopPublishingService.notificarVinculados(
        post.petshop_id,
        post.titulo || 'Nova promoção disponível',
        '/petshops/' + post.petshop_id,
        'sistema'
      );
    }
    req.session.flash = { tipo: 'sucesso', mensagem: 'Promoção aprovada e publicada.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao aprovar promoção', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao aprovar promoção.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  }
}

async function rejeitarPromocaoPetshop(req, res) {
  try {
    await PetshopPost.atualizarAprovacao(req.params.id, 'rejeitado');
    req.session.flash = { tipo: 'sucesso', mensagem: 'Promoção rejeitada.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao rejeitar promoção', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao rejeitar promoção.' };
    return res.redirect(getAdminPath() + '/petshops/solicitacoes');
  }
}

/**
 * listarPerdidos — Lista todos os alertas de pets perdidos
 *
 * Rota: GET /admin/pets-perdidos
 * View: admin/pets-perdidos
 *
 * Exibe todos os alertas (pendentes, aprovados, resolvidos)
 * com dados enriquecidos do pet e do tutor.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listarPerdidos(req, res) {
  try {
    const [perdidos, cronRecentes, cronUltima, configs] = await Promise.all([
      PetPerdido.listarTodos(),
      CronExecucao.listarRecentes(CronExecucao.JOB_ESCALAR_ALERTAS, 10),
      CronExecucao.buscarUltima(CronExecucao.JOB_ESCALAR_ALERTAS),
      ConfigSistema.listarTodas(),
    ]);

    const intervaloMin = (configs.find(c => c.chave === 'cron_intervalo_alertas_min')?.valor) || '30';
    const intervaloMs = parseInt(intervaloMin, 10) * 60 * 1000;
    let proximaExecucaoEm = null;
    if (cronUltima && cronUltima.finalizado_em) {
      const proxima = new Date(cronUltima.finalizado_em).getTime() + intervaloMs;
      proximaExecucaoEm = Math.max(0, Math.round((proxima - Date.now()) / 60000));
    }

    return res.render('admin/pets-perdidos', {
      titulo: 'Pets Perdidos - AIRPET',
      perdidos,
      cronRecentes: cronRecentes || [],
      cronUltima: cronUltima || null,
      proximaExecucaoEm,
      intervaloMin,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar pets perdidos', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de pets perdidos.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * aprovarPerdido — Aprova um alerta de pet perdido
 *
 * Rota: POST /admin/pets-perdidos/:id/aprovar
 *
 * Fluxo:
 *   1. Busca o alerta pelo ID
 *   2. Aprova o alerta (status → aprovado, nível de alerta → 1)
 *   3. Dispara notificações de proximidade para usuários próximos
 *   4. Redireciona com mensagem de sucesso
 *
 * Ao aprovar, o sistema pode disparar notificações para usuários
 * que estejam dentro do raio configurado (config_sistema.raio_notificacao).
 * As notificações são criadas via Notificacao.criarParaMultiplos().
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function aprovarPerdido(req, res) {
  try {
    const { id } = req.params;

    /* Busca o alerta para obter dados completos */
    const alerta = await PetPerdido.buscarPorId(id);

    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Alerta de pet perdido não encontrado.' };
      return res.redirect(getAdminPath() + '/pets-perdidos');
    }

    await PetPerdido.aprovar(id);

    try {
      await notificacaoService.criar(alerta.usuario_id, 'alerta',
        `O alerta para ${alerta.pet_nome} foi aprovado e está visível no mapa.`,
        `/pets/${alerta.pet_id}`
      );
    } catch (e) { logger.error('AdminController', 'Erro notificação tutor', e); }

    try {
      const configs = await ConfigSistema.listarTodas();
      const raioConfig = configs.find(c => c.chave === 'raio_alerta_nivel1_km');
      const raioKm = raioConfig ? parseFloat(raioConfig.valor) : 1;
      if (alerta.latitude && alerta.longitude) {
        await notificacaoService.notificarProximos(id, raioKm);
        await petshopRecoveryIntegrationService.notificarPetshopsProximos({
          pet_perdido_id: id,
          latitude: alerta.latitude,
          longitude: alerta.longitude,
          raioMetros: Math.max(1000, raioKm * 1000),
          origem: 'aprovacao_admin',
        });
      }
    } catch (e) { logger.error('AdminController', 'Erro notificação proximidade (não crítico)', e); }

    logger.info('AdminController', `Alerta aprovado: ${id} (pet: ${alerta.pet_nome})`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Alerta de ${alerta.pet_nome} aprovado. O alerta agora está visível no mapa.` };
    return res.redirect(getAdminPath() + '/pets-perdidos');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao aprovar alerta de pet perdido', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao aprovar o alerta.' };
    return res.redirect(getAdminPath() + '/pets-perdidos');
  }
}

/**
 * escalarAlerta — Escalona manualmente o nível de alerta de um pet perdido
 *
 * Rota: POST /admin/pets-perdidos/:id/escalar
 *
 * Níveis de alerta:
 *   1 → Raio pequeno (ex: 2km) — notifica apenas vizinhança
 *   2 → Raio médio (ex: 5km) — notifica bairros próximos
 *   3 → Raio grande (ex: 15km) — notifica toda a cidade
 *
 * Cada escalação amplia o raio de notificação, alcançando
 * mais voluntários que possam ajudar na busca.
 *
 * @param {object} req - Requisição Express com params.id e body.nivel
 * @param {object} res - Resposta Express
 */
async function escalarAlerta(req, res) {
  const adminPath = process.env.ADMIN_PATH || '/admin';
  try {
    const { id } = req.params;
    const { nivel } = req.body;

    /* Busca o alerta primeiro (para validar e, se não vier nivel no body, calcular próximo nível) */
    const alerta = await PetPerdido.buscarPorId(id);

    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Alerta de pet perdido não encontrado.' };
      return res.redirect(adminPath + '/pets-perdidos');
    }

    /* Nível: se vier no body (1–3), usa; senão sobe um nível (1→2→3) como no botão "Escalar Alerta" */
    let nivelNumero = parseInt(nivel, 10);
    if (!nivelNumero || nivelNumero < 1 || nivelNumero > 3) {
      const atual = alerta.nivel_alerta || 1;
      nivelNumero = Math.min(atual + 1, 3);
      if (nivelNumero === atual) {
        req.session.flash = { tipo: 'erro', mensagem: 'Alerta já está no nível máximo (3).' };
        return res.redirect(adminPath + '/pets-perdidos');
      }
    }

    await PetPerdido.atualizarNivel(id, nivelNumero);

    try {
      await notificacaoService.notificarTodos(id);
      if (alerta.latitude && alerta.longitude) {
        await petshopRecoveryIntegrationService.notificarPetshopsProximos({
          pet_perdido_id: id,
          latitude: alerta.latitude,
          longitude: alerta.longitude,
          raioMetros: 12000,
          origem: 'escalacao_admin',
        });
      }
    } catch (e) { logger.error('AdminController', 'Erro notificação escalar', e); }

    logger.info('AdminController', `Alerta ${id} escalado para nível ${nivelNumero}`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Nível de alerta atualizado para ${nivelNumero}. Notificações enviadas.` };
    return res.redirect(adminPath + '/pets-perdidos');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao escalar alerta', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar o nível de alerta.' };
    return res.redirect(adminPath + '/pets-perdidos');
  }
}

/**
 * mostrarModeracao — Exibe a página de moderação de mensagens
 *
 * Rota: GET /admin/moderacao
 * View: admin/moderacao
 *
 * Lista todas as mensagens de chat que estão pendentes de moderação.
 * O admin pode aprovar ou rejeitar cada mensagem.
 * Mensagens aprovadas ficam visíveis na conversa.
 * Mensagens rejeitadas são ocultadas permanentemente.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function mostrarModeracao(req, res) {
  try {
    /* Busca todas as mensagens com status 'pendente' */
    const mensagensPendentes = await MensagemChat.buscarPendentes();

    return res.render('admin/moderacao', {
      titulo: 'Moderação de Mensagens - AIRPET',
      mensagens: mensagensPendentes,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar moderação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar as mensagens para moderação.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * mostrarConfiguracoes — Exibe a página de configurações do sistema
 *
 * Rota: GET /admin/configuracoes
 * View: admin/configuracoes
 *
 * Mostra todos os pares chave-valor de configuração do sistema.
 * O admin pode editar os valores diretamente nesta página.
 *
 * Exemplos de configurações:
 *   - raio_busca_metros: raio de busca padrão no mapa
 *   - raio_notificacao: raio para notificações de proximidade
 *   - max_upload_tamanho: tamanho máximo de upload de fotos
 *   - intervalo_vacina_alerta: dias de antecedência para alerta de vacina
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function mostrarConfiguracoes(req, res) {
  try {
    /* Busca todas as configurações ordenadas por chave */
    const configuracoes = await ConfigSistema.listarTodas();

    return res.render('admin/configuracoes', {
      titulo: 'Configurações do Sistema - AIRPET',
      configuracoes,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar configurações', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar as configurações.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * salvarConfiguracoes — Salva as configurações do sistema
 *
 * Rota: POST /admin/configuracoes
 *
 * Recebe um objeto com pares chave-valor no corpo da requisição.
 * Atualiza cada configuração individualmente no banco.
 *
 * O body esperado tem a estrutura:
 *   { config_chave1: 'novo_valor1', config_chave2: 'novo_valor2', ... }
 *
 * @param {object} req - Requisição Express com body contendo pares chave-valor
 * @param {object} res - Resposta Express
 */
async function salvarConfiguracoes(req, res) {
  try {
    const configs = req.body.config || req.body;

    const promessas = Object.entries(configs).map(([chave, valor]) => {
      return ConfigSistema.atualizar(chave, valor);
    });

    await Promise.all(promessas);

    logger.info('AdminController', `Configurações atualizadas: ${Object.keys(configs).length} itens`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Configurações salvas com sucesso!' };
    return res.redirect(getAdminPath() + '/configuracoes');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao salvar configurações', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar as configurações.' };
    return res.redirect(getAdminPath() + '/configuracoes');
  }
}

/**
 * mostrarGerenciarMapa — Exibe a página de gestão de pontos do mapa
 *
 * Rota: GET /admin/gerenciar-mapa
 * View: admin/gerenciar-mapa
 *
 * Mostra todos os pontos de interesse cadastrados no mapa
 * com opções de criar, editar, ativar/desativar e deletar.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function mostrarGerenciarMapa(req, res) {
  try {
    const pontos = await PontoMapa.listarTodos();

    // Garante renderização HTML (nunca download) e evita cache de página administrativa.
    res.removeHeader('Content-Disposition');
    res.type('html');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.render('admin/gerenciar-mapa', {
      titulo: 'Gerenciar Mapa - AIRPET',
      pontos,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar gerenciar mapa', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a gestão do mapa.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * mostrarMapa — Exibe o mapa administrativo completo
 *
 * Rota: GET /admin/mapa
 * View: admin/mapa
 *
 * Mostra o mapa com TODOS os dados sobrepostos:
 *   - Pontos de interesse (abrigos, ONGs, clínicas)
 *   - Petshops parceiros
 *   - Alertas de pets perdidos ativos
 *   - Localizações recentes de scans
 *
 * Esta view é mais completa que o mapa público, pois
 * inclui dados administrativos e filtros avançados.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function mostrarMapa(req, res) {
  try {
    const [pontos, petshops, perdidos, avistamentos, concentracaoCidades] = await Promise.all([
      PontoMapa.listarTodos(),
      Petshop.listarTodos(),
      PetPerdido.listarTodos(),
      Localizacao.listarParaAdminMapa(500),
      Localizacao.contarPorCidade(30),
    ]);

    // Garante renderização HTML (nunca download) e evita cache de página administrativa.
    res.removeHeader('Content-Disposition');
    res.type('html');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.render('admin/mapa', {
      titulo: 'Mapa Administrativo - AIRPET',
      pontos,
      petshops,
      perdidos,
      avistamentos,
      concentracaoCidades,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar mapa administrativo', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o mapa.' };
    return res.redirect(getAdminPath());
  }
}

async function rejeitarPerdido(req, res) {
  try {
    const { id } = req.params;
    const alerta = await PetPerdido.buscarPorId(id);
    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Alerta não encontrado.' };
      return res.redirect(getAdminPath() + '/pets-perdidos');
    }

    await PetPerdido.rejeitar(id);
    await Pet.atualizarStatus(alerta.pet_id, 'seguro');

    try {
      await notificacaoService.criar(alerta.usuario_id, 'sistema',
        `O alerta de ${alerta.pet_nome} foi rejeitado pelo administrador. Verifique os dados e tente novamente.`,
        `/pets/${alerta.pet_id}`
      );
    } catch (e) { logger.error('AdminController', 'Erro notificação rejeição', e); }

    req.session.flash = { tipo: 'sucesso', mensagem: `Alerta de ${alerta.pet_nome} rejeitado.` };
    return res.redirect(getAdminPath() + '/pets-perdidos');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao rejeitar alerta', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao rejeitar o alerta.' };
    return res.redirect(getAdminPath() + '/pets-perdidos');
  }
}

async function atualizarRoleUsuario(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['usuario', 'admin'].includes(role)) {
      req.session.flash = { tipo: 'erro', mensagem: 'Role inválido.' };
      return res.redirect(getAdminPath() + '/usuarios');
    }
    await Usuario.atualizarRole(id, role);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Papel do usuário atualizado.' };
    return res.redirect(getAdminPath() + '/usuarios');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao atualizar role', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar papel do usuário.' };
    return res.redirect(getAdminPath() + '/usuarios');
  }
}

async function toggleBloqueioUsuario(req, res) {
  try {
    const { id } = req.params;
    const usuario = await Usuario.buscarPorId(id);
    if (!usuario) {
      req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
      return res.redirect(getAdminPath() + '/usuarios');
    }
    const adminEmail = process.env.ADMIN_EMAIL || '';
    if (adminEmail && usuario.email === adminEmail) {
      req.session.flash = { tipo: 'erro', mensagem: 'Não é possível bloquear o usuário administrador.' };
      return res.redirect(getAdminPath() + '/usuarios');
    }
    const novoEstado = !usuario.bloqueado;
    await Usuario.atualizarBloqueado(id, novoEstado);
    req.session.flash = { tipo: 'sucesso', mensagem: novoEstado ? 'Usuário bloqueado.' : 'Usuário desbloqueado.' };
    return res.redirect(getAdminPath() + '/usuarios');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao bloquear/desbloquear usuário', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao atualizar status do usuário.' };
    return res.redirect(getAdminPath() + '/usuarios');
  }
}

async function aprovarMensagem(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.session.admin ? null : req.session.usuario?.id;
    const msg = await MensagemChat.aprovar(id, adminId);
    const io = req.app.get('io');
    const { entregarMensagemAprovada } = require('../services/chatAprovacaoEntrega');
    await entregarMensagemAprovada(io, msg);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Mensagem aprovada.' };
    return res.redirect(getAdminPath() + '/moderacao');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao aprovar mensagem', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao aprovar mensagem.' };
    return res.redirect(getAdminPath() + '/moderacao');
  }
}

async function rejeitarMensagem(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.session.admin ? null : req.session.usuario?.id;
    await MensagemChat.rejeitar(id, adminId);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Mensagem rejeitada.' };
    return res.redirect(getAdminPath() + '/moderacao');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao rejeitar mensagem', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao rejeitar mensagem.' };
    return res.redirect(getAdminPath() + '/moderacao');
  }
}

/**
 * mostrarAparencia — Exibe a página de aparência / PWA (ícones e cores)
 * Rota: GET /admin/aparencia
 */
async function mostrarAparencia(req, res) {
  try {
    const configs = await ConfigSistema.listarTodas();
    const aparencia = {};
    const chaves = [
      'pwa_theme_color',
      'pwa_background_color',
      'pwa_icon_192',
      'pwa_icon_512',
      'app_primary_color',
      'app_primary_hover_color',
      'app_accent_glow',
      'app_green_color',
      'app_red_color',
      'app_purple_color',
      'app_blue_color',
      'app_yellow_color',
      'app_name',
    ];
    chaves.forEach(chave => {
      const c = configs.find(x => x.chave === chave);
      if (c) aparencia[chave] = c.valor;
    });
    return res.render('admin/aparencia', {
      titulo: 'Aparência / PWA - AIRPET',
      aparencia,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao carregar aparência', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a página de aparência.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * salvarAparencia — Salva ícones (upload) e cores de aparência
 * Rota: POST /admin/aparencia (multipart: icon_192, icon_512 + body: pwa_theme_color, pwa_background_color, app_primary_color, app_name)
 */
async function salvarAparencia(req, res) {
  try {
    const adminPath = process.env.ADMIN_PATH || '/admin';
    const files = req.files || {};
    const icon192File = files.icon_192 && files.icon_192[0];
    const icon512File = files.icon_512 && files.icon_512[0];

    const cacheBust = '?v=' + Date.now();

    const urlFromPwaFile = (f) => (f && f.storagePublicUrl ? f.storagePublicUrl : f && f.filename ? `/images/pwa/${f.filename}` : null);

    if (icon192File && urlFromPwaFile(icon192File)) {
      const url192 = urlFromPwaFile(icon192File) + cacheBust;
      await ConfigSistema.inserirOuAtualizar('pwa_icon_192', url192, 'URL do ícone 192x192');
      if (!icon512File || !urlFromPwaFile(icon512File)) {
        await ConfigSistema.inserirOuAtualizar('pwa_icon_512', url192, 'URL do ícone 512x512');
      }
    }
    if (icon512File && urlFromPwaFile(icon512File)) {
      const url512 = urlFromPwaFile(icon512File) + cacheBust;
      await ConfigSistema.inserirOuAtualizar('pwa_icon_512', url512, 'URL do ícone 512x512');
      if (!icon192File || !urlFromPwaFile(icon192File)) {
        await ConfigSistema.inserirOuAtualizar('pwa_icon_192', url512, 'URL do ícone 192x192');
      }
    }

    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const rgbaRegex = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/;
    const hexOrFallback = (value, fallback) => {
      const v = String(value || '').trim();
      return hexRegex.test(v) ? v : fallback;
    };
    const rgbaOrFallback = (value, fallback) => {
      const v = String(value || '').trim();
      return rgbaRegex.test(v) ? v : fallback;
    };

    const pwaThemeColor = hexOrFallback(req.body.pwa_theme_color, '#f26020');
    const pwaBackgroundColor = (req.body.pwa_background_color || '#ffffff').trim();
    const appPrimaryColor = hexOrFallback(req.body.app_primary_color, '#f26020');
    const appPrimaryHoverColor = hexOrFallback(req.body.app_primary_hover_color, '#ff7a3d');
    const appAccentGlow = rgbaOrFallback(req.body.app_accent_glow, 'rgba(242,96,32,0.12)');
    const appGreenColor = hexOrFallback(req.body.app_green_color, '#22c55e');
    const appRedColor = hexOrFallback(req.body.app_red_color, '#ef4444');
    const appPurpleColor = hexOrFallback(req.body.app_purple_color, '#a78bfa');
    const appBlueColor = hexOrFallback(req.body.app_blue_color, '#60a5fa');
    const appYellowColor = hexOrFallback(req.body.app_yellow_color, '#facc15');
    const appName = (req.body.app_name || 'AIRPET').trim().slice(0, 30);

    await ConfigSistema.inserirOuAtualizar('pwa_theme_color', pwaThemeColor, 'Cor do tema PWA e barra do navegador');
    await ConfigSistema.inserirOuAtualizar('pwa_background_color', pwaBackgroundColor, 'Cor de fundo do PWA');
    await ConfigSistema.inserirOuAtualizar('app_primary_color', appPrimaryColor, 'Cor principal do site (botões, links)');
    await ConfigSistema.inserirOuAtualizar('app_primary_hover_color', appPrimaryHoverColor, 'Cor de hover da primária');
    await ConfigSistema.inserirOuAtualizar('app_accent_glow', appAccentGlow, 'Glow da cor primária');
    await ConfigSistema.inserirOuAtualizar('app_green_color', appGreenColor, 'Cor global de sucesso');
    await ConfigSistema.inserirOuAtualizar('app_red_color', appRedColor, 'Cor global de erro');
    await ConfigSistema.inserirOuAtualizar('app_purple_color', appPurpleColor, 'Cor global roxa');
    await ConfigSistema.inserirOuAtualizar('app_blue_color', appBlueColor, 'Cor global azul');
    await ConfigSistema.inserirOuAtualizar('app_yellow_color', appYellowColor, 'Cor global amarela');
    await ConfigSistema.inserirOuAtualizar('app_name', appName || 'AIRPET', 'Nome curto do aplicativo');

    req.session.flash = { tipo: 'sucesso', mensagem: 'Aparência salva com sucesso! O site e o PWA usarão as novas cores e ícones.' };
    return res.redirect(adminPath + '/aparencia');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao salvar aparência', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar a aparência. Tente novamente.' };
    return res.redirect((process.env.ADMIN_PATH || '/admin') + '/aparencia');
  }
}

/**
 * excluirUsuario — Remove permanentemente um usuário e anula FKs que não têm CASCADE
 * Rota: POST /admin/usuarios/:id/excluir
 */
async function excluirUsuario(req, res) {
  const adminPath = process.env.ADMIN_PATH || '/admin';
  const { id } = req.params;
  const adminEmail = process.env.ADMIN_EMAIL || '';

  try {
    const usuario = await Usuario.buscarPorId(id);
    if (!usuario) {
      req.session.flash = { tipo: 'erro', mensagem: 'Usuário não encontrado.' };
      return res.redirect(adminPath + '/usuarios');
    }
    if (adminEmail && usuario.email === adminEmail) {
      req.session.flash = { tipo: 'erro', mensagem: 'Não é possível excluir o administrador principal.' };
      return res.redirect(adminPath + '/usuarios');
    }

    await Usuario.anularReferenciasAntesExcluir(id);

    await Usuario.deletar(id);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Cadastro excluído permanentemente.' };
    return res.redirect(adminPath + '/usuarios');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao excluir usuário', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível excluir o cadastro. Tente novamente.' };
    return res.redirect(adminPath + '/usuarios');
  }
}

/**
 * mostrarEnviarNotificacao — Exibe o formulário para enviar notificação por região
 *
 * Rota: GET /admin/notificacoes/enviar
 * View: admin/enviar-notificacao
 */
async function mostrarEnviarNotificacao(req, res) {
  try {
    const [estadosComContagem, cidadesComContagem, bairrosComContagem] = await Promise.all([
      Usuario.listarEstadosComContagem(),
      Usuario.listarCidadesPorEstadoComContagem(),
      Usuario.listarBairrosPorCidadeEstadoComContagem(),
    ]);
    return res.render('admin/enviar-notificacao', {
      titulo: 'Notificação em massa - AIRPET Admin',
      estadosComContagem: estadosComContagem || [],
      cidadesComContagem: cidadesComContagem || [],
      bairrosComContagem: bairrosComContagem || [],
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao exibir formulário de notificação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a página.' };
    return res.redirect(getAdminPath());
  }
}

/**
 * previewEnviarNotificacao — Retorna quantos usuários receberão a notificação (sem enviar)
 *
 * Rota: GET /admin/notificacoes/enviar/preview?lat=...&lng=...&raio_km=...
 */
async function previewEnviarNotificacao(req, res) {
  try {
    const modo = (req.query.modo || '').trim();

    if (modo === 'geografico') {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const raioKm = parseFloat(req.query.raio_km);
      if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(raioKm) || raioKm <= 0) {
        return res.status(400).json({ sucesso: false, total: 0, mensagem: 'Informe latitude, longitude e raio (km) válidos.' });
      }
      const total = await notificacaoService.contarUsuariosNaRegiao(lat, lng, raioKm);
      return res.json({ sucesso: true, total });
    }

    const filtros = extrairFiltrosPerfil(req.query);
    if (!temAlgumFiltroPerfil(filtros)) {
      return res.status(400).json({ sucesso: false, total: 0, mensagem: 'Selecione ao menos um filtro de região ou use o modo geográfico.' });
    }
    const total = await notificacaoService.contarUsuariosPorPerfilRegiao(filtros);
    return res.json({ sucesso: true, total });
  } catch (erro) {
    logger.error('AdminController', 'Erro no preview de notificação', erro);
    return res.status(500).json({ sucesso: false, total: 0, mensagem: 'Erro ao consultar região.' });
  }
}

/**
 * enviarNotificacaoRegiao — Envia notificação para usuários dentro do raio
 *
 * Rota: POST /admin/notificacoes/enviar
 * Body: latitude, longitude, raio_km, titulo, mensagem, link (opcional)
 */
async function enviarNotificacaoRegiao(req, res) {
  const adminPath = getAdminPath();
  try {
    const titulo = (req.body.titulo || '').trim() || 'AIRPET';
    const mensagem = (req.body.mensagem || '').trim();
    const link = (req.body.link || '').trim() || null;
    const modo = (req.body.modo || '').trim();

    if (!mensagem) {
      req.session.flash = { tipo: 'erro', mensagem: 'A mensagem é obrigatória.' };
      return res.redirect(adminPath + '/notificacoes/enviar');
    }

    let notificacoes = [];

    if (modo === 'geografico') {
      const lat = parseFloat(req.body.lat);
      const lng = parseFloat(req.body.lng);
      const raioKm = parseFloat(req.body.raio_km);
      if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(raioKm) || raioKm <= 0) {
        req.session.flash = { tipo: 'erro', mensagem: 'No modo geográfico, informe latitude, longitude e raio (km) válidos.' };
        return res.redirect(adminPath + '/notificacoes/enviar');
      }
      notificacoes = await notificacaoService.notificarPorRegiao(lat, lng, raioKm, titulo, mensagem, link);
    } else {
      const filtros = extrairFiltrosPerfil(req.body);
      if (!temAlgumFiltroPerfil(filtros)) {
        req.session.flash = { tipo: 'erro', mensagem: 'Selecione ao menos um filtro de região ou use o modo geográfico.' };
        return res.redirect(adminPath + '/notificacoes/enviar');
      }
      notificacoes = await notificacaoService.notificarPorPerfilRegiao(filtros, titulo, mensagem, link);
    }

    if (notificacoes.length === 0) {
      req.session.flash = { tipo: 'aviso', mensagem: 'Nenhum usuário encontrado para a região filtrada.' };
    } else {
      req.session.flash = { tipo: 'sucesso', mensagem: `Notificação enviada para ${notificacoes.length} usuário(s).` };
    }
    return res.redirect(adminPath + '/notificacoes/enviar');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao enviar notificação por região', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao enviar notificações. Tente novamente.' };
    return res.redirect(adminPath + '/notificacoes/enviar');
  }
}

async function listarBoosts(req, res) {
  try {
    const boostsAtivos = await ManualBoost.listarAtivosPorPet(200);

    return res.render('admin/boosts', {
      titulo: 'Boosts - AIRPET',
      boosts: boostsAtivos,
    });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao listar boosts', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os boosts.' };
    return res.redirect(getAdminPath());
  }
}

async function buscarUsuariosParaBoost(req, res) {
  try {
    const termo = (req.query.q || '').trim().toLowerCase();
    if (termo.length < 2) return res.json({ sucesso: true, usuarios: [] });

    const usuarios = await Usuario.buscarPorNomeParcialParaAdmin(termo, 20);

    return res.json({ sucesso: true, usuarios });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao buscar usuários para boost', erro);
    return res.status(500).json({ sucesso: false, usuarios: [] });
  }
}

async function buscarPetsParaBoost(req, res) {
  try {
    const usuarioId = parseInt(req.query.usuarioId, 10);
    if (!usuarioId) {
      return res.status(400).json({ sucesso: false, pets: [], mensagem: 'usuarioId inválido.' });
    }

    const pets = await Pet.buscarPorUsuario(usuarioId);
    return res.json({ sucesso: true, pets: pets || [] });
  } catch (erro) {
    logger.error('AdminController', 'Erro ao buscar pets para boost', erro);
    return res.status(500).json({ sucesso: false, pets: [] });
  }
}

async function criarBoost(req, res) {
  try {
    const { target_type, target_id, selected_user_id, selected_pet_id, boost_value, duracao_horas, motivo } = req.body || {};
    const adminPath = getAdminPath();

    const tipo = (target_type || '').trim();
    const idAlvo = parseInt(target_id || selected_user_id || selected_pet_id, 10);
    const valor = parseFloat(boost_value);
    const horas = parseInt(duracao_horas || '2', 10);

    if (!tipo || tipo !== 'pet') {
      req.session.flash = { tipo: 'erro', mensagem: 'Impulsionamento permitido apenas para perfil de pet patrocinado.' };
      return res.redirect(adminPath + '/boosts');
    }

    if (!idAlvo || Number.isNaN(valor)) {
      req.session.flash = { tipo: 'erro', mensagem: 'Selecione um pet válido e informe o valor do boost.' };
      return res.redirect(adminPath + '/boosts');
    }

    if (valor <= 0 || valor > 1000) {
      req.session.flash = { tipo: 'erro', mensagem: 'Valor do boost deve ser entre 1 e 1000.' };
      return res.redirect(adminPath + '/boosts');
    }

    if (Number.isNaN(horas) || horas <= 0 || horas > 168) {
      req.session.flash = { tipo: 'erro', mensagem: 'Duração inválida. Use entre 1 e 168 horas.' };
      return res.redirect(adminPath + '/boosts');
    }

    const petAlvo = await Pet.buscarPorId(idAlvo);
    if (!petAlvo) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet alvo não encontrado. Selecione novamente.' };
      return res.redirect(adminPath + '/boosts');
    }

    // manual_boosts.created_by_admin é INTEGER; sessão de admin guarda email.
    // Só gravamos um id numérico válido para evitar erro de tipo no INSERT.
    const possibleAdminId = Number.parseInt(req.session?.usuario?.id, 10);
    const createdBy = Number.isInteger(possibleAdminId) && possibleAdminId > 0 ? possibleAdminId : null;

    await ManualBoost.criar({
      target_type: tipo,
      target_id: idAlvo,
      boost_value: valor,
      reason: motivo || null,
      duracao_horas: horas,
      created_by_admin: createdBy,
    });

    req.session.flash = { tipo: 'sucesso', mensagem: 'Boost criado com sucesso.' };
    return res.redirect(adminPath + '/boosts');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao criar boost', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao criar boost. Tente novamente.' };
    return res.redirect(getAdminPath() + '/boosts');
  }
}

async function cancelarBoost(req, res) {
  try {
    const { id } = req.params;
    const adminPath = getAdminPath();
    await ManualBoost.encerrarAgora(id);
    req.session.flash = { tipo: 'sucesso', mensagem: 'Boost cancelado.' };
    return res.redirect(adminPath + '/boosts');
  } catch (erro) {
    logger.error('AdminController', 'Erro ao cancelar boost', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao cancelar o boost.' };
    return res.redirect(getAdminPath() + '/boosts');
  }
}

module.exports = {
  dashboard,
  listarUsuarios,
  listarPets,
  listarPetshops,
  listarSolicitacoesPetshop,
  aprovarSolicitacaoPetshop,
  rejeitarSolicitacaoPetshop,
  colocarSolicitacaoPetshopEmAnalise,
  contatarSuportePetshop,
  aprovarPromocaoPetshop,
  rejeitarPromocaoPetshop,
  listarPerdidos,
  aprovarPerdido,
  rejeitarPerdido,
  escalarAlerta,
  mostrarModeracao,
  aprovarMensagem,
  rejeitarMensagem,
  mostrarConfiguracoes,
  salvarConfiguracoes,
  mostrarAparencia,
  salvarAparencia,
  excluirUsuario,
  excluirPetshop,
  mostrarGerenciarMapa,
  mostrarMapa,
  atualizarRoleUsuario,
  toggleBloqueioUsuario,
  mostrarEnviarNotificacao,
  previewEnviarNotificacao,
  enviarNotificacaoRegiao,
  mostrarAnalyticsAvancado,
  listarBoosts,
  buscarUsuariosParaBoost,
  buscarPetsParaBoost,
  criarBoost,
  cancelarBoost,
};
