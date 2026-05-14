/**
 * server.js — Ponto de entrada do sistema AIRPET
 *
 * Inicializa Express, conecta ao banco, garante pastas de upload,
 * configura middlewares globais, Socket.IO e inicia o servidor HTTP.
 *
 * Schema do PostgreSQL: startup pode executar auto-migrate (baseline + pgm).
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createApplication } = require('./src/app');
const { pool } = require('./src/config/database');
const logger = require('./src/utils/logger');
const schedulerService = require('./src/services/schedulerService');
const { runStartupMigrations } = require('./src/services/startupMigrationService');

const { app, server, io } = createApplication();

function ensurePublicImageDirs() {
  const base = path.join(__dirname, 'src', 'public', 'images');
  ['capa', 'perfil-galeria', 'petshops', 'perfil', 'pets', 'chat'].forEach((dir) => {
    try {
      fs.mkdirSync(path.join(base, dir), { recursive: true });
    } catch (e) {
      /* ignore */
    }
  });
}

const PORT = process.env.PORT || 3000;

const ENV_REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'SESSION_SECRET', 'JWT_SECRET'];
function validarEnv() {
  const obrigatorias = [...ENV_REQUIRED];
  if (process.env.NODE_ENV === 'production') {
    obrigatorias.push('CHAT_GUEST_TOKEN_SECRET');
  }
  const faltando = obrigatorias.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
  if (faltando.length) {
    console.error('[AIRPET] Variaveis de ambiente obrigatorias nao definidas:', faltando.join(', '));
    console.error('Defina-as no arquivo .env (veja .env.example).');
    process.exit(1);
  }
}

async function iniciar() {
  let migrationReport = null;
  try {
    validarEnv();
    logger.secao('Database');
    await pool.query('SELECT NOW()');
    logger.info('DB', 'Conectado ao PostgreSQL com sucesso');
    logger.secao('Migrations');
    migrationReport = await runStartupMigrations();
    const schemaTag = await pool.query(`SELECT to_regclass('public.plan_definitions') AS plan_definitions`);
    if (!schemaTag.rows[0]?.plan_definitions) {
      logger.warn(
        'DB',
        'Schema TAG NFC nao encontrado (plan_definitions ausente). Rode `npm run db:migrate` no ambiente antes de usar /tags/loja-tag.'
      );
    }
    app.get('/loaderio-2340347d46737358dce737c59095abea.txt', (req, res) => {
      res.send('loaderio-2340347d46737358dce737c59095abea');
    });
    ensurePublicImageDirs();

    logger.secao('Services');
    await schedulerService.iniciar();
    logger.info('SCHEDULER', 'Jobs automaticos iniciados (alertas, vacinas)');

    server.listen(PORT, () => {
      logger.banner({
        versao: require('./package.json').version,
        porta: PORT,
        ambiente: process.env.NODE_ENV || 'development',
        db: 'Conectado',
        migrations: migrationReport,
      });
      logger.secao('Servidor Pronto');
      logger.info('SERVER', `Acesse http://localhost:${PORT}`);
      const adminBase = String(process.env.ADMIN_PATH || '/admin').trim().replace(/\/+$/, '') || '/admin';
      logger.info('ADMIN', `Painel admin (login): http://localhost:${PORT}${adminBase}/login`);
    });
  } catch (err) {
    logger.error('SERVER', 'Falha ao iniciar o servidor', err);
    process.exit(1);
  }
}

iniciar();
