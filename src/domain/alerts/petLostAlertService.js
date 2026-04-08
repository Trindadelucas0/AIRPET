const ConfigSistema = require('../../models/ConfigSistema');
const PetPerdido = require('../../models/PetPerdido');
const PetPerdidoAlertEvent = require('../../models/PetPerdidoAlertEvent');
const notificacaoService = require('../../services/notificacaoService');
const logger = require('../../utils/logger');

const NIVEIS_VALIDOS = new Set([1, 2, 3]);
const RAIOS_PADRAO_KM = { 1: 2, 2: 5, 3: 15 };

async function getConfigNumero(chave, fallback) {
  const valor = await ConfigSistema.buscarPorChave(chave);
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}

async function getRaioNivelKm(nivel) {
  return getConfigNumero(`raio_alerta_nivel${nivel}_km`, RAIOS_PADRAO_KM[nivel] || 2);
}

async function registrarEvento(alerta, dados, origem) {
  return PetPerdidoAlertEvent.registrar({
    pet_perdido_id: alerta.id,
    tipo: dados.tipo,
    nivel_antes: dados.nivel_antes,
    nivel_depois: dados.nivel_depois,
    ciclo_alerta: dados.ciclo_alerta || alerta.ciclo_alerta || 1,
    origem: origem || 'sistema',
    metadata: dados.metadata || {},
  });
}

async function escalarOuReiniciarCiclo(petPerdidoId, opcoes = {}) {
  const origem = opcoes.origem || 'sistema';
  const alerta = await PetPerdido.buscarPorId(petPerdidoId);
  if (!alerta) throw new Error('Alerta de pet perdido não encontrado');

  const nivelAtual = Number(alerta.nivel_alerta || 1);
  const cicloAtual = Number(alerta.ciclo_alerta || 1);
  const nivelSolicitado = Number.isFinite(Number(opcoes.nivelDesejado))
    ? Number(opcoes.nivelDesejado)
    : null;

  let nivelDestino = nivelAtual;
  let cicloDestino = cicloAtual;
  let tipoEvento = 'escalado';
  let cicloReiniciado = false;

  if (nivelSolicitado && NIVEIS_VALIDOS.has(nivelSolicitado)) {
    nivelDestino = nivelSolicitado;
    tipoEvento = nivelDestino > nivelAtual ? 'escalado' : 'ajuste_nivel';
  } else if (nivelAtual >= 3) {
    nivelDestino = 1;
    cicloDestino = cicloAtual + 1;
    cicloReiniciado = true;
    tipoEvento = 'ciclo_reiniciado';
  } else {
    nivelDestino = nivelAtual + 1;
  }

  const intervaloMinimoMin = await getConfigNumero('alerta_min_intervalo_entre_ondas_minutos', 20);
  const lastBroadcast = alerta.last_broadcast_at ? new Date(alerta.last_broadcast_at) : null;
  const limiteIntervalo = Number.isFinite(intervaloMinimoMin) && intervaloMinimoMin > 0
    ? intervaloMinimoMin * 60 * 1000
    : 0;

  if (!opcoes.ignorarIntervaloMinimo && lastBroadcast && limiteIntervalo > 0) {
    const diff = Date.now() - lastBroadcast.getTime();
    if (diff < limiteIntervalo) {
      return {
        escalado: false,
        bloqueadoPorIntervalo: true,
        nivelAnterior: nivelAtual,
        nivelAtual,
        cicloAnterior: cicloAtual,
        cicloAtual,
        raioKm: 0,
        usuariosNotificados: 0,
      };
    }
  }

  const alertaAtualizado = await PetPerdido.atualizarEscalonamento(alerta.id, {
    nivel_alerta: nivelDestino,
    ciclo_alerta: cicloDestino,
    last_broadcast_at: new Date().toISOString(),
  });

  await registrarEvento(alerta, {
    tipo: tipoEvento,
    nivel_antes: nivelAtual,
    nivel_depois: nivelDestino,
    ciclo_alerta: cicloDestino,
    metadata: {
      ciclo_reiniciado: cicloReiniciado,
      origem,
    },
  }, origem);

  const raioKm = await getRaioNivelKm(nivelDestino);
  let notificacoes = [];
  try {
    notificacoes = await notificacaoService.notificarProximos(alerta.id, raioKm);
  } catch (erroNotificacao) {
    logger.error('PetLostAlertService', 'Falha ao notificar usuários na escalação', erroNotificacao);
  }

  await registrarEvento(alertaAtualizado || alerta, {
    tipo: 'notificacao_disparada',
    nivel_antes: nivelDestino,
    nivel_depois: nivelDestino,
    ciclo_alerta: cicloDestino,
    metadata: {
      origem,
      raio_km: raioKm,
      usuarios_notificados: Array.isArray(notificacoes) ? notificacoes.length : 0,
    },
  }, origem);

  return {
    escalado: true,
    nivelAnterior: nivelAtual,
    nivelAtual: nivelDestino,
    cicloAnterior: cicloAtual,
    cicloAtual: cicloDestino,
    cicloReiniciado,
    raioKm,
    usuariosNotificados: Array.isArray(notificacoes) ? notificacoes.length : 0,
  };
}

module.exports = {
  escalarOuReiniciarCiclo,
  getRaioNivelKm,
};
