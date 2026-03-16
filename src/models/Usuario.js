/**
 * Usuario.js — Modelo de dados para a tabela "usuarios"
 *
 * Este módulo encapsula todas as operações de banco de dados
 * relacionadas aos usuários do sistema AIRPET.
 * Cada método utiliza queries parametrizadas ($1, $2...)
 * para prevenir ataques de SQL Injection.
 *
 * Tabela: usuarios
 * Campos principais: id, nome, email, senha_hash, telefone, role,
 *                    ultima_lat, ultima_lng, ultima_localizacao,
 *                    data_criacao, data_atualizacao
 */

const { query } = require('../config/database');

const Usuario = {

  /**
   * Cria um novo usuário no banco de dados.
   *
   * @param {object} dados - Objeto com os dados do novo usuário
   * @param {string} dados.nome - Nome completo do usuário
   * @param {string} dados.email - E-mail (deve ser único na tabela)
   * @param {string} dados.senha_hash - Senha já criptografada com bcrypt
   * @param {string} dados.telefone - Telefone de contato
   * @param {string} dados.role - Papel do usuário ('tutor' ou 'admin')
   * @returns {Promise<object>} O registro do usuário recém-criado
   */
  async criar(dados) {
    const { nome, email, senha_hash, telefone, role, bio, endereco, bairro, cidade, estado, cep } = dados;

    const resultado = await query(
      `INSERT INTO usuarios (nome, email, senha_hash, telefone, role, bio, endereco, bairro, cidade, estado, cep)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [nome, email, senha_hash, telefone || null, role || 'tutor', bio || null, endereco || null, bairro || null, cidade || null, estado || null, cep || null]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um usuário pelo endereço de e-mail.
   * Usado principalmente no fluxo de login/autenticação.
   *
   * @param {string} email - E-mail a ser pesquisado
   * @returns {Promise<object|undefined>} O usuário encontrado ou undefined
   */
  async buscarPorEmail(email) {
    const resultado = await query(
      `SELECT * FROM usuarios WHERE email = $1`,
      [email]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um usuário pelo seu ID (chave primária UUID).
   *
   * @param {string} id - UUID do usuário
   * @returns {Promise<object|undefined>} O usuário encontrado ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT * FROM usuarios WHERE id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Lista todos os usuários cadastrados no sistema.
   * Ordena do mais recente para o mais antigo (data_criacao DESC).
   *
   * @returns {Promise<Array>} Lista de todos os usuários
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT * FROM usuarios ORDER BY data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Lista os usuários mais recentes (para dashboard admin).
   * @param {number} [limite=10]
   * @returns {Promise<Array>}
   */
  async listarRecentes(limite = 10) {
    const resultado = await query(
      `SELECT id, nome, email, cidade, estado, data_criacao, bloqueado, role
       FROM usuarios
       ORDER BY data_criacao DESC
       LIMIT $1`,
      [limite]
    );
    return resultado.rows;
  },

  /**
   * Contagem de usuários por estado (região). Para dashboard e filtros.
   * @returns {Promise<Array<{estado: string, total: string}>>}
   */
  async contarPorEstado() {
    const resultado = await query(
      `SELECT estado, COUNT(*) AS total
       FROM usuarios
       WHERE estado IS NOT NULL AND TRIM(estado) <> ''
       GROUP BY estado
       ORDER BY total DESC`
    );
    return resultado.rows;
  },

  /**
   * Lista usuários com filtros opcionais (estado, cidade, status bloqueado).
   * @param {object} [filtros]
   * @param {string} [filtros.estado]
   * @param {string} [filtros.cidade]
   * @param {boolean} [filtros.bloqueado] - true só bloqueados, false só ativos, undefined todos
   * @returns {Promise<Array>}
   */
  async listarComFiltros(filtros = {}) {
    const condicoes = [];
    const valores = [];
    let idx = 1;
    if (filtros.estado) {
      condicoes.push(`estado = $${idx}`);
      valores.push(filtros.estado);
      idx++;
    }
    if (filtros.cidade) {
      condicoes.push(`cidade ILIKE $${idx}`);
      valores.push(`%${filtros.cidade}%`);
      idx++;
    }
    if (typeof filtros.bloqueado === 'boolean') {
      condicoes.push(`bloqueado = $${idx}`);
      valores.push(filtros.bloqueado);
      idx++;
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const resultado = await query(
      `SELECT * FROM usuarios ${where} ORDER BY data_criacao DESC`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Lista estados distintos com pelo menos um usuário (para dropdown de filtro).
   * @returns {Promise<Array<string>>}
   */
  async listarEstados() {
    const resultado = await query(
      `SELECT DISTINCT estado FROM usuarios WHERE estado IS NOT NULL AND TRIM(estado) <> '' ORDER BY estado`
    );
    return resultado.rows.map(r => r.estado);
  },

  /**
   * Lista estados com contagem de usuários que possuem região cadastrada.
   * @returns {Promise<Array<{estado: string, total: string}>>}
   */
  async listarEstadosComContagem() {
    const resultado = await query(
      `SELECT estado, COUNT(*) AS total
       FROM usuarios
       WHERE estado IS NOT NULL AND TRIM(estado) <> ''
       GROUP BY estado
       ORDER BY estado`
    );
    return resultado.rows;
  },

  /**
   * Lista cidades com contagem, opcionalmente filtradas por estado.
   * @param {string} [estado]
   * @returns {Promise<Array<{cidade: string, estado: string, total: string}>>}
   */
  async listarCidadesPorEstadoComContagem(estado) {
    const valores = [];
    const where = [`cidade IS NOT NULL`, `TRIM(cidade) <> ''`, `estado IS NOT NULL`, `TRIM(estado) <> ''`];

    if (estado && String(estado).trim()) {
      valores.push(String(estado).trim());
      where.push(`estado = $${valores.length}`);
    }

    const resultado = await query(
      `SELECT cidade, estado, COUNT(*) AS total
       FROM usuarios
       WHERE ${where.join(' AND ')}
       GROUP BY cidade, estado
       ORDER BY estado, cidade`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Lista bairros com contagem, opcionalmente filtrados por estado e cidade.
   * @param {string} [estado]
   * @param {string} [cidade]
   * @returns {Promise<Array<{bairro: string, cidade: string, estado: string, total: string}>>}
   */
  async listarBairrosPorCidadeEstadoComContagem(estado, cidade) {
    const valores = [];
    const where = [
      `bairro IS NOT NULL`,
      `TRIM(bairro) <> ''`,
      `cidade IS NOT NULL`,
      `TRIM(cidade) <> ''`,
      `estado IS NOT NULL`,
      `TRIM(estado) <> ''`,
    ];

    if (estado && String(estado).trim()) {
      valores.push(String(estado).trim());
      where.push(`estado = $${valores.length}`);
    }
    if (cidade && String(cidade).trim()) {
      valores.push(String(cidade).trim());
      where.push(`cidade = $${valores.length}`);
    }

    const resultado = await query(
      `SELECT bairro, cidade, estado, COUNT(*) AS total
       FROM usuarios
       WHERE ${where.join(' AND ')}
       GROUP BY bairro, cidade, estado
       ORDER BY estado, cidade, bairro`,
      valores
    );
    return resultado.rows;
  },

  /**
   * Lista cidades e estados com contagem de usuários que têm região cadastrada (para notificação por cidade).
   * Inclui todos com cidade/estado preenchidos, independente de ter GPS (ultima_localizacao).
   * @returns {Promise<Array<{cidade: string, estado: string, total: string}>>}
   */
  async listarCidadesComContagem() {
    const resultado = await query(
      `SELECT cidade, estado, COUNT(*) AS total
       FROM usuarios
       WHERE cidade IS NOT NULL AND TRIM(cidade) <> ''
         AND estado IS NOT NULL AND TRIM(estado) <> ''
       GROUP BY cidade, estado
       ORDER BY estado, cidade`
    );
    return resultado.rows;
  },

  /**
   * Atualiza a localização geográfica de um usuário.
   * Utiliza PostGIS para armazenar o ponto geográfico (SRID 4326 = WGS84).
   * Isso permite consultas espaciais como "encontrar usuários próximos".
   *
   * @param {string} id - UUID do usuário
   * @param {number} lat - Latitude (ex: -23.5505)
   * @param {number} lng - Longitude (ex: -46.6333)
   * @returns {Promise<object>} O registro atualizado do usuário
   */
  async atualizarLocalizacao(id, lat, lng) {
    const resultado = await query(
      `UPDATE usuarios
       SET ultima_lat = $2,
           ultima_lng = $3,
           ultima_localizacao = ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, lat, lng]
    );

    return resultado.rows[0];
  },

  /**
   * Conta o número total de usuários cadastrados.
   * Útil para o painel administrativo (dashboard).
   *
   * @returns {Promise<number>} Total de usuários
   */
  async contarTotal() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM usuarios`
    );

    return parseInt(resultado.rows[0].total, 10);
  },

  /**
   * Atualiza os dados básicos de um usuário (nome, email, telefone).
   * Não altera a senha nem o papel — esses têm métodos específicos.
   *
   * @param {string} id - UUID do usuário
   * @param {object} dados - Campos a serem atualizados
   * @param {string} dados.nome - Novo nome
   * @param {string} dados.email - Novo e-mail
   * @param {string} dados.telefone - Novo telefone
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizar(id, dados) {
    const { nome, email, telefone } = dados;

    const resultado = await query(
      `UPDATE usuarios
       SET nome = $2,
           email = $3,
           telefone = $4,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, email, telefone]
    );

    return resultado.rows[0];
  },

  /**
   * Remove permanentemente um usuário do banco de dados.
   * ATENÇÃO: esta operação é irreversível. Considerar soft delete no futuro.
   *
   * @param {string} id - UUID do usuário a ser removido
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  /**
   * Atualização parcial do perfil: apenas os campos presentes em `dados` são atualizados.
   * @param {string} id - UUID do usuário
   * @param {object} dados - Subconjunto de campos: nome, telefone, cor_perfil, bio, endereco, bairro, cidade, estado, cep, data_nascimento, contato_extra, foto_perfil, foto_capa
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizarPerfil(id, dados) {
    dados = dados && typeof dados === 'object' ? dados : {};
    const colunasPermitidas = ['nome', 'telefone', 'cor_perfil', 'bio', 'endereco', 'bairro', 'cidade', 'estado', 'cep', 'data_nascimento', 'contato_extra', 'foto_perfil', 'foto_capa'];
    const setPartes = [];
    const params = [id];
    let idx = 2;
    colunasPermitidas.forEach((col) => {
      if (!Object.prototype.hasOwnProperty.call(dados, col)) return;
      setPartes.push(`${col} = $${idx}`);
      if (col === 'cor_perfil') params.push(dados[col] || '#ec5a1c');
      else if (col === 'data_nascimento' || col === 'contato_extra' || col === 'bio' || col === 'endereco' || col === 'bairro' || col === 'cidade' || col === 'estado' || col === 'cep') params.push(dados[col] || null);
      else params.push(dados[col]);
      idx++;
    });
    if (setPartes.length === 0) {
      const resultado = await query(`SELECT * FROM usuarios WHERE id = $1`, [id]);
      return resultado.rows[0];
    }
    setPartes.push('data_atualizacao = NOW()');
    const sql = `UPDATE usuarios SET ${setPartes.join(', ')} WHERE id = $1 RETURNING *`;
    const resultado = await query(sql, params);
    return resultado.rows[0];
  },

  async atualizarRole(id, role) {
    const resultado = await query(
      `UPDATE usuarios SET role = $2, data_atualizacao = NOW() WHERE id = $1 RETURNING *`,
      [id, role]
    );
    return resultado.rows[0];
  },

  async atualizarBloqueado(id, bloqueado) {
    const resultado = await query(
      `UPDATE usuarios SET bloqueado = $2, data_atualizacao = NOW() WHERE id = $1 RETURNING *`,
      [id, !!bloqueado]
    );
    return resultado.rows[0];
  },

  async deletar(id) {
    const resultado = await query(
      `DELETE FROM usuarios WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },
};

module.exports = Usuario;
