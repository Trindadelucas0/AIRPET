const PetshopScheduleRule = require('../models/PetshopScheduleRule');
const PetshopScheduleBlock = require('../models/PetshopScheduleBlock');
const PetshopAppointment = require('../models/PetshopAppointment');

function parseDate(dateLike) {
  const d = dateLike ? new Date(dateLike) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
}

function parseTime(time) {
  const [hh, mm] = String(time || '00:00').split(':');
  return { hh: Number(hh) || 0, mm: Number(mm) || 0 };
}

function combineDateTime(date, time) {
  const { hh, mm } = parseTime(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hh, mm, 0, 0);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const petshopDisponibilidadeService = {
  async listarSlotsDisponiveis({ petshopId, serviceId, dia, duracaoMinutos = 30 }) {
    const target = parseDate(dia);
    const dayStart = startOfDay(target);
    const dayEnd = endOfDay(target);
    const weekday = target.getDay();

    const [rules, blocks, appointments] = await Promise.all([
      PetshopScheduleRule.listarPorPetshop(petshopId),
      PetshopScheduleBlock.listarPorPetshopNoIntervalo(petshopId, dayStart, dayEnd, serviceId || null),
      PetshopAppointment.contarPorDiaNoIntervalo(
        petshopId,
        dayStart,
        dayEnd,
        ['pendente', 'aceito', 'concluido']
      ),
    ]);

    const rule = (rules || []).find((r) => Number(r.dia_semana) === weekday && r.ativo !== false);
    if (!rule) {
      return { slots: [], motivo: 'Dia sem atendimento configurado.' };
    }

    const abertura = combineDateTime(target, rule.abre);
    const fechamento = combineDateTime(target, rule.fecha);
    if (fechamento <= abertura) {
      return { slots: [], motivo: 'Horário inválido para o dia selecionado.' };
    }

    const intervaloInicio = rule.intervalo_inicio ? combineDateTime(target, rule.intervalo_inicio) : null;
    const intervaloFim = rule.intervalo_fim ? combineDateTime(target, rule.intervalo_fim) : null;

    const slotMs = Math.max(Number(duracaoMinutos) || 30, 15) * 60 * 1000;
    const occupiedCount = (appointments && appointments[0] && Number(appointments[0].total)) || 0;
    const blockRanges = (blocks || []).map((b) => ({
      inicio: new Date(b.inicio),
      fim: new Date(b.fim),
      motivo: b.motivo || 'Bloqueado',
    }));

    const slots = [];
    for (let cursor = new Date(abertura); cursor < fechamento; cursor = new Date(cursor.getTime() + slotMs)) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + slotMs);
      if (slotEnd > fechamento) break;

      if (intervaloInicio && intervaloFim && overlaps(slotStart, slotEnd, intervaloInicio, intervaloFim)) {
        continue;
      }

      const blockHit = blockRanges.find((b) => overlaps(slotStart, slotEnd, b.inicio, b.fim));
      if (blockHit) {
        continue;
      }

      slots.push({
        inicio: slotStart.toISOString(),
        fim: slotEnd.toISOString(),
      });
    }

    return { slots, ocupacaoDia: occupiedCount };
  },
};

module.exports = petshopDisponibilidadeService;
