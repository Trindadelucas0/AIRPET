const { query } = require('../config/database');

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await query(
    `CREATE TABLE IF NOT EXISTS petshop_schedule_blocks (
      id SERIAL PRIMARY KEY,
      petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
      service_id INTEGER REFERENCES petshop_services(id) ON DELETE SET NULL,
      inicio TIMESTAMP NOT NULL,
      fim TIMESTAMP NOT NULL,
      motivo VARCHAR(255),
      data_criacao TIMESTAMP DEFAULT NOW()
    )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_petshop_schedule_blocks_lookup
     ON petshop_schedule_blocks (petshop_id, inicio, fim)`
  );
  ensured = true;
}

const PetshopScheduleBlock = {
  async criar({ petshop_id, service_id = null, inicio, fim, motivo = null }) {
    await ensureTable();
    const result = await query(
      `INSERT INTO petshop_schedule_blocks (petshop_id, service_id, inicio, fim, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [petshop_id, service_id || null, inicio, fim, motivo || null]
    );
    return result.rows[0] || null;
  },

  async listarPorPetshopNoIntervalo(petshopId, inicio, fim, serviceId = null) {
    await ensureTable();
    const result = await query(
      `SELECT *
       FROM petshop_schedule_blocks
       WHERE petshop_id = $1
         AND inicio < $3
         AND fim > $2
         AND ($4::int IS NULL OR service_id IS NULL OR service_id = $4)
       ORDER BY inicio ASC`,
      [petshopId, inicio, fim, serviceId || null]
    );
    return result.rows;
  },

  async listarFuturosPorPetshop(petshopId, limit = 100) {
    await ensureTable();
    const result = await query(
      `SELECT b.*, s.nome AS servico_nome
       FROM petshop_schedule_blocks b
       LEFT JOIN petshop_services s ON s.id = b.service_id
       WHERE b.petshop_id = $1
         AND b.fim >= NOW()
       ORDER BY b.inicio ASC
       LIMIT $2`,
      [petshopId, limit]
    );
    return result.rows;
  },

  async deletar(id, petshopId) {
    await ensureTable();
    const result = await query(
      `DELETE FROM petshop_schedule_blocks
       WHERE id = $1
         AND petshop_id = $2
       RETURNING *`,
      [id, petshopId]
    );
    return result.rows[0] || null;
  },
};

module.exports = PetshopScheduleBlock;
