const PetshopScheduleRule = require('../models/PetshopScheduleRule');
const PetshopAppointment = require('../models/PetshopAppointment');

const SLOT_MINUTOS = 30;

function toDate(input) {
  if (!input) return new Date();
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonthExclusive(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDayExclusive(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function formatDia(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeToMin(value) {
  const [h, m] = String(value || '00:00').split(':');
  const hh = Number(h) || 0;
  const mm = Number(m) || 0;
  return (hh * 60) + mm;
}

function calcularCapacidadeRegra(regra) {
  if (!regra || regra.ativo === false) return 0;
  const abreMin = parseTimeToMin(regra.abre);
  const fechaMin = parseTimeToMin(regra.fecha);
  const intervaloInicioMin = regra.intervalo_inicio ? parseTimeToMin(regra.intervalo_inicio) : null;
  const intervaloFimMin = regra.intervalo_fim ? parseTimeToMin(regra.intervalo_fim) : null;

  let minutosAtivos = Math.max(fechaMin - abreMin, 0);
  if (intervaloInicioMin !== null && intervaloFimMin !== null && intervaloFimMin > intervaloInicioMin) {
    minutosAtivos -= (intervaloFimMin - intervaloInicioMin);
  }
  if (minutosAtivos < 0) minutosAtivos = 0;

  return Math.floor(minutosAtivos / SLOT_MINUTOS);
}

const petshopAgendaResumoService = {
  async gerarResumoMensal(petshopId, referencia = new Date()) {
    const dataBase = toDate(referencia);
    const inicio = startOfMonth(dataBase);
    const fim = endOfMonthExclusive(dataBase);

    const [regras, contagemRows] = await Promise.all([
      PetshopScheduleRule.listarPorPetshop(petshopId),
      PetshopAppointment.contarPorDiaNoIntervalo(petshopId, inicio, fim),
    ]);

    const regrasMap = new Map(regras.map((r) => [Number(r.dia_semana), r]));
    const countByDia = contagemRows.reduce((acc, row) => {
      acc[row.dia] = Number(row.total) || 0;
      return acc;
    }, {});

    const agendaDiasResumo = {};
    const totalDias = new Date(dataBase.getFullYear(), dataBase.getMonth() + 1, 0).getDate();

    for (let dia = 1; dia <= totalDias; dia += 1) {
      const data = new Date(dataBase.getFullYear(), dataBase.getMonth(), dia);
      const chaveDia = formatDia(data);
      const regra = regrasMap.get(data.getDay());
      const agendamentosDia = countByDia[chaveDia] || 0;
      const capacidade = calcularCapacidadeRegra(regra);

      if (!regra || regra.ativo === false || capacidade <= 0) {
        agendaDiasResumo[chaveDia] = { status: 'lotado', capacidade: 0, total: agendamentosDia };
        continue;
      }

      agendaDiasResumo[chaveDia] = {
        status: agendamentosDia >= capacidade ? 'lotado' : 'parcial',
        capacidade,
        total: agendamentosDia,
      };
    }

    return { agendaDiasResumo };
  },

  async gerarResumoHoje(petshopId, referencia = new Date()) {
    const hoje = toDate(referencia);
    const diaSemana = hoje.getDay();
    const inicio = startOfDay(hoje);
    const fim = endOfDayExclusive(hoje);

    const [regras, countRows] = await Promise.all([
      PetshopScheduleRule.listarPorPetshop(petshopId),
      PetshopAppointment.contarPorDiaNoIntervalo(petshopId, inicio, fim),
    ]);

    const regraHoje = regras.find((r) => Number(r.dia_semana) === diaSemana) || null;
    const totalHoje = countRows.length ? (Number(countRows[0].total) || 0) : 0;
    const capacidadeHoje = calcularCapacidadeRegra(regraHoje);

    if (!regraHoje || regraHoje.ativo === false || capacidadeHoje <= 0) {
      return { agendaResumo: { totalHoje, livresHoje: 'Configure em Horários' } };
    }

    const livres = Math.max(capacidadeHoje - totalHoje, 0);
    return { agendaResumo: { totalHoje, livresHoje: String(livres) } };
  },
};

module.exports = petshopAgendaResumoService;
