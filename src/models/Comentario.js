const { query } = require('../config/database');

function montarArvoreComentarios(rows) {
  if (!rows || !rows.length) return [];
  const byId = new Map();
  rows.forEach((r) => {
    byId.set(r.id, { ...r, respostas: [] });
  });
  const roots = [];
  byId.forEach((node) => {
    const pid = node.parent_id;
    if (pid != null && byId.has(pid)) {
      byId.get(pid).respostas.push(node);
    } else {
      roots.push(node);
    }
  });
  function sortRec(n) {
    n.respostas.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
    n.respostas.forEach(sortRec);
  }
  roots.sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em));
  roots.forEach(sortRec);
  return roots;
}

const Comentario = {

  async criar(dados) {
    const { usuario_id, publicacao_id, texto, parent_id: parentIdIn } = dados;
    const pubId = parseInt(publicacao_id, 10);
    let parentId = null;
    if (parentIdIn != null && parentIdIn !== '') {
      const n = parseInt(parentIdIn, 10);
      if (Number.isFinite(n) && n > 0) parentId = n;
    }
    if (parentId) {
      const parent = await Comentario.buscarPorId(parentId);
      if (!parent || parseInt(parent.publicacao_id, 10) !== pubId) {
        const err = new Error('Comentário pai inválido.');
        err.code = 'COMMENT_INVALID_PARENT';
        throw err;
      }
    }
    const resultado = await query(
      `INSERT INTO comentarios (usuario_id, publicacao_id, texto, parent_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [usuario_id, pubId, texto, parentId]
    );
    return resultado.rows[0];
  },

  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM comentarios WHERE id = $1`,
      [id]
    );
    return resultado.rows[0] || null;
  },

  async buscarPorPublicacao(publicacaoId, limite = 120) {
    const lim = Number.isInteger(limite) && limite > 0 ? limite : 120;
    const resultado = await query(
      `SELECT c.*, u.nome AS autor_nome, u.cor_perfil, u.foto_perfil
       FROM comentarios c
       JOIN usuarios u ON u.id = c.usuario_id
       WHERE c.publicacao_id = $1
       ORDER BY c.criado_em ASC
       LIMIT $2`,
      [publicacaoId, lim]
    );
    return resultado.rows;
  },

  async buscarArvorePorPublicacao(publicacaoId, limite = 120) {
    const flat = await Comentario.buscarPorPublicacao(publicacaoId, limite);
    return montarArvoreComentarios(flat);
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM comentarios WHERE id = $1 RETURNING *`, [id]
    );
    return resultado.rows[0];
  },

  async contar(publicacaoId) {
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM comentarios WHERE publicacao_id = $1`, [publicacaoId]
    );
    return resultado.rows[0].total;
  },

  extrairMencoes(texto) {
    const regex = /@([\w\s]+?)(?=\s@|\s*$|[.,!?;])/g;
    const mencoes = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
      mencoes.push(match[1].trim());
    }
    return [...new Set(mencoes)];
  },

  async resolverMencoes(nomes) {
    if (!nomes.length) return [];
    const placeholders = nomes.map((_, i) => `$${i + 1}`).join(', ');
    const resultado = await query(
      `SELECT id, nome FROM usuarios WHERE LOWER(nome) IN (${placeholders})`,
      nomes.map(n => n.toLowerCase())
    );
    return resultado.rows;
  },
};

module.exports = Comentario;
