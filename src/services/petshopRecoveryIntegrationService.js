const Petshop = require('../models/Petshop');
const PetshopLostPetAlert = require('../models/PetshopLostPetAlert');

const petshopRecoveryIntegrationService = {
  async notificarPetshopsProximos({ pet_perdido_id, latitude, longitude, raioMetros = 5000, origem = 'aprovacao_admin' }) {
    if (!latitude || !longitude) return [];
    const proximos = await Petshop.buscarProximos(latitude, longitude, raioMetros);
    const registros = [];

    for (const petshop of proximos) {
      if (!petshop.ponto_de_apoio) continue;
      const reg = await PetshopLostPetAlert.registrar({
        pet_perdido_id,
        petshop_id: petshop.id,
        distancia_metros: petshop.distancia_metros,
        origem,
        canal: 'sistema',
        status_envio: 'enviado',
      });
      registros.push({ petshop, reg });
    }
    return registros;
  },

  async sugerirPetshopMaisProximo(latitude, longitude) {
    if (!latitude || !longitude) return null;
    const proximos = await Petshop.buscarProximos(latitude, longitude, 10000);
    const apoio = proximos.filter((p) => p.ponto_de_apoio);
    return apoio[0] || proximos[0] || null;
  },
};

module.exports = petshopRecoveryIntegrationService;
