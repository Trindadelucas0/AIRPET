/**
 * server.js — Ponto de entrada do sistema AIRPET
 *
 * Inicializa Express, conecta ao banco, garante pastas de upload,
 * configura middlewares globais, Socket.IO e inicia o servidor HTTP.
 *
 * Schema do PostgreSQL: rode `npm run db:migrate` antes de subir a API (node-pg-migrate).
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createApplication } = require('./src/app');
const { pool } = require('./src/config/database');
const logger = require('./src/utils/logger');
const schedulerService = require('./src/services/schedulerService');

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
  try {
    validarEnv();
    logger.secao('Database');
    await pool.query('SELECT NOW()');
    logger.info('DB', 'Conectado ao PostgreSQL com sucesso');
    const schemaTag = await pool.query(`SELECT to_regclass('public.plan_definitions') AS plan_definitions`);
    if (!schemaTag.rows[0]?.plan_definitions) {
      logger.warn(
        'DB',
        'Schema TAG NFC nao encontrado (plan_definitions ausente). Rode `npm run db:migrate` no ambiente antes de usar /tags/loja-tag.'
      );
    }

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
        migrations: null,
      });
      logger.secao('Servidor Pronto');
      logger.info('SERVER', `Acesse http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('SERVER', 'Falha ao iniciar o servidor', err);
    process.exit(1);
  }
}

iniciar();
