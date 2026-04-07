const { query, withTransaction } = require('../config/database');
const { ensureTagCommerceSchema } = require('./tagCommerceSchema');

const TagOrderUnit = {
  async ensureSchema() {
    await ensureTagCommerceSchema();
  },

  async listarPorPedido(orderId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT u.*, p.nome AS pet_nome, p.foto AS pet_foto, t.tag_code, t.status AS nfc_status
       FROM tag_order_units u
       LEFT JOIN pets p ON p.id = u.pet_id
       LEFT JOIN nfc_tags t ON t.id = u.nfc_tag_id
       WHERE u.order_id = $1
       ORDER BY u.sequencia ASC`,
      [orderId]
    );
    return r.rows;
  },

  async atualizarPersonalizacao(orderId, unitId, usuarioId, dados) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_order_units u
       SET print_photo_url = COALESCE($4, u.print_photo_url),
           personalization_status = COALESCE($5, u.personalization_status),
           data_atualizacao = NOW()
       FROM tag_product_orders o
       WHERE u.id = $2
         AND u.order_id = $1
         AND o.id = u.order_id
         AND o.usuario_id = $3
       RETURNING u.*`,
      [orderId, unitId, usuarioId, dados.print_photo_url || null, dados.personalization_status || null]
    );
    return r.rows[0] || null;
  },

  async vincularTagFisica(unitId, nfcTagId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_order_units
       SET nfc_tag_id = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [unitId, nfcTagId]
    );
    return r.rows[0] || null;
  },

  async buscarPorPetAtiva(petId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT u.*
       FROM tag_order_units u
       JOIN nfc_tags t ON t.id = u.nfc_tag_id
       WHERE u.pet_id = $1
         AND t.status = 'active'
       ORDER BY u.id DESC
       LIMIT 1`,
      [petId]
    );
    return r.rows[0] || null;
  },

  async concluirAtivacaoPorTag(tagId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `UPDATE tag_order_units
       SET activated_at = COALESCE(activated_at, NOW()),
           personalization_status = CASE WHEN personalization_status = 'pendente' THEN 'ok' ELSE personalization_status END,
           data_atualizacao = NOW()
       WHERE nfc_tag_id = $1
       RETURNING *`,
      [tagId]
    );
    return r.rows[0] || null;
  },

  async contarComFotoPendentePorPedido(orderId) {
    await ensureTagCommerceSchema();
    const r = await query(
      `SELECT COUNT(*)::int AS total
       FROM tag_order_units
       WHERE order_id = $1
         AND (print_photo_url IS NULL OR print_photo_url = '')`,
      [orderId]
    );
    return r.rows[0]?.total || 0;
  },

  async trocarPetComValidacao(orderId, unitId, usuarioId, petId) {
    await ensureTagCommerceSchema();
    return withTransaction(async (client) => {
      const pet = await client.query(
        `SELECT id FROM pets WHERE id = $1 AND usuario_id = $2`,
        [petId, usuarioId]
      );
      if (!pet.rows[0]) return null;

      const r = await client.query(
        `UPDATE tag_order_units u
         SET pet_id = $4,
             data_atualizacao = NOW()
         FROM tag_product_orders o
         WHERE u.id = $2
           AND u.order_id = $1
           AND o.id = u.order_id
           AND o.usuario_id = $3
         RETURNING u.*`,
        [orderId, unitId, usuarioId, petId]
      );
      return r.rows[0] || null;
    });
  },
};

module.exports = TagOrderUnit;
