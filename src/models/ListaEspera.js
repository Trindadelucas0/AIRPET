/**
 * ListaEspera.js — Leads do wizard /lista-espera
 */

const crypto = require('crypto');
const { query } = require('../config/database');

const ORIGEM_PADRAO = 'lista-espera-wizard';
const PAGE_SIZE = 50;

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizarRespostas(respostas) {
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) {
    return {};
  }
  const prioridades = Array.isArray(respostas.prioridades)
    ? respostas.prioridades.slice(0, 2)
    : respostas.prioridades;
  return { ...respostas, ...(prioridades !== undefined ? { prioridades } : {}) };
}

function mapRow(row) {
  if (!row) return row;
  const respostas =
    typeof row.respostas === 'string' ? JSON.parse(row.respostas || '{}') : row.respostas || {};
  return { ...row, respostas, respostas_json: respostas };
}

async function gerarReferralCodeUnico() {
  for (let i = 0; i < 10; i += 1) {
    const code = crypto.randomBytes(6).toString('hex').slice(0, 10);
    const existe = await query('SELECT 1 FROM lista_espera WHERE referral_code = $1 LIMIT 1', [code]);
    if (existe.rows.length === 0) return code;
  }
  return crypto.randomBytes(8).toString('hex').slice(0, 12);
}

const ListaEspera = {
  ORIGEM_PADRAO,
  PAGE_SIZE,

  async buscarPorEmail(email) {
    const resultado = await query(
      `SELECT * FROM lista_espera WHERE LOWER(email) = $1 LIMIT 1`,
      [normalizarEmail(email)]
    );
    return mapRow(resultado.rows[0]) || null;
  },

  async upsertPorEmail(dados) {
    const {
      email,
      nome,
      telefone,
      cidade,
      estado,
      origem,
      respostas,
      user_agent,
      ip_hash,
      wizard_completo,
    } = dados;

    const emailNorm = normalizarEmail(email);
    const existente = await this.buscarPorEmail(emailNorm);
    let referral_code = dados.referral_code || existente?.referral_code;
    if (!referral_code) {
      referral_code = await gerarReferralCodeUnico();
    }

    const estadoNorm = estado ? String(estado).trim().toUpperCase().slice(0, 2) : null;
    const respostasJson = JSON.stringify(sanitizarRespostas(respostas));
    const completo = wizard_completo !== false;

    const resultado = await query(
      `INSERT INTO lista_espera (
         nome, email, telefone, cidade, estado, origem,
         respostas, user_agent, ip_hash, wizard_completo, referral_code
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
       ON CONFLICT (email) DO UPDATE SET
         nome = EXCLUDED.nome,
         telefone = COALESCE(EXCLUDED.telefone, lista_espera.telefone),
         cidade = COALESCE(EXCLUDED.cidade, lista_espera.cidade),
         estado = COALESCE(EXCLUDED.estado, lista_espera.estado),
         origem = EXCLUDED.origem,
         respostas = EXCLUDED.respostas,
         user_agent = COALESCE(EXCLUDED.user_agent, lista_espera.user_agent),
         ip_hash = COALESCE(EXCLUDED.ip_hash, lista_espera.ip_hash),
         wizard_completo = EXCLUDED.wizard_completo,
         referral_code = COALESCE(lista_espera.referral_code, EXCLUDED.referral_code)
       RETURNING *`,
      [
        String(nome || '').trim().slice(0, 200) || 'Sem nome',
        emailNorm,
        telefone ? String(telefone).trim().slice(0, 30) : null,
        cidade ? String(cidade).trim().slice(0, 80) : null,
        estadoNorm,
        String(origem || ORIGEM_PADRAO).trim().slice(0, 64) || ORIGEM_PADRAO,
        respostasJson,
        user_agent || null,
        ip_hash || null,
        completo,
        referral_code,
      ]
    );

    return mapRow(resultado.rows[0]);
  },

  async posicaoNaFila(email) {
    const resultado = await query(
      `WITH ord AS (
         SELECT LOWER(email) AS em,
                ROW_NUMBER() OVER (ORDER BY criado_em ASC, id ASC) AS pos
         FROM lista_espera
         WHERE wizard_completo = true
       )
       SELECT pos FROM ord WHERE em = $1 LIMIT 1`,
      [normalizarEmail(email)]
    );
    return resultado.rows[0]?.pos ?? null;
  },

  async contarWizardCompleto() {
    const resultado = await query(
      `SELECT COUNT(*)::int AS c FROM lista_espera WHERE wizard_completo = true`
    );
    return resultado.rows[0]?.c ?? 0;
  },

  async listar({ origem, limite = PAGE_SIZE, offset = 0, buscaEmail } = {}) {
    const params = [];
    const where = [];

    if (origem) {
      params.push(String(origem).trim());
      where.push(`origem = $${params.length}`);
    }
    if (buscaEmail) {
      params.push(`%${normalizarEmail(buscaEmail)}%`);
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(nome) LIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limite, offset);
    const limiteIdx = params.length - 1;
    const offsetIdx = params.length;

    const resultado = await query(
      `SELECT id, email, origem, nome, telefone, cidade, estado,
              respostas, wizard_completo, user_agent, criado_em, referral_code
       FROM lista_espera
       ${whereSql}
       ORDER BY criado_em DESC
       LIMIT $${limiteIdx} OFFSET $${offsetIdx}`,
      params
    );

    return resultado.rows.map(mapRow);
  },

  async listarParaExport(filtros = {}) {
    return this.listar({ ...filtros, limite: 10000, offset: 0 });
  },

  async contar(filtros = {}) {
    const params = [];
    const where = [];
    if (filtros.origem) {
      params.push(String(filtros.origem).trim());
      where.push(`origem = $${params.length}`);
    }
    if (filtros.buscaEmail) {
      params.push(`%${normalizarEmail(filtros.buscaEmail)}%`);
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(nome) LIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM lista_espera ${whereSql}`,
      params
    );
    return resultado.rows[0]?.total ?? 0;
  },

  async contarUltimosDias(dias = 7) {
    const d = Math.max(1, parseInt(dias, 10) || 7);
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM lista_espera
       WHERE criado_em >= NOW() - ($1::int * INTERVAL '1 day')`,
      [d]
    );
    return resultado.rows[0]?.total ?? 0;
  },

  async listarOrigens() {
    const resultado = await query(
      `SELECT origem, COUNT(*)::int AS total FROM lista_espera
       GROUP BY origem ORDER BY total DESC, origem ASC`
    );
    return resultado.rows;
  },

  async agregarValidacao() {
    const where = '1=1';
    const params = [];

    const [
      total,
      wizardCompleto,
      ultimos7,
      betaRows,
      perdeuRows,
      tipoPetRows,
      metodosRows,
      prioridadesRows,
      topCidades,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS c FROM lista_espera`, params),
      query(`SELECT COUNT(*)::int AS c FROM lista_espera WHERE wizard_completo = true`, params),
      query(
        `SELECT COUNT(*)::int AS c FROM lista_espera WHERE criado_em >= NOW() - INTERVAL '7 days'`,
        params
      ),
      query(
        `SELECT COALESCE(respostas->>'beta_interesse', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM lista_espera GROUP BY 1 ORDER BY c DESC`
      ),
      query(
        `SELECT COALESCE(respostas->>'ja_perdeu_pet', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM lista_espera GROUP BY 1 ORDER BY c DESC`
      ),
      query(
        `SELECT COALESCE(respostas->>'tipo_pet', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM lista_espera GROUP BY 1 ORDER BY c DESC`
      ),
      query(
        `SELECT elem AS k, COUNT(*)::int AS c
         FROM lista_espera,
              jsonb_array_elements_text(COALESCE(respostas->'metodos_busca', '[]'::jsonb)) AS elem
         GROUP BY 1 ORDER BY c DESC`
      ),
      query(
        `SELECT elem AS k, COUNT(*)::int AS c
         FROM lista_espera,
              jsonb_array_elements_text(COALESCE(respostas->'prioridades', '[]'::jsonb)) AS elem
         GROUP BY 1 ORDER BY c DESC`
      ),
      query(
        `SELECT COALESCE(cidade, '?') || COALESCE('/' || NULLIF(estado, ''), '') AS k, COUNT(*)::int AS c
         FROM lista_espera WHERE cidade IS NOT NULL AND cidade <> ''
         GROUP BY 1 ORDER BY c DESC LIMIT 8`
      ),
    ]);

    const prioridades = prioridadesRows.rows || [];
    const totalPrioridade = prioridades.reduce((s, r) => s + r.c, 0) || 1;

    function pctPrioridade(key) {
      const row = prioridades.find((r) => r.k === key);
      return row ? Math.round((row.c / totalPrioridade) * 100) : 0;
    }

    const betaSim = (betaRows.rows || []).find((r) => r.k === 'sim');
    const totalBeta = (betaRows.rows || []).reduce((s, r) => s + r.c, 0) || 1;

    return {
      total: total.rows[0]?.c ?? 0,
      wizardCompleto: wizardCompleto.rows[0]?.c ?? 0,
      ultimos7: ultimos7.rows[0]?.c ?? 0,
      betaPctSim: betaSim ? Math.round((betaSim.c / totalBeta) * 100) : 0,
      perdeuPet: perdeuRows.rows || [],
      tipoPet: tipoPetRows.rows || [],
      metodosBusca: metodosRows.rows || [],
      prioridades,
      pctIdentificacao: pctPrioridade('identificar_dono'),
      pctContato: pctPrioridade('contato_tutor'),
      pctLocalizacao: pctPrioridade('ultima_localizacao'),
      topCidades: topCidades.rows || [],
      betaInteresse: betaRows.rows || [],
    };
  },
};

module.exports = ListaEspera;
