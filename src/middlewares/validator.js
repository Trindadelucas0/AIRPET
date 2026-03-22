/**
 * validator.js — Cadeias de validacao para formularios e APIs
 *
 * Usa o express-validator para definir regras de validacao de dados
 * recebidos nas requisicoes (body). Cada cadeia de validacao e um array
 * de middlewares que o Express executa em sequencia antes do controlador.
 */

const { body, validationResult } = require('express-validator');

/**
 * Resposta unificada para falhas de validacao (flash + redirect ou JSON 422).
 */
function responderValidacaoFalha(req, res, listaErros) {
  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(422).json({
      sucesso: false,
      erros: listaErros,
    });
  }
  if (req.session) {
    req.session.flash = { tipo: 'erro', mensagem: listaErros.join(' | ') };
  }
  const voltar = req.get('Referer') || '/';
  return res.redirect(voltar);
}

/**
 * Rejeita chaves no body que nao estao na lista permitida (whitelist).
 * Deve vir antes das cadeias body() por campo, ou depois — usamos antes
 * para falhar cedo. Coloque apos parsers (json/urlencoded/multer).
 */
function camposPermitidos(allowedKeys) {
  const set = new Set(allowedKeys);
  return (req, res, next) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return next();
    const extras = Object.keys(b).filter((k) => !set.has(k));
    if (extras.length === 0) return next();
    return responderValidacaoFalha(req, res, [`Campos nao permitidos: ${extras.join(', ')}`]);
  };
}

/**
 * Igual a camposPermitidos, mas aplica uma funcao (chave) => boolean.
 */
function camposPermitidosSe(predicado) {
  return (req, res, next) => {
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return next();
    const extras = Object.keys(b).filter((k) => !predicado(k));
    if (extras.length === 0) return next();
    return responderValidacaoFalha(req, res, [`Campos nao permitidos: ${extras.join(', ')}`]);
  };
}

const validarRegistro = [
  body('nome')
    .trim()
    .isLength({ min: 2 })
    .withMessage('O nome deve ter pelo menos 2 caracteres.'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Informe um endereco de e-mail valido.')
    .normalizeEmail(),

  body('senha')
    .isLength({ min: 6 })
    .withMessage('A senha deve ter pelo menos 6 caracteres.'),

  body('telefone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10 })
    .withMessage('O telefone deve ter pelo menos 10 digitos (com DDD).'),

  body('cep')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 8, max: 9 })
    .withMessage('CEP invalido.'),

  body('endereco')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Endereco muito longo.'),

  body('bairro')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Bairro muito longo.'),

  body('cidade')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Cidade muito longa.'),

  body('estado')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 2 })
    .withMessage('Use a sigla do estado (2 letras).'),

  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 160 })
    .withMessage('A bio deve ter no maximo 160 caracteres.'),
];

const CAMPOS_REGISTRO = [
  'nome', 'email', 'senha', 'telefone', 'cep', 'endereco', 'bairro', 'cidade', 'estado', 'bio',
];

const validarLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Informe um endereco de e-mail valido.')
    .normalizeEmail(),

  body('senha')
    .notEmpty()
    .withMessage('A senha e obrigatoria.'),

  body('returnUrl')
    .optional({ checkFalsy: true })
    .trim()
    .custom((v) => {
      if (!v || (v.startsWith('/') && !v.startsWith('//'))) return true;
      throw new Error('URL de retorno invalida.');
    }),
];

const CAMPOS_LOGIN = ['email', 'senha', 'returnUrl'];

const validarEsqueciSenha = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Informe um endereco de e-mail valido.')
    .normalizeEmail(),
];

const CAMPOS_ESQUECI_SENHA = ['email'];

const validarRedefinirSenha = [
  body('senha')
    .isLength({ min: 6 })
    .withMessage('A senha deve ter pelo menos 6 caracteres.'),

  body('confirmar_senha')
    .notEmpty()
    .withMessage('Confirme a senha.'),
];

const CAMPOS_REDEFINIR_SENHA = ['senha', 'confirmar_senha'];

const CAMPOS_PET_FORM = [
  'nome', 'tipo', 'tipo_custom', 'raca', 'cor', 'porte', 'sexo', 'dataNascimento', 'peso', 'descricao',
  'telefoneContato', 'microchip', 'castrado', 'alergias_medicacoes', 'veterinario_nome', 'veterinario_telefone',
  'observacoes', '_method',
];

const validarPet = [
  body('nome')
    .trim()
    .notEmpty()
    .withMessage('O nome do pet e obrigatorio.'),

  body('tipo')
    .optional({ checkFalsy: true })
    .trim(),

  body('raca')
    .optional({ checkFalsy: true })
    .trim(),

  body('tipo_custom').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('cor').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
  body('porte').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('sexo').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('dataNascimento').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('peso').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('telefoneContato').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('microchip').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('castrado').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('alergias_medicacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('veterinario_nome').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('veterinario_telefone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPerfil = [
  body('nome')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2 })
    .withMessage('O nome deve ter pelo menos 2 caracteres.'),

  body('telefone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10 })
    .withMessage('O telefone deve ter pelo menos 10 digitos (com DDD).'),

  body('cep')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 8, max: 9 })
    .withMessage('CEP invalido.'),

  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 160 })
    .withMessage('A bio deve ter no maximo 160 caracteres.'),

  body('endereco').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('bairro').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('cidade').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('estado').optional({ checkFalsy: true }).trim().isLength({ max: 2 }),
  body('cor_perfil').optional({ checkFalsy: true }).trim().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Cor de perfil invalida.'),
  body('data_nascimento').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('contato_extra').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('receber_alertas_pet_perdido').optional(),
];

const CAMPOS_PERFIL = [
  'nome', 'telefone', 'cep', 'bio', 'endereco', 'bairro', 'cidade', 'estado', 'cor_perfil',
  'data_nascimento', 'contato_extra', 'receber_alertas_pet_perdido', '_method',
];

function validarResultado(req, res, next) {
  const erros = validationResult(req);
  if (erros.isEmpty()) {
    return next();
  }
  const listaErros = erros.array().map((erro) => erro.msg);
  return responderValidacaoFalha(req, res, listaErros);
}

/** Chaves de configuracao admin: alfanumerico + underscore, ou objeto config aninhado */
function predicadoAdminConfigKey(k) {
  if (k === 'config') return true;
  return /^[a-z0-9_]{1,80}$/i.test(k);
}

module.exports = {
  validarRegistro,
  validarLogin,
  validarPet,
  validarPerfil,
  validarResultado,
  responderValidacaoFalha,
  camposPermitidos,
  camposPermitidosSe,
  CAMPOS_REGISTRO,
  CAMPOS_LOGIN,
  validarEsqueciSenha,
  validarRedefinirSenha,
  CAMPOS_ESQUECI_SENHA,
  CAMPOS_REDEFINIR_SENHA,
  CAMPOS_PET_FORM,
  CAMPOS_PERFIL,
  predicadoAdminConfigKey,
};
