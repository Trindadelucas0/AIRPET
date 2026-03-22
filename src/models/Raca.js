const { query } = require('../config/database');

const Raca = {
  async buscar({ tipo, q, limite = 50 } = {}) {
    let sql = 'SELECT id, nome, tipo FROM racas WHERE 1=1';
    const params = [];

    if (tipo) {
      params.push(tipo);
      sql += ` AND tipo = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND LOWER(nome) LIKE LOWER($${params.length})`;
    }

    const lim = Math.min(Math.max(parseInt(limite, 10) || 50, 1), 100);
    params.push(lim);
    sql += ` ORDER BY popular DESC, nome ASC LIMIT $${params.length}`;

    const resultado = await query(sql, params);
    return resultado.rows;
  },
};

module.exports = Raca;
