// backend/src/modules/marketplace/supplier.service.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

import { supplierRepository } from './supplier.repository';
import type {
  Supplier,
  CreateSupplierInput,
  SupplierFilters,
} from './supplier.types';

/**
 * Service para Fornecedores
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 */
class SupplierService {
  /**
   * Cria fornecedor
   */
  async createSupplier(
    tenantId: string,
    input: CreateSupplierInput,
    createdByActorId: string,
    createdByUserId?: string
  ): Promise<Supplier> {
    // Validar nome é obrigatório
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Nome do fornecedor é obrigatório');
    }

    // Criar fornecedor
    const supplier = await supplierRepository.createSupplier(tenantId, {
      name: input.name.trim(),
      code: input.code?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      contactName: input.contactName?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      zipCode: input.zipCode?.trim() || null,
      country: input.country?.trim() || null,
      taxId: input.taxId?.trim() || null,
      registrationNumber: input.registrationNumber?.trim() || null,
      status: input.status || 'ACTIVE',
      createdByActorId,
      createdByUserId: createdByUserId || null,
      metadata: input.metadata || {},
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'SUPPLIER_CREATED',
      supplierId: supplier.id,
      createdByActorId,
      createdByUserId,
    });

    return supplier;
  }

  /**
   * Lista fornecedores com filtros
   */
  async listSuppliers(tenantId: string, filters: SupplierFilters = {}): Promise<Supplier[]> {
    return await supplierRepository.listSuppliers(tenantId, filters);
  }

  /**
   * Busca fornecedor por ID
   */
  async getSupplierById(tenantId: string, supplierId: string): Promise<Supplier | null> {
    return await supplierRepository.getSupplierById(tenantId, supplierId);
  }

  // ============================================================
  // MÉTODOS PRIVADOS
  // ============================================================

  /**
   * Registra evento de auditoria
   */
  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      supplierId: string;
      createdByActorId?: string;
      createdByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: data.createdByActorId || null,
        actor_type: 'user',
        source: 'automation',
        context: {
          supplier_id: data.supplierId,
          created_by_user_id: data.createdByUserId,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[Supplier] Erro ao registrar auditoria:', error);
    }
  }
}

export const supplierService = new SupplierService();






