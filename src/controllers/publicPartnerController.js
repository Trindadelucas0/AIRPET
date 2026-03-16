const petshopOnboardingService = require('../services/petshopOnboardingService');
const PetshopPartnerRequest = require('../models/PetshopPartnerRequest');
const logger = require('../utils/logger');

const publicPartnerController = {
  mostrarFormulario(req, res) {
    return res.render('parceiros/cadastro', {
      titulo: 'Cadastro de Petshop Parceiro',
      formData: {},
    });
  },

  async enviarSolicitacao(req, res) {
    try {
      await petshopOnboardingService.criarSolicitacao(req.body || {}, req.files || {});
      return res.render('parceiros/sucesso', { titulo: 'Solicitação enviada' });
    } catch (erro) {
      logger.error('PublicPartnerController', 'Erro ao enviar solicitação de parceria', erro);
      let mensagem = 'Não foi possível enviar sua solicitação.';
      if (erro && erro.message && /latitude|longitude|localiza/i.test(erro.message)) {
        mensagem = 'Não conseguimos validar a localização. Tente usar o mapa novamente antes de enviar.';
      }
      return res.status(400).render('parceiros/cadastro', {
        titulo: 'Cadastro de Petshop Parceiro',
        formData: req.body || {},
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
