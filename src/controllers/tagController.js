/**
 * tagController.js — Controller de Tags NFC do AIRPET
 *
 * Gerencia todo o ciclo de vida das tags NFC:
 *   - Ativação pelo tutor (validação de 3 fatores)
 *   - Vinculação da tag a um pet
 *   - Operações administrativas (geração de lotes, reserva, envio, bloqueio)
 *
 * Ciclo de vida de uma tag NFC:
 *   manufactured → reserved → sent → active → (blocked)
 *
 * Ativação com 3 fatores de validação:
 *   1. O usuário deve estar logado (autenticado)
 *   2. O tag_code deve corresponder a uma tag com status 'sent'
 *   3. O activation_code informado deve bater com o da tag
 *
 * Rotas do tutor:
 *   GET  /tags/:tag_code/ativar        → mostrarAtivacao
 *   POST /tags/:tag_code/ativar        → ativar
 *   GET  /tags/:tag_code/escolher-pet  → escolherPet
 *   POST /tags/:tag_code/vincular      → vincularPet
 *
 * Rotas do admin:
 *   POST /admin/tags/gerar-lote        → gerarLote
 *   GET  /admin/tags                   → listarTags
 *   GET  /admin/tags/lotes             → listarLotes
 *   POST /admin/tags/:id/reservar      → reservar
 *   POST /admin/tags/:id/enviar        → enviar
 *   POST /admin/tags/:id/bloquear      → bloquear
 */

const NfcTag = require('../models/NfcTag');
const TagBatch = require('../models/TagBatch');
const TagOrderUnit = require('../models/TagOrderUnit');
const Pet = require('../models/Pet');
const Usuario = require('../models/Usuario');
const { withTransaction } = require('../config/database');
const { gerarTagCode, gerarActivationCode } = require('../utils/helpers');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

/* =========================================================================
 * ROTAS DO TUTOR — Ativação e vinculação de tags
 * ========================================================================= */

/**
 * minhasTags — Lista as tags do usuário logado
 *
 * Rota: GET /tags/minhas
 * View: nfc/minhas-tags
 */
async function minhasTags(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const tags = await NfcTag.buscarPorUsuario(usuarioId);

    return res.render('nfc/minhas-tags', {
      titulo: 'Minhas Tags - AIRPET',
      tags,
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao listar tags do usuário', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar suas tags.' };
    return res.redirect('/perfil');
  }
}

/**
 * minhaTagChegou — Fluxo \"minha tag chegou\" acionado pelo tutor
 *
 * Rota: POST /tags/:tag_code/chegou
 *
 * Reenvia com carinho o e-mail com o código da tag e o código
 * de ativação, e leva o usuário para a tela de ativação.
 */
async function minhaTagChegou(req, res) {
  try {
    const { tag_code } = req.params;
    const usuarioId = req.session.usuario.id;

    const tag = await NfcTag.buscarPorTagCode(tag_code);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag não encontrada.' };
      return res.redirect('/tags/minhas');
    }

    if (tag.user_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Esta tag não pertence à sua conta.' };
      return res.redirect('/tags/minhas');
    }

    if (tag.status !== 'sent' && tag.status !== 'active') {
      req.session.flash = {
        tipo: 'erro',
        mensagem: 'Esta tag ainda não foi enviada ou já está em um estado diferente. Confira o status na lista.',
      };
      return res.redirect('/tags/minhas');
    }

    const usuario = await Usuario.buscarPorId(usuarioId);
    if (usuario && usuario.email) {
      try {
        await emailService.enviarTagEnviada({
          to: usuario.email,
          nome: usuario.nome,
          tagCode: tag.tag_code,
          activationCode: tag.activation_code,
        });
        req.session.flash = {
          tipo: 'sucesso',
          mensagem:
            'Reenviamos um e-mail com o código da sua tag e as instruções de ativação. Dá uma olhada na sua caixa de entrada e no spam.',
        };
      } catch (emailErro) {
        logger.error('TagController', 'Falha ao reenviar e-mail de tag enviada no fluxo \"minha tag chegou\"', emailErro);
        req.session.flash = {
          tipo: 'erro',
          mensagem: 'Não conseguimos reenviar o e-mail agora. Tente novamente em alguns instantes.',
        };
      }
    } else {
      req.session.flash = {
        tipo: 'erro',
        mensagem: 'Não encontramos um e-mail válido na sua conta para reenviar as informações da tag.',
      };
    }

    return res.redirect(`/tags/${encodeURIComponent(tag_code)}/ativar`);
  } catch (erro) {
    logger.error('TagController', 'Erro no fluxo \"minha tag chegou\"', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao processar sua tag. Tente novamente.' };
    return res.redirect('/tags/minhas');
  }
}

/**
 * mostrarAtivacao — Renderiza o formulário de ativação da tag
 *
 * Rota: GET /tags/:tag_code/ativar
 * View: nfc/ativar
 *
 * Exibe o formulário onde o tutor deve informar o código de ativação
 * (impresso no cartão que acompanha a tag física).
 *
 * @param {object} req - Requisição Express com params.tag_code
 * @param {object} res - Resposta Express
 */
async function mostrarAtivacao(req, res) {
  try {
    const { tag_code } = req.params;

    /* Renderiza o formulário de ativação com o código da tag */
    return res.render('nfc/ativar', {
      titulo: 'Ativar Tag - AIRPET',
      tag_code,
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao exibir formulário de ativação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o formulário de ativação.' };
    return res.redirect('/');
  }
}

/**
 * ativar — Processa a ativação da tag com validação de 3 fatores
 *
 * Rota: POST /tags/:tag_code/ativar
 *
 * Validação de 3 fatores:
 *   Fator 1: Usuário está autenticado (garantido pelo middleware estaAutenticado)
 *   Fator 2: A tag existe e seu status é 'sent' (foi enviada ao tutor)
 *   Fator 3: O activation_code informado corresponde ao registrado no banco
 *
 * Se todos os 3 fatores forem válidos:
 *   - Vincula a tag ao usuário logado (user_id)
 *   - NÃO muda o status para 'active' ainda — isso ocorre ao vincular o pet
 *   - Redireciona para a página de escolha de pet
 *
 * @param {object} req - Requisição Express com params.tag_code e body.activation_code
 * @param {object} res - Resposta Express
 */
async function ativar(req, res) {
  const MAX_TENTATIVAS = 5;
  const BLOQUEIO_MINUTOS = 30;

  try {
    const { tag_code } = req.params;
    const activation_code = req.body.activation_code || req.body.codigo_ativacao;
    const usuarioId = req.session.usuario.id;

    const tag = await NfcTag.buscarPorTagCode(tag_code);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag NFC não encontrada no sistema.' };
      return res.redirect('/');
    }

    if (tag.status !== 'sent') {
      req.session.flash = { tipo: 'erro', mensagem: 'Esta tag não está disponível para ativação. Status atual: ' + tag.status };
      return res.redirect('/');
    }

    if (tag.bloqueada_ate && new Date(tag.bloqueada_ate) > new Date()) {
      const minRestantes = Math.ceil((new Date(tag.bloqueada_ate) - new Date()) / 60000);
      req.session.flash = { tipo: 'erro', mensagem: `Muitas tentativas incorretas. Tente novamente em ${minRestantes} minuto(s).` };
      return res.redirect(`/tags/${tag_code}/ativar`);
    }

    if (!activation_code || tag.activation_code !== activation_code.trim().toUpperCase()) {
      const tagAtualizada = await withTransaction(async (client) => {
        const atual = await NfcTag.incrementarTentativas(tag.id, client);
        const tentativas = atual.tentativas_ativacao || 0;
        if (tentativas >= MAX_TENTATIVAS) {
          await NfcTag.bloquearTemporariamente(tag.id, BLOQUEIO_MINUTOS, client);
        }
        return atual;
      });
      const tentativas = tagAtualizada.tentativas_ativacao || 0;
      const restantes = MAX_TENTATIVAS - tentativas;

      if (tentativas >= MAX_TENTATIVAS) {
        logger.warn('TagController', `Tag ${tag_code} bloqueada por ${BLOQUEIO_MINUTOS}min após ${tentativas} tentativas`);
        req.session.flash = { tipo: 'erro', mensagem: `Muitas tentativas incorretas. Tag bloqueada por ${BLOQUEIO_MINUTOS} minutos.` };
      } else {
        req.session.flash = { tipo: 'erro', mensagem: `Código de ativação inválido. Restam ${restantes} tentativa(s).` };
      }
      return res.redirect(`/tags/${tag_code}/ativar`);
    }

    await withTransaction(async (client) => {
      await NfcTag.resetarTentativas(tag.id, client);
      const reservada = await NfcTag.reservar(tag.id, usuarioId, client);
      if (!reservada) {
        throw new Error('TAG_RESERVA_INVALIDA');
      }
    });

    logger.info('TagController', `Tag ativada: ${tag_code} pelo usuário ${usuarioId}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Tag validada com sucesso! Agora escolha um pet para vincular.' };
    return res.redirect(`/tags/${tag_code}/escolher-pet`);
  } catch (erro) {
    if (erro && erro.message === 'TAG_RESERVA_INVALIDA') {
      req.session.flash = { tipo: 'erro', mensagem: 'Esta tag está vinculada a outra conta e não pode ser ativada por este usuário.' };
      return res.redirect(`/tags/${req.params.tag_code}/ativar`);
    }
    logger.error('TagController', 'Erro ao ativar tag', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao ativar a tag. Tente novamente.' };
    return res.redirect(`/tags/${req.params.tag_code}/ativar`);
  }
}

/**
 * escolherPet — Exibe a lista de pets do usuário para vinculação
 *
 * Rota: GET /tags/:tag_code/escolher-pet
 * View: nfc/escolher-pet
 *
 * Após a ativação da tag, o tutor precisa escolher qual pet
 * será vinculado àquela tag NFC.
 *
 * @param {object} req - Requisição Express com params.tag_code
 * @param {object} res - Resposta Express
 */
async function escolherPet(req, res) {
  try {
    const { tag_code } = req.params;
    const usuarioId = req.session.usuario.id;

    /* Busca todos os pets do usuário para exibir como opções */
    const pets = await Pet.buscarPorUsuario(usuarioId);

    /* Se o usuário não tem pets, sugere cadastrar um antes */
    if (pets.length === 0) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você precisa cadastrar um pet antes de vincular a tag. Cadastre agora!' };
      return res.redirect('/pets/cadastro');
    }

    /* Renderiza a lista de pets com opção de seleção */
    return res.render('nfc/escolher-pet', {
      titulo: 'Escolher Pet - AIRPET',
      tag_code,
      pets,
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao listar pets para vinculação', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar seus pets.' };
    return res.redirect('/pets');
  }
}

/**
 * vincularPet — Vincula a tag NFC a um pet específico
 *
 * Rota: POST /tags/:tag_code/vincular
 *
 * Fluxo:
 *   1. Busca a tag pelo tag_code
 *   2. Verifica se o pet pertence ao usuário logado
 *   3. Ativa a tag vinculando-a ao pet (status → active)
 *   4. Redireciona para o perfil do pet
 *
 * @param {object} req - Requisição Express com params.tag_code e body.pet_id
 * @param {object} res - Resposta Express
 */
async function vincularPet(req, res) {
  try {
    const { tag_code } = req.params;
    const { pet_id } = req.body;
    const usuarioId = req.session.usuario.id;

    /* Busca a tag para verificar existência */
    const tag = await NfcTag.buscarPorTagCode(tag_code);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag NFC não encontrada.' };
      return res.redirect('/pets');
    }

    /* Busca o pet para verificar se pertence ao usuário */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet || pet.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado ou você não é o dono.' };
      return res.redirect(`/tags/${tag_code}/escolher-pet`);
    }

    /* Ativa a tag vinculando ao pet e desativa, se existir, a tag ativa anterior desse mesmo pet */
    await withTransaction(async (client) => {
      const anteriorAtiva = await NfcTag.buscarAtivaPorPetId(pet_id, client);
      const novaTag = await NfcTag.ativar(tag.id, pet_id, client);
      if (!novaTag) {
        throw new Error('FALHA_ATIVACAO_TAG');
      }
      if (anteriorAtiva && Number(anteriorAtiva.id) !== Number(novaTag.id)) {
        await NfcTag.desativarPorSubstituicao(anteriorAtiva.id, novaTag.id, client);
      }

      const unidade = await TagOrderUnit.concluirAtivacaoPorTag(novaTag.id);
      if (unidade && unidade.print_photo_url) {
        await client.query(
          `UPDATE nfc_tags SET display_photo_url = $2 WHERE id = $1`,
          [novaTag.id, unidade.print_photo_url]
        );
      }
    });

    logger.info('TagController', `Tag ${tag_code} vinculada ao pet ${pet.nome} (ID: ${pet_id})`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Tag vinculada ao ${pet.nome} com sucesso! A tag NFC agora identifica seu pet.` };
    return res.redirect(`/pets/${pet_id}`);
  } catch (erro) {
    logger.error('TagController', 'Erro ao vincular pet à tag', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao vincular o pet. Tente novamente.' };
    return res.redirect(`/tags/${req.params.tag_code}/escolher-pet`);
  }
}

/* =========================================================================
 * ROTAS DO ADMIN — Gestão de tags e lotes
 * ========================================================================= */

/**
 * gerarLote — Gera um novo lote de tags NFC
 *
 * Rota: POST /admin/tags/gerar-lote
 *
 * Fluxo:
 *   1. Recebe os dados do lote (código, quantidade, fabricante, observações)
 *   2. Cria o registro do lote na tabela tag_batches
 *   3. Gera N tags com códigos únicos (PET-XXXXXX) e códigos de ativação
 *   4. Insere todas as tags de uma vez (transação atômica)
 *   5. Redireciona para a lista de tags com sucesso
 *
 * IMPORTANTE: Os tag_codes são gerados aleatoriamente pelo helper gerarTagCode().
 * Há uma chance muito baixa de colisão que deve ser tratada pelo banco (UNIQUE).
 *
 * @param {object} req - Requisição Express com body { codigo_lote, quantidade, fabricante, observacoes }
 * @param {object} res - Resposta Express
 */
async function gerarLote(req, res) {
  try {
    const { codigo_lote, quantidade, fabricante, observacoes } = req.body;
    /* criado_por deve ser um id existente em usuarios(id) para não violar a FK.
     * Se o admin entrou só pelo login de admin (env) ou o usuário foi removido, usamos null. */
    let criadoPor = req.session.usuario?.id ?? null;
    if (criadoPor) {
      const usuario = await Usuario.buscarPorId(criadoPor);
      if (!usuario) criadoPor = null;
    }

    /* Valida a quantidade para evitar geração excessiva */
    const qtd = parseInt(quantidade, 10);
    if (!qtd || qtd < 1 || qtd > 1000) {
      req.session.flash = { tipo: 'erro', mensagem: 'A quantidade deve ser entre 1 e 1000 tags.' };
      return res.redirect('/tags/admin/lotes');
    }

    /* 1. Cria o registro do lote */
    const lote = await TagBatch.criar({
      codigo_lote: codigo_lote || `LOTE-${Date.now()}`,
      quantidade: qtd,
      fabricante: fabricante || 'AIRPET',
      observacoes: observacoes || null,
      criado_por: criadoPor,
    });

    /* 2. Gera os dados de cada tag do lote */
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const tagsParaCriar = [];
    for (let i = 0; i < qtd; i++) {
      const tagCode = gerarTagCode();
      tagsParaCriar.push({
        tag_code: tagCode,
        activation_code: gerarActivationCode(),
        qr_code: `${baseUrl}/tag/${tagCode}`,
      });
    }

    /* 3. Insere todas as tags em uma transação atômica */
    await NfcTag.criarLote(tagsParaCriar, lote.id);

    logger.info('TagController', `Lote gerado: ${lote.codigo_lote} com ${qtd} tags (criado_por: ${criadoPor ?? 'n/a'})`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Lote "${lote.codigo_lote}" gerado com sucesso! ${qtd} tags criadas. Copie os códigos de ativação abaixo.` };
    return res.redirect(`/tags/admin/lote/${lote.id}`);
  } catch (erro) {
    logger.error('TagController', 'Erro ao gerar lote de tags', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao gerar o lote de tags. Tente novamente.' };
    return res.redirect('/tags/admin/lotes');
  }
}

/**
 * listarTags — Lista todas as tags NFC com filtro por status
 *
 * Rota: GET /admin/tags
 * View: admin/tags
 *
 * O admin pode filtrar por status via query param:
 *   /admin/tags?status=active → mostra apenas tags ativas
 *   /admin/tags → mostra todas
 *
 * @param {object} req - Requisição Express com query.status (opcional)
 * @param {object} res - Resposta Express
 */
async function listarTags(req, res) {
  try {
    /* Extrai o filtro de status da query string (se fornecido) */
    const { status } = req.query;

    /* Busca as tags, aplicando filtro se especificado */
    const tags = await NfcTag.listarTodas(status || null);

    /* Busca contagens por status para exibir resumo no topo */
    const contagens = await NfcTag.contarPorStatus();

    return res.render('admin/tags', {
      titulo: 'Gerenciar Tags NFC - AIRPET',
      tags,
      contagens,
      filtroAtual: status || 'todos',
      adminPath: process.env.ADMIN_PATH || '/admin',
      currentPath: 'tags',
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao listar tags', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de tags.' };
    return res.redirect(process.env.ADMIN_PATH || '/admin');
  }
}

/**
 * listarLotes — Lista todos os lotes de tags NFC
 *
 * Rota: GET /admin/tags/lotes
 * View: admin/lotes
 *
 * Exibe todos os lotes com informações como código, quantidade,
 * fabricante e data de criação.
 *
 * @param {object} req - Requisição Express
 * @param {object} res - Resposta Express
 */
async function listarLotes(req, res) {
  try {
    /* Busca todos os lotes ordenados do mais recente ao mais antigo */
    const lotes = await TagBatch.listarTodos();

    return res.render('admin/lotes', {
      titulo: 'Lotes de Tags - AIRPET',
      lotes,
      adminPath: process.env.ADMIN_PATH || '/admin',
      currentPath: 'tags',
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao listar lotes', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a lista de lotes.' };
    return res.redirect('/tags/admin/lista');
  }
}

/**
 * mostrarLote — Exibe os detalhes de um lote com todos os códigos de ativação
 *
 * Rota: GET /tags/admin/lote/:id
 * View: admin/lote-detalhes
 *
 * Exibe todas as tags do lote com os códigos de ativação COMPLETOS
 * para que o funcionário possa copiar/imprimir e entregar ao cliente.
 *
 * @param {object} req - Requisição Express com params.id (id do lote)
 * @param {object} res - Resposta Express
 */
async function mostrarLote(req, res) {
  try {
    const { id } = req.params;

    const lote = await TagBatch.buscarPorId(id);

    if (!lote) {
      req.session.flash = { tipo: 'erro', mensagem: 'Lote não encontrado.' };
      return res.redirect('/tags/admin/lotes');
    }

    const tags = await NfcTag.listarPorBatch(id);

    return res.render('admin/lote-detalhes', {
      titulo: `Lote ${lote.codigo_lote} - AIRPET`,
      lote,
      tags,
      adminPath: process.env.ADMIN_PATH || '/admin',
      currentPath: 'tags',
    });
  } catch (erro) {
    logger.error('TagController', 'Erro ao exibir detalhes do lote', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar os detalhes do lote.' };
    return res.redirect('/tags/admin/lotes');
  }
}

/**
 * reservar — Reserva uma tag para um usuário específico
 *
 * Rota: POST /admin/tags/:id/reservar
 *
 * O admin seleciona uma tag e informa o ID do usuário que deve recebê-la.
 * A tag muda de status 'manufactured' para 'reserved' e recebe o user_id.
 *
 * @param {object} req - Requisição Express com params.id e body.user_id
 * @param {object} res - Resposta Express
 */
async function reservar(req, res) {
  try {
    const { id } = req.params;
    const emailInformado = String(req.body?.email || '').trim().toLowerCase();

    /* Verifica se a tag existe */
    const tag = await NfcTag.buscarPorId(id);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag não encontrada.' };
      return res.redirect('/tags/admin/lista');
    }
    if (tag.status !== 'stock' && tag.status !== 'manufactured') {
      req.session.flash = { tipo: 'erro', mensagem: `Esta tag não pode ser reservada. Status atual: ${tag.status}.` };
      return res.redirect('/tags/admin/lista');
    }

    if (!emailInformado) {
      req.session.flash = { tipo: 'erro', mensagem: 'Informe o e-mail do usuário para reservar a tag.' };
      return res.redirect('/tags/admin/lista');
    }

    const usuario = await Usuario.buscarPorEmail(emailInformado);
    if (!usuario) {
      req.session.flash = { tipo: 'erro', mensagem: 'Nenhum usuário encontrado com esse e-mail.' };
      return res.redirect('/tags/admin/lista');
    }

    /* Reserva a tag para o usuário informado */
    const tagAtualizada = await NfcTag.reservar(id, usuario.id);
    if (!tagAtualizada) {
      req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível reservar a tag no estado atual.' };
      return res.redirect('/tags/admin/lista');
    }

    logger.info('TagController', `Tag ${tag.tag_code} reservada para usuário ${usuario.id} (${emailInformado})`);

    try {
      await emailService.enviarTagReservada({
        to: emailInformado,
        nome: usuario.nome || 'cliente AIRPET',
        tagCode: tagAtualizada.tag_code,
        activationCode: tagAtualizada.activation_code,
      });
    } catch (emailErro) {
      logger.error('TagController', 'Falha ao enviar e-mail de tag reservada', emailErro);
    }

    req.session.flash = { tipo: 'sucesso', mensagem: `Tag ${tag.tag_code} reservada com sucesso para ${emailInformado}.` };
    return res.redirect('/tags/admin/lista');
  } catch (erro) {
    logger.error('TagController', 'Erro ao reservar tag', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao reservar a tag.' };
    return res.redirect('/tags/admin/lista');
  }
}

/**
 * enviar — Marca uma tag como enviada ao tutor
 *
 * Rota: POST /admin/tags/:id/enviar
 *
 * Muda o status da tag de 'reserved' para 'sent',
 * indicando que ela foi despachada fisicamente.
 * Registra a data/hora do envio.
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function enviar(req, res) {
  try {
    const { id } = req.params;

    /* Verifica se a tag existe */
    const tag = await NfcTag.buscarPorId(id);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag não encontrada.' };
      return res.redirect('/tags/admin/lista');
    }

    /* Marca como enviada — muda status e registra sent_at */
    const tagAtualizada = await NfcTag.marcarEnviada(id);
    if (!tagAtualizada) {
      req.session.flash = { tipo: 'erro', mensagem: `A tag ${tag.tag_code} só pode ser enviada quando estiver reservada.` };
      return res.redirect('/tags/admin/lista');
    }

    logger.info('TagController', `Tag ${tag.tag_code} marcada como enviada`);

    if (tagAtualizada.user_id) {
      try {
        const usuario = await Usuario.buscarPorId(tagAtualizada.user_id);
        if (usuario && usuario.email) {
          await emailService.enviarTagEnviada({
            to: usuario.email,
            nome: usuario.nome,
            tagCode: tagAtualizada.tag_code,
            activationCode: tagAtualizada.activation_code,
          });
        }
      } catch (emailErro) {
        logger.error('TagController', 'Falha ao enviar e-mail de tag enviada', emailErro);
      }
    }

    req.session.flash = { tipo: 'sucesso', mensagem: `Tag ${tag.tag_code} marcada como enviada.` };
    return res.redirect('/tags/admin/lista');
  } catch (erro) {
    logger.error('TagController', 'Erro ao marcar tag como enviada', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao marcar a tag como enviada.' };
    return res.redirect('/tags/admin/lista');
  }
}

/**
 * bloquear — Bloqueia uma tag NFC
 *
 * Rota: POST /admin/tags/:id/bloquear
 *
 * Bloqueia a tag impedindo qualquer uso. Usado em casos de:
 *   - Perda ou roubo da tag física
 *   - Uso fraudulento detectado
 *   - Solicitação do tutor
 *
 * Uma tag bloqueada retorna erro 403 quando escaneada.
 *
 * @param {object} req - Requisição Express com params.id
 * @param {object} res - Resposta Express
 */
async function bloquear(req, res) {
  try {
    const { id } = req.params;

    /* Verifica se a tag existe */
    const tag = await NfcTag.buscarPorId(id);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag não encontrada.' };
      return res.redirect('/tags/admin/lista');
    }

    /* Bloqueia a tag — muda status para 'blocked' */
    const tagAtualizada = await NfcTag.bloquear(id);
    if (!tagAtualizada) {
      req.session.flash = { tipo: 'erro', mensagem: `A tag ${tag.tag_code} já está bloqueada.` };
      return res.redirect('/tags/admin/lista');
    }

    logger.info('TagController', `Tag ${tag.tag_code} bloqueada`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Tag ${tag.tag_code} bloqueada com sucesso.` };
    return res.redirect('/tags/admin/lista');
  } catch (erro) {
    logger.error('TagController', 'Erro ao bloquear tag', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao bloquear a tag.' };
    return res.redirect('/tags/admin/lista');
  }
}

/**
 * desbloquear — Desbloqueia uma tag NFC
 *
 * Rota: POST /admin/tags/:id/desbloquear
 */
async function desbloquear(req, res) {
  try {
    const { id } = req.params;

    const tag = await NfcTag.buscarPorId(id);

    if (!tag) {
      req.session.flash = { tipo: 'erro', mensagem: 'Tag não encontrada.' };
      return res.redirect('/tags/admin/lista');
    }

    const tagAtualizada = await NfcTag.desbloquear(id);
    if (!tagAtualizada) {
      req.session.flash = { tipo: 'erro', mensagem: 'Não foi possível desbloquear esta tag no estado atual.' };
      return res.redirect('/tags/admin/lista');
    }

    logger.info('TagController', `Tag ${tag.tag_code} desbloqueada`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Tag ${tag.tag_code} desbloqueada com sucesso.` };
    return res.redirect('/tags/admin/lista');
  } catch (erro) {
    logger.error('TagController', 'Erro ao desbloquear tag', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao desbloquear a tag.' };
    return res.redirect('/tags/admin/lista');
  }
}

/* Exporta todos os métodos do controller */
module.exports = {
  /* Rotas do tutor */
  minhasTags,
  minhaTagChegou,
  mostrarAtivacao,
  ativar,
  escolherPet,
  vincularPet,

  /* Rotas do admin */
  gerarLote,
  listarTags,
  listarLotes,
  mostrarLote,
  reservar,
  enviar,
  bloquear,
  desbloquear,
};
