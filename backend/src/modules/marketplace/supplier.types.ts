// backend/src/modules/marketplace/supplier.types.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

/**
 * Status do fornecedor
 */
export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * Fornecedor
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Append-only: status muda, mas registros não desaparecem
 * - Status declarativos
 * - Audit em todas as mudanças
 */
export interface Supplier {
  id: string;
  tenantId: string;
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
  status: SupplierStatus;
  // 🔴 DECISION-0133: owner canônico = actor operacional da empresa dona (page+company_id). Authority material.
  ownerActorId: string;
  createdByActorId: string;
  createdByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar fornecedor
 */
export interface CreateSupplierInput {
  name: string;
  // 🔴 DECISION-0133: hint de owner empresarial; RESOLVIDO/validado server-side na rota (body não é autoridade).
  ownerActorId?: string;
  code?: string;
  email?: string;
  phone?: string;
  contactName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
  status?: SupplierStatus;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar fornecedores
 */
export interface SupplierFilters {
  status?: SupplierStatus;
  search?: string; // Busca por nome ou código
  limit?: number;
  offset?: number;
}







