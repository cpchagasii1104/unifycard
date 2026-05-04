/**
 * Mapeia `BusinessTemplate.templateId` → recorte de onboarding (department + ramos marketplace).
 * UUIDs alinhados a `20260416110000_marketplace_categories_seed.sql`.
 * Apenas templates com produto industrial via catálogo global (Fase 3); resto → null (só serviços / sem seed global).
 */
export const MARKETPLACE_SEED_CATEGORY_IDS = {
  ALIMENTACAO_DEPT: '11100000-0000-0000-0000-000000000001',
  SAUDE_BELEZA_DEPT: '11100000-0000-0000-0000-000000000002',
  HORTIFRUTI: '11100000-0000-0000-0000-000000000010',
  CARNES_AVES: '11100000-0000-0000-0000-000000000011',
  PADARIA: '11100000-0000-0000-0000-000000000012',
  MERCEARIA: '11100000-0000-0000-0000-000000000013',
  BEBIDAS: '11100000-0000-0000-0000-000000000014',
  LIMPEZA: '11100000-0000-0000-0000-000000000015',
  MEDICAMENTOS: '11100000-0000-0000-0000-000000000020',
  HIGIENE: '11100000-0000-0000-0000-000000000021',
  COSMETICOS: '11100000-0000-0000-0000-000000000022',
} as const;

export function getStoreOnboardingCategoryPlanForBusinessTemplate(
  businessTemplateId: string
): { departmentCategoryId: string; selectedCategoryIds: string[] } | null {
  switch (businessTemplateId) {
    case 'supermarket':
      return {
        departmentCategoryId: MARKETPLACE_SEED_CATEGORY_IDS.ALIMENTACAO_DEPT,
        selectedCategoryIds: [
          MARKETPLACE_SEED_CATEGORY_IDS.HORTIFRUTI,
          MARKETPLACE_SEED_CATEGORY_IDS.CARNES_AVES,
          MARKETPLACE_SEED_CATEGORY_IDS.PADARIA,
          MARKETPLACE_SEED_CATEGORY_IDS.MERCEARIA,
          MARKETPLACE_SEED_CATEGORY_IDS.BEBIDAS,
          MARKETPLACE_SEED_CATEGORY_IDS.LIMPEZA,
        ],
      };
    case 'pharmacy':
      return {
        departmentCategoryId: MARKETPLACE_SEED_CATEGORY_IDS.SAUDE_BELEZA_DEPT,
        selectedCategoryIds: [
          MARKETPLACE_SEED_CATEGORY_IDS.MEDICAMENTOS,
          MARKETPLACE_SEED_CATEGORY_IDS.HIGIENE,
          MARKETPLACE_SEED_CATEGORY_IDS.COSMETICOS,
        ],
      };
    case 'beverage_distributor':
      return {
        departmentCategoryId: MARKETPLACE_SEED_CATEGORY_IDS.ALIMENTACAO_DEPT,
        selectedCategoryIds: [MARKETPLACE_SEED_CATEGORY_IDS.BEBIDAS],
      };
    default:
      return null;
  }
}