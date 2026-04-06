/**
 * storageService — uploads para disco local ou Cloudflare R2 (S3-compatible).
 * STORAGE_DRIVER=local (default) | r2
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const metricsService = require('./metrics/metricsService');

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const PUBLIC_ROOT = path.join(__dirname, '..', 'public');

/** Remove espaços acidentais nas variáveis R2 do .env */
function envTrim(key) {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

function sanitizeExt(originalname, fallback = '.jpg') {
  const ext = path.extname(originalname || '').toLowerCase();
  const safe = ext.replace(/[^a-z.]/g, '');
  if (/^\.(jpe?g|png|gif|webp|svg)$/.test(safe)) return safe;
  return fallback;
}

async function saveLocal({ buffer, folder, filename }) {
  const f = String(folder).replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  const relDir = path.join(PUBLIC_ROOT, 'images', f);
  await fs.promises.mkdir(relDir, { recursive: true });
  const absPath = path.join(relDir, filename);
  await fs.promises.writeFile(absPath, buffer);
  const publicUrl = `/images/${f}/${filename}`.replace(/\/+/g, '/');
  return { publicUrl, objectKey: `${f}/${filename}` };
}

let s3Client = null;
function getS3() {
  if (s3Client) return s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  const accountId = envTrim('R2_ACCOUNT_ID');
  const accessKeyId = envTrim('R2_ACCESS_KEY_ID');
  const secretAccessKey = envTrim('R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2: defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY');
  }
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  return s3Client;
}

async function saveR2({ buffer, mimetype, folder, filename }) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const bucket = envTrim('R2_BUCKET_NAME');
  const baseUrl = envTrim('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
  if (!bucket || !baseUrl) {
    throw new Error('R2: defina R2_BUCKET_NAME e R2_PUBLIC_BASE_URL (URL pública do bucket)');
  }
  const f = String(folder).replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  const key = `${f}/${filename}`.replace(/^\/+/, '');
  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype || 'application/octet-stream',
      })
    );
  } catch (err) {
    const meta = err.$metadata || {};
    logger.error('STORAGE', 'R2 PutObject falhou', {
      errName: err.name,
      httpStatusCode: meta.httpStatusCode,
      requestId: meta.requestId,
      cfId: meta.cfId,
      message: err.message,
      bucket,
      key,
    });
    throw err;
  }
  const publicUrl = `${baseUrl}/${key}`;
  return { publicUrl, objectKey: key };
}

/**
 * Grava buffer e devolve URL pública para guardar no Postgres.
 * @param {object} opts
 * @param {Buffer} opts.buffer
 * @param {string} opts.mimetype
 * @param {string} opts.originalname
 * @param {string} opts.folder — ex.: pets, posts, chat, perfil, capa, petshops, pwa, pets/capa
 * @param {string} [opts.filename] — nome fixo (ícones PWA: icon-192.png)
 */
async function saveBuffer(opts) {
  const { buffer, mimetype, originalname, folder } = opts;
  const ext = sanitizeExt(originalname);
  const filename = opts.filename || crypto.randomBytes(16).toString('hex') + ext;
  const f = String(folder).replace(/^\/+|\/+$/g, '').replace(/\\/g, '/');
  let out;
  if (DRIVER === 'r2') {
    out = await saveR2({ buffer, mimetype, folder: f, filename });
  } else {
    out = await saveLocal({ buffer, folder: f, filename });
  }
  try {
    await metricsService.recordStorageUploaded(buffer.length);
  } catch (_) {}
  return out;
}

function isLikelyLocalImagePath(url) {
  return typeof url === 'string' && url.startsWith('/images/');
}

function isR2ManagedUrl(url) {
  const base = envTrim('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
  return !!(base && typeof url === 'string' && url.startsWith(`${base}/`));
}

/**
 * Apaga ficheiro local ou objeto R2 (best-effort).
 */
async function removeByPublicUrl(url) {
  if (!url || typeof url !== 'string') return;
  if (DRIVER === 'r2' && isR2ManagedUrl(url)) {
    const { DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
    const base = envTrim('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
    const key = url.slice(base.length + 1).split('?')[0];
    const bucket = envTrim('R2_BUCKET_NAME');
    if (!bucket || !key) return;
    const decodedKey = decodeURIComponent(key);
    let size = 0;
    try {
      const head = await getS3().send(new HeadObjectCommand({ Bucket: bucket, Key: decodedKey }));
      size = Number(head.ContentLength) || 0;
    } catch (_) {}
    try {
      await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: decodedKey }));
      try {
        await metricsService.recordStorageRemoved(size);
      } catch (_) {}
    } catch (_) {}
    return;
  }
  if (isLikelyLocalImagePath(url)) {
    const rel = url.split('?')[0].replace(/^\/+/, '');
    const abs = path.join(PUBLIC_ROOT, rel);
    try {
      const st = await fs.promises.stat(abs);
      const size = st.size;
      await fs.promises.unlink(abs);
      try {
        await metricsService.recordStorageRemoved(size);
      } catch (_) {}
    } catch (_) {}
  }
}

/** Resolve caminho absoluto no disco para URLs /images/... (apenas local). */
function localAbsolutePathFromPublicUrl(url) {
  if (!isLikelyLocalImagePath(url)) return null;
  const rel = url.split('?')[0].replace(/^\/+/, '');
  return path.join(PUBLIC_ROOT, rel);
}

module.exports = {
  saveBuffer,
  removeByPublicUrl,
  localAbsolutePathFromPublicUrl,
  isLikelyLocalImagePath,
  get driver() {
    return DRIVER;
  },
};
