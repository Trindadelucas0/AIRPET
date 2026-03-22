const request = require('supertest');
const { createApplication } = require('../../src/app');
const { pool } = require('../../src/config/database');

describe('Fluxos criticos (auth, NFC, pet perdido)', () => {
  let app;
  let io;

  beforeAll(async () => {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'SESSION_SECRET', 'JWT_SECRET'];
    const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '');
    if (missing.length) {
      throw new Error(`Defina no .env: ${missing.join(', ')}`);
    }
    await pool.query('SELECT 1');
    ({ app, io } = createApplication());
  });

  afterAll(async () => {
    await new Promise((resolve) => {
      io.close(() => resolve());
    });
  });

  it('auth: registro e login mantem sessao (cookie)', async () => {
    const agent = request.agent(app);
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const email = `test_airpet_${suffix}@example.com`;

    const reg = await agent
      .post('/auth/registro')
      .type('form')
      .send({
        nome: 'Usuario Teste',
        email,
        senha: 'senha123',
      })
      .redirects(0);

    expect(reg.status).toBe(302);
    expect(reg.headers.location).toMatch(/explorar/);
    expect(reg.headers['set-cookie']).toBeDefined();

    const agent2 = request.agent(app);
    const login = await agent2
      .post('/auth/login')
      .type('form')
      .send({ email, senha: 'senha123' })
      .redirects(0);

    expect(login.status).toBe(302);
    expect(login.headers.location).toMatch(/explorar/);
    expect(login.headers['set-cookie']).toBeDefined();
  });

  it('NFC: tag inexistente retorna 404', async () => {
    const res = await request(app).get('/tag/PET-NAO-EXISTE-INTEGRATION-TEST');
    expect(res.status).toBe(404);
    expect(res.text).toMatch(/404|nao encontrad|não encontrad/i);
  });

  it('pet perdido: apos cadastrar pet, POST /perdidos/:id/reportar redireciona com sucesso', async () => {
    const agent = request.agent(app);
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const email = `perdido_${suffix}@example.com`;

    await agent.post('/auth/registro').type('form').send({
      nome: 'Tutor Perdido',
      email,
      senha: 'senha123',
    });

    const cad = await agent
      .post('/pets/cadastro')
      .type('form')
      .field('nome', `PetPerdido_${suffix}`)
      .field('tipo', 'cachorro');

    expect(cad.status).toBe(200);
    const m = cad.text.match(/href="\/pets\/(\d+)"/);
    expect(m).toBeTruthy();
    const petId = m[1];

    const rep = await agent
      .post(`/perdidos/${petId}/reportar`)
      .type('form')
      .send({
        descricao: 'Sumiu perto de casa',
        latitude: '-23.5505',
        longitude: '-46.6333',
      })
      .redirects(0);

    expect(rep.status).toBe(302);
    expect(rep.headers.location).toBe(`/pets/${petId}`);
  });

  it('GET /health/db sem segredo retorna 404', async () => {
    await request(app).get('/health/db').expect(404);
  });
});
