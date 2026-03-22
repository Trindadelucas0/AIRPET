import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const { migrations, garantirPostGIS } = require(
  join(__dirname, '..', 'src', 'config', 'migrationBaselineStatements.js')
);

export const shorthands = undefined;

export async function up(pgm) {
  await garantirPostGIS();
  for (const sql of migrations) {
    pgm.sql(sql);
  }
}

export function down() {
  throw new Error(
    'Baseline AIRPET irreversível: não use migrate down em produção. Restaure backup ou recrie o schema manualmente.'
  );
}
