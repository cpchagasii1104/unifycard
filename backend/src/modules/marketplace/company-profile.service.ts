// backend/src/modules/marketplace/company-profile.service.ts
// SPRINT 75: PERFIS ERP + REGIME TRIBUTÁRIO

import { companyProfileRepository } from './company-profile.repository';
import type { CompanyProfile, SetCompanyProfileInput } from './company-profile.types';

/**
 * Service para Perfis de Empresa
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Perfil ≠ Configuração financeira
 * - Regime ≠ Cálculo automático
 * - Tudo informativo e auditável
 * - NÃO integra SEFAZ
 * - NÃO executa cálculo tributário real
 */
class CompanyProfileService {
  /**
   * Define perfil da empresa
   * 
   * SPRINT 75: Apenas 1 perfil por tenant
   */
  async setProfile(
    _tenantId: string,
    _input: SetCompanyProfileInput,
    _updatedByActorId: string,
    _updatedByUserId?: string
  ): Promise<CompanyProfile> {
    // 🔴 Fase 4b (DECISION-0166 D9.4): company_profiles era tabela FANTASMA — aposentada como
    //    fonte fiscal. Corpo legado removido; fail-closed 501 permanente. A configuração de
    //    regime vive em actor_fiscal_profiles (fiscalProfileRepository).
    throw Object.assign(
      new Error(
        'COMPANY_PROFILE_RETIRED: setProfile — fonte fiscal aposentada (Fase 4b, DECISION-0166 ' +
          'D9.4). Use actor_fiscal_profiles (fiscalProfileRepository) ancorada em fiscal_identities.'
      ),
      { statusCode: 501 }
    );
  }

  /**
   * Busca perfil da empresa.
   * Fase 4b: fonte fantasma aposentada — devolve null (fiscal_config_missing honesto).
   * Regime fiscal canônico: fiscalProfileRepository.getActiveProfileForTenant.
   */
  async getProfile(tenantId: string): Promise<CompanyProfile | null> {
    return await companyProfileRepository.getProfile(tenantId);
  }

  // recordAudit removido na Fase 4b: o writer está aposentado (501) — nada mais audita aqui.
}

export const companyProfileService = new CompanyProfileService();






