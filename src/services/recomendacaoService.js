const Usuario = require('../models/Usuario');
const Pet = require('../models/Pet');

const recomendacaoService = {

  async usuariosProximos(usuarioId, limiteKm = 50, max = 10) {
    return Usuario.listarRecomendadosProximosGeo(usuarioId, limiteKm * 1000, max);
  },

  async usuariosMesmaCidade(usuarioId, max = 10) {
    return Usuario.listarRecomendadosMesmaCidade(usuarioId, max);
  },

  async recomendarPessoas(usuarioId, max = 10) {
    let recomendados = await this.usuariosProximos(usuarioId, 50, max);
    if (recomendados.length < max) {
      const porCidade = await this.usuariosMesmaCidade(usuarioId, max - recomendados.length);
      const idsJaTem = new Set(recomendados.map((r) => r.id));
      for (const u of porCidade) {
        if (!idsJaTem.has(u.id)) recomendados.push(u);
      }
    }
    return recomendados.slice(0, max);
  },

  async buscarPets(termo, usuarioId = null, limite = 20) {
    return Pet.buscarPorNomeComDonoESeguidores(termo, limite, usuarioId);
  },

  async petsRecomendados(usuarioId, max = 8) {
    return Pet.listarRecomendadosParaSeguir(usuarioId, max);
  },

  async petsProximos(usuarioIdReferencia, usuarioIdLogado, limite = 8) {
    return Pet.listarProximosPorLocalizacaoDono(usuarioIdReferencia, usuarioIdLogado, limite);
  },
};

module.exports = recomendacaoService;
