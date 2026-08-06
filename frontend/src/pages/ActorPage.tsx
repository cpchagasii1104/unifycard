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
import QuoteRequestDialog from '../components/entity/QuoteRequestDialog';
import { formatSupplierPrice } from '../utils/money';
import PostCard, { type PostCardData } from '../components/social/PostCard';
import SalesHistory from '../components/social/SalesHistory';
import {
  getActorPage,
  type ActorPageContract,
  type ActorPageServiceItem,
  type ActorPageRentalItem,
  type ActorPageProductItem,
  type ActorPageAgendaItem,
  type ActorPagePurchaseOrderItem,
} from '../api/actor-page';
import { sendRelationshipRequest, reclassifyRelationship, patchRelationshipFeedPriority, type RelationshipLabel, type FeedPriority } from '../api/relationships';

// Frequência de feed por conexão (vocabulário governado — projeção; o servidor valida)
const FEED_PRIORITY_PT: Array<{ value: string; label: string }> = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'ver_primeiro', label: 'Ver primeiro' },
  { value: 'ver_mais', label: 'Ver mais' },
  { value: 'ver_menos', label: 'Ver menos' },
];
import {
  listEligibleReferences,
  openSupportTicket,
  type EligibleBusinessFactReference,
} from '../api/support-tickets';
import { getActor, toggleReaction, createComment, followActor, unfollowActor } from '../api/social';
import { showToast } from '../components/common/Toast';
import { formatCentsAsBRL } from '../utils/money';
import './ActorPage.css';

const PURPOSE_LABEL_PT: Record<string, string> = {
  trabalho: 'Trabalho', estudo: 'Estudo', 'cuidados-pessoais': 'Cuidados pessoais', lazer: 'Lazer',
};

// 🔴 F-WINDOW-RENDER-TRUTHFUL-EXTENT (2026-08-06) — 4º membro da família, e o único que o meu grep
// NÃO achou: ele usa `Intl.DateTimeFormat`, não `toLocaleTimeString`. Quem o achou foi o guard
// `audit-window-render-truthful-extent`, pela ASSINATURA (par início/fim), não pelo nome no uso.
// O defeito: imprimia a data do INÍCIO e as duas HORAS, descartando a data do FIM — janela de 30
// dias saía como slot de 10 horas no primeiro dia. 56 das 70 janelas do banco são multi-dia.
function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return start.toDateString() === end.toDateString()
    ? `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`
    : `${dateFmt.format(start)} ${timeFmt.format(start)} → ${dateFmt.format(end)} ${timeFmt.format(end)}`;
}

const LABEL_PT: Record<string, string> = {
  amigo: 'Amigo', conhecido: 'Conhecido', familiar: 'Familiar',
  cliente: 'Cliente', colaborador: 'Colaborador', fornecedor: 'Fornecedor', parceiro: 'Parceiro',
};

const GATE_HINT: Record<string, string> = {
  'PORTA-1': 'Transações chegam em breve',
  EM_BREVE: 'Em breve',
  SEM_FATO_DE_NEGOCIO: 'Só após comprar/contratar',
};

interface SocialData {
  posts: PostCardData[];
  followersCount: number;
  postsCount: number;
  isFollowing: boolean;
  /** backend declara (viewer server-side): proprio perfil nao projeta Seguir. */
  isOwn: boolean;
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
  // Pedido de orçamento: in-page (a ação vem do contrato com deeplink null), sobre a casca universal.
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [reclassifyBusy, setReclassifyBusy] = useState<string | null>(null);

  // F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6) — modal do Chamado
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketRefs, setTicketRefs] = useState<EligibleBusinessFactReference[] | null>(null);
  const [ticketRefIdx, setTicketRefIdx] = useState(0);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketBusy, setTicketBusy] = useState(false);

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
          isOwn: (s as any).is_own ?? false,
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
      // A verdade mora no backend: refetch do contrato — o botão vira
      // "Solicitação enviada" porque o SERVIDOR passou a projetar esse estado.
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // 409 do substrato diz o STATUS real da aresta — projetar honesto, não inventar "já conectados"
      if (msg.includes('status=pending')) {
        showToast('Solicitação já enviada — aguardando resposta.', 'error');
      } else if (msg.includes('status=accepted')) {
        showToast('Vocês já estão conectados.', 'error');
      } else if (msg.includes('Já existe')) {
        showToast('Já existe uma relação entre vocês.', 'error');
      } else {
        showToast('Não foi possível enviar o pedido.', 'error');
      }
      await load(); // re-sincroniza o botão com o estado real
    }
  };

  const handleReclassify = async (relationshipId: string, label: RelationshipLabel) => {
    setReclassifyBusy(relationshipId);
    try {
      await reclassifyRelationship(relationshipId, label);
      showToast(`Conexão reclassificada como ${LABEL_PT[label] ?? label}.`, 'success');
      await load(); // a verdade volta do contrato
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível reclassificar.', 'error');
      await load();
    } finally {
      setReclassifyBusy(null);
    }
  };

  const handleFeedPriority = async (relationshipId: string, priority: FeedPriority) => {
    setReclassifyBusy(relationshipId);
    try {
      await patchRelationshipFeedPriority(relationshipId, priority);
      showToast('Frequência no feed atualizada.', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível ajustar a frequência.', 'error');
      await load();
    } finally {
      setReclassifyBusy(null);
    }
  };

  const handleOpenTicketDialog = async () => {
    setTicketOpen(true);
    setTicketRefs(null);
    setTicketSubject('');
    setTicketMessage('');
    try {
      const refs = await listEligibleReferences(actorId);
      setTicketRefs(refs);
      setTicketRefIdx(0);
    } catch {
      setTicketRefs([]);
      showToast('Não foi possível carregar os negócios elegíveis.', 'error');
    }
  };

  const handleSubmitTicket = async () => {
    const ref = ticketRefs?.[ticketRefIdx];
    if (!ref || !ticketSubject.trim() || !ticketMessage.trim() || ticketBusy) return;
    setTicketBusy(true);
    try {
      await openSupportTicket({
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
        toActorId: ref.counterpartActorId,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      setTicketOpen(false);
      showToast('Chamado aberto.', 'success');
    } catch {
      showToast('Não foi possível abrir o chamado. Tente novamente.', 'error');
    } finally {
      setTicketBusy(false);
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
  if (social && !social.isOwn) {
    heroActions.push(
      social.isFollowing
        ? { label: followBusy ? '…' : 'Deixar de seguir', onClick: handleFollowToggle, variant: 'secondary', disabled: followBusy }
        : { label: followBusy ? '…' : 'Seguir', onClick: handleFollowToggle, variant: 'primary', disabled: followBusy }
    );
  }
  if (connectAction) {
    // ESTADO da aresta vem do CONTRATO (connectionStatus) — a tela só projeta (verdade no backend).
    const connStatus = (connectAction.data?.connectionStatus ?? 'none') as string;
    if (connStatus === 'pending_received' && connectAction.deeplink) {
      // há solicitação DESTE actor pra mim — responder onde o card mora (feed)
      heroActions.push({ label: connectAction.label, onClick: () => { window.location.href = connectAction.deeplink!; }, variant: 'primary' });
    } else if (connStatus === 'pending_sent' || connStatus === 'accepted') {
      heroActions.push({ label: connectAction.label, onClick: () => {}, variant: 'secondary', disabled: true });
    } else if (connectAction.enabled) {
      // rotulo PROJETADO do contrato ('Solicitar conexao') — a tela nao batiza acao (achado Clayton 2026-07-07)
      heroActions.push({ label: connectAction.label || 'Solicitar conexão', onClick: () => setConnectOpen(true), variant: 'secondary' });
    }
  }
  const supportTicketAction = actions.find((a) => a.key === 'support_ticket');
  if (supportTicketAction?.enabled) {
    heroActions.push({ label: 'Abrir chamado', onClick: handleOpenTicketDialog, variant: 'secondary' });
  }
  for (const a of actions) {
    if (a.key === 'connect') continue;
    if (a.key === 'support_ticket' && a.enabled) continue; // já tratado acima (abre modal)
    // 🔴 AÇÃO IN-PAGE: habilitada e SEM deeplink. O laço tratava só (habilitada+deeplink) e
    // (desabilitada) — `request_quote`, que nasce aceso e in-page, não renderizava NADA. Botão que
    // o contrato manda acender e a tela engole é pior que botão ausente: o contrato fica mentindo.
    if (a.key === 'request_quote' && a.enabled) {
      heroActions.push({ label: a.label, onClick: () => setQuoteOpen(true), variant: 'primary' });
      continue;
    }
    if (a.enabled && a.deeplink) {
      heroActions.push({ label: a.label, onClick: () => { window.location.href = a.deeplink!; }, variant: 'secondary' });
    } else if (!a.enabled) {
      heroActions.push({
        label: `${a.label} · ${GATE_HINT[a.gatedBy ?? ''] ?? 'em breve'}`,
        onClick: () => {}, variant: 'secondary', disabled: true,
      });
    }
  }

  // 🔴 O CORTE ENGOLIA JUSTAMENTE A AÇÃO ACESA — achado na fricção de Clayton (2026-08-04).
  // Era `heroActions.slice(0, 3)`. Na Rio Verde Estruturas a ordem de montagem produzia
  // [Seguir, Solicitar conexão, Mensagem·em breve, Abrir chamado·…, Alugar·…, Solicitar orçamento]
  // e o corte em 3 deixava DOIS botões desabilitados na tela e descartava o único que funcionava.
  // Quatro linhas acima este arquivo diz: *"botão que o contrato manda acender e a tela engole é
  // pior que botão ausente"* — e fazia exatamente isso logo abaixo.
  // Ação habilitada NUNCA é cortada; as gated só preenchem o que sobra.
  const heroActionsVisiveis = [
    ...heroActions.filter((a) => !a.disabled),
    ...heroActions.filter((a) => a.disabled),
  ].slice(0, 3);

  const stats: EntityHeroStat[] = [
    ...(social ? [{ label: 'posts', value: social.postsCount }, { label: 'seguidores', value: social.followersCount }] : []),
    ...blocks.filter((b) => typeof b.data.count === 'number' && b.type !== 'posts')
      .slice(0, 2)
      .map((b) => ({ label: tabs.find((t) => t.key === b.tab)?.label.toLowerCase() ?? b.type, value: b.data.count as number })),
  ];

  const blocksForTab = (tabKey: string) =>
    tabKey === 'all' ? blocks : blocks.filter((b) => b.tab === tabKey);

  /**
   * A ação de UM item, projetada do contrato. Três estados, e o terceiro é o que costuma sumir:
   *   true  → dá para pedir agora
   *   false → NÃO dá, e o servidor disse por quê (motivo traduzido, nunca inventado aqui)
   *   null  → o servidor não soube dizer. Não vira botão nem vira "indisponível": vira NADA.
   *           Renderizar "indisponível" a partir de `null` seria a tela afirmando o que ninguém
   *           mediu — o mesmo erro de reportar `0` quando a leitura falhou.
   */
  const renderItemAction = (requestable: boolean | null, reason: string | null) => {
    if (requestable === null || requestable === undefined) return null;
    if (requestable) {
      return (
        <button type="button" className="actor-item-action" onClick={() => setQuoteOpen(true)}>
          Solicitar orçamento
        </button>
      );
    }
    // Motivo VERDADEIRO, do servidor. 'no_schedule' = o dono não publicou janela; quem resolve é
    // ele, e dizer isso é mais útil que um "indisponível" que não ensina nada a ninguém.
    const texto = reason === 'no_schedule' ? 'sem agenda publicada' : 'indisponível';
    return <span className="actor-item-action-off" title="Estado resolvido pelo servidor">{texto}</span>;
  };

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
      case 'connections': {
        // "Minhas conexões" — o contrato SÓ manda este bloco no próprio perfil (0116);
        // myLabel = a MINHA ótica da aresta; reclassificar muda SÓ o meu lado (PATCH valida
        // par/participante no servidor — a tela projeta allowedMyLabels, nunca inventa).
        const items = (block.data.items ?? []) as unknown as Array<{
          actorId: string; displayName: string; actorType: string; myLabel: string;
          myFeedPriority: string; relationshipId: string; allowedMyLabels: string[];
        }>;
        return (
          <section key="connections" className="actor-block">
            <h2>Minhas conexões ({(block.data.count as number) ?? items.length})</h2>
            <ul className="actor-item-list">
              {items.map((c) => (
                <li key={c.actorId} className="actor-item-card">
                  <span className="actor-connection-avatar" aria-hidden="true">
                    {c.actorType === 'page' ? '🏢' : c.actorType === 'group' ? '👥' : '👤'}
                  </span>
                  <div className="actor-item-main">
                    <a className="actor-connection-name" href={`/profile/${c.actorId}`}>{c.displayName}</a>
                  </div>
                  <select
                    className="actor-connection-label-select"
                    value={c.myLabel}
                    disabled={reclassifyBusy === c.relationshipId || c.allowedMyLabels.length === 0}
                    onChange={(e) => void handleReclassify(c.relationshipId, e.target.value as RelationshipLabel)}
                    aria-label={`O que ${c.displayName} é pra você`}
                  >
                    {(c.allowedMyLabels.includes(c.myLabel) ? c.allowedMyLabels : [c.myLabel, ...c.allowedMyLabels]).map((l) => (
                      <option key={l} value={l}>{LABEL_PT[l] ?? l}</option>
                    ))}
                  </select>
                  <select
                    className="actor-connection-label-select"
                    value={c.myFeedPriority ?? 'padrao'}
                    disabled={reclassifyBusy === c.relationshipId}
                    onChange={(e) => void handleFeedPriority(c.relationshipId, e.target.value as FeedPriority)}
                    aria-label={`Frequência dos posts de ${c.displayName} no seu feed`}
                    title="Frequência no seu feed"
                  >
                    {FEED_PRIORITY_PT.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </section>
        );
      }
      // 🔴 2026-08-04 — LOCAÇÃO passa a renderizar. A aba acendia (o probe conta) e o bloco vinha
      // só com `count`: o usuário via "Locações" e NADA dentro. Aba vazia ensina que não funciona.
      case 'rentals': {
        const items = (block.data.items ?? []) as ActorPageRentalItem[];
        return (
          <section key="rentals" className="actor-block">
            <h2>Locações</h2>
            {items.length === 0 ? (
              <p className="muted">Nenhum item de locação ativo no momento.</p>
            ) : (
              <ul className="actor-item-list">
                {items.map((r) => (
                  <li key={r.id} className="actor-item-card">
                    <div className="actor-item-main">
                      <strong>{r.label ?? 'Item de locação'}</strong>
                    </div>
                    {/* durationMinutes null EXPLÍCITO: locação cobra por unidade de tempo, não tem duração fixa.
                          Os dois eixos são separados no contrato desde 2026-08-04 (§4.34). */}
                    <div className="actor-item-price">{formatSupplierPrice({ ...r, durationMinutes: null })}</div>
                    {/* 🔴 A INTERAÇÃO POR ITEM — fricção de Clayton: *"quando chego na página dela
                        eu não tenho interação com o que ela oferece"*. O estado vem do contrato
                        (`requestable`/`requestableReason`), resolvido pela mesma autoridade que o
                        diálogo obedece; a tela NÃO decide o que é pedível. */}
                    {renderItemAction(r.requestable, r.requestableReason)}
                  </li>
                ))}
              </ul>
            )}
            {/* O servidor só manda deeplink quando há MAIS do que o bloco mostrou (ele tem a contagem e o
                            teto) — sem resto, não há link, e foi isso que resolveu a fricção do "Ver todos" que
                            levava para fora sem ter mais nada. Quando há resto, o rótulo DIZ que sai da página:
                            ⚠️ /locacoes ainda NÃO filtra por dono (medido: nenhum ownerActorId na rota nem na
                            tela), então o destino é o catálogo geral. Enquanto for assim, o honesto é avisar. */}
                        {block.deeplink && (
                          <a className="actor-deeplink" href={block.deeplink}>Ver as demais no catálogo geral →</a>
                        )}
          </section>
        );
      }
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
            {/* O servidor só manda deeplink quando há MAIS do que o bloco mostrou (ele tem a contagem e o
                            teto) — sem resto, não há link, e foi isso que resolveu a fricção do "Ver todos" que
                            levava para fora sem ter mais nada. Quando há resto, o rótulo DIZ que sai da página:
                            ⚠️ /locacoes ainda NÃO filtra por dono (medido: nenhum ownerActorId na rota nem na
                            tela), então o destino é o catálogo geral. Enquanto for assim, o honesto é avisar. */}
                        {block.deeplink && (
                          <a className="actor-deeplink" href={block.deeplink}>Ver as demais no catálogo geral →</a>
                        )}
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
      // F-ERP-TWO-SIDED: o ERP tem DUAS caras e o cliente ESPELHA o contrato — quem decide é
      // `data.side` vindo do backend, nunca o frontend. 'sales' (mode=operating) traz estoque+
      // agenda+pedidos+financeiro; 'supply' (mode=consuming atuando-como-a-empresa) traz só o lado
      // de COMPRA. 🔴 Na face de compra NÃO se renderiza "Estoque: nenhum produto publicado" —
      // estoque ali não está VAZIO, está NÃO-APLICÁVEL, e ausência não pode virar afirmação falsa.
      case 'erp': {
        const side = (block.data.side as string | undefined) ?? 'sales';
        const isSupply = side === 'supply';
        const stock = (block.data.stock ?? { count: 0, items: [] }) as { count: number; items: ActorPageProductItem[] };
        const agenda = (block.data.agenda ?? { count: 0 }) as { count: number };
        const purchaseOrders = (block.data.purchaseOrders ?? { count: 0, items: [] }) as { count: number; items: ActorPagePurchaseOrderItem[] };
        const financeiro = (block.data.financeiro ?? {}) as { deeplink?: string };
        return (
          <section key="erp" className="actor-block actor-erp-block">
            <h2>{isSupply ? 'ERP · Compras' : 'ERP'}</h2>
            <div className="actor-erp-grid">
              {!isSupply && (
                <div className="actor-erp-card">
                  <h3>Estoque</h3>
                  {stock.items.length === 0 ? (
                    <p className="muted">Nenhum produto publicado.</p>
                  ) : (
                    <ul className="actor-item-list">
                      {stock.items.map((p) => (
                        <li key={p.offerId} className="actor-item-card">
                          <span>{p.name}</span>
                          <span>{p.availableQuantity} un.</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="actor-erp-card">
                <h3>Pedidos de compra</h3>
                {purchaseOrders.items.length === 0 ? (
                  <p className="muted">Nenhum pedido de compra.</p>
                ) : (
                  <ul className="actor-item-list">
                    {purchaseOrders.items.map((po) => (
                      <li key={po.id} className="actor-item-card">
                        <span>{po.status}</span>
                        <span>{new Date(po.orderDate).toLocaleDateString('pt-BR')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!isSupply && (
                <div className="actor-erp-card">
                  <h3>Agenda</h3>
                  <p>{agenda.count} horário(s) futuro(s) publicado(s).</p>
                </div>
              )}
              <div className="actor-erp-card">
                <h3>Financeiro</h3>
                {financeiro.deeplink && (
                  <a className="actor-deeplink" href={financeiro.deeplink}>Ver carteira →</a>
                )}
              </div>
            </div>
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
        actions={heroActionsVisiveis}
      />

      {header.location && (header.location.cityName || header.location.stateCode) && (
        <p className="actor-location-chip">
          📍 {[header.location.cityName, header.location.stateCode].filter(Boolean).join(', ')}
        </p>
      )}

      {/* 🔴 O pedido de orçamento vive AQUI, sobre a casca universal — não numa página de
          fornecedor à parte. A página que eu tinha criado (/fornecedores/:id) era a SEXTA
          superfície de vendedor do repositório; foi absorvida, e o que valia nela era o fluxo. */}
      {quoteOpen && (
        <QuoteRequestDialog
          providerActorId={header.actorId}
          providerName={header.displayName}
          onClose={() => setQuoteOpen(false)}
        />
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

      {ticketOpen && (
        <div className="actor-connect-dialog" role="dialog" aria-label="Abrir chamado">
          <p>Abrir chamado com <strong>{header.displayName}</strong> sobre:</p>
          {ticketRefs === null ? (
            <p className="muted">Carregando negócios elegíveis…</p>
          ) : ticketRefs.length === 0 ? (
            <p className="muted">Nenhum negócio elegível encontrado no momento.</p>
          ) : (
            <>
              <select
                className="actor-ticket-ref-select"
                value={ticketRefIdx}
                onChange={(e) => setTicketRefIdx(Number(e.target.value))}
              >
                {ticketRefs.map((r, i) => (
                  <option key={`${r.referenceType}-${r.referenceId}`} value={i}>{r.label}</option>
                ))}
              </select>
              <input
                className="actor-ticket-input"
                placeholder="Assunto"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
              <textarea
                className="actor-ticket-textarea"
                placeholder="O que aconteceu?"
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                rows={3}
              />
              <button
                className="actor-ticket-submit"
                disabled={!ticketSubject.trim() || !ticketMessage.trim() || ticketBusy}
                onClick={handleSubmitTicket}
              >
                {ticketBusy ? 'Enviando…' : 'Abrir chamado'}
              </button>
            </>
          )}
          <button className="actor-connect-cancel" onClick={() => setTicketOpen(false)}>Cancelar</button>
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

      {/* Pedido Clayton 2026-07-07: grade estilo FB no "Tudo" — trilho de identidade
          (Sobre/serviços/produtos/agenda) à esquerda, timeline à direita; empilha em
          telas menores. Só REORGANIZA blocos do contrato — não cria nem esconde nada. */}
      {activeTab === 'all' ? (
        <div className="actor-content actor-content--grid">
          <div className="actor-rail">
            {blocks.filter((b) => RAIL_BLOCK_TYPES.has(b.type)).map(renderBlock)}
          </div>
          <div className="actor-main">
            {blocks.filter((b) => !RAIL_BLOCK_TYPES.has(b.type)).map(renderBlock)}
          </div>
        </div>
      ) : (
        <div className="actor-content">
          {blocksForTab(activeTab).map(renderBlock)}
        </div>
      )}
    </div>
  );
}

/** Blocos de identidade/contexto que moram no trilho esquerdo do "Tudo" (apresentação). */
const RAIL_BLOCK_TYPES = new Set(['about', 'connections', 'services', 'products', 'agenda', 'location']);
