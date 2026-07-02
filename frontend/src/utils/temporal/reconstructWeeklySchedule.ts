// src/utils/temporal/reconstructWeeklySchedule.ts
// F-COMPANY-AGENDA-REAL-WIRING: extraído de ProfileAgenda.tsx para reuso pelo wizard de onboarding
// de empresa (mesmo read-back, actor diferente — página em vez de pessoa física). Pure function,
// sem side-effects de import (ProfileAgenda.tsx carrega CSS/estado de componente).

import { DateTime } from 'luxon';
import type { UnifiedAvailability } from '../../api/availability';
import type { AvailabilitySchedule } from '../../api/categories';

/** Marcador de procedência das janelas geradas pelo materializador semanal (F1, DECISION-0072 B1). */
export const WEEKLY_TEMPLATE_SOURCE = 'profile_weekly_template';

/** luxon weekday (1=Mon..7=Sun) → chave da grade. */
export const LUXON_WEEKDAY_TO_KEY: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 7: 'sunday',
};

/**
 * Reconstrói a grade semanal declarativa a partir das janelas CONCRETAS materializadas no SSOT
 * `availability` (apenas as marcadas como template recorrente e ativas). Converte start/end para
 * dia-da-semana + "HH:mm-HH:mm" na timezone de cada janela. NÃO usa bookings nem metadata.schedule.
 */
export function reconstructWeeklySchedule(
  avs: UnifiedAvailability[],
  conceptIdToSlug: Map<string, string>
): { schedule: AvailabilitySchedule; purposes: Record<string, string> } {
  const byDay: Record<string, Set<string>> = {};
  // 🔴 DECISION-0132: read-back da finalidade por faixa, keyed `${dayKey}|${range}` (estável).
  const purposes: Record<string, string> = {};
  for (const a of avs) {
    if (a.metadata?.source !== WEEKLY_TEMPLATE_SOURCE) continue;
    if (a.availabilityType !== 'recurring') continue;
    if (a.status !== 'active') continue;
    const tz = a.timezone || 'America/Sao_Paulo';
    const start = DateTime.fromISO(a.startDatetime, { zone: tz });
    const end = DateTime.fromISO(a.endDatetime, { zone: tz });
    if (!start.isValid || !end.isValid) continue;
    const dayKey = LUXON_WEEKDAY_TO_KEY[start.weekday];
    if (!dayKey) continue;
    const range = `${start.toFormat('HH:mm')}-${end.toFormat('HH:mm')}`;
    (byDay[dayKey] ??= new Set<string>()).add(range);
    if (a.purposeConceptId) {
      const slug = conceptIdToSlug.get(a.purposeConceptId);
      if (slug) purposes[`${dayKey}|${range}`] = slug;
    }
  }
  const schedule: AvailabilitySchedule = {};
  for (const [day, ranges] of Object.entries(byDay)) {
    schedule[day] = Array.from(ranges).sort();
  }
  return { schedule, purposes };
}
