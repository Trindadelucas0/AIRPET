const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const tagController = require('../controllers/tagController');
const tagCommerceController = require('../controllers/tagCommerceController');
const { estaAutenticado } = require('../middlewares/authMiddleware');
const { apenasAdmin } = require('../middlewares/adminMiddleware');
const { limiterAtivacao } = require('../middlewares/rateLimiter');
const { persistSingle } = require('../middlewares/persistUploadMiddleware');
const {
  validarTagGerarLote,
  validarTagReservar,
  validarTagEnviarBloquear,
  validarTagChegou,
  validarTagAtivar,
  validarTagVincularPet,
  validarResultado,
} = require('../middlewares/writeRouteValidators');
const tagEntitlementService = require('../services/tagEntitlementService');

const uploadTagPrint = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname || '').toLowerCase()) && allowed.test(file.mimetype));
  },
});

// --- Rotas administrativas (devem vir antes das rotas com parâmetro dinâmico) ---
router.get('/admin/lista', estaAutenticado, apenasAdmin, tagController.listarTags);
router.get('/admin/lotes', estaAutenticado, apenasAdmin, tagController.listarLotes);
router.get('/admin/lote/:id', estaAutenticado, apenasAdmin, tagController.mostrarLote);
router.post('/admin/gerar', estaAutenticado, apenasAdmin, ...validarTagGerarLote, validarResultado, tagController.gerarLote);
router.post('/admin/:id/reservar', estaAutenticado, apenasAdmin, ...validarTagReservar, validarResultado, tagController.reservar);
router.post('/admin/:id/enviar', estaAutenticado, apenasAdmin, ...validarTagEnviarBloquear, validarResultado, tagController.enviar);
router.post('/admin/:id/bloquear', estaAutenticado, apenasAdmin, ...validarTagEnviarBloquear, validarResultado, tagController.bloquear);
router.post('/admin/:id/desbloquear', estaAutenticado, apenasAdmin, ...validarTagEnviarBloquear, validarResultado, tagController.desbloquear);
router.get('/admin/commerce/pedidos', estaAutenticado, apenasAdmin, tagCommerceController.adminListarPedidos);
router.get('/admin/commerce/pedidos/:id', estaAutenticado, apenasAdmin, tagCommerceController.adminDetalhePedido);
router.post('/admin/commerce/pedidos/:id/nf', estaAutenticado, apenasAdmin, tagCommerceController.adminSalvarNotaFiscal);
router.get('/admin/commerce/cupons', estaAutenticado, apenasAdmin, tagCommerceController.adminListarCupons);
router.post('/admin/commerce/cupons', estaAutenticado, apenasAdmin, tagCommerceController.adminCriarCupom);
router.post('/admin/commerce/cupons/:id', estaAutenticado, apenasAdmin, tagCommerceController.adminAtualizarCupom);

// --- Rotas comerciais TAG (venda, pedidos, assinatura) ---
router.get('/loja-tag', tagCommerceController.mostrarLoja);
router.get('/planos', tagCommerceController.mostrarPlanos);
router.post('/pedidos', estaAutenticado, tagCommerceController.criarPedido);
router.get('/pedidos', estaAutenticado, tagCommerceController.listarPedidos);
router.get('/pedidos/:id', estaAutenticado, tagCommerceController.detalhePedido);
router.post(
  '/pedidos/:id/unidades/:unitId/personalizar',
  estaAutenticado,
  (req, res, next) => uploadTagPrint.single('foto_tag')(req, res, next),
  persistSingle('tag-print'),
  tagCommerceController.personalizarUnidade
);
router.post('/pagamentos/webhook/infinitepay', tagCommerceController.webhookInfinitePay);
router.get('/pagamentos/retorno', tagCommerceController.retornoPagamento);
router.get('/premium/estado', estaAutenticado, tagEntitlementService.requirePlanoAtivo.bind(tagEntitlementService), (req, res) => {
  return res.json({ ok: true, entitlement: req.tagEntitlement });
});

// --- Rotas de ativação e vinculação (usuário autenticado) ---
router.get('/minhas', estaAutenticado, tagController.minhasTags);
router.post('/:tag_code/chegou', estaAutenticado, ...validarTagChegou, validarResultado, tagController.minhaTagChegou);
router.get('/:tag_code/ativar', estaAutenticado, tagController.mostrarAtivacao);
router.post('/:tag_code/ativar', estaAutenticado, limiterAtivacao, ...validarTagAtivar, validarResultado, tagController.ativar);
router.get('/:tag_code/escolher-pet', estaAutenticado, tagController.escolherPet);
router.post('/:tag_code/vincular-pet', estaAutenticado, ...validarTagVincularPet, validarResultado, tagController.vincularPet);

module.exports = router;
