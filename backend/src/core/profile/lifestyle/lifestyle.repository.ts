// backend/src/core/profile/lifestyle/lifestyle.repository.ts
//
// F2 (DECISION-0071) — acesso a actor_lifestyle_attributes + actor_lifestyle_attribute_audit.
// COLUNAS EXPLÍCITAS; SEM SELECT *; tenant_id=$1 em toda query. actorId = valor recebido (actionContext).
// NENHUMA criação de actor. Sem global_users.metadata. visibility = 'private' (default do schema).
// O audit NUNCA recebe valor sensível (a tabela não tem coluna de valor).

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  LifestyleAttributeRow,
  ActorIdentityCheckRow,
  LifestyleAttributeKey,
  PersistAttributeInput,
  InsertAuditInput,
} from './lifestyle.types';

const COLS =
  'id, tenant_id, actor_id, attribute_key, attribute_value, visibility, ' +
  'consented_at, consent_source, consent_version, is_active, declared_at, updated_at, retired_at';

class LifestyleRepository {
  async getActorIdentityCheck(
    tenantId: string,
    actorId: string
  ): Promise<ActorIdentityCheckRow | undefined> {
    return runQueryWithTenant<ActorIdentityCheckRow>(
      tenantId,
      `SELECT id, actor_id FROM actors WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
      [tenantId, actorId]
    );
  }

  // Atributos ATIVOS do actor (self).
  async listActive(tenantId: string, actorId: string): Promise<LifestyleAttributeRow[]> {
    return runQueriesWithTenant<LifestyleAttributeRow>(
      tenantId,
      `SELECT ${COLS}
         FROM actor_lifestyle_attributes
        WHERE tenant_id = $1 AND actor_id = $2 AND is_active = true
        ORDER BY attribute_key`,
      [tenantId, actorId]
    );
  }

  // Linha do atributo (ATIVA OU INATIVA) — para decidir insert/reactivate/update (UNIQUE por key).
  async findByKey(
    tenantId: string,
    actorId: string,
    attributeKey: LifestyleAttributeKey
  ): Promise<LifestyleAttributeRow | undefined> {
    return runQueryWithTenant<LifestyleAttributeRow>(
      tenantId,
      `SELECT ${COLS}
         FROM actor_lifestyle_attributes
        WHERE tenant_id = $1 AND actor_id = $2 AND attribute_key = $3
        LIMIT 1`,
      [tenantId, actorId, attributeKey]
    );
  }

  // INSERT de atributo ativo. visibility omitida ⇒ 'private' (default do schema).
  async insertActive(
    tenantId: string,
    actorId: string,
    attributeKey: LifestyleAttributeKey,
    input: PersistAttributeInput
  ): Promise<LifestyleAttributeRow> {
    const row = await runQueryWithTenant<LifestyleAttributeRow>(
      tenantId,
      `INSERT INTO actor_lifestyle_attributes
         (tenant_id, actor_id, attribute_key, attribute_value, consented_at, consent_source, consent_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLS}`,
      [tenantId, actorId, attributeKey, input.attributeValue, input.consentedAt, input.consentSource, input.consentVersion]
    );
    if (!row) throw new Error('insertActive: RETURNING vazio inesperado');
    return row;
  }

  // Reativa um atributo INATIVO (retirado): volta a ativo com NOVO valor + NOVO consentimento.
  async reactivate(
    tenantId: string,
    actorId: string,
    attributeKey: LifestyleAttributeKey,
    input: PersistAttributeInput
  ): Promise<LifestyleAttributeRow | undefined> {
    return runQueryWithTenant<LifestyleAttributeRow>(
      tenantId,
      `UPDATE actor_lifestyle_attributes
          SET is_active = true,
              retired_at = NULL,
              attribute_value = $4,
              consented_at = $5,
              consent_source = $6,
              consent_version = $7,
              updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND attribute_key = $3 AND is_active = false
        RETURNING ${COLS}`,
      [tenantId, actorId, attributeKey, input.attributeValue, input.consentedAt, input.consentSource, input.consentVersion]
    );
  }

  // Atualiza o valor (+ re-consentimento) de um atributo ATIVO.
  async updateActive(
    tenantId: string,
    actorId: string,
    attributeKey: LifestyleAttributeKey,
    input: PersistAttributeInput
  ): Promise<LifestyleAttributeRow | undefined> {
    return runQueryWithTenant<LifestyleAttributeRow>(
      tenantId,
      `UPDATE actor_lifestyle_attributes
          SET attribute_value = $4,
              consented_at = $5,
              consent_source = $6,
              consent_version = $7,
              updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND attribute_key = $3 AND is_active = true
        RETURNING ${COLS}`,
      [tenantId, actorId, attributeKey, input.attributeValue, input.consentedAt, input.consentSource, input.consentVersion]
    );
  }

  // Remoção = desativação lógica + ANONYMIZE do valor (attribute_value → NULL). Só se estiver ativa.
  async retire(
    tenantId: string,
    actorId: string,
    attributeKey: LifestyleAttributeKey
  ): Promise<LifestyleAttributeRow | undefined> {
    return runQueryWithTenant<LifestyleAttributeRow>(
      tenantId,
      `UPDATE actor_lifestyle_attributes
          SET is_active = false,
              retired_at = now(),
              attribute_value = NULL,
              updated_at = now()
        WHERE tenant_id = $1 AND actor_id = $2 AND attribute_key = $3 AND is_active = true
        RETURNING ${COLS}`,
      [tenantId, actorId, attributeKey]
    );
  }

  // Audit append-only: registra QUE/QUANDO (key + action + actor + source), NUNCA o valor sensível.
  async insertAudit(tenantId: string, actorId: string, input: InsertAuditInput): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO actor_lifestyle_attribute_audit
         (tenant_id, actor_id, attribute_key, action, performed_by_actor_id, source, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenantId, actorId, input.attributeKey, input.action, input.performedByActorId, input.source, input.reason]
    );
  }
}

export const lifestyleRepository = new LifestyleRepository();
