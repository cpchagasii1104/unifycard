// backend/src/modules/social/social-marketplace-ref.types.ts
// SPRINT 47: SOCIAL COMO PLUGIN TRANSACIONAL DO MARKETPLACE

export type SocialMarketplaceRefType = 'PRODUCT' | 'ORDER' | 'CAMPAIGN';

export interface SocialMarketplaceRef {
  id: string;
  tenantId: string;
  postId: string;
  refType: SocialMarketplaceRefType;
  refId: string;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateSocialMarketplaceRefInput {
  postId: string;
  refType: SocialMarketplaceRefType;
  refId: string;
  metadata?: Record<string, any>;
}

export interface SocialMarketplaceRefWithDetails {
  ref: SocialMarketplaceRef;
  details: {
    type: SocialMarketplaceRefType;
    id: string;
    name: string;
    status?: string;
    link: string;
  };
}







