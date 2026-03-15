const DiarioPet = require('../models/DiarioPet');
const Pet = require('../models/Pet');
const logger = require('../utils/logger');

const diarioController = {

  async mostrarDiario(req, res) {
    try {
      const { pet_id } = req.params;
      const pet = await Pet.buscarPorId(pet_id);

      if (!pet) {
        req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
        return res.redirect('/pets');
      }

      if (pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para acessar este pet.' };
        return res.redirect('/pets');
      }

      const hoje = new Date().toISOString().split('T')[0];
      const entradasHoje = await DiarioPet.buscarPorPetEData(pet_id, hoje);
      const historico = await DiarioPet.buscarPorPet(pet_id, 30);

      res.render('diario/index', {
        titulo: `Diário de ${pet.nome}`,
        pet,
        entradasHoje,
        historico,
        hoje,
      });
    } catch (err) {
      logger.error('DIARIO', 'Erro ao mostrar diário', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao carregar o diário.' };
      res.redirect('/pets');
    }
  },

  async adicionarEntrada(req, res) {
    try {
      const { pet_id } = req.params;
      const pet = await Pet.buscarPorId(pet_id);

      if (!pet || pet.usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Permissão negada.' };
        return res.redirect('/pets');
      }

      const { tipo, descricao } = req.body;
      const valorNumerico = req.body.valor_numerico ?? req.body.valor;
      const valorFinal = valorNumerico !== undefined && valorNumerico !== '' ? parseFloat(valorNumerico) : null;
      const foto = req.file ? `/images/diario/${req.file.filename}` : null;

      await DiarioPet.criar({
        pet_id,
        usuario_id: req.session.usuario.id,
        tipo,
        descricao,
        valor_numerico: valorFinal,
        foto,
      });

      req.session.flash = { tipo: 'sucesso', mensagem: 'Entrada adicionada ao diário!' };
      res.redirect(`/diario/${pet_id}`);
    } catch (err) {
      logger.error('DIARIO', 'Erro ao adicionar entrada', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao salvar entrada.' };
      res.redirect(`/diario/${req.params.pet_id}`);
    }
  },

  async deletarEntrada(req, res) {
    try {
      const { id } = req.params;
      const { query: dbQuery } = require('../config/database');
      const check = await dbQuery(
        `SELECT d.*, p.usuario_id FROM diario_pet d JOIN pets p ON p.id = d.pet_id WHERE d.id = $1`,
        [id]
      );
      if (!check.rows[0]) {
        req.session.flash = { tipo: 'erro', mensagem: 'Entrada não encontrada.' };
        return res.redirect('/pets');
      }
      if (check.rows[0].usuario_id !== req.session.usuario.id) {
        req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para remover esta entrada.' };
        return res.redirect('/pets');
      }

      const entrada = await DiarioPet.deletar(id);
      const petId = (entrada && entrada.pet_id) ?? check.rows[0].pet_id;

      req.session.flash = { tipo: 'sucesso', mensagem: 'Entrada removida do diário.' };
      res.redirect(`/diario/${petId}`);
    } catch (err) {
      logger.error('DIARIO', 'Erro ao deletar entrada', err);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao remover entrada.' };
      res.redirect('/pets');
    }
  },
};

module.exports = diarioController;
