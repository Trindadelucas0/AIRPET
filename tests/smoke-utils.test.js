/**
 * Smoke: utilitários puros usados no social / slugs.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { slugify } = require('../src/utils/slug');

describe('slug', () => {
  test('slugify normaliza texto', () => {
    assert.match(slugify('  Meu Pet  '), /^meu-pet/);
  });
});
