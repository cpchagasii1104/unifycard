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
  created_by_actor_id: string;
  created_by_user_id: string | null;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
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
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
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
        tax_id, registration_number, status,
        created_by_actor_id, created_by_user_id, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      RETURNING id, tenant_id, name, code, email, phone, contact_name,
                address, city, state, zip_code, country,
                tax_id, registration_number, status,
                created_by_actor_id, created_by_user_id, metadata,
                createdAt, updatedAt
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
             tax_id, registration_number, status,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
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
             tax_id, registration_number, status,
             created_by_actor_id, created_by_user_id, metadata,
             createdAt, updatedAt
      FROM suppliers
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    return rows.map((row) => this.toSupplier(row));
  }
}

export const supplierRepository = new SupplierRepository();








