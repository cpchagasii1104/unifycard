// src/core/social/ports/social-repository.port.ts
/**
 * Port: Social Repository
 * 
 * Interface para repository de posts sociais.
 * Implementação real está em @modules/social
 */

export interface PostRow {
  post_id: string;
  tenant_id: string;
  global_user_id: string;
  content: string;
  type: string | null;
  visibility: string | null;
  media: any;
  intent: string | null;
  confidence: number | null;
  categories: string[];
  suggested_actions: any;
  metadata: any;
  event_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface SocialRepositoryPort {
  findById(tenantId: string, postId: string): Promise<PostRow | null>;
  create(data: {
    tenantId: string;
    globalUserId: string;
    content: string;
    type?: string | null;
    visibility?: string | null;
    media: any;
    intent: string | null;
    confidence: number | null;
    categories: string[];
    suggestedActions: any;
    metadata: any;
    eventId?: string | null;
    createdByUserId?: string;
    createdAsActorId?: string;
  }): Promise<PostRow>;
  findFeed(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      categoryId?: string;
      intent?: string;
      userId?: string;
    }
  ): Promise<{ posts: PostRow[]; totalCents: number; hasMore: boolean }>;
}







