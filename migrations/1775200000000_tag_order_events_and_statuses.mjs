export const shorthands = undefined;

export async function up(pgm) {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS tag_product_order_events (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES tag_product_orders(id) ON DELETE CASCADE,
      from_status VARCHAR(30),
      to_status VARCHAR(30) NOT NULL,
      actor_admin_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      nota TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_tag_product_order_events_lookup
    ON tag_product_order_events (order_id, created_at DESC);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_tag_product_order_events_lookup;`);
  pgm.sql(`DROP TABLE IF EXISTS tag_product_order_events;`);
}
