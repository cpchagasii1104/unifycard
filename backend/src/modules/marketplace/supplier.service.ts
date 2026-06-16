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

    // 🔴 DECISION-0133 (defesa em profundidade): supplier NUNCA nasce sem owner empresarial material.
    // O owner é resolvido/validado server-side na rota (isOrgActor + canRepresentActor); aqui só garantimos
    // que ele chegou. created_by_actor_id permanece AUTORIA, nunca owner.
    if (!input.ownerActorId) {
      throw new Error('SUPPLIER_OWNER_REQUIRED: owner_actor_id (empresa dona) é obrigatório para criar fornecedor');
    }

    // Criar fornecedor
    const supplier = await supplierRepository.createSupplier(tenantId, {
      name: input.name.trim(),
      ownerActorId: input.ownerActorId, // DECISION-0133 (resolvido server-side; nunca body cru)
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
        actor_id: data.createdByActorId ?? undefined,
        actor_type: 'user',
        source: 'automation',
        context: {
          supplier_id: data.supplierId,
          created_by_user_id: data.createdByUserId ?? undefined,
        },
      });
    } catch (error) {
      // Não bloquear se auditoria falhar
      console.warn('[Supplier] Erro ao registrar auditoria:', error);
    }
  }
}

export const supplierService = new SupplierService();






