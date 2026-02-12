// backend/src/modules/agreements/agreement.repository.ts
// Repository para Agreement Drafts
// 🔴 BLINDAGEM: Nenhum booking/bundle/service-order sem acordo FINALIZED

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Agreement,
  CreateAgreementInput,
  UpdateAgreementInput,
  AgreementFilters,
} from './agreement.types';

interface AgreementRow {
  agreement_id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  thread_id: string | null;
  requester_actor_id: string;
  provider_actor_id: string;
  price_cents: number;
  currency: string;
  scope: string;
  included_items: any;
  excluded_items: any;
  responsibilities: string | null;
  capacity_assumptions: string | null;
  status: string;
  created_by_actor_id: string;
  created_by_user_id: string | null;
  finalizedAt: Date | null;
  finalized_by_actor_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class AgreementRepository {
  private toAgreement(row: AgreementRow): Agreement {
    return {
      agreementId: row.agreement_id,
      tenantId: row.tenant_id,
      contextType: row.context_type as any,
      contextId: row.context_id,
      threadId: row.thread_id,
      requesterActorId: row.requester_actor_id,
      providerActorId: row.provider_actor_id,
      priceCents: row.price_cents,
      currency: row.currency,
      scope: row.scope,
      includedItems: Array.isArray(row.included_items) ? row.included_items : [],
      excludedItems: Array.isArray(row.excluded_items) ? row.excluded_items : [],
      responsibilities: row.responsibilities || '',
      capacityAssumptions: row.capacity_assumptions,
      status: row.status as any,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      finalizedAt: row.finalizedAt,
      finalizedByActorId: row.finalized_by_actor_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria um novo Agreement Draft
   */
  async create(tenantId: string, input: CreateAgreementInput, userId: string | null): Promise<Agreement> {
    const { randomUUID } = await import('crypto');
    const agreementId = randomUUID();

    const rows = await runQueriesWithTenant(
      tenantId,
      [
        {
          text: `
            INSERT INTO agreements (
              agreement_id, tenant_id, context_type, context_id, thread_id,
              requester_actor_id, provider_actor_id, price_cents, currency,
              scope, included_items, excluded_items, responsibilities,
              capacity_assumptions, status, created_by_actor_id, created_by_user_id,
              metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            ) RETURNING *
          `,
          values: [
            agreementId,
            tenantId,
            input.contextType,
            input.contextId,
            input.threadId || null,
            input.requesterActorId,
            input.providerActorId,
            input.priceCents,
            input.currency,
            input.scope,
            JSON.stringify(input.includedItems || []),
            JSON.stringify(input.excludedItems || []),
            input.responsibilities || null,
            input.capacityAssumptions || null,
            'draft',
            input.requesterActorId, // Por padrão, criado pelo requester
            userId,
            JSON.stringify(input.metadata || {}),
          ],
        },
      ],
      'agreement.repository.create'
    );

    return this.toAgreement(rows[0] as AgreementRow);
  }

  /**
   * Busca agreement por ID
   */
  async findById(tenantId: string, agreementId: string): Promise<Agreement | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: 'SELECT * FROM agreements WHERE tenant_id = $1 AND agreement_id = $2',
        values: [tenantId, agreementId],
      },
      'agreement.repository.findById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toAgreement(rows[0] as AgreementRow);
  }

  /**
   * Busca agreement por contexto
   */
  async findByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<Agreement[]> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM agreements
          WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
          ORDER BY createdAt DESC
        `,
        values: [tenantId, contextType, contextId],
      },
      'agreement.repository.findByContext'
    );

    return rows.map((row) => this.toAgreement(row as AgreementRow));
  }

  /**
   * Busca agreement finalizado por contexto
   * 🔴 BLINDAGEM: Usado para validar se pode criar booking/bundle/service-order
   */
  async findFinalizedByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<Agreement | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM agreements
          WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3 AND status = 'finalized'
          ORDER BY finalizedAt DESC
          LIMIT 1
        `,
        values: [tenantId, contextType, contextId],
      },
      'agreement.repository.findFinalizedByContext'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toAgreement(rows[0] as AgreementRow);
  }

  /**
   * Lista agreements com filtros
   */
  async list(tenantId: string, filters: AgreementFilters = {}): Promise<Agreement[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.contextType) {
      conditions.push(`context_type = $${paramIndex}`);
      values.push(filters.contextType);
      paramIndex++;
    }

    if (filters.contextId) {
      conditions.push(`context_id = $${paramIndex}`);
      values.push(filters.contextId);
      paramIndex++;
    }

    if (filters.threadId) {
      conditions.push(`thread_id = $${paramIndex}`);
      values.push(filters.threadId);
      paramIndex++;
    }

    if (filters.requesterActorId) {
      conditions.push(`requester_actor_id = $${paramIndex}`);
      values.push(filters.requesterActorId);
      paramIndex++;
    }

    if (filters.providerActorId) {
      conditions.push(`provider_actor_id = $${paramIndex}`);
      values.push(filters.providerActorId);
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
          SELECT * FROM agreements
          WHERE ${conditions.join(' AND ')}
          ORDER BY createdAt DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'agreement.repository.list'
    );

    return rows.map((row) => this.toAgreement(row as AgreementRow));
  }

  /**
   * Atualiza Agreement Draft
   */
  async update(
    tenantId: string,
    agreementId: string,
    input: UpdateAgreementInput
  ): Promise<Agreement> {
    const updates: string[] = [];
    const values: any[] = [tenantId, agreementId];
    let paramIndex = 3;

    if (input.priceCents !== undefined) {
      updates.push(`price_cents = $${paramIndex}`);
      values.push(input.priceCents);
      paramIndex++;
    }

    if (input.currency !== undefined) {
      updates.push(`currency = $${paramIndex}`);
      values.push(input.currency);
      paramIndex++;
    }

    if (input.scope !== undefined) {
      updates.push(`scope = $${paramIndex}`);
      values.push(input.scope);
      paramIndex++;
    }

    if (input.includedItems !== undefined) {
      updates.push(`included_items = $${paramIndex}`);
      values.push(JSON.stringify(input.includedItems));
      paramIndex++;
    }

    if (input.excludedItems !== undefined) {
      updates.push(`excluded_items = $${paramIndex}`);
      values.push(JSON.stringify(input.excludedItems));
      paramIndex++;
    }

    if (input.responsibilities !== undefined) {
      updates.push(`responsibilities = $${paramIndex}`);
      values.push(input.responsibilities);
      paramIndex++;
    }

    if (input.capacityAssumptions !== undefined) {
      updates.push(`capacity_assumptions = $${paramIndex}`);
      values.push(input.capacityAssumptions);
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar o agreement atual
      const agreement = await this.findById(tenantId, agreementId);
      if (!agreement) {
        throw new Error('Agreement não encontrado');
      }
      return agreement;
    }

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE agreements
          SET ${updates.join(', ')}
          WHERE tenant_id = $1 AND agreement_id = $2
          RETURNING *
        `,
        values,
      },
      'agreement.repository.update'
    );

    if (rows.length === 0) {
      throw new Error('Agreement não encontrado');
    }

    return this.toAgreement(rows[0] as AgreementRow);
  }

  /**
   * Atualiza status do agreement
   */
  async updateStatus(
    tenantId: string,
    agreementId: string,
    status: string,
    finalizedByActorId?: string | null
  ): Promise<Agreement> {
    const updates: string[] = [`status = $3`];
    const values: any[] = [tenantId, agreementId, status];
    let paramIndex = 4;

    if (status === 'finalized') {
      updates.push(`finalizedAt = NOW()`);
      if (finalizedByActorId) {
        updates.push(`finalized_by_actor_id = $${paramIndex}`);
        values.push(finalizedByActorId);
        paramIndex++;
      }
    }

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE agreements
          SET ${updates.join(', ')}
          WHERE tenant_id = $1 AND agreement_id = $2
          RETURNING *
        `,
        values,
      },
      'agreement.repository.updateStatus'
    );

    if (rows.length === 0) {
      throw new Error('Agreement não encontrado');
    }

    return this.toAgreement(rows[0] as AgreementRow);
  }
}

export const agreementRepository = new AgreementRepository();



