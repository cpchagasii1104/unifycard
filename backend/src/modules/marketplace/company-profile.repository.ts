// backend/src/modules/marketplace/company-profile.repository.ts
//
// 🔴 FONTE FISCAL APOSENTADA — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 4b (DECISION-0166 D9.4).
//
// Este repository lia/escrevia a tabela `company_profiles` — QUE NUNCA EXISTIU NO BANCO
// (fantasma do SPRINT 75): todo SELECT lançava exceção em runtime, engolida por try/catch nos
// callers. A casa canônica do regime fiscal agora é `actor_fiscal_profiles` ANCORADA em
// `fiscal_identities` (src/modules/fiscal/fiscal-profile.repository.ts).
//
// TOMBSTONE fail-honest: leitura devolve null (nenhum perfil fantasma existe — o caller trata
// como fiscal_config_missing); escrita lança 501 RETIRED. NENHUM SQL contra tabela inexistente.
// company_profiles NÃO deve ser materializada como fonte fiscal (D9.4 / D9 item 9).

import type { CompanyProfile, SetCompanyProfileInput } from './company-profile.types';

function retired(operation: string): never {
  throw Object.assign(
    new Error(
      `COMPANY_PROFILE_RETIRED: ${operation} — company_profiles era tabela FANTASMA (nunca ` +
        `existiu no banco) e foi aposentada como fonte fiscal (Fase 4b, DECISION-0166 D9.4). ` +
        `Use actor_fiscal_profiles (fiscalProfileRepository) ancorada em fiscal_identities.`
    ),
    { statusCode: 501 }
  );
}

class CompanyProfileRepository {
  /** Fonte aposentada: nenhum perfil fantasma existe. null = configuração ausente (honesto). */
  async getProfile(_tenantId: string): Promise<CompanyProfile | null> {
    return null;
  }

  async setProfile(
    _tenantId: string,
    _input: SetCompanyProfileInput,
    _createdByActorId: string,
    _createdByUserId: string | null,
    _updatedByActorId: string,
    _updatedByUserId: string | null
  ): Promise<CompanyProfile> {
    retired('setProfile');
  }
}

export const companyProfileRepository = new CompanyProfileRepository();
