// backend/src/modules/events/event-sector.service.ts
// SLICE S3 (SETORES) — Service THIN de SETOR (validate-before-mutate §4.9.5). Espelha as CHECKs físicas
// da migration com 4xx HONESTO (nunca deixa o 23514 cru vazar). Autoridade (dono do evento) é provada NA
// ROTA (espelha a rota de ingresso); este service NÃO re-verifica ownership — só valida regras e delega.
//
// Piso legal da MEIA (meia_quota_bps 4000..10000 = 40%–100%) HARD-LOCKED por lei (Lei 12.933/2013 +
// Decreto 8.537/2015). Reconciliação: SUM(capacity dos setores) reconcilia A events.max_attendees (SSOT),
// NUNCA ao lado dela. Bank-free: preços são valores DECLARADOS de catálogo (Δbank=0); venda/decremento/
// check de elegibilidade da meia = PORTA-01 (Fatia 2), FORA.

import { AppError } from '@core/errors';
import {
  eventSectorRepository,
  type EventSector,
  type CreateEventSectorInput,
  type UpdateEventSectorInput,
} from './event-sector.repository';

// Piso legal da meia-entrada: 40% da capacidade do setor. HARD-LOCKED — NUNCA pode descer.
const MEIA_QUOTA_LEGAL_FLOOR_BPS = 4000; // 40% (Lei 12.933/2013 + Decreto 8.537/2015)
const MEIA_QUOTA_CEILING_BPS = 10000; // 100%

class EventSectorService {
  /**
   * Valida meia_quota_bps contra o PISO LEGAL (espelho da CHECK do DB). O floor é a LEI: 40%–100%.
   * Fora da faixa → 400 SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR.
   */
  private assertMeiaQuotaFloor(meiaQuotaBps: number): void {
    if (meiaQuotaBps < MEIA_QUOTA_LEGAL_FLOOR_BPS || meiaQuotaBps > MEIA_QUOTA_CEILING_BPS) {
      throw new AppError(
        400,
        `SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR: a cota da meia-entrada deve ficar entre ${MEIA_QUOTA_LEGAL_FLOOR_BPS} e ${MEIA_QUOTA_CEILING_BPS} bps (40%–100% — piso legal Lei 12.933/2013 + Decreto 8.537/2015). Recebido: ${meiaQuotaBps}.`,
        'SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR'
      );
    }
  }

  /** meia_price nunca maior que inteira_price (espelho da CHECK chk_event_sectors_meia_le_inteira). */
  private assertMeiaLeInteira(meiaPriceCents: number, inteiraPriceCents: number): void {
    if (meiaPriceCents > inteiraPriceCents) {
      throw new AppError(
        400,
        `SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA: meia_price_cents (${meiaPriceCents}) não pode exceder inteira_price_cents (${inteiraPriceCents}).`,
        'SECTOR_MEIA_PRICE_EXCEEDS_INTEIRA'
      );
    }
  }

  /**
   * Reconciliação da capacidade (invariante cross-row, writer-enforced): SUM(capacity dos setores já
   * persistidos, excluindo o próprio no UPDATE) + a nova capacity NÃO pode exceder events.max_attendees.
   * events.max_attendees é o SSOT do evento inteiro — os setores reconciliam A ELE, nunca ao lado dele.
   * max_attendees NULL = sem teto declarado (nada a reconciliar).
   */
  private async assertCapacityReconciles(
    tenantId: string,
    eventId: string,
    newCapacity: number,
    excludeSectorId?: string
  ): Promise<void> {
    const maxAttendees = await eventSectorRepository.getEventMaxAttendees(tenantId, eventId);
    if (maxAttendees === null || maxAttendees === undefined) return;
    const existing = await eventSectorRepository.sumSectorCapacityByEvent(tenantId, eventId, excludeSectorId);
    const total = existing + newCapacity;
    if (total > maxAttendees) {
      throw new AppError(
        400,
        `SECTOR_CAPACITY_EXCEEDS_EVENT: a soma da capacidade dos setores (${total}) excede events.max_attendees (${maxAttendees}). Os setores reconciliam A max_attendees (SSOT), nunca ao lado dela.`,
        'SECTOR_CAPACITY_EXCEEDS_EVENT'
      );
    }
  }

  async createSector(
    tenantId: string,
    eventId: string,
    input: CreateEventSectorInput
  ): Promise<EventSector> {
    // meia_quota_bps ausente = default legal 4000; validamos o valor EFETIVO contra o piso.
    const effectiveQuota = input.meiaQuotaBps ?? MEIA_QUOTA_LEGAL_FLOOR_BPS;
    this.assertMeiaQuotaFloor(effectiveQuota);
    this.assertMeiaLeInteira(input.meiaPriceCents, input.inteiraPriceCents);
    await this.assertCapacityReconciles(tenantId, eventId, input.capacity);

    return eventSectorRepository.createSector(tenantId, eventId, input);
  }

  async updateSector(
    tenantId: string,
    sectorId: string,
    input: UpdateEventSectorInput
  ): Promise<EventSector> {
    const existing = await eventSectorRepository.getSectorById(tenantId, sectorId);
    if (!existing) {
      throw new AppError(404, 'SECTOR_NOT_FOUND: setor não encontrado.', 'SECTOR_NOT_FOUND');
    }

    // Valores EFETIVOS pós-update (COALESCE local) — validamos o que de fato ficará persistido.
    const effectiveQuota = input.meiaQuotaBps ?? existing.meiaQuotaBps;
    const effectiveMeia = input.meiaPriceCents ?? existing.meiaPriceCents;
    const effectiveInteira = input.inteiraPriceCents ?? existing.inteiraPriceCents;
    const effectiveCapacity = input.capacity ?? existing.capacity;

    this.assertMeiaQuotaFloor(effectiveQuota);
    this.assertMeiaLeInteira(effectiveMeia, effectiveInteira);
    await this.assertCapacityReconciles(tenantId, existing.eventId, effectiveCapacity, sectorId);

    return eventSectorRepository.updateSector(tenantId, sectorId, input);
  }

  async listSectors(tenantId: string, eventId: string): Promise<EventSector[]> {
    return eventSectorRepository.listSectorsByEvent(tenantId, eventId);
  }
}

export const eventSectorService = new EventSectorService();
