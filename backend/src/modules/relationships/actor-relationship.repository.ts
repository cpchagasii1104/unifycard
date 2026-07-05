// backend/src/modules/relationships/actor-relationship.repository.ts
// F-ACTOR-RELATIONSHIP-TYPED-EDGE-SLICE-1 — persistência da aresta actor↔actor.
// SÓ toca actor_relationships (+ leitura de actors p/ tipo). NUNCA company_users, NUNCA bank_*.

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  ActorRelationship,
  RelationshipFilters,
  RelationshipLabel,
  RelationshipStatus,
} from './actor-relationship.types';

interface ActorRelationshipRow {
  id: string;
  tenant_id: string;
  from_actor_id: string;
  to_actor_id: string;
  status: string;
  requester_label: string;
  target_label: string | null;
  requested_at: Date;
  responded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Linha mínima do actor para o pareamento de vocabulário (leitura, nunca escrita). */
export interface ActorKindRow {
  id: string;
  actor_type: string;
  company_id: string | null;
  group_id: string | null;
}

const SELECT_COLS = `id, tenant_id, from_actor_id, to_actor_id, status, requester_label,
       target_label, requested_at, responded_at, created_at, updated_at`;

class ActorRelationshipRepository {
  private toEdge(row: ActorRelationshipRow): ActorRelationship {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      fromActorId: row.from_actor_id,
      toActorId: row.to_actor_id,
      status: row.status as RelationshipStatus,
      requesterLabel: row.requester_label as RelationshipLabel,
      targetLabel: (row.target_label as RelationshipLabel) ?? null,
      requestedAt: row.requested_at.toISOString(),
      respondedAt: row.responded_at ? row.responded_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /** Leitura do actor SÓ para classificar o lado (pf/pj) — sem PII, sem autoridade. */
  async findActorKindRow(tenantId: string, actorId: string): Promise<ActorKindRow | undefined> {
    return runQueryWithTenant<ActorKindRow>(
      tenantId,
      `SELECT id, actor_type, company_id, group_id FROM actors WHERE tenant_id = $1 AND id = $2`,
      [tenantId, actorId]
    );
  }

  async findById(tenantId: string, id: string): Promise<ActorRelationship | null> {
    const row = await runQueryWithTenant<ActorRelationshipRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_relationships WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id]
    );
    return row ? this.toEdge(row) : null;
  }

  /** A aresta do PAR NÃO-ordenado (A↔B): existe no máximo 1 (UNIQUE LEAST/GREATEST). */
  async findByPair(tenantId: string, actorA: string, actorB: string): Promise<ActorRelationship | null> {
    const row = await runQueryWithTenant<ActorRelationshipRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_relationships
        WHERE tenant_id = $1
          AND LEAST(from_actor_id, to_actor_id) = LEAST($2::uuid, $3::uuid)
          AND GREATEST(from_actor_id, to_actor_id) = GREATEST($2::uuid, $3::uuid)`,
      [tenantId, actorA, actorB]
    );
    return row ? this.toEdge(row) : null;
  }

  async create(
    tenantId: string,
    fromActorId: string,
    toActorId: string,
    requesterLabel: RelationshipLabel,
    createdByUserId: string
  ): Promise<ActorRelationship> {
    const row = await runQueryWithTenant<ActorRelationshipRow>(
      tenantId,
      `INSERT INTO actor_relationships
         (tenant_id, from_actor_id, to_actor_id, status, requester_label, created_by_user_id)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING ${SELECT_COLS}`,
      [tenantId, fromActorId, toActorId, requesterLabel, createdByUserId]
    );
    if (!row) throw new Error('Falha ao criar relação');
    return this.toEdge(row);
  }

  /** Resposta ao pedido (aceite classificado OU rejeição) — só transiciona a partir de 'pending'. */
  async respond(
    tenantId: string,
    id: string,
    status: 'accepted' | 'rejected',
    targetLabel: RelationshipLabel | null,
    respondedByUserId: string
  ): Promise<ActorRelationship | null> {
    const row = await runQueryWithTenant<ActorRelationshipRow>(
      tenantId,
      `UPDATE actor_relationships
          SET status = $3, target_label = $4, responded_at = now(), responded_by_user_id = $5
        WHERE tenant_id = $1 AND id = $2 AND status = 'pending'
       RETURNING ${SELECT_COLS}`,
      [tenantId, id, status, targetLabel, respondedByUserId]
    );
    return row ? this.toEdge(row) : null;
  }

  /** Arestas do actor (dos dois lados), filtráveis por status e por label (CRM: "meus fornecedores"). */
  async listForActor(
    tenantId: string,
    actorId: string,
    filters: RelationshipFilters = {}
  ): Promise<ActorRelationship[]> {
    const params: unknown[] = [tenantId, actorId];
    let where = `tenant_id = $1 AND (from_actor_id = $2 OR to_actor_id = $2)`;
    if (filters.status) {
      params.push(filters.status);
      where += ` AND status = $${params.length}`;
    }
    if (filters.label) {
      // o label "como EU classifico o outro" depende do lado: requester_label quando sou from,
      // target_label quando sou to — a projeção CRM olha a MINHA ótica da aresta.
      params.push(filters.label);
      where += ` AND ((from_actor_id = $2 AND requester_label = $${params.length})
                  OR (to_actor_id = $2 AND target_label = $${params.length}))`;
    }
    params.push(Math.min(filters.limit ?? 50, 200));
    const limitIdx = params.length;
    params.push(filters.offset ?? 0);
    const offsetIdx = params.length;

    const rows = await runQueriesWithTenant<ActorRelationshipRow>(
      tenantId,
      `SELECT ${SELECT_COLS} FROM actor_relationships
        WHERE ${where}
        ORDER BY requested_at DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params as any[]
    );
    return rows.map((r) => this.toEdge(r));
  }
}

export const actorRelationshipRepository = new ActorRelationshipRepository();
