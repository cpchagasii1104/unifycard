// src/pages/ServicosPage.tsx
// Tela de Serviços Disponíveis - lista ofertas de serviço do feed

import { useState, useEffect } from 'react';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { getSocialFeed, type PostCardData } from '../api/social';
import PostCard from '../components/social/PostCard';
import { toggleReaction, createComment } from '../api/social';
import './ServicosPage.css';

export default function ServicosPage() {
  const { activeActor, isLoading: actorsLoading } = useActiveActor();
  const [services, setServices] = useState<PostCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeActor && !actorsLoading) {
      loadServices();
    }
  }, [activeActor?.actor_id, actorsLoading]);

  const loadServices = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Buscar feed social e filtrar apenas serviços
      const data = await getSocialFeed({
        limit: 50, // Buscar mais para ter mais serviços
        actor_type: activeActor.actor_type as 'user' | 'page',
        actor_id: activeActor.actor_id,
        actor_status: activeActor.company_status,
      });

      // Filtrar apenas posts com intent = service_offer
      const servicePosts = data.posts.filter(
        (post) => post.intent === 'service_offer'
      );

      setServices(servicePosts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar serviços');
      console.error('Erro ao carregar serviços:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      const queryParams = new URLSearchParams();
      if (activeActor) {
        queryParams.append('actor_id', activeActor.actor_id);
        queryParams.append('actor_type', activeActor.actor_type);
      }

      await toggleReaction(
        postId,
        reactionType as 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry',
        queryParams.toString()
      );

      // Atualizar post localmente
      setServices((prev) =>
        prev.map((post) => {
          if (post.post_id === postId) {
            const wasLiked = post.user_reaction === reactionType;
            return {
              ...post,
              user_reaction: wasLiked ? null : reactionType,
              reactions_count: wasLiked
                ? post.reactions_count - 1
                : post.reactions_count + (post.user_reaction ? 0 : 1),
            };
          }
          return post;
        })
      );
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao reagir');
    }
  };

  const handleComment = async (postId: string, content: string) => {
    try {
      await createComment(postId, { content });

      // Atualizar contador de comentários
      setServices((prev) =>
        prev.map((post) => {
          if (post.post_id === postId) {
            return {
              ...post,
              comments_count: post.comments_count + 1,
            };
          }
          return post;
        })
      );
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Erro ao comentar');
    }
  };

  const handleCTAConfirmed = async (_postId: string) => {
    // Recarregar serviços para atualizar
    await loadServices();
    // Notificar ledger para recarregar
    window.dispatchEvent(new CustomEvent('cta-confirmed'));
  };

  if (!activeActor && !actorsLoading) {
    return null; // Redirecionamento em andamento
  }

  return (
    <div className="servicos-page">
      <div className="servicos-header">
        <h1 className="servicos-title">🛠️ Serviços Disponíveis</h1>
        <p className="servicos-subtitle">
          Ofertas de serviço publicadas no ecossistema
        </p>
      </div>

      {isLoading ? (
        <div className="servicos-loading">
          <div className="loading-spinner"></div>
          <p>Carregando serviços...</p>
        </div>
      ) : error ? (
        <div className="servicos-error">
          <p>{error}</p>
          <button onClick={loadServices} className="retry-btn">
            Tentar novamente
          </button>
        </div>
      ) : services.length === 0 ? (
        <div className="servicos-empty">
          <p>Nenhum serviço disponível no momento</p>
        </div>
      ) : (
        <div className="servicos-grid">
          {services.map((service) => (
            <PostCard
              key={service.post_id}
              post={service}
              onReaction={handleReaction}
              onComment={handleComment}
              onCTAConfirmed={handleCTAConfirmed}
            />
          ))}
        </div>
      )}
    </div>
  );
}


