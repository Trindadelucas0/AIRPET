const petshopOnboardingService = require('../services/petshopOnboardingService');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

const publicPartnerController = {
  mostrarFormulario(req, res) {
    return res.render('parceiros/cadastro', {
      titulo: 'Cadastro de Petshop Parceiro',
      formData: {},
    });
  },

  async enviarSolicitacao(req, res) {
    try {
      const body = req.body || {};
      const solicitacao = await petshopOnboardingService.criarSolicitacao(body, req.files || {});

      const emailContato = String(body.email || body.email_login || '').trim().toLowerCase();
      if (emailContato) {
        try {
          await emailService.enviarParceiroRecebido({
            to: emailContato,
            empresaNome: body.empresa_nome,
            responsavelNome: body.responsavel_nome,
          });
        } catch (emailErro) {
          logger.error('PublicPartnerController', 'Falha ao enviar e-mail de confirmação de parceria', emailErro);
        }
      }

      return res.render('parceiros/sucesso', { titulo: 'Solicitação enviada' });
    } catch (erro) {
      logger.error('PublicPartnerController', 'Erro ao enviar solicitação de parceria', erro);
      const body = req.body || {};

      // Erro específico: e-mail de acesso ao painel já existe
      if (erro && erro.message === 'Já existe uma conta com este e-mail de acesso.') {
        const fieldErrors = {
          email_login: 'Já existe uma conta com este e-mail de acesso. Use outro e-mail para o painel ou acesse com a conta existente.',
        };
        return res.status(400).render('parceiros/cadastro', {
          titulo: 'Cadastro de Petshop Parceiro',
          formData: body,
          fieldErrors,
        });
      }

      let mensagem = 'Não foi possível enviar sua solicitação. Revise os campos destacados ou tente novamente em alguns instantes.';
      if (erro && erro.message && /latitude|longitude|localiza/i.test(erro.message)) {
        mensagem = 'Não conseguimos validar a localização. Tente usar o mapa novamente antes de enviar.';
      }
      return res.status(400).render('parceiros/cadastro', {
        titulo: 'Cadastro de Petshop Parceiro',
        formData: body,
        localError: mensagem,
      });
    }
  },

  async apiStatus(req, res) {
    try {
      const request = await PetshopPartnerRequest.buscarPorId(req.params.id);
      if (!request) return res.status(404).json({ sucesso: false, mensagem: 'Solicitação não encontrada.' });
      return res.json({ sucesso: true, status: request.status, atualizado_em: request.data_atualizacao || request.data_criacao });
    } catch (erro) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao consultar status.' });
    }
  },
};

module.exports = publicPartnerController;
