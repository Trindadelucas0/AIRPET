/**
 * Validadores para rotas de escrita (POST/PUT) — express-validator + whitelist.
 */

const { body } = require('express-validator');
const { camposPermitidos, validarResultado } = require('./validator');

const validarLocalizacaoApi = [
  camposPermitidos(['pet_id', 'latitude', 'longitude', 'origem', 'cidade']),
  body('pet_id').notEmpty().withMessage('pet_id e obrigatorio.'),
  body('latitude').notEmpty().withMessage('latitude e obrigatoria.'),
  body('longitude').notEmpty().withMessage('longitude e obrigatoria.'),
  body('origem').optional({ checkFalsy: true }).trim().isIn(['nfc', 'gps', 'manual', 'encontrador']).withMessage('Origem invalida.'),
  body('cidade').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
];

const validarNfcLocalizacaoPublica = [
  camposPermitidos(['latitude', 'longitude']),
  body('latitude').notEmpty().withMessage('Latitude e longitude sao obrigatorias.'),
  body('longitude').notEmpty().withMessage('Latitude e longitude sao obrigatorias.'),
];

const CAMPOS_NFC_ENCONTREI = ['nome', 'telefone', 'mensagem', 'latitude', 'longitude'];
const validarNfcEncontrei = [
  camposPermitidos(CAMPOS_NFC_ENCONTREI),
  body('nome').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('telefone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('mensagem').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('latitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('longitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
];

const validarNfcEnviarFoto = [camposPermitidos([])];

const validarPetPerdidoReportar = [
  camposPermitidos(['descricao', 'latitude', 'longitude', 'local_descricao', 'recompensa', '_method']),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('latitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('longitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('local_descricao').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('recompensa').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
];

const validarPetPerdidoEncontrado = [
  camposPermitidos([
    'como_encontrado',
    'descricao_encontrado',
    'mensagem_agradecimento',
    'latitude',
    'longitude',
    'local_descricao',
    '_method',
  ]),
  body('como_encontrado').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('descricao_encontrado').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('mensagem_agradecimento').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('latitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('longitude').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('local_descricao').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
];

const validarPetPerdidoResolver = [camposPermitidos(['_method'])];

const validarChatIniciar = [
  camposPermitidos(['pet_perdido_id', '_method']),
  body('pet_perdido_id').notEmpty().withMessage('ID do alerta e obrigatorio.'),
];

const validarChatEnviar = [
  camposPermitidos(['conteudo', '_method']),
  body('conteudo').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
];

const RE_LINK = /(https?:\/\/|www\.)/i;
const CAMPOS_CHAT_VISITANTE = ['pet_perdido_id', 'conversa_id', 'token', 'guest_nome', 'conteudo', 'template', 'website'];
const validarChatVisitante = [
  camposPermitidos(CAMPOS_CHAT_VISITANTE),
  body('pet_perdido_id').optional({ checkFalsy: true }).trim().isInt({ min: 1 }).withMessage('ID do alerta invalido.'),
  body('conversa_id').optional({ checkFalsy: true }).trim().isInt({ min: 1 }).withMessage('ID da conversa invalido.'),
  body('token').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Token invalido.'),
  body('guest_nome').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Nome muito longo.'),
  body('template').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('website').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('conteudo')
    .trim()
    .notEmpty()
    .withMessage('Digite uma mensagem.')
    .isLength({ min: 4, max: 500 })
    .withMessage('A mensagem precisa ter entre 4 e 500 caracteres.')
    .custom((v) => {
      if (RE_LINK.test(String(v || ''))) throw new Error('Nao envie links na mensagem.');
      return true;
    }),
  body().custom((_, { req }) => {
    if (String(req.body?.website || '').trim()) {
      throw new Error('Envio invalido.');
    }
    return true;
  }),
];

const validarNotifMarcarLida = [camposPermitidos([])];
const validarNotifMarcarTodas = [camposPermitidos([])];

const validarPushSubscribe = [
  camposPermitidos(['subscription']),
  body('subscription').isObject().withMessage('Subscription invalida.'),
  body('subscription.endpoint').optional().isString().isLength({ max: 2048 }),
];

const validarPushUnsubscribe = [
  camposPermitidos(['endpoint']),
  body('endpoint').trim().notEmpty().withMessage('Endpoint e obrigatorio.').isLength({ max: 2048 }),
];

const validarSaudeVacina = [
  camposPermitidos([
    'nome_vacina', 'data_aplicacao', 'data_proxima', 'veterinario', 'clinica', 'observacoes', '_method',
  ]),
  body('nome_vacina').trim().notEmpty().withMessage('Nome da vacina e obrigatorio.').isLength({ max: 200 }),
  body('data_aplicacao').trim().notEmpty().withMessage('Data de aplicacao e obrigatoria.').isLength({ max: 32 }),
  body('data_proxima').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('veterinario').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('clinica').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarSaudeRegistro = [
  camposPermitidos([
    'tipo', 'descricao', 'data_registro', 'veterinario', 'clinica', 'observacoes', '_method',
  ]),
  body('tipo').trim().notEmpty().withMessage('Tipo e obrigatorio.').isLength({ max: 50 }),
  body('data_registro').trim().notEmpty().withMessage('Data do registro e obrigatoria.').isLength({ max: 32 }),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('veterinario').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('clinica').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarAgendaCriar = [
  camposPermitidos(['petshop_id', 'pet_id', 'service_id', 'data', 'data_agendada', 'observacoes', '_method']),
  body('petshop_id').notEmpty().withMessage('Petshop e obrigatorio.'),
  body('service_id').notEmpty().withMessage('Servico e obrigatorio.'),
  body('data').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
  body('data_agendada').optional({ checkFalsy: true }).trim().isLength({ max: 64 }),
  body('pet_id').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body().custom((_, { req }) => {
    const valor = String(req.body?.data_agendada || req.body?.data || '').trim();
    if (!valor) throw new Error('Data e obrigatoria.');
    return true;
  }),
];

const validarAgendaSemBody = [camposPermitidos(['_method'])];

const validarVincularTag = [
  camposPermitidos(['tag_code', 'codigo_ativacao', 'activation_code', '_method']),
  body('tag_code').trim().notEmpty().withMessage('Codigo da tag e obrigatorio.').isLength({ max: 40 }),
  body('codigo_ativacao').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('activation_code').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
];

const validarTagAtivar = [
  camposPermitidos(['activation_code', 'codigo_ativacao', '_method']),
  body('activation_code').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('codigo_ativacao').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body().custom((_, { req }) => {
    const a = req.body?.activation_code || req.body?.codigo_ativacao;
    if (!a || !String(a).trim()) throw new Error('Codigo de ativacao e obrigatorio.');
    return true;
  }),
];

const validarTagVincularPet = [
  camposPermitidos(['pet_id', '_method']),
  body('pet_id').notEmpty().withMessage('pet_id e obrigatorio.'),
];

const validarTagChegou = [camposPermitidos(['_method'])];

const validarTagGerarLote = [
  camposPermitidos(['codigo_lote', 'quantidade', 'fabricante', 'observacoes', '_method']),
  body('codigo_lote').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
  body('quantidade').notEmpty().withMessage('Quantidade e obrigatoria.'),
  body('fabricante').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarTagReservar = [
  camposPermitidos(['email', '_method']),
  body('email').optional({ checkFalsy: true }).trim().isEmail(),
];

const validarTagEnviarBloquear = [camposPermitidos(['_method'])];

const validarPerfilGaleriaPost = [camposPermitidos(['pet_id', '_method'])];
const validarPerfilGaleriaBody = [
  body('pet_id').notEmpty().withMessage('pet_id e obrigatorio.'),
];

const validarParceiroCadastro = [
  camposPermitidos([
    'endereco', 'bairro', 'cidade', 'estado', 'cep', 'latitude', 'longitude',
    'email_login', 'email', 'senha', 'confirmar_senha', 'empresa_nome', 'responsavel_nome',
    'telefone', 'descricao', 'instagram', 'facebook', 'website', 'servicos', 'horario_funcionamento',
    'empresa_documento', 'responsavel_cargo', 'location_mode',
    '_method',
  ]),
  body('empresa_nome').trim().notEmpty().withMessage('Nome da empresa e obrigatorio.').isLength({ max: 200 }),
  body('endereco').trim().notEmpty().withMessage('Endereco e obrigatorio.').isLength({ max: 300 }),
  body('email_login').trim().notEmpty().withMessage('E-mail de acesso e obrigatorio.').isEmail(),
  body('senha').isLength({ min: 6 }).withMessage('A senha deve ter pelo menos 6 caracteres.'),
  body('confirmar_senha').notEmpty().withMessage('Confirme a senha.'),
  body('latitude').notEmpty(),
  body('longitude').notEmpty(),
  body('bairro').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('cidade').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('estado').optional({ checkFalsy: true }).trim().isLength({ max: 2 }),
  body('cep').optional({ checkFalsy: true }).trim().isLength({ max: 12 }),
  body('email').optional({ checkFalsy: true }).trim().isEmail(),
  body('responsavel_nome').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('empresa_documento').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('responsavel_cargo').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('location_mode').optional({ checkFalsy: true }).trim().isIn(['auto', 'manual']).withMessage('Modo de localização inválido.'),
  body('telefone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('instagram').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('facebook').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('website').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('servicos').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('horario_funcionamento').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPetshopLogin = [
  camposPermitidos(['email', 'senha', '_method']),
  body('email').trim().notEmpty().withMessage('E-mail e obrigatorio.').isEmail(),
  body('senha').notEmpty().withMessage('Senha e obrigatoria.'),
];

const validarPetshopPerfil = [
  camposPermitidos([
    'slogan', 'descricao_curta', 'descricao_longa', 'instagram_url', 'facebook_url', 'website_url',
    'whatsapp_publico', 'contato_link', 'aceita_agendamento',
    'petshop_nome', 'petshop_telefone', 'petshop_endereco', 'petshop_descricao',
    '_method',
  ]),
  body('slogan').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('descricao_curta').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('descricao_longa').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('instagram_url').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('facebook_url').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('website_url').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('whatsapp_publico').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('petshop_nome').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('petshop_telefone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('petshop_endereco').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('petshop_descricao').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('contato_link').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('aceita_agendamento').optional(),
];

const validarPetshopServico = [
  camposPermitidos(['nome', 'descricao', 'duracao_minutos', 'preco_base', '_method']),
  body('nome').trim().notEmpty().withMessage('Nome do servico e obrigatorio.').isLength({ max: 200 }),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('duracao_minutos').optional({ checkFalsy: true }),
  body('preco_base').optional({ checkFalsy: true }),
];

const validarPetshopAgendaCriar = [
  camposPermitidos(['service_id', 'usuario_id', 'pet_id', 'observacoes', 'data_agendada', '_method']),
  body('service_id').notEmpty(),
  body('usuario_id').notEmpty(),
  body('data_agendada').trim().notEmpty().withMessage('Data e obrigatoria.').isLength({ max: 64 }),
  body('pet_id').optional({ checkFalsy: true }),
  body('observacoes').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPetshopAgendaStatus = [
  camposPermitidos(['status', 'motivo_recusa', '_method']),
  body('status').trim().notEmpty().withMessage('Status e obrigatorio.').isLength({ max: 40 }),
  body('motivo_recusa').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPetshopAgendaConfig = [
  camposPermitidos([
    'dia_0_ativo', 'dia_0_abre', 'dia_0_fecha', 'dia_0_intervalo_inicio', 'dia_0_intervalo_fim',
    'dia_1_ativo', 'dia_1_abre', 'dia_1_fecha', 'dia_1_intervalo_inicio', 'dia_1_intervalo_fim',
    'dia_2_ativo', 'dia_2_abre', 'dia_2_fecha', 'dia_2_intervalo_inicio', 'dia_2_intervalo_fim',
    'dia_3_ativo', 'dia_3_abre', 'dia_3_fecha', 'dia_3_intervalo_inicio', 'dia_3_intervalo_fim',
    'dia_4_ativo', 'dia_4_abre', 'dia_4_fecha', 'dia_4_intervalo_inicio', 'dia_4_intervalo_fim',
    'dia_5_ativo', 'dia_5_abre', 'dia_5_fecha', 'dia_5_intervalo_inicio', 'dia_5_intervalo_fim',
    'dia_6_ativo', 'dia_6_abre', 'dia_6_fecha', 'dia_6_intervalo_inicio', 'dia_6_intervalo_fim',
    '_method',
  ]),
];

const validarPetshopAgendaBloqueio = [
  camposPermitidos(['service_id', 'inicio', 'fim', 'motivo', '_method']),
  body('service_id').optional({ checkFalsy: true }),
  body('inicio').trim().notEmpty().withMessage('Início e obrigatório.').isLength({ max: 64 }),
  body('fim').trim().notEmpty().withMessage('Fim e obrigatório.').isLength({ max: 64 }),
  body('motivo').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
];

const validarPetshopPost = [
  camposPermitidos([
    'post_type', 'titulo', 'texto', 'nome_produto', 'descricao_produto', 'preco', 'contato_link',
    'service_id', 'highlight_rank', 'is_highlighted', 'relevante', '_method',
  ]),
  body('post_type').optional({ checkFalsy: true }).trim().isIn(['normal', 'produto', 'promocao', 'evento']),
  body('titulo').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('texto').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('nome_produto').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('descricao_produto').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('preco').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('contato_link').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('service_id').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('highlight_rank').optional({ checkFalsy: true }).trim().isLength({ max: 10 }),
  body('is_highlighted').optional(),
  body('relevante').optional(),
];

const validarExplorarPostV1 = [
  camposPermitidos(['texto', 'text', 'pet_id']),
  body('texto').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('text').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('pet_id').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body().custom((_, { req }) => {
    const t = String(req.body?.texto || req.body?.text || '').trim();
    if (!t && !req.file) throw new Error('Escreva algo ou envie uma imagem.');
    return true;
  }),
];

const validarExplorarPostV2 = [
  camposPermitidos(['text', 'texto', 'pet_id', 'taggedUserIds']),
  body('text').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('texto').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('pet_id').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('taggedUserIds')
    .optional()
    .custom((v) => {
      if (v === undefined || v === null || v === '') return true;
      if (Array.isArray(v)) return true;
      if (typeof v === 'string') return true;
      throw new Error('taggedUserIds invalido.');
    }),
  body().custom((_, { req }) => {
    const t = String(req.body?.text || req.body?.texto || '').trim();
    const files = req.files;
    const n = Array.isArray(files) ? files.length : 0;
    if (!t && n === 0) throw new Error('Escreva algo ou envie midia.');
    return true;
  }),
];

const validarExplorarTexto = (campo = 'texto') => [
  camposPermitidos([campo, 'text']),
  body(campo).optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('text').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body().custom((_, { req }) => {
    const t = String(req.body?.[campo] || req.body?.text || '').trim();
    if (!t) throw new Error('Escreva algo.');
    return true;
  }),
];

const validarExplorarComentar = validarExplorarTexto('texto');

const validarExplorarComentarV2 = [
  camposPermitidos(['texto', 'text']),
  body('texto').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body('text').optional({ checkFalsy: true }).trim().isLength({ max: 8000 }),
  body().custom((_, { req }) => {
    const t = String(req.body?.texto || req.body?.text || '').trim();
    if (!t) throw new Error('Dados invalidos.');
    return true;
  }),
];

const validarExplorarResponderTag = [
  camposPermitidos(['tagId', 'action']),
  body('tagId').notEmpty().withMessage('tagId e obrigatorio.'),
  body('action').trim().notEmpty().isIn(['approve', 'reject']).withMessage('Acao invalida.'),
];

const validarExplorarVinculoPetshop = [
  camposPermitidos([
    'petshop_id', 'tipo_vinculo', 'principal', 'uso_frequente', 'atendimento_realizado', 'cadastro_no_petshop',
  ]),
  body('petshop_id').notEmpty().withMessage('petshop_id e obrigatorio.'),
  body('tipo_vinculo').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('principal').optional(),
  body('uso_frequente').optional(),
  body('atendimento_realizado').optional(),
  body('cadastro_no_petshop').optional(),
];

const validarExplorarView = [
  camposPermitidos(['postId', 'watchMs', 'city', 'source']),
  body('postId').notEmpty().withMessage('postId invalido.'),
  body('watchMs').optional().isInt({ min: 0, max: 86400000 }),
  body('city').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('source').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
];

const validarBodyVazioJson = [camposPermitidos([])];

const validarAdminLogin = [
  camposPermitidos(['email', 'senha']),
  body('email').trim().notEmpty().withMessage('E-mail e obrigatorio.'),
  body('senha').notEmpty().withMessage('Senha e obrigatoria.'),
];

const validarAdminBoost = [
  camposPermitidos([
    'target_type', 'target_id', 'selected_user_id', 'selected_pet_id', 'boost_value', 'duracao_horas', 'motivo', '_method',
  ]),
  body('target_type').trim().notEmpty().isLength({ max: 40 }),
  body('boost_value').notEmpty(),
  body('duracao_horas').notEmpty(),
  body('target_id').optional({ checkFalsy: true }),
  body('selected_user_id').optional({ checkFalsy: true }),
  body('selected_pet_id').optional({ checkFalsy: true }),
  body('motivo').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarAdminRejeitarPetshop = [
  camposPermitidos(['motivo', 'observacao', '_method']),
  body('motivo').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('observacao').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarAdminEscalar = [
  camposPermitidos(['nivel', '_method']),
  body('nivel').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
];

const validarAdminRole = [
  camposPermitidos(['role', '_method']),
  body('role').trim().notEmpty().withMessage('Papel e obrigatorio.').isLength({ max: 40 }),
];

const validarAdminAparencia = [
  camposPermitidos([
    'pwa_theme_color', 'pwa_background_color', 'app_primary_color', 'app_primary_hover_color',
    'app_accent_glow', 'app_green_color', 'app_red_color', 'app_purple_color', 'app_blue_color',
    'app_yellow_color', 'app_name', '_method',
  ]),
  body('pwa_theme_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('pwa_background_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_primary_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_primary_hover_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_accent_glow').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('app_green_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_red_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_purple_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_blue_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_yellow_color').optional({ checkFalsy: true }).trim().isLength({ max: 32 }),
  body('app_name').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
];

const validarAdminNotificacaoRegiao = [
  camposPermitidos([
    'titulo', 'mensagem', 'link', 'modo', 'lat', 'lng', 'raio_km',
    'estado', 'cidade', 'bairro', 'cep', 'endereco', 'modoRadio', '_method',
  ]),
  body('titulo').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('mensagem').trim().notEmpty().withMessage('Mensagem e obrigatoria.').isLength({ max: 2000 }),
  body('link').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('modo').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('modoRadio').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('lat').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('lng').optional({ checkFalsy: true }).trim().isLength({ max: 24 }),
  body('raio_km').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('estado').optional({ checkFalsy: true }).trim().isLength({ max: 4 }),
  body('cidade').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('bairro').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('cep').optional({ checkFalsy: true }).trim().isLength({ max: 12 }),
  body('endereco').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
];

const validarPontoMapa = [
  camposPermitidos([
    'nome', 'descricao', 'categoria', 'endereco', 'latitude', 'longitude', 'telefone', 'whatsapp', 'servicos', '_method',
  ]),
  body('nome').trim().notEmpty().withMessage('Nome e obrigatorio.').isLength({ max: 200 }),
  body('descricao').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('categoria').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('endereco').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('latitude').notEmpty().withMessage('Latitude e obrigatoria.'),
  body('longitude').notEmpty().withMessage('Longitude e obrigatoria.'),
  body('telefone').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('whatsapp').optional({ checkFalsy: true }).trim().isLength({ max: 30 }),
  body('servicos').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPetshopSeguir = [camposPermitidos(['_method'])];
const validarPetshopAvaliar = [
  camposPermitidos(['rating', 'pet_id', 'comentario', '_method']),
  body('rating').notEmpty().withMessage('Avaliacao e obrigatoria.'),
  body('pet_id').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('comentario').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
];

const validarPetshopSolicitarVinculo = [
  camposPermitidos(['pet_id', 'mensagem']),
  body('pet_id').notEmpty().withMessage('pet_id e obrigatorio.'),
  body('mensagem').optional({ checkFalsy: true }).trim().isLength({ max: 280 }),
];

module.exports = {
  validarLocalizacaoApi,
  validarNfcLocalizacaoPublica,
  validarNfcEncontrei,
  validarNfcEnviarFoto,
  validarPetPerdidoReportar,
  validarPetPerdidoEncontrado,
  validarPetPerdidoResolver,
  validarChatIniciar,
  validarChatEnviar,
  validarChatVisitante,
  validarNotifMarcarLida,
  validarNotifMarcarTodas,
  validarPushSubscribe,
  validarPushUnsubscribe,
  validarSaudeVacina,
  validarSaudeRegistro,
  validarAgendaCriar,
  validarAgendaSemBody,
  validarVincularTag,
  validarTagAtivar,
  validarTagVincularPet,
  validarTagChegou,
  validarTagGerarLote,
  validarTagReservar,
  validarTagEnviarBloquear,
  validarPerfilGaleriaPost,
  validarPerfilGaleriaBody,
  validarParceiroCadastro,
  validarPetshopLogin,
  validarPetshopPerfil,
  validarPetshopServico,
  validarPetshopAgendaCriar,
  validarPetshopAgendaStatus,
  validarPetshopAgendaConfig,
  validarPetshopAgendaBloqueio,
  validarPetshopPost,
  validarExplorarPostV1,
  validarExplorarPostV2,
  validarExplorarComentar,
  validarExplorarComentarV2,
  validarExplorarResponderTag,
  validarExplorarVinculoPetshop,
  validarExplorarView,
  validarBodyVazioJson,
  validarAdminLogin,
  validarAdminBoost,
  validarAdminRejeitarPetshop,
  validarAdminEscalar,
  validarAdminRole,
  validarAdminAparencia,
  validarAdminNotificacaoRegiao,
  validarPontoMapa,
  validarPetshopSeguir,
  validarPetshopAvaliar,
  validarPetshopSolicitarVinculo,
  validarResultado,
};
