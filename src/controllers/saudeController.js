/**
 * saudeController.js — Controller de Saúde dos Pets do AIRPET
 *
 * Gerencia as operações de CRUD para registros de saúde:
 *   1. Vacinas — cartão de vacinação digital do pet
 *   2. Registros de saúde — consultas, exames, cirurgias, etc.
 *
 * Todas as operações verificam a propriedade do pet antes de
 * permitir a ação. Apenas o dono pode adicionar ou remover
 * registros de saúde do seu pet.
 *
 * Após cada operação, o controller redireciona de volta para
 * a página de saúde do pet (/pets/:pet_id/saude) onde os dados
 * atualizados são exibidos.
 *
 * Rotas:
 *   POST   /pets/:pet_id/vacinas       → adicionarVacina
 *   POST   /pets/:pet_id/registros     → adicionarRegistro
 *   DELETE /vacinas/:id                → deletarVacina
 *   DELETE /registros-saude/:id        → deletarRegistro
 */

const Vacina = require('../models/Vacina');
const RegistroSaude = require('../models/RegistroSaude');
const Pet = require('../models/Pet');
const logger = require('../utils/logger');

/**
 * adicionarVacina — Adiciona um registro de vacina ao pet
 *
 * Rota: POST /pets/:pet_id/vacinas
 *
 * Fluxo:
 *   1. Verifica se o pet existe e pertence ao usuário logado
 *   2. Extrai os dados da vacina do corpo da requisição
 *   3. Cria o registro de vacina no banco
 *   4. Redireciona para a página de saúde com mensagem de sucesso
 *
 * @param {object} req - Requisição Express com params.pet_id e body com dados da vacina
 * @param {object} res - Resposta Express
 */
async function adicionarVacina(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;

    /* Verifica se o pet existe e pertence ao usuário */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
      return res.redirect('/pets');
    }

    if (pet.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para adicionar vacinas a este pet.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    /* Extrai os dados da vacina do formulário */
    const {
      nome_vacina, data_aplicacao, data_proxima,
      veterinario, clinica, observacoes
    } = req.body;

    /* Validação mínima */
    if (!nome_vacina || !data_aplicacao) {
      req.session.flash = { tipo: 'erro', mensagem: 'O nome da vacina e a data de aplicação são obrigatórios.' };
      return res.redirect(`/pets/${pet_id}/saude`);
    }

    /* Cria o registro de vacina no banco */
    await Vacina.criar({
      pet_id,
      nome_vacina,
      data_aplicacao,
      data_proxima: data_proxima || null,
      veterinario: veterinario || null,
      clinica: clinica || null,
      observacoes: observacoes || null,
    });

    logger.info('SaudeController', `Vacina adicionada ao pet ${pet.nome}: ${nome_vacina}`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Vacina "${nome_vacina}" registrada com sucesso!` };
    return res.redirect(`/pets/${pet_id}/saude`);
  } catch (erro) {
    logger.error('SaudeController', 'Erro ao adicionar vacina', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao registrar a vacina. Tente novamente.' };
    return res.redirect(`/pets/${req.params.pet_id}/saude`);
  }
}

/**
 * adicionarRegistro — Adiciona um registro de saúde ao pet
 *
 * Rota: POST /pets/:pet_id/registros
 *
 * Tipos de registro aceitos:
 *   - consulta: consulta veterinária
 *   - exame: exame laboratorial ou de imagem
 *   - cirurgia: procedimento cirúrgico
 *   - vermifugo: aplicação de vermífugo
 *   - antipulgas: aplicação de antipulgas
 *   - outro: qualquer outro evento de saúde
 *
 * @param {object} req - Requisição Express com params.pet_id e body com dados do registro
 * @param {object} res - Resposta Express
 */
async function adicionarRegistro(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;

    /* Verifica se o pet existe e pertence ao usuário */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      req.session.flash = { tipo: 'erro', mensagem: 'Pet não encontrado.' };
      return res.redirect('/pets');
    }

    if (pet.usuario_id !== usuarioId) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para adicionar registros a este pet.' };
      return res.redirect(`/pets/${pet_id}`);
    }

    /* Extrai os dados do registro do formulário */
    const {
      tipo, descricao, data_registro,
      veterinario, clinica, observacoes
    } = req.body;

    /* Validação mínima */
    if (!tipo || !data_registro) {
      req.session.flash = { tipo: 'erro', mensagem: 'O tipo e a data do registro são obrigatórios.' };
      return res.redirect(`/pets/${pet_id}/saude`);
    }

    /* Cria o registro de saúde no banco */
    await RegistroSaude.criar({
      pet_id,
      tipo,
      descricao: descricao || null,
      data_registro,
      veterinario: veterinario || null,
      clinica: clinica || null,
      observacoes: observacoes || null,
    });

    logger.info('SaudeController', `Registro de saúde adicionado ao pet ${pet.nome}: ${tipo}`);

    req.session.flash = { tipo: 'sucesso', mensagem: `Registro de "${tipo}" adicionado com sucesso!` };
    return res.redirect(`/pets/${pet_id}/saude`);
  } catch (erro) {
    logger.error('SaudeController', 'Erro ao adicionar registro de saúde', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao registrar o evento de saúde. Tente novamente.' };
    return res.redirect(`/pets/${req.params.pet_id}/saude`);
  }
}

/**
 * deletarVacina — Remove um registro de vacina
 *
 * Rota: DELETE /vacinas/:id
 *
 * Verifica se a vacina pertence a um pet do usuário logado
 * antes de permitir a exclusão.
 *
 * O parâmetro pet_id é enviado via body ou query para saber
 * para onde redirecionar após a exclusão.
 *
 * @param {object} req - Requisição Express com params.id e body.pet_id
 * @param {object} res - Resposta Express
 */
async function deletarVacina(req, res) {
  try {
    const { id } = req.params;
    const { pet_id } = req.body;
    const { query: dbQuery } = require('../config/database');

    const check = await dbQuery(
      `SELECT v.*, p.usuario_id FROM vacinas v JOIN pets p ON p.id = v.pet_id WHERE v.id = $1`,
      [id]
    );
    if (!check.rows[0]) {
      req.session.flash = { tipo: 'erro', mensagem: 'Vacina não encontrada.' };
      return res.redirect('/pets');
    }
    if (check.rows[0].usuario_id !== req.session.usuario.id) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para remover esta vacina.' };
      return res.redirect('/pets');
    }

    const vacinaDeletada = await Vacina.deletar(id);

    logger.info('SaudeController', `Vacina removida: ${id}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Registro de vacina removido com sucesso.' };
    return res.redirect(`/pets/${pet_id || vacinaDeletada.pet_id}/saude`);
  } catch (erro) {
    logger.error('SaudeController', 'Erro ao deletar vacina', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao remover o registro de vacina.' };
    return res.redirect('/pets');
  }
}

/**
 * deletarRegistro — Remove um registro de saúde
 *
 * Rota: DELETE /registros-saude/:id
 *
 * Mesma lógica da exclusão de vacinas: verifica a existência
 * do registro e redireciona para a página de saúde do pet.
 *
 * @param {object} req - Requisição Express com params.id e body.pet_id
 * @param {object} res - Resposta Express
 */
async function deletarRegistro(req, res) {
  try {
    const { id } = req.params;
    const { pet_id } = req.body;
    const { query: dbQuery } = require('../config/database');

    const check = await dbQuery(
      `SELECT r.*, p.usuario_id FROM registros_saude r JOIN pets p ON p.id = r.pet_id WHERE r.id = $1`,
      [id]
    );
    if (!check.rows[0]) {
      req.session.flash = { tipo: 'erro', mensagem: 'Registro de saúde não encontrado.' };
      return res.redirect('/pets');
    }
    if (check.rows[0].usuario_id !== req.session.usuario.id) {
      req.session.flash = { tipo: 'erro', mensagem: 'Você não tem permissão para remover este registro.' };
      return res.redirect('/pets');
    }

    const registroDeletado = await RegistroSaude.deletar(id);

    logger.info('SaudeController', `Registro de saúde removido: ${id}`);

    req.session.flash = { tipo: 'sucesso', mensagem: 'Registro de saúde removido com sucesso.' };
    return res.redirect(`/pets/${pet_id || registroDeletado.pet_id}/saude`);
  } catch (erro) {
    logger.error('SaudeController', 'Erro ao deletar registro de saúde', erro);
    req.session.flash = { tipo: 'erro', mensagem: 'Erro ao remover o registro de saúde.' };
    return res.redirect('/pets');
  }
}

/* Exporta os métodos do controller */
module.exports = {
  adicionarVacina,
  adicionarRegistro,
  deletarVacina,
  deletarRegistro,
};
