// src/components/social/CompanyPage.tsx
// 2026-05-15: refatorada para usar EntityHero (primitivo lego universal).
// Antes desta refatoração, era ~95% paralela a ProfilePage. Agora a estrutura
// visual de cabeçalho vem do componente compartilhado e apenas a parametrização
// muda (variant='company' + botão extra "Contatar").

import { useState, useEffect } from 'react';
import PostCard, { type PostCardData } from './PostCard';
import SalesHistory from './SalesHistory';
import EntityHero, { type EntityHeroStat, type EntityHeroAction } from '../entity/EntityHero';
import { getActor, toggleReaction, createComment, followActor, unfollowActor } from '../../api/social';
import { showToast } from '../common/Toast';
import './CompanyPage.css';

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

export default function CompanyPage({ actorId }: { actorId: string }) {
  const [actor, setActor] = useState<ActorData | null>(null);
  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [counts, setCounts] = useState<ActorCounts>({ followers_count: 0, posts_count: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowingAction, setIsFollowingAction] = useState(false);

  useEffect(() => {
    loadCompany();
  }, [actorId]);

  const loadCompany = async () => {
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
      setCounts((data.counts || { followers_count: 0, posts_count: 0 }) as any);
      setIsFollowing(data.is_following || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar página');
      console.error('Erro ao carregar página:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    try {
      await toggleReaction(postId, reactionType as 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry');
      setPosts((prev) =>
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
      console.error('Erro ao reagir:', err);
    }
  };

  const handleComment = async (postId: string, content: string) => {
    try {
      await createComment(postId, { content });
      setPosts((prev) =>
        prev.map((post) =>
          post.post_id === postId ? { ...post, comments_count: post.comments_count + 1 } : post
        )
      );
    } catch (err) {
      console.error('Erro ao comentar:', err);
    }
  };

  const handleFollow = async () => {
    if (isFollowingAction) return;
    setIsFollowingAction(true);
    try {
      await followActor(actorId);
      setIsFollowing(true);
      setCounts((prev) => ({ ...prev, followers_count: prev.followers_count + 1 }));
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
      setCounts((prev) => ({ ...prev, followers_count: Math.max(0, prev.followers_count - 1) }));
      showToast('Você deixou de seguir.', 'info');
    } catch (err) {
      console.error('Erro ao deixar de seguir:', err);
      showToast('Erro ao deixar de seguir. Tente novamente.', 'error');
    } finally {
      setIsFollowingAction(false);
    }
  };

  if (isLoading) {
    return <div className="company-page loading">Carregando página...</div>;
  }

  if (error || !actor) {
    return (
      <div className="company-page error">
        <p>{error || 'Página não encontrada'}</p>
        <button onClick={loadCompany}>Tentar novamente</button>
      </div>
    );
  }

  const serviceCount = posts.filter((p) => p.intent === 'service_offer').length;
  const eventCount = posts.filter((p) => p.intent === 'event' || p.linked_event).length;

  const stats: EntityHeroStat[] = [
    { label: 'publicações', value: counts.posts_count },
    { label: 'seguidores', value: counts.followers_count },
    ...(serviceCount > 0 ? [{ label: 'serviços', value: serviceCount }] : []),
    ...(eventCount > 0 ? [{ label: 'eventos', value: eventCount }] : []),
  ];

  const actions: EntityHeroAction[] = [
    isFollowing
      ? {
          label: isFollowingAction ? '...' : 'Deixar de seguir',
          onClick: handleUnfollow,
          variant: 'secondary',
          disabled: isFollowingAction,
        }
      : {
          label: isFollowingAction ? '...' : 'Seguir',
          onClick: handleFollow,
          variant: 'primary',
          disabled: isFollowingAction,
        },
    {
      label: 'Contatar',
      onClick: () => showToast('Contato em desenvolvimento — em breve.', 'info'),
      variant: 'secondary',
    },
  ];

  return (
    <div className="company-page">
      <EntityHero
        variant="company"
        onBack={() => window.history.back()}
        coverUrl={actor.cover_url}
        avatarUrl={actor.avatar_url}
        avatarFallback={actor.display_name[0] || 'E'}
        displayName={actor.display_name}
        bio={actor.bio}
        stats={stats}
        trustText={
          counts.posts_count > 0
            ? counts.posts_count > 5
              ? '✓ Empresa ativa na comunidade'
              : 'Nova empresa'
            : null
        }
        actions={actions}
      />

      <SalesHistory posts={posts} actorType={actor.actor_type as 'user' | 'page'} />

      <div className="company-posts">
        <h2>Publicações</h2>
        {posts.length === 0 ? (
          <div className="no-posts">
            <p>Nenhuma publicação ainda.</p>
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
