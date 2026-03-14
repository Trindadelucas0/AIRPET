/**
 * chatService.js — Serviço de chat moderado do sistema AIRPET
 *
 * Este módulo gerencia o sistema de chat entre o encontrador de um
 * pet perdido e o tutor/dono do animal. Todas as mensagens passam
 * por moderação antes de serem visíveis.
 *
 * Fluxo do chat:
 *   1. Alguém encontra um pet perdido e inicia uma conversa
 *   2. O encontrador envia mensagens (ficam com status 'pendente')
 *   3. O admin revisa e aprova ou rejeita cada mensagem
 *   4. Mensagens aprovadas ficam visíveis para o tutor/encontrador
 *   5. Quando o pet é encontrado, a conversa pode ser limpa (LGPD)
 *
 * A moderação é obrigatória porque:
 *   - Previne envio de conteúdo inadequado/ofensivo
 *   - Evita tentativas de golpe/extorsão com o dono do pet
 *   - Protege dados pessoais (telefone, endereço) de serem expostos
 *   - Atende requisitos de segurança da plataforma
 */

const Conversa = require('../models/Conversa');
const MensagemChat = require('../models/MensagemChat');
const logger = require('../utils/logger');

const chatService = {

  /**
   * Cria uma nova conversa entre o encontrador de um pet e seu dono.
   *
   * Uma conversa é aberta quando alguém que encontrou um pet perdido
   * clica no botão "Entrar em contato" na página do alerta.
   * O encontrador pode ser um usuário registrado ou fornecer
   * apenas nome e telefone (visitante anônimo via scan NFC).
   *
   * @param {string} petPerdidoId - UUID do alerta de pet perdido (tabela pets_perdidos)
   * @param {string} encontradorNome - Nome de quem encontrou o pet
   * @param {string} encontradorTelefone - Telefone de contato do encontrador
   * @param {string} donoId - UUID do tutor/dono do pet (destinatário da conversa)
   * @returns {Promise<object>} O registro da conversa criada
   * @throws {Error} Se os dados forem inválidos ou o alerta não existir
   *
   * @example
   * const conversa = await chatService.criarConversa(
   *   'pet-perdido-uuid',
   *   'Maria Santos',
   *   '11988887777',
   *   'dono-uuid'
   * );
   */
  async criarConversa(petPerdidoId, encontradorNome, encontradorTelefone, donoId) {
    logger.info('ChatService', `Criando conversa — alerta: ${petPerdidoId}, dono: ${donoId}`);

    /**
     * O iniciador_id é o donoId neste caso pois o model Conversa
     * exige dois UUIDs de usuários. Em cenários onde o encontrador
     * é anônimo (scan NFC sem conta), o sistema pode criar um
     * registro temporário ou usar o próprio donoId como placeholder.
     *
     * Os campos encontradorNome e encontradorTelefone são armazenados
     * como metadados da primeira mensagem da conversa.
     */
    const conversa = await Conversa.criar({
      pet_perdido_id: petPerdidoId,
      iniciador_id: donoId,
      tutor_id: donoId,
    });

    /**
     * Cria automaticamente a primeira mensagem da conversa
     * com os dados de contato do encontrador.
     * Essa mensagem também passa por moderação antes de ser exibida.
     */
    await MensagemChat.criar({
      conversa_id: conversa.id,
      remetente_id: donoId,
      conteudo: `Contato do encontrador: ${encontradorNome} — Tel: ${encontradorTelefone}`,
      tipo: 'texto',
    });

    logger.info('ChatService', `Conversa criada: ${conversa.id}`);

    return conversa;
  },

  /**
   * Busca uma conversa pelo ID com dados completos.
   *
   * Retorna a conversa com informações enriquecidas via JOINs:
   *   - Dados do alerta (descrição, status)
   *   - Dados do pet (nome, foto)
   *   - Nomes do iniciador e do tutor
   *
   * Usado para renderizar a interface de chat completa.
   *
   * @param {string} conversaId - UUID da conversa
   * @returns {Promise<object|null>} Conversa com dados completos, ou null se não encontrada
   *
   * @example
   * const conversa = await chatService.buscarConversa('conversa-uuid');
   * // conversa.pet_nome = 'Rex'
   * // conversa.tutor_nome = 'João Silva'
   */
  async buscarConversa(conversaId) {
    logger.info('ChatService', `Buscando conversa: ${conversaId}`);

    const conversa = await Conversa.buscarPorId(conversaId);

    if (!conversa) {
      logger.warn('ChatService', `Conversa não encontrada: ${conversaId}`);
      return null;
    }

    return conversa;
  },

  /**
   * Busca todas as mensagens APROVADAS de uma conversa.
   *
   * Retorna apenas mensagens com status_moderacao = 'aprovada',
   * ordenadas cronologicamente (ASC) para exibição no chat.
   * Mensagens pendentes ou rejeitadas não são incluídas.
   *
   * Cada mensagem inclui o nome do remetente via JOIN.
   *
   * @param {string} conversaId - UUID da conversa
   * @returns {Promise<Array>} Lista de mensagens aprovadas em ordem cronológica
   *
   * @example
   * const msgs = await chatService.buscarMensagens('conversa-uuid');
   * // msgs = [
   * //   { id, conteudo: 'Encontrei seu pet!', remetente_nome: 'Maria', status_moderacao: 'aprovada' },
   * //   ...
   * // ]
   */
  async buscarMensagens(conversaId) {
    logger.info('ChatService', `Buscando mensagens aprovadas da conversa: ${conversaId}`);

    const mensagens = await MensagemChat.buscarPorConversa(conversaId);

    logger.info('ChatService', `Encontradas ${mensagens.length} mensagem(ns) aprovada(s)`);

    return mensagens;
  },

  /**
   * Busca todas as mensagens pendentes de moderação no sistema.
   *
   * Retorna mensagens de TODAS as conversas que estão aguardando
   * revisão do admin. Ordenadas por data de criação (FIFO — mais
   * antiga primeiro) para que sejam moderadas na ordem de chegada.
   *
   * Usado no painel administrativo para o admin moderar mensagens.
   *
   * @returns {Promise<Array>} Lista de mensagens pendentes com nome do remetente
   *
   * @example
   * const pendentes = await chatService.buscarPendentes();
   * // pendentes = [
   * //   { id, conteudo: '...', remetente_nome: 'Maria', status_moderacao: 'pendente' },
   * //   ...
   * // ]
   */
  async buscarPendentes() {
    logger.info('ChatService', 'Buscando mensagens pendentes de moderação');

    const pendentes = await MensagemChat.buscarPendentes();

    logger.info('ChatService', `Encontradas ${pendentes.length} mensagem(ns) pendente(s)`);

    return pendentes;
  },

  /**
   * Aprova uma mensagem, tornando-a visível na conversa.
   *
   * Após a aprovação, a mensagem aparece para todos os participantes
   * da conversa. O sistema registra qual admin aprovou e quando.
   *
   * @param {string} mensagemId - UUID da mensagem a ser aprovada
   * @param {string} adminId - UUID do administrador que está aprovando
   * @returns {Promise<object>} Mensagem aprovada com dados de moderação
   * @throws {Error} Se a mensagem não for encontrada
   *
   * @example
   * const msg = await chatService.aprovarMensagem('msg-uuid', 'admin-uuid');
   * // msg.status_moderacao = 'aprovada'
   * // msg.moderado_por = 'admin-uuid'
   */
  async aprovarMensagem(mensagemId, adminId) {
    logger.info('ChatService', `Aprovando mensagem: ${mensagemId} pelo admin: ${adminId}`);

    const mensagem = await MensagemChat.aprovar(mensagemId, adminId);

    logger.info('ChatService', `Mensagem aprovada: ${mensagemId}`);

    return mensagem;
  },

  /**
   * Rejeita uma mensagem (conteúdo inadequado, spam, dados pessoais, etc.).
   *
   * Mensagens rejeitadas nunca serão exibidas na conversa.
   * O sistema registra qual admin rejeitou e quando para auditoria.
   *
   * Motivos comuns de rejeição:
   *   - Conteúdo ofensivo ou inadequado
   *   - Spam ou mensagens irrelevantes
   *   - Tentativa de golpe ou extorsão
   *   - Exposição de dados pessoais (endereço, CPF)
   *
   * @param {string} mensagemId - UUID da mensagem a ser rejeitada
   * @param {string} adminId - UUID do administrador que está rejeitando
   * @returns {Promise<object>} Mensagem rejeitada com dados de moderação
   * @throws {Error} Se a mensagem não for encontrada
   *
   * @example
   * const msg = await chatService.rejeitarMensagem('msg-uuid', 'admin-uuid');
   * // msg.status_moderacao = 'rejeitada'
   */
  async rejeitarMensagem(mensagemId, adminId) {
    logger.info('ChatService', `Rejeitando mensagem: ${mensagemId} pelo admin: ${adminId}`);

    const mensagem = await MensagemChat.rejeitar(mensagemId, adminId);

    logger.info('ChatService', `Mensagem rejeitada: ${mensagemId}`);

    return mensagem;
  },

  /**
   * Remove todas as mensagens de uma conversa resolvida.
   *
   * Chamado quando o alerta de pet perdido é marcado como 'resolvido'
   * (pet encontrado). As mensagens da conversa são deletadas para:
   *   - Conformidade com a LGPD (retenção mínima de dados pessoais)
   *   - Limpeza do banco de dados (mensagens não têm mais utilidade)
   *   - Proteção da privacidade dos participantes
   *
   * A conversa em si NÃO é deletada — apenas suas mensagens.
   * O registro da conversa é mantido para auditoria/histórico.
   *
   * @param {string} conversaId - UUID da conversa a ser limpa
   * @returns {Promise<number>} Número de mensagens removidas
   *
   * @example
   * const total = await chatService.limparConversaResolvida('conversa-uuid');
   * // total = 15 (15 mensagens foram removidas)
   */
  async limparConversaResolvida(conversaId) {
    logger.info('ChatService', `Limpando mensagens da conversa resolvida: ${conversaId}`);

    /**
     * Deleta todas as mensagens (aprovadas, pendentes e rejeitadas)
     * da conversa. Retorna o número de mensagens removidas.
     */
    const totalRemovidas = await MensagemChat.deletarPorConversa(conversaId);

    logger.info('ChatService', `${totalRemovidas} mensagem(ns) removida(s) da conversa: ${conversaId}`);

    /* Encerra a conversa formalmente (status → 'encerrada') */
    await Conversa.encerrar(conversaId);

    logger.info('ChatService', `Conversa encerrada: ${conversaId}`);

    return totalRemovidas;
  },
};

module.exports = chatService;
