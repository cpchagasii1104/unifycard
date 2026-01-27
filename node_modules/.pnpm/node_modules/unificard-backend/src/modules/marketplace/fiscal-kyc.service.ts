// backend/src/modules/marketplace/fiscal-kyc.service.ts
// SPRINT 84: KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS

import { taxProfileService } from './tax-profile.service';
import { companyProfileService } from './company-profile.service';
import { contactService } from './contact.service';
import { fiscalDocumentRepository } from './fiscal-document.repository';
import {
  validateEmitterFields,
  validateBuyerFields,
  REQUIRED_FIELDS_BY_REGIME,
} from './fiscal-kyc.rules';

/**
 * Resultado de validação KYC fiscal
 */
export interface FiscalKycValidationResult {
  canIssue: boolean;
  missingFields: string[];
  warnings: string[];
}

/**
 * Input para validar KYC fiscal
 */
export interface ValidateFiscalKycInput {
  emitterActorId?: string; // Actor da empresa emissora
  buyerContactId?: string; // Contact do comprador
  documentId?: string; // ID do documento fiscal (opcional, para buscar dados)
}

/**
 * Service para validação KYC fiscal
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - READ-ONLY (não altera dados)
 * - Não bloqueia venda
 * - Bloqueia apenas emissão fiscal se dados faltarem
 * - Não integra Receita
 */
class FiscalKycService {
  /**
   * Valida KYC básico para emissão fiscal
   */
  async validateFiscalKyc(
    tenantId: string,
    input: ValidateFiscalKycInput
  ): Promise<FiscalKycValidationResult> {
    const missingFields: string[] = [];
    const warnings: string[] = [];

    // 1. Buscar regime tributário
    const taxProfile = await taxProfileService.getTaxProfile(tenantId);
    if (!taxProfile) {
      missingFields.push('Perfil fiscal não configurado');
      return { canIssue: false, missingFields, warnings };
    }

    const regime = taxProfile.taxRegime;
    const rules = REQUIRED_FIELDS_BY_REGIME[regime];

    // 2. Validar emissor (empresa)
    // Buscar dados da empresa do metadata do company_profile ou tentar buscar de companies
    let emitterData: {
      taxId?: string | null;
      name?: string | null;
      state?: string | null;
      city?: string | null;
    } = {};

    // Buscar company profile (tem metadata que pode conter CNPJ/nome)
    const companyProfile = await companyProfileService.getProfile(tenantId);
    if (companyProfile) {
      // Tentar buscar CNPJ e nome do metadata ou de companies
      const metadata = companyProfile.metadata || {};
      emitterData = {
        taxId: metadata.cnpj || null,
        name: metadata.companyName || metadata.name || null,
        state: taxProfile.state,
        city: taxProfile.city,
      };

      // Se não encontrou no metadata, tentar buscar de companies (se houver actor_id)
      if (!emitterData.taxId && input.emitterActorId) {
        try {
          const { companiesService } = await import('@core/companies/companies.service');
          // Tentar buscar empresa pelo actor (se houver mapeamento)
          // Por enquanto, usar metadata apenas
        } catch (error) {
          // Não bloquear se busca falhar
        }
      }
    }

    const emitterValidation = validateEmitterFields(regime, emitterData);
    missingFields.push(...emitterValidation.missingFields);

    // 3. Validar comprador (contact) se informado
    let buyerData: {
      taxId?: string | null;
      name?: string | null;
      kycStatus?: 'UNVERIFIED' | 'BASIC_VERIFIED';
    } | null = null;

    if (input.buyerContactId) {
      const buyer = await contactService.getContactById(tenantId, input.buyerContactId);
      if (buyer) {
        buyerData = {
          taxId: buyer.taxId,
          name: buyer.name,
          kycStatus: buyer.kycStatus,
        };
      }
    } else if (input.documentId) {
      // Buscar contact_id do metadata do documento
      const document = await fiscalDocumentRepository.getDocumentById(tenantId, input.documentId);
      if (document?.metadata?.contact_id) {
        const buyer = await contactService.getContactById(tenantId, document.metadata.contact_id);
        if (buyer) {
          buyerData = {
            taxId: buyer.taxId,
            name: buyer.name,
            kycStatus: buyer.kycStatus,
          };
        }
      }
    }

    const buyerValidation = validateBuyerFields(regime, buyerData);
    missingFields.push(...buyerValidation.missingFields);
    warnings.push(...buyerValidation.warnings);

    return {
      canIssue: missingFields.length === 0,
      missingFields,
      warnings,
    };
  }
}

export const fiscalKycService = new FiscalKycService();

// Exportar função helper para uso direto
export async function validateFiscalKyc(
  tenantId: string,
  input: ValidateFiscalKycInput
): Promise<FiscalKycValidationResult> {
  return fiscalKycService.validateFiscalKyc(tenantId, input);
}

