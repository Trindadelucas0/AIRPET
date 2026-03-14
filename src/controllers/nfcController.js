/**
 * nfcController.js — Controller principal de escaneamento NFC
 *
 * Este é o CORAÇÃO do sistema AIRPET. Quando alguém escaneia
 * uma tag NFC (colada na coleira do pet), a requisição chega aqui.
 *
 * O fluxo de escaneamento funciona assim:
 *   1. Pessoa escaneia a tag NFC com o celular
 *   2. O navegador abre a URL: /nfc/:tag_code
 *   3. processarScan() é chamado
 *   4. O serviço NFC determina qual tela exibir baseado no status da tag:
 *      - 'manufactured' → tela "não ativada" (tag ainda não foi vendida)
 *      - 'sent'/'reserved' → tela "ativar" (dono precisa ativar)
 *      - 'active' → tela "intermediária" (mostra dados do pet e contato do dono)
 *      - 'blocked' → tela de erro (tag bloqueada pelo admin)
 *   5. O scan é sempre registrado para rastreabilidade
 *
 * Esta rota é PÚBLICA — qualquer pessoa pode escanear uma tag.
 * Não requer autenticação.
 *
 * Dependências:
 *   - nfcService: lógica de negócio do processamento de scan
 *   - TagScan (model): registro de cada scan para auditoria
 *   - logger: registro de eventos
 */

const nfcService = require('../services/nfcService');
const TagScan = require('../models/TagScan');
const NfcTag = require('../models/NfcTag');
const Pet = require('../models/Pet');
const Localizacao = require('../models/Localizacao');
const notificacaoService = require('../services/notificacaoService');
const logger = require('../utils/logger');

const nfcController = {

  /**
   * Processa um escaneamento de tag NFC — ROTA PRINCIPAL DO SISTEMA.
   * Rota: GET /nfc/:tag_code
   *
   * Esta é a rota mais importante do AIRPET. Quando alguém encontra
   * um pet e escaneia a tag NFC, toda a mágica acontece aqui.
   *
   * Passos detalhados:
   *   1. Extrai o tag_code dos parâmetros da URL
   *   2. Captura IP e user_agent para rastreabilidade
   *   3. Chama nfcService.processarScan() que:
   *      - Busca a tag no banco pelo tag_code
   *      - Verifica o status atual da tag
   *      - Determina qual tela exibir (tela é retornada como string)
   *      - Busca dados do pet e do dono (se a tag estiver ativa)
   *   4. Registra o scan na tabela tag_scans (auditoria)
   *   5. Renderiza a view apropriada baseada no campo 'tela'
   *
   * Possíveis telas retornadas pelo serviço:
   *   - 'nao-ativada': tag ainda no estado manufactured (não foi vendida)
   *   - 'ativar': tag foi enviada mas não ativada pelo dono
   *   - 'intermediaria': tag ativa — mostra dados do pet para quem escaneou
   *   - 'bloqueada': tag foi bloqueada pelo admin
   *
   * @param {object} req - Requisição (params.tag_code: código da tag)
   * @param {object} res - Resposta do Express
   */
  async processarScan(req, res) {
    try {
      /* Extrai o código da tag a partir da URL */
      const { tag_code } = req.params;

      /*
       * Captura metadados da requisição para rastreabilidade.
       * O IP é usado para geolocalização aproximada.
       * O user_agent identifica o dispositivo que escaneou.
       */
      const ip = req.ip || req.connection.remoteAddress;
      const user_agent = req.headers['user-agent'] || 'desconhecido';

      logger.info('NFC_CTRL', `Scan recebido para tag: ${tag_code} | IP: ${ip}`);

      /*
       * Chama o serviço NFC para processar o scan.
       * O serviço retorna um objeto com:
       *   - tela: string indicando qual view renderizar
       *   - tag: dados da tag NFC
       *   - pet: dados do pet (se tag ativa)
       *   - dono: dados do dono (se tag ativa)
       *   - erro: mensagem de erro (se houver)
       */
      const resultado = await nfcService.processarScan(tag_code, {
        ip,
        user_agent,
      });

      /*
       * Decide qual view renderizar baseado no campo 'tela'
       * retornado pelo serviço NFC.
       */
      switch (resultado.tela) {
        /*
         * Tag não ativada — ainda está no estado 'manufactured'.
         * Mostra uma página informativa dizendo que a tag ainda não foi vendida.
         */
        case 'nao-ativada':
          return res.render('nfc/nao-ativada', {
            titulo: 'Tag não ativada',
            tag_code,
          });

        /*
         * Tag pronta para ativação — status 'sent' ou 'reserved'.
         * O dono recebeu a tag e precisa ativá-la vinculando a um pet.
         */
        case 'ativar':
          return res.render('nfc/ativar', {
            titulo: 'Ativar Tag NFC',
            tag_code,
            tag: resultado.tag,
          });

        /*
         * Tag ativa — TELA PRINCIPAL quando alguém encontra o pet.
         * Mostra foto, nome, dados do pet e informações de contato do dono.
         * Esta é a tela que o "encontrador" do pet vai ver.
         */
        case 'intermediaria':
          return res.render('nfc/intermediaria', {
            titulo: `Pet encontrado: ${resultado.pet?.nome || 'Pet'}`,
            tag: resultado.tag,
            pet: resultado.pet,
            dono: resultado.dono,
            petPerdido: resultado.petPerdidoAlerta,
          });

        /*
         * Tag bloqueada — acesso negado.
         * O admin bloqueou esta tag (perda, roubo, etc.).
         */
        case 'bloqueada':
          return res.status(403).render('partials/erro', {
            titulo: 'Tag bloqueada',
            mensagem: 'Esta tag NFC foi bloqueada. Entre em contato com o suporte.',
            codigo: 403,
          });

        /*
         * Caso não reconhecido — erro genérico.
         * Pode acontecer se o tag_code não existir no banco.
         */
        default:
          return res.status(404).render('partials/erro', {
            titulo: 'Tag não encontrada',
            mensagem: resultado.erro || 'A tag escaneada não foi encontrada no sistema.',
            codigo: 404,
          });
      }
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao processar scan NFC', erro);
      res.status(500).render('partials/erro', {
        titulo: 'Erro no escaneamento',
        mensagem: 'Ocorreu um erro ao processar a tag NFC. Tente novamente.',
        codigo: 500,
      });
    }
  },

  async mostrarEncontrei(req, res) {
    try {
      const { tag_code } = req.params;
      const { query } = require('../config/database');
      const tagResult = await query('SELECT * FROM nfc_tags WHERE tag_code = $1 AND status = $2', [tag_code, 'active']);
      const tag = tagResult.rows[0];
      if (!tag || !tag.pet_id) {
        return res.status(404).render('partials/erro', { titulo: 'Tag não encontrada', mensagem: 'Tag inválida.', codigo: 404 });
      }
      const pet = await Pet.buscarPorId(tag.pet_id);
      res.render('nfc/encontrei', { titulo: `Encontrei ${pet.nome}`, pet, tag_code });
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao mostrar encontrei', erro);
      res.status(500).render('partials/erro', { titulo: 'Erro', mensagem: 'Erro ao carregar a página.', codigo: 500 });
    }
  },

  async processarEncontrei(req, res) {
    try {
      const { tag_code } = req.params;
      const { nome, telefone, mensagem, latitude, longitude } = req.body;
      const foto = req.file ? `/images/pets/${req.file.filename}` : null;

      const { query } = require('../config/database');
      const tagResult = await query('SELECT * FROM nfc_tags WHERE tag_code = $1 AND status = $2', [tag_code, 'active']);
      const tag = tagResult.rows[0];
      if (!tag || !tag.pet_id) {
        return res.status(404).render('partials/erro', { titulo: 'Tag não encontrada', mensagem: 'Tag inválida.', codigo: 404 });
      }

      const pet = await Pet.buscarPorId(tag.pet_id);

      if (latitude && longitude) {
        try {
          await Localizacao.registrar({ pet_id: tag.pet_id, latitude, longitude, origem: 'encontrei' });
        } catch (e) { logger.error('NFC_CTRL', 'Erro ao registrar localização do encontrei', e); }
      }

      try {
        const msg = nome ? `${nome} encontrou ${pet.nome}` : `Alguém encontrou ${pet.nome}`;
        const detalhes = mensagem ? ` — "${mensagem}"` : '';
        await notificacaoService.criar(pet.usuario_id, 'scan', msg + detalhes + (telefone ? ` (Tel: ${telefone})` : ''), `/pets/${pet.id}`);
      } catch (e) { logger.error('NFC_CTRL', 'Erro ao notificar dono', e); }

      res.render('nfc/encontrei-sucesso', { titulo: 'Obrigado!', pet, tag_code });
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao processar encontrei', erro);
      req.session.flash = { tipo: 'erro', mensagem: 'Erro ao enviar os dados.' };
      res.redirect(`/tag/${req.params.tag_code}`);
    }
  },

  async mostrarEnviarFoto(req, res) {
    try {
      const { tag_code } = req.params;
      const { query } = require('../config/database');
      const tagResult = await query('SELECT * FROM nfc_tags WHERE tag_code = $1 AND status = $2', [tag_code, 'active']);
      const tag = tagResult.rows[0];
      if (!tag || !tag.pet_id) {
        return res.status(404).render('partials/erro', { titulo: 'Tag não encontrada', mensagem: 'Tag inválida.', codigo: 404 });
      }
      const pet = await Pet.buscarPorId(tag.pet_id);
      res.render('nfc/enviar-foto', { titulo: `Enviar foto de ${pet.nome}`, pet, tag_code });
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao mostrar enviar-foto', erro);
      res.status(500).render('partials/erro', { titulo: 'Erro', mensagem: 'Erro ao carregar a página.', codigo: 500 });
    }
  },

  async registrarLocalizacaoPublica(req, res) {
    try {
      const { tag_code } = req.params;
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({ sucesso: false, mensagem: 'Latitude e longitude são obrigatórios.' });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ sucesso: false, mensagem: 'Coordenadas inválidas.' });
      }

      const tag = await NfcTag.buscarPorTagCode(tag_code);
      if (!tag || tag.status !== 'active' || !tag.pet_id) {
        return res.status(404).json({ sucesso: false, mensagem: 'Tag não encontrada ou inativa.' });
      }

      const ip = req.ip || req.connection.remoteAddress;

      let cidade = null;
      try {
        const geocoding = require('../utils/geocoding');
        cidade = await geocoding.reverseGeocode(lat, lng);
      } catch (e) {
        logger.error('NFC_CTRL', 'Erro no reverse geocoding (não crítico)', e);
      }

      await Localizacao.registrar({ pet_id: tag.pet_id, latitude: lat, longitude: lng, origem: 'encontrador' });

      try {
        await TagScan.registrar({
          tag_id: tag.id,
          tag_code,
          latitude: lat,
          longitude: lng,
          cidade,
          ip,
          user_agent: req.headers['user-agent'] || 'desconhecido',
        });
      } catch (e) { logger.error('NFC_CTRL', 'Erro ao registrar scan de localização', e); }

      const pet = await Pet.buscarPorId(tag.pet_id);
      if (pet) {
        const cidadeTexto = cidade ? ` em ${cidade}` : '';
        try {
          await notificacaoService.criar(
            pet.usuario_id,
            'scan',
            `Localização de ${pet.nome} recebida${cidadeTexto}.`,
            `/pets/${pet.id}`
          );
        } catch (e) { logger.error('NFC_CTRL', 'Erro ao notificar dono sobre localização', e); }
      }

      logger.info('NFC_CTRL', `Localização pública registrada para tag ${tag_code}: ${lat}, ${lng} — ${cidade || 'sem cidade'}`);

      return res.status(201).json({ sucesso: true, mensagem: 'Localização registrada com sucesso.', cidade });
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao registrar localização pública', erro);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao registrar localização.' });
    }
  },

  async processarEnviarFoto(req, res) {
    try {
      const { tag_code } = req.params;
      const foto = req.file ? `/images/pets/${req.file.filename}` : null;
      if (!foto) {
        req.session.flash = { tipo: 'erro', mensagem: 'Nenhuma foto enviada.' };
        return res.redirect(`/tag/${tag_code}/enviar-foto`);
      }

      const { query } = require('../config/database');
      const tagResult = await query('SELECT * FROM nfc_tags WHERE tag_code = $1 AND status = $2', [tag_code, 'active']);
      const tag = tagResult.rows[0];
      if (!tag || !tag.pet_id) {
        return res.status(404).render('partials/erro', { titulo: 'Tag não encontrada', mensagem: 'Tag inválida.', codigo: 404 });
      }

      const pet = await Pet.buscarPorId(tag.pet_id);

      // Foto salva em diretório de pets - registra como scan

      try {
        await notificacaoService.criar(pet.usuario_id, 'scan', `Alguém enviou uma foto de ${pet.nome}!`, `/pets/${pet.id}`);
      } catch (e) { logger.error('NFC_CTRL', 'Erro ao notificar dono sobre foto', e); }

      res.render('nfc/encontrei-sucesso', { titulo: 'Foto enviada!', pet, tag_code });
    } catch (erro) {
      logger.error('NFC_CTRL', 'Erro ao processar enviar-foto', erro);
      res.redirect(`/tag/${req.params.tag_code}`);
    }
  },
};

module.exports = nfcController;
