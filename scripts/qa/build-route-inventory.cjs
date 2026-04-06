#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const APP_FILE = path.join(ROOT, 'src', 'app.js');
const INDEX_FILE = path.join(ROUTES_DIR, 'index.js');
const OUT_DIR = path.join(ROOT, 'docs', 'qa');
const OUT_FILE = path.join(OUT_DIR, 'route-inventory.md');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function safeRead(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function getMountMap(indexSource) {
  const map = new Map();
  const useRegex = /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(estaAutenticado\s*,\s*)?([a-zA-Z0-9_]+)\s*\)/g;
  let match = null;
  while ((match = useRegex.exec(indexSource)) !== null) {
    map.set(match[3], { prefix: match[1], protectedBySession: Boolean(match[2]) });
  }

  const requireRegex = /const\s+([a-zA-Z0-9_]+)\s*=\s*require\(\s*['"`]\.\/([a-zA-Z0-9_-]+)['"`]\s*\)/g;
  const varToFile = new Map();
  while ((match = requireRegex.exec(indexSource)) !== null) {
    varToFile.set(match[1], match[2] + '.js');
  }

  const fileToMount = new Map();
  for (const [varName, mountInfo] of map.entries()) {
    const fileName = varToFile.get(varName);
    if (fileName) {
      fileToMount.set(fileName, mountInfo);
    }
  }
  const useInlineRequireRegex = /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*(estaAutenticado\s*,\s*)?require\(\s*['"`]\.\/([a-zA-Z0-9_-]+)['"`]\s*\)\s*\)/g;
  while ((match = useInlineRequireRegex.exec(indexSource)) !== null) {
    fileToMount.set(`${match[3]}.js`, {
      prefix: match[1],
      protectedBySession: Boolean(match[2]),
    });
  }

  fileToMount.set('index.js', { prefix: '', protectedBySession: false });
  return fileToMount;
}

function compactSource(content) {
  return content.replace(/\r/g, '').replace(/\n/g, ' ');
}

function parseRoutes(fileName, source) {
  const flat = compactSource(source);
  const entries = [];

  for (const method of HTTP_METHODS) {
    const regex = new RegExp(`router\\.${method}\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*,?([^)]*)\\)`, 'gi');
    let match = null;
    while ((match = regex.exec(flat)) !== null) {
      const routePath = match[1];
      const middlewaresRaw = (match[2] || '').trim();
      entries.push({
        fileName,
        method: method.toUpperCase(),
        routePath,
        middlewaresRaw,
      });
    }
  }

  return entries;
}

function parseAppLevel(source) {
  const flat = compactSource(source);
  const entries = [];
  for (const method of HTTP_METHODS) {
    const regex = new RegExp(`app\\.${method}\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*,?([^)]*)\\)`, 'gi');
    let match = null;
    while ((match = regex.exec(flat)) !== null) {
      entries.push({
        fileName: 'app.js',
        method: method.toUpperCase(),
        routePath: match[1],
        middlewaresRaw: (match[2] || '').trim(),
        mountPrefix: '',
      });
    }
  }
  return entries;
}

function getAppMountMap(appSource) {
  const map = new Map();
  const regex = /app\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(\s*['"`]\.\/routes\/([a-zA-Z0-9_-]+)['"`]\s*\)\s*\)/g;
  let match = null;
  while ((match = regex.exec(appSource)) !== null) {
    map.set(`${match[2]}.js`, match[1]);
  }
  return map;
}

function joinPath(prefix, routePath) {
  if (!prefix) return routePath;
  if (routePath === '/') return prefix;
  return `${prefix}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function normalizeAuth(raw, fileName, mountInfo) {
  if (/estaAutenticadoAPI/.test(raw)) return 'API token/sessao';
  if (mountInfo && mountInfo.protectedBySession) return 'Sessao obrigatoria';
  if (/estaAutenticado/.test(raw)) return 'Sessao obrigatoria';
  if (fileName === 'adminRoutes.js' || /apenasAdmin/.test(raw)) return 'Admin';
  if (fileName === 'syncApiRoutes.js') return 'API token/sessao';
  return 'Publica';
}

function normalizeType(fullPath) {
  return fullPath.includes('/api/') || fullPath.startsWith('/api/') ? 'JSON/API' : 'HTML/SSR';
}

function normalizeRisk(fullPath, auth) {
  if (auth === 'Admin') return 'Alta';
  if (/\/auth|\/api\/v1\/auth|\/chat|\/api\/v1\/me|\/perfil|\/explorar|\/perdidos|\/tags|\/tag\//.test(fullPath)) return 'Alta';
  if (/\/petshops|\/agenda|\/notificacoes|\/api\//.test(fullPath)) return 'Media';
  return 'Baixa';
}

function toMarkdown(entries) {
  const now = new Date().toISOString();
  const rows = entries
    .sort((a, b) => a.fullPath.localeCompare(b.fullPath) || a.method.localeCompare(b.method))
    .map((e) => `| \`${e.method}\` | \`${e.fullPath}\` | ${e.auth} | ${e.type} | ${e.risk} | \`src/routes/${e.fileName}\` |`);

  return [
    '# Inventario de Rotas AIRPET',
    '',
    `Gerado automaticamente em: \`${now}\``,
    '',
    'Legenda de risco: **Alta** (auth/admin/dados sensiveis), **Media** (fluxos de negocio), **Baixa** (conteudo publico).',
    '',
    '| Metodo | Caminho | Autenticacao | Tipo | Risco | Origem |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Observacoes',
    '',
    '- O inventario e baseado em analise estatica de `router.METODO(...)`.',
    '- Para confirmar comportamento real (redirect/flash/json), execute os roteiros em `docs/qa/` e `testes/`.',
    '',
  ].join('\n');
}

function main() {
  const indexSource = safeRead(INDEX_FILE);
  const mountMap = getMountMap(indexSource);
  const appSource = safeRead(APP_FILE);
  const appMountMap = getAppMountMap(appSource);

  const routeFiles = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'));
  let entries = [];

  for (const fileName of routeFiles) {
    const source = safeRead(path.join(ROUTES_DIR, fileName));
    const parsed = parseRoutes(fileName, source);
    const mountInfo = mountMap.get(fileName) || { prefix: '', protectedBySession: false };
    const appPrefix = appMountMap.get(fileName) || '';
    const mountPrefix = `${appPrefix}${mountInfo.prefix}` || '';
    entries = entries.concat(parsed.map((p) => {
      const fullPath = joinPath(mountPrefix, p.routePath);
      const auth = normalizeAuth(p.middlewaresRaw, fileName, mountInfo);
      return {
        ...p,
        mountPrefix,
        fullPath,
        auth,
        type: normalizeType(fullPath),
        risk: normalizeRisk(fullPath, auth),
      };
    }));
  }

  const appEntries = parseAppLevel(appSource).map((p) => {
    const auth = /secret/.test(p.middlewaresRaw) ? 'Chave/secret' : 'Publica';
    return {
      ...p,
      fullPath: p.routePath,
      auth,
      type: normalizeType(p.routePath),
      risk: p.routePath.includes('/health') ? 'Media' : 'Baixa',
    };
  });

  const all = entries.concat(appEntries);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, toMarkdown(all), 'utf8');
  console.log(`Inventario gerado em ${OUT_FILE} com ${all.length} entradas.`);
}

main();
