/**
 * authService.js — Serviço de autenticação do sistema AIRPET
 *
 * Este módulo centraliza toda a lógica de autenticação:
 * registro de novos usuários, login com geração de token JWT
 * e verificação/decodificação de tokens.
 *
 * Dependências externas:
 *   - bcrypt: hash e comparação segura de senhas (algoritmo Blowfish)
 *   - jsonwebtoken: geração e verificação de tokens JWT (RFC 7519)
 *
 * Fluxo de autenticação:
 *   1. Tutor se registra → senha é hasheada com bcrypt (12 rounds)
 *   2. Tutor faz login → bcrypt compara senha, JWT é gerado
 *   3. Requisições autenticadas → token JWT é verificado no middleware
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');

/**
 * Número de rounds do bcrypt para gerar o salt.
 * 12 rounds oferece um bom equilíbrio entre segurança e performance.
 * Cada round adicional dobra o tempo de hash (~250ms com 12 rounds).
 */
const BCRYPT_ROUNDS = 12;

const authService = {

  /**
   * Registra um novo usuário no sistema.
   *
   * Processo:
   *   1. Gera o hash da senha com bcrypt (12 rounds)
   *   2. Cria o registro no banco via model Usuario
   *   3. Remove o campo senha_hash do retorno por segurança
   *
   * @param {object} dados - Dados do novo usuário
   * @param {string} dados.nome - Nome completo do usuário
   * @param {string} dados.email - E-mail (deve ser único)
   * @param {string} dados.senha - Senha em texto puro (será hasheada)
   * @param {string} dados.telefone - Telefone de contato
   * @param {string} [dados.role='tutor'] - Papel do usuário ('tutor' ou 'admin')
   * @returns {Promise<object>} Usuário criado sem o campo senha_hash
   * @throws {Error} Se o e-mail já estiver cadastrado ou dados inválidos
   *
   * @example
   * const usuario = await authService.registrar({
   *   nome: 'João Silva',
   *   email: 'joao@email.com',
   *   senha: 'minhasenha123',
   *   telefone: '11999999999'
   * });
   */
  async registrar(dados) {
    logger.info('AuthService', `Iniciando registro para o e-mail: ${dados.email}`);

    /* Verifica se o e-mail já está cadastrado antes de tentar inserir */
    const existente = await Usuario.buscarPorEmail(dados.email);
    if (existente) {
      logger.warn('AuthService', `Registro falhou — e-mail já cadastrado: ${dados.email}`);
      return { erro: 'Este e-mail já está cadastrado. Tente fazer login.' };
    }

    /* Limite de usuários (MAX_USUARIOS no .env). 0 ou vazio = ilimitado */
    const maxUsuarios = parseInt(process.env.MAX_USUARIOS || '0', 10);
    if (maxUsuarios > 0) {
      const total = await Usuario.contarTotal();
      if (total >= maxUsuarios) {
        logger.warn('AuthService', `Registro rejeitado — limite de usuários atingido (${total}/${maxUsuarios})`);
        return { erro: 'Limite de usuários atingido.', codigo: 'limite_atingido' };
      }
    }

    /**
     * Gera o hash da senha usando bcrypt.
     * O salt é gerado automaticamente com o número de rounds especificado.
     * Resultado: $2b$12$<salt_22_chars><hash_31_chars> (60 caracteres total)
     */
    const senha_hash = await bcrypt.hash(dados.senha, BCRYPT_ROUNDS);

    const dadosUsuario = {
      nome: dados.nome,
      email: dados.email,
      senha_hash,
      telefone: dados.telefone,
      role: dados.role || 'tutor',
      bio: dados.bio,
      endereco: dados.endereco,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
      cep: dados.cep,
    };

    /* Persiste o novo usuário no banco de dados */
    const usuario = await Usuario.criar(dadosUsuario);

    logger.info('AuthService', `Usuário registrado com sucesso: ${usuario.id}`);

    const { senha_hash: _, ...usuarioSemSenha } = usuario;

    return { usuario: usuarioSemSenha };
  },

  /**
   * Realiza o login de um usuário existente.
   *
   * Processo:
   *   1. Busca o usuário pelo e-mail no banco
   *   2. Compara a senha fornecida com o hash armazenado via bcrypt
   *   3. Gera um token JWT com os dados do usuário no payload
   *   4. Retorna o objeto do usuário (sem senha) e o token
   *
   * @param {string} email - E-mail do usuário
   * @param {string} senha - Senha em texto puro para comparação
   * @returns {Promise<object>} Objeto com { usuario, token }
   * @returns {object} returns.usuario - Dados do usuário sem senha_hash
   * @returns {string} returns.token - Token JWT válido por 7 dias
   * @throws {Error} Se o e-mail não for encontrado ou a senha estiver incorreta
   *
   * @example
   * const { usuario, token } = await authService.login('joao@email.com', 'minhasenha123');
   */
  async login({ email, senha }) {
    logger.info('AuthService', `Tentativa de login para: ${email}`);

    /* Busca o usuário pelo e-mail — retorna undefined se não existir */
    const usuario = await Usuario.buscarPorEmail(email);

    if (!usuario) {
      logger.warn('AuthService', `Login falhou — e-mail não encontrado: ${email}`);
      return { erro: 'E-mail ou senha incorretos.' };
    }

    if (usuario.bloqueado) {
      logger.warn('AuthService', `Login bloqueado para: ${email}`);
      return { erro: 'Sua conta foi bloqueada. Entre em contato com o suporte.' };
    }

    /**
     * Compara a senha em texto puro com o hash armazenado.
     * bcrypt.compare extrai o salt do hash e recalcula para comparar.
     * Retorna true se a senha corresponder, false caso contrário.
     */
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      logger.warn('AuthService', `Login falhou — senha incorreta para: ${email}`);
      return { erro: 'E-mail ou senha incorretos.' };
    }

    /**
     * Gera o token JWT com payload contendo dados essenciais do usuário.
     * O token é assinado com a chave secreta definida em JWT_SECRET.
     * Expiração de 7 dias (7d) — o tutor não precisa fazer login frequente.
     */
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info('AuthService', `Login bem-sucedido para: ${email}`);

    /* Remove a senha do objeto retornado por segurança */
    const { senha_hash: _, ...usuarioSemSenha } = usuario;

    return { usuario: usuarioSemSenha, token };
  },

  /**
   * Verifica e decodifica um token JWT.
   *
   * Usado pelos middlewares de autenticação para validar
   * requisições protegidas. O token é verificado contra
   * a chave secreta (JWT_SECRET) e o payload é retornado.
   *
   * @param {string} token - Token JWT a ser verificado
   * @returns {object} Payload decodificado do token (id, email, role, iat, exp)
   * @throws {Error} Se o token for inválido, expirado ou malformado
   *
   * @example
   * const payload = authService.verificarToken('eyJhbGciOiJIUz...');
   * // payload = { id: 'uuid', email: 'joao@email.com', role: 'tutor', iat: ..., exp: ... }
   */
  /**
   * JWT de curta duração para app mobile / Authorization Bearer (typ: access).
   * Duração: JWT_ACCESS_EXPIRES_IN (ex.: 15m). Web continua usando cookie + token 7d no login HTML.
   */
  gerarAccessTokenCurto(usuario) {
    const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    return jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        role: usuario.role,
        typ: 'access',
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );
  },

  gerarRefreshPlainEHash() {
    const plain = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(plain).digest('hex');
    return { plain, hash };
  },

  accessTokenExpiresInSegundos(token) {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return 900;
    return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  },

  /**
   * Login JSON para mobile: access JWT curto + refresh opaco (armazenar só hash no PG).
   */
  async loginMobileComRefresh({ email, senha, userAgent }) {
    const base = await this.login({ email, senha });
    if (base.erro) return base;

    const dias = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10);
    const expiraEm = new Date(Date.now() + Math.max(1, dias) * 24 * 60 * 60 * 1000);
    const { plain, hash } = this.gerarRefreshPlainEHash();
    await RefreshToken.inserir({
      usuarioId: base.usuario.id,
      tokenHash: hash,
      expiraEm,
      userAgent,
    });

    const access_token = this.gerarAccessTokenCurto(base.usuario);
    return {
      usuario: base.usuario,
      access_token,
      refresh_token: plain,
      expires_in: this.accessTokenExpiresInSegundos(access_token),
      refresh_expires_at: expiraEm.toISOString(),
    };
  },

  verificarToken(token) {
    /**
     * jwt.verify() lança exceção se:
     *   - Token expirado (TokenExpiredError)
     *   - Assinatura inválida (JsonWebTokenError)
     *   - Token malformado (JsonWebTokenError)
     */
    return jwt.verify(token, process.env.JWT_SECRET);
  },
};

module.exports = authService;
