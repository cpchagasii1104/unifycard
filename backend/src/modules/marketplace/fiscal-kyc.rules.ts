// backend/src/modules/marketplace/fiscal-kyc.rules.ts
// SPRINT 84: KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS

import type { TaxRegime } from './tax-profile.types';

/**
 * Campos obrigatórios para emissor (empresa) por regime tributário
 */
export interface RequiredEmitterFields {
  taxId: boolean; // CNPJ
  name: boolean;
  state: boolean; // UF
  city: boolean;
}

/**
 * Campos obrigatórios para comprador (contact) por regime tributário
 */
export interface RequiredBuyerFields {
  taxId: boolean; // CPF/CNPJ
  name: boolean;
}

/**
 * Regras de campos obrigatórios por regime tributário
 */
export const REQUIRED_FIELDS_BY_REGIME: Record<TaxRegime, {
  emitter: RequiredEmitterFields;
  buyer: RequiredBuyerFields;
}> = {
  MEI: {
    emitter: {
      taxId: true, // CNPJ obrigatório
      name: true,
      state: false, // Opcional para MEI
      city: false, // Opcional para MEI
    },
    buyer: {
      taxId: false, // Opcional para MEI
      name: false, // Opcional para MEI
    },
  },
  SIMPLES: {
    emitter: {
      taxId: true, // CNPJ obrigatório
      name: true,
      state: true, // UF obrigatório
      city: true, // Cidade obrigatória
    },
    buyer: {
      taxId: true, // CPF/CNPJ obrigatório se informado
      name: true, // Nome obrigatório se informado
    },
  },
  PRESUMIDO: {
    emitter: {
      taxId: true, // CNPJ obrigatório
      name: true,
      state: true, // UF obrigatório
      city: true, // Cidade obrigatória
    },
    buyer: {
      taxId: true, // CPF/CNPJ obrigatório se informado
      name: true, // Nome obrigatório se informado
    },
  },
  REAL: {
    emitter: {
      taxId: true, // CNPJ obrigatório
      name: true,
      state: true, // UF obrigatório
      city: true, // Cidade obrigatória
    },
    buyer: {
      taxId: true, // CPF/CNPJ obrigatório se informado
      name: true, // Nome obrigatório se informado
    },
  },
};

/**
 * Valida campos obrigatórios do emissor
 */
export function validateEmitterFields(
  regime: TaxRegime,
  emitter: {
    taxId?: string | null;
    name?: string | null;
    state?: string | null;
    city?: string | null;
  }
): { valid: boolean; missingFields: string[] } {
  const rules = REQUIRED_FIELDS_BY_REGIME[regime].emitter;
  const missingFields: string[] = [];

  if (rules.taxId && (!emitter.taxId || emitter.taxId.trim().length === 0)) {
    missingFields.push('CNPJ do emissor');
  }

  if (rules.name && (!emitter.name || emitter.name.trim().length === 0)) {
    missingFields.push('Nome do emissor');
  }

  if (rules.state && (!emitter.state || emitter.state.trim().length === 0)) {
    missingFields.push('UF do emissor');
  }

  if (rules.city && (!emitter.city || emitter.city.trim().length === 0)) {
    missingFields.push('Cidade do emissor');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Valida campos obrigatórios do comprador
 */
export function validateBuyerFields(
  regime: TaxRegime,
  buyer: {
    taxId?: string | null;
    name?: string | null;
    kycStatus?: 'UNVERIFIED' | 'BASIC_VERIFIED';
  } | null
): { valid: boolean; missingFields: string[]; warnings: string[] } {
  const rules = REQUIRED_FIELDS_BY_REGIME[regime].buyer;
  const missingFields: string[] = [];
  const warnings: string[] = [];

  // Se não há comprador informado, validação depende do regime
  if (!buyer) {
    if (rules.taxId || rules.name) {
      // Para regimes que exigem comprador, mas não é obrigatório ter contact
      // apenas avisar
      warnings.push('Comprador não informado (opcional para este regime)');
    }
    return { valid: true, missingFields: [], warnings };
  }

  // Se há comprador, validar campos obrigatórios
  if (rules.taxId && (!buyer.taxId || buyer.taxId.trim().length === 0)) {
    missingFields.push('CPF/CNPJ do comprador');
  }

  if (rules.name && (!buyer.name || buyer.name.trim().length === 0)) {
    missingFields.push('Nome do comprador');
  }

  // Validar KYC status se comprador informado
  if (buyer.kycStatus === 'UNVERIFIED') {
    warnings.push('Comprador não possui KYC básico verificado');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}





