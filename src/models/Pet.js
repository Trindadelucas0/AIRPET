/**
 * Pet.js — Modelo de dados para a tabela "pets"
 *
 * Este módulo encapsula todas as operações de banco de dados
 * relacionadas aos pets cadastrados no sistema AIRPET.
 * Cada pet pertence a um usuário (dono/tutor).
 *
 * Tabela: pets
 * Campos principais: id, usuario_id, nome, especie, raca, cor,
 *                    porte, sexo, idade, peso, foto, descricao,
 *                    status, data_criacao, data_atualizacao
 */

const { query, pool } = require('../config/database');
const { slugify, gerarSufixoSlug, gerarSlugPet } = require('../utils/slug');

/**
 * Trecho SQL compartilhado: enriquece a linha do pet com dois flags
 * derivados, usados em todo lugar onde o avatar e exibido (cards, perfis,
 * feed) para renderizar o selo+cadeado.
 *
 *   tem_tag_ativa = existe linha em nfc_tags com status='active' para o pet.
 *   verificado    = MVP equivalente a tem_tag_ativa. Evoluir quando houver
 *                   passo de verificacao adicional (KYC, e-mail, etc.).
 */
const PET_VERIFICATION_FIELDS = `
  EXISTS (
    SELECT 1 FROM nfc_tags nt
    WHERE nt.pet_id = p.id AND nt.status = 'active'
  ) AS tem_tag_ativa,
  EXISTS (
    SELECT 1 FROM nfc_tags nt
    WHERE nt.pet_id = p.id AND nt.status = 'active'
  ) AS verificado
`;

/**
 * Tenta gerar um slug unico (no maximo `tentativas` vezes).
 * Se colidir todas as vezes, lanca — caso virtualmente impossivel
 * (sufixo de 24 bits aleatorios por tentativa).
 */
async function gerarSlugUnico(nome, executor = pool, tentativas = 6) {
  for (let i = 0; i < tentativas; i += 1) {
    const candidato = gerarSlugPet(nome);
    const ja = await executor.query(
      `SELECT 1 FROM pets WHERE slug = $1 LIMIT 1`,
      [candidato]
    );
    if (ja.rowCount === 0) return candidato;
  }
  throw new Error('Nao foi possivel gerar slug unico para o pet apos varias tentativas.');
}

const Pet = {

  /**
   * Cadastra um novo pet no sistema.
   * O campo usuario_id vincula o pet ao seu dono/tutor.
   *
   * Gera automaticamente `slug` (URL publica em /p/:slug) baseado no nome
   * com sufixo aleatorio curto. O slug permanece estavel se o nome mudar.
   *
   * @param {object} dados - Dados do pet a ser criado
   * @returns {Promise<object>} O registro do pet recem-criado
   */
  async criar(dados) {
    const {
      usuario_id, nome, tipo, tipo_custom, raca, cor,
      porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato,
      microchip, numero_pedigree, castrado, alergias_medicacoes, veterinario_nome, veterinario_telefone, observacoes,
      bio_pet, privado,
    } = dados;

    const slug = await gerarSlugUnico(nome);
    const bioPetRaw = bio_pet != null ? String(bio_pet).trim().slice(0, 160) : null;
    const bioPet = bioPetRaw === '' ? null : bioPetRaw;
    const priv = privado === true || privado === 'true' || privado === 'on' || privado === '1';

    const resultado = await query(
      `INSERT INTO pets
        (usuario_id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato,
         microchip, numero_pedigree, castrado, alergias_medicacoes, veterinario_nome, veterinario_telefone, observacoes, slug, bio_pet, privado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING *`,
      [usuario_id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, foto, descricao_emocional, telefone_contato,
        microchip || null, numero_pedigree || null, castrado ?? null, alergias_medicacoes || null, veterinario_nome || null, veterinario_telefone || null, observacoes || null, slug,
        bioPet || null, priv]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um pet pelo ID, incluindo o nome do dono via JOIN.
   * Retorna também o campo "dono_nome" para exibição na interface
   * e os flags `tem_tag_ativa` / `verificado` usados pelo selo de seguranca.
   *
   * @param {string} id - ID numerico do pet
   * @returns {Promise<object|undefined>} Pet com dados do dono ou undefined
   */
  async buscarPorId(id) {
    const resultado = await query(
      `SELECT p.*, u.nome AS dono_nome,
              ${PET_VERIFICATION_FIELDS}
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.id = $1`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Busca um pet pelo slug publico (URL /p/:slug).
   * Mesmos enriquecimentos que buscarPorId.
   */
  async buscarPorSlug(slug) {
    if (!slug) return undefined;
    const resultado = await query(
      `SELECT p.*, u.nome AS dono_nome,
              ${PET_VERIFICATION_FIELDS}
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.slug = $1`,
      [String(slug).toLowerCase()]
    );
    return resultado.rows[0];
  },

  /**
   * Garante que o pet possui slug; gera e persiste se faltar.
   * Util para pets antigos pre-migration que ainda nao tenham backfill.
   */
  async garantirSlug(petId) {
    const r = await query(`SELECT id, nome, slug FROM pets WHERE id = $1`, [petId]);
    const row = r.rows[0];
    if (!row) return null;
    if (row.slug) return row.slug;
    const slug = await gerarSlugUnico(row.nome);
    await query(`UPDATE pets SET slug = $2 WHERE id = $1`, [petId, slug]);
    return slug;
  },

  /**
   * Lista todos os pets de um determinado usuário/tutor.
   * Ordena pela data de criação do mais recente para o mais antigo.
   *
   * @param {string} usuarioId - UUID do dono/tutor
   * @returns {Promise<Array>} Lista de pets do usuário
   */
  async buscarPorUsuario(usuarioId) {
    const resultado = await query(
      `SELECT p.*,
              ${PET_VERIFICATION_FIELDS}
       FROM pets p
       WHERE p.usuario_id = $1
       ORDER BY p.data_criacao DESC`,
      [usuarioId]
    );

    return resultado.rows;
  },

  /**
   * Lista todos os pets do sistema com o nome do dono.
   * Usado no painel administrativo para visualizar todos os animais.
   *
   * @returns {Promise<Array>} Lista de todos os pets com nome do dono
   */
  async listarTodos() {
    const resultado = await query(
      `SELECT p.*, u.nome AS dono_nome,
              ${PET_VERIFICATION_FIELDS}
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       ORDER BY p.data_criacao DESC`
    );

    return resultado.rows;
  },

  /**
   * Atualiza os dados cadastrais de um pet.
   *
   * @param {string} id - UUID do pet
   * @param {object} dados - Campos a serem atualizados
   * @returns {Promise<object>} O registro atualizado do pet
   */
  async atualizar(id, dados) {
    const {
      nome, tipo, tipo_custom, raca, cor,
      porte, sexo, data_nascimento, peso, descricao_emocional, telefone_contato,
      microchip, numero_pedigree, castrado, alergias_medicacoes, veterinario_nome, veterinario_telefone, observacoes,
      bio_pet, privado,
    } = dados;

    const bioPetRaw = bio_pet != null ? String(bio_pet).trim().slice(0, 160) : null;
    const bioPet = bioPetRaw === '' ? null : bioPetRaw;
    const priv = privado === true || privado === 'true' || privado === 'on' || privado === '1';

    const resultado = await query(
      `UPDATE pets
       SET nome = $2,
           tipo = $3,
           tipo_custom = $4,
           raca = $5,
           cor = $6,
           porte = $7,
           sexo = $8,
           data_nascimento = $9,
           peso = $10,
           descricao_emocional = $11,
           telefone_contato = $12,
           microchip = $13,
           numero_pedigree = $14,
           castrado = $15,
           alergias_medicacoes = $16,
           veterinario_nome = $17,
           veterinario_telefone = $18,
           observacoes = $19,
           bio_pet = $20,
           privado = $21,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, nome, tipo, tipo_custom, raca, cor, porte, sexo, data_nascimento, peso, descricao_emocional, telefone_contato,
        microchip || null, numero_pedigree || null, castrado ?? null, alergias_medicacoes || null, veterinario_nome || null, veterinario_telefone || null, observacoes || null,
        bioPet, priv]
    );

    return resultado.rows[0];
  },

  /**
   * Atualiza apenas o status do pet.
   * Status possíveis: 'seguro' (padrão) ou 'perdido'.
   * Quando um pet é marcado como 'perdido', fluxos de alerta são acionados.
   *
   * @param {string} id - UUID do pet
   * @param {string} status - Novo status ('seguro' ou 'perdido')
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizarStatus(id, status, client = null) {
    const executor = client || pool;
    const resultado = await executor.query(
      `UPDATE pets
       SET status = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );

    return resultado.rows[0];
  },

  /**
   * Atualiza a foto de perfil do pet.
   * O caminho da foto é relativo ao diretório de uploads.
   *
   * @param {string} id - UUID do pet
   * @param {string} fotoPath - Novo caminho da foto
   * @returns {Promise<object>} O registro atualizado
   */
  async atualizarFoto(id, fotoPath) {
    const resultado = await query(
      `UPDATE pets
       SET foto = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, fotoPath]
    );

    return resultado.rows[0];
  },

  async atualizarCapa(id, fotoCapaPath) {
    const resultado = await query(
      `UPDATE pets
       SET foto_capa = $2,
           data_atualizacao = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, fotoCapaPath]
    );
    return resultado.rows[0];
  },

  /**
   * Remove permanentemente um pet do banco de dados.
   *
   * @param {string} id - UUID do pet
   * @returns {Promise<object|undefined>} O registro removido ou undefined
   */
  async deletar(id) {
    const resultado = await query(
      `DELETE FROM pets WHERE id = $1 RETURNING *`,
      [id]
    );

    return resultado.rows[0];
  },

  /**
   * Conta o número total de pets cadastrados no sistema.
   *
   * @returns {Promise<number>} Total de pets
   */
  async buscarPorNomeComDonoESeguidores(termo, limite = 20, usuarioId = null) {
    const uid = usuarioId != null ? parseInt(usuarioId, 10) : null;
    let sql = `
      SELECT p.id, p.nome, p.foto, p.tipo, p.raca, p.slug,
             ${PET_VERIFICATION_FIELDS},
             u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil, u.foto_perfil AS dono_foto_perfil,
             (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores`;
    if (uid) {
      sql += `, (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = ${uid}) > 0 AS seguindo`;
    } else {
      sql += `, false AS seguindo`;
    }
    sql += `
      FROM pets p
      JOIN usuarios u ON u.id = p.usuario_id
      WHERE LOWER(p.nome) LIKE $1
      ORDER BY (SELECT COUNT(*) FROM seguidores_pets WHERE pet_id = p.id) DESC, p.nome ASC
      LIMIT $2`;
    const resultado = await query(sql, [`%${String(termo).toLowerCase()}%`, limite]);
    return resultado.rows;
  },

  async listarRecomendadosParaSeguir(usuarioId, max = 8) {
    const resultado = await query(
      `SELECT p.id, p.nome, p.foto, p.tipo, p.raca, p.slug,
              ${PET_VERIFICATION_FIELDS},
              u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = $1) > 0 AS seguindo
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       WHERE p.usuario_id != $1
         AND p.id NOT IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $1)
         AND COALESCE(p.privado, false) = false
       ORDER BY (SELECT COUNT(*) FROM seguidores_pets WHERE pet_id = p.id) DESC, p.data_criacao DESC
       LIMIT $2`,
      [usuarioId, max]
    );
    return resultado.rows;
  },

  async listarProximosPorLocalizacaoDono(usuarioIdReferencia, usuarioIdLogado, limite = 8) {
    const resultado = await query(
      `SELECT p.id, p.nome, p.foto, p.tipo, p.raca, p.slug,
              ${PET_VERIFICATION_FIELDS},
              u.id AS dono_id, u.nome AS dono_nome, u.cor_perfil AS dono_cor_perfil,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id) AS total_seguidores,
              (SELECT COUNT(*)::int FROM seguidores_pets WHERE pet_id = p.id AND usuario_id = $2) > 0 AS seguindo
       FROM pets p
       JOIN usuarios u ON u.id = p.usuario_id
       INNER JOIN usuarios ref ON ref.id = $1
       WHERE ref.ultima_localizacao IS NOT NULL
         AND u.ultima_localizacao IS NOT NULL
         AND u.id != $1
         AND u.id != $2
         AND ST_DWithin(u.ultima_localizacao, ref.ultima_localizacao, 50000)
         AND p.id NOT IN (SELECT pet_id FROM seguidores_pets WHERE usuario_id = $2)
         AND COALESCE(p.privado, false) = false
       ORDER BY ST_Distance(u.ultima_localizacao, ref.ultima_localizacao) ASC
       LIMIT $3`,
      [usuarioIdReferencia, usuarioIdLogado, limite]
    );
    return resultado.rows;
  },

  async contarTotal() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM pets`
    );

    return parseInt(resultado.rows[0].total, 10);
  },

  /**
   * Conta quantos pets estão com status 'perdido'.
   * Usado no dashboard para exibir alertas ativos.
   *
   * @returns {Promise<number>} Número de pets perdidos
   */
  async contarPerdidos() {
    const resultado = await query(
      `SELECT COUNT(*) AS total FROM pets WHERE status = 'perdido'`
    );

    return parseInt(resultado.rows[0].total, 10);
  },
};

module.exports = Pet;
