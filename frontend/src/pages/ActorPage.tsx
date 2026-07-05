// src/pages/ActorPage.tsx
// F-ACTOR-PAGE-SHELL-SLICE-3 — A CASCA UNIVERSAL da página do actor (DESENHO_PAGINA_DO_ACTOR §1/§2).
// UMA página para todo actor (PF/PJ/grupo/banda): renderiza o CONTRATO server-driven
// (GET /actor-page/:actorId) — header + barra de ações + abas + blocos. O que acende vem do
// backend (capability/concept publicado); o cliente NÃO decide abas nem habilita ação gated.
// CONVERGÊNCIA (anti-página-paralela, Lei §2): absorve SocialProfilePage (/profile/:id) e
// SocialCompanyPage (/company/:id). O bloco Posts reusa o fluxo social VIVO (getActor + PostCard).
// Comprar/Contratar renderizam DESABILITADOS (gatedBy PORTA-1); Conectar usa o substrato de
// relação vivo (Fatia 1) com labels governados vindos do contrato.

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import EntityHero, { type EntityHeroStat, type EntityHeroAction } from '../components/entity/EntityHero';
import PostCard, { type PostCardData } from '../components/social/PostCard';
import SalesHistory from '../components/social/SalesHistory';
import {
  getActorPage,
  type ActorPageContract,
  type ActorPageServiceItem,
  type ActorPageProductItem,
  type ActorPageAgendaItem,
} from '../api/actor-page';
import { sendRelationshipRequest, type RelationshipLabel } from '../api/relationships';
import { getActor, toggleReaction, createComment, followActor, unfollowActor } from '../api/social';
import { showToast } from '../components/common/Toast';
import { formatCentsAsBRL } from '../utils/money';
import './ActorPage.css';

const PURPOSE_LABEL_PT: Record<string, string> = {
  trabalho: 'Trabalho', estudo: 'Estudo', 'cuidados-pessoais': 'Cuidados pessoais', lazer: 'Lazer',
};

function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
}

const LABEL_PT: Record<string, string> = {
  amigo: 'Amigo', conhecido: 'Conhecido', familiar: 'Familiar',
  cliente: 'Cliente', colaborador: 'Colaborador', fornecedor: 'Fornecedor', parceiro: 'Parceiro',
};

const GATE_HINT: Record<string, string> = {
  'PORTA-1': 'Transações chegam em breve',
  EM_BREVE: 'Em breve',
};

interface SocialData {
  posts: PostCardData[];
  followersCount: number;
  postsCount: number;
  isFollowing: boolean;
}

export default function ActorPage() {
  const { id, actorId: actorIdParam } = useParams<{ id?: string; actorId?: string }>();
  const actorId = id ?? actorIdParam ?? '';

  const [contract, setContract] = useState<ActorPageContract | null>(null);
  const [social, setSocial] = useState<SocialData | null>(null);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // o contrato manda; o fluxo social vivo alimenta o bloco Posts + Seguir (paridade com a página antiga)
      const [c, s] = await Promise.all([
        getActorPage(actorId),
        getActor(actorId).catch(() => null),
      ]);
      setContract(c);
      if (s) {
        setSocial({
          posts: s.posts ?? [],
          followersCount: (s.counts as any)?.followers_count ?? 0,
          postsCount: (s.counts as any)?.posts_count ?? 0,
          isFollowing: (s as any).is_following ?? false,
        });
      }
      setActiveTab('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar a página');
    } finally {
      setIsLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(); }, [load]);

  const handleConnect = async (label: RelationshipLabel) => {
    setConnectOpen(false);
    try {
      await sendRelationshipRequest(actorId, label);
      showToast(`Pedido de conexão enviado como ${LABEL_PT[label] ?? label}.`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg.includes('Já existe') ? 'Vocês já têm uma conexão.' : 'Não foi possível enviar o pedido.', 'error');
    }
  };

  const handleFollowToggle = async () => {
    if (!social || followBusy) return;
    setFollowBusy(true);
    try {
      if (social.isFollowing) {
        await unfollowActor(actorId);
        setSocial({ ...social, isFollowing: false, followersCount: Math.max(0, social.followersCount - 1) });
      } else {
        await followActor(actorId);
        setSocial({ ...social, isFollowing: true, followersCount: social.followersCount + 1 });
      }
    } catch {
      showToast('Não foi possível atualizar. Tente novamente.', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleReaction = async (postId: string, reactionType: string) => {
    if (!social) return;
    try {
      await toggleReaction(postId, reactionType as any);
      setSocial({
        ...social,
        posts: social.posts.map((post) => {
          if (post.post_id !== postId) return post;
          const wasLiked = post.user_reaction === reactionType;
          return {
            ...post,
            user_reaction: wasLiked ? null : reactionType,
            reactions_count: wasLiked ? post.reactions_count - 1 : post.reactions_count + (post.user_reaction ? 0 : 1),
          };
        }),
      });
    } catch { /* silencioso como na página anterior */ }
  };

  const handleComment = async (postId: string, content: string) => {
    if (!social) return;
    try {
      await createComment(postId, { content });
      setSocial({
        ...social,
        posts: social.posts.map((p) => (p.post_id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)),
      });
    } catch { /* silencioso */ }
  };

  if (isLoading) return <div className="actor-page loading">Carregando página…</div>;
  if (error || !contract) {
    return (
      <div className="actor-page error">
        <p>{error || 'Página não encontrada'}</p>
        <button onClick={load}>Tentar novamente</button>
      </div>
    );
  }

  const { header, actions, tabs, blocks } = contract;
  const connectAction = actions.find((a) => a.key === 'connect');
  const allowedLabels = (connectAction?.data?.allowedLabels ?? []) as RelationshipLabel[];

  // ações do hero: Seguir (fluxo vivo) + Conectar (contrato) + gated (renderizam desabilitadas)
  const heroActions: EntityHeroAction[] = [];
  if (social) {
    heroActions.push(
      social.isFollowing
        ? { label: followBusy ? '…' : 'Deixar de seguir', onClick: handleFollowToggle, variant: 'secondary', disabled: followBusy }
        : { label: followBusy ? '…' : 'Seguir', onClick: handleFollowToggle, variant: 'primary', disabled: followBusy }
    );
  }
  if (connectAction?.enabled) {
    heroActions.push({ label: 'Conectar', onClick: () => setConnectOpen(true), variant: 'secondary' });
  }
  for (const a of actions) {
    if (a.key === 'connect') continue;
    if (a.enabled && a.deeplink) {
      heroActions.push({ label: a.label, onClick: () => { window.location.href = a.deeplink!; }, variant: 'secondary' });
    } else if (!a.enabled) {
      heroActions.push({
        label: `${a.label} · ${GATE_HINT[a.gatedBy ?? ''] ?? 'em breve'}`,
        onClick: () => {}, variant: 'secondary', disabled: true,
      });
    }
  }

  const stats: EntityHeroStat[] = [
    ...(social ? [{ label: 'posts', value: social.postsCount }, { label: 'seguidores', value: social.followersCount }] : []),
    ...blocks.filter((b) => typeof b.data.count === 'number' && b.type !== 'posts')
      .slice(0, 2)
      .map((b) => ({ label: tabs.find((t) => t.key === b.tab)?.label.toLowerCase() ?? b.type, value: b.data.count as number })),
  ];

  const blocksForTab = (tabKey: string) =>
    tabKey === 'all' ? blocks : blocks.filter((b) => b.tab === tabKey);

  const renderBlock = (block: ActorPageContract['blocks'][number]) => {
    switch (block.type) {
      case 'about':
        return (
          <section key="about" className="actor-block">
            <h2>Sobre</h2>
            {block.data.headline && <p className="actor-headline">{block.data.headline as string}</p>}
            {block.data.bio
              ? <p className="actor-bio">{block.data.bio as string}</p>
              : <p className="actor-bio muted">Ainda sem descrição.</p>}
          </section>
        );
      case 'posts':
        return (
          <section key="posts" className="actor-block">
            <h2>Posts</h2>
            {social && social.posts.length > 0 ? (
              <>
                <SalesHistory posts={social.posts} actorType={header.actorType as 'user' | 'page'} />
                <div className="posts-list">
                  {social.posts.map((post) => (
                    <PostCard key={post.post_id} post={post} onReaction={handleReaction} onComment={handleComment} />
                  ))}
                </div>
              </>
            ) : (
              <p className="muted">Nenhum post ainda.</p>
            )}
          </section>
        );
      case 'services': {
        const items = (block.data.items ?? []) as ActorPageServiceItem[];
        return (
          <section key="services" className="actor-block">
            <h2>Serviços</h2>
            {items.length === 0 ? (
              <p className="muted">Nenhum serviço ativo no momento.</p>
            ) : (
              <ul className="actor-item-list">
                {items.map((s) => (
                  <li key={s.serviceId} className="actor-item-card">
                    <div className="actor-item-main">
                      <strong>{s.name}</strong>
                      {s.shortDescription && <p className="actor-item-desc">{s.shortDescription}</p>}
                    </div>
                    <div className="actor-item-price">
                      {s.priceCents != null ? formatCentsAsBRL(s.priceCents) : 'Sob consulta'}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {block.deeplink && <a className="actor-deeplink" href={block.deeplink}>Ver todos →</a>}
          </section>
        );
      }
      case 'products': {
        const items = (block.data.items ?? []) as ActorPageProductItem[];
        return (
          <section key="products" className="actor-block">
            <h2>Produtos</h2>
            {items.length === 0 ? (
              <p className="muted">Nenhum produto disponível no momento.</p>
            ) : (
              <ul className="actor-item-list">
                {items.map((p) => (
                  <li key={p.offerId} className="actor-item-card">
                    {p.imageUrl && <img className="actor-item-thumb" src={p.imageUrl} alt={p.name} />}
                    <div className="actor-item-main">
                      <strong>{p.name}</strong>
                      {p.brand && <p className="actor-item-desc">{p.brand}</p>}
                      <p className="actor-item-desc muted">{p.availableQuantity} em estoque</p>
                    </div>
                    <div className="actor-item-price">{formatCentsAsBRL(p.priceCents)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      }
      case 'agenda': {
        const items = (block.data.items ?? []) as ActorPageAgendaItem[];
        return (
          <section key="agenda" className="actor-block">
            <h2>Agenda</h2>
            {items.length === 0 ? (
              <p className="muted">Nenhum horário futuro publicado.</p>
            ) : (
              <ul className="actor-item-list">
                {items.map((w) => (
                  <li key={w.availabilityId} className="actor-item-card actor-agenda-item">
                    <span>{formatWindow(w.startDatetime, w.endDatetime)}</span>
                    {w.purposeSlug && (
                      <span className="actor-agenda-purpose">{PURPOSE_LABEL_PT[w.purposeSlug] ?? w.purposeSlug}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      }
      case 'location': {
        const { cityName, stateCode, neighborhoodName } = block.data;
        const parts = [neighborhoodName, cityName, stateCode].filter(Boolean);
        return (
          <section key="location" className="actor-block">
            <h2>Localização</h2>
            <p>{parts.length > 0 ? parts.join(', ') : 'Localização não informada.'}</p>
            <p className="muted actor-location-note">Endereço exato não é exibido publicamente.</p>
          </section>
        );
      }
      default:
        return (
          <section key={block.type} className="actor-block">
            <h2>{tabs.find((t) => t.key === block.tab)?.label ?? block.type}</h2>
            <p className="muted">
              {typeof block.data.count === 'number' ? `${block.data.count} item(ns) publicado(s). ` : ''}
              O conteúdo completo deste bloco chega em breve.
            </p>
            {block.deeplink && (
              <a className="actor-deeplink" href={block.deeplink}>Ver no fluxo →</a>
            )}
          </section>
        );
    }
  };

  return (
    <div className="actor-page">
      <EntityHero
        variant={header.actorType === 'page' ? 'company' : 'profile'}
        onBack={() => window.history.back()}
        coverUrl={header.coverUrl}
        avatarUrl={header.avatarUrl}
        avatarFallback={header.displayName[0] || 'U'}
        displayName={header.displayName}
        bio={header.headline ?? header.bio}
        stats={stats}
        actions={heroActions.slice(0, 3)}
      />

      {header.location && (header.location.cityName || header.location.stateCode) && (
        <p className="actor-location-chip">
          📍 {[header.location.cityName, header.location.stateCode].filter(Boolean).join(', ')}
        </p>
      )}

      {connectOpen && (
        <div className="actor-connect-dialog" role="dialog" aria-label="Conectar">
          <p>Conectar com <strong>{header.displayName}</strong> como:</p>
          <div className="actor-connect-options">
            {allowedLabels.map((l) => (
              <button key={l} onClick={() => handleConnect(l)}>{LABEL_PT[l] ?? l}</button>
            ))}
          </div>
          <button className="actor-connect-cancel" onClick={() => setConnectOpen(false)}>Cancelar</button>
        </div>
      )}

      {/* a barra de abas É o navegador de blocos — montada do contrato, nunca hardcoded */}
      <nav className="actor-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={activeTab === t.key ? 'active' : ''}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="actor-content">
        {blocksForTab(activeTab).map(renderBlock)}
      </div>
    </div>
  );
}
