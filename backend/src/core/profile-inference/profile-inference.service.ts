// backend/src/core/profile-inference/profile-inference.service.ts
// 2026-05-18 P2 — Profile Inference MVP
//
// Resolve afinidades inferidas de um actor a partir de comportamento
// material rastreado em SSOT existentes (event_attendees + events,
// group_members + groups). READ-ONLY.
//
// Authority do user sobre o actor: validada via capability resolver
// ANTES (sem authority → null → 403).
//
// Princípio operacional: NÃO armazena nada, NÃO infere o que SSOT não
// suporta. Inferência aqui é AGREGAÇÃO contável honesta (X eventos de
// tipo Y → afinidade Y). Sem ML, sem opaco, sem caching de verdade.

import { runQueriesWithTenant, runQueryWithTenant } from '@core/database/pool';
import { actorCapabilitiesService } from '@core/actor-capabilities/actor-capabilities.service';
import type {
  EventTypeAffinity,
  CommunityMembership,
  InferredProfileResponse,
} from './profile-inference.types';

interface EventAffinityRow {
  event_type: string;
  event_subtype: string | null;
  attendance_count: string;
  last_attendance_at: Date;
}

interface CommunityRow {
  group_id: string;
  group_name: string;
  role: string;
  joined_at: Date;
}

/** Janela default para detecção de afinidade por eventos. */
const EVENT_WINDOW_DAYS_DEFAULT = 180;

class ProfileInferenceService {
  async resolveForUser(
    tenantId: string,
    actorId: string,
    authenticatedUserId: string,
    options: { windowDaysEvents?: number; limitAffinities?: number; limitCommunities?: number } = {}
  ): Promise<InferredProfileResponse | null> {
    const windowDaysEvents = Math.max(
      1,
      Math.min(365, options.windowDaysEvents ?? EVENT_WINDOW_DAYS_DEFAULT)
    );
    const limitAffinities = Math.max(1, Math.min(50, options.limitAffinities ?? 15));
    const limitCommunities = Math.max(1, Math.min(50, options.limitCommunities ?? 20));

    // Authority guard via capability resolver — mesma cadeia SSOT
    const caps = await actorCapabilitiesService.resolveForUser(tenantId, actorId, authenticatedUserId);
    if (!caps) return null;

    // ===== AFINIDADE POR TIPO DE EVENTO =====
    // SSOT: event_attendees JOIN events
    // Agrega event_type + event_subtype por contagem; janela 180 dias default
    const affinityRows = await runQueriesWithTenant<EventAffinityRow>(
      tenantId,
      `
      SELECT
        e.event_type,
        e.event_subtype,
        COUNT(*)::text AS attendance_count,
        MAX(ea.created_at) AS last_attendance_at
      FROM event_attendees ea
      INNER JOIN events e ON e.id = ea.event_id AND e.tenant_id = ea.tenant_id
      WHERE ea.tenant_id = $1
        AND ea.actor_id = $2
        AND ea.created_at >= NOW() - ($3 || ' days')::interval
        AND e.status NOT IN ('cancelled', 'draft')
      GROUP BY e.event_type, e.event_subtype
      ORDER BY COUNT(*) DESC, MAX(ea.created_at) DESC
      LIMIT $4
      `,
      [tenantId, actorId, String(windowDaysEvents), limitAffinities]
    );

    const eventTypeAffinities: EventTypeAffinity[] = affinityRows.map((r) => ({
      eventType: r.event_type,
      eventSubtype: r.event_subtype,
      attendanceCount: Number(r.attendance_count),
      lastAttendanceAt: r.last_attendance_at.toISOString(),
    }));

    // ===== COMUNIDADES (group_members) =====
    // group_members usa user_id (não actor_id). Para actor_type='user',
    // resolvemos user_id via actors.user_id e queryamos. Para outros tipos
    // (page/group/channel), retornamos lista vazia — comunidades são vínculo
    // pessoal humano, não institucional.
    const actorRow = await runQueryWithTenant<{ actor_type: string; user_id: string | null }>(
      tenantId,
      `SELECT actor_type, user_id FROM actors WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, actorId]
    );

    let communities: CommunityMembership[] = [];
    if (actorRow?.actor_type === 'user' && actorRow.user_id) {
      const communityRows = await runQueriesWithTenant<CommunityRow>(
        tenantId,
        `
        SELECT
          gm.group_id,
          g.name AS group_name,
          gm.role,
          gm.created_at AS joined_at
        FROM group_members gm
        INNER JOIN groups g ON g.id = gm.group_id AND g.tenant_id = gm.tenant_id
        WHERE gm.tenant_id = $1
          AND gm.user_id = $2
          AND g.status != 'archived'
        ORDER BY gm.created_at DESC
        LIMIT $3
        `,
        [tenantId, actorRow.user_id, limitCommunities]
      );
      communities = communityRows.map((r) => ({
        groupId: r.group_id,
        groupName: r.group_name,
        role: r.role,
        joinedAt: r.joined_at.toISOString(),
      }));
    }

    return {
      actorId,
      eventTypeAffinities,
      communities,
      windowDaysEvents,
      resolvedAt: new Date().toISOString(),
      source: 'mvp-events-and-communities',
    };
  }
}

export const profileInferenceService = new ProfileInferenceService();
