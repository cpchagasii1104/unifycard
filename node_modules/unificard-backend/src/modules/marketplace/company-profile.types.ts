// backend/src/modules/marketplace/company-profile.types.ts
// SPRINT 75: PERFIS ERP + REGIME TRIBUTÁRIO

/**
 * Perfil ERP
 */
export type ErpProfile = 'COMMERCE' | 'SERVICE' | 'EVENTS' | 'FOOD' | 'CLINIC';

/**
 * Regime tributário
 */
export type TaxRegime = 'MEI' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';

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
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input para definir perfil
 */
export interface SetCompanyProfileInput {
  erpProfile: ErpProfile;
  taxRegime: TaxRegime;
  metadata?: Record<string, any>;
}






