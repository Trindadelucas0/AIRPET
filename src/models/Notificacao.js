const { query } = require('../config/database');

const Notificacao = {

  async criar(dados) {
    const { usuario_id, tipo, mensagem, link, remetente_id, publicacao_id } = dados;

    const resultado = await query(
      `INSERT INTO notificacoes (usuario_id, tipo, mensagem, link, remetente_id, publicacao_id, data_criacao)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [usuario_id, tipo, mensagem, link, remetente_id || null, publicacao_id || null]
    );

    return resultado.rows[0];
  },

  async criarParaMultiplos(usuarioIds, tipo, mensagem, link) {
    const resultado = await query(
      `INSERT INTO notificacoes (usuario_id, tipo, mensagem, link, data_criacao)
       SELECT unnest($1::integer[]), $2, $3, $4, NOW()
       RETURNING *`,
      [usuarioIds, tipo, mensagem, link]
    );

    return resultado.rows;
  },

  async buscarPorUsuario(usuarioId, limite = 80) {
    const resultado = await query(
      `SELECT n.*,
              COALESCE(n.data_criacao, n.data) AS data_criacao,
              r.nome AS remetente_nome,
              r.cor_perfil AS remetente_cor,
              r.foto_perfil AS remetente_foto
       FROM notificacoes n
       LEFT JOIN usuarios r ON r.id = n.remetente_id
       WHERE n.usuario_id = $1
       ORDER BY COALESCE(n.data_criacao, n.data) DESC
       LIMIT $2`,
      [usuarioId, limite]
    );

    return resultado.rows;
  },

  async buscarPorTipos(usuarioId, tipos, limite = 80) {
    const resultado = await query(
      `SELECT n.*,
              COALESCE(n.data_criacao, n.data) AS data_criacao,
              r.nome AS remetente_nome,
              r.cor_perfil AS remetente_cor,
              r.foto_perfil AS remetente_foto
       FROM notificacoes n
       LEFT JOIN usuarios r ON r.id = n.remetente_id
       WHERE n.usuario_id = $1 AND n.tipo = ANY($2)
       ORDER BY COALESCE(n.data_criacao, n.data) DESC
       LIMIT $3`,
      [usuarioId, tipos, limite]
    );

    return resultado.rows;
  },

  async marcarComoLida(id, usuarioId) {
    const resultado = await query(
      `UPDATE notificacoes
       SET lida = true
       WHERE id = $1 AND usuario_id = $2
       RETURNING *`,
      [id, usuarioId]
    );

    return resultado.rows[0];
  },

  async marcarTodasComoLidas(usuarioId) {
    const resultado = await query(
      `UPDATE notificacoes
       SET lida = true
       WHERE usuario_id = $1 AND lida = false
       RETURNING id`,
      [usuarioId]
    );

    return resultado.rowCount;
  },

  async contarNaoLidas(usuarioId) {
    const resultado = await query(
      `SELECT COUNT(*) AS total
       FROM notificacoes
       WHERE usuario_id = $1 AND lida = false`,
      [usuarioId]
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = Notificacao;
