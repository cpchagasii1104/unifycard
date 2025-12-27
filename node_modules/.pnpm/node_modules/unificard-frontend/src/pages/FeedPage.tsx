// src/pages/FeedPage.tsx
// Feed com eventos integrados (read-only)
import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';
import EventCard from '../components/events/EventCard';
import './FeedPage.css';

export interface FeedPost {
  postId: string;
  content: string;
  type: string;
  createdAt: string;
  eventId?: string | null;
  event?: {
    id: string;
    title: string;
    eventType: string;
    startTime: string;
    endTime: string | null;
    cityId: string | null;
    ticketPrice: number | null;
    acceptsConsumption: boolean;
    status: string;
  } | null;
  globalUserId: string;
  media: any[];
  metadata: Record<string, any>;
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/feed?limit=50');
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar feed');
      console.error('Erro ao carregar feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigateToEvent = (eventId: string) => {
    // Navegação simples (pode ser ajustada para react-router)
    window.location.href = `/events/${eventId}`;
  };

  if (isLoading) {
    return (
      <div className="feed-page">
        <div className="feed-page-loading">Carregando feed...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feed-page">
        <div className="feed-page-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="feed-page">
      <h1 className="feed-page-title">Feed</h1>
      <div className="feed-page-content">
        {posts.map((post) => {
          // Se post tem evento vinculado, renderiza EventCard
          if (post.eventId && post.event) {
            return (
              <EventCard
                key={post.postId}
                eventId={post.event.id}
                title={post.event.title}
                eventType={post.event.eventType}
                cityId={post.event.cityId}
                status={post.event.status}
                ticketPrice={post.event.ticketPrice}
                acceptsConsumption={post.event.acceptsConsumption}
                onClick={() => handleNavigateToEvent(post.event!.id)}
              />
            );
          }

          // Caso contrário, renderiza PostCard normal
          // (Nota: PostCard atual pode precisar de adaptação para o formato FeedPost)
          return (
            <div key={post.postId} className="feed-post-card">
              <div className="feed-post-content">{post.content}</div>
              <div className="feed-post-date">
                {new Date(post.createdAt).toLocaleDateString()}
              </div>
            </div>
          );
        })}

        {posts.length === 0 && (
          <div className="feed-page-empty">Nenhum post encontrado</div>
        )}
      </div>
    </div>
  );
}
















