/**
 * validator.js — Cadeias de validacao para formularios e APIs
 *
 * Usa o express-validator para definir regras de validacao de dados
 * recebidos nas requisicoes (body). Cada cadeia de validacao e um array
 * de middlewares que o Express executa em sequencia antes do controlador.
 *
 * As mensagens de erro estao todas em portugues para serem exibidas
 * diretamente ao usuario sem necessidade de traducao no frontend.
 *
 * Exporta:
 *   - validarRegistro: validacao do formulario de cadastro de usuario
 *   - validarLogin: validacao do formulario de login
 *   - validarPet: validacao do formulario de cadastro de pet
 *   - validarResultado: middleware que verifica se houve erros de validacao
 *     e retorna as mensagens de erro via flash (web) ou JSON (API)
 */

const { body, validationResult } = require('express-validator');

/**
 * validarRegistro — Regras de validacao para cadastro de novo usuario
 *
 * Campos validados:
 *   - nome: obrigatorio, minimo 2 caracteres (nomes muito curtos sao suspeitos)
 *   - email: obrigatorio, deve ser um email valido (formato usuario@dominio.com)
 *   - senha: obrigatoria, minimo 6 caracteres (balanco entre seguranca e usabilidade)
 *   - telefone: opcional, mas se fornecido deve ter pelo menos 10 digitos
 *     (formato brasileiro: DDD + numero, ex: 11999998888)
 *
 * O trim() remove espacos em branco no inicio e fim para evitar dados sujos.
 * O normalizeEmail() padroniza o email (lowercase, remove pontos do Gmail, etc).
 */
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

  body('bio')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 160 })
    .withMessage('A bio deve ter no maximo 160 caracteres.'),
];

/**
 * validarLogin — Regras de validacao para o formulario de login
 *
 * Validacao mais simples que o registro: apenas verifica se os campos
 * foram preenchidos corretamente. A verificacao de credenciais em si
 * (email existe? senha confere?) e feita no controlador de autenticacao.
 *
 * Campos validados:
 *   - email: obrigatorio, formato de email valido
 *   - senha: obrigatoria, nao pode estar vazia
 */
const validarLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Informe um endereco de e-mail valido.')
    .normalizeEmail(),

  body('senha')
    .notEmpty()
    .withMessage('A senha e obrigatoria.'),
];

/**
 * validarPet — Regras de validacao para cadastro/edicao de pet
 *
 * O nome do pet e o unico campo obrigatorio, pois e essencial
 * para identificacao na tag NFC. Os demais campos (tipo e raca)
 * sao opcionais porque o dono pode nao saber a raca exata.
 *
 * Campos validados:
 *   - nome: obrigatorio, minimo 1 caractere (nao pode ser vazio)
 *   - tipo: opcional, ex: "cachorro", "gato", "passaro"
 *   - raca: opcional, ex: "Labrador", "Siames"
 */
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
];

/**
 * validarPerfil — Regras de validacao para edicao de perfil (dados do dono)
 *
 * Campos validados:
 *   - nome: obrigatorio, minimo 2 caracteres
 *   - telefone: opcional, se fornecido minimo 10 digitos
 *   - cep: opcional, se fornecido 8 ou 9 caracteres (com ou sem traco)
 *   - bio: opcional, maximo 160 caracteres
 */
const validarPerfil = [
  body('nome')
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
];

/**
 * validarResultado — Middleware que processa os erros de validacao
 *
 * Deve ser colocado APOS as cadeias de validacao e ANTES do controlador.
 * Exemplo de uso na rota:
 *   router.post('/registro', validarRegistro, validarResultado, controlador);
 *
 * Fluxo:
 *   1. Coleta todos os erros gerados pelas cadeias de validacao anteriores
 *   2. Se nao houver erros, chama next() para seguir para o controlador
 *   3. Se houver erros, decide como retorna-los:
 *      - Se a requisicao aceita JSON (fetch/axios), retorna erros como JSON 422
 *      - Se for requisicao web normal, envia erros via flash e redireciona de volta
 *
 * O status 422 (Unprocessable Entity) indica que o servidor entendeu a
 * requisicao mas os dados enviados nao passaram na validacao.
 *
 * @param {object} req - Requisicao do Express
 * @param {object} res - Resposta do Express
 * @param {function} next - Proximo middleware na cadeia
 */
function validarResultado(req, res, next) {
  // Coleta todos os erros de validacao acumulados pelas cadeias anteriores
  const erros = validationResult(req);

  // Se nao houver erros, prossegue normalmente para o controlador
  if (erros.isEmpty()) {
    return next();
  }

  // Extrai apenas as mensagens de erro em um array simples
  // O express-validator retorna objetos com { msg, param, location, value }
  // mas para exibicao ao usuario precisamos apenas das mensagens (msg)
  const listaErros = erros.array().map((erro) => erro.msg);

  // Verifica se a requisicao espera uma resposta JSON
  // Isso acontece quando o frontend usa fetch/axios com header Accept: application/json
  if (req.accepts('json') && !req.accepts('html')) {
    // Retorna os erros como JSON com status 422 (dados invalidos)
    return res.status(422).json({
      sucesso: false,
      erros: listaErros,
    });
  }

  req.session.flash = { tipo: 'erro', mensagem: listaErros.join(' | ') };

  const voltar = req.get('Referer') || '/';
  return res.redirect(voltar);
}

module.exports = {
  validarRegistro,
  validarLogin,
  validarPet,
  validarPerfil,
  validarResultado,
};
