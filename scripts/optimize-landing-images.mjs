/**
 * Gera variantes WebP (e opcionalmente AVIF) para imagens em src/public/images/landing/.
 * Uso: npm run images:optimize-landing
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  let sharp;
  try {
    const mod = await import('sharp');
    sharp = mod.default || mod;
  } catch (e) {
    console.error('[optimize-landing] Instale sharp: npm install');
    process.exit(1);
  }

  const dir = path.join(__dirname, '..', 'src', 'public', 'images', 'landing');
  if (!fs.existsSync(dir)) {
    console.warn('[optimize-landing] Pasta não encontrada:', dir);
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  for (const f of files) {
    const input = path.join(dir, f);
    const base = f.replace(/\.(jpe?g|png)$/i, '');
    const outWebp = path.join(dir, `${base}.webp`);
    await sharp(input).webp({ quality: 82 }).toFile(outWebp);
    console.log('OK', path.relative(process.cwd(), outWebp));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
