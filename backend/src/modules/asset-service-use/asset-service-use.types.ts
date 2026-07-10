// backend/src/modules/asset-service-use/asset-service-use.types.ts
// F-ASSET-MULTI-OFFER-FOUNDATION Fatia 4B — SERVICE_USE / uso operacional (adendo
// RFC_ASSET_SERVICE_USE_OPERATIONAL_ADENDO, D-A..D-G). Vínculo GOVERNADO entre o item real (actor_assets),
// um serviço/capacidade (concept com offer_kind='service') e um operador habilitado. NÃO é oferta solta do
// item (isso é rental) nem transferência (isso é sale). Substrato mínimo: v1 = SÓ dono-operador
// (terceiro-operador/release fica para a Fatia 4C, D-D). Δbank=0.

import type { OperationalArrangement, AssetServiceUseStatus } from '@core/assets/asset.types';
export type { OperationalArrangement, AssetServiceUseStatus };

export interface AssetServiceUsage {
  id: string;
  assetId: string;
  ownerActorId: string;
  assetConceptId: string;
  assetLabel: string;
  serviceConceptId: string;
  operatorActorId: string;
  arrangementType: OperationalArrangement;
  status: AssetServiceUseStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetServiceUsageInput {
  assetId: string; // item JÁ existente — Fatia 4B NÃO cadastra item novo aqui (isso é Fatia 1/asset-sale/rental).
  serviceConceptId: string; // concept com offer_kind='service' (enforcement material via FK composta).
  arrangementType: OperationalArrangement;
}
