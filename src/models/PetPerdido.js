/**
 * PetPerdido.js — Modelo de dados para a tabela "pets_perdidos"
 *
 * Este módulo gerencia os alertas de pets perdidos.
 * Quando um tutor reporta seu pet como perdido, um registro é
 * criado aqui com informações de localização e status do alerta.
 *
 * Ciclo de vida do alerta:
 *   pendente → aprovado → resolvido
 *
 * Tabela: pets_perdidos
 * Campos principais: id, pet_id, usuario_id, descricao,
 *                    ultima_localizacao (geography), latitude, longitude,
 *                    status, nivel_alerta, data_criacao
 */

const { query } = require('../config/database');

const PetPerdido = {

  /**
   * Cria um novo alerta de pet perdido.
   * A localização é armazenada como geography (PostGIS)
   * para possibilitar buscas espaciais.
   *
   * @param {object} dados - Dados do alerta
   * @param {string} dados.pet_id - UUID do pet perdido
   * @param {string} dados.usuario_id - UUID do tutor que reportou
   * @param {string} dados.descricao - Descrição das circunstâncias
   * @param {number} dados.latitude - Latitude da última localização conhecida
   * @param {number} dados.longitude - Longitude da última localização conhecida
   * @returns {Promise<object>} O registro do alerta criado
   */
  async criar(dados) {
    const { pet_id, descricao, latitude, longitude, cidade, recompensa } = dados;

    const hasCoords = latitude !== null && latitude !== undefined &&
                      longitude !== null && longitude !== undefined;

    const sql = hasCoords
      ? `INSERT INTO pets_perdidos
          (pet_id, descricao, ultima_lat, ultima_lng, ultima_localizacao, cidade, recompensa)
         VALUES ($1, $2, $3::numeric, $4::numeric,
                 ST_SetSRID(ST_MakePoint($4::numeric, $3::numeric), 4326)::geography,
                 $5, $6)
         RETURNING *`
      : `INSERT INTO pets_perdidos
          (pet_id, descricao, cidade, recompensa)
         VALUES ($1, $2, $3, $4)
         RETURNING *`;

    const params = hasCoords
      ? [pet_id, descricao, latitude, longitude, cidade, recompensa]
      : [pet_id, descricao, cidade, recompensa];

    const resultado = await query(sql, params);
    return resultado.rows[0];
  },

  /**
   * Busca um alerta pelo ID com dados completos do pet e do dono.
   * Usa JOINs para trazer nome, foto do pet e contato do tutor.
   *
   * @param {string} id - UUID do alerta
   * @returns {Promise<object|undefined>} Alerta com dados enriquecidos
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT pp.*,
              pp.ultima_lat AS latitude,
              pp.ultima_lng AS longitude,
              p.nome AS pet_nome,
              p.tipo AS pet_tipo,
              p.raca AS pet_raca,
              p.foto AS pet_foto,
              u.nome AS dono_nome,
              u.telefone AS dono_telefone,
              u.email AS dono_email
       FROM pets_perdidos pp
       JOIN pets p ON p.id = pp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE pp.id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca alertas de pet perdido pelo ID do pet.
   * Um pet pode ter múltiplos alertas ao longo do tempo.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Alertas do pet
   */
  async buscarPorPet(petId) {
    const resultado = await query(
      `SELECT * FROM pets_perdidos
       WHERE pet_id = $1
       ORDER BY data DESC`,
      [petId]
    );

    return resultado.rows;
  },

  /**
   * Lista todos os alertas pendentes de aprovação pelo admin.
   * Estes alertas precisam ser revisados antes de se tornarem públicos.
   *
   * @returns {Promise<Array>} Alertas com status 'pendente'
   */
  async listarPendentes() {
    const resultado = await query(
      `SELECT pp.*, pp.ultima_lat AS latitude, pp.ultima_lng AS longitude,
              p.nome AS pet_nome, u.nome AS dono_nome
       FROM pets_perdidos pp
       JOIN pets p ON p.id = pp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE pp.status = 'pendente'
       ORDER BY pp.data DESC`
    );

    return resultado.rows;
  },

  /**
   * Lista alertas aprovados (ativos e visíveis no mapa público).
   *
   * @returns {Promise<Array>} Alertas aprovados
   */
  async listarAprovados() {
    const resultado = await query(
      `SELECT pp.*, pp.ultima_lat AS latitude, pp.ultima_lng AS longitude,
              p.nome AS pet_nome, p.foto AS pet_foto, u.nome AS dono_nome
       FROM pets_perdidos pp
       JOIN pets p ON p.id = pp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE pp.status = 'aprovado'
       ORDER BY pp.data DESC`
    );

    return resultado.rows;
  },

  /**
   * Lista todos os alertas (qualquer status) com dados enriquecidos.
   * Usado no painel administrativo para gestão completa.
   *
   * @returns {Promise<Array>} Todos os alertas com JOINs
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT pp.*, pp.ultima_lat AS latitude, pp.ultima_lng AS longitude,
              p.nome AS pet_nome, p.foto AS pet_foto, u.nome AS dono_nome
       FROM pets_perdidos pp
       JOIN pets p ON p.id = pp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY pp.data DESC`
    );

    return resultado.rows;
  },

  /**
   * Aprova um alerta de pet perdido.
   * Muda o status para 'aprovado' e define o nível de alerta inicial como 1.
   * A partir daqui, o alerta aparece no mapa público.
   *
   * @param {string} id - UUID do alerta
   * @returns {Promise<object>} O alerta atualizado
   */
  async aprovar(id) {
    const resultado = await query(
      `UPDATE pets_perdidos
       SET status = 'aprovado',
           nivel_alerta = 1
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Marca um alerta como resolvido (pet encontrado).
   * O alerta sai do mapa público.
   *
   * @param {string} id - UUID do alerta
   * @returns {Promise<object>} O alerta atualizado
   */
  async rejeitar(id) {
    const resultado = await query(
      `UPDATE pets_perdidos SET status = 'rejeitado' WHERE id = $1 RETURNING *`,
      [id]
    );
    return resultado.rows[0];
  },

  async resolver(id) {
    const resultado = await query(
      `UPDATE pets_perdidos
       SET status = 'resolvido'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Atualiza o nível de alerta de um pet perdido.
   * Níveis mais altos ampliam o raio de notificação para voluntários.
   *
   * @param {string} id - UUID do alerta
   * @param {number} nivel - Novo nível de alerta (1, 2 ou 3)
   * @returns {Promise<object>} O alerta atualizado
   */
  async atualizarNivel(id, nivel) {
    const resultado = await query(
      `UPDATE pets_perdidos
       SET nivel_alerta = $2
       WHERE id = $1
       RETURNING *`,
      [id, nivel]
    );

    return resultado.rows[0];
  },

  /**
   * Busca o alerta ativo (pendente ou aprovado) mais recente de um pet.
   * Usado para resolver o alerta a partir do pet_id em vez do alerta id.
   *
   * @param {number} petId - ID do pet
   * @returns {Promise<object|undefined>} Alerta ativo com dados enriquecidos
   */
  async buscarAtivoPorPet(petId) {
    const resultado = await query(
      `SELECT pp.*,
              pp.ultima_lat AS latitude,
              pp.ultima_lng AS longitude,
              p.nome AS pet_nome,
              p.foto AS pet_foto,
              p.usuario_id,
              u.nome AS dono_nome
       FROM pets_perdidos pp
       JOIN pets p ON p.id = pp.pet_id
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE pp.pet_id = $1
         AND pp.status IN ('pendente', 'aprovado')
       ORDER BY pp.data DESC
       LIMIT 1`,
      [petId]
    );

    return resultado.rows[0];
  },

  /**
   * Conta o total de alertas ativos (pendentes + aprovados).
   * Usado no dashboard para mostrar quantos pets estão perdidos.
   *
   * @returns {Promise<number>} Total de alertas ativos
   */
  async contarAtivos() {
    const resultado = await query(
      `SELECT COUNT(*) AS total
       FROM pets_perdidos
       WHERE status IN ('pendente', 'aprovado')`
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = PetPerdido;
