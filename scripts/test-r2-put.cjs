#!/usr/bin/env node
/**
 * Testa PutObject + DeleteObject no R2 com as mesmas credenciais da app.
 * Uso: npm run test:r2
 * Requer STORAGE_DRIVER=r2 (ou ignora — usa só variáveis R2_*).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

function trimEnv(k) {
  const v = process.env[k];
  return typeof v === 'string' ? v.trim() : '';
}

async function main() {
  const accountId = trimEnv('R2_ACCOUNT_ID');
  const accessKeyId = trimEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = trimEnv('R2_SECRET_ACCESS_KEY');
  const bucket = trimEnv('R2_BUCKET_NAME');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Faltam R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY ou R2_BUCKET_NAME no .env');
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const key = `_airpet_test/${Date.now()}.txt`;
  const body = Buffer.from('airpet-r2-test', 'utf8');

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'text/plain',
      })
    );
    console.log('OK PutObject:', key);

    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log('OK DeleteObject (limpeza):', key);
    console.log('R2: credenciais e permissões de escrita parecem corretas.');
  } catch (err) {
    const meta = err.$metadata || {};
    console.error('Falha R2:', err.name, err.message);
    console.error('HTTP:', meta.httpStatusCode, 'requestId:', meta.requestId || meta.cfId || 'n/a');
    process.exit(1);
  }
}

main();
