export const shorthands = undefined;

/**
 * Índices parciais / de suporte para COUNT e filtros frequentes sob carga
 * (notificações não lidas, publicações fixadas, pets_perdidos por status).
 */
export async function up(pgm) {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario_nao_lida
    ON notificacoes (usuario_id)
    WHERE lida = false;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_publicacoes_usuario_fixada
    ON publicacoes (usuario_id)
    WHERE fixada = true;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_pets_perdidos_status
    ON pets_perdidos (status);
  `);
}

export async function down(pgm) {
  pgm.sql(`DROP INDEX IF EXISTS idx_pets_perdidos_status;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_publicacoes_usuario_fixada;`);
  pgm.sql(`DROP INDEX IF EXISTS idx_notificacoes_usuario_nao_lida;`);
}
