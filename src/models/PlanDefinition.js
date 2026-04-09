const { query } = require('../config/database');
const logger = require('../utils/logger');

const PlanDefinition = {
  async listarAtivos() {
    try {
      const r = await query(
        `SELECT *,
                COALESCE(nome, nome_exibicao) AS nome_plano,
                COALESCE(preco, mensalidade_centavos) AS preco_centavos,
                COALESCE(beneficios, '[]'::jsonb) AS beneficios_json
         FROM plan_definitions
         WHERE ativo = true
         ORDER BY ordem ASC, id ASC`
      );
      return r.rows;
    } catch (err) {
      // Fallback seguro: em ambiente sem migration do módulo TAG, usar planos padrão em memória.
      if (err && err.code === '42P01') {
        logger.warn('PlanDefinition', 'Tabela plan_definitions não existe. Usando fallback de configuração.');
        return [];
      }
      throw err;
    }
  },

  async buscarPorSlug(slug) {
    const r = await query(
      `SELECT * FROM plan_definitions WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    return r.rows[0] || null;
  },
};

module.exports = PlanDefinition;
