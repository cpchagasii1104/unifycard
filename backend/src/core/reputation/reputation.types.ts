// backend/src/core/reputation/reputation.types.ts

export interface ReputationRow {
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  entity_global_user_id: string | null;
  global_score: string;
  rating_count: number;
  last_ratingAt: string | null;
  quality_score: string | null;
  punctuality_score: string | null;
  professionalism_score: string | null;
  updatedAt: string;
}

export interface ReputationScore {
  tenantId: string;
  entityType: string;
  entityId: string;
  entityGlobalUserId?: string | null;
  globalScore: number;
  ratingCount: number;
  lastRatingAt?: string;
  qualityScore?: number;
  punctualityScore?: number;
  professionalismScore?: number;
  updatedAt: string;
}

export interface ReviewCreatedEventPayload {
  reviewId: string;
  entityType: string;
  entityId: string;
  authorUserId: string;
  rating: number;
  qualityRating?: number;
  punctualityRating?: number;
  professionalismRating?: number;
  sourceModule: string;
}

