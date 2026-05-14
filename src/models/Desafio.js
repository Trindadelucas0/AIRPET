const { query } = require('../config/database');

const Desafio = {
  async buscarAtivo() {
    const r = await query(
      `SELECT * FROM desafios
       WHERE estado = 'ativo' AND inicia_em <= NOW() AND termina_em >= NOW()
       ORDER BY id DESC LIMIT 1`
    );
    return r.rows[0] || null;
  },

  async registrarParticipacao(desafioId, petId, autorUserId, publicacaoId) {
    await query(
      `INSERT INTO desafio_participacoes (desafio_id, pet_id, autor_user_id, publicacao_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (desafio_id, pet_id) DO NOTHING`,
      [desafioId, petId, autorUserId, publicacaoId]
    );
  },

  async vincularDesafioNaPublicacao(publicacaoId, desafioId) {
    await query(`UPDATE publicacoes SET desafio_id = $2 WHERE id = $1`, [publicacaoId, desafioId]);
  },
};

module.exports = Desafio;
