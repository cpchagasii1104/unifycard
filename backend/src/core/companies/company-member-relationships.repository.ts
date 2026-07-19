// backend/src/core/companies/company-member-relationships.repository.ts
// DECISION-0189 (F2) — casa canônica do VÍNCULO JURÍDICO do membro + trilha append-only.
//
// REGRA DURA (R B5/B11): este repositório NÃO abre transação própria. TODA escrita exige o
// client transacional do CALLER (o writer empresarial é o dono único da transação — padrão
// selado D9.1). Vínculo/evento nascem na MESMA tx da mutação de membership ou nada nasce.

import type { TxQueryClient } from '@core/social/ports';
import {
  DELEGATION_RELATIONSHIP_TYPES,
  type DelegationRelationshipType,
} from '@core/actor-delegation/actor-delegation.repository';

export type RelationshipSource =
  | 'declared'
  | 'bootstrap'
  | 'backfill_delegation'
  | 'backfill_role_derivation'
  | 'invite_accept'
  | 'cutover';

export type CompanyMemberEventType =
  | 'bootstrap'
  | 'invited_accepted'
  | 'suspended'
  | 'resumed'
  | 'revoked'
  | 'reentered'
  | 'grants_changed'
  | 'governance_transferred'
  | 'relationship_declared'
  | 'backfill'
  | 'delegation_cutover';

export interface OpenRelationshipInput {
  tenantId: string;
  companyId: string;
  companyUserId: string;
  relationshipType: DelegationRelationshipType | null;
  departmentKey?: string | null;
  source: RelationshipSource;
  declaredByUserId?: string | null;
  declaredByActorId?: string | null;
}

export interface AppendMemberEventInput {
  tenantId: string;
  companyId: string;
  companyUserId: string;
  eventType: CompanyMemberEventType;
  snapshot?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  actedByUserId?: string | null;
  actedByActorId?: string | null;
}

const DEPARTMENT_KEY_RE = /^[a-z][a-z0-9_]*$/;

class CompanyMemberRelationshipsRepository {
  /**
   * Abre (ou substitui) o vínculo jurídico VIGENTE do membership: fecha o atual
   * (valid_to=now) e insere o novo com predecessor_id — cadeia causal preservada.
   * Idempotente por conteúdo: se o vigente já tem o MESMO relationship_type e
   * department_key, não cria linha nova (retorna o id vigente).
   */
  async openRelationshipOnClient(
    client: TxQueryClient,
    input: OpenRelationshipInput
  ): Promise<{ relationshipId: string; replacedId: string | null; changed: boolean }> {
    if (
      input.relationshipType !== null &&
      !DELEGATION_RELATIONSHIP_TYPES.includes(input.relationshipType)
    ) {
      throw Object.assign(new Error(`relationship_type inválido: ${input.relationshipType}`), {
        statusCode: 400,
      });
    }
    const departmentKey = input.departmentKey ?? null;
    if (departmentKey !== null && !DEPARTMENT_KEY_RE.test(departmentKey)) {
      throw Object.assign(new Error(`department_key inválida: ${departmentKey}`), { statusCode: 400 });
    }

    const current = await client.query(
      `SELECT id, relationship_type, department_key
         FROM company_member_relationships
        WHERE tenant_id = $1 AND company_user_id = $2 AND valid_to IS NULL
        FOR UPDATE`,
      [input.tenantId, input.companyUserId]
    );
    const row = current.rows[0] as
      | { id: string; relationship_type: string | null; department_key: string | null }
      | undefined;

    if (
      row &&
      (row.relationship_type ?? null) === (input.relationshipType ?? null) &&
      (row.department_key ?? null) === departmentKey
    ) {
      return { relationshipId: row.id, replacedId: null, changed: false };
    }

    let replacedId: string | null = null;
    if (row) {
      await client.query(
        `UPDATE company_member_relationships SET valid_to = now() WHERE tenant_id = $1 AND id = $2`,
        [input.tenantId, row.id]
      );
      replacedId = row.id;
    }

    const inserted = await client.query(
      `INSERT INTO company_member_relationships
         (tenant_id, company_id, company_user_id, relationship_type, department_key,
          source, declared_by_user_id, declared_by_actor_id, predecessor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        input.tenantId,
        input.companyId,
        input.companyUserId,
        input.relationshipType,
        departmentKey,
        input.source,
        input.declaredByUserId ?? null,
        input.declaredByActorId ?? null,
        replacedId,
      ]
    );
    return {
      relationshipId: (inserted.rows[0] as { id: string }).id,
      replacedId,
      changed: true,
    };
  }

  /** Evento append-only na MESMA transação do caller (UPDATE/DELETE morrem no trigger). */
  async appendMemberEventOnClient(client: TxQueryClient, input: AppendMemberEventInput): Promise<string> {
    const res = await client.query(
      `INSERT INTO company_member_events
         (tenant_id, company_id, company_user_id, event_type, snapshot, details,
          acted_by_user_id, acted_by_actor_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        input.tenantId,
        input.companyId,
        input.companyUserId,
        input.eventType,
        input.snapshot ? JSON.stringify(input.snapshot) : null,
        input.details ? JSON.stringify(input.details) : null,
        input.actedByUserId ?? null,
        input.actedByActorId ?? null,
      ]
    );
    return (res.rows[0] as { id: string }).id;
  }

  /** Vínculo vigente (leitura pura). */
  async getCurrentRelationshipOnClient(
    client: TxQueryClient,
    tenantId: string,
    companyUserId: string
  ): Promise<{ id: string; relationshipType: string | null; departmentKey: string | null } | null> {
    const res = await client.query(
      `SELECT id, relationship_type, department_key
         FROM company_member_relationships
        WHERE tenant_id = $1 AND company_user_id = $2 AND valid_to IS NULL
        LIMIT 1`,
      [tenantId, companyUserId]
    );
    const row = res.rows[0] as
      | { id: string; relationship_type: string | null; department_key: string | null }
      | undefined;
    return row
      ? { id: row.id, relationshipType: row.relationship_type, departmentKey: row.department_key }
      : null;
  }
}

export const companyMemberRelationshipsRepository = new CompanyMemberRelationshipsRepository();
