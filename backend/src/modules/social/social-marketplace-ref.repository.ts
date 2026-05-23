// backend/src/modules/social/social-marketplace-ref.repository.ts
// SPRINT 47: Repository para referências do marketplace no social

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  SocialMarketplaceRef,
  CreateSocialMarketplaceRefInput,
} from './social-marketplace-ref.types';

interface SocialMarketplaceRefRow {
  id: string;
  tenant_id: string;
  post_id: string;
  ref_type: string;
  ref_id: string;
  metadata: any;
  created_at: string | Date;
}

class SocialMarketplaceRefRepository {
  /**
   * Converte row para SocialMarketplaceRef
   */
  private toRef(row: SocialMarketplaceRefRow): SocialMarketplaceRef {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      postId: row.post_id,
      refType: row.ref_type as any,
      refId: row.ref_id,
      metadata: row.metadata || null,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    };
  }

  /**
   * Cria referência do marketplace no social
   */
  async createRef(
    tenantId: string,
    input: CreateSocialMarketplaceRefInput
  ): Promise<SocialMarketplaceRef> {
    const row = await runQueryWithTenant<SocialMarketplaceRefRow>(
      tenantId,
      `
      INSERT INTO social_marketplace_refs (
        tenant_id, post_id, ref_type, ref_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (tenant_id, post_id, ref_type) 
      DO UPDATE SET ref_id = EXCLUDED.ref_id, metadata = EXCLUDED.metadata
      RETURNING id, tenant_id, post_id, ref_type, ref_id, metadata, created_at
      `,
      [
        tenantId,
        input.postId,
        input.refType,
        input.refId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar referência do marketplace no social');
    }

    return this.toRef(row);
  }

  /**
   * Busca referência por ID
   */
  async getRefById(
    tenantId: string,
    refId: string
  ): Promise<SocialMarketplaceRef | null> {
    const row = await runQueryWithTenant<SocialMarketplaceRefRow>(
      tenantId,
      `
      SELECT id, tenant_id, post_id, ref_type, ref_id, metadata, created_at
      FROM social_marketplace_refs
      WHERE tenant_id = $1 AND id = $2
      LIMIT 1
      `,
      [tenantId, refId]
    );

    return row ? this.toRef(row) : null;
  }

  /**
   * Busca referências por post
   */
  async getRefsByPost(
    tenantId: string,
    postId: string
  ): Promise<SocialMarketplaceRef[]> {
    const rows = await runQueriesWithTenant<SocialMarketplaceRefRow>(
      tenantId,
      `
      SELECT id, tenant_id, post_id, ref_type, ref_id, metadata, created_at
      FROM social_marketplace_refs
      WHERE tenant_id = $1 AND post_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, postId]
    );

    return rows.map((row) => this.toRef(row));
  }

  /**
   * Busca referências por tipo e ID
   */
  async getRefsByRef(
    tenantId: string,
    refType: string,
    refId: string
  ): Promise<SocialMarketplaceRef[]> {
    const rows = await runQueriesWithTenant<SocialMarketplaceRefRow>(
      tenantId,
      `
      SELECT id, tenant_id, post_id, ref_type, ref_id, metadata, created_at
      FROM social_marketplace_refs
      WHERE tenant_id = $1 AND ref_type = $2 AND ref_id = $3
      ORDER BY created_at DESC
      `,
      [tenantId, refType, refId]
    );

    return rows.map((row) => this.toRef(row));
  }

  /**
   * Remove referência
   */
  async removeRef(
    tenantId: string,
    refId: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM social_marketplace_refs
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, refId]
    );
  }
}

export const socialMarketplaceRefRepository = new SocialMarketplaceRefRepository();









