/**
 * Garante que fofinhos_moldura passa na whitelist dos posts do explorar.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validationResult } = require('express-validator');
const { validarExplorarPostV1, validarExplorarPostV2 } = require('../src/middlewares/writeRouteValidators');

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  res.redirect = () => res;
  return res;
}

async function runChain(chain, req) {
  const res = mockRes();
  for (const mw of chain) {
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      try {
        const ret = mw(req, res, finish);
        if (res.statusCode) {
          finish();
          return;
        }
        if (ret && typeof ret.then === 'function') {
          ret.then(() => finish()).catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    });
    if (res.statusCode) break;
  }
  return { res, errors: validationResult(req) };
}

describe('validarExplorarPost — fofinhos_moldura', () => {
  test('V1 aceita body com fofinhos_moldura e foto', async () => {
    const req = {
      body: { texto: 'oi', pet_id: '1', fofinhos_moldura: '1' },
      file: { originalname: 'a.jpg', size: 100 },
      accepts: (type) => (type === 'json' ? 'json' : false),
      get: () => null,
    };
    const { res, errors } = await runChain(validarExplorarPostV1, req);
    assert.equal(res.statusCode, null);
    assert.ok(errors.isEmpty(), errors.array().map((e) => e.msg).join(' | '));
  });

  test('V1 rejeita fofinhos_moldura se não estiver na whitelist (regressão)', async () => {
    const { camposPermitidos } = require('../src/middlewares/validator');
    const onlyPet = [camposPermitidos(['texto', 'pet_id'])];
    const req = {
      body: { texto: 'oi', pet_id: '1', fofinhos_moldura: '1' },
      file: { originalname: 'a.jpg', size: 100 },
      accepts: (type) => (type === 'json' ? 'json' : false),
      get: () => null,
    };
    const { res } = await runChain(onlyPet, req);
    assert.equal(res.statusCode, 422);
    assert.match(String(res.body?.mensagem || ''), /fofinhos_moldura/i);
  });

  test('V2 aceita body com fofinhos_moldura e midia', async () => {
    const req = {
      body: { texto: 'oi', pet_id: '1', fofinhos_moldura: '1' },
      files: [{ originalname: 'a.jpg', size: 100 }],
      accepts: (type) => (type === 'json' ? 'json' : false),
      get: () => null,
    };
    const { res, errors } = await runChain(validarExplorarPostV2, req);
    assert.equal(res.statusCode, null);
    assert.ok(errors.isEmpty(), errors.array().map((e) => e.msg).join(' | '));
  });
});
