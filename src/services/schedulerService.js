const ConfigSistema = require('../models/ConfigSistema');
const PetPerdido = require('../models/PetPerdido');
const Vacina = require('../models/Vacina');
const CronExecucao = require('../models/CronExecucao');
const petshopAppointmentService = require('./petshopAppointmentService');
const petLostAlertService = require('../domain/alerts/petLostAlertService');
const logger = require('../utils/logger');

let notificacaoService = null;

function setNotificacaoService(svc) {
  notificacaoService = svc;
}

async function escalarAlertasAutomaticamente() {
  let execId = null;
  const metricas = { alertas_escalados: 0, notificacoes_enviadas: 0 };

  try {
    const registro = await CronExecucao.criar(CronExecucao.JOB_ESCALAR_ALERTAS);
    execId = registro.id;

    const configs = await ConfigSistema.listarTodas();
    const getConfig = (chave, fallback) => {
      const c = configs.find(x => x.chave === chave);
      return c ? parseFloat(c.valor) : fallback;
    };

    const horasNivel2 = getConfig('horas_para_nivel2', 6);
    const horasNivel3 = getConfig('horas_para_nivel3', 24);
    const alertasAprovados = await PetPerdido.listarAprovadosComCoordenadasOrdenadosPorData();

    for (const alerta of alertasAprovados) {
      const horasDesde = (Date.now() - new Date(alerta.data).getTime()) / (1000 * 60 * 60);

      if (horasDesde >= horasNivel3) {
        const resultado = await petLostAlertService.escalarOuReiniciarCiclo(alerta.id, { origem: 'scheduler' });
        if (resultado.escalado) {
          metricas.alertas_escalados++;
          metricas.notificacoes_enviadas += resultado.usuariosNotificados || 0;
          logger.info('Scheduler', `Alerta ${alerta.id} processado (nivel ${resultado.nivelAtual}, ciclo ${resultado.cicloAtual})`);
        }
      } else if (alerta.nivel_alerta < 2 && horasDesde >= horasNivel2) {
        const resultado = await petLostAlertService.escalarOuReiniciarCiclo(alerta.id, {
          origem: 'scheduler',
          nivelDesejado: 2,
          ignorarIntervaloMinimo: true,
        });
        if (resultado.escalado) {
          metricas.alertas_escalados++;
          metricas.notificacoes_enviadas += resultado.usuariosNotificados || 0;
          logger.info('Scheduler', `Alerta ${alerta.id} escalado para nível ${resultado.nivelAtual}`);
        }
      }
    }

    if (execId) await CronExecucao.finalizar(execId, 'ok', metricas);
  } catch (erro) {
    logger.error('Scheduler', 'Erro ao escalar alertas', erro);
    if (execId) await CronExecucao.finalizar(execId, 'erro', metricas, (erro && erro.message) || String(erro));
  }
}

async function enviarLembretesVacinas() {
  try {
    const vacinasVencendo = await Vacina.buscarVencendo(7);
    if (!notificacaoService) return;

    for (const vacina of vacinasVencendo) {
      const diasRestantes = Math.ceil(
        (new Date(vacina.data_proxima) - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const msg = diasRestantes <= 0
        ? `A vacina "${vacina.nome_vacina}" de ${vacina.pet_nome} está vencida!`
        : `A vacina "${vacina.nome_vacina}" de ${vacina.pet_nome} vence em ${diasRestantes} dia(s).`;
      try {
        await notificacaoService.criar(vacina.usuario_id, 'sistema', msg, `/pets/${vacina.pet_id}/saude`);
      } catch (e) {}
    }

    if (vacinasVencendo.length > 0) {
      logger.info('Scheduler', `${vacinasVencendo.length} lembrete(s) de vacina enviado(s)`);
    }
  } catch (erro) {
    logger.error('Scheduler', 'Erro ao enviar lembretes de vacinas', erro);
  }
}

async function expirarSolicitacoesAgendaPendentes() {
  try {
    const configs = await ConfigSistema.listarTodas();
    const cPrazo = configs.find((c) => c.chave === 'agenda_prazo_confirmacao_horas');
    const prazoHoras = cPrazo ? Number(cPrazo.valor) : 6;
    const total = await petshopAppointmentService.expirarPendentes(prazoHoras);
    if (total > 0) {
      logger.info('Scheduler', `${total} solicitação(ões) de agenda expirada(s) automaticamente.`);
    }
  } catch (erro) {
    logger.error('Scheduler', 'Erro ao expirar solicitações de agenda', erro);
  }
}

let escalarInterval = null;
let vacinaInterval = null;
let agendaExpiraInterval = null;

async function iniciar() {
  const configs = await ConfigSistema.listarTodas();
  const intervaloAlertas = (configs.find(c => c.chave === 'cron_intervalo_alertas_min')?.valor) || '30';
  const intervaloMs = Math.max(1, parseInt(intervaloAlertas, 10)) * 60 * 1000;
  const intervaloAgenda = (configs.find(c => c.chave === 'cron_intervalo_agenda_min')?.valor) || '10';
  const intervaloAgendaMs = Math.max(1, parseInt(intervaloAgenda, 10)) * 60 * 1000;

  escalarInterval = setInterval(escalarAlertasAutomaticamente, intervaloMs);
  vacinaInterval = setInterval(enviarLembretesVacinas, 6 * 60 * 60 * 1000);
  agendaExpiraInterval = setInterval(expirarSolicitacoesAgendaPendentes, intervaloAgendaMs);

  setTimeout(escalarAlertasAutomaticamente, 10000);
  setTimeout(enviarLembretesVacinas, 30000);
  setTimeout(expirarSolicitacoesAgendaPendentes, 45000);

  logger.info('Scheduler', `Jobs automáticos iniciados (alertas: ${intervaloAlertas}min, vacinas: 6h, agenda: ${intervaloAgenda}min)`);
}

function parar() {
  if (escalarInterval) clearInterval(escalarInterval);
  if (vacinaInterval) clearInterval(vacinaInterval);
  if (agendaExpiraInterval) clearInterval(agendaExpiraInterval);
}

module.exports = {
  iniciar,
  parar,
  setNotificacaoService,
  escalarAlertasAutomaticamente,
  enviarLembretesVacinas,
  expirarSolicitacoesAgendaPendentes,
};
