const PetshopService = require('../models/PetshopService');
const PetshopScheduleRule = require('../models/PetshopScheduleRule');
const PetshopScheduleBlock = require('../models/PetshopScheduleBlock');

const petshopScheduleService = {
  async salvarServico(petshopId, dados) {
    return PetshopService.criar({
      petshop_id: petshopId,
      nome: dados.nome,
      descricao: dados.descricao,
      foto_url: dados.foto_url,
      duracao_minutos: dados.duracao_minutos,
      preco_base: dados.preco_base,
    });
  },

  async atualizarServico(petshopId, serviceId, dados) {
    return PetshopService.atualizar(serviceId, petshopId, {
      nome: dados.nome,
      descricao: dados.descricao,
      foto_url: dados.foto_url,
      duracao_minutos: dados.duracao_minutos,
      preco_base: dados.preco_base,
      ativo: true,
    });
  },

  async removerServico(petshopId, serviceId) {
    return PetshopService.deletar(serviceId, petshopId);
  },

  async salvarRegraSemanal(petshopId, regra) {
    return PetshopScheduleRule.upsertSemanal(petshopId, regra);
  },

  async listarRegrasSemanais(petshopId) {
    return PetshopScheduleRule.listarPorPetshop(petshopId);
  },

  async desativarRegraSemanal(petshopId, diaSemana) {
    return PetshopScheduleRule.desativarDia(petshopId, diaSemana);
  },

  async criarBloqueioHorario(petshopId, dados) {
    return PetshopScheduleBlock.criar({
      petshop_id: petshopId,
      service_id: dados.service_id || null,
      inicio: dados.inicio,
      fim: dados.fim,
      motivo: dados.motivo || null,
    });
  },

  async listarBloqueiosFuturos(petshopId, limit = 100) {
    return PetshopScheduleBlock.listarFuturosPorPetshop(petshopId, limit);
  },

  async removerBloqueioHorario(petshopId, blockId) {
    return PetshopScheduleBlock.deletar(blockId, petshopId);
  },
};

module.exports = petshopScheduleService;
