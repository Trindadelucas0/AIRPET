/**
 * schedulerService.js — Jobs automáticos do AIRPET
 *
 * Executa tarefas periódicas:
 *   1. Escalamento automático de alertas de pets perdidos
 *   2. Lembretes de vacinas vencendo
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const ConfigSistema = require('../models/ConfigSistema');
const PetPerdido = require('../models/PetPerdido');
const Publicacao = require('../models/Publicacao');
const Vacina = require('../models/Vacina');
const logger = require('../utils/logger');

let notificacaoService = null;

function setNotificacaoService(svc) {
  notificacaoService = svc;
}

async function escalarAlertasAutomaticamente() {
  try {
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
        if (notificacaoService && alerta.latitude) {
          const raio = raioNivel3 === 0 ? 999 : raioNivel3;
          try { await notificacaoService.notificarProximos(alerta.id, raio); } catch (e) {}
        }
        logger.info('Scheduler', `Alerta ${alerta.id} escalado para nível 3`);
      } else if (alerta.nivel_alerta < 2 && horasDesde >= horasNivel2) {
        await PetPerdido.atualizarNivel(alerta.id, 2);
        if (notificacaoService && alerta.latitude) {
          try { await notificacaoService.notificarProximos(alerta.id, raioNivel2); } catch (e) {}
        }
        logger.info('Scheduler', `Alerta ${alerta.id} escalado para nível 2`);
      }
    }
  } catch (erro) {
    logger.error('Scheduler', 'Erro ao escalar alertas', erro);
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

async function limparPostsExpirados() {
  try {
    const removidos = await Publicacao.limparExpirados();
    for (const r of removidos) {
      if (r.foto) {
        const caminho = path.join(__dirname, '..', 'public', r.foto);
        fs.unlink(caminho, () => {});
      }
    }
    if (removidos.length > 0) {
      logger.info('Scheduler', `${removidos.length} post(s) expirado(s) removido(s)`);
    }
  } catch (erro) {
    logger.error('Scheduler', 'Erro ao limpar posts expirados', erro);
  }
}

let escalarInterval = null;
let vacinaInterval = null;
let postsInterval = null;

function iniciar() {
  escalarInterval = setInterval(escalarAlertasAutomaticamente, 30 * 60 * 1000);
  vacinaInterval = setInterval(enviarLembretesVacinas, 6 * 60 * 60 * 1000);
  postsInterval = setInterval(limparPostsExpirados, 60 * 60 * 1000);

  setTimeout(escalarAlertasAutomaticamente, 10000);
  setTimeout(enviarLembretesVacinas, 30000);
  setTimeout(limparPostsExpirados, 60000);

  logger.info('Scheduler', 'Jobs automáticos iniciados (alertas: 30min, vacinas: 6h, posts: 1h)');
}

function parar() {
  if (escalarInterval) clearInterval(escalarInterval);
  if (vacinaInterval) clearInterval(vacinaInterval);
  if (postsInterval) clearInterval(postsInterval);
}

module.exports = { iniciar, parar, setNotificacaoService, escalarAlertasAutomaticamente, enviarLembretesVacinas, limparPostsExpirados };
