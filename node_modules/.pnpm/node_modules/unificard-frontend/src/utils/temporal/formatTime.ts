// 🔴 UX TEMPORAL CANÔNICO — INPUT DECLARATIVO
// Este componente/hook/util:
// - NÃO cria verdade temporal
// - NÃO bloqueia agenda
// - NÃO resolve conflitos
// - NÃO cria bookings
// - NÃO interfere em Unified Availability
// A verdade temporal está exclusivamente no Core (Agenda Universal)

/**
 * Utilitários para formatação de tempo no padrão UX Temporal Canônico
 */

/**
 * Converte minutos para formato HH:MM
 */
export function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Converte formato HH:MM para minutos
 */
export function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hour, min] = time.split(':').map(Number);
  return hour * 60 + min;
}

/**
 * Formata intervalo de tempo (start-end)
 */
export function formatTimeRange(start: string, end: string): string {
  return `${start}-${end}`;
}

/**
 * Parse intervalo de tempo (start-end)
 * Retorna { start, end } com end podendo ser vazio para novos intervalos
 */
export function parseTimeRange(range: string): { start: string; end: string } {
  const [start, end] = range.split('-');
  return { start: start || '09:00', end: end || '' };
}

/**
 * Valida formato de tempo HH:MM
 */
export function isValidTimeFormat(time: string): boolean {
  if (!time) return false;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Adiciona minutos a um horário
 */
export function addMinutes(time: string, minutes: number): string {
  const totalMinutes = timeToMinutes(time) + minutes;
  return minutesToTime(totalMinutes);
}

/**
 * Subtrai minutos de um horário
 */
export function subtractMinutes(time: string, minutes: number): string {
  const totalMinutes = Math.max(0, timeToMinutes(time) - minutes);
  return minutesToTime(totalMinutes);
}

/**
 * Compara dois horários
 * Retorna: -1 se time1 < time2, 0 se iguais, 1 se time1 > time2
 */
export function compareTime(time1: string, time2: string): number {
  const minutes1 = timeToMinutes(time1);
  const minutes2 = timeToMinutes(time2);
  if (minutes1 < minutes2) return -1;
  if (minutes1 > minutes2) return 1;
  return 0;
}


