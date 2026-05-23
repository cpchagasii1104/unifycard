// backend/src/core/pilot/institutional-memory.repository.ts
// SPRINT 26: Memória Institucional Declarativa
// Repository para declarações de aprendizado institucional

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';

export interface InstitutionalMemoryDeclaration {
  declarationId: string;
  tenantId: string;
  content: string;
  authorUserId: string;
  context: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateInstitutionalMemoryInput {
  content: string;
  authorUserId: string;
  context?: string;
}

class InstitutionalMemoryRepository {
  /**
   * Cria uma nova declaração de aprendizado
   */
  async create(
    tenantId: string,
    input: CreateInstitutionalMemoryInput
  ): Promise<InstitutionalMemoryDeclaration> {
    const result = await runQueryWithTenant<{
      declaration_id: string;
      tenant_id: string;
      content: string;
      author_user_id: string;
      context: string;
      version: number;
      created_at: Date;
      updated_at: Date;
      deleted_at: Date | null;
    }>(
      tenantId,
      `
        INSERT INTO institutional_memory_declarations (
          tenant_id, content, author_user_id, context, version
        )
        VALUES ($1, $2, $3, $4, 1)
        RETURNING *
      `,
      [
        tenantId,
        input.content,
        input.authorUserId,
        input.context || 'pilot',
      ]
    );

    if (!result) throw new Error('create: INSERT did not return row');
    return {
      declarationId: result.declaration_id,
      tenantId: result.tenant_id,
      content: result.content,
      authorUserId: result.author_user_id,
      context: result.context,
      version: result.version,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      deletedAt: result.deleted_at || undefined,
    };
  }

  /**
   * Lista declarações ativas (não deletadas)
   */
  async list(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      context?: string;
    }
  ): Promise<InstitutionalMemoryDeclaration[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    let query = `
      SELECT *
      FROM institutional_memory_declarations
      WHERE tenant_id = $1
        AND deleted_at IS NULL
    `;
    const params: any[] = [tenantId];

    if (options?.context) {
      query += ` AND context = $${params.length + 1}`;
      params.push(options.context);
    }

    query += `
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const rows = await runQueriesWithTenant<{
      declaration_id: string;
      tenant_id: string;
      content: string;
      author_user_id: string;
      context: string;
      version: number;
      created_at: Date;
      updated_at: Date;
      deleted_at: Date | null;
    }>(tenantId, query, params);

    return rows.map((row) => ({
      declarationId: row.declaration_id,
      tenantId: row.tenant_id,
      content: row.content,
      authorUserId: row.author_user_id,
      context: row.context,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || undefined,
    }));
  }

  /**
   * Atualiza versão de uma declaração (cria nova versão)
   */
  async updateVersion(
    tenantId: string,
    declarationId: string,
    newContent: string
  ): Promise<InstitutionalMemoryDeclaration> {
    // Buscar declaração atual
    const current = await this.findById(tenantId, declarationId);
    if (!current) {
      throw new Error('Declaração não encontrada');
    }

    const row = await runQueryWithTenant<{
      declaration_id: string;
      tenant_id: string;
      content: string;
      author_user_id: string;
      context: string;
      version: number;
      created_at: Date;
      updated_at: Date;
      deleted_at: Date | null;
    }>(
      tenantId,
      {
        text: `
        INSERT INTO institutional_memory_declarations (
          tenant_id, content, author_user_id, context, version
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
        values: [
          tenantId,
          newContent,
          current.authorUserId,
          current.context,
          current.version + 1,
        ],
      }
    );

    if (!row) throw new Error('updateVersion: INSERT did not return row');
    return {
      declarationId: row.declaration_id,
      tenantId: row.tenant_id,
      content: row.content,
      authorUserId: row.author_user_id,
      context: row.context,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || undefined,
    };
  }

  /**
   * Soft delete de uma declaração
   */
  async softDelete(
    tenantId: string,
    declarationId: string
  ): Promise<boolean> {
    const row = await runQueryWithTenant<{ declaration_id: string }>(
      tenantId,
      {
        text: `
        UPDATE institutional_memory_declarations
        SET deleted_at = NOW()
        WHERE tenant_id = $1
          AND declaration_id = $2
          AND deleted_at IS NULL
        RETURNING declaration_id
      `,
        values: [tenantId, declarationId],
      }
    );

    return row != null;
  }

  /**
   * Busca declaração por ID
   */
  async findById(
    tenantId: string,
    declarationId: string
  ): Promise<InstitutionalMemoryDeclaration | null> {
    const row = await runQueryWithTenant<{
      declaration_id: string;
      tenant_id: string;
      content: string;
      author_user_id: string;
      context: string;
      version: number;
      created_at: Date;
      updated_at: Date;
      deleted_at: Date | null;
    }>(
      tenantId,
      {
        text: `
        SELECT *
        FROM institutional_memory_declarations
        WHERE tenant_id = $1
          AND declaration_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
        values: [tenantId, declarationId],
      }
    );

    if (!row) return null;
    return {
      declarationId: row.declaration_id,
      tenantId: row.tenant_id,
      content: row.content,
      authorUserId: row.author_user_id,
      context: row.context,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at || undefined,
    };
  }
}

export const institutionalMemoryRepository = new InstitutionalMemoryRepository();








