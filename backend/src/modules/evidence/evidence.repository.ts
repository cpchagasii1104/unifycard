// backend/src/modules/evidence/evidence.repository.ts
// Repository para Evidence Packs
// 🔴 BLINDAGEM: Append-only, imutável, sem decisões automáticas

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  EvidencePack,
  CreateEvidencePackInput,
  EvidenceEvent,
  EvidencePackFilters,
} from './evidence.types';

interface EvidencePackRow {
  pack_id: string;
  tenant_id: string;
  context_type: string;
  context_id: string;
  dispute_status: string;
  openedAt: Date | null;
  resolvedAt: Date | null;
  retention_until: Date | null;
  timeline: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class EvidenceRepository {
  private toEvidencePack(row: EvidencePackRow): EvidencePack {
    return {
      packId: row.pack_id,
      tenantId: row.tenant_id,
      contextType: row.context_type as any,
      contextId: row.context_id,
      disputeStatus: row.dispute_status as any,
      openedAt: row.openedAt,
      resolvedAt: row.resolvedAt,
      retentionUntil: row.retention_until,
      timeline: Array.isArray(row.timeline) ? row.timeline.map((e: any) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      })) : [],
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Cria ou obtém evidence pack para um contexto
   */
  async getOrCreatePack(
    tenantId: string,
    input: CreateEvidencePackInput
  ): Promise<EvidencePack> {
    // Tentar buscar pack existente
    const existing = await this.findByContext(tenantId, input.contextType, input.contextId);
    if (existing) {
      return existing;
    }

    // Criar novo pack
    const { randomUUID } = await import('crypto');
    const packId = randomUUID();
    const retentionDays = input.retentionDays || 365;
    const retentionUntil = new Date();
    retentionUntil.setDate(retentionUntil.getDate() + retentionDays);

    const rows = await runQueriesWithTenant(
      tenantId,
      [
        {
          text: `
            INSERT INTO evidence_packs (
              pack_id, tenant_id, context_type, context_id,
              dispute_status, retention_until, timeline, metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8
            ) RETURNING *
          `,
          values: [
            packId,
            tenantId,
            input.contextType,
            input.contextId,
            'NONE',
            retentionUntil,
            JSON.stringify([]),
            JSON.stringify({}),
          ],
        },
      ],
      'evidence.repository.getOrCreatePack'
    );

    return this.toEvidencePack(rows[0] as EvidencePackRow);
  }

  /**
   * Busca evidence pack por contexto
   */
  async findByContext(
    tenantId: string,
    contextType: string,
    contextId: string
  ): Promise<EvidencePack | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM evidence_packs
          WHERE tenant_id = $1 AND context_type = $2 AND context_id = $3
        `,
        values: [tenantId, contextType, contextId],
      },
      'evidence.repository.findByContext'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEvidencePack(rows[0] as EvidencePackRow);
  }

  /**
   * Busca evidence pack por ID
   */
  async findById(tenantId: string, packId: string): Promise<EvidencePack | null> {
    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: 'SELECT * FROM evidence_packs WHERE tenant_id = $1 AND pack_id = $2',
        values: [tenantId, packId],
      },
      'evidence.repository.findById'
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toEvidencePack(rows[0] as EvidencePackRow);
  }

  /**
   * Adiciona evento à timeline (append-only)
   * 🔴 BLINDAGEM: Não remove eventos, apenas adiciona
   */
  async addEvent(
    tenantId: string,
    packId: string,
    event: EvidenceEvent
  ): Promise<EvidencePack> {
    const pack = await this.findById(tenantId, packId);
    if (!pack) {
      throw new Error('Evidence pack não encontrado');
    }

    // Adicionar evento à timeline (append-only)
    const updatedTimeline = [...pack.timeline, event];
    // Ordenar por timestamp
    updatedTimeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE evidence_packs
          SET timeline = $3, updatedAt = NOW()
          WHERE tenant_id = $1 AND pack_id = $2
          RETURNING *
        `,
        values: [tenantId, packId, JSON.stringify(updatedTimeline)],
      },
      'evidence.repository.addEvent'
    );

    return this.toEvidencePack(rows[0] as EvidencePackRow);
  }

  /**
   * Atualiza status de disputa
   */
  async updateDisputeStatus(
    tenantId: string,
    packId: string,
    status: string,
    openedAt?: Date | null,
    resolvedAt?: Date | null
  ): Promise<EvidencePack> {
    const updates: string[] = [`dispute_status = $3`];
    const values: any[] = [tenantId, packId, status];
    let paramIndex = 4;

    if (openedAt !== undefined) {
      updates.push(`openedAt = $${paramIndex}`);
      values.push(openedAt);
      paramIndex++;
    }

    if (resolvedAt !== undefined) {
      updates.push(`resolvedAt = $${paramIndex}`);
      values.push(resolvedAt);
      paramIndex++;
    }

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          UPDATE evidence_packs
          SET ${updates.join(', ')}, updatedAt = NOW()
          WHERE tenant_id = $1 AND pack_id = $2
          RETURNING *
        `,
        values,
      },
      'evidence.repository.updateDisputeStatus'
    );

    return this.toEvidencePack(rows[0] as EvidencePackRow);
  }

  /**
   * Lista evidence packs com filtros
   */
  async list(tenantId: string, filters: EvidencePackFilters = {}): Promise<EvidencePack[]> {
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

    if (filters.disputeStatus) {
      conditions.push(`dispute_status = $${paramIndex}`);
      values.push(filters.disputeStatus);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueryWithTenant(
      tenantId,
      {
        text: `
          SELECT * FROM evidence_packs
          WHERE ${conditions.join(' AND ')}
          ORDER BY createdAt DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
        values: [...values, limit, offset],
      },
      'evidence.repository.list'
    );

    return rows.map((row) => this.toEvidencePack(row as EvidencePackRow));
  }
}

export const evidenceRepository = new EvidenceRepository();



