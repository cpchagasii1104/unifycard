// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

import { timeToMinutes, compareTime, isValidTimeFormat } from './formatTime';

/**
 * Validação de intervalo de tempo no padrão UX Temporal Canônico
 * Apenas valida formato e lógica básica, NÃO valida conflitos temporais reais
 */

export interface TimeRangeValidation {
  valid: boolean;
  error?: string;
}

/**
 * Valida formato básico de horário (HH:MM)
 */
export function validateTimeFormat(time: string): TimeRangeValidation {
  if (!time || time.trim() === '') {
    return { valid: false, error: 'Horário é obrigatório' };
  }

  if (!isValidTimeFormat(time)) {
    return { valid: false, error: 'Formato inválido. Use HH:MM (ex: 09:00)' };
  }

  return { valid: true };
}

/**
 * Valida intervalo de horário básico (início < fim)
 */
export function validateTimeRange(start: string, end: string): TimeRangeValidation {
  // Validar formato de start
  const startValidation = validateTimeFormat(start);
  if (!startValidation.valid) {
    return startValidation;
  }

  // Validar formato de end (pode estar vazio para novos intervalos)
  if (!end || end.trim() === '') {
    return { valid: false, error: 'Horário de fim é obrigatório' };
  }

  const endValidation = validateTimeFormat(end);
  if (!endValidation.valid) {
    return endValidation;
  }

  // Validar que start < end
  const comparison = compareTime(start, end);
  if (comparison >= 0) {
    return { valid: false, error: 'Horário de início deve ser anterior ao horário de fim' };
  }

  // Validar duração mínima (15 minutos)
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes - startMinutes < 15) {
    return { valid: false, error: 'Intervalo mínimo é de 15 minutos' };
  }

  return { valid: true };
}

/**
 * Valida que um intervalo não se sobrepõe com outros intervalos
 * (validação de UX, não de verdade temporal)
 */
export function validateNoOverlap(
  intervals: Array<{ start: string; end: string }>,
  currentIndex: number,
  newStart: string,
  newEnd: string
): TimeRangeValidation {
  const newStartMinutes = timeToMinutes(newStart);
  const newEndMinutes = timeToMinutes(newEnd);

  for (let i = 0; i < intervals.length; i++) {
    if (i === currentIndex) continue;

    const interval = intervals[i];
    if (!interval.start || !interval.end) continue;

    const intervalStartMinutes = timeToMinutes(interval.start);
    const intervalEndMinutes = timeToMinutes(interval.end);

    // Verificar sobreposição
    if (
      (newStartMinutes >= intervalStartMinutes && newStartMinutes < intervalEndMinutes) ||
      (newEndMinutes > intervalStartMinutes && newEndMinutes <= intervalEndMinutes) ||
      (newStartMinutes <= intervalStartMinutes && newEndMinutes >= intervalEndMinutes)
    ) {
      return {
        valid: false,
        error: `Intervalo se sobrepõe com ${interval.start}-${interval.end}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Valida que um intervalo está ordenado corretamente (start >= end do anterior)
 */
export function validateOrdered(
  intervals: Array<{ start: string; end: string }>,
  currentIndex: number,
  newStart: string
): TimeRangeValidation {
  if (currentIndex === 0) {
    return { valid: true };
  }

  // Encontrar intervalo anterior mais próximo
  const sortedIntervals = intervals
    .map((interval, index) => ({ ...interval, index }))
    .filter((_, index) => index !== currentIndex)
    .sort((a, b) => compareTime(a.start, b.start));

  if (sortedIntervals.length === 0) {
    return { valid: true };
  }

  // Encontrar intervalo anterior mais próximo
  const newStartMinutes = timeToMinutes(newStart);
  let prevEnd = '';
  let prevEndMinutes = 0;

  for (const interval of sortedIntervals) {
    if (!interval.end) continue;
    const intervalEndMinutes = timeToMinutes(interval.end);
    if (intervalEndMinutes <= newStartMinutes && intervalEndMinutes > prevEndMinutes) {
      prevEnd = interval.end;
      prevEndMinutes = intervalEndMinutes;
    }
  }

  if (prevEnd && newStartMinutes < prevEndMinutes) {
    return {
      valid: false,
      error: `O horário inicial deve ser a partir de ${prevEnd}, pois já existe um intervalo anterior que termina neste horário.`,
    };
  }

  return { valid: true };
}


