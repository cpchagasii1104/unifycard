// backend/src/modules/marketplace/supplier.types.ts
// SPRINT 69: SUPPLIERS + PURCHASE ORDERS

/**
 * Status do fornecedor
 */
// 🔴 F-SUPPLIERS-STATUS-ENUM-CASE-MISMATCH: alinhado ao CHECK físico `suppliers_status_check`
// ((status = ANY (ARRAY['active','inactive']))). lowercase canônico; 'SUSPENDED' não existe no DB.
export type SupplierStatus = 'active' | 'inactive';

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
  // 🔵 F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7, Opção B): ponte pra actor QUANDO o
  // fornecedor É actor na plataforma (aresta actor_relationships label=fornecedor referencia o
  // MESMO actor). null = fornecedor off-platform (registro digitado puro, sem identidade de actor).
  actorId: string | null;
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
  // 🔵 ponte pra actor (Fatia 7) — validada server-side (existência) antes de gravar; null/ausente = off-platform.
  actorId?: string | null;
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







