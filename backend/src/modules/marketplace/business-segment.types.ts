// backend/src/modules/marketplace/business-segment.types.ts
// SPRINT 81: ERP POR SEGMENTO (PERFIS OPERACIONAIS)

/**
 * Tipo de segmento de negócio
 */
export type BusinessSegmentType = 'COMMERCE' | 'CLINIC' | 'SALON' | 'BAR_RESTAURANT' | 'SERVICES';

/**
 * Chaves de módulos disponíveis
 */
export type ModuleKey = 
  | 'pdv'
  | 'inventory'
  | 'service_orders'
  | 'events'
  | 'tickets'
  | 'marketplace'
  | 'calendar'
  | 'reports';

/**
 * Segmento de negócio
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Segmento ≠ permissão
 * - Segmento ≠ papel
 * - Segmento define:
 *   - Módulos visíveis
 *   - Fluxos esperados
 * - Nenhuma lógica automática
 * - Apenas configuração estrutural
 */
export interface BusinessSegment {
  id: string;
  tenantId: string;
  companyProfileTenantId: string;
  segmentType: BusinessSegmentType;
  enabledModules: ModuleKey[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar/atualizar segmento
 */
export interface SetBusinessSegmentInput {
  segmentType: BusinessSegmentType;
  enabledModules?: ModuleKey[];
  metadata?: Record<string, any>;
}

/**
 * Módulos sugeridos por segmento (apenas orientação)
 */
export const SUGGESTED_MODULES_BY_SEGMENT: Record<BusinessSegmentType, ModuleKey[]> = {
  COMMERCE: ['pdv', 'inventory', 'marketplace', 'reports'],
  CLINIC: ['service_orders', 'calendar', 'reports'],
  SALON: ['service_orders', 'calendar', 'reports'],
  BAR_RESTAURANT: ['pdv', 'events', 'tickets', 'reports'],
  SERVICES: ['service_orders', 'calendar', 'marketplace', 'reports'],
};






