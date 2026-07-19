// backend/src/core/home-feed/home-feed.service.ts
// 2026-05-18 P2 — Feed multi-vetor v1 (composer)
//
// Compõe queue ordenada da home contextual a partir de SSOT existentes.
// V1: 2 vetores (Compromisso + Convite). Outros vetores entram conforme
// uso real puxar.
//
// LEI OPERACIONAL APLICADA:
//   "Módulo não possui verdade. Módulo projeta verdade."
//   - home-feed NÃO possui presença/relação/agenda própria
//   - Lê SSOT: event_reservations + events + group_invites + actors
//   - Cada item declara causalidade ao usuário
//   - Cada item carrega ancoragemMaterial verificável
//
// Authority do user sobre o actor: validada via capability resolver
// ANTES de qualquer agregação (sem authority → null → 403).

import { runQueriesWithTenant } from '@core/database/pool';
// DECISION-0189 (F3): actorCapabilitiesService removido — não é decisor (gate = authority canônica)
import type {
  HomeItem,
  HomeFeedResponse,
  FeedTemperature,
} from './home-feed.types';

interface CompromissoRow {
  reservation_id: string;
  event_id: string;
  event_title: string;
  event_datetime_start: Date | null;
  reservation_status: string;
  reservation_created_at: Date;
  reservation_expires_at: Date | null;
}

interface ConviteRow {
  invite_id: string;
  group_id: string;
  group_name: string | null;
  invited_by_actor_id: string;
  invited_by_display_name: string | null;
  invite_status: string;
  invite_created_at: Date;
  invite_expires_at: Date | null;
}

interface RecorrenciaRow {
  counterpart_actor_id: string;
  counterpart_display_name: string | null;
  counterpart_actor_type: string;
  day_of_week: number; // 0=Sun .. 6=Sat
  occurrence_count: string; // bigint como string
  last_occurrence_at: Date;
}

/**
 * Janela default de compromissos futuros considerados (em dias).
 * 30 dias = horizonte humano confortável; configurável via query param.
 */
const COMPROMISSO_WINDOW_DAYS_DEFAULT = 30;

/**
 * Threshold de "quente" para Compromisso — eventos nas próximas 24h.
 * Princípio: temperatura técnica → cache/latência/realtime.
 */
const COMPROMISSO_QUENTE_HOURS = 24;

/**
 * Vetor Recorrência v1 — janela histórica para detecção de padrão temporal.
 * 90 dias = ~13 ocorrências semanais se evento for ritual; suficiente para
 * threshold de 3+ ocorrências no mesmo dia-da-semana.
 */
const RECORRENCIA_WINDOW_DAYS = 90;

/**
 * Threshold mínimo de ocorrências no mesmo dia-da-semana para classificar
 * como padrão recorrente. 3+ filtra ruído sem exigir histórico longo.
 */
const RECORRENCIA_MIN_OCCURRENCES = 3;

const DAY_OF_WEEK_LABEL_PT: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terça',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
};

class HomeFeedService {
  async resolveForUser(
    tenantId: string,
    actorId: string,
    authenticatedUserId: string,
    options: { limit?: number; compromissoWindowDays?: number } = {}
  ): Promise<HomeFeedResponse | null> {
    const limit = Math.max(1, Math.min(20, options.limit ?? 10));
    const compromissoWindowDays = Math.max(
      1,
      Math.min(180, options.compromissoWindowDays ?? COMPROMISSO_WINDOW_DAYS_DEFAULT)
    );

    // 🔒 DECISION-0189 (F3): gate = REPRESENTAÇÃO de contexto (canRepresentActor) — projeção
    // não-financeira; actorCapabilitiesService deixa de ser decisor de acesso (§10).
    const { authorizationService } = await import('@core/authorization/authorization.service');
    const represents = await authorizationService.canRepresentActor(tenantId, authenticatedUserId, actorId);
    if (!represents) return null;

    // ===== VETOR COMPROMISSO =====
    // SSOT: event_reservations JOIN events
    // Filtros: reservation ativa + evento não cancelado/terminado + futuro
    // Ordering: datetime_start ASC (mais próximo primeiro)
    const compromissoRows = await runQueriesWithTenant<CompromissoRow>(
      tenantId,
      `
      SELECT
        er.id AS reservation_id,
        er.event_id,
        e.title AS event_title,
        e.datetime_start AS event_datetime_start,
        er.status AS reservation_status,
        er.created_at AS reservation_created_at,
        er.expires_at AS reservation_expires_at
      FROM event_reservations er
      INNER JOIN events e ON e.id = er.event_id AND e.tenant_id = er.tenant_id
      WHERE er.tenant_id = $1
        AND er.actor_id = $2
        AND er.status IN ('pending', 'confirmed')
        AND e.status NOT IN ('cancelled', 'ended')
        AND (e.datetime_start IS NULL OR e.datetime_start >= NOW() - INTERVAL '1 day')
        AND (e.datetime_start IS NULL OR e.datetime_start <= NOW() + ($3 || ' days')::interval)
      ORDER BY e.datetime_start ASC NULLS LAST, er.created_at DESC
      LIMIT $4
      `,
      [tenantId, actorId, String(compromissoWindowDays), limit]
    );

    // ===== VETOR CONVITE =====
    // SSOT: group_invites JOIN actors (invited_by) LEFT JOIN groups
    // Filtros: status='pending' + não expirado + destinatário = actor
    // Ordering: created_at DESC (mais recentes primeiro)
    const conviteRows = await runQueriesWithTenant<ConviteRow>(
      tenantId,
      `
      SELECT
        gi.id AS invite_id,
        gi.group_id,
        g.name AS group_name,
        gi.invited_by_actor_id,
        a.display_name AS invited_by_display_name,
        gi.status AS invite_status,
        gi.created_at AS invite_created_at,
        gi.expires_at AS invite_expires_at
      FROM group_invites gi
      LEFT JOIN groups g ON g.id = gi.group_id AND g.tenant_id = gi.tenant_id
      LEFT JOIN actors a ON a.id = gi.invited_by_actor_id AND a.tenant_id = gi.tenant_id
      WHERE gi.tenant_id = $1
        AND gi.invited_actor_id = $2
        AND gi.status = 'pending'
        AND (gi.expires_at IS NULL OR gi.expires_at > NOW())
      ORDER BY gi.created_at DESC
      LIMIT $3
      `,
      [tenantId, actorId, limit]
    );

    // ===== VETOR RECORRÊNCIA v1 =====
    // SSOT: bank_splits + actors (JOIN para resolver contraparte)
    // Heurística: padrões P2P no MESMO dia-da-semana de hoje, com 3+ ocorrências
    // em janela de 90 dias. Sinaliza "você costuma fazer X às quintas".
    // Sem IA — pattern detection puro sobre histórico financeiro.
    const recorrenciaRows = await runQueriesWithTenant<RecorrenciaRow>(
      tenantId,
      `
      WITH actor_pairs AS (
        SELECT
          CASE WHEN source_actor_id = $2 THEN target_actor_id ELSE source_actor_id END AS counterpart_actor_id,
          EXTRACT(DOW FROM created_at)::int AS day_of_week,
          created_at
        FROM bank_splits
        WHERE tenant_id = $1
          AND (source_actor_id = $2 OR target_actor_id = $2)
          AND source_actor_id != target_actor_id
          AND created_at >= NOW() - ($3 || ' days')::interval
      )
      SELECT
        ap.counterpart_actor_id,
        a.display_name AS counterpart_display_name,
        a.actor_type AS counterpart_actor_type,
        ap.day_of_week,
        COUNT(*)::text AS occurrence_count,
        MAX(ap.created_at) AS last_occurrence_at
      FROM actor_pairs ap
      INNER JOIN actors a ON a.id = ap.counterpart_actor_id AND a.tenant_id = $1
      WHERE ap.day_of_week = EXTRACT(DOW FROM NOW())::int
      GROUP BY ap.counterpart_actor_id, a.display_name, a.actor_type, ap.day_of_week
      HAVING COUNT(*) >= $4
      ORDER BY COUNT(*) DESC, MAX(ap.created_at) DESC
      LIMIT $5
      `,
      [tenantId, actorId, String(RECORRENCIA_WINDOW_DAYS), RECORRENCIA_MIN_OCCURRENCES, limit]
    );

    // ===== COMPOSIÇÃO =====
    const items: HomeItem[] = [];

    for (const r of compromissoRows) {
      const temperatura: FeedTemperature = this.compromissoTemperatura(r.event_datetime_start);
      const causalidade = this.compromissoCausalidade(r);
      items.push({
        vetor: 'compromisso',
        causalidade,
        escopo: 'solo',
        expiraEm: r.event_datetime_start ? r.event_datetime_start.toISOString() : null,
        temperatura,
        ancoragemMaterial: {
          tipo: 'event_reservation',
          id: r.reservation_id,
          extra: {
            eventId: r.event_id,
            eventTitle: r.event_title,
            reservationStatus: r.reservation_status,
          },
        },
        rotaSugerida: `/events/${r.event_id}`,
      });
    }

    for (const r of conviteRows) {
      const causalidade = this.conviteCausalidade(r);
      items.push({
        vetor: 'convite',
        causalidade,
        escopo: 'celula',
        expiraEm: r.invite_expires_at ? r.invite_expires_at.toISOString() : null,
        temperatura: 'quente', // convite pendente é always quente
        ancoragemMaterial: {
          tipo: 'group_invite',
          id: r.invite_id,
          extra: {
            groupId: r.group_id,
            groupName: r.group_name,
            invitedByActorId: r.invited_by_actor_id,
            invitedByName: r.invited_by_display_name,
          },
        },
        rotaSugerida: `/grupos/${r.group_id}`,
      });
    }

    for (const r of recorrenciaRows) {
      const causalidade = this.recorrenciaCausalidade(r);
      // ID derivado estável: actor + counterpart + dow. Anti-mutação de identidade
      // entre resoluções (mesmo padrão sempre retorna mesmo ID).
      const patternId = `${actorId}:${r.counterpart_actor_id}:dow${r.day_of_week}`;
      items.push({
        vetor: 'recorrencia',
        causalidade,
        escopo: 'solo',
        expiraEm: null, // padrão recorrente não tem prazo único — fica enquanto válido
        temperatura: 'morna', // recorrência é sugestão contextual, não urgência
        ancoragemMaterial: {
          tipo: 'recurring_pattern',
          id: patternId,
          extra: {
            counterpartActorId: r.counterpart_actor_id,
            counterpartDisplayName: r.counterpart_display_name,
            counterpartActorType: r.counterpart_actor_type,
            dayOfWeek: r.day_of_week,
            occurrenceCount: Number(r.occurrence_count),
            lastOccurrenceAt: r.last_occurrence_at.toISOString(),
            windowDays: RECORRENCIA_WINDOW_DAYS,
          },
        },
        rotaSugerida: '/banco',
      });
    }

    // Ordenação final: quente > morna > fria, depois temporal mais urgente primeiro
    items.sort((a, b) => {
      const tempOrder = { quente: 0, morna: 1, fria: 2 };
      const ta = tempOrder[a.temperatura];
      const tb = tempOrder[b.temperatura];
      if (ta !== tb) return ta - tb;
      // tie-break: items que expiram mais cedo vêm primeiro (sem expiração no fim)
      if (a.expiraEm && b.expiraEm) {
        return new Date(a.expiraEm).getTime() - new Date(b.expiraEm).getTime();
      }
      if (a.expiraEm && !b.expiraEm) return -1;
      if (!a.expiraEm && b.expiraEm) return 1;
      return 0;
    });

    return {
      actorId,
      items: items.slice(0, limit),
      vetoresAtivos: items.length > 0
        ? Array.from(new Set(items.map((i) => i.vetor)))
        : [],
      resolvedAt: new Date().toISOString(),
      source: 'mvp-multi-vetor-v1',
    };
  }

  private compromissoTemperatura(datetimeStart: Date | null): FeedTemperature {
    if (!datetimeStart) return 'morna';
    const diffMs = datetimeStart.getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours <= COMPROMISSO_QUENTE_HOURS) return 'quente';
    if (diffHours <= 24 * 7) return 'morna';
    return 'fria';
  }

  private compromissoCausalidade(r: CompromissoRow): string {
    const title = r.event_title || 'evento';
    if (!r.event_datetime_start) {
      return `Reserva ${r.reservation_status === 'confirmed' ? 'confirmada' : 'pendente'} — ${title}`;
    }
    const diffMs = r.event_datetime_start.getTime() - Date.now();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 0) return `Aconteceu hoje — ${title}`;
    if (diffHours <= 24) {
      const hours = Math.max(1, Math.round(diffHours));
      return `Em ${hours}h — ${title}`;
    }
    const days = Math.round(diffHours / 24);
    return `Em ${days} dia${days > 1 ? 's' : ''} — ${title}`;
  }

  private conviteCausalidade(r: ConviteRow): string {
    const groupLabel = r.group_name ? `"${r.group_name}"` : 'um grupo';
    const inviterLabel = r.invited_by_display_name || 'Alguém';
    return `${inviterLabel} te convidou para ${groupLabel}`;
  }

  private recorrenciaCausalidade(r: RecorrenciaRow): string {
    const dayLabel = DAY_OF_WEEK_LABEL_PT[r.day_of_week] ?? 'este dia';
    const counterpartLabel = r.counterpart_display_name || 'essa contraparte';
    const count = Number(r.occurrence_count);
    return `Você costuma transacionar com ${counterpartLabel} às ${dayLabel}s (${count} vezes nos últimos 90 dias)`;
  }
}

export const homeFeedService = new HomeFeedService();
