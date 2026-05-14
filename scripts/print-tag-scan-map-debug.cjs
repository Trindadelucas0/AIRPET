#!/usr/bin/env node
/**
 * Diagnóstico: último scan NFC + estado da tag/pet para aparecer no mapa público.
 *
 * Uso:
 *   node scripts/print-tag-scan-map-debug.cjs PET-XXXXXX
 *   npm run mapa:debug-tag -- PET-XXXXXX
 *
 * Requer DB_HOST, DB_USER, DB_DATABASE no .env (como db-health.cjs).
 */
'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

function numEnv(name, fallback) {
  const v = process.env[name];
  if (v == null || String(v).trim() === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const tagCode = (process.argv[2] || process.env.TAG_CODE || '').trim();
  if (!tagCode) {
    console.error('Uso: node scripts/print-tag-scan-map-debug.cjs PET-XXXXXX');
    process.exit(1);
  }

  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_DATABASE;
  if (!host || !user || !database) {
    console.error('Defina DB_HOST, DB_USER, DB_DATABASE no .env');
    process.exit(1);
  }

  const pool = new Pool({
    host,
    port: numEnv('DB_PORT', 5432),
    user,
    password: process.env.DB_PASSWORD,
    database,
    max: 2,
  });

  try {
    const tagR = await pool.query(
      `SELECT id, tag_code, status, pet_id, user_id, data_criacao
       FROM nfc_tags WHERE tag_code = $1`,
      [tagCode]
    );
    if (!tagR.rows.length) {
      console.log('[tag] Nenhuma linha em nfc_tags para tag_code:', tagCode);
      await pool.end();
      return;
    }
    const tag = tagR.rows[0];
    console.log('\n[nfc_tags]', JSON.stringify(tag, null, 2));

    if (tag.pet_id) {
      const petR = await pool.query(
        `SELECT id, nome, slug, status, privado,
                mostrar_ultimo_avistamento_mapa,
                mostrar_ultimo_scan_seguidores
         FROM pets WHERE id = $1`,
        [tag.pet_id]
      );
      console.log('\n[pets]', JSON.stringify(petR.rows[0] || null, null, 2));
    } else {
      console.log('\n[pets] pet_id NULL — mapa público pet_scan exige pet vinculado.');
    }

    const scansR = await pool.query(
      `SELECT ts.id, ts.tag_id, ts.latitude, ts.longitude, ts.cidade, ts.data, ts.ip
       FROM tag_scans ts
       WHERE ts.tag_id = $1
       ORDER BY ts.data DESC
       LIMIT 8`,
      [tag.id]
    );
    console.log('\n[tag_scans últimos 8]', JSON.stringify(scansR.rows, null, 2));

    const last = scansR.rows[0];
    if (last) {
      const la = last.latitude != null ? parseFloat(last.latitude) : NaN;
      const lo = last.longitude != null ? parseFloat(last.longitude) : NaN;
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        console.log('\n[mapa] Último scan sem lat/lng — GET /tag sem IP geo (ex.: localhost) ou cookie skip; use POST localização ou ambiente com IP público.');
      } else {
        const pad = 0.5;
        const url =
          'http://localhost:' +
          (process.env.PORT || 3000) +
          '/mapa/api/pins?swLat=' +
          (la - pad) +
          '&swLng=' +
          (lo - pad) +
          '&neLat=' +
          (la + pad) +
          '&neLng=' +
          (lo + pad);
        console.log('\n[mapa] Teste bbox ~1° em volta do último scan (ajuste host/porta):');
        console.log(url);
      }
    }
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
