const { query } = require('../config/database');
const ConfigSistema = require('../models/ConfigSistema');
const PetPerdido = require('../models/PetPerdido');
const Vacina = require('../models/Vacina');
const CronExecucao = require('../models/CronExecucao');
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
    const raioNivel2 = getConfig('raio_alerta_nivel2_km', 3);
    const raioNivel3 = getConfig('raio_alerta_nivel3_km', 0);

    const alertasAprovados = await query(
      `SELECT pp.*, pp.ultima_lat AS latitude, pp.ultima_lng AS longitude
       FROM pets_perdidos pp
       WHERE pp.status = 'aprovado'
       ORDER BY pp.data ASC`
    );

    for (const alerta of alertasAprovados.rows) {
      const horasDesde = (Date.now() - new Date(alerta.data).getTime()) / (1000 * 60 * 60);

      if (alerta.nivel_alerta < 3 && horasDesde >= horasNivel3) {
        await PetPerdido.atualizarNivel(alerta.id, 3);
        metricas.alertas_escalados++;
        if (notificacaoService && alerta.latitude) {
          const raio = raioNivel3 === 0 ? 999 : raioNivel3;
          try {
            const notifs = await notificacaoService.notificarProximos(alerta.id, raio);
            metricas.notificacoes_enviadas += (notifs && notifs.length) ? notifs.length : 0;
          } catch (e) {}
        }
        logger.info('Scheduler', `Alerta ${alerta.id} escalado para nível 3`);
      } else if (alerta.nivel_alerta < 2 && horasDesde >= horasNivel2) {
        await PetPerdido.atualizarNivel(alerta.id, 2);
        metricas.alertas_escalados++;
        if (notificacaoService && alerta.latitude) {
          try {
            const notifs = await notificacaoService.notificarProximos(alerta.id, raioNivel2);
            metricas.notificacoes_enviadas += (notifs && notifs.length) ? notifs.length : 0;
          } catch (e) {}
        }
        logger.info('Scheduler', `Alerta ${alerta.id} escalado para nível 2`);
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

let escalarInterval = null;
let vacinaInterval = null;

async function iniciar() {
  const configs = await ConfigSistema.listarTodas();
  const intervaloAlertas = (configs.find(c => c.chave === 'cron_intervalo_alertas_min')?.valor) || '30';
  const intervaloMs = Math.max(1, parseInt(intervaloAlertas, 10)) * 60 * 1000;

  escalarInterval = setInterval(escalarAlertasAutomaticamente, intervaloMs);
  vacinaInterval = setInterval(enviarLembretesVacinas, 6 * 60 * 60 * 1000);

  setTimeout(escalarAlertasAutomaticamente, 10000);
  setTimeout(enviarLembretesVacinas, 30000);

  logger.info('Scheduler', `Jobs automáticos iniciados (alertas: ${intervaloAlertas}min, vacinas: 6h)`);
}

function parar() {
  if (escalarInterval) clearInterval(escalarInterval);
  if (vacinaInterval) clearInterval(vacinaInterval);
}

module.exports = { iniciar, parar, setNotificacaoService, escalarAlertasAutomaticamente, enviarLembretesVacinas };
