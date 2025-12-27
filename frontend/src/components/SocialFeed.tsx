// src/components/SocialFeed.tsx
// Feed de rede social com integração de serviços (agendar e pagar)

import { useState, useEffect } from 'react';
import { getSocialFeed, createSocialPost, type PostCardData, type CreatePostPayload } from '../api/social';
import { useActiveActor } from '../contexts/ActiveActorContext';
import ServicePostCard from './ServicePostCard';
import './SocialFeed.css';

export default function SocialFeed() {
  const { activeActor, isLoading: actorsLoading } = useActiveActor();
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (activeActor && !actorsLoading) {
      loadFeed();
    }
  }, [activeActor?.actor_id, actorsLoading]);

  const loadFeed = async () => {
    if (!activeActor) {
      setIsLoading(false);
      setError('Você precisa estar logado para ver o feed.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await getSocialFeed({ 
        limit: 20,
        actor_type: activeActor.actor_type as 'user' | 'page',
        actor_id: activeActor.actor_id,
        actor_status: activeActor.company_status,
      });
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar feed');
      console.error('Erro ao carregar feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    setIsCreating(true);
    try {
      const input: CreatePostPayload = {
        content: newPostContent.trim(),
      };
      const newPost = await createSocialPost(input);
      setPosts([newPost, ...posts]);
      setNewPostContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar post');
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="social-feed">
        <div className="loading">Carregando feed...</div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="social-feed">
        <div className="error">Erro: {error}</div>
        <button onClick={loadFeed} className="retry-button">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="social-feed">
      <header className="feed-header">
        <h1>Rede Social</h1>
      </header>

      <main className="feed-main">
        {/* Formulário de novo post */}
        <section className="create-post-section">
          <form onSubmit={handleCreatePost} className="create-post-form">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="O que você está pensando?"
              className="post-input"
              rows={3}
              disabled={isCreating}
            />
            <button
              type="submit"
              disabled={isCreating || !newPostContent.trim()}
              className="create-post-button"
            >
              {isCreating ? 'Publicando...' : 'Publicar'}
            </button>
          </form>
        </section>

        {/* Feed de posts */}
        <section className="posts-section">
          {posts.length === 0 ? (
            <div className="no-posts">
              <p>Nenhum post ainda. Seja o primeiro a publicar!</p>
            </div>
          ) : (
            <div className="posts-list">
              {posts.map((post) => (
                <article key={post.post_id} className="post-card">
                  <div className="post-header">
                    <div className="post-author">
                      <span className="author-id">{post.actor?.display_name || `Usuário ${post.post_id.substring(0, 8)}`}</span>
                    </div>
                    <time className="post-date">{formatDate(post.created_at)}</time>
                  </div>
                  <div className="post-content">{post.content}</div>
                  
                  {/* Exibir informações de serviço se for post de serviço */}
                  {post.intent === 'service_offer' && post.cta && (
                    <ServicePostCard
                      post={post}
                      onScheduleSuccess={loadFeed}
                      onPaymentSuccess={loadFeed}
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

