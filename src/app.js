/**
 * app.js — Monta Express + Socket.IO sem escutar porta (reutilizavel em testes e em server.js).
 */

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const methodOverride = require('method-override');
const sessionMiddleware = require('./config/session');
const routes = require('./routes');
const logger = require('./utils/logger');
const ConfigSistema = require('./models/ConfigSistema');

function createApplication() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    downloadOptions: false,
  }));
  app.use((req, res, next) => {
    res.removeHeader('X-Download-Options');
    next();
  });

  app.use(logger.requestLogger());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(methodOverride('_method'));
  app.use(cookieParser());
  app.use(sessionMiddleware);

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(async (req, res, next) => {
    const session = req.session || {};
    res.locals.usuario = session.usuario || null;
    res.locals.petshopAccount = session.petshopAccount || null;
    res.locals.flash = session.flash || null;
    res.locals.verificarPermissoes = session.verificarPermissoes || false;
    res.locals.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
    res.locals.BASE_URL = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    if (req.session) {
      req.session.flash = null;
      req.session.verificarPermissoes = false;
    }

    try {
      const configs = await ConfigSistema.listarTodas();
      const get = (chave, padrao) => (configs.find(c => c.chave === chave)?.valor) || padrao;
      res.locals.themeColor = get('pwa_theme_color', '#f26020');
      res.locals.backgroundColor = get('pwa_background_color', '#ffffff');
      res.locals.pwaIcon192 = get('pwa_icon_192', '/images/icons/icon-192.svg');
      res.locals.pwaIcon512 = get('pwa_icon_512', '/images/icons/icon-512.svg');
      res.locals.primaryColor = get('app_primary_color', '#f26020');
      res.locals.primaryHoverColor = get('app_primary_hover_color', '#ff7a3d');
      res.locals.accentGlowColor = get('app_accent_glow', 'rgba(242,96,32,0.12)');
      res.locals.greenColor = get('app_green_color', '#22c55e');
      res.locals.redColor = get('app_red_color', '#ef4444');
      res.locals.purpleColor = get('app_purple_color', '#a78bfa');
      res.locals.blueColor = get('app_blue_color', '#60a5fa');
      res.locals.yellowColor = get('app_yellow_color', '#facc15');
      res.locals.appName = get('app_name', 'AIRPET');
    } catch (_) {
      res.locals.themeColor = '#f26020';
      res.locals.backgroundColor = '#ffffff';
      res.locals.pwaIcon192 = '/images/icons/icon-192.svg';
      res.locals.pwaIcon512 = '/images/icons/icon-512.svg';
      res.locals.primaryColor = '#f26020';
      res.locals.primaryHoverColor = '#ff7a3d';
      res.locals.accentGlowColor = 'rgba(242,96,32,0.12)';
      res.locals.greenColor = '#22c55e';
      res.locals.redColor = '#ef4444';
      res.locals.purpleColor = '#a78bfa';
      res.locals.blueColor = '#60a5fa';
      res.locals.yellowColor = '#facc15';
      res.locals.appName = 'AIRPET';
    }

    if (session.usuario && session.usuario.id) {
      try {
        const Notificacao = require('./models/Notificacao');
        res.locals.notificacoesNaoLidas = await Notificacao.contarNaoLidas(session.usuario.id);
      } catch (_) {
        res.locals.notificacoesNaoLidas = 0;
      }
    } else {
      res.locals.notificacoesNaoLidas = 0;
    }

    next();
  });

  app.get('/manifest.json', async (req, res) => {
    try {
      const configs = await ConfigSistema.listarTodas();
      const get = (chave, padrao) => (configs.find(c => c.chave === chave)?.valor) || padrao;
      const themeColor = get('pwa_theme_color', '#ec5a1c');
      const backgroundColor = get('pwa_background_color', '#ffffff');
      const icon192 = get('pwa_icon_192', '/images/icons/icon-192.svg');
      const icon512 = get('pwa_icon_512', '/images/icons/icon-512.svg');
      const shortName = get('app_name', 'AIRPET');
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const manifest = {
        name: shortName + ' — Proteja seu Pet',
        short_name: shortName,
        description: 'Sistema de identificacao e recuperacao de pets via NFC. Proteja seu animal de estimacao com tags inteligentes.',
        start_url: baseUrl + '/',
        display: 'standalone',
        background_color: backgroundColor,
        theme_color: themeColor,
        orientation: 'portrait-primary',
        scope: '/',
        id: '/',
        lang: 'pt-BR',
        dir: 'ltr',
        categories: ['lifestyle', 'utilities'],
        icons: [
          { src: icon192, sizes: '192x192', type: icon192.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'any' },
          { src: icon512, sizes: '512x512', type: icon512.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'any' },
          { src: icon192, sizes: '192x192', type: icon192.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'maskable' },
          { src: icon512, sizes: '512x512', type: icon512.endsWith('.svg') ? 'image/svg+xml' : 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Meus Pets', short_name: 'Pets', url: baseUrl + '/pets', icons: [{ src: icon192, sizes: '192x192' }] },
          { name: 'Mapa', short_name: 'Mapa', url: baseUrl + '/mapa', icons: [{ src: icon192, sizes: '192x192' }] },
        ],
      };
      res.set('Content-Type', 'application/manifest+json');
      res.json(manifest);
    } catch (err) {
      logger.error('SERVER', 'Erro ao gerar manifest.json', err);
      res.status(500).json({ error: 'Manifest unavailable' });
    }
  });

  app.use('/', routes);

  app.use(express.static(path.join(__dirname, 'public')));

  app.use((req, res) => {
    res.status(404).render('partials/erro', {
      titulo: 'Pagina nao encontrada',
      mensagem: 'A pagina que voce procura nao existe.',
      codigo: 404,
    });
  });

  const isClientDisconnect = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.code;
    return (
      msg.includes('request aborted') ||
      msg.includes('aborted') ||
      code === 'ECONNRESET' ||
      code === 'ECONNABORTED' ||
      code === 'EPIPE'
    );
  };

  app.use((err, req, res, _next) => {
    if (isClientDisconnect(err)) {
      if (!res.headersSent && !res.writableEnded) {
        res.status(499).end();
      }
      return;
    }
    logger.error('SERVER', 'Erro interno', err);
    if (!res.headersSent && !res.writableEnded) {
      res.status(500).render('partials/erro', {
        titulo: 'Erro interno',
        mensagem: 'Algo deu errado. Tente novamente mais tarde.',
        codigo: 500,
      });
    }
  });

  io.engine.use(sessionMiddleware);

  require('./sockets')(io);

  app.set('io', io);
  const notificacaoService = require('./services/notificacaoService');
  notificacaoService._io = io;

  const schedulerService = require('./services/schedulerService');
  schedulerService.setNotificacaoService(notificacaoService);

  return { app, server, io };
}

module.exports = { createApplication };
