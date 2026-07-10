// backend/src/modules/marketplace/company-profile.types.ts
// SPRINT 75: PERFIS ERP + REGIME TRIBUTÁRIO

/**
 * Perfil ERP
 */
export type ErpProfile = 'COMMERCE' | 'SERVICE' | 'EVENTS' | 'FOOD' | 'CLINIC';

/**
 * Regime tributário — CONVERGIDO para o vocabulário canônico (DECISION-0166 D9.5, Fase 4b).
 * O union local ('MEI'|'LUCRO_PRESUMIDO'|'LUCRO_REAL', SEM Simples Nacional) era uma segunda
 * verdade de vocabulário — re-export do único TaxRegime do sistema. NÃO redeclarar aqui.
 */
export type { TaxRegime } from '../fiscal/fiscal-profile.types';
import type { TaxRegime } from '../fiscal/fiscal-profile.types';

/**
 * Perfil da empresa
 */
export interface CompanyProfile {
  tenantId: string;
  erpProfile: ErpProfile;
  taxRegime: TaxRegime;
  createdByActorId: string;
  createdByUserId: string | null;
  updatedByActorId: string | null;
  updatedByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para definir perfil
 */
export interface SetCompanyProfileInput {
  erpProfile: ErpProfile;
  taxRegime: TaxRegime;
  metadata?: Record<string, any>;
}







