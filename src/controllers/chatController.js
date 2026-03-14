/**
 * chatController.js — Controller de Chat do AIRPET
 *
 * Gerencia o sistema de chat moderado entre tutores e pessoas
 * que encontraram um pet perdido.
 *
 * Fluxo do chat:
 *   1. Alguém escaneia a tag NFC de um pet marcado como "perdido"
 *   2. Na tela intermediária, vê a opção "Entrar em contato com o tutor"
 *   3. Ao clicar, uma conversa é criada (ou reaberta se já existir)
 *   4. As mensagens enviadas ficam com status 'pendente'
 *   5. O admin modera as mensagens (aprova/rejeita)
 *   6. Apenas mensagens aprovadas são visíveis na conversa
 *
 * Este modelo de chat moderado foi escolhido para:
 *   - Prevenir compartilhamento de dados sensíveis (endereço, CPF)
 *   - Evitar golpes e mensagens falsas
 *   - Proteger a privacidade dos tutores
 *   - Garantir conformidade com LGPD
 *
 * A comunicação em tempo real é feita via Socket.IO
 * (veja src/sockets/chatSocket.js), mas este controller
 * cuida das rotas HTTP (renderização de páginas e criação de conversas).
 *
 * Rotas:
 *   GET  /chat/:conversa_id     → mostrarConversa
 *   POST /chat/iniciar           → iniciarConversa
 */

const Conversa = require('../models/Conversa');
const MensagemChat = require('../models/MensagemChat');
const PetPerdido = require('../models/PetPerdido');
const logger = require('../utils/logger');

/**
 * mostrarConversa — Renderiza a tela de chat de uma conversa
 *
 * Rota: GET /chat/:conversa_id
 * View: chat/conversa
 *
 * Fluxo:
 *   1. Busca a conversa pelo ID com dados enriquecidos (pet, tutor, iniciador)
 *   2. Verifica se o usuário logado é participante da conversa
 *   3. Busca as mensagens aprovadas da conversa (em ordem cronológica)
 *   4. Renderiza a view de chat com todas as informações
 *
 * Segurança:
 *   - Somente participantes (tutor ou iniciador) podem acessar a conversa
 *   - Admins também podem visualizar para fins de moderação
 *
 * @param {object} req - Requisição Express com params.conversa_id
 * @param {object} res - Resposta Express
 */
async function listarConversas(req, res) {
  try {
    const usuarioId = req.session.usuario.id;
    const conversas = await Conversa.buscarPorUsuario(usuarioId);
    return res.render('chat/lista', { titulo: 'Minhas Conversas', conversas });
  } catch (erro) {
    logger.error('ChatController', 'Erro ao listar conversas', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar conversas.' };
    return res.redirect('/pets');
  }
}

async function mostrarConversa(req, res) {
  try {
    const { conversa_id } = req.params;
    const usuarioId = req.session.usuario.id;
    const userRole = req.session.usuario.role;

    /* Busca a conversa com dados enriquecidos via JOINs */
    const conversa = await Conversa.buscarPorId(conversa_id);

    /* Se a conversa não existe, retorna 404 */
    if (!conversa) {
      return res.status(404).render('partials/erro', {
        titulo: 'Conversa não encontrada',
        mensagem: 'A conversa que você procura não existe.',
        codigo: 404,
      });
    }

    /*
     * Verificação de permissão:
     * Apenas os participantes (tutor ou iniciador) e admins podem acessar.
     * Isso previne que terceiros espionem conversas privadas.
     */
    const ehParticipante = (
      conversa.iniciador_id === usuarioId ||
      conversa.tutor_id === usuarioId
    );
    const ehAdmin = userRole === 'admin';

    if (!ehParticipante && !ehAdmin) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para acessar esta conversa.' };
      return res.redirect('/');
    }

    /* Busca as mensagens APROVADAS da conversa (ordem cronológica ASC) */
    const mensagens = await MensagemChat.buscarPorConversa(conversa_id);

    /* Renderiza a tela de chat com todos os dados */
    return res.render('chat/conversa', {
      titulo: `Chat - ${conversa.pet_nome} - AIRPET`,
      conversa,
      mensagens,
      usuarioAtualId: usuarioId,
    });
  } catch (erro) {
    logger.error('ChatController', 'Erro ao exibir conversa', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar a conversa.' };
    return res.redirect('/');
  }
}

/**
 * iniciarConversa — Cria ou reabre uma conversa sobre um pet perdido
 *
 * Rota: POST /chat/iniciar
 *
 * Fluxo:
 *   1. Recebe o ID do alerta de pet perdido
 *   2. Busca o alerta para obter o ID do tutor
 *   3. Verifica se já existe uma conversa entre este usuário e o tutor
 *      para o mesmo alerta (evita duplicatas)
 *   4. Se já existe, redireciona para a conversa existente
 *   5. Se não existe, cria uma nova conversa e redireciona para ela
 *
 * @param {object} req - Requisição Express com body.pet_perdido_id
 * @param {object} res - Resposta Express
 */
async function iniciarConversa(req, res) {
  try {
    const { pet_perdido_id } = req.body;
    const iniciadorId = req.session.usuario.id;

    /* Valida que o ID do alerta foi fornecido */
    if (!pet_perdido_id) {
      req.session.flash = { tipo: 'erro', mensagem: 'ID do alerta de pet perdido não informado.' };
      return res.redirect('/');
    }

    /* Busca o alerta para obter o ID do tutor */
    const alerta = await PetPerdido.buscarPorId(pet_perdido_id);

    if (!alerta) {
      req.session.flash = { tipo: 'erro', mensagem: 'Alerta de pet perdido não encontrado.' };
      return res.redirect('/');
    }

    /* O tutor não pode iniciar uma conversa consigo mesmo */
    if (alerta.usuario_id === iniciadorId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não pode iniciar uma conversa sobre seu próprio pet.' };
      return res.redirect(`/pets/${alerta.pet_id}`);
    }

    /*
     * Verifica se já existe uma conversa entre este iniciador e o tutor
     * para o mesmo alerta. Busca todas as conversas do alerta e filtra.
     */
    const conversasExistentes = await Conversa.buscarPorPetPerdido(pet_perdido_id);

    const conversaExistente = conversasExistentes.find(
      (c) => c.iniciador_id === iniciadorId
    );

    if (conversaExistente) {
      /* Já existe uma conversa — redireciona para ela */
      return res.redirect(`/chat/${conversaExistente.id}`);
    }

    /* Cria uma nova conversa entre o encontrador e o tutor */
    const novaConversa = await Conversa.criar({
      pet_perdido_id,
      iniciador_id: iniciadorId,
      tutor_id: alerta.usuario_id,
    });

    logger.info('ChatController', `Conversa criada: ${novaConversa.id} (pet: ${alerta.pet_nome})`);

    /* Redireciona para a nova conversa */
    return res.redirect(`/chat/${novaConversa.id}`);
  } catch (erro) {
    logger.error('ChatController', 'Erro ao iniciar conversa', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao iniciar a conversa. Tente novamente.' };
    return res.redirect('/');
  }
}

/* Exporta os métodos do controller */
module.exports = {
  listarConversas,
  mostrarConversa,
  iniciarConversa,
};
