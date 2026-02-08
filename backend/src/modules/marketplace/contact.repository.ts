// backend/src/modules/marketplace/contact.repository.ts
// SPRINT 0: CONTACTS / CLIENTES UNIFICADOS

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  ContactAddress,
} from './contact.types';

interface ContactRow {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: ContactAddress;
  user_id: string | null;
  kyc_status: string; // SPRINT 84
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

class ContactRepository {
  private toContact(row: ContactRow): Contact {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      type: row.type as any,
      name: row.name,
      taxId: row.tax_id,
      email: row.email,
      phone: row.phone,
      address: (row.address || {}) as ContactAddress,
      userId: row.user_id,
      kycStatus: (row.kyc_status || 'UNVERIFIED') as any, // SPRINT 84
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createContact(
    tenantId: string,
    input: CreateContactInput
  ): Promise<Contact> {
    const row = await runQueryWithTenant<ContactRow>(
      tenantId,
      `
      INSERT INTO contacts (
        tenant_id, type, name, tax_id, email, phone, address, user_id, kyc_status, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'UNVERIFIED', $9::jsonb)
      RETURNING id, tenant_id, type, name, tax_id, email, phone, address,
                user_id, kyc_status, metadata, createdAt, updatedAt
      `,
      [
        tenantId,
        input.type,
        input.name.trim(),
        input.taxId || null,
        input.email || null,
        input.phone || null,
        JSON.stringify(input.address || {}),
        input.userId || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    return this.toContact(row);
  }

  async getContactById(tenantId: string, contactId: string): Promise<Contact | null> {
    const rows = await runQueriesWithTenant<ContactRow>(
      tenantId,
      `
      SELECT id, tenant_id, type, name, tax_id, email, phone, address,
             user_id, kyc_status, metadata, createdAt, updatedAt
      FROM contacts
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, contactId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toContact(rows[0]);
  }

  async getContactByTaxId(tenantId: string, taxId: string): Promise<Contact | null> {
    const rows = await runQueriesWithTenant<ContactRow>(
      tenantId,
      `
      SELECT id, tenant_id, type, name, tax_id, email, phone, address,
             user_id, kyc_status, metadata, createdAt, updatedAt
      FROM contacts
      WHERE tenant_id = $1 AND tax_id = $2
      `,
      [tenantId, taxId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.toContact(rows[0]);
  }

  async updateContact(
    tenantId: string,
    contactId: string,
    input: UpdateContactInput
  ): Promise<Contact> {
    const updates: string[] = [];
    const params: any[] = [tenantId, contactId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name.trim());
      paramIndex++;
    }

    if (input.email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(input.email || null);
      paramIndex++;
    }

    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(input.phone || null);
      paramIndex++;
    }

    if (input.address !== undefined) {
      updates.push(`address = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(input.address));
      paramIndex++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}::jsonb`);
      params.push(JSON.stringify(input.metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      // Nenhuma atualização, retornar contato atual
      const contact = await this.getContactById(tenantId, contactId);
      if (!contact) {
        throw new Error(`Contact não encontrado: ${contactId}`);
      }
      return contact;
    }

    const row = await runQueryWithTenant<ContactRow>(
      tenantId,
      `
      UPDATE contacts
      SET ${updates.join(', ')}, updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, type, name, tax_id, email, phone, address,
                user_id, metadata, createdAt, updatedAt
      `,
      params
    );

    return this.toContact(row);
  }

  async linkUserToContact(
    tenantId: string,
    contactId: string,
    userId: string
  ): Promise<Contact> {
    const row = await runQueryWithTenant<ContactRow>(
      tenantId,
      `
      UPDATE contacts
      SET user_id = $3, updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, type, name, tax_id, email, phone, address,
                user_id, kyc_status, metadata, createdAt, updatedAt
      `,
      [tenantId, contactId, userId]
    );

    return this.toContact(row);
  }

  async listContacts(
    tenantId: string,
    filters: ContactFilters = {}
  ): Promise<Contact[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(filters.type);
      paramIndex++;
    }

    if (filters.taxId) {
      conditions.push(`tax_id = $${paramIndex}`);
      params.push(filters.taxId);
      paramIndex++;
    }

    if (filters.email) {
      conditions.push(`email = $${paramIndex}`);
      params.push(filters.email);
      paramIndex++;
    }

    if (filters.phone) {
      conditions.push(`phone = $${paramIndex}`);
      params.push(filters.phone);
      paramIndex++;
    }

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(`(
        name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        tax_id ILIKE $${paramIndex}
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<ContactRow>(
      tenantId,
      `
      SELECT id, tenant_id, type, name, tax_id, email, phone, address,
             user_id, kyc_status, metadata, createdAt, updatedAt
      FROM contacts
      WHERE ${conditions.join(' AND ')}
      ORDER BY createdAt DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toContact(row));
  }

  /**
   * Atualiza status KYC do contato
   */
  async updateKycStatus(
    tenantId: string,
    contactId: string,
    kycStatus: 'UNVERIFIED' | 'BASIC_VERIFIED'
  ): Promise<Contact> {
    const row = await runQueryWithTenant<ContactRow>(
      tenantId,
      `
      UPDATE contacts
      SET kyc_status = $3, updatedAt = NOW()
      WHERE tenant_id = $1 AND id = $2
      RETURNING id, tenant_id, type, name, tax_id, email, phone, address,
                user_id, kyc_status, metadata, createdAt, updatedAt
      `,
      [tenantId, contactId, kycStatus]
    );

    return this.toContact(row);
  }
}

export const contactRepository = new ContactRepository();



