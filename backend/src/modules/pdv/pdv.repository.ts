// backend/src/modules/pdv/pdv.repository.ts
// SPRINT 42.1: PDV CORE - Repository para sessões PDV

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PdvSession, CreatePdvSessionInput, ClosePdvSessionInput } from './pdv.types';

interface PdvSessionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  status: string;
  opened_at: Date;
  closed_at: Date | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class PdvSessionRepository {
  /**
   * Converte row para PdvSession
   */
  private toSession(row: PdvSessionRow): PdvSession {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      actorId: row.actor_id,
      status: row.status as any,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      metadata: row.metadata || null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria sessão PDV
   */
  async createSession(
    tenantId: string,
    input: CreatePdvSessionInput
  ): Promise<PdvSession> {
    const row = await runQueryWithTenant<PdvSessionRow>(
      tenantId,
      `
      INSERT INTO pdv_sessions (
        tenant_id, actor_id, status, metadata
      )
      VALUES ($1, $2, 'open', $3)
      RETURNING id, tenant_id, actor_id, status, opened_at, closed_at,
                metadata, created_at, updated_at
      `,
      [tenantId, input.actorId, JSON.stringify(input.metadata || {})]
    );

    if (!row) {
      throw new Error('Erro ao criar sessão PDV');
    }

    return this.toSession(row);
  }

  /**
   * Busca sessão por ID
   */
  async getSessionById(
    tenantId: string,
    sessionId: string
  ): Promise<PdvSession | null> {
    const row = await runQueryWithTenant<PdvSessionRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, status, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM pdv_sessions
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, sessionId]
    );

    return row ? this.toSession(row) : null;
  }

  /**
   * Busca sessão aberta por actor
   */
  async getOpenSessionByActor(
    tenantId: string,
    actorId: string
  ): Promise<PdvSession | null> {
    const row = await runQueryWithTenant<PdvSessionRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, status, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM pdv_sessions
      WHERE tenant_id = $1 
        AND actor_id = $2
        AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
      `,
      [tenantId, actorId]
    );

    return row ? this.toSession(row) : null;
  }

  /**
   * Lista sessões por actor
   */
  async listSessionsByActor(
    tenantId: string,
    actorId: string,
    limit: number = 50
  ): Promise<PdvSession[]> {
    const rows = await runQueriesWithTenant<PdvSessionRow>(
      tenantId,
      `
      SELECT id, tenant_id, actor_id, status, opened_at, closed_at,
             metadata, created_at, updated_at
      FROM pdv_sessions
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY opened_at DESC
      LIMIT $3
      `,
      [tenantId, actorId, limit]
    );

    return rows.map((row) => this.toSession(row));
  }

  /**
   * Fecha sessão
   */
  async closeSession(
    tenantId: string,
    sessionId: string,
    input: ClosePdvSessionInput = {}
  ): Promise<PdvSession> {
    const row = await runQueryWithTenant<PdvSessionRow>(
      tenantId,
      `
      UPDATE pdv_sessions
      SET status = 'closed',
          closed_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
      WHERE tenant_id = $2 AND id = $3 AND status = 'open'
      RETURNING id, tenant_id, actor_id, status, opened_at, closed_at,
                metadata, created_at, updated_at
      `,
      [JSON.stringify(input.metadata || {}), tenantId, sessionId]
    );

    if (!row) {
      throw new Error('Sessão PDV não encontrada ou já está fechada');
    }

    return this.toSession(row);
  }
}

export const pdvSessionRepository = new PdvSessionRepository();









