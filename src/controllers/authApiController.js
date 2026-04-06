/**
 * API JSON para app mobile: access JWT curto + refresh opaco (hash no banco).
 * Web continua em /auth/login com sessão + cookie httpOnly.
 *
 * Fluxo recomendado (app nativo):
 * 1. POST /api/v1/auth/mobile-login { email, senha } → guardar access_token (memória) e refresh_token (Keychain / EncryptedSharedPreferences).
 * 2. Chamadas à API: Authorization: Bearer <access_token>.
 * 3. 401 ou access expirado → POST /api/v1/auth/refresh { refresh_token } → novo par; rotacionar refresh no cliente.
 * 4. Logout → POST /api/v1/auth/mobile-logout { refresh_token } e apagar tokens locais.
 *
 * Variáveis: JWT_ACCESS_EXPIRES_IN (default 15m), JWT_REFRESH_DAYS (default 30). Exige migração refresh_tokens (npm run db:migrate).
 */

const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/RefreshToken');
const logger = require('../utils/logger');

const authApiController = {
  async mobileLogin(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ sucesso: false, mensagem: 'Dados inválidos.', detalhes: errors.array() });
      }
      const email = String(req.body.email || '').trim().toLowerCase();
      const senha = String(req.body.senha || '');
      const ua = req.get('user-agent') || '';

      const out = await authService.loginMobileComRefresh({ email, senha, userAgent: ua });
      if (out.erro) {
        return res.status(401).json({ sucesso: false, mensagem: out.erro });
      }

      return res.json({
        sucesso: true,
        token_type: 'Bearer',
        access_token: out.access_token,
        refresh_token: out.refresh_token,
        expires_in: out.expires_in,
        refresh_expires_at: out.refresh_expires_at,
        usuario: {
          id: out.usuario.id,
          nome: out.usuario.nome,
          email: out.usuario.email,
          role: out.usuario.role,
        },
      });
    } catch (erro) {
      logger.error('AUTH_API', 'Erro em mobileLogin', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao autenticar.' });
    }
  },

  async refresh(req, res) {
    try {
      const plain = String(req.body.refresh_token || '').trim();
      if (!plain) {
        return res.status(400).json({ sucesso: false, mensagem: 'refresh_token obrigatório.' });
      }
      const hash = crypto.createHash('sha256').update(plain).digest('hex');
      const row = await RefreshToken.buscarValidoPorHash(hash);
      if (!row) {
        return res.status(401).json({ sucesso: false, mensagem: 'Refresh inválido ou expirado.' });
      }

      await RefreshToken.revogarPorHash(hash);

      const usuario = await Usuario.buscarPorId(row.usuario_id);
      if (!usuario || usuario.bloqueado) {
        return res.status(401).json({ sucesso: false, mensagem: 'Conta indisponível.' });
      }

      const dias = parseInt(process.env.JWT_REFRESH_DAYS || '30', 10);
      const expiraEm = new Date(Date.now() + Math.max(1, dias) * 24 * 60 * 60 * 1000);
      const { plain: newPlain, hash: newHash } = authService.gerarRefreshPlainEHash();
      await RefreshToken.inserir({
        usuarioId: usuario.id,
        tokenHash: newHash,
        expiraEm,
        userAgent: req.get('user-agent') || null,
      });

      const { senha_hash: _, ...semSenha } = usuario;
      const access_token = authService.gerarAccessTokenCurto(semSenha);

      return res.json({
        sucesso: true,
        token_type: 'Bearer',
        access_token,
        refresh_token: newPlain,
        expires_in: authService.accessTokenExpiresInSegundos(access_token),
        refresh_expires_at: expiraEm.toISOString(),
      });
    } catch (erro) {
      logger.error('AUTH_API', 'Erro em refresh', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao renovar sessão.' });
    }
  },

  async mobileLogout(req, res) {
    try {
      const plain = String((req.body && req.body.refresh_token) || '').trim();
      if (plain) {
        const hash = crypto.createHash('sha256').update(plain).digest('hex');
        await RefreshToken.revogarPorHash(hash);
      }
      return res.json({ sucesso: true });
    } catch (erro) {
      logger.error('AUTH_API', 'Erro em mobileLogout', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao encerrar sessão.' });
    }
  },
};

const validarMobileLogin = [
  body('email').trim().notEmpty().withMessage('E-mail obrigatório.'),
  body('senha').notEmpty().withMessage('Senha obrigatória.'),
];

module.exports = { authApiController, validarMobileLogin };
