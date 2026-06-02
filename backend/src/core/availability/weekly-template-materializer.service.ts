// src/core/availability/weekly-template-materializer.service.ts
// F1 (DECISION-0072 B1): Materializador do template semanal declarativo da Agenda em janelas
// CONCRETAS dentro de `unified_availability` (tabela `availability`) — o ÚNICO SSOT temporal
// (SSOT_REGISTRY §SSOT TEMPORAL).
//
// 🔴 BLINDAGEM: este materializador NÃO decide quem agenda, NÃO move dinheiro, NÃO faz matching.
// 🔴 SSOT: grava SOMENTE em `availability` via o service canônico. NUNCA em schedules/schedule_slots
//    (LEGADO, WRITE = C63 crítico), NUNCA em profile/professional, NUNCA em metadata.schedule.
// 🔴 MARCADOR DE PROCEDÊNCIA: cada janela gerada recebe `metadata.source='profile_weekly_template'`.
//    Isto é marcação de ORIGEM (provenance), NÃO persistência do schedule. O guard do Core bloqueia
//    APENAS a chave `metadata.schedule` (unified-availability.routes.ts:99-104); `metadata` é
//    `z.record(z.any())` — outras chaves são livres. Logo o marcador é LEGAL (DECISION-0072 §3.8 veta
//    "schedule em metadata", não "qualquer metadata"). Sem este marcador o diff incremental não
//    conseguiria distinguir janela gerada por template de janela criada manualmente.
//
// Modelagem B1: grade semanal (recorrência) → janelas concretas com `availability_type='recurring'`;
// exceções `specific` (datadas) → janelas concretas `availability_type='fixed'`. Horizonte FINITO.
// Diff INCREMENTAL: cria faltantes, mantém equivalentes, reativa as pausadas equivalentes, e SÓ
// retira (soft, `status='paused'`, NUNCA DELETE) janelas-template órfãs SEM booking/participant ativo.

import { DateTime, IANAZone } from 'luxon';
import { unifiedAvailabilityService } from './unified-availability.service';
import { unifiedAvailabilityRepository } from './unified-availability.repository';
import { BadRequestError } from '@core/errors';
import {
  AvailabilityOwnerType,
  UnifiedAvailabilityType,
  UnifiedAvailabilityStatus,
  UnifiedBookingStatus,
  type UnifiedAvailability,
} from './unified-availability.types';

/** Marcador de procedência (NÃO é a chave `schedule` bloqueada pelo guard). */
export const WEEKLY_TEMPLATE_SOURCE = 'profile_weekly_template';

const DEFAULT_HORIZON_WEEKS = 8;
const MIN_HORIZON_WEEKS = 8;
const MAX_HORIZON_WEEKS = 12;

/** luxon: Monday=1 … Sunday=7 */
const WEEKDAY_TO_LUXON: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

/** Bookings nestes status NÃO bloqueiam retirada (não são compromissos vivos). */
const INACTIVE_BOOKING_STATUS = new Set<string>([
  UnifiedBookingStatus.CANCELLED,
  UnifiedBookingStatus.EXPIRED,
]);

export type WeeklyAvailabilitySchedule = Record<string, string[]>;

export interface MaterializeWeeklyTemplateInput {
  schedule: WeeklyAvailabilitySchedule;
  timezone: string; // IANA obrigatório — sem fallback silencioso
  ownerType: AvailabilityOwnerType;
  ownerId: string; // actor_id (resolvido server-side via actionContext)
  horizonWeeks?: number;
}

export interface MaterializeWeeklyTemplateResult {
  created: number;
  kept: number;
  reactivated: number;
  retired: number;
  protectedCount: number;
  rejected: Array<{ entry: string; reason: string }>;
  conflicts: Array<{ templateKey: string; reason: string }>;
  horizonWeeks: number;
  timezone: string;
  ownerType: AvailabilityOwnerType;
  ownerId: string;
}

interface DesiredWindow {
  startUtc: Date;
  endUtc: Date;
  availabilityType: UnifiedAvailabilityType;
  templateKey: string;
  instantKey: string;
}

function instantKey(start: Date, end: Date): string {
  return `${start.getTime()}|${end.getTime()}`;
}

function parseHHmmRange(
  range: string
): { sh: number; sm: number; eh: number; em: number } | null {
  const m = range.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!m) return null;
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  if (eh * 60 + em <= sh * 60 + sm) return null; // fim deve ser depois do início
  return { sh, sm, eh, em };
}

class WeeklyTemplateMaterializerService {
  /**
   * Materializa a grade semanal declarativa em janelas concretas no SSOT `availability`.
   * Idempotente, incremental e booking-safe. NÃO faz DELETE; retirada é soft (status=paused).
   */
  async materialize(
    tenantId: string,
    input: MaterializeWeeklyTemplateInput
  ): Promise<MaterializeWeeklyTemplateResult> {
    const { schedule, timezone, ownerType, ownerId } = input;

    if (!ownerId) {
      throw new BadRequestError('ownerId (actor) é obrigatório');
    }
    // Timezone EXPLÍCITA e validada — sem fallback silencioso (DECISION-0072 §3.4).
    if (!timezone || !IANAZone.isValidZone(timezone)) {
      throw new BadRequestError(
        `timezone IANA inválida ou ausente: "${timezone}". Informe uma timezone explícita (ex.: America/Sao_Paulo).`
      );
    }
    const horizonWeeks = Math.min(
      MAX_HORIZON_WEEKS,
      Math.max(MIN_HORIZON_WEEKS, input.horizonWeeks ?? DEFAULT_HORIZON_WEEKS)
    );

    const rejected: Array<{ entry: string; reason: string }> = [];
    const nowUtc = DateTime.utc().toJSDate();

    // ── 1. Calcular janelas DESEJADAS a partir do template ────────────────────────────────
    const desired = this.computeDesiredWindows(schedule, timezone, horizonWeeks, nowUtc, rejected);

    // ── 2. Carregar janelas-template EXISTENTES (marcador de procedência) ──────────────────
    const allOwnerWindows = await unifiedAvailabilityRepository.findAvailabilities(tenantId, {
      ownerType,
      ownerId,
    });
    const existingTemplate = allOwnerWindows.filter(
      (a) => (a.metadata as Record<string, unknown> | undefined)?.source === WEEKLY_TEMPLATE_SOURCE
    );
    const existingByInstant = new Map<string, UnifiedAvailability>();
    for (const a of existingTemplate) {
      existingByInstant.set(
        instantKey(new Date(a.startDatetime), new Date(a.endDatetime)),
        a
      );
    }

    // ── 3. Diff: criar faltantes / manter / reativar pausadas equivalentes ─────────────────
    let created = 0;
    let kept = 0;
    let reactivated = 0;
    const conflicts: Array<{ templateKey: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const w of desired) {
      const match = existingByInstant.get(w.instantKey);
      if (match) {
        seen.add(w.instantKey);
        if (match.status === UnifiedAvailabilityStatus.PAUSED) {
          // Reativar janela-template idêntica previamente retirada (sem duplicar). Status-only:
          // o marcador `metadata.source` já distingue origem; não precisamos remarcar metadata
          // (e o UPDATE jsonb dinâmico do repo compartilhado tem inferência de tipo frágil — evitado).
          await unifiedAvailabilityService.updateAvailability(tenantId, match.availabilityId, ownerId, {
            status: UnifiedAvailabilityStatus.ACTIVE,
          });
          reactivated++;
        } else {
          kept++;
        }
        continue;
      }
      // Criar janela faltante. Trigger anti-sobreposição pode rejeitar (overlap com janela
      // não-template ou entre faixas do próprio template) → reportar como conflito, não abortar.
      try {
        await unifiedAvailabilityService.createAvailability(tenantId, ownerId, {
          ownerType,
          ownerId,
          availabilityType: w.availabilityType,
          status: UnifiedAvailabilityStatus.ACTIVE,
          startDatetime: w.startUtc,
          endDatetime: w.endUtc,
          timezone,
          metadata: {
            source: WEEKLY_TEMPLATE_SOURCE,
            templateKey: w.templateKey,
            materializedAt: nowUtc.toISOString(),
          },
        });
        created++;
      } catch (err) {
        conflicts.push({
          templateKey: w.templateKey,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── 4. Retirar (soft) janelas-template órfãs SEM booking/participant ativo ──────────────
    let retired = 0;
    let protectedCount = 0;
    for (const a of existingTemplate) {
      const key = instantKey(new Date(a.startDatetime), new Date(a.endDatetime));
      if (seen.has(key)) continue; // ainda desejada
      if (a.status === UnifiedAvailabilityStatus.PAUSED) continue; // já retirada antes

      const bookings = await unifiedAvailabilityRepository.findBookings(tenantId, {
        availabilityId: a.availabilityId,
      });
      const activeBookings = bookings.filter((b) => !INACTIVE_BOOKING_STATUS.has(b.status));
      const participants = await unifiedAvailabilityRepository.findParticipants(tenantId, {
        availabilityId: a.availabilityId,
      });

      if (activeBookings.length > 0 || participants.length > 0) {
        // PROTEGIDA: janela com compromisso vivo nunca é apagada/retirada.
        protectedCount++;
        continue;
      }

      // Soft-retire: status=paused (status-only; NUNCA DELETE). A janela permanece marcada como
      // template via `metadata.source`; paused = retirada. Reativável por re-materialização idêntica.
      await unifiedAvailabilityService.updateAvailability(tenantId, a.availabilityId, ownerId, {
        status: UnifiedAvailabilityStatus.PAUSED,
      });
      retired++;
    }

    return {
      created,
      kept,
      reactivated,
      retired,
      protectedCount,
      rejected,
      conflicts,
      horizonWeeks,
      timezone,
      ownerType,
      ownerId,
    };
  }

  /** Expande o template (dias-da-semana + `specific`) em janelas concretas dentro do horizonte. */
  private computeDesiredWindows(
    schedule: WeeklyAvailabilitySchedule,
    timezone: string,
    horizonWeeks: number,
    nowUtc: Date,
    rejected: Array<{ entry: string; reason: string }>
  ): DesiredWindow[] {
    const out: DesiredWindow[] = [];
    const dedup = new Set<string>();
    const horizonDays = horizonWeeks * 7;
    const todayZ = DateTime.now().setZone(timezone).startOf('day');

    for (const [rawKey, ranges] of Object.entries(schedule || {})) {
      const key = rawKey.toLowerCase().trim();
      if (!Array.isArray(ranges)) {
        rejected.push({ entry: rawKey, reason: 'valor não é lista de faixas' });
        continue;
      }

      if (key in WEEKDAY_TO_LUXON) {
        const targetWeekday = WEEKDAY_TO_LUXON[key]!;
        for (const range of ranges) {
          const parsed = parseHHmmRange(range);
          if (!parsed) {
            rejected.push({ entry: `${key}:${range}`, reason: 'faixa inválida (use HH:MM-HH:MM, fim > início)' });
            continue;
          }
          for (let d = 0; d < horizonDays; d++) {
            const date = todayZ.plus({ days: d });
            if (date.weekday !== targetWeekday) continue;
            this.pushWindow(
              out, dedup, rejected, timezone, nowUtc,
              date.year, date.month, date.day, parsed,
              UnifiedAvailabilityType.RECURRING,
              `weekly:${key}:${date.toISODate()}:${range}`
            );
          }
        }
        continue;
      }

      if (key === 'specific') {
        for (const entry of ranges) {
          // formato "YYYY-MM-DD:HH:MM-HH:MM"
          const m = entry.match(/^(\d{4})-(\d{2})-(\d{2}):(\d{2}:\d{2}-\d{2}:\d{2})$/);
          if (!m) {
            rejected.push({ entry, reason: 'specific inválido (use YYYY-MM-DD:HH:MM-HH:MM)' });
            continue;
          }
          const parsed = parseHHmmRange(m[4]!);
          if (!parsed) {
            rejected.push({ entry, reason: 'faixa inválida em specific (HH:MM-HH:MM, fim > início)' });
            continue;
          }
          this.pushWindow(
            out, dedup, rejected, timezone, nowUtc,
            Number(m[1]), Number(m[2]), Number(m[3]), parsed,
            UnifiedAvailabilityType.FIXED,
            `specific:${m[1]}-${m[2]}-${m[3]}:${m[4]}`
          );
        }
        continue;
      }

      rejected.push({ entry: rawKey, reason: 'chave desconhecida (use monday..sunday ou specific)' });
    }

    return out;
  }

  private pushWindow(
    out: DesiredWindow[],
    dedup: Set<string>,
    rejected: Array<{ entry: string; reason: string }>,
    timezone: string,
    nowUtc: Date,
    year: number,
    month: number,
    day: number,
    t: { sh: number; sm: number; eh: number; em: number },
    availabilityType: UnifiedAvailabilityType,
    templateKey: string
  ): void {
    const start = DateTime.fromObject(
      { year, month, day, hour: t.sh, minute: t.sm },
      { zone: timezone }
    );
    const end = DateTime.fromObject(
      { year, month, day, hour: t.eh, minute: t.em },
      { zone: timezone }
    );
    if (!start.isValid || !end.isValid) {
      rejected.push({ entry: templateKey, reason: 'data/hora inválida na timezone' });
      return;
    }
    const startUtc = start.toJSDate();
    const endUtc = end.toJSDate();
    if (endUtc <= nowUtc) {
      // janela já passou — não materializar passado
      rejected.push({ entry: templateKey, reason: 'janela no passado (ignorada)' });
      return;
    }
    const ik = instantKey(startUtc, endUtc);
    if (dedup.has(ik)) return; // mesma janela vinda de chaves diferentes
    dedup.add(ik);
    out.push({ startUtc, endUtc, availabilityType, templateKey, instantKey: ik });
  }

}

export const weeklyTemplateMaterializerService = new WeeklyTemplateMaterializerService();
