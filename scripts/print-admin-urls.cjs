#!/usr/bin/env node
/**
 * Mostra as URLs do painel admin com base no .env (ou variáveis já exportadas).
 * Uso: npm run admin:url
 * Depois de mudar ADMIN_PATH no .env, reinicie o servidor para aplicar.
 *
 * Windows (Git Bash): nao use `ADMIN_PATH=/algo npm run ...` na mesma linha — o MSYS
 * pode transformar `/algo` num caminho de disco. Prefira editar o `.env`.
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const port = process.env.PORT || 3000;
const raw = String(process.env.ADMIN_PATH || '/admin').trim() || '/admin';
const base = raw.replace(/\/+$/, '') || '/admin';

console.log('');
console.log('[AIRPET] Prefixo admin efetivo (ADMIN_PATH ou /admin):', base);
console.log('[AIRPET] Login:    http://localhost:' + port + base + '/login');
console.log('[AIRPET] Dashboard: http://localhost:' + port + base + '  (após login)');
console.log('');
