// backend/src/services/events/EventScheduleService.ts
// LEGACY — BLOQUEADO em 2026-04-28 (C63 FASE 1)
// DECISION-0014: schedules/schedule_slots não são o SSOT temporal canônico.
// SSOT canônico: unified_availability + unified_bookings (core/availability/)
// Qualquer chamada a este serviço é erro de arquitetura — falha explícita intencional.

export class ScheduleLegacyError extends Error {
  constructor(method: string) {
    super(
      `[C63] EventScheduleService.${method}() está BLOQUEADO. ` +
      `Use unified-availability.service.ts. DECISION-0014.`
    );
    this.name = 'ScheduleLegacyError';
  }
}

export class EventScheduleService {
  async ensureEventSchedule(_eventId: string, _tenantId: string): Promise<string> {
    throw new ScheduleLegacyError('ensureEventSchedule');
  }

  async generateEventSlots(_eventId: string, _tenantId: string): Promise<number> {
    throw new ScheduleLegacyError('generateEventSlots');
  }
}





























