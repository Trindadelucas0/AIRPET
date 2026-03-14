/**
 * localizacaoController.js — Controller de Localização do AIRPET
 *
 * Controller de API (retorna JSON, não renderiza views).
 *
 * Gerencia o registro e consulta de localizações dos pets.
 * As localizações podem ser captadas de diversas fontes:
 *   - Scan NFC (quando alguém escaneia a tag do pet)
 *   - GPS do aplicativo (tracking contínuo)
 *   - Entrada manual pelo tutor
 *
 * Os dados de localização são armazenados como geography (PostGIS)
 * para permitir consultas espaciais como:
 *   - "Qual foi a última localização do meu pet?"
 *   - "Por onde meu pet passou nas últimas 24 horas?"
 *
 * Rotas (todas retornam JSON):
 *   POST /api/localizacoes           → registrar
 *   GET  /api/localizacoes/:pet_id   → historico
 */

const Localizacao = require('../models/Localizacao');
const Pet = require('../models/Pet');
const logger = require('../utils/logger');

/**
 * registrar — Registra uma nova localização para um pet
 *
 * Rota: POST /api/localizacoes
 * Tipo: API (retorna JSON)
 *
 * Fluxo:
 *   1. Extrai pet_id, latitude, longitude e origem do corpo da requisição
 *   2. Verifica se o pet existe
 *   3. Registra a localização no banco com ponto geográfico (PostGIS)
 *   4. Retorna JSON com sucesso e os dados registrados
 *
 * A origem indica de onde veio o dado de localização:
 *   - 'nfc' → escaneamento de tag NFC
 *   - 'gps' → GPS do aplicativo
 *   - 'manual' → entrada manual pelo tutor
 *
 * @param {object} req - Requisição Express com body { pet_id, latitude, longitude, origem }
 * @param {object} res - Resposta Express (JSON)
 */
async function registrar(req, res) {
  try {
    const { pet_id, latitude, longitude, origem } = req.body;

    /* Validação dos campos obrigatórios */
    if (!pet_id || !latitude || !longitude) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Os campos pet_id, latitude e longitude são obrigatórios.',
      });
    }

    /* Valida se latitude e longitude são números válidos */
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: 'Latitude e longitude devem ser números válidos.',
      });
    }

    /* Verifica se o pet existe no sistema */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Pet não encontrado.',
      });
    }

    /* Registra a localização no banco de dados */
    const localizacao = await Localizacao.registrar({
      pet_id,
      latitude: lat,
      longitude: lng,
      origem: origem || 'manual',
    });

    logger.info('LocalizacaoController', `Localização registrada para pet ${pet_id} (${origem || 'manual'})`);

    /* Retorna os dados da localização registrada */
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Localização registrada com sucesso.',
      dados: localizacao,
    });
  } catch (erro) {
    logger.error('LocalizacaoController', 'Erro ao registrar localização', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao registrar a localização.',
    });
  }
}

/**
 * historico — Retorna o histórico de localizações de um pet
 *
 * Rota: GET /api/localizacoes/:pet_id
 * Tipo: API (retorna JSON)
 *
 * Retorna todas as localizações registradas para o pet,
 * ordenadas da mais recente para a mais antiga.
 * Pode ser usado para traçar a rota do pet no mapa.
 *
 * O histórico é acessível pelo dono do pet (verificação de propriedade).
 *
 * @param {object} req - Requisição Express com params.pet_id
 * @param {object} res - Resposta Express (JSON)
 */
async function historico(req, res) {
  try {
    const { pet_id } = req.params;
    const usuarioId = req.session.usuario.id;

    /* Verifica se o pet existe */
    const pet = await Pet.buscarPorId(pet_id);

    if (!pet) {
      return res.status(404).json({
        sucesso: false,
        mensagem: 'Pet não encontrado.',
      });
    }

    /* Verifica se o usuário logado é o dono do pet */
    if (pet.usuario_id !== usuarioId) {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Você não tem permissão para ver o histórico deste pet.',
      });
    }

    /* Busca todo o histórico de localizações do pet */
    const localizacoes = await Localizacao.buscarPorPet(pet_id);

    /* Retorna a lista de localizações */
    return res.status(200).json({
      sucesso: true,
      dados: localizacoes,
      total: localizacoes.length,
    });
  } catch (erro) {
    logger.error('LocalizacaoController', 'Erro ao buscar histórico de localizações', erro);

    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro interno ao buscar o histórico de localizações.',
    });
  }
}

/* Exporta os métodos do controller */
module.exports = {
  registrar,
  historico,
};
