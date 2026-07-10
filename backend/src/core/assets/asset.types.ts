// backend/src/core/assets/asset.types.ts
// F-ASSET-MULTI-OFFER-FOUNDATION — Fatia 1 (fundação). Vocabulário GOVERNADO dos MODOS de ativação de um
// item real do actor (actor_assets). MODO = ativação econômica/operacional; NÃO é estado/disponibilidade.
// v1 = sale/rental/service_use. NÃO inclui internal/maintenance/reserved (estado do item / camada de
// disponibilidade — ausência de modo ativo = item interno/não publicado). Ver
// docs/02_decisions/RFC_ASSET_MULTI_OFFER_FOUNDATION.md. CHECK das tabelas compõe daqui (manifest
// assets.activation_mode). service_use listado, mas EXECUTÁVEL só com vínculo governado a serviço/
// prestador (fatia própria) — invariante §5-BIS.
export const ASSET_ACTIVATION_MODES = ['sale', 'rental', 'service_use'] as const;
export type AssetActivationMode = (typeof ASSET_ACTIVATION_MODES)[number];

// Status/lifecycle do ITEM (SEPARADO dos modos — nunca misturar). Estado ≠ ativação.
export const ASSET_STATUSES = ['active', 'inactive', 'archived'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

// F-ASSET-CONDITION-AND-RENTAL-MINIMUMS (adendo D1): CONDIÇÃO do item real (novo/usado) — característica da
// UNIDADE física, compartilhada por sale/rental/service_use. NÃO é status/lifecycle, NÃO é modo, NÃO é
// categoria, NÃO é disponibilidade. NULL permitido na v1 (não presumir; sem default). refurbished/
// reconditioned/damaged/open_box/other FORA da v1 (só por decisão própria futura, nunca balde). CHECK físico
// de actor_assets.condition compõe daqui; manifest 'actor_assets.condition'.
export const ASSET_CONDITIONS = ['new', 'used'] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 3 (adendo D-ε): STATUS da oferta de VENDA (actor_asset_sale_terms).
// v1 = active/paused APENAS. Estados de EXECUÇÃO (venda concluída / item transferido / pagamento liquidado)
// ficam FORA da v1 (implicam execução/transferência — D-γ). Status da VENDA ≠ status do ITEM (actor_assets.status=lifecycle) ≠ MODO
// (actor_asset_modes.activation_mode='sale'). CHECK físico de actor_asset_sale_terms.status compõe daqui;
// manifest 'actor_asset_sale_terms.status'.
export const ASSET_SALE_STATUSES = ['active', 'paused'] as const;
export type AssetSaleStatus = (typeof ASSET_SALE_STATUSES)[number];

// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B (adendo RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO, D-F): vocabulário
// v1 de ARRANJO OPERACIONAL do vínculo asset+serviço+operador (actor_asset_service_usages). Anúncio/termo —
// NÃO cobrança/ledger/Bank. Mobilidade/equipamentos exigirão suporte FUTURO (mínimo garantido, excedente por
// km/hora, política de combustível/responsabilidade) — fora da v1 (D-M). CHECK físico de
// actor_asset_service_usages.arrangement_type compõe daqui; manifest 'actor_asset_service_usages.arrangement_type'.
export const OPERATIONAL_ARRANGEMENTS = ['daily_fee', 'shift_fee', 'fixed_fee', 'commission', 'revenue_share'] as const;
export type OperationalArrangement = (typeof OPERATIONAL_ARRANGEMENTS)[number];

// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B (D-E, v1 declarativa): STATUS do vínculo de uso operacional. v1 =
// active/paused APENAS — mesmo padrão de ASSET_SALE_STATUSES. Execução/booking/pagamento/split FORA da v1
// (D-E). CHECK físico de actor_asset_service_usages.status compõe daqui; manifest
// 'actor_asset_service_usages.status'.
export const ASSET_SERVICE_USE_STATUSES = ['active', 'paused'] as const;
export type AssetServiceUseStatus = (typeof ASSET_SERVICE_USE_STATUSES)[number];
