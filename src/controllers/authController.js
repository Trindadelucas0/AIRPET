/**
 * authController.js — Controller de autenticação do AIRPET
 *
 * Responsável por gerenciar todo o fluxo de autenticação:
 * registro de novos usuários, login, logout e controle de sessão.
 *
 * Fluxo de autenticação:
 *   1. Usuário acessa /auth/registro → mostrarRegistro()
 *   2. Envia formulário POST → registrar()
 *   3. Sessão é criada → redireciona para /pets
 *   4. Login posterior via /auth/login → login()
 *   5. Logout destrói sessão e cookie → logout()
 *
 * Dependências:
 *   - authService: lida com hash de senhas e validação de credenciais
 *   - logger: registra eventos de autenticação para auditoria
 */

const authService = require('../services/authService');
const Usuario = require('../models/Usuario');
const PetshopAccount = require('../models/PetshopAccount');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const resetTokens = new Map();

const authController = {

  /**
   * Renderiza a página de login.
   * Rota: GET /auth/login
   *
   * Se o usuário já estiver autenticado (sessão ativa),
   * redireciona diretamente para /pets em vez de mostrar o formulário.
   *
   * @param {object} req - Objeto de requisição do Express
   * @param {object} res - Objeto de resposta do Express
   */
  mostrarLogin(req, res) {
    try {
      if (req.session.usuario) {
        const returnUrl = (req.query.returnUrl || '').trim();
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
          return res.redirect(returnUrl);
        }
        return res.redirect('/explorar');
      }

      const returnUrl = (req.query.returnUrl || '').trim();
      res.render('auth/login', {
        titulo: 'Entrar no AIRPET',
        returnUrl: returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '',
      });
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao renderizar página de login', erro);
      res.status(500).render('partials/erro', {
        titulo: 'Erro interno',
        mensagem: 'Não foi possível carregar a página de login.',
        codigo: 500,
      });
    }
  },

  /**
   * Renderiza a página de registro (cadastro de novo usuário).
   * Rota: GET /auth/registro
   *
   * Se o usuário já estiver autenticado, redireciona para /pets.
   *
   * @param {object} req - Objeto de requisição do Express
   * @param {object} res - Objeto de resposta do Express
   */
  mostrarRegistro(req, res) {
    try {
      if (req.session.usuario) {
        return res.redirect('/explorar');
      }

      res.render('auth/registro', {
        titulo: 'Criar conta no AIRPET',
      });
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao renderizar página de registro', erro);
      res.status(500).render('partials/erro', {
        titulo: 'Erro interno',
        mensagem: 'Não foi possível carregar a página de registro.',
        codigo: 500,
      });
    }
  },

  /**
   * Processa o registro de um novo usuário.
   * Rota: POST /auth/registro
   *
   * Recebe nome, email, senha e telefone do formulário.
   * Chama authService.registrar() que:
   *   - Verifica se o e-mail já existe
   *   - Faz hash da senha com bcrypt
   *   - Cria o usuário no banco
   *
   * Em caso de sucesso, cria a sessão e redireciona para /pets.
   * Em caso de erro (email duplicado, etc.), retorna ao formulário com flash.
   *
   * @param {object} req - Objeto de requisição do Express (body contém os dados)
   * @param {object} res - Objeto de resposta do Express
   */
  async registrar(req, res) {
    try {
      /* Extrai os dados do corpo da requisição (formulário) */
      const { nome, email, senha, telefone, cep, endereco, bairro, cidade, estado, bio } = req.body;

      /* Chama o serviço de autenticação para criar o usuário */
      const resultado = await authService.registrar({ nome, email, senha, telefone, cep, endereco, bairro, cidade, estado, bio });

      /* Limite de usuários: exibe tela dedicada em vez de redirect com flash */
      if (resultado.codigo === 'limite_atingido') {
        return res.render('auth/limite-usuarios', {
          titulo: 'Cadastro temporariamente indisponível',
        });
      }

      /* Outros erros (ex: email já cadastrado) */
      if (resultado.erro) {
        req.session.flash = { tipo: 'erro', mensagem: resultado.erro };
        return res.redirect('/auth/registro');
      }

      /*
       * Cria a sessão do usuário com os dados essenciais.
       * Armazena apenas o necessário para evitar sessão pesada.
       */
      req.session.usuario = {
        id: resultado.usuario.id,
        nome: resultado.usuario.nome,
        email: resultado.usuario.email,
        role: resultado.usuario.role,
        cor_perfil: resultado.usuario.cor_perfil || '#ec5a1c',
        foto_perfil: resultado.usuario.foto_perfil || null,
      };

      req.session.verificarPermissoes = true;

      logger.info('AUTH_CTRL', `Novo usuário registrado: ${resultado.usuario.email}`);

      try {
        await emailService.enviarBoasVindas({
          to: resultado.usuario.email,
          nome: resultado.usuario.nome,
        });
      } catch (emailErro) {
        logger.error('AUTH_CTRL', 'Falha ao enviar e-mail de boas-vindas', emailErro);
      }

      req.session.flash = { tipo: 'sucesso', mensagem: 'Conta criada com sucesso! Bem-vindo ao AIRPET.' };
      res.redirect('/explorar');
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao registrar usuário', erro);

      /* Trata erro de constraint UNIQUE do PostgreSQL (email duplicado) */
      const msg = erro.message && erro.message.includes('usuarios_email_key')
        ? 'Este e-mail já está cadastrado. Tente fazer login.'
        : 'Erro ao criar conta. Tente novamente.';

      req.session.flash = { tipo: 'erro', mensagem: msg };
      res.redirect('/auth/registro');
    }
  },

  /**
   * Processa o login de um usuário existente.
   * Rota: POST /auth/login
   *
   * Recebe email e senha do formulário.
   * Chama authService.login() que:
   *   - Busca o usuário pelo e-mail
   *   - Compara a senha fornecida com o hash armazenado
   *   - Gera um token JWT se as credenciais estiverem corretas
   *
   * Em caso de sucesso:
   *   1. Cria a sessão do usuário
   *   2. Define um cookie HTTP-only com o JWT (para APIs futuras)
   *   3. Redireciona para /pets
   *
   * @param {object} req - Objeto de requisição do Express
   * @param {object} res - Objeto de resposta do Express
   */
  async login(req, res) {
    try {
      /* Extrai credenciais do formulário */
      const { email, senha } = req.body;

      /* Chama o serviço de autenticação para validar credenciais */
      const resultado = await authService.login({ email, senha });

      /* Verifica se o serviço retornou erro (credenciais inválidas) */
      if (resultado.erro) {
        req.session.flash = { tipo: 'erro', mensagem: resultado.erro };
        const returnUrl = (req.body.returnUrl || '').trim();
        const q = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? '?returnUrl=' + encodeURIComponent(returnUrl) : '';
        return res.redirect('/auth/login' + q);
      }

      /*
       * Cria a sessão com os dados essenciais do usuário.
       * Esses dados ficam disponíveis em req.session.usuario
       * e são passados para as views via res.locals (server.js).
       */
      req.session.usuario = {
        id: resultado.usuario.id,
        nome: resultado.usuario.nome,
        email: resultado.usuario.email,
        role: resultado.usuario.role,
        cor_perfil: resultado.usuario.cor_perfil || '#ec5a1c',
        foto_perfil: resultado.usuario.foto_perfil || null,
      };

      // Se o usuário tem conta de parceiro com mesmo e-mail e está ativo, preenche petshopAccount para alternância
      const petshopAccount = await PetshopAccount.buscarPorEmail(resultado.usuario.email);
      if (petshopAccount && petshopAccount.status === 'ativo') {
        req.session.petshopAccount = {
          id: petshopAccount.id,
          petshop_id: petshopAccount.petshop_id,
          email: petshopAccount.email,
          status: petshopAccount.status,
        };
      }

      /*
       * Define cookie HTTP-only com o JWT.
       * httpOnly: true impede acesso via JavaScript (proteção contra XSS).
       * secure: true em produção garante envio apenas via HTTPS.
       * maxAge: 24 horas em milissegundos.
       */
      if (resultado.token) {
        res.cookie('airpet_token', resultado.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: 'lax',
        });
      }

      req.session.verificarPermissoes = true;

      logger.info('AUTH_CTRL', `Login realizado: ${resultado.usuario.email}`);

      req.session.flash = { tipo: 'sucesso', mensagem: `Bem-vindo de volta, ${resultado.usuario.nome}!` };
      const returnUrl = (req.body.returnUrl || '').trim();
      const dest = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/explorar';
      return res.redirect(dest);
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao realizar login', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao fazer login. Tente novamente.' };
      res.redirect('/auth/login');
    }
  },

  /**
   * Realiza o logout do usuário.
   * Rota: POST /auth/logout (ou GET, conforme rota definida)
   *
   * Processo de logout:
   *   1. Destrói a sessão no servidor (remove do store)
   *   2. Limpa o cookie do JWT no navegador
   *   3. Redireciona para a página inicial
   *
   * @param {object} req - Objeto de requisição do Express
   * @param {object} res - Objeto de resposta do Express
   */
  mostrarEsqueciSenha(req, res) {
    if (req.session.usuario) return res.redirect('/pets');
    res.render('auth/esqueci-senha', { titulo: 'Recuperar Senha' });
  },

  async esqueciSenha(req, res) {
    try {
      const { email } = req.body;
      const usuario = await Usuario.buscarPorEmail(email);

      if (usuario) {
        const token = crypto.randomBytes(32).toString('hex');
        resetTokens.set(token, { userId: usuario.id, expira: Date.now() + 3600000 });

        const linkRedefinir = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/redefinir-senha/${token}`;
        logger.info('AUTH_CTRL', `Token de recuperação gerado para ${email}`);

        try {
          await emailService.enviarRedefinirSenha({
            to: email,
            nome: usuario.nome,
            linkRedefinir,
          });
        } catch (emailErro) {
          logger.error('AUTH_CTRL', 'Falha ao enviar e-mail de redefinição de senha', emailErro);
        }
      }

      req.session.flash = { tipo: 'sucesso', mensagem: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação. Verifique sua caixa de entrada.' };
      res.redirect('/auth/esqueci-senha');
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao processar recuperação de senha', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao processar a solicitação.' };
      res.redirect('/auth/esqueci-senha');
    }
  },

  mostrarRedefinirSenha(req, res) {
    const { token } = req.params;
    const dados = resetTokens.get(token);

    if (!dados || dados.expira < Date.now()) {
      req.session.flash = { tipo: 'erro', mensagem: 'Link de recuperação inválido ou expirado.' };
      return res.redirect('/auth/esqueci-senha');
    }

    res.render('auth/redefinir-senha', { titulo: 'Redefinir Senha', token });
  },

  async redefinirSenha(req, res) {
    try {
      const { token } = req.params;
      const { senha, confirmar_senha } = req.body;
      const dados = resetTokens.get(token);

      if (!dados || dados.expira < Date.now()) {
        req.session.flash = { tipo: 'erro', mensagem: 'Link de recuperação inválido ou expirado.' };
        return res.redirect('/auth/esqueci-senha');
      }

      if (senha !== confirmar_senha) {
        req.session.flash = { tipo: 'erro', mensagem: 'As senhas não conferem.' };
        return res.redirect(`/auth/redefinir-senha/${token}`);
      }

      if (senha.length < 6) {
        req.session.flash = { tipo: 'erro', mensagem: 'A senha deve ter no mínimo 6 caracteres.' };
        return res.redirect(`/auth/redefinir-senha/${token}`);
      }

      const senhaHash = await bcrypt.hash(senha, 12);
      const { query } = require('../config/database');
      await query('UPDATE usuarios SET senha_hash = $1, data_atualizacao = NOW() WHERE id = $2', [senhaHash, dados.userId]);

      resetTokens.delete(token);

      logger.info('AUTH_CTRL', `Senha redefinida para usuário ${dados.userId}`);

      req.session.flash = { tipo: 'sucesso', mensagem: 'Senha redefinida com sucesso! Faça login com sua nova senha.' };
      res.redirect('/auth/login');
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro ao redefinir senha', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao redefinir a senha.' };
      res.redirect('/auth/esqueci-senha');
    }
  },

  logout(req, res) {
    try {
      /* Captura o email antes de destruir a sessão para log */
      const emailUsuario = req.session.usuario?.email || 'desconhecido';

      /*
       * req.session.destroy() remove a sessão do store (memória/Redis).
       * O callback é chamado quando a destruição terminar.
       */
      req.session.destroy((erro) => {
        if (erro) {
          logger.error('AUTH_CTRL', 'Erro ao destruir sessão no logout', erro);
        }

        /* Limpa o cookie do JWT do navegador */
        res.clearCookie('airpet_token');

        /* Limpa o cookie da sessão (connect.sid) */
        res.clearCookie('connect.sid');

        logger.info('AUTH_CTRL', `Logout realizado: ${emailUsuario}`);

        /* Redireciona para a página inicial */
        res.redirect('/');
      });
    } catch (erro) {
      logger.error('AUTH_CTRL', 'Erro inesperado no logout', erro);
      res.redirect('/');
    }
  },
};

module.exports = authController;
