const { query, pool } = require('../config/database');

const PetshopAccount = {
  async criar({ petshop_id, email, password_hash, status = 'pendente_aprovacao', usuario_id = null }, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `INSERT INTO petshop_accounts (petshop_id, email, password_hash, status, usuario_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [petshop_id, email, password_hash, status, usuario_id]
    );
    return result.rows[0];
  },

  async buscarPorPetshopId(petshopId) {
    const result = await query(
      `SELECT * FROM petshop_accounts WHERE petshop_id = $1 LIMIT 1`,
      [petshopId]
    );
    return result.rows[0] || null;
  },

  async atualizarUsuarioId(accountId, usuarioId, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE petshop_accounts SET usuario_id = $2, data_atualizacao = NOW() WHERE id = $1 RETURNING *`,
      [accountId, usuarioId]
    );
    return result.rows[0];
  },

  async buscarPorEmail(email) {
    const result = await query(`SELECT * FROM petshop_accounts WHERE email = $1`, [email]);
    return result.rows[0];
  },

  async buscarPorId(id) {
    const result = await query(
      `SELECT pa.*, p.nome AS petshop_nome
       FROM petshop_accounts pa
       JOIN petshops p ON p.id = pa.petshop_id
       WHERE pa.id = $1`,
      [id]
    );
    return result.rows[0];
  },

  async atualizarStatusPorPetshopId(petshopId, status, client = null) {
    const executor = client || pool;
    const result = await executor.query(
      `UPDATE petshop_accounts
       SET status = $2, data_atualizacao = NOW()
       WHERE petshop_id = $1
       RETURNING *`,
      [petshopId, status]
    );
    return result.rows[0];
  },

  async registrarLogin(id) {
    await query(`UPDATE petshop_accounts SET ultimo_login_em = NOW() WHERE id = $1`, [id]);
  },

  async listarParceirosResponsaveisAtivos(filtros = {}) {
    const wherePetshops = ['pa.usuario_id IS NOT NULL', "pa.status = 'ativo'"];
    const values = [];
    let idx = 1;
    if (filtros.estado) {
      wherePetshops.push(`u.estado = $${idx}`);
      values.push(filtros.estado);
      idx++;
    }
    if (filtros.cidade) {
      wherePetshops.push(`u.cidade ILIKE $${idx}`);
      values.push(`%${filtros.cidade}%`);
      idx++;
    }
    if (typeof filtros.bloqueado === 'boolean') {
      wherePetshops.push(`u.bloqueado = $${idx}`);
      values.push(filtros.bloqueado);
      idx++;
    }

    const result = await query(
      `SELECT
          u.id,
          u.nome,
          u.email,
          u.foto_perfil,
          u.cor_perfil,
          u.telefone,
          u.cidade,
          u.estado,
          u.bairro,
          u.role,
          u.bloqueado,
          u.data_criacao,
          p.id AS petshop_id,
          p.nome AS petshop_nome,
          p.endereco AS petshop_endereco,
          p.telefone AS petshop_telefone,
          p.ativo AS petshop_ativo,
          pa.status AS petshop_account_status
        FROM petshop_accounts pa
        JOIN usuarios u ON u.id = pa.usuario_id
        JOIN petshops p ON p.id = pa.petshop_id
        WHERE ${wherePetshops.join(' AND ')}
        ORDER BY u.data_criacao DESC`,
      values
    );
    return result.rows;
  },
};

module.exports = PetshopAccount;
