/**
 * server.js — Ponto de entrada do sistema AIRPET
 *
 * Inicializa Express, conecta ao banco, roda migrations,
 * configura middlewares globais, Socket.IO e inicia o servidor HTTP.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const methodOverride = require('method-override');
const sessionMiddleware = require('./src/config/session');
const { runMigrations } = require('./src/config/migrate');
const { pool } = require('./src/config/database');
const routes = require('./src/routes');
const logger = require('./src/utils/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ========================
// MIDDLEWARES GLOBAIS
// ========================

// Seguranca de headers HTTP (CSP relaxado para CDNs do Leaflet/Tailwind/Socket.IO)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(sessionMiddleware);

// Arquivos estaticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'src', 'public')));

// ========================
// VIEW ENGINE (EJS)
// ========================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Variaveis globais disponiveis em todas as views EJS
app.use(async (req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.flash = req.session.flash || null;
  res.locals.verificarPermissoes = req.session.verificarPermissoes || false;
  res.locals.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  req.session.flash = null;
  req.session.verificarPermissoes = false;

  if (req.session.usuario && req.session.usuario.id) {
    try {
      const Notificacao = require('./src/models/Notificacao');
      res.locals.notificacoesNaoLidas = await Notificacao.contarNaoLidas(req.session.usuario.id);
    } catch (_) {
      res.locals.notificacoesNaoLidas = 0;
    }
  } else {
    res.locals.notificacoesNaoLidas = 0;
  }

  next();
});

// ========================
// ROTAS
// ========================

app.use('/', routes);

// ========================
// PAGINAS DE ERRO
// ========================

app.use((req, res) => {
  res.status(404).render('partials/erro', {
    titulo: 'Pagina nao encontrada',
    mensagem: 'A pagina que voce procura nao existe.',
    codigo: 404,
  });
});

app.use((err, req, res, _next) => {
  logger.error('SERVER', 'Erro interno', err);
  res.status(500).render('partials/erro', {
    titulo: 'Erro interno',
    mensagem: 'Algo deu errado. Tente novamente mais tarde.',
    codigo: 500,
  });
});

// ========================
// SOCKET.IO
// ========================

// Compartilha a session do Express com o Socket.IO
io.engine.use(sessionMiddleware);

// Inicializa handlers de socket (chat moderado + admin)
require('./src/sockets')(io);

// Disponibiliza io para os controllers e services que precisarem emitir eventos
app.set('io', io);
const notificacaoService = require('./src/services/notificacaoService');
notificacaoService._io = io;

const schedulerService = require('./src/services/schedulerService');
schedulerService.setNotificacaoService(notificacaoService);

// ========================
// INICIALIZACAO
// ========================

const PORT = process.env.PORT || 3000;

async function iniciar() {
  try {
    // Testa conexao com o banco
    await pool.query('SELECT NOW()');
    logger.info('DB', 'Conectado ao PostgreSQL com sucesso');

    // Roda migrations (cria tabelas se nao existirem)
    await runMigrations();

    // Inicia jobs automáticos (escalar alertas, lembretes vacinas)
    schedulerService.iniciar();

    // Inicia o servidor HTTP (Express + Socket.IO)
    server.listen(PORT, () => {
      logger.info('SERVER', `AIRPET rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('SERVER', 'Falha ao iniciar o servidor', err);
    process.exit(1);
  }
}

iniciar();
