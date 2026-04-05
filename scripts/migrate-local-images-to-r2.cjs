#!/usr/bin/env node
/**
 * Envia ficheiros de src/public/images/** para o bucket R2, preservando caminhos (chave = relativo a images/).
 * Requer STORAGE_DRIVER=r2 e variáveis R2_* no ambiente (carrega .env da raiz se existir).
 *
 * Uso: node scripts/migrate-local-images-to-r2.cjs [--dry-run]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const ROOT = path.join(__dirname, '..', 'src', 'public', 'images');
const dryRun = process.argv.includes('--dry-run');

function walk(dir, baseRel, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = baseRel ? `${baseRel}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, rel, out);
    else out.push({ abs, key: rel.replace(/\\/g, '/') });
  }
  return out;
}

function guessContentType(file) {
  const ext = path.extname(file).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

async function main() {
  if (dryRun) process.env.STORAGE_DRIVER = 'r2';
  if ((process.env.STORAGE_DRIVER || 'local').toLowerCase() !== 'r2') {
    console.error('Defina STORAGE_DRIVER=r2 e credenciais R2 no .env');
    process.exit(1);
  }
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Faltam R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const files = walk(ROOT, '');
  console.log(`Encontrados ${files.length} ficheiros em images/.`);
  let ok = 0;
  for (const { abs, key } of files) {
    const body = fs.readFileSync(abs);
    if (dryRun) {
      console.log('[dry-run]', key, body.length, 'bytes');
      ok += 1;
      continue;
    }
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: guessContentType(abs),
      })
    );
    ok += 1;
    if (ok % 50 === 0) console.log(`... ${ok} enviados`);
  }
  console.log(`Concluído: ${ok} objetos.`);
  console.log('Nota: URLs na base de dados continuam a apontar para /images/... até atualizar para R2_PUBLIC_BASE_URL ou manter ficheiros locais como fallback.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
