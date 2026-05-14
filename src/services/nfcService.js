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
const PetTrackingEvent = require('../models/PetTrackingEvent');
const petEventBus = require('./petEventBus');
const mapaPrivacidadeService = require('./mapaPrivacidadeService');
const notificacaoService = require('./notificacaoService');
const petshopRecoveryIntegrationService = require('./petshopRecoveryIntegrationService');
const tagEntitlementService = require('./tagEntitlementService');
const pushService = require('./pushService');
const emailService = require('./emailService');
const Usuario = require('../models/Usuario');
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
    const scanRegistro = await TagScan.registrar({
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
     *   stock/manufactured → 'nao-ativada': tag ainda em estoque
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
    let petshopMaisProximo = null;
    let ultimaLocalizacao = null;
    let planoInfo = null;
    let recursosPlano = {};
    let petPerdidoMapaHabilitado = false;
    let petshopProximoHabilitado = false;
    let notificacoesMulticanalHabilitado = false;

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
            dadosDono = await Usuario.buscarContatoBasicoPorId(dadosPet.usuario_id);
            planoInfo = await tagEntitlementService.obterEstadoPlano(dadosPet.usuario_id);
            recursosPlano = Object.assign({}, planoInfo?.recursos || {});
            petPerdidoMapaHabilitado = Boolean(recursosPlano.pet_perdido_mapa);
            petshopProximoHabilitado = Boolean(recursosPlano.petshop_proximo);
            notificacoesMulticanalHabilitado = Boolean(recursosPlano.notificacoes_multicanal);
          }
        }

        /**
         * PASSO 4b: Estado perdido (antes do mapa público/SSE e notificações em massa por scan).
         * Alerta aprovado em pets_perdidos OU pets.status = 'perdido'.
         */
        if (tag.pet_id) {
          const alertas = await PetPerdido.buscarPorPet(tag.pet_id);
          alertaAtivo = alertas.find(a => a.status === 'aprovado') || null;

          const petMarcadoPerdido = dadosPet && dadosPet.status === 'perdido';
          if (alertaAtivo) {
            petPerdido = true;
            logger.info('NfcService', `Pet ${tag.pet_id} está PERDIDO! Alerta aprovado: ${alertaAtivo.id}`);
          } else if (petMarcadoPerdido) {
            petPerdido = true;
            alertaAtivo = alertas[0] || null;
            logger.info('NfcService', `Pet ${tag.pet_id} está PERDIDO (aguardando aprovação do alerta)`);
          }
        }

        /**
         * PASSO 4a: Registra a localização do pet.
         * Se o escaneamento inclui coordenadas GPS, salva como
         * nova localização do pet (origem: 'nfc'). Foto no mapa vem do JOIN com pets.
         */
        if (tag.pet_id && dadosScan.latitude && dadosScan.longitude) {
          await Localizacao.registrar({
            pet_id: tag.pet_id,
            latitude: dadosScan.latitude,
            longitude: dadosScan.longitude,
            origem: 'nfc',
            foto_url: null,
            cidade: dadosScan.cidade || null,
          });

          // Projeta no event store unificado (falha silenciosa — não bloqueia fluxo)
          PetTrackingEvent.registrar({
            pet_id: tag.pet_id,
            event_type: 'nfc_scan',
            source: 'nfc',
            latitude: dadosScan.latitude,
            longitude: dadosScan.longitude,
            cidade: dadosScan.cidade || null,
            visibility: 'owner',
            metadata: { tag_code: tagCode, ip: dadosScan.ip, user_agent: dadosScan.user_agent },
          }).catch((err) => {
            logger.error('NfcService', 'Falha ao projetar evento NFC no tracking store', err);
          });

          // Emite em tempo real para tutores com o perfil aberto (SSE por pet)
          petEventBus.emit(String(tag.pet_id), 'nfc_scan', {
            petId: tag.pet_id,
            lat: dadosScan.latitude,
            lng: dadosScan.longitude,
            cidade: dadosScan.cidade || null,
            ts: Date.now(),
          });

          // Alerta de proximidade: notifica tutores de pets perdidos próximos ao scan
          PetPerdido.buscarAprovadosNaRaio(dadosScan.latitude, dadosScan.longitude, 500)
            .then(async (perdidosProximos) => {
              for (const perdido of perdidosProximos) {
                // Não notificar o mesmo tutor cujo pet acabou de ser escaneado
                if (perdido.usuario_id === tag.user_id) continue;
                const distM = Math.round(perdido.distancia_metros || 0);
                const cidadeTexto = dadosScan.cidade ? ` em ${dadosScan.cidade}` : '';
                await Notificacao.criar({
                  usuario_id: perdido.usuario_id,
                  tipo: 'avistamento_proximo',
                  mensagem: `Um pet foi avistado a ~${distM}m de onde ${perdido.pet_nome} foi visto pela última vez${cidadeTexto}. Pode ser ele!`,
                  link: `/pets/${perdido.pet_id}`,
                });
                if (notificacoesMulticanalHabilitado) {
                  pushService.enviarParaUsuario(perdido.usuario_id, {
                    titulo: '🔍 Avistamento próximo!',
                    corpo: `Um pet foi visto a ~${distM}m de ${perdido.pet_nome}. Verifique!`,
                    url: `/pets/${perdido.pet_id}`,
                    tipo: 'avistamento_proximo',
                  }).catch(() => {});
                }
              }
            })
            .catch((err) => {
              logger.error('NfcService', 'Falha ao verificar proximidade de pets perdidos', err);
            });

          const scanIso = scanRegistro && scanRegistro.data
            ? new Date(scanRegistro.data).toISOString()
            : new Date().toISOString();
          const visivelMapaPublico = dadosPet && mapaPrivacidadeService.petScanElegivelMapaPublico({
            pet_status: dadosPet.status,
            privado: dadosPet.privado,
            tem_alerta_perdido_aprovado: Boolean(alertaAtivo),
          });
          const pub = mapaPrivacidadeService.obfuscateLatLng(
            dadosScan.latitude,
            dadosScan.longitude,
            tag.pet_id
          );
          if (visivelMapaPublico && pub.lat != null && pub.lng != null) {
            petEventBus.emitGlobal('nfc_scan_global', {
              petId: tag.pet_id,
              nome: tag.pet_nome || (dadosPet && dadosPet.nome) || null,
              foto: dadosPet && dadosPet.foto ? dadosPet.foto : null,
              petStatus: dadosPet && dadosPet.status ? dadosPet.status : 'ativo',
              lat: pub.lat,
              lng: pub.lng,
              cidade: dadosScan.cidade || null,
              labelLocal: mapaPrivacidadeService.labelLocal(dadosScan.cidade),
              slug: dadosPet && dadosPet.slug ? dadosPet.slug : null,
              visivelMapaPublico: true,
              ts: Date.now(),
              data: scanIso,
            });
          }

          if (petPerdido && tag.user_id != null) {
            notificacaoService
              .notificarScanPetPerdidoComLocalizacao({
                petId: tag.pet_id,
                petNome: (dadosPet && dadosPet.nome) || tag.pet_nome || null,
                lat: dadosScan.latitude,
                lng: dadosScan.longitude,
                donoUsuarioId: tag.user_id,
              })
              .catch((err) => {
                logger.error('NfcService', 'Falha ao notificar seguidores/região (scan pet perdido)', err);
              });
          }

          logger.info('NfcService', `Localização registrada para pet: ${tag.pet_id}`);

          if (petshopProximoHabilitado) {
            petshopMaisProximo = await petshopRecoveryIntegrationService.sugerirPetshopMaisProximo(
              dadosScan.latitude,
              dadosScan.longitude
            );
          }
        }

        if (tag.pet_id && petPerdidoMapaHabilitado) {
          ultimaLocalizacao = await Localizacao.buscarUltimaPorPetId(tag.pet_id);
        }

        const planoPremiumAtivo = Boolean(planoInfo && planoInfo.planoAtivo);

        if (
          planoPremiumAtivo
          && petshopProximoHabilitado
          && !petshopMaisProximo
          && alertaAtivo
          && alertaAtivo.latitude
          && alertaAtivo.longitude
        ) {
          petshopMaisProximo = await petshopRecoveryIntegrationService.sugerirPetshopMaisProximo(
            alertaAtivo.latitude,
            alertaAtivo.longitude
          );
        }

        /**
         * PASSO 4c: Notifica o dono sobre o escaneamento.
         * Cria uma notificação informando que alguém escaneou a tag do pet.
         * Inclui a cidade (se disponível) para contexto.
         */
        if (tag.user_id) {
          const cidadeTexto = dadosScan.cidade ? ` em ${dadosScan.cidade}` : '';
          const nomeDoAnimal = tag.pet_nome || 'seu pet';
          const linkPet = `/pets/${tag.pet_id}`;
          const mensagem = `A tag de ${nomeDoAnimal} foi escaneada${cidadeTexto}.`;

          await Notificacao.criar({
            usuario_id: tag.user_id,
            tipo: 'scan',
            mensagem,
            link: linkPet,
          });

          if (notificacoesMulticanalHabilitado) {
            pushService.enviarParaUsuario(tag.user_id, {
              titulo: 'Tag Escaneada',
              corpo: mensagem,
              url: linkPet,
              tipo: 'scan',
            }).catch((err) => {
              logger.error('NfcService', 'Falha ao enviar push multicanal', err);
            });

            if (dadosDono && dadosDono.email) {
              emailService.enviarTagEscaneada({
                to: dadosDono.email,
                nome: dadosDono.nome,
                petNome: nomeDoAnimal,
                cidade: dadosScan.cidade || null,
                linkPet,
              }).catch((err) => {
                logger.error('NfcService', 'Falha ao enviar e-mail multicanal', err);
              });
            }
          }

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
      petshopMaisProximo,
      ultimaLocalizacao,
      recursosPlano,
      petPerdidoMapaHabilitado,
      petshopProximoHabilitado,
      notificacoesMulticanalHabilitado,
      planoAtivo: Boolean(planoInfo && planoInfo.planoAtivo),
      planoEmGrace: Boolean(planoInfo && planoInfo.emGrace),
      planoExpiraEm: planoInfo?.validUntil || null,
      planoSlug: planoInfo?.planSlug || 'basico',
      planoNome: planoInfo?.nomePlano || 'AIRPET Essencial',
    };
  },
};

module.exports = nfcService;
