// backend/src/modules/marketplace/supplier.service.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

import { supplierRepository } from './supplier.repository';
import { ForbiddenError } from '@core/errors';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import type {
  Supplier,
  CreateSupplierInput,
  SupplierFilters,
  SupplierStatus,
} from './supplier.types';

// 🔴 F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH: vocabulário CANÔNICO lowercase, espelha o CHECK físico
// `suppliers_status_check` ((status = ANY (ARRAY['active','inactive']))). Single source no runtime.
export const SUPPLIER_STATUSES: readonly SupplierStatus[] = ['active', 'inactive'];

/** Normaliza o status do input p/ o canônico lowercase. Ausente → 'active'. Inválido → erro (falha honesta). */
export function normalizeSupplierStatus(raw: string | null | undefined): SupplierStatus {
  if (raw == null || String(raw).trim() === '') return 'active';
  const v = String(raw).trim().toLowerCase();
  if ((SUPPLIER_STATUSES as readonly string[]).includes(v)) return v as SupplierStatus;
  throw new Error(`SUPPLIER_STATUS_INVALID: status deve ser 'active' ou 'inactive' (recebido: ${raw})`);
}

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
   * 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE (§4.8.4) — autoridade-ATIVA. canRepresentActor (na rota) DECIDE
   * permissão sobre o owner empresarial; quarentena DECIDE se o actor está ATIVO. Recebe actorId JÁ RESOLVIDO
   * (owner_actor_id autoridade OU createdBy autoria), NUNCA userId cru/referral/created_by-como-autoridade.
   * Chamar ANTES da escrita em `suppliers`. NÃO toca canRepresentActor (que segue puro). 403 ACTOR_EFFECTIVELY_BLOCKED.
   */
  private async assertActorNotQuarantined(tenantId: string, actorId: string): Promise<void> {
    if (await isActorEffectivelyBlocked(tenantId, actorId)) {
      throw new ForbiddenError(
        'ACTOR_EFFECTIVELY_BLOCKED: actor em quarentena (ou âncora humana bloqueada) — mutação de fornecedor bloqueada (§4.8.4).'
      );
    }
  }

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

    // 🔴 F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH: o CHECK físico `suppliers_status_check` aceita só
    // 'active'/'inactive' (minúsculo). Normalizamos o input para o vocabulário CANÔNICO lowercase (default
    // 'active' quando ausente); valor fora do canônico é REJEITADO antes de bater no CHECK (falha honesta).
    const status = normalizeSupplierStatus(input.status);

    // 🔴 F-PURCHASE-ORDER-SUPPLIER-QUARANTINE-GATE: owner empresarial bloqueado → não cria fornecedor em seu nome;
    // e o acting/createdBy bloqueado → não opera. ANTES da escrita. (created_by é AUTORIA, não autoridade.)
    await this.assertActorNotQuarantined(tenantId, input.ownerActorId);
    if (createdByActorId && createdByActorId !== input.ownerActorId) {
      await this.assertActorNotQuarantined(tenantId, createdByActorId);
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
      status,
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
    // 🔴 F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH: o filtro de status também é canônico lowercase (senão um
    // ?status=ACTIVE retornaria vazio silenciosamente contra o CHECK físico). Valor inválido → ignorado.
    const normalized: SupplierFilters = { ...filters };
    if (normalized.status != null && String(normalized.status).trim() !== '') {
      const v = String(normalized.status).trim().toLowerCase();
      normalized.status = (SUPPLIER_STATUSES as readonly string[]).includes(v) ? (v as SupplierStatus) : undefined;
    }
    return await supplierRepository.listSuppliers(tenantId, normalized);
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






