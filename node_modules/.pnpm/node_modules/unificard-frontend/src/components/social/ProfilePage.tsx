// src/components/social/ProfilePage.tsx
// Página de perfil com capa editável e posts do usuário

import { useState, useEffect } from 'react';
import PostCard, { type PostCardData } from './PostCard';
import SalesHistory from './SalesHistory';
import { getActor, toggleReaction, createComment, followActor, unfollowActor } from '../../api/social';
import { showToast } from '../common/Toast';
import './ProfilePage.css';

interface ActorData {
  actor_id: string;
  actor_type: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
}

interface ActorCounts {
  followers_count: number;
  posts_count: number;
}

export default function ProfilePage({ actorId }: { actorId: string }) {
  const [actor, setActor] = useState<ActorData | null>(null);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [counts, setCounts] = useState<ActorCounts>({ followers_count: 0, posts_count: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [actorId]);

  const loadProfile = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getActor(actorId);
      setActor({
        ...data.actor,
        cover_url: data.actor.cover_url ?? null,
        bio: data.actor.bio !== undefined ? (data.actor.bio ?? null) : null,
      });
      setPosts(data.posts);
      setCounts(data.counts || { followers_count: 0, posts_count: 0 });
      setIsFollowing(data.is_following || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfil');
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      await toggleReaction(postId, reactionType as 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry');
      // Atualiza localmente
      setPosts(prev => prev.map((post) => {
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
      }));
    } catch (err) {
      console.error('Erro ao reagir:', err);
    }
  };

  const handleComment = async (postId: string, content: string) => {
    try {
      await createComment(postId, { content });
      setPosts(prev => prev.map((post) => {
        if (post.post_id === postId) {
          return { ...post, comments_count: post.comments_count + 1 };
        }
        return post;
      }));
    } catch (err) {
      console.error('Erro ao comentar:', err);
    }
  };

  const [isFollowingAction, setIsFollowingAction] = useState(false);

  const handleFollow = async () => {
    if (isFollowingAction) return;
    setIsFollowingAction(true);
    try {
      await followActor(actorId);
      setIsFollowing(true);
      setCounts(prev => ({ ...prev, followers_count: prev.followers_count + 1 }));
      showToast('Agora você está seguindo!', 'success');
    } catch (err) {
      console.error('Erro ao seguir:', err);
      showToast('Erro ao seguir. Tente novamente.', 'error');
    } finally {
      setIsFollowingAction(false);
    }
  };

  const handleUnfollow = async () => {
    if (isFollowingAction) return;
    setIsFollowingAction(true);
    try {
      await unfollowActor(actorId);
      setIsFollowing(false);
      setCounts(prev => ({ ...prev, followers_count: Math.max(0, prev.followers_count - 1) }));
      showToast('Você deixou de seguir.', 'info');
    } catch (err) {
      console.error('Erro ao deixar de seguir:', err);
      showToast('Erro ao deixar de seguir. Tente novamente.', 'error');
    } finally {
      setIsFollowingAction(false);
    }
  };

  if (isLoading) {
    return <div className="profile-page loading">Carregando perfil...</div>;
  }

  if (error || !actor) {
    return (
      <div className="profile-page error">
        <p>{error || 'Perfil não encontrado'}</p>
        <button onClick={loadProfile}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Botão voltar */}
      <div className="page-back">
        <button onClick={() => window.history.back()} className="back-button">
          ← Voltar
        </button>
      </div>
      
      {/* Capa */}
      <div className="profile-cover">
        {actor.cover_url ? (
          <img src={actor.cover_url} alt="Capa" />
        ) : (
          <div className="cover-placeholder">Capa</div>
        )}
        {/* TODO: Botão de editar capa (apenas se for o próprio perfil) */}
      </div>

      {/* Header do perfil */}
      <div className="profile-header">
        <div className="profile-avatar-section">
          {actor.avatar_url ? (
            <img src={actor.avatar_url} alt={actor.display_name} className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">
              {actor.display_name[0]?.toUpperCase() || 'U'}
            </div>
          )}
        </div>
        <div className="profile-info">
          <div className="profile-name-section">
            <h1>{actor.display_name}</h1>
            <span className="profile-badge profile-badge--active">💚 Ativo na comunidade</span>
          </div>
          {actor.bio && <p className="profile-bio">{actor.bio}</p>}
          <div className="profile-stats">
            <span className="stat-item">
              <strong>{counts.posts_count}</strong> posts
            </span>
            <span className="stat-item">
              <strong>{counts.followers_count}</strong> seguidores
            </span>
            {posts.filter(p => p.intent === 'service_offer').length > 0 && (
              <span className="stat-item">
                <strong>{posts.filter(p => p.intent === 'service_offer').length}</strong> serviços
              </span>
            )}
            {posts.filter(p => p.intent === 'event' || p.linked_event).length > 0 && (
              <span className="stat-item">
                <strong>{posts.filter(p => p.intent === 'event' || p.linked_event).length}</strong> eventos
              </span>
            )}
          </div>
          {counts.posts_count > 0 && (
            <p className="profile-trust-text">
              {counts.posts_count > 10 ? '💚 Membro ativo da comunidade' : 'Novo membro'}
            </p>
          )}
          <div className="profile-actions">
            {isFollowing ? (
              <button 
                onClick={handleUnfollow} 
                className="follow-btn unfollow"
                disabled={isFollowingAction}
              >
                {isFollowingAction ? '...' : 'Deixar de seguir'}
              </button>
            ) : (
              <button 
                onClick={handleFollow} 
                className="follow-btn follow"
                disabled={isFollowingAction}
              >
                {isFollowingAction ? '...' : 'Seguir'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Histórico de vendas/ofertas */}
      <SalesHistory 
        posts={posts} 
        actorType={actor.actor_type as 'user' | 'page'}
      />

      {/* Posts */}
      <div className="profile-posts">
        <h2>Posts</h2>
        {posts.length === 0 ? (
          <div className="no-posts">
            <p>Nenhum post ainda.</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <PostCard
                key={post.post_id}
                post={post}
                onReaction={handleReaction}
                onComment={handleComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}





