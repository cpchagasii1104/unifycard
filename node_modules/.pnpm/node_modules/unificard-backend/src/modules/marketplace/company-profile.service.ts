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
    tenantId: string,
    input: SetCompanyProfileInput,
    updatedByActorId: string,
    updatedByUserId?: string
  ): Promise<CompanyProfile> {
    // Buscar perfil existente para obter created_by
    const existing = await companyProfileRepository.getProfile(tenantId);
    const createdByActorId = existing?.createdByActorId || updatedByActorId;
    const createdByUserId = existing?.createdByUserId || updatedByUserId || null;

    const profile = await companyProfileRepository.setProfile(
      tenantId,
      input,
      createdByActorId,
      createdByUserId,
      updatedByActorId,
      updatedByUserId || null
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: existing ? 'COMPANY_PROFILE_UPDATED' : 'COMPANY_PROFILE_CREATED',
      tenantId: profile.tenantId,
      erpProfile: profile.erpProfile,
      taxRegime: profile.taxRegime,
      updatedByActorId,
      updatedByUserId,
    });

    return profile;
  }

  /**
   * Busca perfil da empresa
   */
  async getProfile(tenantId: string): Promise<CompanyProfile | null> {
    return await companyProfileRepository.getProfile(tenantId);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      tenantId: string;
      erpProfile: string;
      taxRegime: string;
      updatedByActorId: string;
      updatedByUserId?: string | null;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'MEDIUM',
        actor_id: data.updatedByActorId,
        actor_type: 'user',
        source: 'marketplace',
        context: {
          tenant_id: data.tenantId,
          erp_profile: data.erpProfile,
          tax_regime: data.taxRegime,
          updated_by_user_id: data.updatedByUserId,
        },
      });
    } catch (error) {
      console.warn('[CompanyProfile] Erro ao registrar auditoria:', error);
    }
  }
}

export const companyProfileService = new CompanyProfileService();






