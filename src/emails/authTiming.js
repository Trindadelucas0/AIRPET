/**
 * TTL do link de redefinição de senha — deve ser o mesmo valor usado ao gravar o token
 * (ver authController.resetTokens / esqueciSenha).
 */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; /* 1 hora */

module.exports = {
  PASSWORD_RESET_TTL_MS,
  PASSWORD_RESET_TTL_MINUTES: PASSWORD_RESET_TTL_MS / 60000,
};
