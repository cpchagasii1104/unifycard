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
