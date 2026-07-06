// backend/src/core/actor-delegation/actor-delegation.repository.ts
// CONTINUOUS PRODUCTION: Repository para delegações entre actors
//
// 🔴 R2.2 (Lote L2, decisões D1-D5 de Clayton, 2026-07-06): writer governado.
// Cada grant/revoke escreve os campos governados (relationship_type=vínculo jurídico D2,
// granted_by_actor_id + previous_link_id = cadeia §4.9.9) E emite um evento na trilha append-only
// `actor_delegation_events` (D3) — SEMPRE na MESMA transação (delegação e evento nascem juntos ou
// nenhum nasce; nunca delegação sem rastro nem rastro sem delegação). O departamento (D2 eixo 2) NÃO
// é coluna — vive como scope estruturado em scopes_json (ex.: 'dept:warehouse'), decidido pelo caller.
// O GATE de autoridade (só canManageCompany concede; funcionário não se auto-concede) NÃO vive aqui —
// vive na porta selada da Fatia 2 (actor-relationship-membership-bridge) + company-members; este
// repositório é a camada de PERSISTÊNCIA governada, não de autorização. Escopo financeiro FORA (D4).

import { runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';

/** Vocabulário governado de vínculo jurídico (espelha o CHECK da migration 20260706120000). */
export const DELEGATION_RELATIONSHIP_TYPES = [
  'partner',
  'director',
  'administrator',
  'attorney',
  'legal_representative',
  'employee',
  'contractor',
] as const;
export type DelegationRelationshipType = (typeof DELEGATION_RELATIONSHIP_TYPES)[number];

export interface ActorDelegation {
  delegationId: string;
  tenantId: string;
  userActorId: string;
  institutionalActorId: string;
  scopes: string[];
  isTransitive: boolean;
  expiresAt?: Date;
  status: 'active' | 'revoked' | 'expired';
  relationshipType?: DelegationRelationshipType | null;
  grantedByActorId?: string | null;
  previousLinkId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

export interface CreateActorDelegationInput {
  userActorId: string;
  institutionalActorId: string;
  scopes: string[];
  isTransitive?: boolean;
  expiresAt?: Date;
  // R2.2 — campos governados (opcionais para compat de callers legados/seed; o writer da porta
  // selada passa relationshipType + grantedByActorId).
  relationshipType?: DelegationRelationshipType | null;
  grantedByActorId?: string | null;
  previousLinkId?: string | null;
}

interface DelegationRow {
  delegation_id: string;
  tenant_id: string;
  user_actor_id: string;
  institutional_actor_id: string;
  scopes_json: any;
  is_transitive: boolean;
  expires_at: Date | null;
  status: string;
  relationship_type: string | null;
  granted_by_actor_id: string | null;
  previous_link_id: string | null;
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}

const mapRow = (row: DelegationRow): ActorDelegation => ({
  delegationId: row.delegation_id,
  tenantId: row.tenant_id,
  userActorId: row.user_actor_id,
  institutionalActorId: row.institutional_actor_id,
  scopes: row.scopes_json || [],
  isTransitive: row.is_transitive,
  expiresAt: row.expires_at || undefined,
  status: row.status as 'active' | 'revoked' | 'expired',
  relationshipType: (row.relationship_type as DelegationRelationshipType | null) ?? null,
  grantedByActorId: row.granted_by_actor_id ?? null,
  previousLinkId: row.previous_link_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  revokedAt: row.revoked_at || undefined,
});

class ActorDelegationRepository {
  /**
   * Cria delegação governada (grant). Transação atômica:
   *   1. revoga delegações ativas anteriores do MESMO par (emitindo evento 'revoked' de cada);
   *   2. INSERT da nova delegação com campos governados;
   *   3. INSERT do evento 'granted' (snapshot de relationship_type + scopes).
   * Se qualquer passo falhar, ROLLBACK — nunca delegação sem evento nem vice-versa.
   */
  async create(
    tenantId: string,
    input: CreateActorDelegationInput
  ): Promise<ActorDelegation> {
    // 🔀 SOFT-BLOCK (Fase 3): validar delegação antes de qualquer escrita.
    const { softBlockService } = await import('@core/authorization/soft-block.service');
    softBlockService.validateDelegation(
      { isTransitive: input.isTransitive, expiresAt: input.expiresAt, scopes: input.scopes },
      { tenantId, actorId: input.userActorId, requestId: undefined }
    );

    const relationshipType = input.relationshipType ?? null;
    if (relationshipType !== null && !DELEGATION_RELATIONSHIP_TYPES.includes(relationshipType)) {
      throw Object.assign(new Error(`relationship_type inválido: ${relationshipType}`), { statusCode: 400 });
    }

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      // 1. Revogar ativas anteriores do mesmo par — emitindo evento 'revoked' de cada (trilha completa).
      const revoked = await client.query<{ delegation_id: string; relationship_type: string | null; scopes_json: any }>(
        `UPDATE actor_delegations
           SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND user_actor_id = $2 AND institutional_actor_id = $3 AND status = 'active'
         RETURNING delegation_id, relationship_type, scopes_json`,
        [tenantId, input.userActorId, input.institutionalActorId]
      );
      for (const r of revoked.rows) {
        await client.query(
          `INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type, actor_id, relationship_type, scopes_json, reason)
           VALUES ($1, $2, 'revoked', $3, $4, $5, 'superseded_by_new_grant')`,
          [tenantId, r.delegation_id, input.grantedByActorId ?? null, r.relationship_type, JSON.stringify(r.scopes_json ?? [])]
        );
      }

      // 2. INSERT da nova delegação com campos governados.
      const inserted = await client.query<DelegationRow>(
        `INSERT INTO actor_delegations (
           tenant_id, user_actor_id, institutional_actor_id,
           scopes_json, is_transitive, expires_at, status,
           relationship_type, granted_by_actor_id, previous_link_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)
         RETURNING *`,
        [
          tenantId,
          input.userActorId,
          input.institutionalActorId,
          JSON.stringify(input.scopes),
          input.isTransitive || false,
          input.expiresAt || null,
          relationshipType,
          input.grantedByActorId ?? null,
          input.previousLinkId ?? null,
        ]
      );
      const row = inserted.rows[0];

      // 3. INSERT do evento 'granted' (snapshot no momento do grant).
      await client.query(
        `INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type, actor_id, relationship_type, scopes_json)
         VALUES ($1, $2, 'granted', $3, $4, $5)`,
        [tenantId, row.delegation_id, input.grantedByActorId ?? null, relationshipType, JSON.stringify(input.scopes)]
      );

      await client.query('COMMIT');
      return mapRow(row);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Busca delegações ativas por user_actor.
   */
  async findActiveByUserActor(
    tenantId: string,
    userActorId: string
  ): Promise<ActorDelegation[]> {
    const result = await runQueriesWithTenant<DelegationRow>(
      tenantId,
      `SELECT *
         FROM actor_delegations
        WHERE tenant_id = $1 AND user_actor_id = $2 AND status = 'active'
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC`,
      [tenantId, userActorId]
    );
    return result.map(mapRow);
  }

  /**
   * Revoga delegação (transação atômica: UPDATE status + INSERT evento 'revoked').
   * `revokedByActorId` = quem revogou (autoria da revogação; NULL em revogação de sistema).
   */
  async revoke(
    tenantId: string,
    delegationId: string,
    revokedByActorId?: string | null
  ): Promise<boolean> {
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      const result = await client.query<{ delegation_id: string; relationship_type: string | null; scopes_json: any }>(
        `UPDATE actor_delegations
           SET status = 'revoked', revoked_at = NOW(), updated_at = NOW()
         WHERE tenant_id = $1 AND delegation_id = $2 AND status = 'active'
         RETURNING delegation_id, relationship_type, scopes_json`,
        [tenantId, delegationId]
      );
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      const r = result.rows[0];
      await client.query(
        `INSERT INTO actor_delegation_events (tenant_id, delegation_id, event_type, actor_id, relationship_type, scopes_json)
         VALUES ($1, $2, 'revoked', $3, $4, $5)`,
        [tenantId, delegationId, revokedByActorId ?? null, r.relationship_type, JSON.stringify(r.scopes_json ?? [])]
      );
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* noop */ });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Lê a trilha de auditoria de uma delegação (append-only; ordenada por tempo).
   */
  async listEvents(
    tenantId: string,
    delegationId: string
  ): Promise<Array<{ eventId: string; eventType: string; actorId: string | null; relationshipType: string | null; scopes: string[]; reason: string | null; createdAt: Date }>> {
    const rows = await runQueriesWithTenant<{
      event_id: string; event_type: string; actor_id: string | null; relationship_type: string | null; scopes_json: any; reason: string | null; created_at: Date;
    }>(
      tenantId,
      `SELECT event_id, event_type, actor_id, relationship_type, scopes_json, reason, created_at
         FROM actor_delegation_events
        WHERE tenant_id = $1 AND delegation_id = $2
        ORDER BY created_at ASC`,
      [tenantId, delegationId]
    );
    return rows.map((r) => ({
      eventId: r.event_id,
      eventType: r.event_type,
      actorId: r.actor_id,
      relationshipType: r.relationship_type,
      scopes: r.scopes_json || [],
      reason: r.reason,
      createdAt: r.created_at,
    }));
  }
}

export const actorDelegationRepository = new ActorDelegationRepository();
