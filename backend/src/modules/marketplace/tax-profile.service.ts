// backend/src/modules/marketplace/tax-profile.service.ts
//
// 🔴 FONTE FISCAL APOSENTADA → LEITURA REDIRECIONADA À CASA CANÔNICA
// F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 4b (DECISION-0166 D9.4).
//
// A tabela tax_profiles NUNCA existiu no banco (fantasma do SPRINT 80). Este service era o
// consumidor do 3º vocabulário TaxRegime. Agora:
//   - LEITURA (getTaxProfile/resolveTaxProfile/validateDocumentType) é REDIRECIONADA à casa
//     canônica actor_fiscal_profiles (regime governado D9.5). state/city/flags ICMS não têm
//     fonte configurada ainda (viriam do perfil fantasma) → null/false HONESTOS, nunca
//     inventados. Sem perfil configurado → null (fiscal_config_missing no caller).
//   - ESCRITA (setTaxProfile/updateTaxProfile) = 501 RETIRED: configurar regime é rito da casa
//     canônica (draft→activate em fiscalProfileRepository), não deste trilho.
// Regras arquiteturais originais preservadas: nenhum imposto calculado, nenhuma alíquota.

import { fiscalProfileRepository } from '../fiscal/fiscal-profile.repository';
import type { TaxProfile, SetTaxProfileInput } from './tax-profile.types';
import { ALLOWED_DOCUMENT_TYPES_BY_REGIME } from './tax-profile.types';

function retired(operation: string): never {
  throw Object.assign(
    new Error(
      `TAX_PROFILE_RETIRED: ${operation} — tax_profiles era tabela FANTASMA e foi aposentada ` +
        `como fonte fiscal (Fase 4b, DECISION-0166 D9.4). Configure o regime pela casa canônica ` +
        `actor_fiscal_profiles (fiscalProfileRepository: createDraftProfile → activateProfile).`
    ),
    { statusCode: 501 }
  );
}

class TaxProfileService {
  async setTaxProfile(
    _tenantId: string,
    _input: SetTaxProfileInput,
    _updatedByUserId: string
  ): Promise<TaxProfile> {
    retired('setTaxProfile');
  }

  /**
   * Busca perfil fiscal — REDIRECIONADO à casa canônica (actor_fiscal_profiles).
   * Mapeia para o shape legado TaxProfile por compat; campos sem fonte configurada
   * (state/city/ICMS) ficam null/false honestos. Sem perfil ativo → null.
   */
  async getTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    const canonical = await fiscalProfileRepository.getActiveProfileForTenant(tenantId);
    if (!canonical) return null;
    return {
      id: canonical.id,
      tenantId: canonical.tenantId,
      companyProfileTenantId: canonical.tenantId,
      taxRegime: canonical.taxRegime,
      state: null,
      city: null,
      isIcmsContributor: false,
      isServiceProvider: false,
      metadata: canonical.metadata as Record<string, any>,
      createdAt: canonical.createdAt,
      updatedAt: canonical.createdAt,
    };
  }

  async updateTaxProfile(
    _tenantId: string,
    _input: Partial<SetTaxProfileInput>,
    _updatedByUserId: string
  ): Promise<TaxProfile> {
    retired('updateTaxProfile');
  }

  /**
   * Valida se tipo de documento fiscal é permitido para o regime (regime canônico).
   * Sem perfil configurado → fail-closed honesto (fiscal_config_missing).
   */
  async validateDocumentType(
    tenantId: string,
    documentType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const taxProfile = await this.getTaxProfile(tenantId);
    if (!taxProfile) {
      return {
        allowed: false,
        reason: 'fiscal_config_missing: perfil fiscal não configurado (actor_fiscal_profiles).',
      };
    }

    const allowedTypes = ALLOWED_DOCUMENT_TYPES_BY_REGIME[taxProfile.taxRegime];
    if (!allowedTypes || !allowedTypes.includes(documentType)) {
      return {
        allowed: false,
        reason: `Tipo de documento '${documentType}' não é permitido para regime '${taxProfile.taxRegime}'. Tipos permitidos: ${allowedTypes.join(', ')}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Resolve tax profile para uso em validações (redirecionado à casa canônica).
   */
  async resolveTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    return await this.getTaxProfile(tenantId);
  }
}

export const taxProfileService = new TaxProfileService();
