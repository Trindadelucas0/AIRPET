/**
 * nfcService.js — Serviço de processamento de escaneamentos NFC/QR do sistema AIRPET
 *
 * Este módulo é o coração do fluxo público do AIRPET.
 * Quando alguém escaneia uma tag NFC ou um QR Code de um pet,
 * este serviço processa o escaneamento e determina qual tela exibir.
 *
 * Fluxo de decisão (baseado no status da tag):
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │               ALGUÉM ESCANEIA A TAG                │
 *   └──────────────────────┬──────────────────────────────┘
 *                          │
 *             ┌────────────▼────────────┐
 *             │   Qual é o status?      │
 *             └────────────┬────────────┘
 *                          │
 *   ┌──────────┬───────────┼───────────┬──────────┐
 *   │          │           │           │          │
 *   ▼          ▼           ▼           ▼          ▼
 * stock    reserved      sent       active    blocked
 *   │          │           │           │          │
 *   ▼          ▼           ▼           ▼          ▼
 * TELA:     TELA:       TELA:      TELA:      TELA:
 * "não      "não        "ativar"   "inter-    "bloqueada"
 * ativada"  ativada"               mediária"
 *
 * Para tags ATIVAS:
 *   - Registra a localização do pet (onde foi escaneado)
 *   - Verifica se o pet está marcado como perdido
 *   - Notifica o dono sobre o escaneamento
 */

const NfcTag = require('../models/NfcTag');
const TagScan = require('../models/TagScan');
const Pet = require('../models/Pet');
const Localizacao = require('../models/Localizacao');
const Notificacao = require('../models/Notificacao');
const PetPerdido = require('../models/PetPerdido');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const nfcService = {

  /**
   * Processa o escaneamento de uma tag NFC ou QR Code.
   *
   * Este método é chamado quando alguém (qualquer pessoa, sem autenticação)
   * escaneia uma tag NFC com o celular ou lê o QR Code impresso.
   *
   * Etapas do processamento:
   *   1. Busca a tag pelo código NFC no banco de dados
   *   2. Registra o escaneamento com metadados (localização, IP, dispositivo)
   *   3. Determina qual tela exibir baseado no status da tag
   *   4. Se a tag está ATIVA:
   *      a. Registra a localização do pet na tabela localizacoes
   *      b. Verifica se o pet está perdido (pets_perdidos com status 'aprovado')
   *      c. Cria notificação para o dono informando que a tag foi escaneada
   *
   * @param {string} tagCode - Código da tag (formato PET-XXXXXX)
   * @param {object} dadosScan - Metadados do escaneamento coletados pelo navegador/servidor
   * @param {number} [dadosScan.latitude] - Latitude de onde ocorreu o scan (GPS do dispositivo)
   * @param {number} [dadosScan.longitude] - Longitude de onde ocorreu o scan
   * @param {string} [dadosScan.cidade] - Nome da cidade (resolvido por geocoding reverso)
   * @param {string} [dadosScan.ip] - Endereço IP de quem escaneou
   * @param {string} [dadosScan.user_agent] - User agent do navegador/dispositivo
   * @returns {Promise<object>} Objeto com as informações para renderizar a tela correta
   * @returns {object|null} returns.tag - Dados da tag (null se não encontrada)
   * @returns {object|null} returns.pet - Dados do pet vinculado (null se não vinculado)
   * @returns {string} returns.tela - Nome da tela a ser renderizada
   * @returns {boolean} returns.petPerdido - true se o pet está marcado como perdido
   *
   * @example
   * const resultado = await nfcService.processarScan('PET-82KJ91', {
   *   latitude: -23.5505, longitude: -46.6333,
   *   cidade: 'São Paulo', ip: '189.100.50.25',
   *   user_agent: 'Mozilla/5.0...'
   * });
   * // resultado = { tag: {...}, pet: {...}, tela: 'intermediaria', petPerdido: false }
   */
  async processarScan(tagCode, dadosScan) {
    logger.info('NfcService', `Processando scan da tag: ${tagCode}`);

    /**
     * PASSO 1: Busca a tag pelo código NFC.
     * O método buscarPorTagCode já faz LEFT JOIN com pets e usuarios,
     * retornando dados do pet e do dono se existirem.
     */
    const tag = await NfcTag.buscarPorTagCode(tagCode);

    if (!tag) {
      logger.warn('NfcService', `Tag não encontrada no banco: ${tagCode}`);
      return {
        tag: null,
        pet: null,
        tela: 'nao-encontrada',
        petPerdido: false,
      };
    }

    /**
     * PASSO 2: Registra o escaneamento no histórico de scans.
     * Grava informações como localização GPS, IP e user agent
     * para rastreabilidade e análise posterior.
     */
    await TagScan.registrar({
      tag_id: tag.id,
      tag_code: tagCode,
      latitude: dadosScan.latitude || null,
      longitude: dadosScan.longitude || null,
      cidade: dadosScan.cidade || null,
      ip: dadosScan.ip || null,
      user_agent: dadosScan.user_agent || null,
    });

    logger.info('NfcService', `Scan registrado para tag: ${tagCode} (status: ${tag.status})`);

    /**
     * PASSO 3: Determina qual tela exibir baseado no status da tag.
     *
     * Mapeamento status → tela:
     *   manufactured (stock) → 'nao-ativada': tag ainda em estoque
     *   reserved             → 'nao-ativada': tag reservada mas não enviada
     *   sent                 → 'ativar': tutor pode ativar via formulário
     *   active               → 'intermediaria': exibe perfil público do pet
     *   blocked              → 'bloqueada': tag bloqueada por segurança
     */
    let tela;
    let petPerdido = false;
    let dadosPet = null;
    let dadosDono = null;
    let alertaAtivo = null;

    switch (tag.status) {
      /**
       * Tags em estoque ou reservadas — não foram enviadas ainda.
       * Exibe uma tela informativa dizendo que a tag não está ativa.
       */
      case 'stock':
      case 'manufactured':
      case 'reserved':
        tela = 'nao-ativada';
        break;

      /**
       * Tag enviada mas não ativada — exibe o formulário de ativação.
       * O tutor insere o activation_code para ativar a tag.
       */
      case 'sent':
        tela = 'ativar';
        break;

      /**
       * Tag ativa — fluxo principal do AIRPET.
       * Exibe a página intermediária com informações do pet.
       */
      case 'active':
        tela = 'intermediaria';

        if (tag.pet_id) {
          dadosPet = await Pet.buscarPorId(tag.pet_id);

          if (dadosPet) {
            const donoResult = await query(
              'SELECT id, nome, telefone, email FROM usuarios WHERE id = $1',
              [dadosPet.usuario_id]
            );
            dadosDono = donoResult.rows[0] || null;
          }
        }

        /**
         * PASSO 4a: Registra a localização do pet.
         * Se o escaneamento inclui coordenadas GPS, salva como
         * nova localização do pet (origem: 'nfc'), com foto do pet para o mapa.
         */
        if (tag.pet_id && dadosScan.latitude && dadosScan.longitude) {
          const pet = await Pet.buscarPorId(tag.pet_id);
          await Localizacao.registrar({
            pet_id: tag.pet_id,
            latitude: dadosScan.latitude,
            longitude: dadosScan.longitude,
            origem: 'nfc',
            foto_url: (pet && pet.foto) ? pet.foto : null,
            cidade: dadosScan.cidade || null,
          });

          logger.info('NfcService', `Localização registrada para pet: ${tag.pet_id}`);
        }

        /**
         * PASSO 4b: Verifica se o pet está perdido.
         * Busca alertas aprovados para este pet na tabela pets_perdidos.
         * Se existir um alerta ativo, sinaliza na resposta.
         */
        if (tag.pet_id) {
          const alertas = await PetPerdido.buscarPorPet(tag.pet_id);
          alertaAtivo = alertas.find(a => a.status === 'aprovado') || null;

          if (alertaAtivo) {
            petPerdido = true;
            logger.info('NfcService', `Pet ${tag.pet_id} está PERDIDO! Alerta ativo: ${alertaAtivo.id}`);
          }
        }

        /**
         * PASSO 4c: Notifica o dono sobre o escaneamento.
         * Cria uma notificação informando que alguém escaneou a tag do pet.
         * Inclui a cidade (se disponível) para contexto.
         */
        if (tag.user_id) {
          const cidadeTexto = dadosScan.cidade ? ` em ${dadosScan.cidade}` : '';
          const nomeDoAnimal = tag.pet_nome || 'seu pet';

          await Notificacao.criar({
            usuario_id: tag.user_id,
            tipo: 'scan',
            mensagem: `A tag de ${nomeDoAnimal} foi escaneada${cidadeTexto}.`,
            link: `/pet/${tag.pet_id}`,
          });

          logger.info('NfcService', `Notificação de scan enviada ao dono: ${tag.user_id}`);
        }

        break;

      /**
       * Tag bloqueada — pode ter sido roubada ou perdida.
       * Exibe uma tela informando que a tag está bloqueada.
       */
      case 'blocked':
        tela = 'bloqueada';
        break;

      /**
       * Status desconhecido — fallback de segurança.
       * Não deveria acontecer, mas caso um status inválido
       * esteja no banco, exibe a tela de não ativada.
       */
      default:
        logger.warn('NfcService', `Status desconhecido para tag: ${tagCode} — status: ${tag.status}`);
        tela = 'nao-ativada';
        break;
    }

    logger.info('NfcService', `Scan processado — tag: ${tagCode}, tela: ${tela}, petPerdido: ${petPerdido}`);

    return {
      tag,
      pet: dadosPet,
      dono: dadosDono,
      tela,
      petPerdido,
      petPerdidoAlerta: alertaAtivo,
    };
  },
};

module.exports = nfcService;
