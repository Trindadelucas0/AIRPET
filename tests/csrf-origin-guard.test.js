/**
 * Lógica de origem esperada / equivalência dev (localhost vs 127.0.0.1).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const mw = require('../src/middlewares/csrfOriginGuardMiddleware');
const { getExpectedOrigin, originsMatch, isAdminAreaMutation, requestPathname } = mw.__internals;

function makeReq(headers, protocol = 'http') {
  const map = {};
  for (const [k, v] of Object.entries(headers || {})) {
    map[String(k).toLowerCase()] = v;
  }
  return {
    protocol,
    get(name) {
      return map[String(name).toLowerCase()] ?? null;
    },
  };
}

describe('csrfOriginGuard getExpectedOrigin', () => {
  test('usa host e protocolo da requisição', () => {
    const req = makeReq({ host: 'localhost:3000' });
    assert.strictEqual(getExpectedOrigin(req), 'http://localhost:3000');
  });

  test('honra X-Forwarded-Proto e X-Forwarded-Host', () => {
    const req = makeReq({
      host: '10.0.0.1:8080',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'app.exemplo.com',
    }, 'http');
    assert.strictEqual(getExpectedOrigin(req), 'https://app.exemplo.com');
  });
});

describe('csrfOriginGuard originsMatch', () => {
  test('origens iguais', () => {
    const req = makeReq({ host: 'localhost:3000' });
    assert.strictEqual(originsMatch(req, 'http://localhost:3000'), true);
  });

  test('fora de produção: localhost vs 127.0.0.1 com mesma porta', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = makeReq({ host: '127.0.0.1:3000' });
    assert.strictEqual(originsMatch(req, 'http://localhost:3000'), true);
    process.env.NODE_ENV = prev;
  });

  test('produção: localhost vs 127 não equivale', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const req = makeReq({ host: '127.0.0.1:3000' });
    assert.strictEqual(originsMatch(req, 'http://localhost:3000'), false);
    process.env.NODE_ENV = prev;
  });
});

describe('csrfOriginGuard area admin', () => {
  test('isAdminAreaMutation usa originalUrl e ADMIN_PATH', () => {
    const prevPath = process.env.ADMIN_PATH;
    process.env.ADMIN_PATH = '/_painel_z9';
    const req = { method: 'POST', originalUrl: '/_painel_z9/petshops/1/aprovar' };
    assert.strictEqual(isAdminAreaMutation(req), true);
    assert.strictEqual(requestPathname(req), '/_painel_z9/petshops/1/aprovar');
    process.env.ADMIN_PATH = prevPath;
  });

  test('POST sob admin isenta mesmo com Origin errado e session usuario', () => {
    const prevPath = process.env.ADMIN_PATH;
    process.env.ADMIN_PATH = '/_painel_z9';
    const req = {
      method: 'POST',
      originalUrl: '/_painel_z9/petshops/1/aprovar',
      protocol: 'http',
      session: { usuario: { id: 1 } },
      get(h) {
        const H = String(h).toLowerCase();
        if (H === 'host') return 'localhost:3000';
        if (H === 'origin') return 'https://evil.example';
        return null;
      },
    };
    let nexted = false;
    mw(req, { status: () => ({ json() { assert.fail('nao devia responder JSON'); } }) }, () => {
      nexted = true;
    });
    assert.strictEqual(nexted, true);
    process.env.ADMIN_PATH = prevPath;
  });

  test('POST fora do admin com Origin errado mantem 403', () => {
    const req = {
      method: 'POST',
      originalUrl: '/explorar/post',
      protocol: 'http',
      session: { usuario: { id: 1 } },
      get(h) {
        const H = String(h).toLowerCase();
        if (H === 'host') return 'localhost:3000';
        if (H === 'origin') return 'https://evil.example';
        return null;
      },
    };
    let status = 0;
    let nexted = false;
    mw(
      req,
      {
        status(n) {
          status = n;
          return this;
        },
        json() {},
      },
      () => {
        nexted = true;
      },
    );
    assert.strictEqual(nexted, false);
    assert.strictEqual(status, 403);
  });
});
