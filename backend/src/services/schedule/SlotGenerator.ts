// backend/src/services/schedule/SlotGenerator.ts
// LEGACY — BLOQUEADO em 2026-04-28 (C63 FASE 1)
// DECISION-0014: schedules/schedule_slots não são o SSOT temporal canônico.
// SSOT canônico: unified_availability + unified_bookings (core/availability/)
// Qualquer chamada a este serviço é erro de arquitetura — falha explícita intencional.

export class ScheduleLegacyError extends Error {
  constructor(method: string) {
    super(
      `[C63] SlotGenerator.${method}() está BLOQUEADO. ` +
      `Use unified-availability.service.ts. DECISION-0014.`
    );
    this.name = 'ScheduleLegacyError';
  }
}

export class SlotGenerator {
  async generateCompanySlots(_params: {
    companyId: string;
    scheduleId: string;
    tenantId: string;
    daysAhead?: number;
  }): Promise<{ generated: number }> {
    throw new ScheduleLegacyError('generateCompanySlots');
  }
}
