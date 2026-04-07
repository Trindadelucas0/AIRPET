const { query } = require('../config/database');

let ensureFotoUrlPromise = null;

async function ensureFotoUrlColumn() {
  if (!ensureFotoUrlPromise) {
    ensureFotoUrlPromise = query(
      `ALTER TABLE petshop_services
       ADD COLUMN IF NOT EXISTS foto_url TEXT`
    ).catch((erro) => {
      ensureFotoUrlPromise = null;
      throw erro;
    });
  }
  return ensureFotoUrlPromise;
}

const PetshopService = {
  async criar({ petshop_id, nome, descricao, foto_url, duracao_minutos, preco_base }) {
    await ensureFotoUrlColumn();
    const result = await query(
      `INSERT INTO petshop_services (petshop_id, nome, descricao, foto_url, duracao_minutos, preco_base, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (petshop_id, nome) DO UPDATE SET
         descricao = EXCLUDED.descricao,
         foto_url = COALESCE(EXCLUDED.foto_url, petshop_services.foto_url),
         duracao_minutos = EXCLUDED.duracao_minutos,
         preco_base = EXCLUDED.preco_base,
         ativo = true
       RETURNING *`,
      [petshop_id, nome, descricao || null, foto_url || null, duracao_minutos || 30, preco_base || null]
    );
    return result.rows[0];
  },

  async buscarPorId(id, petshopId) {
    await ensureFotoUrlColumn();
    const result = await query(
      `SELECT * FROM petshop_services
       WHERE id = $1 AND petshop_id = $2
       LIMIT 1`,
      [id, petshopId]
    );
    return result.rows[0] || null;
  },

  async atualizar(id, petshopId, dados = {}) {
    await ensureFotoUrlColumn();
    const result = await query(
      `UPDATE petshop_services
       SET nome = COALESCE($3, nome),
           descricao = COALESCE($4, descricao),
           foto_url = COALESCE($5, foto_url),
           duracao_minutos = COALESCE($6, duracao_minutos),
           preco_base = COALESCE($7, preco_base),
           ativo = COALESCE($8, ativo)
       WHERE id = $1 AND petshop_id = $2
       RETURNING *`,
      [
        id,
        petshopId,
        dados.nome || null,
        dados.descricao != null ? dados.descricao : null,
        dados.foto_url || null,
        dados.duracao_minutos != null ? Number(dados.duracao_minutos) : null,
        dados.preco_base != null && dados.preco_base !== '' ? Number(dados.preco_base) : null,
        dados.ativo == null ? null : !!dados.ativo,
      ]
    );
    return result.rows[0] || null;
  },

  async deletar(id, petshopId) {
    await ensureFotoUrlColumn();
    const result = await query(
      `DELETE FROM petshop_services
       WHERE id = $1 AND petshop_id = $2
       RETURNING *`,
      [id, petshopId]
    );
    return result.rows[0] || null;
  },

  async listarAtivos(petshopId) {
    await ensureFotoUrlColumn();
    const result = await query(
      `SELECT * FROM petshop_services
       WHERE petshop_id = $1 AND ativo = true
       ORDER BY nome ASC`,
      [petshopId]
    );
    return result.rows;
  },
};

module.exports = PetshopService;
