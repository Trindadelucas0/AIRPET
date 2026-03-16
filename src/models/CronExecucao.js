/**
 * CronExecucao.js — Modelo para a tabela "cron_execucoes"
 *
 * Registra cada execução de jobs agendados (ex.: escalação de alertas)
 * para auditoria e exibição no hub de alertas do admin.
 */

const { query } = require('../config/database');

const JOB_ESCALAR_ALERTAS = 'escalar_alertas';

const CronExecucao = {

  /**
   * Cria um novo registro de execução (job iniciado).
   * @param {string} job - Nome do job (ex.: 'escalar_alertas')
   * @returns {Promise<object>} Registro criado com id
   */
  async criar(job) {
    const resultado = await query(
      `INSERT INTO cron_execucoes (job, status)
       VALUES ($1, 'em_andamento')
       RETURNING *`,
      [job]
    );
    return resultado.rows[0];
  },

  /**
   * Finaliza um registro de execução com status e métricas.
   * @param {number} id - ID do registro
   * @param {string} status - 'ok' ou 'erro'
   * @param {object} [metricas] - { alertas_escalados, notificacoes_enviadas }
   * @param {string} [erro] - Mensagem de erro se status === 'erro'
   */
  async finalizar(id, status, metricas = {}, erro = null) {
    const { alertas_escalados = 0, notificacoes_enviadas = 0 } = metricas;
    await query(
      `UPDATE cron_execucoes
       SET finalizado_em = NOW(),
           status = $2,
           alertas_escalados = $3,
           notificacoes_enviadas = $4,
           erro = $5
       WHERE id = $1`,
      [id, status, alertas_escalados, notificacoes_enviadas, erro]
    );
  },

  /**
   * Lista as últimas execuções de um job para o hub do admin.
   * @param {string} job - Nome do job
   * @param {number} limite - Quantidade de registros
   * @returns {Promise<Array>}
   */
  async listarRecentes(job, limite = 10) {
    const resultado = await query(
      `SELECT id, job, iniciado_em, finalizado_em, status,
              alertas_escalados, notificacoes_enviadas, erro
       FROM cron_execucoes
       WHERE job = $1
       ORDER BY iniciado_em DESC
       LIMIT $2`,
      [job, limite]
    );
    return resultado.rows;
  },

  /**
   * Retorna a última execução finalizada do job (para exibir próxima execução).
   * @param {string} job
   * @returns {Promise<object|null>}
   */
  async buscarUltima(job) {
    const resultado = await query(
      `SELECT id, iniciado_em, finalizado_em, status
       FROM cron_execucoes
       WHERE job = $1 AND finalizado_em IS NOT NULL
       ORDER BY finalizado_em DESC
       LIMIT 1`,
      [job]
    );
    return resultado.rows[0] || null;
  },
};

CronExecucao.JOB_ESCALAR_ALERTAS = JOB_ESCALAR_ALERTAS;
module.exports = CronExecucao;
