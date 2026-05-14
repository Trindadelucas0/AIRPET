/**
 * Smoke: aplicação Express monta sem escutar porta (sem DB em runtime do teste).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('app', () => {
  test('createApplication retorna app e server', () => {
    const { createApplication } = require('../src/app');
    const { app, server } = createApplication();
    assert.ok(app);
    assert.ok(app.use);
    assert.ok(server);
  });
});
