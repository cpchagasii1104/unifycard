// src/modules/dispatch/opportunity-dispatch.repository.ts
// Repository do Domínio de DISPATCH DE OPORTUNIDADES
// 🔴 BLINDAGEM: Dispatch é NOTIFICAÇÃO, não decisão
// 🔴 BLINDAGEM: Nenhuma lógica de matching ou priorização aqui

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  OpportunityDispatch,
  OpportunityDispatchRow,
  CreateOpportunityDispatchInput,
  RespondToDispatchInput,
  OpportunityDispatchFilters,
  DispatchResponse,
} from './opportunity-dispatch.types';
import { BadRequestError, NotFoundError } from '@core/errors';

class OpportunityDispatchRepository {
  /**
   * Converte OpportunityDispatchRow para OpportunityDispatch
   */
  private toOpportunityDispatch(row: OpportunityDispatchRow): OpportunityDispatch {
    return {
      dispatchId: row.dispatch_id,
      tenantId: row.tenant_id,
      opportunityId: row.opportunity_id,
      opportunityType: row.opportunity_type,
      targetActorId: row.target_actor_id,
      response: row.response || undefined,
      dispatchedAt: row.dispatched_at,
      respondedAt: row.responded_at || undefined,
      expiresAt: row.expires_at || undefined,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cria um novo dispatch de oportunidade
   * 🔴 BLINDAGEM: opportunityId, opportunityType e targetActorId são OBRIGATÓRIOS
   */
  async create(
    tenantId: string,
    input: CreateOpportunityDispatchInput
  ): Promise<OpportunityDispatch> {
    const {
      opportunityId,
      opportunityType,
      targetActorId,
      expiresAt,
      metadata = {},
    } = input;

    if (!opportunityId) {
      throw new BadRequestError('opportunityId é obrigatório para criar dispatch');
    }
    if (!opportunityType) {
      throw new BadRequestError('opportunityType é obrigatório para criar dispatch');
    }
    if (!targetActorId) {
      throw new BadRequestError('targetActorId é obrigatório para criar dispatch');
    }

    const row = await runQueryWithTenant<OpportunityDispatchRow>(
      tenantId,
      `
      INSERT INTO opportunity_dispatches (
        tenant_id, opportunity_id, opportunity_type, target_actor_id,
        expires_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        tenantId,
        opportunityId,
        opportunityType,
        targetActorId,
        expiresAt || null,
        JSON.stringify(metadata),
      ]
    );

    if (!row) {
      throw new BadRequestError('Failed to create opportunity dispatch');
    }

    return this.toOpportunityDispatch(row);
  }

  /**
   * Busca dispatch por ID
   */
  async findById(tenantId: string, dispatchId: string): Promise<OpportunityDispatch | null> {
    const row = await runQueryWithTenant<OpportunityDispatchRow>(
      tenantId,
      `SELECT * FROM opportunity_dispatches WHERE dispatch_id = $1 AND tenant_id = $2`,
      [dispatchId, tenantId]
    );
    return row ? this.toOpportunityDispatch(row) : null;
  }

  /**
   * Lista dispatches com filtros
   * 🔴 BLINDAGEM: Nenhuma ordenação por score ou prioridade
   */
  async find(tenantId: string, filters: OpportunityDispatchFilters): Promise<OpportunityDispatch[]> {
    let query = `SELECT * FROM opportunity_dispatches WHERE tenant_id = $1`;
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.opportunityId) {
      query += ` AND opportunity_id = $${paramIndex}`;
      params.push(filters.opportunityId);
      paramIndex++;
    }
    if (filters.opportunityType) {
      query += ` AND opportunity_type = $${paramIndex}`;
      params.push(filters.opportunityType);
      paramIndex++;
    }
    if (filters.targetActorId) {
      query += ` AND target_actor_id = $${paramIndex}`;
      params.push(filters.targetActorId);
      paramIndex++;
    }
    if (filters.response !== undefined) {
      if (filters.response === null) {
        query += ` AND response IS NULL`;
      } else {
        query += ` AND response = $${paramIndex}`;
        params.push(filters.response);
        paramIndex++;
      }
    }

    // 🔴 BLINDAGEM: Ordenação apenas por dispatched_at (mais recente primeiro)
    // NUNCA por score, NUNCA por prioridade, NUNCA por educação
    query += ` ORDER BY dispatched_at DESC`;

    const rows = await runQueriesWithTenant<OpportunityDispatchRow>(tenantId, query, params);
    return rows.map(this.toOpportunityDispatch);
  }

  /**
   * Atualiza resposta de um dispatch
   * 🔴 BLINDAGEM: Resposta não garante nada, não penaliza, não gera score
   */
  async updateResponse(
    tenantId: string,
    dispatchId: string,
    input: RespondToDispatchInput
  ): Promise<OpportunityDispatch> {
    const { response, metadata = {} } = input;

    if (!response) {
      throw new BadRequestError('response é obrigatório para responder dispatch');
    }

    const row = await runQueryWithTenant<OpportunityDispatchRow>(
      tenantId,
      `
      UPDATE opportunity_dispatches
      SET 
        response = $1,
        responded_at = now(),
        metadata = $2,
        updated_at = now()
      WHERE dispatch_id = $3 AND tenant_id = $4
      RETURNING *
      `,
      [response, JSON.stringify(metadata), dispatchId, tenantId]
    );

    if (!row) {
      throw new NotFoundError('Dispatch não encontrado ou não foi possível atualizar');
    }

    return this.toOpportunityDispatch(row);
  }
}

export const opportunityDispatchRepository = new OpportunityDispatchRepository();

