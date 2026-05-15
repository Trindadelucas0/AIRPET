/**
 * petPerdidoController.js — Controller de Pets Perdidos do AIRPET
 *
 * Gerencia o fluxo de reporte e resolução de pets perdidos.
 *
 * Fluxo completo de um pet perdido:
 *   1. Tutor reporta o pet como perdido (formulário)
 *   2. O sistema cria um registro com status 'pendente'
 *   3. Admin revisa e aprova o alerta (muda para 'aprovado')
 *   4. O alerta aparece no mapa público e notifica usuários próximos
 *   5. Quando o pet é encontrado, o tutor marca como 'resolvido'
 *   6. O sistema limpa as conversas e mensagens associadas (LGPD)
 *
 * Segurança:
 *   - Somente o dono do pet pode reportá-lo como perdido
 *   - Somente o dono pode marcar como resolvido
 *   - O alerta só aparece publicamente após aprovação do admin
 *
 * Rotas:
 *   GET  /pets/:pet_id/perdido        → mostrarFormulario
 *   POST /pets/:pet_id/perdido        → reportar
 *   POST /pets-perdidos/:id/resolver  → resolver
 */

const PetPerdido = require('../models/PetPerdido');
const Pet = require('../models/Pet');
const TagScan = require('../models/TagScan');
const Conversa = require('../models/Conversa');
const MensagemChat = require('../models/MensagemChat');
const { withTransaction } = require('../config/database');
const logger = require('../utils/logger');
const { sameNumericId } = require('../utils/sameNumericId');

/** Redirect interno seguro após reporte (ex.: /p/slug?tab=scans). */
function resolveSafeReturnTo(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  const s = value.trim();
  if (!s.startsWith('/') || s.startsWith('//')) return fallback;
  if (s.includes('..') || /\s/.test(s)) return fallback;
  if (!/^\/(p|pets)\//.test(s)) return fallback;
  return s;
}

/**
 * mostrarFormulario — Renderiza o formulário de reporte de pet perdido
 *
 * Rota: GET /pets/:pet_id/perdido
 * View: pets-perdidos/formulario (ou renderizado dentro do perfil do pet)
 *
 * Verifica se o pet existe e pertence ao usuário logado
 * antes de exibir o formulário.
 *
 * @param {object} req - Requisição Express com params.pet_id
 * @param {object} res - Resposta Express
 */
async function mostrarFormulario(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;

    /* Busca o pet para verificar existência e propriedade */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      return res.status(404).render('partials/erro', {
        titulo: 'Pet não encontrado',
        mensagem: 'O pet que você procura não existe ou foi removido.',
        codigo: 404,
      });
    }

    /* Somente o dono pode reportar o pet como perdido */
    if (!sameNumericId(pet.usuario_id, usuarioId)) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para reportar este pet.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    const ultimoScan = await TagScan.ultimoScanPet(pet_id);
    const returnTo = resolveSafeReturnTo(
      req.query.return_to,
      pet.slug ? `/p/${pet.slug}?tab=scans` : `/pets/${pet_id}`
    );

    return res.render('pets-perdidos/formulario', {
      titulo: `Reportar ${pet.nome} como Perdido - AIRPET`,
      pet,
      ultimoScan,
      returnTo,
    });
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao exibir formulário de reporte', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o formulário.' };
    return res.redirect('/pets');
  }
}

/**
 * reportar — Cria um novo reporte de pet perdido
 *
 * Rota: POST /pets/:pet_id/perdido
 *
 * Fluxo:
 *   1. Verifica se o pet existe e pertence ao usuário
 *   2. Cria o alerta com status 'pendente' (aguarda aprovação do admin)
 *   3. Atualiza o status do pet para 'perdido' na tabela pets
 *   4. Exibe mensagem informando que o formulário foi enviado para análise
 *
 * O alerta NÃO fica visível publicamente até o admin aprovar.
 * Isso previne alarmes falsos e uso indevido do sistema.
 *
 * @param {object} req - Requisição Express com params.pet_id e body { descricao, latitude, longitude }
 * @param {object} res - Resposta Express
 */
async function reportar(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;
    const { descricao, latitude, longitude, recompensa, data_hora_desaparecimento, return_to } = req.body;

    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
      return res.redirect('/pets');
    }

    if (!sameNumericId(pet.usuario_id, usuarioId)) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para reportar este pet.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    let dataDesap = null;
    if (data_hora_desaparecimento && String(data_hora_desaparecimento).trim()) {
      const parsed = new Date(data_hora_desaparecimento);
      if (!Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now()) {
        dataDesap = parsed.toISOString();
      }
    }

    await withTransaction(async (client) => {
      await PetPerdido.criar({
        pet_id: parseInt(pet_id, 10),
        descricao: descricao || 'Sem descrição fornecida.',
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        cidade: null,
        recompensa: recompensa || null,
        data_hora_desaparecimento: dataDesap,
      }, client);
      await Pet.atualizarStatus(pet_id, 'perdido', client);
    });

    logger.info('PetPerdidoController', `Pet reportado como perdido: ${pet.nome} (ID: ${pet_id})`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Formulário enviado para análise. O alerta será publicado após a aprovação da equipe.' };
    const destino = resolveSafeReturnTo(
      return_to,
      pet.slug ? `/p/${pet.slug}?tab=scans` : `/pets/${pet_id}`
    );
    return res.redirect(destino);
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao reportar pet perdido', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao enviar o reporte. Tente novamente.' };
    return res.redirect(`/pets/${req.params.pet_id}`);
  }
}

/**
 * resolver — Marca o alerta como resolvido (pet encontrado)
 *
 * Rota: POST /pets-perdidos/:id/resolver
 *
 * Fluxo:
 *   1. Busca o alerta pelo ID
 *   2. Verifica se o usuário logado é o dono do pet
 *   3. Marca o alerta como 'resolvido'
 *   4. Atualiza o status do pet para 'seguro'
 *   5. Encerra e limpa as conversas/mensagens associadas (LGPD)
 *   6. Redireciona com mensagem de sucesso
 *
 * A limpeza de mensagens é importante para conformidade com LGPD,
 * pois as conversas podem conter dados pessoais como localização,
 * telefone e endereço trocados entre o tutor e quem encontrou o pet.
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function resolver(req, res) {
  try {
    const { id } = req.params;
    const usuarioId = req.session.usuario.id;

    /*
     * Tenta buscar como pets_perdidos.id primeiro.
     * Se não encontrar, tenta como pet_id (fallback para chamadas
     * que passavam pet.id em vez de pets_perdidos.id).
     */
    let alerta = await PetPerdido.buscarPorId(id);

    if (!alerta) {
      alerta = await PetPerdido.buscarAtivoPorPet(id);
    }

    if (!alerta) {
      return res.redirect(`/perdidos/${id}/encontrado`);
    }

    if (alerta.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para resolver este alerta.' };
      return res.redirect('/pets');
    }

    return res.redirect(`/perdidos/${alerta.pet_id}/encontrado`);
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao resolver alerta de pet perdido', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao resolver o alerta. Tente novamente.' };
    return res.redirect('/pets');
  }
}

/**
 * mostrarFormularioEncontrado — Renderiza o formulário de "pet encontrado"
 *
 * Rota: GET /perdidos/:pet_id/encontrado
 */
async function mostrarFormularioEncontrado(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;

    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      return res.status(404).render('partials/erro', {
        titulo: 'Pet não encontrado',
        mensagem: 'O pet que você procura não existe ou foi removido.',
        codigo: 404,
      });
    }

    if (pet.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para esta ação.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    if (pet.status !== 'perdido') {
      req.session.flash = { tipo: 'erro', mensagem: `${pet.nome} não está marcado como perdido.` };
      return res.redirect(`/pets/${pet_id}`);
    }

    const alerta = await PetPerdido.buscarAtivoPorPet(pet_id);

    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Nenhum alerta ativo encontrado para este pet.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    return res.render('pets-perdidos/encontrado', {
      titulo: `${pet.nome} foi encontrado! - AIRPET`,
      pet,
      alerta,
    });
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao exibir formulário de encontrado', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o formulário.' };
    return res.redirect('/pets');
  }
}

/**
 * marcarEncontrado — Processa o formulário e marca o pet como encontrado
 *
 * Rota: POST /perdidos/:pet_id/encontrado
 */
async function marcarEncontrado(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;
    const { como_encontrado, descricao_encontrado, latitude, longitude, mensagem_agradecimento } = req.body;

    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
      return res.redirect('/pets');
    }

    if (pet.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para esta ação.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    const alerta = await PetPerdido.buscarAtivoPorPet(pet_id);

    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Nenhum alerta ativo encontrado.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    await withTransaction(async (client) => {
      await PetPerdido.resolver(alerta.id, client);
      await Pet.atualizarStatus(pet_id, 'seguro', client);
      const conversas = await Conversa.buscarPorPetPerdido(alerta.id, client);
      for (const conversa of conversas) {
        await MensagemChat.deletarPorConversa(conversa.id, client);
        await Conversa.encerrar(conversa.id, client);
      }
    });

    const dataPerdido = new Date(alerta.data);
    const agora = new Date();
    const diffMs = agora - dataPerdido;
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDias = Math.floor(diffHoras / 24);

    let tempoPerdido;
    if (diffDias > 0) {
      tempoPerdido = `${diffDias} dia${diffDias > 1 ? 's' : ''}`;
    } else if (diffHoras > 0) {
      tempoPerdido = `${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
    } else {
      tempoPerdido = 'menos de 1 hora';
    }

    req.session.dadosConfirmacao = {
      petNome: pet.nome,
      petFoto: pet.foto,
      petId: pet.id,
      comoEncontrado: como_encontrado || '',
      descricao: descricao_encontrado || '',
      mensagemAgradecimento: mensagem_agradecimento || '',
      tempoPerdido,
    };

    logger.info('PetPerdidoController', `Pet encontrado: ${pet.nome} (ID: ${pet_id}) — ${como_encontrado || 'sem detalhes'}`);

    return res.redirect(`/perdidos/${pet_id}/confirmacao`);
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao marcar pet como encontrado', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao processar. Tente novamente.' };
    return res.redirect(`/pets/${req.params.pet_id}`);
  }
}

/**
 * mostrarConfirmacao — Tela de celebração após marcar como encontrado
 *
 * Rota: GET /perdidos/:pet_id/confirmacao
 */
async function mostrarConfirmacao(req, res) {
  try {
    const { pet_id } = req.params;
    const dados = req.session.dadosConfirmacao;

    if (!dados || String(dados.petId) !== String(pet_id)) {
      return res.redirect(`/pets/${pet_id}`);
    }

    req.session.dadosConfirmacao = null;

    return res.render('pets-perdidos/confirmacao', {
      titulo: `${dados.petNome} está seguro! - AIRPET`,
      dados,
    });
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro ao exibir confirmação', erro);
    return res.redirect(`/pets/${req.params.pet_id}`);
  }
}

const UUID_ALERTA_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Página pública do alerta (compartilhável). Só exibe dados sensíveis mínimos.
 * Conteúdo “ativo” apenas com alerta aprovado e pet ainda perdido.
 */
async function mostrarAlertaPublico(req, res) {
  try {
    const { alertaId } = req.params;
    if (!UUID_ALERTA_RE.test(String(alertaId || ''))) {
      return res.status(404).render('partials/erro', {
        titulo: 'Alerta não encontrado',
        mensagem: 'Este link não é válido.',
        codigo: 404,
      });
    }

    const alerta = await PetPerdido.buscarPorId(alertaId);
    if (!alerta) {
      return res.status(404).render('partials/erro', {
        titulo: 'Alerta não encontrado',
        mensagem: 'Não encontramos este alerta.',
        codigo: 404,
      });
    }

    const pet = await Pet.buscarPorId(alerta.pet_id);
    const ativo = alerta.status === 'aprovado' && pet && pet.status === 'perdido';

    return res.render('pets-perdidos/alerta-publico', {
      titulo: ativo
        ? `${alerta.pet_nome || 'Pet'} está perdido — AIRPET`
        : `Alerta encerrado — AIRPET`,
      alerta,
      pet,
      ativo,
    });
  } catch (erro) {
    logger.error('PetPerdidoController', 'Erro na página pública do alerta', erro);
    return res.status(500).render('partials/erro', {
      titulo: 'Erro',
      mensagem: 'Não foi possível carregar o alerta.',
      codigo: 500,
    });
  }
}

module.exports = {
  mostrarFormulario,
  reportar,
  resolver,
  mostrarFormularioEncontrado,
  marcarEncontrado,
  mostrarConfirmacao,
  mostrarAlertaPublico,
};
