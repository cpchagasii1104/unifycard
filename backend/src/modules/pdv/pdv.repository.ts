// backend/src/modules/pdv/pdv.repository.ts
// SPRINT 42.1: PDV CORE - Repository para sessões PDV

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { PdvSession, CreatePdvSessionInput, ClosePdvSessionInput } from './pdv.types';

interface PdvSessionRow {
  id: string;
  tenant_id: string;
  actor_id: string;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
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
      openedAt: row.openedAt,
      closedAt: row.closedAt,
      metadata: row.metadata || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
      VALUES ($1, $2, 'OPEN', $3)
      RETURNING id, tenant_id, actor_id, status, openedAt, closedAt,
                metadata, createdAt, updatedAt
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
      SELECT id, tenant_id, actor_id, status, openedAt, closedAt,
             metadata, createdAt, updatedAt
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
      SELECT id, tenant_id, actor_id, status, openedAt, closedAt,
             metadata, createdAt, updatedAt
      FROM pdv_sessions
      WHERE tenant_id = $1 
        AND actor_id = $2
        AND status = 'OPEN'
      ORDER BY openedAt DESC
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
      SELECT id, tenant_id, actor_id, status, openedAt, closedAt,
             metadata, createdAt, updatedAt
      FROM pdv_sessions
      WHERE tenant_id = $1 AND actor_id = $2
      ORDER BY openedAt DESC
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
      SET status = 'CLOSED',
          closedAt = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
      WHERE tenant_id = $2 AND id = $3 AND status = 'OPEN'
      RETURNING id, tenant_id, actor_id, status, openedAt, closedAt,
                metadata, createdAt, updatedAt
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









