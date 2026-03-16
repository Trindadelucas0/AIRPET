const PetshopProduct = require('../models/PetshopProduct');

const petshopProductService = {
  async validarLimiteAtivos(petshopId) {
    const totalAtivos = await PetshopProduct.contarAtivosPorPetshop(petshopId);
    if (totalAtivos >= 15) {
      throw new Error('Limite de 15 produtos ativos atingido.');
    }
  },
};

module.exports = petshopProductService;
