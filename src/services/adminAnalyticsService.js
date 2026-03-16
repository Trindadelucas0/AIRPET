const { query } = require('../config/database');

/**
 * Service de consultas específicas para o painel avançado de analytics do admin.
 * Aqui usamos queries diretas sobre as tabelas existentes para um MVP.
 * Quando os workers de agregação estiverem prontos, podemos migrar parte
 * dessas consultas para ler de analytics_daily_agg, post_trending_daily etc.
 */
const PERIODS = {
  today: "NOW() - INTERVAL '1 day'",
  week: "NOW() - INTERVAL '7 days'",
  month: "NOW() - INTERVAL '30 days'",
};

function resolvePeriodo(periodo) {
  if (!periodo || !PERIODS[periodo]) return { key: 'week', sql: PERIODS.week };
  return { key: periodo, sql: PERIODS[periodo] };
}

async function topUsuariosInfluentes(periodoChave = 'week', limite = 10) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const [
    seguidores,
    likes,
    comentarios,
    views,
  ] = await Promise.all([
    query(
      `SELECT seguido_id AS usuario_id, COUNT(*)::int AS total
       FROM seguidores
       GROUP BY seguido_id
       ORDER BY total DESC
       LIMIT $1`,
      [limite]
    ),
    query(
      `SELECT p.usuario_id AS usuario_id, COUNT(*)::int AS total
       FROM curtidas c
       JOIN publicacoes p ON p.id = c.publicacao_id
       WHERE c.criado_em >= ${since}
       GROUP BY p.usuario_id
       ORDER BY total DESC
       LIMIT $1`,
      [limite]
    ),
    query(
      `SELECT p.usuario_id AS usuario_id, COUNT(*)::int AS total
       FROM comentarios cm
       JOIN publicacoes p ON p.id = cm.publicacao_id
       WHERE cm.criado_em >= ${since}
       GROUP BY p.usuario_id
       ORDER BY total DESC
       LIMIT $1`,
      [limite]
    ),
    query(
      `SELECT p.usuario_id AS usuario_id,
              COUNT(*)::int AS views,
              COALESCE(SUM(watch_ms), 0)::bigint AS watch_ms
       FROM post_interactions_raw pir
       JOIN publicacoes p ON p.id = pir.post_id
       WHERE pir.event_type = 'view'
         AND pir.created_at >= ${since}
       GROUP BY p.usuario_id
       ORDER BY views DESC
       LIMIT $1`,
      [limite]
    ),
  ]);

  return {
    seguidores: seguidores.rows,
    likes: likes.rows,
    comentarios: comentarios.rows,
    views: views.rows,
    periodo: periodoChave,
  };
}

async function topUsuariosPorEngajamentoMedio(periodoChave = 'week', limite = 10) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const res = await query(
    `WITH stats AS (
       SELECT p.usuario_id,
              COUNT(DISTINCT p.id)::int AS posts_publicados,
              COUNT(c.id)::int AS total_likes,
              COUNT(cm.id)::int AS total_comentarios,
              COUNT(r.id)::int AS total_reposts
       FROM publicacoes p
       LEFT JOIN curtidas c ON c.publicacao_id = p.id AND c.criado_em >= ${since}
       LEFT JOIN comentarios cm ON cm.publicacao_id = p.id AND cm.criado_em >= ${since}
       LEFT JOIN reposts r ON r.publicacao_id = p.id AND r.criado_em >= ${since}
       WHERE p.criado_em >= ${since}
       GROUP BY p.usuario_id
     )
     SELECT usuario_id,
            posts_publicados,
            total_likes,
            total_comentarios,
            total_reposts,
            CASE
              WHEN posts_publicados = 0 THEN 0
              ELSE (total_likes + total_comentarios + total_reposts)::numeric / posts_publicados
            END AS engajamento_medio
     FROM stats
     WHERE posts_publicados > 0
     ORDER BY engajamento_medio DESC
     LIMIT $1`,
    [limite]
  );

  return { periodo: periodoChave, usuarios: res.rows };
}

async function topUsuariosPorResposta(periodoChave = 'week', limite = 10) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const res = await query(
    `WITH base AS (
       SELECT p.usuario_id,
              COUNT(cm.id)::int AS comentarios_recebidos
       FROM publicacoes p
       LEFT JOIN comentarios cm ON cm.publicacao_id = p.id
       WHERE p.criado_em >= ${since}
         AND cm.criado_em >= ${since}
       GROUP BY p.usuario_id
     ),
     feitos AS (
       SELECT usuario_id,
              COUNT(*)::int AS comentarios_feitos
       FROM comentarios
       WHERE criado_em >= ${since}
       GROUP BY usuario_id
     )
     SELECT b.usuario_id,
            b.comentarios_recebidos,
            COALESCE(f.comentarios_feitos, 0) AS comentarios_feitos,
            CASE
              WHEN COALESCE(f.comentarios_feitos, 0) = 0 THEN NULL
              ELSE b.comentarios_recebidos::numeric / f.comentarios_feitos
            END AS taxa_resposta
     FROM base b
     LEFT JOIN feitos f ON f.usuario_id = b.usuario_id
     ORDER BY taxa_resposta DESC NULLS LAST
     LIMIT $1`,
    [limite]
  );

  return { periodo: periodoChave, usuarios: res.rows };
}

async function usuariosPerigosos(periodoChave = 'month', limite = 10) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const [bloqueios, denuncias] = await Promise.all([
    query(
      `SELECT target_user_id AS usuario_id, COUNT(*)::int AS total_blocks
       FROM moderation_events_raw
       WHERE action = 'block'
         AND created_at >= ${since}
       GROUP BY target_user_id
       ORDER BY total_blocks DESC
       LIMIT $1`,
      [limite * 2]
    ),
    query(
      `SELECT target_user_id AS usuario_id, COUNT(*)::int AS total_reports
       FROM moderation_events_raw
       WHERE action = 'report'
         AND created_at >= ${since}
       GROUP BY target_user_id
       ORDER BY total_reports DESC
       LIMIT $1`,
      [limite * 2]
    ),
  ]);

  const [riskSignals] = await Promise.all([
    query(
      `SELECT user_id,
              sudden_follower_growth_score,
              spam_probability,
              report_rate,
              block_rate
       FROM user_risk_signals`
    ),
  ]);

  return {
    bloqueios: bloqueios.rows,
    denuncias: denuncias.rows,
    riscos: riskSignals.rows,
    periodo: periodoChave,
  };
}

async function conteudoViralPorPeriodo(periodoChave = 'today', limite = 20) {
  const { key } = resolvePeriodo(periodoChave);

  if (key === 'today') {
    const res = await query(
      `SELECT p.id, p.usuario_id, p.pet_id, p.foto, p.legenda, p.criado_em,
              COALESCE(e.engagement_score, 0) AS engagement_score
       FROM publicacoes p
       LEFT JOIN post_engagement_agg e ON e.post_id = p.id
       WHERE p.criado_em::date = CURRENT_DATE
       ORDER BY engagement_score DESC, p.criado_em DESC
       LIMIT $1`,
      [limite]
    );
    return { periodo: key, posts: res.rows };
  }

  const days = key === 'week' ? 7 : 30;
  const res = await query(
    `SELECT p.id, p.usuario_id, p.pet_id, p.foto, p.legenda, p.criado_em,
            COALESCE(SUM(e.engagement_score), 0) AS engagement_score_sum
     FROM publicacoes p
     LEFT JOIN post_engagement_agg e ON e.post_id = p.id
     WHERE p.criado_em >= NOW() - INTERVAL '${days} days'
     GROUP BY p.id
     ORDER BY engagement_score_sum DESC, MIN(p.criado_em) DESC
     LIMIT $1`,
    [limite]
  );

  return { periodo: key, posts: res.rows };
}

async function trendingBreeds(periodoChave = 'week', limite = 20) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const res = await query(
    `SELECT pet.raca, pet.tipo,
            COUNT(*)::int AS total_interacoes
     FROM post_interactions_raw pir
     JOIN publicacoes p ON p.id = pir.post_id
     JOIN pets pet ON pet.id = p.pet_id
     WHERE pir.created_at >= ${since}
     GROUP BY pet.raca, pet.tipo
     ORDER BY total_interacoes DESC
     LIMIT $1`,
    [limite]
  );

  return { periodo: periodoChave, racas: res.rows };
}

async function cidadesMaisAtivas(periodoChave = 'week', limite = 20) {
  const { sql: since } = resolvePeriodo(periodoChave);

  const [usuariosAtivos, interacoes, postsPorCidade] = await Promise.all([
    query(
      `SELECT cidade, COUNT(*)::int AS total_usuarios
       FROM usuarios
       WHERE cidade IS NOT NULL AND TRIM(cidade) <> ''
       GROUP BY cidade
       ORDER BY total_usuarios DESC
       LIMIT $1`,
      [limite]
    ),
    query(
      `SELECT city AS cidade,
              COUNT(*)::int AS total_interacoes
       FROM post_interactions_raw
       WHERE city IS NOT NULL AND TRIM(city) <> ''
         AND created_at >= ${since}
       GROUP BY city
       ORDER BY total_interacoes DESC
       LIMIT $1`,
      [limite]
    ),
    query(
      `SELECT u.cidade,
              COUNT(p.id)::int AS total_posts_periodo
       FROM publicacoes p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE u.cidade IS NOT NULL AND TRIM(u.cidade) <> ''
         AND p.criado_em >= ${since}
       GROUP BY u.cidade
       ORDER BY total_posts_periodo DESC
       LIMIT $1`,
      [limite]
    ),
  ]);

  return {
    periodo: periodoChave,
    usuariosAtivos: usuariosAtivos.rows,
    interacoes: interacoes.rows,
    postsPorCidade: postsPorCidade.rows,
  };
}

async function timelineCrescimento(dias = 30) {
  const res = await query(
    `SELECT d::date AS day,
            COALESCE(u.novos_usuarios, 0)::int AS novos_usuarios,
            COALESCE(p.novos_posts, 0)::int AS novos_posts
     FROM generate_series(
            CURRENT_DATE - INTERVAL '${dias} days',
            CURRENT_DATE,
            INTERVAL '1 day'
          ) AS d
     LEFT JOIN (
       SELECT date(data_criacao) AS dia, COUNT(*)::int AS novos_usuarios
       FROM usuarios
       GROUP BY date(data_criacao)
     ) u ON u.dia = d::date
     LEFT JOIN (
       SELECT date(criado_em) AS dia, COUNT(*)::int AS novos_posts
       FROM publicacoes
       GROUP BY date(criado_em)
     ) p ON p.dia = d::date
     ORDER BY day ASC`
  );

  return res.rows;
}

async function listarBoostsAtivos() {
  const res = await query(
    `SELECT mb.id,
            mb.target_type,
            mb.target_id,
            mb.boost_value,
            mb.reason,
            mb.starts_at,
            mb.ends_at,
            mb.created_at
     FROM manual_boosts mb
     WHERE (mb.starts_at IS NULL OR mb.starts_at <= NOW())
       AND (mb.ends_at IS NULL OR mb.ends_at >= NOW())
     ORDER BY mb.created_at DESC
     LIMIT 100`
  );
  return res.rows;
}

module.exports = {
  topUsuariosInfluentes,
  topUsuariosPorEngajamentoMedio,
  topUsuariosPorResposta,
  usuariosPerigosos,
  conteudoViralPorPeriodo,
  trendingBreeds,
  cidadesMaisAtivas,
  timelineCrescimento,
  listarBoostsAtivos,
};

