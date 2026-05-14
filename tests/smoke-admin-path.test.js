/**
 * Garante que o prefixo admin segue a mesma regra mental que index.js / server log.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

function adminBaseFromEnv() {
  const raw = String(process.env.ADMIN_PATH || '/admin').trim() || '/admin';
  return raw.replace(/\/+$/, '') || '/admin';
}

describe('ADMIN_PATH', () => {
  test('omissao => /admin', () => {
    const prev = process.env.ADMIN_PATH;
    delete process.env.ADMIN_PATH;
    assert.strictEqual(adminBaseFromEnv(), '/admin');
    if (prev !== undefined) process.env.ADMIN_PATH = prev;
  });

  test('/_painel_a1r preservado', () => {
    process.env.ADMIN_PATH = '/_painel_a1r';
    assert.strictEqual(adminBaseFromEnv(), '/_painel_a1r');
    delete process.env.ADMIN_PATH;
  });

  test('remove barra final', () => {
    process.env.ADMIN_PATH = '/admin/';
    assert.strictEqual(adminBaseFromEnv(), '/admin');
    delete process.env.ADMIN_PATH;
  });
});
