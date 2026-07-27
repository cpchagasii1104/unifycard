// backend/src/modules/events/event-sector.service.ts
// SLICE S3 (SETORES) — Service THIN de SETOR (validate-before-mutate §4.9.5). Espelha as CHECKs físicas
// da migration com 4xx HONESTO (nunca deixa o 23514 cru vazar). Autoridade (dono do evento) é provada NA
// ROTA (espelha a rota de ingresso); este service NÃO re-verifica ownership — só valida regras e delega.
//
// Piso legal da MEIA (meia_quota_bps 4000..10000 = 40%–100%) HARD-LOCKED por lei (Lei 12.933/2013 +
// Decreto 8.537/2015). MEIA = METADE EXATA da inteira (não só "mais barata" — ver assertMeiaIsExactlyHalf).
// Reconciliação: SUM(capacity dos setores) reconcilia A events.max_attendees (SSOT), NUNCA ao lado dela —
// serializada por transação + advisory lock no repository (createSectorReconciled/updateSectorReconciled)
// contra a corrida TOCTOU entre o SELECT SUM e o INSERT/UPDATE. Bank-free: preços são valores DECLARADOS
// de catálogo (Δbank=0); venda/decremento/check de elegibilidade da meia = PORTA-01 (Fatia 2), FORA.

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

  /**
   * MEIA = METADE EXATA da inteira (Lei 12.933/2013) — espelho da CHECK física
   * chk_event_sectors_meia_is_half_inteira (meia_price_cents = inteira_price_cents / 2). Divisão
   * inteira (Math.floor para valores não-negativos) trunca em direção a zero — arredonda a meia PARA
   * BAIXO quando a inteira é ímpar (nunca para cima): regra sempre favorável ao consumidor. Substitui
   * o antigo assertMeiaLeInteira (meia <= inteira), que só barrava meia MAIOR e permitia uma falsa
   * "meia" com apenas 1% de desconto — a lei exige METADE, não "mais barata".
   */
  private assertMeiaIsExactlyHalf(meiaPriceCents: number, inteiraPriceCents: number): void {
    const exactHalf = Math.floor(inteiraPriceCents / 2);
    if (meiaPriceCents !== exactHalf) {
      throw new AppError(
        400,
        `SECTOR_MEIA_PRICE_NOT_HALF: meia_price_cents (${meiaPriceCents}) deve ser EXATAMENTE a metade de inteira_price_cents (${inteiraPriceCents}) — esperado ${exactHalf} (Lei 12.933/2013; divisão inteira arredonda para baixo, favorável ao consumidor). Recebido: ${meiaPriceCents}.`,
        'SECTOR_MEIA_PRICE_NOT_HALF'
      );
    }
  }

  /**
   * HARDEN E6 — validação de RUNTIME do corpo (o generic do Fastify é só compile-time; sem isto, um
   * body malformado — ex.: capacity: "abc" — chegava cru ao Postgres e vazava erro de driver). Roda
   * ANTES de qualquer query. Mesmo estilo do resto deste service (validate-before-mutate com AppError
   * + código específico) — não introduz zod/schema novo neste arquivo, que nunca os usou.
   */
  private assertValidSectorBody(input: {
    sectorNumber?: number;
    name?: string;
    capacity?: number;
    meiaQuotaBps?: number;
    inteiraPriceCents?: number;
    meiaPriceCents?: number;
  }, opts: { partial: boolean }): void {
    const isPosInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
    const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

    const fail = (code: string, msg: string): never => {
      throw new AppError(400, `${code}: ${msg}`, code);
    };

    if (!opts.partial || input.sectorNumber !== undefined) {
      if (!isPosInt(input.sectorNumber)) fail('SECTOR_INVALID_SECTOR_NUMBER', 'sectorNumber deve ser um inteiro positivo.');
    }
    if (!opts.partial || input.name !== undefined) {
      if (typeof input.name !== 'string' || input.name.trim() === '') fail('SECTOR_INVALID_NAME', 'name deve ser uma string não-vazia.');
    }
    if (!opts.partial || input.capacity !== undefined) {
      if (!isPosInt(input.capacity)) fail('SECTOR_INVALID_CAPACITY', 'capacity deve ser um inteiro positivo.');
    }
    if (input.meiaQuotaBps !== undefined) {
      // SÓ o FORMATO (inteiro) — o RANGE 40%–100% é regra LEGAL e pertence exclusivamente a
      // assertMeiaQuotaFloor (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR), que roda logo em seguida. Duplicar
      // o range aqui com um código genérico SOMBREARIA a mensagem legal específica (a lei, não um
      // formato inválido, é o motivo da rejeição) e tornaria assertMeiaQuotaFloor morto para esse caso.
      if (!Number.isInteger(input.meiaQuotaBps)) {
        fail('SECTOR_INVALID_MEIA_QUOTA_BPS', 'meiaQuotaBps deve ser um número inteiro (bps).');
      }
    }
    if (!opts.partial || input.inteiraPriceCents !== undefined) {
      if (!isNonNegInt(input.inteiraPriceCents)) fail('SECTOR_INVALID_INTEIRA_PRICE', 'inteiraPriceCents deve ser um inteiro não-negativo.');
    }
    if (!opts.partial || input.meiaPriceCents !== undefined) {
      if (!isNonNegInt(input.meiaPriceCents)) fail('SECTOR_INVALID_MEIA_PRICE', 'meiaPriceCents deve ser um inteiro não-negativo.');
    }
  }

  // Reconciliação da capacidade (invariante cross-row): SUM(capacity dos setores já persistidos,
  // excluindo o próprio no UPDATE) + a nova capacity NÃO pode exceder events.max_attendees. events.
  // max_attendees é o SSOT do evento inteiro — os setores reconciliam A ELE, nunca ao lado dele.
  // max_attendees NULL = sem teto declarado (nada a reconciliar). BUG D1 (TOCTOU): o SELECT SUM e o
  // INSERT/UPDATE eram DUAS chamadas separadas (runQueryWithTenant abre um client NOVO por chamada) —
  // duas criações concorrentes podiam ambas passar o check e ambas inserir, furando a invariante.
  // A correção agora vive no repository (createSectorReconciled/updateSectorReconciled), NUM ÚNICO
  // client/transação com pg_advisory_xact_lock por (tenant,event) — mesma casa da trava de
  // core/events/event.service.ts (createEventBoundToGroup).

  async createSector(
    tenantId: string,
    eventId: string,
    input: CreateEventSectorInput
  ): Promise<EventSector> {
    this.assertValidSectorBody(input, { partial: false });
    // meia_quota_bps ausente = default legal 4000; validamos o valor EFETIVO contra o piso.
    const effectiveQuota = input.meiaQuotaBps ?? MEIA_QUOTA_LEGAL_FLOOR_BPS;
    this.assertMeiaQuotaFloor(effectiveQuota);
    this.assertMeiaIsExactlyHalf(input.meiaPriceCents, input.inteiraPriceCents);

    return eventSectorRepository.createSectorReconciled(tenantId, eventId, input);
  }

  async updateSector(
    tenantId: string,
    sectorId: string,
    input: UpdateEventSectorInput
  ): Promise<EventSector> {
    this.assertValidSectorBody(input, { partial: true });
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
    this.assertMeiaIsExactlyHalf(effectiveMeia, effectiveInteira);

    return eventSectorRepository.updateSectorReconciled(tenantId, sectorId, existing.eventId, input, effectiveCapacity);
  }

  async listSectors(tenantId: string, eventId: string): Promise<EventSector[]> {
    return eventSectorRepository.listSectorsByEvent(tenantId, eventId);
  }
}

// 🔴 E7 (auditoria blind): updateSector acima é DEAD CODE hoje — zero rota o expõe, zero caller.
// Qualquer wiring FUTURO de rota para ele PRECISA repetir o gate de ownership (userCanActOnEventOwner
// sobre event.organizerActorId, manage_events) NA ROTA, espelhando exatamente o padrão já SELADO de
// POST /events/:id/sectors (events-sprint76.routes.ts) — este service NÃO reverifica autoridade.

export const eventSectorService = new EventSectorService();
