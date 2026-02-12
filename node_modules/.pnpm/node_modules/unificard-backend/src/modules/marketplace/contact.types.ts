// backend/src/modules/marketplace/contact.types.ts
// SPRINT 0: CONTACTS / CLIENTES UNIFICADOS

/**
 * Tipo de contato
 */
export type ContactType = 'PERSON' | 'COMPANY';

/**
 * Status de KYC
 */
export type KycStatus = 'UNVERIFIED' | 'BASIC_VERIFIED';

/**
 * Endereço do contato
 */
export interface ContactAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Contact
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Contact ≠ User
 * - Contact ≠ Actor
 * - Contact pode estar vinculado a User (opcional)
 * - Tax_id normalizado (só dígitos)
 * - Idempotência por tax_id (se já existe, retorna existente)
 */
export interface Contact {
  id: string;
  tenantId: string;
  type: ContactType;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  address: ContactAddress;
  userId: string | null;
  kycStatus: KycStatus; // SPRINT 84
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar contato
 */
export interface CreateContactInput {
  type: ContactType;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: ContactAddress;
  userId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar contato
 */
export interface UpdateContactInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: ContactAddress;
  metadata?: Record<string, any>;
}

/**
 * Filtros para listar contatos
 */
export interface ContactFilters {
  type?: ContactType;
  taxId?: string;
  email?: string;
  phone?: string;
  userId?: string;
  search?: string; // Busca por nome, email, phone, taxId
  limit?: number;
  offset?: number;
}


