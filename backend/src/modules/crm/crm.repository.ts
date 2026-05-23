// backend/src/modules/crm/crm.repository.ts
// SPRINT 88: CRM CANÔNICO

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  CrmNote,
  CrmTag,
  CrmContactTag,
  CrmConsent,
  CreateCrmNoteInput,
  CreateCrmTagInput,
  SetCrmConsentInput,
} from './crm.types';

interface CrmNoteRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  author_actor_id: string;
  author_user_id: string | null;
  note: string;
  visibility: string;
  metadata: any;
  created_at: Date;
}

interface CrmTagRow {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null;
  created_at: Date;
}

interface CrmContactTagRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  tag_id: string;
  created_at: Date;
}

interface CrmConsentRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  channel: string;
  status: string;
  updated_by_actor_id: string;
  updated_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class CrmRepository {
  private toCrmNote(row: CrmNoteRow): CrmNote {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      authorActorId: row.author_actor_id,
      authorUserId: row.author_user_id,
      note: row.note,
      visibility: row.visibility as any,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
    };
  }

  private toCrmTag(row: CrmTagRow): CrmTag {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toCrmContactTag(row: CrmContactTagRow): CrmContactTag {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      tagId: row.tag_id,
      createdAt: row.created_at.toISOString(),
    };
  }

  private toCrmConsent(row: CrmConsentRow): CrmConsent {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      channel: row.channel as any,
      status: row.status as any,
      updatedByActorId: row.updated_by_actor_id,
      updatedByUserId: row.updated_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  // ============================================================
  // NOTES
  // ============================================================

  async createNote(
    tenantId: string,
    authorActorId: string,
    authorUserId: string | null,
    input: CreateCrmNoteInput
  ): Promise<CrmNote> {
    const row = await runQueryWithTenant<CrmNoteRow>(
      tenantId,
      `
      INSERT INTO crm_notes (
        tenant_id, contact_id, author_actor_id, author_user_id,
        note, visibility, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, tenant_id, contact_id, author_actor_id, author_user_id,
                note, visibility, metadata, created_at
      `,
      [
        tenantId,
        input.contactId,
        authorActorId,
        authorUserId,
        input.note.trim(),
        input.visibility || 'INTERNAL',
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Unexpected empty result from runQueryWithTenant');
    }
    return this.toCrmNote(row);
  }

  async listNotes(
    tenantId: string,
    contactId: string
  ): Promise<CrmNote[]> {
    const rows = await runQueriesWithTenant<CrmNoteRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, author_actor_id, author_user_id,
             note, visibility, metadata, created_at
      FROM crm_notes
      WHERE tenant_id = $1 AND contact_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, contactId]
    );

    return rows
      .filter((r): r is CrmNoteRow => r != null)
      .map((row) => this.toCrmNote(row));
  }

  // ============================================================
  // TAGS
  // ============================================================

  async createTag(
    tenantId: string,
    input: CreateCrmTagInput
  ): Promise<CrmTag> {
    const row = await runQueryWithTenant<CrmTagRow>(
      tenantId,
      `
      INSERT INTO crm_tags (tenant_id, name, color)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, name) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING id, tenant_id, name, color, created_at
      `,
      [tenantId, input.name.trim(), input.color || null]
    );

    if (!row) {
      throw new Error('Unexpected empty result from runQueryWithTenant');
    }
    return this.toCrmTag(row);
  }

  async listTags(tenantId: string): Promise<CrmTag[]> {
    const rows = await runQueriesWithTenant<CrmTagRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, color, created_at
      FROM crm_tags
      WHERE tenant_id = $1
      ORDER BY name ASC
      `,
      [tenantId]
    );

    return rows
      .filter((r): r is CrmTagRow => r != null)
      .map((row) => this.toCrmTag(row));
  }

  async getTagById(tenantId: string, tagId: string): Promise<CrmTag | null> {
    const row = await runQueryWithTenant<CrmTagRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, color, created_at
      FROM crm_tags
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, tagId]
    );

    if (!row) {
      return null;
    }

    return this.toCrmTag(row);
  }

  // ============================================================
  // CONTACT TAGS
  // ============================================================

  async assignTag(
    tenantId: string,
    contactId: string,
    tagId: string
  ): Promise<CrmContactTag> {
    const row = await runQueryWithTenant<CrmContactTagRow>(
      tenantId,
      `
      INSERT INTO crm_contact_tags (tenant_id, contact_id, tag_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, contact_id, tag_id) DO NOTHING
      RETURNING id, tenant_id, contact_id, tag_id, created_at
      `,
      [tenantId, contactId, tagId]
    );

    if (!row) {
      // Já existe, buscar existente
      const existing = await this.getContactTag(tenantId, contactId, tagId);
      if (existing) {
        return existing;
      }
      throw new Error('Erro ao atribuir tag');
    }

    return this.toCrmContactTag(row);
  }

  async removeTag(
    tenantId: string,
    contactId: string,
    tagId: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM crm_contact_tags
      WHERE tenant_id = $1 AND contact_id = $2 AND tag_id = $3
      `,
      [tenantId, contactId, tagId]
    );
  }

  async getContactTag(
    tenantId: string,
    contactId: string,
    tagId: string
  ): Promise<CrmContactTag | null> {
    const row = await runQueryWithTenant<CrmContactTagRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, tag_id, created_at
      FROM crm_contact_tags
      WHERE tenant_id = $1 AND contact_id = $2 AND tag_id = $3
      `,
      [tenantId, contactId, tagId]
    );

    if (!row) {
      return null;
    }

    return this.toCrmContactTag(row);
  }

  async listContactTags(tenantId: string, contactId: string): Promise<CrmContactTag[]> {
    const rows = await runQueriesWithTenant<CrmContactTagRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, tag_id, created_at
      FROM crm_contact_tags
      WHERE tenant_id = $1 AND contact_id = $2
      ORDER BY created_at DESC
      `,
      [tenantId, contactId]
    );

    return rows.map((row) => this.toCrmContactTag(row));
  }

  // ============================================================
  // CONSENTS
  // ============================================================

  async setConsent(
    tenantId: string,
    updatedByActorId: string,
    updatedByUserId: string | null,
    input: SetCrmConsentInput
  ): Promise<CrmConsent> {
    const row = await runQueryWithTenant<CrmConsentRow>(
      tenantId,
      `
      INSERT INTO crm_consents (
        tenant_id, contact_id, channel, status,
        updated_by_actor_id, updated_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (tenant_id, contact_id, channel) DO UPDATE
      SET status = EXCLUDED.status,
          updated_by_actor_id = EXCLUDED.updated_by_actor_id,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      RETURNING id, tenant_id, contact_id, channel, status,
                updated_by_actor_id, updated_by_user_id, metadata,
                created_at, updated_at
      `,
      [
        tenantId,
        input.contactId,
        input.channel,
        input.status,
        updatedByActorId,
        updatedByUserId,
        JSON.stringify(input.metadata || {}),
      ]
    );

    if (!row) {
      throw new Error('Unexpected empty result from runQueryWithTenant');
    }
    return this.toCrmConsent(row);
  }

  async getConsents(tenantId: string, contactId: string): Promise<CrmConsent[]> {
    const rows = await runQueriesWithTenant<CrmConsentRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, channel, status,
             updated_by_actor_id, updated_by_user_id, metadata,
             created_at, updated_at
      FROM crm_consents
      WHERE tenant_id = $1 AND contact_id = $2
      ORDER BY channel ASC
      `,
      [tenantId, contactId]
    );

    return rows
      .filter((r): r is CrmConsentRow => r != null)
      .map((row) => this.toCrmConsent(row));
  }

  async getConsent(
    tenantId: string,
    contactId: string,
    channel: string
  ): Promise<CrmConsent | null> {
    const row = await runQueryWithTenant<CrmConsentRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, channel, status,
             updated_by_actor_id, updated_by_user_id, metadata,
             created_at, updated_at
      FROM crm_consents
      WHERE tenant_id = $1 AND contact_id = $2 AND channel = $3
      `,
      [tenantId, contactId, channel]
    );

    if (!row) {
      return null;
    }

    return this.toCrmConsent(row);
  }
}

export const crmRepository = new CrmRepository();







