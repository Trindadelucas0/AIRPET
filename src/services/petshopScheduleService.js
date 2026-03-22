const PetshopService = require('../models/PetshopService');
const PetshopScheduleRule = require('../models/PetshopScheduleRule');

const petshopScheduleService = {
  async salvarServico(petshopId, dados) {
    return PetshopService.criar({
      petshop_id: petshopId,
      nome: dados.nome,
      descricao: dados.descricao,
      duracao_minutos: dados.duracao_minutos,
      preco_base: dados.preco_base,
    });
  },

  async salvarRegraSemanal(petshopId, regra) {
    return PetshopScheduleRule.upsertSemanal(petshopId, regra);
  },
};

module.exports = petshopScheduleService;
