const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const explorarController = require('../controllers/explorarController');
const { estaAutenticadoAPI } = require('../middlewares/authMiddleware');

const postsDir = path.join(__dirname, '..', 'public', 'images', 'posts');
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}
const petCoverDir = path.join(__dirname, '..', 'public', 'images', 'pets', 'capa');
if (!fs.existsSync(petCoverDir)) {
  fs.mkdirSync(petCoverDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^a-z.]/g, '') || '.jpg';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const extOk = /\.(jpe?g|png|gif|webp)$/.test(ext);
    const mimeOk = !file.mimetype || /image\/(jpeg|png|gif|webp)/.test(file.mimetype);
    cb(null, !!(extOk || mimeOk));
  },
});
const uploadPetCover = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, petCoverDir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^a-z.]/g, '') || '.jpg';
      cb(null, 'pet-cover-' + crypto.randomBytes(12).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const extOk = /\.(jpe?g|png|webp)$/.test(ext);
    const mimeOk = !file.mimetype || /image\/(jpeg|png|webp)/.test(file.mimetype);
    cb(null, !!(extOk || mimeOk));
  },
});

const postRateWindowMs = 15 * 1000;
const postRateMax = 6;
const postRateMap = new Map();
function postRateLimit(req, res, next) {
  const key = `${req.ip}:${req.session?.usuario?.id || 'anon'}`;
  const now = Date.now();
  const data = postRateMap.get(key) || [];
  const recent = data.filter((ts) => now - ts <= postRateWindowMs);
  if (recent.length >= postRateMax) {
    return res.status(429).json({ sucesso: false, mensagem: 'Muitas tentativas em pouco tempo. Aguarde alguns segundos.' });
  }
  recent.push(now);
  postRateMap.set(key, recent);
  next();
}

router.get('/', explorarController.feed);
router.post('/post', estaAutenticadoAPI, postRateLimit, function (req, res, next) {
  upload.single('foto')(req, res, function (err) {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Imagem muito grande (máx. 10 MB).'
        : 'Envie uma imagem válida (JPEG, PNG, GIF ou WebP).';
      return res.status(400).json({ sucesso: false, mensagem: msg });
    }
    next();
  });
}, explorarController.criarPost);

router.post('/api/v2/posts', estaAutenticadoAPI, postRateLimit, function (req, res, next) {
  upload.array('media', 4)(req, res, function (err) {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Imagem muito grande (máx. 10 MB).'
        : 'Envie imagens válidas (JPEG, PNG, GIF ou WebP).';
      return res.status(400).json({ sucesso: false, mensagem: msg });
    }
    next();
  });
}, explorarController.criarPostV2);
router.get('/api/v2/feed', estaAutenticadoAPI, explorarController.feedV2);
router.post('/api/v2/posts/:id/comments', estaAutenticadoAPI, postRateLimit, explorarController.comentarV2);
router.get('/api/v2/users/search', estaAutenticadoAPI, explorarController.buscarUsuariosV2);
router.post('/api/v2/posts/:id/tags/respond', estaAutenticadoAPI, explorarController.responderTagPost);
router.get('/api/v2/me/tagged-posts', estaAutenticadoAPI, explorarController.minhasMarcacoes);
router.get('/api/v2/me/tagged-posts/pending', estaAutenticadoAPI, explorarController.minhasMarcacoesPendentes);
router.post('/post/:id/repost', estaAutenticadoAPI, explorarController.repostar);

router.post('/post/:id/curtir', estaAutenticadoAPI, explorarController.curtir);
router.delete('/post/:id/curtir', estaAutenticadoAPI, explorarController.descurtir);

router.get('/post/:id/comentarios', explorarController.comentarios);
router.get('/post/:id/pets-proximos', explorarController.petsProximosPost);
router.post('/post/:id/comentar', estaAutenticadoAPI, explorarController.comentar);
router.post('/api/interactions/view', estaAutenticadoAPI, explorarController.registrarVisualizacao);
router.delete('/comentario/:id', estaAutenticadoAPI, explorarController.deletarComentario);

// Interações sociais em publicações do petshop (cards no explorar)
router.post('/petshops-post/:id/curtir', estaAutenticadoAPI, explorarController.curtirPetshopPublicacao);
router.delete('/petshops-post/:id/curtir', estaAutenticadoAPI, explorarController.descurtirPetshopPublicacao);
router.get('/petshops-post/:id/comentarios', explorarController.comentariosPetshopPublicacao);
router.post('/petshops-post/:id/comentar', estaAutenticadoAPI, explorarController.comentarPetshopPublicacao);

router.post('/post/:id/fixar', estaAutenticadoAPI, explorarController.fixar);
router.delete('/post/:id/fixar', estaAutenticadoAPI, explorarController.desafixar);

router.delete('/post/:id', estaAutenticadoAPI, explorarController.deletarPost);

router.post('/seguir/:id', estaAutenticadoAPI, explorarController.seguir);
router.delete('/seguir/:id', estaAutenticadoAPI, explorarController.deixarDeSeguir);

router.get('/perfil/:id', explorarController.perfilPublico);
router.get('/perfil/:id/seguidores', explorarController.listarSeguidoresUsuario);
router.get('/perfil/:id/seguindo', explorarController.listarSeguindoUsuario);

router.get('/pet/:id/seguidores', explorarController.listarSeguidoresPet);
router.get('/pet/:id/seguindo', explorarController.listarSeguindoPet);
router.get('/pet/:id', explorarController.perfilPet);

router.get('/api/usuarios', explorarController.buscarUsuarios);
router.get('/api/pets', explorarController.buscarPets);

router.post('/pet/:id/seguir', estaAutenticadoAPI, explorarController.seguirPet);
router.delete('/pet/:id/seguir', estaAutenticadoAPI, explorarController.deixarDeSeguirPet);
router.delete('/pet/:id/petshops/:petshopId', estaAutenticadoAPI, explorarController.desvincularPetshop);
router.post('/pet/:id/capa', estaAutenticadoAPI, function (req, res, next) {
  uploadPetCover.single('foto_capa')(req, res, function (err) {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Imagem muito grande (máx. 8 MB).'
        : 'Envie uma capa válida (JPEG, PNG ou WebP).';
      return res.status(400).json({ sucesso: false, mensagem: msg });
    }
    next();
  });
}, explorarController.atualizarCapaPet);
router.delete('/pet/:id/seguidor/:usuarioId', estaAutenticadoAPI, explorarController.removerSeguidorPet);

router.get('/busca', explorarController.paginaBusca);

module.exports = router;
