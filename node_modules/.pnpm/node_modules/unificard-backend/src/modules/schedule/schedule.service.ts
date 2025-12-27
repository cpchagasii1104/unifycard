// src/modules/schedule/schedule.service.ts
import { ScheduleRepository } from './schedule.repository';
import { ScheduleModel, ScheduleSlotModel } from './schedule.model';
import type {
  Schedule,
  ScheduleSlot,
  CreateScheduleInput,
  AddSlotInput,
  ReserveSlotInput,
  ScheduleWithSlots,
} from './schedule.types';

class ScheduleService {
  private repository = new ScheduleRepository();

  /**
   * Cria ou busca agenda existente para um usuário
   */
  async getOrCreateUserSchedule(
    tenantId: string,
    globalUserId: string
  ): Promise<Schedule> {
    // Buscar agenda existente
    const existing = await this.repository.findByGlobalUserId(tenantId, globalUserId);
    if (existing) {
      return ScheduleModel.fromRow(existing);
    }

    // Criar nova agenda
    const row = await this.repository.create({
      tenantId,
      globalUserId,
      companyId: null,
      serviceId: null,
      metadata: {},
    });

    return ScheduleModel.fromRow(row);
  }

  /**
   * Cria ou busca agenda existente para uma empresa
   */
  async getOrCreateCompanySchedule(
    tenantId: string,
    companyId: string
  ): Promise<Schedule> {
    // Buscar agenda existente
    const existing = await this.repository.findByCompanyId(tenantId, companyId);
    if (existing) {
      return ScheduleModel.fromRow(existing);
    }

    // Criar nova agenda
    const row = await this.repository.create({
      tenantId,
      globalUserId: null,
      companyId,
      serviceId: null,
      metadata: {},
    });

    return ScheduleModel.fromRow(row);
  }

  /**
   * Cria uma nova agenda manualmente
   */
  async createSchedule(
    tenantId: string,
    input: CreateScheduleInput
  ): Promise<Schedule> {
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

    return ScheduleModel.fromRow(row);
  }

  /**
   * Busca agenda por ID
   */
  async getSchedule(tenantId: string, scheduleId: string): Promise<Schedule | null> {
    const row = await this.repository.findById(tenantId, scheduleId);
    return row ? ScheduleModel.fromRow(row) : null;
  }

  /**
   * Busca agenda com slots
   */
  async getScheduleWithSlots(
    tenantId: string,
    scheduleId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<ScheduleWithSlots | null> {
    const schedule = await this.getSchedule(tenantId, scheduleId);
    if (!schedule) {
      return null;
    }

    // Buscar slots
    const slotRows = await this.repository.findSlotsBySchedule(tenantId, scheduleId, options);
    const slots = ScheduleSlotModel.fromRows(slotRows);

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
  async addSlot(
    tenantId: string,
    scheduleId: string,
    input: AddSlotInput
  ): Promise<ScheduleSlot> {
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
      if (
        (input.startTime >= existingStart && input.startTime < existingEnd) ||
        (input.endTime > existingStart && input.endTime <= existingEnd) ||
        (input.startTime <= existingStart && input.endTime >= existingEnd)
      ) {
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

    return ScheduleSlotModel.fromRow(row);
  }

  /**
   * Reserva um slot
   */
  async reserveSlot(
    tenantId: string,
    scheduleId: string,
    input: ReserveSlotInput,
    globalUserId: string
  ): Promise<ScheduleSlot> {
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
    const reserved = await this.repository.reserveSlot(
      tenantId,
      input.slotId,
      globalUserId,
      input.actionId
    );

    if (!reserved) {
      throw new Error('Falha ao reservar slot (pode ter sido reservado por outro usuário)');
    }

    return ScheduleSlotModel.fromRow(reserved);
  }

  /**
   * Busca agenda por usuário global
   */
  async getScheduleByUser(tenantId: string, globalUserId: string): Promise<Schedule | null> {
    const row = await this.repository.findByGlobalUserId(tenantId, globalUserId);
    return row ? ScheduleModel.fromRow(row) : null;
  }

  /**
   * Busca agenda por empresa
   */
  async getScheduleByCompany(tenantId: string, companyId: string): Promise<Schedule | null> {
    const row = await this.repository.findByCompanyId(tenantId, companyId);
    return row ? ScheduleModel.fromRow(row) : null;
  }
}

export const scheduleService = new ScheduleService();








