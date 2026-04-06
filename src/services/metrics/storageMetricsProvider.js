/**
 * Reconcilia totais de armazenamento com o bucket R2 (ListObjectsV2) ou disco local.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { createMetricsStore } = require('./metricsStore');

const PUBLIC_ROOT = path.join(__dirname, '..', '..', 'public');

function envTrim(key) {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
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

/**
 * Lista todo o bucket com paginação; soma Size e conta objetos.
 */
async function sumR2BucketObjects() {
  const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const bucket = envTrim('R2_BUCKET_NAME');
  if (!bucket) throw new Error('R2_BUCKET_NAME ausente');

  let continuationToken;
  let totalBytes = 0;
  let totalObjects = 0;

  do {
    const out = await getS3().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      })
    );
    const contents = out.Contents || [];
    for (const obj of contents) {
      totalObjects += 1;
      totalBytes += Number(obj.Size) || 0;
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken);

  return { totalBytes, totalObjects };
}

async function sumLocalImagesDir(subdir = 'images') {
  const root = path.join(PUBLIC_ROOT, subdir);
  let totalBytes = 0;
  let totalObjects = 0;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(p);
      } else if (ent.isFile()) {
        try {
          const st = await fs.promises.stat(p);
          totalBytes += st.size;
          totalObjects += 1;
        } catch (_) {}
      }
    }
  }

  await walk(root);
  return { totalBytes, totalObjects };
}

/**
 * Reconcilia agregados na BD com a fonte (R2 ou disco).
 * @returns {{ totalBytes: number, totalObjects: number, source: string }}
 */
async function reconcileStorageFromSource() {
  const store = createMetricsStore();
  if (!store) {
    throw new Error('Métricas desativadas (METRICS_ENABLED=false)');
  }

  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  let sums;
  let source;

  if (driver === 'r2') {
    sums = await sumR2BucketObjects();
    source = 'r2';
  } else {
    sums = await sumLocalImagesDir('images');
    source = 'local';
  }

  await store.setStorageTotals(sums.totalBytes, sums.totalObjects);
  await store.setMeta('last_storage_reconcile_at', { time: new Date() });

  logger.info('METRICS', 'Reconciliação de armazenamento concluída', {
    source,
    totalBytes: sums.totalBytes,
    totalObjects: sums.totalObjects,
  });

  return { ...sums, source };
}

module.exports = {
  reconcileStorageFromSource,
  sumR2BucketObjects,
  sumLocalImagesDir,
};
