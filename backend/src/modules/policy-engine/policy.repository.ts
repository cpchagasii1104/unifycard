// backend/src/modules/policy-engine/policy.repository.ts
// Repository para Policy Rules e Policy Decisions
// 🔴 BLINDAGEM: Políticas são imutáveis após ativação

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  PolicyRule,
  PolicyDecision,
  CreatePolicyInput,
  ApplyPolicyDecisionInput,
  RevokePolicyDecisionInput,
  PolicyFilters,
  PolicyDecisionFilters,
} from './policy.types';

interface PolicyRuleRow {
  policy_id: string;
  tenant_id: string;
  name: string;
  description: string;
  policy_type: string;
  version: number;
  conditions: any;
  actions: any;
  is_active: boolean;
  activated_at: Date | null;
  activated_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

interface PolicyDecisionRow {
  decision_id: string;
  tenant_id: string;
  policy_id: string;
  policy_version: number;
  actor_id: string;
  status: string;
  applied_actions: any;
  reason: string;
  applied_by_user_id: string;
  applied_by_actor_id: string;
  evidence_pack_id: string | null;
  expires_at: Date | null;
  revoked_at: Date | null;
  revoked_by_user_id: string | null;
  revoked_by_actor_id: string | null;
  revocation_reason: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PolicyRepository {
  private toPolicyRule(row: PolicyRuleRow): PolicyRule {
    return {
      policyId: row.policy_id,
      tenantId: row.tenant_id,
      name: row.name,
      description: row.description,
      policyType: row.policy_type as any,
      version: row.version,
      conditions: row.conditions,
      actions: row.actions,
      isActive: row.is_active,
      activatedAt: row.activated_at,
      activatedByUserId: row.activated_by_user_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toPolicyDecision(row: PolicyDecisionRow): PolicyDecision {
    return {
      decisionId: row.decision_id,
      tenantId: row.tenant_id,
      policyId: row.policy_id,
      policyVersion: row.policy_version,
      actorId: row.actor_id,
      status: row.status as any,
      appliedActions: row.applied_actions,
      reason: row.reason,
      appliedByUserId: row.applied_by_user_id,
      appliedByActorId: row.applied_by_actor_id,
      evidencePackId: row.evidence_pack_id,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      revokedByUserId: row.revoked_by_user_id,
      revokedByActorId: row.revoked_by_actor_id,
      revocationReason: row.revocation_reason,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria uma nova política
   */
  async createPolicy(tenantId: string, input: CreatePolicyInput): Promise<PolicyRule> {
    const { randomUUID } = await import('crypto');
    const policyId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO policy_rules (
            policy_id, tenant_id, name, description, policy_type,
            version, conditions, actions, is_active, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) RETURNING *
        `,
        values: [
          policyId,
          tenantId,
          input.name,
          input.description,
          input.policyType,
          1,
          JSON.stringify(input.conditions),
          JSON.stringify(input.actions),
          false,
          JSON.stringify(input.metadata || {}),
        ],
      },
      'policy.repository.createPolicy'
    );

    return this.toPolicyRule(rows[0] as PolicyRuleRow);
  }

  /**
   * Busca política por ID
   */
  async findById(tenantId: string, policyId: string): Promise<PolicyRule | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM policy_rules
          WHERE tenant_id = $1 AND policy_id = $2
        `,
        values: [tenantId, policyId],
      },
      'policy.repository.findById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toPolicyRule(rows[0] as PolicyRuleRow);
  }

  /**
   * Lista políticas com filtros
   */
  async listPolicies(tenantId: string, filters: PolicyFilters = {}): Promise<PolicyRule[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.policyType) {
      conditions.push(`policy_type = $${paramIndex}`);
      values.push(filters.policyType);
      paramIndex++;
    }

    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      values.push(filters.isActive);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM policy_rules
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'policy.repository.listPolicies'
    );

    return rows.map((row) => this.toPolicyRule(row as PolicyRuleRow));
  }

  /**
   * Ativa uma política (incrementa versão e marca como ativa)
   */
  async activatePolicy(
    tenantId: string,
    policyId: string,
    userId: string
  ): Promise<PolicyRule> {
    // Buscar política atual
    const current = await this.findById(tenantId, policyId);
    if (!current) {
      const { NotFoundError } = await import('@core/errors');
      throw new NotFoundError('Política não encontrada');
    }

    // Incrementar versão e ativar
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE policy_rules
          SET
            version = version + 1,
            is_active = true,
            activated_at = NOW(),
            activated_by_user_id = $3,
            updated_at = NOW()
          WHERE tenant_id = $1 AND policy_id = $2
          RETURNING *
        `,
        values: [tenantId, policyId, userId],
      },
      'policy.repository.activatePolicy'
    );

    return this.toPolicyRule(rows[0] as PolicyRuleRow);
  }

  /**
   * Desativa uma política
   */
  async deactivatePolicy(tenantId: string, policyId: string): Promise<PolicyRule> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE policy_rules
          SET
            is_active = false,
            updated_at = NOW()
          WHERE tenant_id = $1 AND policy_id = $2
          RETURNING *
        `,
        values: [tenantId, policyId],
      },
      'policy.repository.deactivatePolicy'
    );

    if (rows.length === 0) {
      const { NotFoundError } = await import('@core/errors');
      throw new NotFoundError('Política não encontrada');
    }

    return this.toPolicyRule(rows[0] as PolicyRuleRow);
  }

  /**
   * Cria uma decisão de política
   */
  async createDecision(
    tenantId: string,
    input: ApplyPolicyDecisionInput,
    appliedByUserId: string,
    appliedByActorId: string,
    evidencePackId: string | null
  ): Promise<PolicyDecision> {
    // Buscar política
    const policy = await this.findById(tenantId, input.policyId);
    if (!policy) {
      const { NotFoundError } = await import('@core/errors');
      throw new NotFoundError('Política não encontrada');
    }

    if (!policy.isActive) {
      const { BadRequestError } = await import('@core/errors');
      throw new BadRequestError('Política deve estar ativa para aplicar decisão');
    }

    const { randomUUID } = await import('crypto');
    const decisionId = randomUUID();

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          INSERT INTO policy_decisions (
            decision_id, tenant_id, policy_id, policy_version, actor_id,
            status, applied_actions, reason, applied_by_user_id, applied_by_actor_id,
            evidence_pack_id, expires_at, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          ) RETURNING *
        `,
        values: [
          decisionId,
          tenantId,
          input.policyId,
          policy.version,
          input.actorId,
          'ACTIVE',
          JSON.stringify(policy.actions),
          input.reason,
          appliedByUserId,
          appliedByActorId,
          evidencePackId,
          input.expiresAt || null,
          JSON.stringify(input.metadata || {}),
        ],
      },
      'policy.repository.createDecision'
    );

    return this.toPolicyDecision(rows[0] as PolicyDecisionRow);
  }

  /**
   * Busca decisão por ID
   */
  async findDecisionById(tenantId: string, decisionId: string): Promise<PolicyDecision | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM policy_decisions
          WHERE tenant_id = $1 AND decision_id = $2
        `,
        values: [tenantId, decisionId],
      },
      'policy.repository.findDecisionById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toPolicyDecision(rows[0] as PolicyDecisionRow);
  }

  /**
   * Lista decisões com filtros
   */
  async listDecisions(
    tenantId: string,
    filters: PolicyDecisionFilters = {}
  ): Promise<PolicyDecision[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.policyId) {
      conditions.push(`policy_id = $${paramIndex}`);
      values.push(filters.policyId);
      paramIndex++;
    }

    if (filters.actorId) {
      conditions.push(`actor_id = $${paramIndex}`);
      values.push(filters.actorId);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM policy_decisions
          WHERE ${conditions.join(' AND ')}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'policy.repository.listDecisions'
    );

    return rows.map((row) => this.toPolicyDecision(row as PolicyDecisionRow));
  }

  /**
   * Revoga uma decisão
   */
  async revokeDecision(
    tenantId: string,
    decisionId: string,
    revokedByUserId: string,
    revokedByActorId: string,
    revocationReason: string
  ): Promise<PolicyDecision> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE policy_decisions
          SET
            status = 'REVOKED',
            revoked_at = NOW(),
            revoked_by_user_id = $3,
            revoked_by_actor_id = $4,
            revocation_reason = $5,
            updated_at = NOW()
          WHERE tenant_id = $1 AND decision_id = $2 AND status = 'ACTIVE'
          RETURNING *
        `,
        values: [tenantId, decisionId, revokedByUserId, revokedByActorId, revocationReason],
      },
      'policy.repository.revokeDecision'
    );

    if (rows.length === 0) {
      const { NotFoundError } = await import('@core/errors');
      throw new NotFoundError('Decisão não encontrada ou já revogada');
    }

    return this.toPolicyDecision(rows[0] as PolicyDecisionRow);
  }

  /**
   * Busca decisões ativas para um actor
   */
  async getActiveDecisionsForActor(tenantId: string, actorId: string): Promise<PolicyDecision[]> {
    return this.listDecisions(tenantId, {
      actorId,
      status: 'ACTIVE',
      limit: 1000,
    });
  }
}

export const policyRepository = new PolicyRepository();




