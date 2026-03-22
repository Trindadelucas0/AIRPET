const request = require('supertest');
const { createApplication } = require('../../src/app');
const { pool } = require('../../src/config/database');

describe('Integracao HTTP', () => {
  let app;
  let io;

  beforeAll(async () => {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'SESSION_SECRET', 'JWT_SECRET'];
    const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
    if (missing.length) {
      throw new Error(
        `Defina no .env para rodar testes de integracao: ${missing.join(', ')}`
      );
    }
    await pool.query('SELECT 1');
    ({ app, io } = createApplication());
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
  });

  it('GET / responde HTML', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.text).toMatch(/html/i);
  });

  it('GET /manifest.json retorna JSON do PWA', async () => {
    const res = await request(app).get('/manifest.json').expect(200);
    expect(res.body).toHaveProperty('short_name');
    expect(res.body).toHaveProperty('icons');
    expect(res.headers['content-type']).toMatch(/manifest/);
  });

  it('GET /api/petshops/mapa retorna lista', async () => {
    const res = await request(app).get('/api/petshops/mapa').expect(200);
    expect(res.body).toMatchObject({ sucesso: true });
    expect(Array.isArray(res.body.petshops)).toBe(true);
  });

  it('GET /api/racas retorna array', async () => {
    const res = await request(app).get('/api/racas').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET rota inexistente retorna 404', async () => {
    await request(app).get('/rota-que-nao-existe-airpet-test').expect(404);
  });

  it('GET /auth/login responde HTML', async () => {
    const res = await request(app).get('/auth/login').expect(200);
    expect(res.text).toMatch(/html/i);
  });

  it('GET /parceiros/cadastro responde HTML', async () => {
    const res = await request(app).get('/parceiros/cadastro').expect(200);
    expect(res.text).toMatch(/html/i);
  });
});
