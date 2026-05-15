/**
 * ValidacaoInteresse.js — Leads da landing /proteger-meu-pet
 */

const { query } = require('../config/database');

const ORIGEM_PADRAO = 'proteger-meu-pet';
const PAGE_SIZE = 50;

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizarOrigem(origem) {
  const o = String(origem || ORIGEM_PADRAO).trim().slice(0, 64);
  return o || ORIGEM_PADRAO;
}

function sanitizarRespostas(respostas) {
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) {
    return {};
  }
  return respostas;
}

const ValidacaoInteresse = {
  ORIGEM_PADRAO,
  PAGE_SIZE,

  async buscarPorEmail(email, origem = ORIGEM_PADRAO) {
    const resultado = await query(
      `SELECT * FROM validacao_interesse
       WHERE LOWER(email) = $1 AND origem = $2 LIMIT 1`,
      [normalizarEmail(email), normalizarOrigem(origem)]
    );
    return resultado.rows[0] || null;
  },

  async inscrever(dados) {
    const {
      email,
      origem,
      nome,
      telefone,
      cidade,
      estado,
      respostas,
      user_agent,
      ip_hash,
      wizard_completo,
    } = dados;

    const emailNorm = normalizarEmail(email);
    const origemNorm = normalizarOrigem(origem);
    const respostasJson = JSON.stringify(sanitizarRespostas(respostas));
    const estadoNorm = estado ? String(estado).trim().toUpperCase().slice(0, 2) : null;
    const completo = wizard_completo === true || wizard_completo === 'true';

    const resultado = await query(
      `INSERT INTO validacao_interesse (
         email, origem, nome, telefone, cidade, estado,
         respostas_json, user_agent, ip_hash, wizard_completo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
       ON CONFLICT (email, origem) DO UPDATE SET
         nome = COALESCE(EXCLUDED.nome, validacao_interesse.nome),
         telefone = COALESCE(EXCLUDED.telefone, validacao_interesse.telefone),
         cidade = COALESCE(EXCLUDED.cidade, validacao_interesse.cidade),
         estado = COALESCE(EXCLUDED.estado, validacao_interesse.estado),
         respostas_json = CASE
           WHEN EXCLUDED.wizard_completo THEN EXCLUDED.respostas_json
           ELSE validacao_interesse.respostas_json
         END,
         wizard_completo = validacao_interesse.wizard_completo OR EXCLUDED.wizard_completo,
         user_agent = COALESCE(EXCLUDED.user_agent, validacao_interesse.user_agent)
       RETURNING *`,
      [
        emailNorm,
        origemNorm,
        nome ? String(nome).trim().slice(0, 120) : null,
        telefone ? String(telefone).trim().slice(0, 30) : null,
        cidade ? String(cidade).trim().slice(0, 80) : null,
        estadoNorm,
        respostasJson,
        user_agent || null,
        ip_hash || null,
        completo,
      ]
    );

    const row = resultado.rows[0];
    return { registro: row };
  },

  async listar({ origem, limite = PAGE_SIZE, offset = 0, buscaEmail, wizardCompleto } = {}) {
    const params = [];
    const where = [];

    if (origem) {
      params.push(normalizarOrigem(origem));
      where.push(`origem = $${params.length}`);
    }
    if (buscaEmail) {
      params.push(`%${normalizarEmail(buscaEmail)}%`);
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(nome) LIKE $${params.length})`);
    }
    if (wizardCompleto === true || wizardCompleto === 'true') {
      where.push('wizard_completo = true');
    } else if (wizardCompleto === false || wizardCompleto === 'false') {
      where.push('wizard_completo = false');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limite, offset);
    const limiteIdx = params.length - 1;
    const offsetIdx = params.length;

    const resultado = await query(
      `SELECT id, email, origem, nome, telefone, cidade, estado,
              respostas_json, wizard_completo, user_agent, data_criacao
       FROM validacao_interesse
       ${whereSql}
       ORDER BY data_criacao DESC
       LIMIT $${limiteIdx} OFFSET $${offsetIdx}`,
      params
    );

    return resultado.rows.map((row) => ({
      ...row,
      respostas_json:
        typeof row.respostas_json === 'string'
          ? JSON.parse(row.respostas_json || '{}')
          : row.respostas_json || {},
    }));
  },

  async listarParaExport(filtros = {}) {
    return this.listar({ ...filtros, limite: 10000, offset: 0 });
  },

  async contar(filtros = {}) {
    const params = [];
    const where = [];

    if (filtros.origem) {
      params.push(normalizarOrigem(filtros.origem));
      where.push(`origem = $${params.length}`);
    }
    if (filtros.buscaEmail) {
      params.push(`%${normalizarEmail(filtros.buscaEmail)}%`);
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(nome) LIKE $${params.length})`);
    }
    if (filtros.wizardCompleto === true || filtros.wizardCompleto === 'true') {
      where.push('wizard_completo = true');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM validacao_interesse ${whereSql}`,
      params
    );

    return resultado.rows[0]?.total ?? 0;
  },

  async contarUltimosDias(dias = 7, { origem } = {}) {
    const params = [Math.max(1, parseInt(dias, 10) || 7)];
    let where = `data_criacao >= NOW() - ($1::int * INTERVAL '1 day')`;

    if (origem) {
      params.push(normalizarOrigem(origem));
      where += ` AND origem = $${params.length}`;
    }

    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM validacao_interesse WHERE ${where}`,
      params
    );

    return resultado.rows[0]?.total ?? 0;
  },

  async contarWizardCompleto({ origem } = {}) {
    const params = [];
    let where = 'wizard_completo = true';
    if (origem) {
      params.push(normalizarOrigem(origem));
      where += ` AND origem = $${params.length}`;
    }
    const resultado = await query(
      `SELECT COUNT(*)::int AS total FROM validacao_interesse WHERE ${where}`,
      params
    );
    return resultado.rows[0]?.total ?? 0;
  },

  async listarOrigens() {
    const resultado = await query(
      `SELECT origem, COUNT(*)::int AS total
       FROM validacao_interesse
       GROUP BY origem
       ORDER BY total DESC, origem ASC`
    );
    return resultado.rows;
  },

  /**
   * Agregações para dashboard admin (JSONB + colunas).
   */
  async agregarValidacao({ origem } = {}) {
    const params = [];
    let where = '1=1';
    if (origem) {
      params.push(normalizarOrigem(origem));
      where = `origem = $${params.length}`;
    }

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
      query(`SELECT COUNT(*)::int AS c FROM validacao_interesse WHERE ${where}`, params),
      query(`SELECT COUNT(*)::int AS c FROM validacao_interesse WHERE ${where} AND wizard_completo = true`, params),
      query(
        `SELECT COUNT(*)::int AS c FROM validacao_interesse WHERE ${where} AND data_criacao >= NOW() - INTERVAL '7 days'`,
        params
      ),
      query(
        `SELECT COALESCE(respostas_json->>'beta_interesse', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM validacao_interesse WHERE ${where}
         GROUP BY 1 ORDER BY c DESC`,
        params
      ),
      query(
        `SELECT COALESCE(respostas_json->>'ja_perdeu_pet', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM validacao_interesse WHERE ${where}
         GROUP BY 1 ORDER BY c DESC`,
        params
      ),
      query(
        `SELECT COALESCE(respostas_json->>'tipo_pet', 'nao_informado') AS k, COUNT(*)::int AS c
         FROM validacao_interesse WHERE ${where}
         GROUP BY 1 ORDER BY c DESC`,
        params
      ),
      query(
        `SELECT elem AS k, COUNT(*)::int AS c
         FROM validacao_interesse,
              jsonb_array_elements_text(COALESCE(respostas_json->'metodos_busca', '[]'::jsonb)) AS elem
         WHERE ${where}
         GROUP BY 1 ORDER BY c DESC`,
        params
      ),
      query(
        `SELECT elem AS k, COUNT(*)::int AS c
         FROM validacao_interesse,
              jsonb_array_elements_text(COALESCE(respostas_json->'prioridades', '[]'::jsonb)) AS elem
         WHERE ${where}
         GROUP BY 1 ORDER BY c DESC`,
        params
      ),
      query(
        `SELECT COALESCE(cidade, '?') || COALESCE('/' || NULLIF(estado, ''), '') AS k, COUNT(*)::int AS c
         FROM validacao_interesse WHERE ${where} AND cidade IS NOT NULL AND cidade <> ''
         GROUP BY 1 ORDER BY c DESC LIMIT 8`,
        params
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

module.exports = ValidacaoInteresse;
