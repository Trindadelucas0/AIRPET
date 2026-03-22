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

const { query, pool } = require('../config/database');

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
  async criar(dados, client = null) {
    const { nome, email, senha_hash, telefone, role, bio, endereco, bairro, cidade, estado, cep } = dados;
    const executor = client || pool;

    const resultado = await executor.query(
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
  async atualizarSenhaHash(userId, senhaHash) {
    await query(
      'UPDATE usuarios SET senha_hash = $1, data_atualizacao = NOW() WHERE id = $2',
      [senhaHash, userId]
    );
  },

  async anularReferenciasAntesExcluir(id) {
    await query('UPDATE tag_batches SET criado_por = NULL WHERE criado_por = $1', [id]);
    await query('UPDATE nfc_tags SET user_id = NULL WHERE user_id = $1', [id]);
    await query('UPDATE conversas SET dono_id = NULL WHERE dono_id = $1', [id]);
    await query('UPDATE conversas SET tutor_id = NULL WHERE tutor_id = $1', [id]);
    await query('UPDATE conversas SET iniciador_id = NULL WHERE iniciador_id = $1', [id]);
    await query('UPDATE mensagens_chat SET moderado_por = NULL WHERE moderado_por = $1', [id]);
    await query('UPDATE agenda_petshop SET usuario_id = NULL WHERE usuario_id = $1', [id]);
    await query('UPDATE pontos_mapa SET criado_por = NULL WHERE criado_por = $1', [id]);
    await query('UPDATE diario_pet SET usuario_id = NULL WHERE usuario_id = $1', [id]);
  },

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

  async buscarPorNomeParcialParaAdmin(termo, limite = 20) {
    const resultado = await query(
      `SELECT id, nome, foto_perfil, cidade, estado
       FROM usuarios
       WHERE LOWER(nome) LIKE $1
       ORDER BY nome
       LIMIT $2`,
      [`%${String(termo).toLowerCase()}%`, limite]
    );
    return resultado.rows;
  },

  async buscarContatoBasicoPorId(id) {
    const r = await query(
      'SELECT id, nome, telefone, email FROM usuarios WHERE id = $1',
      [id]
    );
    return r.rows[0] || null;
  },

  async listarIdsDentroRaioMetros(lat, lng, raioMetros) {
    const r = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
               $3
             )`,
      [lat, lng, raioMetros]
    );
    return r.rows.map((row) => row.id);
  },

  async listarIdsParaAlertaPerdidoProximos(lat, lng, raioMetros, excluirUsuarioId) {
    const r = await query(
      `SELECT id
       FROM usuarios
       WHERE ultima_localizacao IS NOT NULL
         AND id != $1
         AND (receber_alertas_pet_perdido IS NULL OR receber_alertas_pet_perdido = true)
         AND ST_DWithin(
               ultima_localizacao,
               ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
               $4
             )`,
      [excluirUsuarioId, lat, lng, raioMetros]
    );
    return r.rows.map((row) => row.id);
  },

  async listarIdsRecebendoAlertasPerdidoExceto(excluirUsuarioId) {
    const r = await query(
      `SELECT id FROM usuarios
       WHERE id != $1
         AND (receber_alertas_pet_perdido IS NULL OR receber_alertas_pet_perdido = true)`,
      [excluirUsuarioId]
    );
    return r.rows.map((row) => row.id);
  },

  async listarIdsPorCidadeEstadoPairs(cidades) {
    if (!Array.isArray(cidades) || cidades.length === 0) return [];
    const condicoes = cidades.map((_, i) => `(cidade = $${2 * i + 1} AND estado = $${2 * i + 2})`).join(' OR ');
    const valores = cidades.flatMap((c) => [String(c.cidade).trim(), String(c.estado).trim()]);
    const r = await query(`SELECT id FROM usuarios WHERE (${condicoes})`, valores);
    return r.rows.map((row) => row.id);
  },

  async listarIdsPorFiltrosPerfilRegiao(filtros = {}) {
    const condicoes = [];
    const valores = [];
    function adicionarIgual(coluna, valor) {
      if (!valor || !String(valor).trim()) return;
      valores.push(String(valor).trim());
      condicoes.push(`LOWER(TRIM(${coluna})) = LOWER(TRIM($${valores.length}))`);
    }
    adicionarIgual('estado', filtros.estado);
    adicionarIgual('cidade', filtros.cidade);
    adicionarIgual('bairro', filtros.bairro);
    adicionarIgual('cep', filtros.cep);
    if (filtros.endereco && String(filtros.endereco).trim()) {
      valores.push(`%${String(filtros.endereco).trim()}%`);
      condicoes.push(`endereco ILIKE $${valores.length}`);
    }
    if (!condicoes.length) return [];
    const r = await query(
      `SELECT id FROM usuarios WHERE ${condicoes.join(' AND ')}`,
      valores
    );
    return r.rows.map((row) => row.id);
  },

  async listarRecomendadosProximosGeo(usuarioId, limiteMetros, max) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
              ROUND(ST_Distance(u.ultima_localizacao, eu.ultima_localizacao)::numeric / 1000, 1) AS distancia_km,
              (SELECT COUNT(*)::int FROM publicacoes WHERE usuario_id = u.id) AS total_posts,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores
       FROM usuarios u
       CROSS JOIN usuarios eu
       WHERE eu.id = $1
         AND u.id != $1
         AND u.ultima_localizacao IS NOT NULL
         AND eu.ultima_localizacao IS NOT NULL
         AND ST_DWithin(u.ultima_localizacao, eu.ultima_localizacao, $2)
         AND u.id NOT IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
       ORDER BY ST_Distance(u.ultima_localizacao, eu.ultima_localizacao) ASC
       LIMIT $3`,
      [usuarioId, limiteMetros, max]
    );
    return resultado.rows;
  },

  async buscarBasicoPorNomeLike(patternLower, limite = 10) {
    const resultado = await query(
      `SELECT id, nome, cor_perfil, foto_perfil FROM usuarios WHERE LOWER(nome) LIKE $1 ORDER BY nome LIMIT $2`,
      [patternLower, limite]
    );
    return resultado.rows;
  },

  async buscarParaPaginaBuscaExplorar(patternLower, viewerId, limite = 20) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguidor_id = $2 AND seguido_id = u.id) > 0 AS seguindo
       FROM usuarios u WHERE LOWER(u.nome) LIKE $1 ORDER BY u.nome LIMIT $3`,
      [patternLower, viewerId, limite]
    );
    return resultado.rows;
  },

  async buscarParaMencaoAutocomplete(patternLower, viewerId, limite = 10) {
    const params = [`%${patternLower}%`];
    let whereExtra = '';
    if (viewerId) {
      params.push(viewerId);
      whereExtra = ' OR u.id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $2) ';
    }
    params.push(limite);
    const resultado = await query(
      `SELECT u.id, u.nome, u.foto_perfil, u.cor_perfil
         FROM usuarios u
        WHERE LOWER(u.nome) LIKE $1 ${whereExtra}
        ORDER BY u.nome
        LIMIT $${params.length}`,
      params
    );
    return resultado.rows;
  },

  async listarRecomendadosMesmaCidade(usuarioId, max) {
    const resultado = await query(
      `SELECT u.id, u.nome, u.cor_perfil, u.foto_perfil, u.bio, u.cidade, u.bairro,
              (SELECT COUNT(*)::int FROM publicacoes WHERE usuario_id = u.id) AS total_posts,
              (SELECT COUNT(*)::int FROM seguidores WHERE seguido_id = u.id) AS total_seguidores
       FROM usuarios u
       WHERE u.id != $1
         AND u.cidade IS NOT NULL
         AND LOWER(u.cidade) = LOWER((SELECT cidade FROM usuarios WHERE id = $1))
         AND u.id NOT IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = $1)
       ORDER BY
         CASE WHEN LOWER(u.bairro) = LOWER((SELECT bairro FROM usuarios WHERE id = $1)) THEN 0 ELSE 1 END,
         (SELECT COUNT(*) FROM seguidores WHERE seguido_id = u.id) DESC
       LIMIT $2`,
      [usuarioId, max]
    );
    return resultado.rows;
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
    const colunasPermitidas = ['nome', 'telefone', 'cor_perfil', 'bio', 'endereco', 'bairro', 'cidade', 'estado', 'cep', 'data_nascimento', 'contato_extra', 'foto_perfil', 'foto_capa', 'receber_alertas_pet_perdido'];
    const setPartes = [];
    const params = [id];
    let idx = 2;
    colunasPermitidas.forEach((col) => {
      if (!Object.prototype.hasOwnProperty.call(dados, col)) return;
      setPartes.push(`${col} = $${idx}`);
      if (col === 'cor_perfil') params.push(dados[col] || '#ec5a1c');
      else if (col === 'receber_alertas_pet_perdido') params.push(dados[col] === true || dados[col] === 'true' || dados[col] === 1);
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
