// backend/src/modules/marketplace/tax-profile.service.ts
// SPRINT 80: Service para Tax Profiles

import { taxProfileRepository } from './tax-profile.repository';
import { companyProfileRepository } from './company-profile.repository';
import type { TaxProfile, SetTaxProfileInput } from './tax-profile.types';
import { ALLOWED_DOCUMENT_TYPES_BY_REGIME } from './tax-profile.types';

/**
 * Service para Tax Profiles
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Regime tributário ≠ cálculo automático
 * - Regime tributário ≠ pagamento
 * - Regime tributário influencia:
 *   - Tipo de documento fiscal permitido
 *   - Campos obrigatórios
 *   - Validações futuras
 * - Nenhum imposto é calculado
 * - Nenhuma alíquota aplicada
 */
class TaxProfileService {
  /**
   * Define perfil fiscal
   * 
   * SPRINT 80: Apenas 1 perfil fiscal por tenant
   */
  async setTaxProfile(
    tenantId: string,
    input: SetTaxProfileInput,
    updatedByUserId: string
  ): Promise<TaxProfile> {
    // Validar que company_profile existe
    const companyProfile = await companyProfileRepository.getProfile(tenantId);
    if (!companyProfile) {
      throw new Error('Company profile não encontrado. Crie um company profile primeiro.');
    }

    const taxProfile = await taxProfileRepository.setTaxProfile(
      tenantId,
      tenantId, // company_profile_tenant_id = tenant_id (1:1)
      input
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'TAX_PROFILE_SET',
      taxProfileId: taxProfile.id,
      taxRegime: taxProfile.taxRegime,
      updatedByUserId,
    });

    return taxProfile;
  }

  /**
   * Busca perfil fiscal
   */
  async getTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    return await taxProfileRepository.getTaxProfile(tenantId);
  }

  /**
   * Atualiza perfil fiscal
   */
  async updateTaxProfile(
    tenantId: string,
    input: Partial<SetTaxProfileInput>,
    updatedByUserId: string
  ): Promise<TaxProfile> {
    // Buscar perfil existente
    const existing = await taxProfileRepository.getTaxProfile(tenantId);
    if (!existing) {
      throw new Error('Tax profile não encontrado. Use setTaxProfile para criar.');
    }

    // Mesclar com valores existentes
    const updateInput: SetTaxProfileInput = {
      taxRegime: input.taxRegime ?? existing.taxRegime,
      state: input.state ?? existing.state ?? undefined,
      city: input.city ?? existing.city ?? undefined,
      isIcmsContributor: input.isIcmsContributor ?? existing.isIcmsContributor,
      isServiceProvider: input.isServiceProvider ?? existing.isServiceProvider,
      metadata: input.metadata ?? existing.metadata,
    };

    const taxProfile = await taxProfileRepository.setTaxProfile(
      tenantId,
      existing.companyProfileTenantId,
      updateInput
    );

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'TAX_PROFILE_UPDATED',
      taxProfileId: taxProfile.id,
      taxRegime: taxProfile.taxRegime,
      updatedByUserId,
    });

    return taxProfile;
  }

  /**
   * Valida se tipo de documento fiscal é permitido para o regime
   */
  async validateDocumentType(
    tenantId: string,
    documentType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const taxProfile = await this.getTaxProfile(tenantId);
    if (!taxProfile) {
      return { allowed: false, reason: 'Tax profile não encontrado' };
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
   * Resolve tax profile para uso em validações
   */
  async resolveTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    return await this.getTaxProfile(tenantId);
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      taxProfileId: string;
      taxRegime: string;
      updatedByUserId: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: data.updatedByUserId,
        actor_type: 'user',
        source: 'tax_profile',
        context: {
          tax_profile_id: data.taxProfileId,
          tax_regime: data.taxRegime,
          updated_by_user_id: data.updatedByUserId,
        },
      });
    } catch (error) {
      console.warn('[TaxProfile] Erro ao registrar auditoria:', error);
    }
  }
}

export const taxProfileService = new TaxProfileService();





