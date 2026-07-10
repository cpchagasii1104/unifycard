// backend/src/modules/marketplace/tax-profile.repository.ts
//
// 🔴 FONTE FISCAL APOSENTADA — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 4b (DECISION-0166 D9.4).
//
// Este repository lia/escrevia a tabela `tax_profiles` — QUE NUNCA EXISTIU NO BANCO (fantasma
// do SPRINT 80), e carregava o TERCEIRO vocabulário TaxRegime do sistema (grafias curtas
// SIMPLES/PRESUMIDO/REAL). A casa canônica do regime fiscal agora é `actor_fiscal_profiles`
// ANCORADA em `fiscal_identities` (src/modules/fiscal/fiscal-profile.repository.ts).
//
// TOMBSTONE fail-honest: leitura devolve null; escrita lança 501 RETIRED. NENHUM SQL contra
// tabela inexistente. tax_profiles NÃO deve ser materializada como fonte fiscal.

import type { TaxProfile, SetTaxProfileInput } from './tax-profile.types';

function retired(operation: string): never {
  throw Object.assign(
    new Error(
      `TAX_PROFILE_RETIRED: ${operation} — tax_profiles era tabela FANTASMA (nunca existiu no ` +
        `banco) e foi aposentada como fonte fiscal (Fase 4b, DECISION-0166 D9.4). ` +
        `Use actor_fiscal_profiles (fiscalProfileRepository) ancorada em fiscal_identities.`
    ),
    { statusCode: 501 }
  );
}

class TaxProfileRepository {
  /** Fonte aposentada: nenhum perfil fantasma existe. null = configuração ausente (honesto). */
  async getTaxProfile(_tenantId: string): Promise<TaxProfile | null> {
    return null;
  }

  async setTaxProfile(
    _tenantId: string,
    _companyProfileTenantId: string,
    _input: SetTaxProfileInput
  ): Promise<TaxProfile> {
    retired('setTaxProfile');
  }
}

export const taxProfileRepository = new TaxProfileRepository();
