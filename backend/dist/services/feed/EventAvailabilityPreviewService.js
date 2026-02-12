"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventAvailabilityPreviewService = void 0;
// src/services/feed/EventAvailabilityPreviewService.ts
// 🔴 READ-MODEL
// NÃO usar para decisões.
// Fonte canônica: unified-availability.service.ts
// 🔴 CRÍTICO: Preview READ-ONLY, nunca reserva ou bloqueia slots
const db_1 = require("@core/db");
class EventAvailabilityPreviewService {
    /**
     * Busca preview de disponibilidade (READ-ONLY)
     * 🔴 NUNCA reserva, apenas exibe próximos slots disponíveis
     */
    async getAvailabilityPreview(eventId, tenantId) {
        // 1. Buscar evento e schedule_id
        const eventRows = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT id, schedule_id, timezone
        FROM events
        WHERE id = $1
      `,
            values: [eventId],
        });
        if (eventRows.length === 0) {
            return null;
        }
        const event = eventRows[0];
        const timezone = event.timezone || 'America/Sao_Paulo';
        // 2. Se não tem schedule_id, retornar apenas timezone
        if (!event.schedule_id) {
            return {
                eventId,
                nextAvailableSlots: [],
                timezone,
            };
        }
        // 3. Buscar próximos 3 slots disponíveis (READ-ONLY)
        const slotRows = await (0, db_1.runQueriesWithTenant)(tenantId, {
            text: `
        SELECT slot_id, starts_at, ends_at
        FROM schedule_slots
        WHERE schedule_id = $1
          AND status = 'available'
          AND starts_at >= NOW()
        ORDER BY starts_at ASC
        LIMIT 3
      `,
            values: [event.schedule_id],
        });
        const nextAvailableSlots = slotRows.map((slot) => ({
            start: slot.starts_at.toISOString(),
            end: slot.ends_at.toISOString(),
        }));
        return {
            eventId,
            nextAvailableSlots,
            timezone,
        };
    }
}
exports.EventAvailabilityPreviewService = EventAvailabilityPreviewService;
