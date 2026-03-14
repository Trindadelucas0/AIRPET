/**
 * session.js — Configuracao do express-session
 *
 * Sessoes sao armazenadas no PostgreSQL via connect-pg-simple,
 * garantindo persistencia mesmo se o servidor reiniciar.
 * O segredo da sessao vem do .env.
 */

const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./database');

const sessionMiddleware = session({
  store: new pgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
});

module.exports = sessionMiddleware;
