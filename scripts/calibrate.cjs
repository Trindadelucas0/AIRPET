#!/usr/bin/env node
/**
 * Calibração AIRPET: lint + testes versionados + teste gerado efémero em .calibrate-tmp
 * (a pasta temporária é apagada ao fim; testes permanentes ficam em tests/).
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tmpDir = path.join(root, '.calibrate-tmp');

function rmDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  return r.status === 0;
}

rmDir(tmpDir);
fs.mkdirSync(tmpDir, { recursive: true });

const genTestPath = path.join(tmpDir, 'generated-calibrate.test.js');
const genSrc = `'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');

test('pacote e estrutura minima', () => {
  const pkg = require(path.join(root, 'package.json'));
  assert.strictEqual(pkg.name, 'airpet');
  assert.ok(fs.existsSync(path.join(root, 'server.js')));
  assert.ok(fs.existsSync(path.join(root, 'src', 'app.js')));
});
`;
fs.writeFileSync(genTestPath, genSrc, 'utf8');

let ok = true;

console.log('\n[AIRPET calibrate] ESLint (controllers, services, routes)…\n');
if (!run('npm', ['run', 'lint'])) ok = false;

console.log('\n[AIRPET calibrate] node:test (tests/ + gerado efemero)…\n');
const testFiles = fs.existsSync(path.join(root, 'tests'))
  ? fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.js'))
  : [];
const testPaths = testFiles.map((f) => path.join('tests', f));
testPaths.push(genTestPath);
if (!run(process.execPath, ['--test', ...testPaths])) ok = false;

rmDir(tmpDir);
console.log('\n[AIRPET calibrate] Pasta .calibrate-tmp removida.\n');

if (!ok) {
  console.error('[AIRPET calibrate] Falhou — corrija os erros acima.\n');
  process.exit(1);
}
console.log('[AIRPET calibrate] Concluido com sucesso.\n');
process.exit(0);
