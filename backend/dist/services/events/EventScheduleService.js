"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventScheduleService = void 0;
// src/services/events/EventScheduleService.ts
const luxon_1 = require("luxon");
const db_1 = require("@core/db");
class EventScheduleService {
    /**
     * Cria schedule para evento (idempotente)
     */
    async ensureEventSchedule(eventId, tenantId) {
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Verifica se já existe
            const existingResult = await trx.query({
                text: `
          SELECT schedule_id, tenant_id, event_id, metadata
          FROM schedules
          WHERE event_id = $1
        `,
                values: [eventId],
            });
            if (existingResult.length > 0) {
                const existing = existingResult[0];
                return existing.schedule_id;
            }
            // Busca dados do evento
            const eventResult = await trx.query({
                text: `
          SELECT id, tenant_id, event_type, timezone
          FROM events
          WHERE id = $1
        `,
                values: [eventId],
            });
            if (eventResult.length === 0) {
                throw new Error('Event not found');
            }
            const event = eventResult[0];
            // Cria schedule
            const scheduleResult = await trx.query({
                text: `
          INSERT INTO schedules (
            tenant_id,
            event_id,
            metadata
          )
          VALUES ($1, $2, $3::jsonb)
          RETURNING schedule_id
        `,
                values: [
                    event.tenant_id,
                    eventId,
                    JSON.stringify({
                        timezone: event.timezone,
                        event_type: event.event_type,
                    }),
                ],
            });
            if (scheduleResult.length === 0) {
                throw new Error('Failed to create schedule');
            }
            const schedule = scheduleResult[0];
            // 🔴 CRÍTICO: Atualiza evento com schedule_id
            await trx.query({
                text: `
          UPDATE events
          SET schedule_id = $1
          WHERE id = $2
        `,
                values: [schedule.schedule_id, eventId],
            });
            return schedule.schedule_id;
        });
    }
    /**
     * Gera slots baseado no tipo de evento (idempotente)
     */
    async generateEventSlots(eventId, tenantId) {
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            const eventResult = await trx.query({
                text: `
          SELECT id, event_type, start_time, end_time, max_capacity, schedule_id
          FROM events
          WHERE id = $1
        `,
                values: [eventId],
            });
            if (eventResult.length === 0) {
                throw new Error('Event not found');
            }
            const event = eventResult[0];
            if (!event.schedule_id) {
                throw new Error('Event schedule not found');
            }
            const slots = this.buildSlotsByType(event);
            if (slots.length === 0)
                return 0;
            // 🔴 CRÍTICO: Batch insert (não loop)
            await trx.query({
                text: `
          INSERT INTO schedule_slots (schedule_id, start_time, end_time, status, metadata)
          SELECT * FROM jsonb_to_recordset($1::jsonb)
          AS t(schedule_id UUID, start_time TIMESTAMPTZ, end_time TIMESTAMPTZ, status TEXT, metadata JSONB)
          ON CONFLICT (schedule_id, start_time, end_time) DO NOTHING
        `,
                values: [JSON.stringify(slots)],
            });
            return slots.length;
        });
    }
    buildSlotsByType(event) {
        const scheduleId = event.schedule_id;
        switch (event.event_type) {
            case 'SHOW':
            case 'CINEMA':
            case 'ESPORTE':
            case 'WORKSHOP':
            case 'EXPOSICAO':
                // Evento pontual: 1 slot
                return [
                    {
                        schedule_id: scheduleId,
                        start_time: event.start_time,
                        end_time: event.end_time,
                        status: 'available',
                        metadata: {
                            max_capacity: event.max_capacity,
                        },
                    },
                ];
            case 'BAR':
            case 'RESTAURANTE':
                // Slots de 1h durante funcionamento
                return this.generateHourlySlots(event.start_time, event.end_time, scheduleId);
            case 'FESTIVAL':
            case 'BALADA':
                // Multi-dia: 1 slot grande
                return [
                    {
                        schedule_id: scheduleId,
                        start_time: event.start_time,
                        end_time: event.end_time,
                        status: 'available',
                        metadata: {
                            max_capacity: event.max_capacity,
                            multiday: true,
                        },
                    },
                ];
            default:
                throw new Error(`Unsupported event type: ${event.event_type}`);
        }
    }
    generateHourlySlots(startTime, endTime, scheduleId) {
        const slots = [];
        const start = luxon_1.DateTime.fromJSDate(startTime);
        const end = luxon_1.DateTime.fromJSDate(endTime);
        let current = start;
        while (current < end) {
            const slotEnd = current.plus({ hours: 1 });
            slots.push({
                schedule_id: scheduleId,
                start_time: current.toUTC().toISO(),
                end_time: (slotEnd > end ? end : slotEnd).toUTC().toISO(),
                status: 'available',
                metadata: {},
            });
            current = slotEnd;
        }
        return slots;
    }
}
exports.EventScheduleService = EventScheduleService;
//# sourceMappingURL=EventScheduleService.js.map