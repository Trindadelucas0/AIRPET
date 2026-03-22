/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.js'],
  globalTeardown: '<rootDir>/tests/integration/global-teardown.cjs',
  testTimeout: 30000,
};
