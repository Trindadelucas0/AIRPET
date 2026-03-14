/**
 * tagService.js — Serviço de gerenciamento de tags NFC do sistema AIRPET
 *
 * Este módulo contém a lógica de negócio para todo o ciclo de vida
 * das tags NFC: desde a fabricação em lote até a ativação pelo tutor.
 *
 * Ciclo de vida completo de uma tag:
 *   1. FABRICAÇÃO (gerarLote) — Admin registra lote, tags recebem códigos únicos
 *   2. RESERVA (reservarParaUsuario) — Tag é associada a um tutor específico
 *   3. ENVIO (marcarEnviada) — Tag é despachada fisicamente para o tutor
 *   4. ATIVAÇÃO (ativarTag) — Tutor ativa com VALIDAÇÃO DE 3 FATORES
 *   5. VINCULAÇÃO (vincularPet) — Tag é vinculada a um pet específico
 *
 * A ativação usa um sistema de segurança de 3 fatores:
 *   Fator 1: Posse física da tag (tag_code via NFC/QR)
 *   Fator 2: Conta autenticada (user_id da sessão)
 *   Fator 3: Código de ativação (enviado separadamente por e-mail/SMS)
 */

const NfcTag = require('../models/NfcTag');
const TagBatch = require('../models/TagBatch');
const helpers = require('../utils/helpers');
const logger = require('../utils/logger');

const tagService = {

  /**
   * Gera um lote de tags NFC com códigos únicos.
   *
   * Processo detalhado:
   *   1. Cria o registro do lote (TagBatch) com metadados do fabricante
   *   2. Para cada tag do lote, gera:
   *      - tag_code: código único no formato PET-XXXXXX (identificação NFC)
   *      - activation_code: código no formato XXXX-XXXX (segundo fator)
   *      - qr_code: URL pública para scan via câmera (alternativa ao NFC)
   *   3. Insere todas as tags em transação atômica via NfcTag.criarLote()
   *
   * @param {number} quantidade - Número de tags a serem geradas no lote
   * @param {string} fabricante - Nome do fabricante das tags físicas
   * @param {string} observacoes - Observações sobre o lote (material, modelo, etc.)
   * @param {string} adminId - UUID do administrador que está registrando o lote
   * @returns {Promise<object>} Objeto com { lote, tags }
   * @returns {object} returns.lote - Registro do lote criado
   * @returns {Array} returns.tags - Array com todas as tags geradas
   * @throws {Error} Se houver erro na criação do lote ou das tags
   *
   * @example
   * const { lote, tags } = await tagService.gerarLote(100, 'NFC Corp', 'Tags NTAG215', 'admin-uuid');
   * // lote.codigo_lote = 'LOTE-2026-001'
   * // tags[0].tag_code = 'PET-82KJ91'
   * // tags[0].qr_code = 'https://airpet.com.br/tag/PET-82KJ91'
   */
  async gerarLote(quantidade, fabricante, observacoes, adminId) {
    logger.info('TagService', `Gerando lote de ${quantidade} tags — fabricante: ${fabricante}`);

    /**
     * Gera o código do lote automaticamente.
     * Formato: LOTE-ANO-TIMESTAMP para garantir unicidade.
     */
    const codigoLote = `LOTE-${new Date().getFullYear()}-${Date.now()}`;

    /* Cria o registro do lote no banco */
    const lote = await TagBatch.criar({
      codigo_lote: codigoLote,
      quantidade,
      fabricante,
      observacoes,
      criado_por: adminId,
    });

    logger.info('TagService', `Lote criado: ${lote.id} (${codigoLote})`);

    /**
     * Gera os dados de cada tag individualmente.
     * Cada tag recebe códigos gerados criptograficamente via helpers:
     *   - gerarTagCode(): formato PET-XXXXXX (32 bits de entropia)
     *   - gerarActivationCode(): formato XXXX-XXXX (64 bits de entropia)
     *   - qr_code: URL pública que aponta para a rota de scan
     */
    const tagsParaCriar = [];

    for (let i = 0; i < quantidade; i++) {
      const tagCode = helpers.gerarTagCode();
      const activationCode = helpers.gerarActivationCode();

      /**
       * O qr_code é a URL que será codificada no QR Code impresso na tag.
       * Quando alguém escaneia o QR, é redirecionado para esta URL
       * que aciona o processarScan do nfcService.
       */
      const qrCode = `${process.env.BASE_URL}/tag/${tagCode}`;

      tagsParaCriar.push({
        tag_code: tagCode,
        activation_code: activationCode,
        qr_code: qrCode,
      });
    }

    /**
     * Insere todas as tags em uma transação atômica.
     * Se qualquer inserção falhar, todas são desfeitas (ROLLBACK).
     */
    const tags = await NfcTag.criarLote(tagsParaCriar, lote.id);

    logger.info('TagService', `${tags.length} tags geradas com sucesso para o lote: ${lote.id}`);

    return { lote, tags };
  },

  /**
   * Reserva uma tag para um usuário específico.
   *
   * Muda o status da tag de 'manufactured' para 'reserved'.
   * Associa a tag ao user_id do tutor que irá recebê-la.
   * Normalmente feito pelo admin quando o tutor faz o pedido.
   *
   * @param {string} tagId - UUID da tag a ser reservada
   * @param {string} userId - UUID do usuário que receberá a tag
   * @returns {Promise<object>} Tag com status atualizado para 'reserved'
   * @throws {Error} Se a tag não for encontrada
   *
   * @example
   * const tag = await tagService.reservarParaUsuario('tag-uuid', 'user-uuid');
   * // tag.status = 'reserved'
   * // tag.user_id = 'user-uuid'
   */
  async reservarParaUsuario(tagId, userId) {
    logger.info('TagService', `Reservando tag ${tagId} para usuário ${userId}`);

    const tag = await NfcTag.reservar(tagId, userId);

    logger.info('TagService', `Tag reservada com sucesso: ${tagId}`);

    return tag;
  },

  /**
   * Marca uma tag como enviada (despachada para o tutor).
   *
   * Muda o status de 'reserved' para 'sent'.
   * Indica que a tag física já foi enviada pelos Correios ou entregue.
   * A partir deste ponto, o tutor pode ativar a tag.
   *
   * @param {string} tagId - UUID da tag que foi enviada
   * @returns {Promise<object>} Tag com status atualizado para 'sent'
   *
   * @example
   * const tag = await tagService.marcarEnviada('tag-uuid');
   * // tag.status = 'sent'
   * // tag.sent_at = '2026-03-13T...'
   */
  async marcarEnviada(tagId) {
    logger.info('TagService', `Marcando tag como enviada: ${tagId}`);

    const tag = await NfcTag.marcarEnviada(tagId);

    logger.info('TagService', `Tag marcada como enviada: ${tagId}`);

    return tag;
  },

  /**
   * Ativa uma tag NFC com VALIDAÇÃO DE 3 FATORES.
   *
   * Este é o método mais crítico de segurança do sistema.
   * A ativação só é permitida quando TODOS os 3 fatores são validados:
   *
   *   FATOR 1 — POSSE FÍSICA:
   *     O tutor precisa ter a tag em mãos para escanear o tag_code.
   *     Este código está impresso/gravado na tag NFC.
   *
   *   FATOR 2 — IDENTIDADE:
   *     O user_id da sessão deve corresponder ao user_id da tag.
   *     Ou seja, a tag foi reservada especificamente para este tutor.
   *
   *   FATOR 3 — CÓDIGO DE ATIVAÇÃO:
   *     O activation_code é enviado separadamente (e-mail/SMS/carta).
   *     Isso garante que mesmo se alguém roubar a tag, não consegue ativar.
   *
   * Adicionalmente, a tag precisa estar com status 'sent' (já enviada).
   *
   * @param {string} tagCode - Código da tag NFC (formato PET-XXXXXX)
   * @param {string} userId - UUID do usuário autenticado (da sessão/token)
   * @param {string} activationCode - Código de ativação (formato XXXX-XXXX)
   * @returns {Promise<object>} Objeto com { sucesso, mensagem, tag? }
   * @returns {boolean} returns.sucesso - true se ativação bem-sucedida
   * @returns {string} returns.mensagem - Mensagem descritiva do resultado
   * @returns {object} [returns.tag] - Tag ativada (apenas quando sucesso=true)
   *
   * @example
   * const resultado = await tagService.ativarTag('PET-82KJ91', 'user-uuid', 'AX9P-72KQ');
   * // resultado = { sucesso: true, mensagem: 'Tag ativada com sucesso!', tag: {...} }
   */
  async ativarTag(tagCode, userId, activationCode) {
    logger.info('TagService', `Tentativa de ativação da tag: ${tagCode} pelo usuário: ${userId}`);

    /**
     * PASSO 1: Busca a tag pelo código NFC.
     * Se a tag não existir, retorna erro imediatamente.
     */
    const tag = await NfcTag.buscarPorTagCode(tagCode);

    if (!tag) {
      logger.warn('TagService', `Ativação falhou — tag não encontrada: ${tagCode}`);
      return {
        sucesso: false,
        mensagem: 'Tag não encontrada. Verifique o código e tente novamente.',
      };
    }

    /**
     * PASSO 2: Verifica se a tag está com status 'sent'.
     * Tags em outros status não podem ser ativadas:
     *   - manufactured/reserved: ainda não foi enviada ao tutor
     *   - active: já está ativa (ativação duplicada)
     *   - blocked: foi bloqueada por segurança
     */
    if (tag.status !== 'sent') {
      logger.warn('TagService', `Ativação falhou — status inválido: ${tag.status} para tag: ${tagCode}`);
      return {
        sucesso: false,
        mensagem: `Esta tag não pode ser ativada. Status atual: ${tag.status}`,
      };
    }

    /**
     * FATOR 2 — VERIFICAÇÃO DE IDENTIDADE:
     * Compara o user_id da tag (definido na reserva) com o userId
     * do usuário que está tentando ativar (da sessão/token JWT).
     */
    if (tag.user_id !== userId) {
      logger.warn('TagService', `Ativação falhou — usuário incorreto. Tag pertence a: ${tag.user_id}, tentativa de: ${userId}`);
      return {
        sucesso: false,
        mensagem: 'Esta tag não está associada à sua conta.',
      };
    }

    /**
     * FATOR 3 — VERIFICAÇÃO DO CÓDIGO DE ATIVAÇÃO:
     * Compara o código fornecido com o armazenado no banco.
     * O código foi gerado na fabricação e enviado separadamente ao tutor.
     */
    if (tag.activation_code !== activationCode) {
      logger.warn('TagService', `Ativação falhou — código de ativação incorreto para tag: ${tagCode}`);
      return {
        sucesso: false,
        mensagem: 'Código de ativação incorreto. Verifique o código recebido.',
      };
    }

    /**
     * TODOS OS 3 FATORES VALIDADOS!
     * Ativa a tag no banco — status muda para 'active'.
     * O pet_id fica null neste momento — será vinculado depois.
     */
    const tagAtivada = await NfcTag.ativar(tag.id, null);

    logger.info('TagService', `Tag ativada com sucesso: ${tagCode} pelo usuário: ${userId}`);

    return {
      sucesso: true,
      mensagem: 'Tag ativada com sucesso! Agora vincule-a a um pet.',
      tag: tagAtivada,
    };
  },

  /**
   * Vincula uma tag ativa a um pet específico.
   *
   * Após a ativação, o tutor escolhe qual pet será associado à tag.
   * A partir deste momento, quando alguém escanear a tag,
   * verá as informações do pet vinculado.
   *
   * @param {string} tagId - UUID da tag já ativada
   * @param {string} petId - UUID do pet a ser vinculado
   * @returns {Promise<object>} Tag com o pet_id atualizado
   * @throws {Error} Se a tag ou pet não forem encontrados
   *
   * @example
   * const tag = await tagService.vincularPet('tag-uuid', 'pet-uuid');
   * // tag.pet_id = 'pet-uuid'
   */
  async vincularPet(tagId, petId) {
    logger.info('TagService', `Vinculando tag ${tagId} ao pet ${petId}`);

    const tag = await NfcTag.vincularPet(tagId, petId);

    logger.info('TagService', `Tag ${tagId} vinculada ao pet ${petId} com sucesso`);

    return tag;
  },
};

module.exports = tagService;
