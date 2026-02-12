"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlotGenerator = void 0;
// src/services/schedule/SlotGenerator.ts
const luxon_1 = require("luxon");
const db_1 = require("@core/db");
class SlotGenerator {
    async generateCompanySlots(params) {
        const { scheduleId, tenantId, daysAhead = 30 } = params;
        return (0, db_1.runTenantTransaction)(tenantId, async (trx) => {
            // Buscar schedule
            const scheduleResult = await trx.query({
                text: `
          SELECT schedule_id, metadata
          FROM schedules
          WHERE schedule_id = $1
        `,
                values: [scheduleId],
            });
            if (scheduleResult.length === 0) {
                throw new Error('Schedule not found');
            }
            const schedule = scheduleResult[0];
            if (!schedule.metadata?.timezone || !schedule.metadata?.business_hours) {
                throw new Error('Schedule missing timezone or business_hours');
            }
            const tz = schedule.metadata.timezone;
            const hours = schedule.metadata.business_hours;
            // Duração do slot em minutos (padrão: 60min = 1h)
            const slotDurationMinutes = schedule.metadata.slot_duration_minutes || 60;
            // Gera array de slots
            const slotsToInsert = [];
            const start = luxon_1.DateTime.now().setZone(tz).startOf('day');
            const end = start.plus({ days: daysAhead });
            for (let date = start; date < end; date = date.plus({ days: 1 })) {
                const day = date.toFormat('EEEE').toLowerCase();
                const config = hours[day];
                if (!config)
                    continue;
                const [startH, startM] = config.start.split(':').map(Number);
                const [endH, endM] = config.end.split(':').map(Number);
                let cursor = date.set({ hour: startH, minute: startM, second: 0 });
                const limit = date.set({ hour: endH, minute: endM, second: 0 });
                while (cursor < limit) {
                    const next = cursor.plus({ minutes: slotDurationMinutes });
                    // Não criar slot se ultrapassar o limite do dia
                    if (next > limit)
                        break;
                    slotsToInsert.push({
                        schedule_id: scheduleId,
                        starts_at: cursor.toUTC().toISO(),
                        ends_at: next.toUTC().toISO(),
                        status: 'available',
                    });
                    cursor = next;
                }
            }
            // 🔴 CRÍTICO: Batch insert, não loop
            if (slotsToInsert.length > 0) {
                // Usar jsonb_to_recordset para batch insert conforme prompt
                await trx.query({
                    text: `
            INSERT INTO schedule_slots (schedule_id, starts_at, ends_at, status)
            SELECT * FROM jsonb_to_recordset($1::jsonb)
            AS t(schedule_id UUID, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, status TEXT)
            ON CONFLICT (schedule_id, starts_at, ends_at) DO NOTHING
          `,
                    values: [JSON.stringify(slotsToInsert)],
                });
            }
            return { generated: slotsToInsert.length };
        });
    }
}
exports.SlotGenerator = SlotGenerator;
