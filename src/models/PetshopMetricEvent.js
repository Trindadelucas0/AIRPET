const { query } = require('../config/database');

let ensureTablePromise = null;

async function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = (async () => {
      await query(
        `CREATE TABLE IF NOT EXISTS petshop_metric_events (
          id SERIAL PRIMARY KEY,
          petshop_id INTEGER NOT NULL REFERENCES petshops(id) ON DELETE CASCADE,
          event_type VARCHAR(40) NOT NULL,
          publication_type VARCHAR(40),
          publication_id INTEGER,
          usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      );
      await query(`CREATE INDEX IF NOT EXISTS idx_petshop_metric_events_petshop_period ON petshop_metric_events (petshop_id, event_type, created_at DESC)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_petshop_metric_events_publication ON petshop_metric_events (publication_type, publication_id, created_at DESC)`);
    })().catch((erro) => {
      ensureTablePromise = null;
      throw erro;
    });
  }
  return ensureTablePromise;
}

const PetshopMetricEvent = {
  async registrarEvento({
    petshop_id,
    event_type,
    publication_type = null,
    publication_id = null,
    usuario_id = null,
  }) {
    if (!petshop_id || !event_type) return null;
    await ensureTable();
    const result = await query(
      `INSERT INTO petshop_metric_events (
        petshop_id, event_type, publication_type, publication_id, usuario_id
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [petshop_id, event_type, publication_type, publication_id, usuario_id]
    );
    return result.rows[0] || null;
  },

  async contarEventosDesde(petshopId, eventType, inicioPeriodo) {
    if (!petshopId || !eventType) return 0;
    await ensureTable();
    const result = await query(
      `SELECT COUNT(*)::int AS total
       FROM petshop_metric_events
       WHERE petshop_id = $1
         AND event_type = $2
         AND created_at >= $3`,
      [petshopId, eventType, inicioPeriodo]
    );
    return result.rows[0]?.total || 0;
  },
};

module.exports = PetshopMetricEvent;
