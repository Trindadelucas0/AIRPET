/**
 * NfcTag.js — Modelo de dados para a tabela "nfc_tags"
 *
 * Este módulo gerencia as tags NFC que são vinculadas aos pets.
 * As tags passam por um ciclo de vida:
 *   manufactured → reserved → sent → active → (blocked)
 *
 * Cada tag possui um código único (tag_code), um código de ativação
 * e opcionalmente um QR code associado.
 *
 * Tabela: nfc_tags
 * Campos principais: id, tag_code, activation_code, qr_code, status,
 *                    user_id, pet_id, batch_id, reserved_at, sent_at,
 *                    activated_at, data_criacao
 */

const { query, getClient } = require('../config/database');

const NfcTag = {

  /**
   * Cria um lote de tags NFC de uma só vez.
   * Utiliza uma transação para garantir que todas as tags sejam inseridas
   * ou nenhuma (atomicidade). Cada tag recebe o mesmo batch_id.
   *
   * @param {Array<object>} tags - Array de objetos com os dados de cada tag
   * @param {string} tags[].tag_code - Código único da tag NFC
   * @param {string} tags[].activation_code - Código de ativação
   * @param {string} tags[].qr_code - Código QR associado
   * @param {string} batchId - UUID do lote ao qual as tags pertencem
   * @returns {Promise<Array>} Lista das tags recém-criadas
   */
  async criarLote(tags, batchId) {
    /* Obtém uma conexão individual do pool para controlar a transação */
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const tagsInseridas = [];

      /* Itera sobre cada tag do lote e insere individualmente dentro da transação */
      for (const tag of tags) {
        const resultado = await client.query(
          `INSERT INTO nfc_tags (tag_code, activation_code, qr_code, batch_id)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [tag.tag_code, tag.activation_code, tag.qr_code, batchId]
        );
        tagsInseridas.push(resultado.rows[0]);
      }

      await client.query('COMMIT');
      return tagsInseridas;
    } catch (erro) {
      /* Em caso de erro, desfaz todas as inserções do lote */
      await client.query('ROLLBACK');
      throw erro;
    } finally {
      /* SEMPRE libera a conexão de volta ao pool */
      client.release();
    }
  },

  /**
   * Busca uma tag pelo código NFC (tag_code).
   * Retorna dados enriquecidos com informações do pet e do dono
   * via JOINs (LEFT JOIN porque a tag pode não estar vinculada ainda).
   *
   * @param {string} tagCode - Código único da tag NFC
   * @returns {Promise<object|undefined>} Tag com dados do pet e dono, ou undefined
   */
  async buscarPorTagCode(tagCode) {
    const resultado = await query(
      `SELECT t.*,
              p.nome AS pet_nome,
              p.especie AS pet_especie,
              p.raca AS pet_raca,
              p.foto AS pet_foto,
              u.nome AS dono_nome,
              u.telefone AS dono_telefone
       FROM nfc_tags t
       LEFT JOIN pets p ON p.id = t.pet_id
       LEFT JOIN usuarios u ON u.id = t.user_id
       WHERE t.tag_code = $1`,
      [tagCode]
    );

    return resultado.rows[0];
  },

  /**
   * Busca uma tag pelo seu ID (chave primária).
   *
   * @param {string} id - UUID da tag
   * @returns {Promise<object|undefined>} A tag encontrada ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM nfc_tags WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todas as tags associadas a um usuário específico.
   *
   * @param {string} userId - UUID do usuário
   * @returns {Promise<Array>} Tags do usuário
   */
  async buscarPorUsuario(userId) {
    const resultado = await query(
      `SELECT t.*, p.nome AS pet_nome
       FROM nfc_tags t
       LEFT JOIN pets p ON p.id = t.pet_id
       WHERE t.user_id = $1
       ORDER BY t.data_criacao DESC`,
      [userId]
    );

    return resultado.rows;
  },

  /**
   * Lista todas as tags do sistema, com filtro opcional por status.
   * Se filtroStatus for fornecido, retorna apenas tags com aquele status.
   *
   * @param {string|null} filtroStatus - Status para filtrar (opcional)
   * @returns {Promise<Array>} Lista de tags
   */
  async listarTodas(filtroStatus) {
    /* Monta a query dinamicamente conforme haja filtro ou não */
    if (filtroStatus) {
      const resultado = await query(
        `SELECT * FROM nfc_tags WHERE status = $1 ORDER BY data_criacao DESC`,
        [filtroStatus]
      );
      return resultado.rows;
    }

    const resultado = await query(
      `SELECT * FROM nfc_tags ORDER BY data_criacao DESC`
    );
    return resultado.rows;
  },

  /**
   * Lista todas as tags de um determinado lote (batch).
   *
   * @param {string} batchId - UUID do lote
   * @returns {Promise<Array>} Tags do lote
   */
  async listarPorBatch(batchId) {
    const resultado = await query(
      `SELECT * FROM nfc_tags WHERE batch_id = $1 ORDER BY data_criacao DESC`,
      [batchId]
    );

    return resultado.rows;
  },

  /**
   * Reserva uma tag para um usuário específico.
   * Muda o status para 'reserved' e registra quem reservou e quando.
   *
   * @param {string} id - UUID da tag
   * @param {string} userId - UUID do usuário que está reservando
   * @returns {Promise<object>} Tag atualizada
   */
  async reservar(id, userId) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET status = 'reserved',
           user_id = $2,
           reserved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, userId]
    );

    return resultado.rows[0];
  },

  /**
   * Marca uma tag como enviada (status 'sent').
   * Indica que a tag foi despachada fisicamente para o usuário.
   *
   * @param {string} id - UUID da tag
   * @returns {Promise<object>} Tag atualizada
   */
  async marcarEnviada(id) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET status = 'sent',
           sent_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Ativa uma tag vinculando-a a um pet.
   * Este é o passo final do fluxo: a tag agora identifica o pet.
   *
   * @param {string} id - UUID da tag
   * @param {string} petId - UUID do pet a ser vinculado
   * @returns {Promise<object>} Tag atualizada
   */
  async ativar(id, petId) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET status = 'active',
           pet_id = $2,
           activated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, petId]
    );

    return resultado.rows[0];
  },

  /**
   * Bloqueia uma tag, impedindo seu uso.
   * Pode ser usado em caso de perda/roubo da tag física.
   *
   * @param {string} id - UUID da tag
   * @returns {Promise<object>} Tag atualizada
   */
  async bloquear(id) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET status = 'blocked'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Desbloqueia uma tag, retornando ao status 'active'.
   *
   * @param {string} id - UUID da tag
   * @returns {Promise<object>} Tag atualizada
   */
  async desbloquear(id) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET status = 'active'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Vincula (ou re-vincula) uma tag a um pet diferente.
   * Não altera o status — apenas muda a associação.
   *
   * @param {string} id - UUID da tag
   * @param {string} petId - UUID do novo pet
   * @returns {Promise<object>} Tag atualizada
   */
  async vincularPet(id, petId) {
    const resultado = await query(
      `UPDATE nfc_tags
       SET pet_id = $2
       WHERE id = $1
       RETURNING *`,
      [id, petId]
    );

    return resultado.rows[0];
  },

  /**
   * Conta as tags agrupadas por status.
   * Retorna um array com objetos { status, total }.
   * Útil para o dashboard do admin ver a distribuição de tags.
   *
   * @returns {Promise<Array>} Contagens por status
   */
  async contarPorStatus() {
    const resultado = await query(
      `SELECT status, COUNT(*) AS total
       FROM nfc_tags
       GROUP BY status`
    );

    return resultado.rows;
  },
};

module.exports = NfcTag;
