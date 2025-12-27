// src/modules/social/social.model.ts
import type { Post, PostRow, MediaItem, SuggestedAction, ServiceInfo } from './social.types';

export class SocialModel {
  static fromRow(row: PostRow): Post {
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    
    // Extrair serviceInfo do metadata se existir
    let serviceInfo: ServiceInfo | undefined;
    let isServicePost = false;
    
    if (metadata.isServicePost && metadata.serviceInfo) {
      isServicePost = true;
      serviceInfo = {
        categoryId: metadata.serviceInfo.categoryId,
        categoryName: metadata.serviceInfo.categoryName,
        price: metadata.serviceInfo.price,
        pricingType: metadata.serviceInfo.pricingType,
        currency: metadata.serviceInfo.currency || 'BRL',
        description: metadata.serviceInfo.description,
        duration: metadata.serviceInfo.duration,
        requiresSchedule: metadata.serviceInfo.requiresSchedule !== false,
        requiresPayment: metadata.serviceInfo.requiresPayment || false,
      };
    }
    
    return {
      postId: row.post_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      content: row.content,
      type: (row.type as any) || 'TEXT',
      visibility: (row.visibility as any) || 'PUBLIC',
      media: Array.isArray(row.media) ? row.media : [],
      intent: row.intent ?? undefined,
      confidence: row.confidence ?? undefined,
      categories: Array.isArray(row.categories) ? row.categories : [],
      suggestedActions: Array.isArray(row.suggested_actions) ? row.suggested_actions : [],
      metadata,
      jobId: metadata.jobId || undefined, // Extrair jobId do metadata
      eventId: row.event_id || undefined,
      serviceInfo,
      isServicePost,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static fromRows(rows: PostRow[]): Post[] {
    return rows.map((row) => this.fromRow(row));
  }

  static toRow(post: Partial<Post>): Partial<PostRow> {
    const row: Partial<PostRow> = {};

    if (post.postId !== undefined) row.post_id = post.postId;
    if (post.tenantId !== undefined) row.tenant_id = post.tenantId;
    if (post.globalUserId !== undefined) row.global_user_id = post.globalUserId;
    if (post.content !== undefined) row.content = post.content;
    if (post.media !== undefined) row.media = post.media;
    if (post.intent !== undefined) row.intent = post.intent ?? null;
    if (post.confidence !== undefined) row.confidence = post.confidence ?? null;
    if (post.categories !== undefined) row.categories = post.categories;
    if (post.suggestedActions !== undefined) row.suggested_actions = post.suggestedActions;
    if (post.metadata !== undefined) row.metadata = post.metadata;

    return row;
  }
}

