// backend/src/core/authorization/permission-keys.ts
// CONTINUOUS PRODUCTION: Permission Keys Canonical Enum
//
// ⚠️ DOCUMENTO CONSTITUCIONAL - NÃO MODIFICAR SEM ATUALIZAR O MAPA
//
// Fonte de verdade: MAPA_CANONICO_PERMISSIONS_v1.md
// Versão do mapa: v1.7
// Data do mapa: 12 de Janeiro de 2026 (v1.0), XX de Janeiro de 2026 (v1.1), XX de Janeiro de 2026 (v1.2), XX de Janeiro de 2026 (v1.3), XX de Janeiro de 2026 (v1.4), XX de Janeiro de 2026 (v1.5)
// Status: v1.7 (DECISION-0189 — vocabulário de governança empresarial + errata create_events)
//
// REGRA ABSOLUTA:
// - Este enum DEVE conter EXATAMENTE as permissions do mapa
// - Nenhuma permission pode ser adicionada sem atualizar o mapa primeiro
// - Nenhuma permission pode ser removida sem atualizar o mapa primeiro
// - Qualquer divergência é erro arquitetural estrutural

/**
 * Permission Keys v1.7
 *
 * Derivado de MAPA_CANONICO_PERMISSIONS_v1.md + DECISION-0189 (governança empresarial)
 * Total: 80 permissions (contagem REAL do union — o '62' histórico estava stale; auditado na F6 da DECISION-0189)
 *
 * Distribuição por domínio:
 * - feed: 2 permissions
 * - bank: 13 permissions (3 originais + 10 novas: financial_terms, split, financial, calendar)
 * - events: 3 permissions
 * - groups: 3 permissions
 * - services: 17 permissions (2 originais + 15 novas: service_order, rfq, quote, bundle)
 * - rides: 3 permissions
 * - companies: 5 permissions (delegate + 4 novas DECISION-0189: company:manage_governance, company:manage_employees, company:manage_services, company:view_reports)
 * - votes: 2 permissions
 * - institutional: 5 permissions (1 original + 4 novas: admin:view_regional_fund, admin:view_consolidated_balance, admin:view_fund_reports, admin:view_audit_logs)
 * - marketplace: 14 permissions (10 originais + 4 novas: MARKETPLACE_STORE_CREATE, MARKETPLACE_STORE_VIEW, MY_ORDERS_VIEW, canonical_products:create)
 * - reports: 3 permissions (1 original + 2 novas: reports:view_operational, dashboard:view)
 */
export type PermissionKey =
  // FEED (Social)
  | 'publish_feed'
  | 'moderate_feed'
  
  // BANK (Financial)
  | 'manage_financial'
  | 'receive_funds'
  | 'view_financial'
  | 'financial_terms:view'
  | 'financial_terms:confirm'
  | 'split:view'
  | 'split:create'
  | 'financial:execute_payout'
  | 'financial:view_ledger'
  | 'financial:view_all_ledger'
  | 'calendar:view'
  | 'calendar:block'
  | 'calendar:unblock'
  
  // EVENTS (Events)
  | 'create_events'
  | 'manage_events'
  | 'manage_attendees'
  
  // GROUPS (Groups)
  | 'create_groups'
  | 'manage_groups'
  | 'manage_members'
  
  // SERVICES (Services)
  | 'offer_services'
  | 'manage_bookings'
  | 'service_order:create'
  | 'service_order:view'
  | 'service_order:confirm'
  | 'service_order:start'
  | 'service_order:complete'
  | 'service_order:cancel'
  | 'service_order:confirm_completion'
  // Serviços (catálogo de serviço do actor/empresa). Registradas no SSOT vivo para alinhar a allowlist
  // defensiva de actor_capability_grants (DECISION-0136 W1). Vocabulário apenas — sem enforcement aqui.
  | 'services:create'
  | 'services:edit'
  | 'services:disable'
  | 'rfq:create'
  | 'rfq:view'
  | 'rfq:close'
  | 'rfq:convert'
  | 'quote:submit'
  | 'quote:view'
  | 'bundle:create'
  | 'bundle:view'
  | 'bundle:confirm'
  
  // RIDES (Rides)
  | 'request_ride'
  | 'accept_ride'
  | 'manage_ride'
  
  // COMPANIES (Companies)
  | 'delegate'
  // DECISION-0189 v1.7 — vocabulário de governança empresarial. Tríade completa (chave ×
  // actor capability × subject grant em company_users) vive no COMPANY_POLICY_REGISTRY
  // (company-policy-registry.ts); aqui só o vocabulário. Nenhuma delas cai em ownership.
  | 'company:manage_governance'
  | 'company:manage_employees'
  | 'company:manage_services'
  | 'company:view_reports'

  // VOTES (Votes)
  | 'create_vote'
  | 'cast_vote'
  
  // INSTITUTIONAL (Institucional)
  | 'invite_pilot_user'
  | 'admin:view_regional_fund'
  | 'admin:view_consolidated_balance'
  | 'admin:view_fund_reports'
  | 'admin:view_audit_logs'
  
  // MARKETPLACE (Marketplace)
  | 'marketplace_manage_catalog'
  | 'marketplace_manage_products'
  | 'marketplace_manage_inventory'
  | 'marketplace_manage_orders'
  | 'marketplace_execute_payments'
  | 'marketplace_manage_splits'
  | 'marketplace_execute_payouts'
  | 'marketplace_pdv_sell'
  | 'marketplace_pdv_manage_customers'
  | 'marketplace_pdv_view_customers'
  | 'MARKETPLACE_STORE_CREATE'
  | 'MARKETPLACE_STORE_VIEW'
  | 'MY_ORDERS_VIEW'
  | 'canonical_products:create'
  
  // REPORTS (Reports)
  | 'view_consolidated_reports'
  | 'reports:view_operational'
  | 'dashboard:view'

  // TERRITORY (F-NEIGHBORHOOD-CANONICAL-IDENTITY N2-D.2, DECISION-0173 §4 + ADENDO D3). Vocabulário
  // p/ actor_capability_grants scope_type='territory'; SEM enforcement aqui (matriz scope-aware vive
  // no CHECK físico + types.ts da casa de grants). Match exato; sem wildcard/implicação automática.
  | 'territory:create_neighborhood'
  | 'territory:approve_neighborhood'
  | 'territory:correct_neighborhood'
  | 'territory:deactivate_neighborhood'
  | 'territory:manage_neighborhood_aliases'
  | 'territory:register_neighborhood_succession';

/**
 * Mapa de capabilities requeridas por permission
 * 
 * Derivado de MAPA_CANONICO_PERMISSIONS_v1.md - Seção "CAPABILITIES MAPEADAS"
 * 
 * Valores:
 * - string: capability requerida (deve existir no actor_registry)
 * - null: ownership/delegação suficiente (não requer capability específica)
 */
export const PERMISSION_CAPABILITIES: Record<PermissionKey, string | null> = {
  // FEED
  publish_feed: 'can_publish_feed',
  moderate_feed: 'can_moderate_content',
  
  // BANK
  manage_financial: 'can_hold_assets',
  receive_funds: 'can_receive_funds',
  view_financial: null, // ownership suficiente
  'financial_terms:view': null, // ownership suficiente
  'financial_terms:confirm': 'can_hold_assets',
  'split:view': null, // ownership suficiente
  'split:create': 'can_hold_assets',
  'financial:execute_payout': 'can_hold_assets',
  'financial:view_ledger': null, // ownership suficiente
  'financial:view_all_ledger': null, // atribuição manual apenas
  'calendar:view': null, // ownership suficiente
  'calendar:block': null, // ownership suficiente
  'calendar:unblock': null, // ownership suficiente
  
  // EVENTS
  // DECISION-0189 (errata R10): create_events exige a capability PRÓPRIA can_create_events
  // (antes: can_publish_feed — aliasing). Todos os registry-rows de company em dev carregam
  // can_create_events=true (default de tipo desde sempre) — errata sem regressão material.
  create_events: 'can_create_events',
  manage_events: null, // ownership suficiente
  manage_attendees: null, // ownership suficiente
  
  // GROUPS
  create_groups: 'can_publish_feed',
  manage_groups: null, // ownership + admin role
  manage_members: 'can_delegate',
  
  // SERVICES
  offer_services: 'can_publish_feed', // simplificado (mapa diz: can_publish_feed + can_receive_funds)
  manage_bookings: null, // ownership suficiente
  'service_order:create': null, // ownership suficiente
  'service_order:view': null, // ownership suficiente
  'service_order:confirm': null, // ownership suficiente
  'service_order:start': null, // ownership suficiente
  'service_order:complete': null, // ownership suficiente
  'service_order:cancel': null, // ownership suficiente
  'service_order:confirm_completion': null, // ownership suficiente (buyer confirma conclusão — D2; regulariza chave já referenciada no service)
  'services:create': null, // ownership suficiente (vocabulário p/ actor_capability_grants — DECISION-0136 W1; sem enforcement aqui)
  'services:edit': null, // ownership suficiente
  'services:disable': null, // ownership suficiente
  'rfq:create': null, // ownership suficiente
  'rfq:view': null, // ownership suficiente
  'rfq:close': null, // ownership suficiente
  'rfq:convert': null, // ownership suficiente
  'quote:submit': null, // ownership suficiente
  'quote:view': null, // ownership suficiente
  'bundle:create': null, // ownership suficiente
  'bundle:view': null, // ownership suficiente
  'bundle:confirm': null, // ownership suficiente
  
  // RIDES
  request_ride: null, // ação básica
  accept_ride: 'can_receive_funds',
  manage_ride: null, // ownership suficiente
  
  // COMPANIES
  delegate: 'can_delegate',
  // DECISION-0189 — governança empresarial: a autoridade vem do SUBJECT GRANT em company_users
  // (resolvido pelo COMPANY_POLICY_REGISTRY), não de capability de registry (null aqui).
  'company:manage_governance': null,
  'company:manage_employees': null,
  'company:manage_services': null,
  'company:view_reports': null,
  
  // VOTES
  create_vote: null, // ownership de grupo/evento
  cast_vote: null, // membership suficiente
  
  // INSTITUTIONAL
  invite_pilot_user: null, // atribuição manual apenas
  'admin:view_regional_fund': null, // atribuição manual apenas
  'admin:view_consolidated_balance': null, // atribuição manual apenas
  'admin:view_fund_reports': null, // atribuição manual apenas
  'admin:view_audit_logs': null, // atribuição manual apenas
  
  // MARKETPLACE — capabilities via `actor_registry.capabilities_json` (enforcement em `authorization.service`)
  marketplace_manage_catalog: 'can_manage_marketplace',
  marketplace_manage_products: 'can_manage_marketplace',
  marketplace_manage_inventory: 'can_manage_marketplace',
  marketplace_manage_orders: 'can_manage_marketplace',
  marketplace_execute_payments: 'can_hold_assets',
  marketplace_manage_splits: 'can_manage_marketplace',
  marketplace_execute_payouts: 'can_hold_assets',
  marketplace_pdv_sell: 'can_manage_marketplace',
  marketplace_pdv_manage_customers: 'can_manage_marketplace',
  marketplace_pdv_view_customers: 'can_manage_marketplace',
  MARKETPLACE_STORE_CREATE: 'can_manage_marketplace',
  MARKETPLACE_STORE_VIEW: 'can_manage_marketplace',
  MY_ORDERS_VIEW: 'can_manage_marketplace',
  'canonical_products:create': 'can_manage_marketplace',
  
  // REPORTS
  view_consolidated_reports: null, // atribuição manual apenas
  'reports:view_operational': null, // ownership suficiente
  'dashboard:view': null, // ownership suficiente

  // TERRITORY — vocabulário p/ actor_capability_grants (DECISION-0173 N2-D.2); sem enforcement aqui.
  'territory:create_neighborhood': null,
  'territory:approve_neighborhood': null,
  'territory:correct_neighborhood': null,
  'territory:deactivate_neighborhood': null,
  'territory:manage_neighborhood_aliases': null,
  'territory:register_neighborhood_succession': null,
};

/**
 * Valida se uma string é uma permission válida
 * 
 * @param key - String a validar
 * @returns true se é permission válida, false caso contrário
 */
export function isValidPermissionKey(key: string): key is PermissionKey {
  return key in PERMISSION_CAPABILITIES;
}

/**
 * Lista todas as permissions válidas
 * 
 * @returns Array com todas as permissions do mapa v1.6
 */
export function getAllPermissionKeys(): PermissionKey[] {
  return Object.keys(PERMISSION_CAPABILITIES) as PermissionKey[];
}

/**
 * Permissões cujo prefixo / chave exige entrada não-nula em {@link PERMISSION_CAPABILITIES}
 * (falha de boot se o mapa estiver `null` — evita incidente em produção por esquecimento).
 */
function permissionRequiresRegistryCapabilityDeclaration(permission: PermissionKey): boolean {
  if (permission.startsWith('marketplace_')) {
    return true;
  }
  if (permission.startsWith('MARKETPLACE_')) {
    return true;
  }
  if (permission === 'canonical_products:create') {
    return true;
  }
  return false;
}

const REGISTRY_CAPABILITY_KEY = /^[a-z][a-z0-9_]*$/;

/**
 * Boot-time: prefixos sensíveis marketplace devem ter capability string mapeada e chave canónica.
 */
export function assertSensitivePermissionsHaveCapabilityMapping(): void {
  for (const permission of getAllPermissionKeys()) {
    if (!permissionRequiresRegistryCapabilityDeclaration(permission)) {
      continue;
    }
    const cap = PERMISSION_CAPABILITIES[permission];
    if (cap === null || cap === undefined || cap === '') {
      throw new Error(
        `[AUTH CONFIG ERROR] Permission "${permission}" exige capability mapeada (governança marketplace) mas PERMISSION_CAPABILITIES está vazia ou null`
      );
    }
    if (!REGISTRY_CAPABILITY_KEY.test(cap)) {
      throw new Error(
        `[AUTH CONFIG ERROR] Permission "${permission}" → capability "${cap}" com formato inválido (esperado snake_case)`
      );
    }
  }
}
