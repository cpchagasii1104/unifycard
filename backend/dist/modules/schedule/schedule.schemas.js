"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slotStatusSchema = exports.reserveSlotSchema = exports.addSlotSchema = exports.createScheduleSchema = void 0;
// src/modules/schedule/schedule.schemas.ts
const zod_1 = require("zod");
exports.createScheduleSchema = zod_1.z.object({
    globalUserId: zod_1.z.string().uuid('ID do usuário global inválido').nullable().optional(),
    companyId: zod_1.z.string().uuid('ID da empresa inválido').nullable().optional(),
    serviceId: zod_1.z.string().uuid('ID do serviço inválido').nullable().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
}).refine((data) => {
    const hasOwner = data.globalUserId || data.companyId || data.serviceId;
    return !!hasOwner;
}, {
    message: 'Deve fornecer globalUserId, companyId ou serviceId',
    path: ['globalUserId'],
});
exports.addSlotSchema = zod_1.z.object({
    startTime: zod_1.z.string().datetime('Data/hora de início inválida').transform((str) => new Date(str)),
    endTime: zod_1.z.string().datetime('Data/hora de fim inválida').transform((str) => new Date(str)),
    status: zod_1.z.enum(['available', 'reserved', 'blocked']).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
}).refine((data) => data.endTime > data.startTime, {
    message: 'Data/hora de fim deve ser posterior à data/hora de início',
    path: ['endTime'],
});
exports.reserveSlotSchema = zod_1.z.object({
    slotId: zod_1.z.string().uuid('ID do slot inválido'),
    actionId: zod_1.z.string().uuid('ID da ação inválido').optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.slotStatusSchema = zod_1.z.enum(['available', 'reserved', 'blocked']);
//# sourceMappingURL=schedule.schemas.js.map