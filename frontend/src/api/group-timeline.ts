// frontend/src/api/group-timeline.ts
// API Client para Group Timeline
// SPRINT: Groups MVP
// Nota: Como não há endpoint específico, consolidamos dados do feed, eventos e votações

import { apiFetch } from './client';
import { getFeed } from './social-2.0';
import { listGroupVotes } from './group-votes';

export type TimelineItemType = 'event' | 'campaign' | 'vote' | 'post' | 'finance' | 'milestone';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  description?: string | null;
  date: string; // ISO 8601
  actorId?: string;
  actorName?: string;
  relatedId?: string;
  metadata?: Record<string, any>;
}

/**
 * Obter timeline do grupo (consolida feed, eventos, votações)
 */
export async function getGroupTimeline(
  groupId: string,
  limit: number = 50,
  actorType: 'user' | 'page' = 'user',
  actorId: string = ''
): Promise<TimelineItem[]> {
  const items: TimelineItem[] = [];

  try {
    // 1. Buscar posts do feed do grupo
    // getFeed(cursor, limit, groupId, actorType, actorId)
    const feed = await getFeed(undefined, limit, groupId, actorType, actorId);
    for (const post of feed.posts) {
      items.push({
        id: post.post_id,
        type: 'post',
        title: post.content.substring(0, 100),
        description: post.content,
        date: post.created_at,
        actorId: post.actor?.actor_id,
        actorName: post.actor?.display_name,
        metadata: {
          reactionsCount: post.reactions_count || 0,
          commentsCount: post.comments_count || 0,
        },
      });
    }

    // 2. Buscar votações do grupo
    const votes = await listGroupVotes(groupId);
    for (const vote of votes) {
      items.push({
        id: vote.voteId,
        type: 'vote',
        title: vote.title,
        description: vote.description,
        date: vote.createdAt,
        metadata: {
          status: vote.status,
          totalVotes: vote.totalVotes || 0,
          closesAt: vote.closesAt,
        },
      });
    }

    // 3. Ordenar por data (mais recente primeiro)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 4. Limitar quantidade
    return items.slice(0, limit);
  } catch (err) {
    console.error('Erro ao construir timeline:', err);
    throw err;
  }
}

