/**
 * saudeService.js — Serviço de saúde animal do sistema AIRPET
 *
 * Este módulo gerencia o cartão de saúde digital dos pets,
 * incluindo vacinas, consultas, exames e outros registros médicos.
 *
 * Funcionalidades principais:
 *   - Registro e consulta de vacinas aplicadas
 *   - Registro e consulta de eventos de saúde (consultas, exames, cirurgias)
 *   - Verificação automática de vacinas/registros prestes a vencer
 *   - Notificação proativa para tutores sobre reforços necessários
 *
 * O método verificarVencimentos() é projetado para ser chamado
 * por um agendador (cron job) que roda periodicamente, verificando
 * quais vacinas estão perto de vencer e notificando os tutores.
 */

const Vacina = require('../models/Vacina');
const RegistroSaude = require('../models/RegistroSaude');
const Notificacao = require('../models/Notificacao');
const logger = require('../utils/logger');

/**
 * Número de dias de antecedência para alertar sobre vencimentos.
 * Com 3 dias, o tutor tem tempo suficiente para agendar uma visita
 * ao veterinário antes que a vacina/registro efetivamente vença.
 */
const DIAS_ANTECEDENCIA_ALERTA = 3;

const saudeService = {

  /**
   * Adiciona uma nova vacina ao cartão de vacinação do pet.
   *
   * Registra a vacina aplicada com todos os dados relevantes:
   * nome, data de aplicação, próximo reforço, veterinário e clínica.
   * O campo data_proxima é fundamental para o sistema de alertas.
   *
   * @param {object} dados - Dados da vacina a ser registrada
   * @param {string} dados.pet_id - UUID do pet que recebeu a vacina
   * @param {string} dados.nome_vacina - Nome da vacina (ex: 'V10', 'Antirrábica', 'V4 Felina')
   * @param {string} dados.data_aplicacao - Data em que a vacina foi aplicada (formato YYYY-MM-DD)
   * @param {string} [dados.data_proxima] - Data prevista para o próximo reforço (YYYY-MM-DD)
   * @param {string} [dados.veterinario] - Nome do veterinário que aplicou
   * @param {string} [dados.clinica] - Nome da clínica/hospital veterinário
   * @param {string} [dados.observacoes] - Observações adicionais (reações, lote, etc.)
   * @returns {Promise<object>} O registro da vacina criada
   * @throws {Error} Se os dados obrigatórios estiverem ausentes
   *
   * @example
   * const vacina = await saudeService.adicionarVacina({
   *   pet_id: 'pet-uuid',
   *   nome_vacina: 'V10',
   *   data_aplicacao: '2026-03-13',
   *   data_proxima: '2027-03-13',
   *   veterinario: 'Dr. Carlos',
   *   clinica: 'PetVet Saúde Animal'
   * });
   */
  async adicionarVacina(dados) {
    logger.info('SaudeService', `Adicionando vacina '${dados.nome_vacina}' para pet: ${dados.pet_id}`);

    const vacina = await Vacina.criar(dados);

    logger.info('SaudeService', `Vacina registrada: ${vacina.id} (${dados.nome_vacina})`);

    return vacina;
  },

  /**
   * Lista todas as vacinas registradas para um pet.
   *
   * Retorna o cartão de vacinação completo do pet,
   * ordenado da vacina mais recente para a mais antiga.
   * Inclui vacinas já aplicadas e datas de próximos reforços.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Lista de vacinas do pet (pode ser vazia)
   *
   * @example
   * const vacinas = await saudeService.listarVacinas('pet-uuid');
   * // vacinas = [
   * //   { id, nome_vacina: 'V10', data_aplicacao: '2026-03-13', data_proxima: '2027-03-13', ... },
   * //   { id, nome_vacina: 'Antirrábica', data_aplicacao: '2026-01-15', ... },
   * //   ...
   * // ]
   */
  async listarVacinas(petId) {
    logger.info('SaudeService', `Listando vacinas do pet: ${petId}`);

    const vacinas = await Vacina.buscarPorPet(petId);

    logger.info('SaudeService', `Encontradas ${vacinas.length} vacina(s) para pet: ${petId}`);

    return vacinas;
  },

  /**
   * Adiciona um novo registro de saúde genérico ao histórico do pet.
   *
   * Registros de saúde abrangem qualquer evento médico que não seja vacina:
   *   - Consultas veterinárias de rotina
   *   - Exames laboratoriais (hemograma, urinálise, etc.)
   *   - Cirurgias (castração, tumor, etc.)
   *   - Vermífugos e antipulgas
   *   - Tratamentos diversos (fisioterapia, dermatológico, etc.)
   *
   * @param {object} dados - Dados do registro de saúde
   * @param {string} dados.pet_id - UUID do pet
   * @param {string} dados.tipo - Tipo do registro ('consulta', 'exame', 'cirurgia', 'vermifugo', 'antipulga')
   * @param {string} dados.descricao - Descrição do procedimento/evento
   * @param {string} dados.data_registro - Data do evento (formato YYYY-MM-DD)
   * @param {string} [dados.veterinario] - Nome do veterinário responsável
   * @param {string} [dados.clinica] - Nome da clínica/hospital
   * @param {string} [dados.observacoes] - Observações adicionais
   * @returns {Promise<object>} O registro de saúde criado
   *
   * @example
   * const registro = await saudeService.adicionarRegistro({
   *   pet_id: 'pet-uuid',
   *   tipo: 'consulta',
   *   descricao: 'Consulta de rotina — check-up anual',
   *   data_registro: '2026-03-13',
   *   veterinario: 'Dra. Ana',
   *   clinica: 'Clínica Bicho Saudável'
   * });
   */
  async adicionarRegistro(dados) {
    logger.info('SaudeService', `Adicionando registro de saúde tipo '${dados.tipo}' para pet: ${dados.pet_id}`);

    const registro = await RegistroSaude.criar(dados);

    logger.info('SaudeService', `Registro de saúde criado: ${registro.id}`);

    return registro;
  },

  /**
   * Lista todos os registros de saúde de um pet.
   *
   * Retorna o histórico médico completo (excluindo vacinas,
   * que têm método próprio). Ordenado do mais recente para o mais antigo.
   *
   * @param {string} petId - UUID do pet
   * @returns {Promise<Array>} Lista de registros de saúde do pet
   *
   * @example
   * const registros = await saudeService.listarRegistros('pet-uuid');
   * // registros = [
   * //   { id, tipo: 'consulta', descricao: 'Check-up anual', data_registro: '2026-03-13', ... },
   * //   { id, tipo: 'exame', descricao: 'Hemograma completo', data_registro: '2026-02-20', ... },
   * //   ...
   * // ]
   */
  async listarRegistros(petId) {
    logger.info('SaudeService', `Listando registros de saúde do pet: ${petId}`);

    const registros = await RegistroSaude.buscarPorPet(petId);

    logger.info('SaudeService', `Encontrados ${registros.length} registro(s) de saúde para pet: ${petId}`);

    return registros;
  },

  /**
   * Verifica vacinas e registros prestes a vencer e cria notificações.
   *
   * Este método é projetado para ser executado periodicamente por
   * um cron job (ex: diariamente às 08:00). Ele faz o seguinte:
   *
   *   1. Busca todas as vacinas cujo data_proxima (próximo reforço)
   *      está dentro dos próximos N dias (padrão: 3 dias)
   *   2. Para cada vacina prestes a vencer, cria uma notificação
   *      para o tutor/dono do pet com lembrete de agendamento
   *   3. Registra no log quantas notificações foram enviadas
   *
   * A query usa BETWEEN NOW() AND NOW() + interval para encontrar
   * apenas vacinas no período de alerta, evitando notificar sobre
   * vacinas já vencidas ou muito distantes.
   *
   * @returns {Promise<object>} Resultado da verificação
   * @returns {number} returns.vacinasVencendo - Quantidade de vacinas encontradas
   * @returns {number} returns.notificacoesEnviadas - Quantidade de notificações criadas
   *
   * @example
   * const resultado = await saudeService.verificarVencimentos();
   * // resultado = { vacinasVencendo: 5, notificacoesEnviadas: 5 }
   */
  async verificarVencimentos() {
    logger.info('SaudeService', `Verificando vencimentos — antecedência: ${DIAS_ANTECEDENCIA_ALERTA} dia(s)`);

    /**
     * Busca vacinas cujo próximo reforço está nos próximos N dias.
     * O model Vacina.buscarVencendo já faz JOIN com pets para
     * trazer o nome do pet e o usuario_id do dono.
     */
    const vacinasVencendo = await Vacina.buscarVencendo(DIAS_ANTECEDENCIA_ALERTA);

    logger.info('SaudeService', `Encontradas ${vacinasVencendo.length} vacina(s) prestes a vencer`);

    let notificacoesEnviadas = 0;

    /**
     * Para cada vacina prestes a vencer, cria uma notificação
     * personalizada para o tutor do pet.
     *
     * A mensagem inclui:
     *   - Nome da vacina (ex: 'V10')
     *   - Nome do pet (ex: 'Rex')
     *   - Alerta para agendar o reforço
     */
    for (const vacina of vacinasVencendo) {
      /**
       * Formata a data de vencimento para exibição legível.
       * Usa toLocaleDateString com locale pt-BR para formato DD/MM/AAAA.
       */
      const dataVencimento = new Date(vacina.data_proxima).toLocaleDateString('pt-BR');

      const mensagem = `💉 Lembrete: a vacina "${vacina.nome_vacina}" de ${vacina.pet_nome} vence em ${dataVencimento}. Agende o reforço!`;

      await Notificacao.criar({
        usuario_id: vacina.usuario_id,
        tipo: 'sistema',
        mensagem,
        link: `/pets/${vacina.pet_id}/saude`,
      });

      notificacoesEnviadas++;
    }

    logger.info('SaudeService', `Verificação concluída — ${notificacoesEnviadas} notificação(ões) enviada(s)`);

    return {
      vacinasVencendo: vacinasVencendo.length,
      notificacoesEnviadas,
    };
  },
};

module.exports = saudeService;
