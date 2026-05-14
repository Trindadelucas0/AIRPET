export const shorthands = undefined;

/**
 * Dados mínimos para testar hashtag pública, grupo e pet do mês em dev/staging.
 * Idempotente (ON CONFLICT / NOT EXISTS).
 */
export async function up(pgm) {
  pgm.sql(`
    INSERT INTO hashtags (slug, nome_exibicao, uso_count, oficial, bloqueada)
    VALUES ('airpetdemo', '#airpetdemo', 2, false, false)
    ON CONFLICT (slug) DO UPDATE SET nome_exibicao = EXCLUDED.nome_exibicao;
  `);
  pgm.sql(`
    INSERT INTO hashtags (slug, nome_exibicao, uso_count, oficial, bloqueada)
    VALUES ('petdormindo', '#petdormindo', 1, false, false)
    ON CONFLICT (slug) DO UPDATE SET nome_exibicao = EXCLUDED.nome_exibicao;
  `);

  pgm.sql(`
    INSERT INTO post_hashtags (publicacao_id, hashtag_id)
    SELECT pub.id, h.id
    FROM (SELECT p.id FROM publicacoes p WHERE p.pet_id IS NOT NULL ORDER BY p.id DESC LIMIT 1) pub
    CROSS JOIN (SELECT id FROM hashtags WHERE slug = 'airpetdemo' LIMIT 1) h
    WHERE EXISTS (SELECT 1 FROM publicacoes LIMIT 1)
    ON CONFLICT DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO grupos (slug, nome, descricao, tipo, privacidade, membros_count)
    VALUES (
      'pets-do-airpet',
      'Pets do AIRPET',
      'Grupo de demonstração — entre para testar o fluxo social.',
      'tema',
      'aberto',
      0
    )
    ON CONFLICT (slug) DO NOTHING;
  `);

  pgm.sql(`
    INSERT INTO pet_do_mes_votos (edicao_id, pet_id, user_id)
    SELECT e.id, pet.id, u.id
    FROM pet_do_mes_edicoes e
    CROSS JOIN LATERAL (SELECT id FROM usuarios ORDER BY id ASC LIMIT 1) u
    CROSS JOIN LATERAL (SELECT id FROM pets ORDER BY id ASC LIMIT 1) pet
    WHERE e.mes_ref = date_trunc('month', CURRENT_DATE)::date
      AND EXISTS (SELECT 1 FROM pets)
      AND EXISTS (SELECT 1 FROM usuarios)
    ON CONFLICT (edicao_id, user_id) DO NOTHING;
  `);
}

export async function down(pgm) {
  pgm.sql(`
    DELETE FROM post_hashtags
    WHERE hashtag_id IN (SELECT id FROM hashtags WHERE slug = 'airpetdemo');
  `);
  pgm.sql(`
    DELETE FROM hashtag_follows
    WHERE hashtag_id IN (SELECT id FROM hashtags WHERE slug IN ('airpetdemo', 'petdormindo'));
  `);
  pgm.sql(`DELETE FROM hashtags WHERE slug IN ('airpetdemo', 'petdormindo');`);
  pgm.sql(`DELETE FROM grupos WHERE slug = 'pets-do-airpet';`);
}
