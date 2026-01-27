"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleService = void 0;
// src/modules/schedule/schedule.service.ts
const schedule_repository_1 = require("./schedule.repository");
const schedule_model_1 = require("./schedule.model");
class ScheduleService {
    repository = new schedule_repository_1.ScheduleRepository();
    /**
     * Cria ou busca agenda existente para um usuário
     */
    async getOrCreateUserSchedule(tenantId, globalUserId) {
        // Buscar agenda existente
        const existing = await this.repository.findByGlobalUserId(tenantId, globalUserId);
        if (existing) {
            return schedule_model_1.ScheduleModel.fromRow(existing);
        }
        // Criar nova agenda
        const row = await this.repository.create({
            tenantId,
            globalUserId,
            companyId: null,
            serviceId: null,
            metadata: {},
        });
        return schedule_model_1.ScheduleModel.fromRow(row);
    }
    /**
     * Cria ou busca agenda existente para uma empresa
     */
    async getOrCreateCompanySchedule(tenantId, companyId) {
        // Buscar agenda existente
        const existing = await this.repository.findByCompanyId(tenantId, companyId);
        if (existing) {
            return schedule_model_1.ScheduleModel.fromRow(existing);
        }
        // Criar nova agenda
        const row = await this.repository.create({
            tenantId,
            globalUserId: null,
            companyId,
            serviceId: null,
            metadata: {},
        });
        return schedule_model_1.ScheduleModel.fromRow(row);
    }
    /**
     * Cria uma nova agenda manualmente
     */
    async createSchedule(tenantId, input) {
        // Validar que tem pelo menos um owner
        if (!input.globalUserId && !input.companyId && !input.serviceId) {
            throw new Error('Deve fornecer globalUserId, companyId ou serviceId');
        }
        // Verificar se já existe
        if (input.globalUserId) {
            const existing = await this.repository.findByGlobalUserId(tenantId, input.globalUserId);
            if (existing) {
                throw new Error('Agenda já existe para este usuário');
            }
        }
        if (input.companyId) {
            const existing = await this.repository.findByCompanyId(tenantId, input.companyId);
            if (existing) {
                throw new Error('Agenda já existe para esta empresa');
            }
        }
        if (input.serviceId) {
            const existing = await this.repository.findByServiceId(tenantId, input.serviceId);
            if (existing) {
                throw new Error('Agenda já existe para este serviço');
            }
        }
        const row = await this.repository.create({
            tenantId,
            globalUserId: input.globalUserId ?? null,
            companyId: input.companyId ?? null,
            serviceId: input.serviceId ?? null,
            metadata: input.metadata || {},
        });
        return schedule_model_1.ScheduleModel.fromRow(row);
    }
    /**
     * Busca agenda por ID
     */
    async getSchedule(tenantId, scheduleId) {
        const row = await this.repository.findById(tenantId, scheduleId);
        return row ? schedule_model_1.ScheduleModel.fromRow(row) : null;
    }
    /**
     * Busca agenda com slots
     */
    async getScheduleWithSlots(tenantId, scheduleId, options = {}) {
        const schedule = await this.getSchedule(tenantId, scheduleId);
        if (!schedule) {
            return null;
        }
        // Buscar slots
        const slotRows = await this.repository.findSlotsBySchedule(tenantId, scheduleId, options);
        const slots = schedule_model_1.ScheduleSlotModel.fromRows(slotRows);
        // Calcular estatísticas
        const availableSlots = slots.filter((s) => s.status === 'available').length;
        const reservedSlots = slots.filter((s) => s.status === 'reserved').length;
        const blockedSlots = slots.filter((s) => s.status === 'blocked').length;
        return {
            ...schedule,
            slots,
            availableSlots,
            reservedSlots,
            blockedSlots,
        };
    }
    /**
     * Adiciona slot a uma agenda
     */
    async addSlot(tenantId, scheduleId, input) {
        // Verificar se agenda existe
        const schedule = await this.getSchedule(tenantId, scheduleId);
        if (!schedule) {
            throw new Error('Agenda não encontrada');
        }
        // Validar que endTime > startTime
        if (input.endTime <= input.startTime) {
            throw new Error('Data/hora de fim deve ser posterior à data/hora de início');
        }
        // Verificar sobreposição com slots existentes
        const existingSlots = await this.repository.findSlotsBySchedule(tenantId, scheduleId);
        for (const existing of existingSlots) {
            const existingStart = new Date(existing.start_time);
            const existingEnd = new Date(existing.end_time);
            // Verifica sobreposição
            if ((input.startTime >= existingStart && input.startTime < existingEnd) ||
                (input.endTime > existingStart && input.endTime <= existingEnd) ||
                (input.startTime <= existingStart && input.endTime >= existingEnd)) {
                throw new Error('Slot sobrepõe com slot existente');
            }
        }
        const row = await this.repository.createSlot({
            scheduleId,
            tenantId,
            startTime: input.startTime,
            endTime: input.endTime,
            status: input.status || 'available',
            metadata: input.metadata || {},
        });
        return schedule_model_1.ScheduleSlotModel.fromRow(row);
    }
    /**
     * Reserva um slot
     */
    async reserveSlot(tenantId, scheduleId, input, globalUserId) {
        // Verificar se slot existe e pertence à agenda
        const slot = await this.repository.findSlotById(tenantId, input.slotId);
        if (!slot) {
            throw new Error('Slot não encontrado');
        }
        if (slot.schedule_id !== scheduleId) {
            throw new Error('Slot não pertence a esta agenda');
        }
        if (slot.status !== 'available') {
            throw new Error(`Slot não está disponível (status: ${slot.status})`);
        }
        // Reservar slot
        const reserved = await this.repository.reserveSlot(tenantId, input.slotId, globalUserId, input.actionId);
        if (!reserved) {
            throw new Error('Falha ao reservar slot (pode ter sido reservado por outro usuário)');
        }
        return schedule_model_1.ScheduleSlotModel.fromRow(reserved);
    }
    /**
     * Busca agenda por usuário global
     */
    async getScheduleByUser(tenantId, globalUserId) {
        const row = await this.repository.findByGlobalUserId(tenantId, globalUserId);
        return row ? schedule_model_1.ScheduleModel.fromRow(row) : null;
    }
    /**
     * Busca agenda por empresa
     */
    async getScheduleByCompany(tenantId, companyId) {
        const row = await this.repository.findByCompanyId(tenantId, companyId);
        return row ? schedule_model_1.ScheduleModel.fromRow(row) : null;
    }
}
exports.scheduleService = new ScheduleService();
