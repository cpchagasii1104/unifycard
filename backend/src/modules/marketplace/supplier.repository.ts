// backend/src/modules/marketplace/supplier.repository.ts
// SPRINT 69: Repository para suppliers

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  Supplier,
  SupplierFilters,
} from './supplier.types';

interface SupplierRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  tax_id: string | null;
  registration_number: string | null;
  status: string;
  owner_actor_id: string; // DECISION-0133
  actor_id: string | null; // ponte Fatia 7 (Opção B)
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

class SupplierRepository {
  /**
   * Converte row para Supplier
   */
  private toSupplier(row: SupplierRow): Supplier {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      email: row.email,
      phone: row.phone,
      contactName: row.contact_name,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      country: row.country,
      taxId: row.tax_id,
      registrationNumber: row.registration_number,
      status: row.status as any,
      ownerActorId: row.owner_actor_id, // DECISION-0133
      actorId: row.actor_id, // ponte Fatia 7 (Opção B)
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Cria fornecedor
   */
  async createSupplier(
    tenantId: string,
    input: {
      name: string;
      code: string | null;
      email: string | null;
      phone: string | null;
      contactName: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
      taxId: string | null;
      registrationNumber: string | null;
      status: string;
      ownerActorId: string; // DECISION-0133 (resolvido server-side; nunca body cru)
      actorId: string | null; // ponte Fatia 7 (validada server-side no service ANTES de chegar aqui)
      createdByActorId: string;
      createdByUserId: string | null;
      metadata: Record<string, any>;
    }
  ): Promise<Supplier> {
    const row = await runQueryWithTenant<SupplierRow>(
      tenantId,
      `
      INSERT INTO suppliers (
        tenant_id, name, code, email, phone, contact_name,
        address, city, state, zip_code, country,
        tax_id, registration_number, status, owner_actor_id, actor_id,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb)
      RETURNING id, tenant_id, name, code, email, phone, contact_name,
                address, city, state, zip_code, country,
                tax_id, registration_number, status, owner_actor_id, actor_id,
                created_by_actor_id, created_by_user_id, metadata,
                created_at, updated_at
      `,
      [
        tenantId,
        input.name,
        input.code,
        input.email,
        input.phone,
        input.contactName,
        input.address,
        input.city,
        input.state,
        input.zipCode,
        input.country,
        input.taxId,
        input.registrationNumber,
        input.status,
        input.ownerActorId, // DECISION-0133 (owner empresarial; $16)
        input.actorId, // ponte Fatia 7 ($17)
        input.createdByActorId,
        input.createdByUserId,
        JSON.stringify(input.metadata),
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar fornecedor');
    }

    return this.toSupplier(row);
  }

  /**
   * Busca fornecedor por ID
   */
  async getSupplierById(tenantId: string, supplierId: string): Promise<Supplier | null> {
    const rows = await runQueriesWithTenant<SupplierRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, code, email, phone, contact_name,
             address, city, state, zip_code, country,
             tax_id, registration_number, status, owner_actor_id, actor_id,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM suppliers
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, supplierId]
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    return this.toSupplier(rows[0]);
  }

  /**
   * Lista fornecedores com filtros
   */
  async listSuppliers(tenantId: string, filters: SupplierFilters = {}): Promise<Supplier[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const rows = await runQueriesWithTenant<SupplierRow>(
      tenantId,
      `
      SELECT id, tenant_id, name, code, email, phone, contact_name,
             address, city, state, zip_code, country,
             tax_id, registration_number, status, owner_actor_id, actor_id,
             created_by_actor_id, created_by_user_id, metadata,
             created_at, updated_at
      FROM suppliers
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toSupplier(row));
  }

  /**
   * Vincula (ou desvincula, actorId=null) o fornecedor a um actor da plataforma — ponte Fatia 7
   * (Opção B). Autoridade (representar o owner) já foi provada na ROTA antes de chegar aqui;
   * existência do actor já foi validada no SERVICE. Aqui é só a escrita.
   */
  async linkActor(tenantId: string, supplierId: string, actorId: string | null): Promise<Supplier | null> {
    const row = await runQueryWithTenant<SupplierRow>(
      tenantId,
      `UPDATE suppliers SET actor_id = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2
       RETURNING id, tenant_id, name, code, email, phone, contact_name,
                 address, city, state, zip_code, country,
                 tax_id, registration_number, status, owner_actor_id, actor_id,
                 created_by_actor_id, created_by_user_id, metadata,
                 created_at, updated_at`,
      [tenantId, supplierId, actorId]
    );
    return row ? this.toSupplier(row) : null;
  }
}

export const supplierRepository = new SupplierRepository();








