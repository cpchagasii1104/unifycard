// src/pages/GrupoDetailPage.tsx
// Página de detalhes de um grupo específico

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroup, updateGroup, getGroupMembers, updateMemberRole, removeGroupMember, createGroupInvite, getGroupInvites, getGroupDashboard, getGroupEconomy, getGroupClosureSummary, getGroupStateHistory, type Group, type GroupMember, type GroupInvite } from '../api/groups';
import { getGroupCategories, type GroupCategory } from '../api/groups';
import { getCoreProfile } from '../api/core';
import { ImageUpload } from '../components/groups/ImageUpload';
import { getFeed, createPost, type Post } from '../api/social-2.0';
import { useActiveActor } from '../contexts/ActiveActorContext';
import './GrupoDetailPage.css';

type TabType = 'overview' | 'feed' | 'members' | 'settings';

export default function GrupoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>(undefined);
  const [localCoverUrl, setLocalCoverUrl] = useState<string | undefined>(undefined);
  const [localDescription, setLocalDescription] = useState<string>('');
  const [localFinancialPurpose, setLocalFinancialPurpose] = useState<string>('');
  const [localRulesText, setLocalRulesText] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviting, setInviting] = useState(false);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const { activeActor } = useActiveActor();
  const [newPostContent, setNewPostContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [dashboard, setDashboard] = useState<{
    membersCount: number;
    eventsCount: number;
    postsCount: number | null;
  } | null>(null);
  const [groupEconomy, setGroupEconomy] = useState<{
    totalIn: number;
    totalOut: number;
    balance: number;
    currency: string;
    lastUpdate: string;
  } | null>(null);
  const [groupClosureSummary, setGroupClosureSummary] = useState<{
    lifetimeEvents: number;
    lifetimeEconomicVolume: number;
    createdAt: string;
  } | null>(null);
  const [groupStateHistory, setGroupStateHistory] = useState<Array<{
    state: string;
    changedAt: string;
  }>>([]);

  useEffect(() => {
    if (id) {
      loadGroup();
      loadDashboard();
      if (isOwnerOrAdmin) {
        loadGroupEconomy();
        loadGroupClosureSummary();
        loadGroupStateHistory();
      }
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'settings' && isOwnerOrAdmin) {
      loadGroupEconomy();
      loadGroupClosureSummary();
      loadGroupStateHistory();
    }
  }, [id, activeTab, isOwnerOrAdmin]);

  const loadDashboard = async () => {
    if (!id) return;

    try {
      const dashboardData = await getGroupDashboard(id);
      setDashboard({
        membersCount: dashboardData.membersCount,
        eventsCount: dashboardData.eventsCount,
        postsCount: dashboardData.postsCount,
      });
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
      // Não bloquear página se dashboard falhar
    }
  };

  const loadGroupEconomy = async () => {
    if (!id) return;

    try {
      const economyData = await getGroupEconomy(id);
      setGroupEconomy(economyData);
    } catch (err) {
      console.error('Erro ao carregar economia do grupo:', err);
      // Não bloquear página se economia falhar
    }
  };

  const loadGroupClosureSummary = async () => {
    if (!id) return;

    try {
      const closureData = await getGroupClosureSummary(id);
      setGroupClosureSummary(closureData);
    } catch (err) {
      console.error('Erro ao carregar resumo de fechamento do grupo:', err);
      // Não bloquear página se fechamento falhar
    }
  };

  const loadGroupStateHistory = async () => {
    if (!id) return;

    try {
      const stateHistory = await getGroupStateHistory(id);
      setGroupStateHistory(stateHistory);
    } catch (err) {
      console.error('Erro ao carregar histórico de estados do grupo:', err);
      // Não bloquear página se histórico falhar
    }
  };

  useEffect(() => {
    if (group) {
      checkUserPermissions();
    }
  }, [group]);

  useEffect(() => {
    if (id && activeTab === 'members') {
      loadMembers();
      if (isOwnerOrAdmin) {
        loadInvites();
      }
    }
  }, [id, activeTab, isOwnerOrAdmin]);

  useEffect(() => {
    if (id && activeTab === 'feed' && activeActor) {
      loadGroupFeed();
    }
  }, [id, activeTab, activeActor?.actor_id]);

  const checkUserPermissions = async () => {
    if (!group) return;

    try {
      const profile = await getCoreProfile();
      if (profile && profile.actor) {
        // Verificar se o actor_id corresponde ao ownerUserId
        // Nota: ownerUserId pode ser userId ou globalUserId, dependendo do contexto
        // Por enquanto, verificamos apenas se há correspondência
        // TODO: Melhorar verificação quando API de permissões estiver disponível
        const actorId = profile.actor.actor_id;
        // Match EXATO do actor canônico. Ambos são actor_id (owner_actor_id do backend vs
        // actor.actor_id do perfil). O `.includes()` fuzzy anterior era bug duplo: (1) casava
        // por substring de UUID (false-positive: config a não-dono) e (2) lia group.ownerUserId
        // que era undefined (backend serializa ownerActorId) → crash engolido → dono nunca via
        // config. A autoridade REAL é server-side (updateGroup → requesterMatchesOwnerActor);
        // esta flag é só afordância de UI. (frontend nunca cria verdade — projeta a resolvida)
        const isOwner = group.ownerActorId === actorId;
        setIsOwnerOrAdmin(isOwner);
        
        // Salvar userId atual para comparação
        setCurrentUserId(actorId);
      }
    } catch (err) {
      console.warn('Erro ao verificar permissões do usuário:', err);
      // Em caso de erro, não mostrar aba de configurações
      setIsOwnerOrAdmin(false);
    }
  };

  const loadMembers = async () => {
    if (!id) return;

    setLoadingMembers(true);
    try {
      const membersData = await getGroupMembers(id);
      setMembers(membersData.members || []);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async () => {
    if (!id) return;

    try {
      const invitesData = await getGroupInvites(id, 'pending');
      setInvites(invitesData.invites || []);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
    }
  };

  const handleCreateInvite = async () => {
    if (!id || !inviteUserId.trim()) return;

    setInviting(true);
    try {
      await createGroupInvite(id, inviteUserId.trim());
      setInviteUserId('');
      setShowInviteForm(false);
      await loadInvites(); // Recarregar lista de convites
      alert('Convite enviado com sucesso!');
    } catch (err) {
      console.error('Erro ao criar convite:', err);
      alert(err instanceof Error ? err.message : 'Erro ao criar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateMemberRole = async (memberUserId: string, newRole: 'member' | 'admin') => {
    if (!id) return;

    try {
      await updateMemberRole(id, memberUserId, newRole);
      await loadMembers(); // Recarregar lista
    } catch (err) {
      console.error('Erro ao atualizar role do membro:', err);
      alert(err instanceof Error ? err.message : 'Erro ao atualizar role do membro');
    }
  };

  const handleRemoveMember = async (memberUserId: string, memberName?: string) => {
    if (!id) return;

    const confirmMessage = `Tem certeza que deseja remover ${memberName || 'este membro'} do grupo?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      await removeGroupMember(id, memberUserId);
      await loadMembers(); // Recarregar lista
    } catch (err) {
      console.error('Erro ao remover membro:', err);
      alert(err instanceof Error ? err.message : 'Erro ao remover membro');
    }
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      owner: '👑 Proprietário',
      admin: '⚙️ Administrador',
      moderator: '🛡️ Moderador',
      collaborator: '🤝 Colaborador',
      member: '👤 Membro',
    };
    return labels[role] || role;
  };

  const canManageMember = (member: GroupMember): boolean => {
    if (!isOwnerOrAdmin) return false;
    if (!group) return false;
    // Não pode gerenciar o próprio owner — usa a role da verdade do backend (era comparação
    // com group.ownerUserId=undefined → todo membro parecia removível, inclusive o dono).
    return member.role !== 'owner';
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadGroup = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const groupData = await getGroup(id);
      setGroup(groupData);
      
      // Inicializar estados locais com dados do grupo
      setLocalAvatarUrl(groupData.avatarUrl);
      setLocalCoverUrl(groupData.coverUrl);
      setLocalDescription(groupData.description || '');
      setLocalFinancialPurpose(groupData.financialPurpose || '');
      setLocalRulesText(groupData.metadata?.rules_text || '');

      // Carregar categorias para exibir nome
      const categoriesData = await getGroupCategories();
      setCategories(categoriesData);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
      // 🔴 UX: Não mostrar erro de permissão no carregamento
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar grupo';
      if (errorMessage.includes('Only the owner') || errorMessage.includes('permission')) {
        // Erro de permissão não deve aparecer no carregamento
        setError('Grupo não encontrado ou você não tem permissão para visualizá-lo.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (categoryId?: string): string => {
    if (!categoryId) return 'Sem categoria';
    const category = categories.find(c => c.categoryId === categoryId);
    return category ? `${category.icon || ''} ${category.name}`.trim() : 'Sem categoria';
  };

  const getGroupType = (): string => {
    if (!group) return '';
    const hasFinancialIntent = group.metadata?.hasFinancialIntent === true;
    return hasFinancialIntent ? '💰 Grupo com recursos financeiros' : '👥 Grupo social';
  };

  const handleSaveSettings = async () => {
    if (!group || !id) return;

    setSaving(true);
    setSaveError(null);

    try {
      // 🔴 VALIDAÇÃO: Finalidade financeira não pode ser apagada se grupo é financeiro
      const hasFinancialIntent = group.metadata?.hasFinancialIntent === true;
      if (hasFinancialIntent && (!localFinancialPurpose || localFinancialPurpose.trim().length < 20)) {
        setSaveError('Finalidade dos recursos é obrigatória para grupos financeiros (mínimo 20 caracteres)');
        setSaving(false);
        return;
      }

      const updateInput: any = {
        description: localDescription || undefined,
        avatar_url: localAvatarUrl || undefined,
        cover_url: localCoverUrl || undefined,
        financial_purpose: hasFinancialIntent ? localFinancialPurpose : undefined,
        metadata: {
          ...group.metadata,
          rules_text: localRulesText || undefined,
        },
      };

      const updatedGroup = await updateGroup(id, updateInput);
      setGroup(updatedGroup);
      
      // Atualizar URLs locais após sucesso
      setLocalAvatarUrl(updatedGroup.avatarUrl);
      setLocalCoverUrl(updatedGroup.coverUrl);
      
      // Mostrar feedback de sucesso
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = (url: string) => {
    setLocalAvatarUrl(url);
    // Preview imediato - não precisa salvar ainda
  };

  const handleCoverUpload = (url: string) => {
    setLocalCoverUrl(url);
    // Preview imediato - não precisa salvar ainda
  };

  const handleRemoveAvatar = () => {
    setLocalAvatarUrl(undefined);
  };

  const handleRemoveCover = () => {
    setLocalCoverUrl(undefined);
  };

  const loadGroupFeed = async () => {
    if (!id || !activeActor) return;

    setFeedLoading(true);
    setFeedError(null);

    try {
      // Usar o mesmo endpoint do feed global, passando groupId como filtro
      // O endpoint requer actor_type e actor_id, que vêm do activeActor
      if (!activeActor) {
        setFeedError('Ator não encontrado');
        setFeedLoading(false);
        return;
      }
      
      const actorType = activeActor.actor_type === 'page' ? 'page' : 'user';
      const actorId = activeActor.actor_id;

      const response = await getFeed(feedCursor || undefined, 20, id, actorType, actorId);
      
      if (feedCursor) {
        // Append para paginação
        setFeedPosts((prev) => [...prev, ...response.posts]);
      } else {
        // Primeira carga
        setFeedPosts(response.posts);
      }

      setFeedCursor(response.next_cursor || null);
      setFeedHasMore(response.has_more);
    } catch (err) {
      console.error('Erro ao carregar feed do grupo:', err);
      setFeedError(err instanceof Error ? err.message : 'Erro ao carregar feed');
    } finally {
      setFeedLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!id || !activeActor || !newPostContent.trim()) return;

    setCreatingPost(true);
    try {
      if (!activeActor) {
        setFeedError('Ator não encontrado');
        setCreatingPost(false);
        return;
      }
      
      const actorId = activeActor.actor_id;

      // Criar post usando o mesmo método do feed global, passando groupId
      const newPost = await createPost({
        content: newPostContent.trim(),
        actor_id: actorId,
        group_id: id, // Vincular post ao grupo
      });

      // Limpar textarea
      setNewPostContent('');

      // Adicionar post no topo da lista (optimistic update)
      setFeedPosts((prev) => [newPost, ...prev]);

      // Recarregar feed para garantir sincronização
      setFeedCursor(null); // Reset cursor para recarregar do início
      await loadGroupFeed();
    } catch (err) {
      console.error('Erro ao criar post:', err);
      alert(err instanceof Error ? err.message : 'Erro ao criar post');
    } finally {
      setCreatingPost(false);
    }
  };


  if (loading) {
    return (
      <div className="group-detail-page">
        <div className="group-detail-container">
          <div className="group-detail-loading">
            <p>Carregando grupo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="group-detail-page">
        <div className="group-detail-container">
          <div className="group-detail-error">
            <p>{error || 'Grupo não encontrado'}</p>
            <button onClick={() => navigate('/grupos')} className="group-detail-back-button">
              Voltar para Grupos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group-detail-page">
      <div className="group-detail-container">
        {/* Header do Grupo */}
        <div className="group-detail-header">
          <button
            onClick={() => navigate('/grupos')}
            className="group-detail-back-link"
          >
            ← Voltar para Grupos
          </button>

          <div className="group-detail-cover">
            {isOwnerOrAdmin ? (
              <ImageUpload
                groupId={id!}
                type="cover"
                currentUrl={localCoverUrl || group.coverUrl}
                onUploadComplete={handleCoverUpload}
                onRemove={handleRemoveCover}
                disabled={saving}
              />
            ) : (
              <>
                {localCoverUrl || group.coverUrl ? (
                  <img src={localCoverUrl || group.coverUrl} alt={`Capa de ${group.name}`} className="group-cover-image" />
                ) : (
                  <div className="group-cover-placeholder" />
                )}
              </>
            )}
          </div>

          <div className="group-detail-info">
            <div className="group-avatar-section">
              {isOwnerOrAdmin ? (
                <ImageUpload
                  groupId={id!}
                  type="avatar"
                  currentUrl={localAvatarUrl || group.avatarUrl}
                  onUploadComplete={handleAvatarUpload}
                  onRemove={handleRemoveAvatar}
                  disabled={saving}
                />
              ) : (
                <>
                  {localAvatarUrl || group.avatarUrl ? (
                    <img
                      src={localAvatarUrl || group.avatarUrl}
                      alt={group.name}
                      className="group-avatar"
                    />
                  ) : (
                    <div className="group-avatar-placeholder">
                      {group.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="group-info-content">
              <h1 className="group-name">{group.name}</h1>
              <p className="group-category">{getCategoryName(group.categoryId)}</p>
              {group.description && (
                <p className="group-description">{group.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Mini-dashboard do Grupo */}
        {dashboard && (
          <div className="group-dashboard">
            <h3>Dashboard do Grupo</h3>
            <div className="group-dashboard-stats">
              <div className="group-dashboard-stat">
                <span className="group-dashboard-stat-label">Membros</span>
                <span className="group-dashboard-stat-value">{dashboard.membersCount}</span>
              </div>
              <div className="group-dashboard-stat">
                <span className="group-dashboard-stat-label">Eventos</span>
                <span className="group-dashboard-stat-value">{dashboard.eventsCount}</span>
              </div>
              {dashboard.postsCount !== null && (
                <div className="group-dashboard-stat">
                  <span className="group-dashboard-stat-label">Posts</span>
                  <span className="group-dashboard-stat-value">{dashboard.postsCount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="group-detail-tabs">
          <button
            className={`group-tab ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            Feed
          </button>
          <button
            className={`group-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Visão Geral
          </button>
          <button
            className={`group-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Membros
          </button>
          {isOwnerOrAdmin && (
            <button
              className={`group-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Gerenciamento
            </button>
          )}
        </div>

        {/* Links para Timeline, Votações e Campanhas */}
        <div className="group-detail-actions" style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/grupos/${id}/timeline`)}
            className="group-action-link"
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            📅 Timeline
          </button>
          <button
            onClick={() => navigate(`/grupos/${id}/votes`)}
            className="group-action-link"
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            🗳️ Votações
          </button>
          <button
            onClick={() => navigate(`/grupos/${id}/campaigns`)}
            className="group-action-link"
            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
          >
            🎯 Campanhas
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="group-detail-content">
          {activeTab === 'feed' && (
            <div className="group-tab-content">
              <div className="group-feed-header">
                <h2>Feed do Grupo</h2>
                <button
                  onClick={() => id && navigate(`/events/new?group_id=${id}`)}
                  className="group-create-event-button"
                  disabled={!activeActor || !id}
                >
                  + Criar Evento
                </button>
              </div>

              {/* Campo de criação de post */}
              <div className="group-feed-create-post">
                <textarea
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder="O que você está pensando?"
                  className="group-feed-post-input"
                  rows={4}
                  disabled={creatingPost || !activeActor}
                />
                <div className="group-feed-create-actions">
                  <button
                    onClick={handleCreatePost}
                    disabled={creatingPost || !newPostContent.trim() || !activeActor}
                    className="group-feed-post-button"
                  >
                    {creatingPost ? 'Publicando...' : 'Publicar'}
                  </button>
                </div>
              </div>
              
              {feedLoading && feedPosts.length === 0 && (
                <div className="group-feed-loading">
                  <p>Carregando feed...</p>
                </div>
              )}

              {feedError && (
                <div className="group-feed-error">
                  <p>{feedError}</p>
                </div>
              )}

              {!feedLoading && !feedError && feedPosts.length === 0 && (
                <div className="group-feed-empty">
                  <p>Este grupo ainda está em silêncio. Que tal fazer a primeira postagem?</p>
                  {activeActor && (
                    <button
                      onClick={() => {
                        // Focar no campo de texto
                        const textarea = document.querySelector('.group-feed-post-input') as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.focus();
                          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="group-feed-empty-action"
                    >
                      Criar primeira postagem
                    </button>
                  )}
                </div>
              )}

              {feedPosts.length > 0 && (
                <div className="group-feed-posts">
                  {feedPosts.map((post) => (
                    <div key={post.post_id} className="group-feed-post">
                      {post.actor && (
                        <div className="group-feed-post-header">
                          <img 
                            src={post.actor.avatar_url || '/default-avatar.png'} 
                            alt={post.actor.display_name}
                            className="group-feed-post-avatar"
                          />
                          <div className="group-feed-post-author">
                            <strong>{post.actor.display_name}</strong>
                            <span className="group-feed-post-date">
                              {new Date(post.created_at).toLocaleDateString('pt-BR', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="group-feed-post-content">
                        <p>{post.content}</p>
                      </div>
                      {post.media && post.media.length > 0 && (
                        <div className="group-feed-post-media">
                          {post.media.map((media) => (
                            <img 
                              key={media.media_id} 
                              src={media.url} 
                              alt="Post media"
                              className="group-feed-post-image"
                            />
                          ))}
                        </div>
                      )}
                      <div className="group-feed-post-actions">
                        <span>👍 {post.reactions_count || 0}</span>
                        <span>💬 {post.comments_count || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {feedHasMore && !feedLoading && (
                <button 
                  className="group-feed-load-more"
                  onClick={loadGroupFeed}
                >
                  Carregar mais
                </button>
              )}
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="group-tab-content">
              <h2>Informações do Grupo</h2>
              
              <div className="group-info-section">
                <div className="group-info-item">
                  <label>Tipo do Grupo</label>
                  <p className="group-info-value">{getGroupType()}</p>
                </div>

                {group.metadata?.hasFinancialIntent === true && group.financialPurpose && (
                  <div className="group-info-item">
                    <label>Finalidade dos Recursos</label>
                    <p className="group-info-value">{group.financialPurpose}</p>
                  </div>
                )}

                {group.metadata?.rules_text && (
                  <div className="group-info-item">
                    <label>Regras do Grupo</label>
                    <p className="group-info-value">{group.metadata.rules_text}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="group-tab-content">
              <div className="group-members-header">
                <h2>Membros do Grupo</h2>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowInviteForm(!showInviteForm)}
                    className="group-invite-button"
                  >
                    {showInviteForm ? '✕ Cancelar' : '+ Convidar'}
                  </button>
                )}
              </div>

              {/* Formulário de Convite */}
              {showInviteForm && isOwnerOrAdmin && (
                <div className="group-invite-form">
                  <label htmlFor="invite-user-id">
                    ID do Usuário (global_user_id)
                  </label>
                  <div className="group-invite-input-group">
                    <input
                      type="text"
                      id="invite-user-id"
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                      placeholder="Digite o ID do usuário a ser convidado"
                      className="group-invite-input"
                      disabled={inviting}
                    />
                    <button
                      onClick={handleCreateInvite}
                      disabled={inviting || !inviteUserId.trim()}
                      className="group-invite-submit-button"
                    >
                      {inviting ? 'Enviando...' : 'Enviar Convite'}
                    </button>
                  </div>
                  <small>Digite o global_user_id do usuário que deseja convidar</small>
                </div>
              )}

              {/* Lista de Convites Pendentes */}
              {isOwnerOrAdmin && invites.length > 0 && (
                <div className="group-invites-section">
                  <h3>Convites Pendentes</h3>
                  <div className="group-invites-list">
                    {invites.map((invite) => (
                      <div key={invite.inviteId} className="group-invite-card">
                        <div className="group-invite-info">
                          <span className="group-invite-user-id">
                            Usuário: {invite.invitedUserId.substring(0, 8)}...
                          </span>
                          <span className="group-invite-date">
                            Enviado em {new Date(invite.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span className="group-invite-status pending">⏳ Pendente</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de Membros */}
              {loadingMembers ? (
                <div className="group-members-loading">
                  <p>Carregando membros...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="group-members-empty">
                  <p>Este grupo ainda não tem membros.</p>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => setShowInviteForm(true)}
                      className="group-invite-button-secondary"
                    >
                      Convidar primeiro membro
                    </button>
                  )}
                </div>
              ) : (
                <div className="group-members-list">
                  {members.map((member) => {
                    const isOwner = member.role === 'owner'; // verdade do backend (era ownerUserId=undefined === userId → nunca marcava)
                    const canManage = canManageMember(member);
                    const isCurrentUser = !!currentUserId && member.userId === currentUserId; // match exato (removido substring fuzzy de UUID)

                    return (
                      <div key={member.userId} className="group-member-card">
                        <div className="group-member-avatar">
                          {member.userId.charAt(0).toUpperCase()}
                        </div>
                        <div className="group-member-info">
                          <div className="group-member-name">
                            {isCurrentUser ? 'Você' : `Membro ${member.userId.substring(0, 8)}`}
                            {isOwner && <span className="group-member-badge owner">👑 Owner</span>}
                            {!isOwner && member.role === 'admin' && <span className="group-member-badge admin">⚙️ Admin</span>}
                            {!isOwner && member.role === 'moderator' && <span className="group-member-badge moderator">🛡️ Moderador</span>}
                            {!isOwner && member.role === 'member' && <span className="group-member-badge member">👤 Membro</span>}
                          </div>
                          <div className="group-member-role">
                            {getRoleLabel(member.role)}
                          </div>
                          <div className="group-member-joined">
                            Membro desde {new Date(member.joinedAt).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        {canManage && (
                          <div className="group-member-actions">
                            {member.role === 'admin' ? (
                              <button
                                onClick={() => handleUpdateMemberRole(member.userId, 'member')}
                                className="group-member-action-btn demote"
                                title="Rebaixar para membro"
                              >
                                ⬇️ Rebaixar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateMemberRole(member.userId, 'admin')}
                                className="group-member-action-btn promote"
                                title="Promover para administrador"
                              >
                                ⬆️ Promover
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.userId, isCurrentUser ? 'você' : undefined)}
                              className="group-member-action-btn remove"
                              title="Remover do grupo"
                            >
                              ❌ Remover
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && isOwnerOrAdmin && (
            <div className="group-tab-content">
              <h2>Gerenciamento do Grupo</h2>

              {/* Economia do Grupo */}
              {groupEconomy && (
                <div className="group-economy-section">
                  <h3>Economia do Grupo</h3>
                  <div className="group-economy-info">
                    <div className="group-economy-item">
                      <strong>Total Recebido:</strong>{' '}
                      <span>{groupEconomy.currency === 'FIC' ? `${groupEconomy.totalIn.toFixed(2)} FIC` : `R$ ${(groupEconomy.totalIn / 100).toFixed(2)}`}</span>
                    </div>
                    <div className="group-economy-item">
                      <strong>Total Pago:</strong>{' '}
                      <span>{groupEconomy.currency === 'FIC' ? `${groupEconomy.totalOut.toFixed(2)} FIC` : `R$ ${(groupEconomy.totalOut / 100).toFixed(2)}`}</span>
                    </div>
                    <div className="group-economy-item">
                      <strong>Saldo:</strong>{' '}
                      <span>{groupEconomy.currency === 'FIC' ? `${groupEconomy.balance.toFixed(2)} FIC` : `R$ ${(groupEconomy.balance / 100).toFixed(2)}`}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Histórico do Grupo (fechamento) */}
              {groupClosureSummary && (
                <div className="group-closure-section">
                  <h3>Histórico do Grupo</h3>
                  <div className="group-closure-info">
                    <div className="group-closure-item">
                      <strong>Eventos ao longo da vida:</strong>{' '}
                      <span>{groupClosureSummary.lifetimeEvents}</span>
                    </div>
                    {groupClosureSummary.lifetimeEconomicVolume > 0 && (
                      <div className="group-closure-item">
                        <strong>Volume econômico total:</strong>{' '}
                        <span>R$ {(groupClosureSummary.lifetimeEconomicVolume / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="group-closure-item">
                      <strong>Criado em:</strong>{' '}
                      <span>{formatDateTime(groupClosureSummary.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Histórico de Estados */}
              {groupStateHistory.length > 0 && (
                <div className="group-state-history-section">
                  <h3>Histórico de Estados</h3>
                  <div className="group-state-history-timeline">
                    {groupStateHistory.map((entry, index) => (
                      <div key={index} className="group-state-history-item">
                        <div className="group-state-history-state">{entry.state}</div>
                        <div className="group-state-history-date">{formatDateTime(entry.changedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {saveError && (
                <div className="group-save-error">
                  <p>{saveError}</p>
                </div>
              )}

              <div className="group-settings-form">
                {/* Categoria (Read-Only) */}
                <div className="group-setting-item">
                  <label>
                    Categoria
                    <span className="group-readonly-badge" title="Este campo não pode ser alterado após a criação do grupo">
                      🔒 Somente leitura
                    </span>
                  </label>
                  <input
                    type="text"
                    value={getCategoryName(group.categoryId)}
                    readOnly
                    disabled
                    className="group-input-readonly"
                    title="Este campo não pode ser alterado após a criação do grupo"
                  />
                </div>

                {/* Tipo do Grupo (Read-Only) */}
                <div className="group-setting-item">
                  <label>
                    Tipo do Grupo
                    <span className="group-readonly-badge" title="Este campo não pode ser alterado após a criação do grupo">
                      🔒 Somente leitura
                    </span>
                  </label>
                  <input
                    type="text"
                    value={getGroupType()}
                    readOnly
                    disabled
                    className="group-input-readonly"
                    title="Este campo não pode ser alterado após a criação do grupo"
                  />
                </div>

                {/* Descrição (Editável) */}
                <div className="group-setting-item">
                  <label>Descrição do Grupo</label>
                  <textarea
                    value={localDescription}
                    onChange={(e) => setLocalDescription(e.target.value)}
                    rows={5}
                    maxLength={2000}
                    className="group-textarea"
                    placeholder="Descreva o propósito, objetivos e atividades do grupo..."
                  />
                  <small>{localDescription.length}/2000 caracteres</small>
                </div>

                {/* Finalidade Financeira (Editável, se grupo é financeiro) */}
                {group.metadata?.hasFinancialIntent === true && (
                  <div className="group-setting-item">
                    <label>
                      Finalidade dos Recursos *
                      <span className="group-required-badge">Obrigatório</span>
                    </label>
                    <textarea
                      value={localFinancialPurpose}
                      onChange={(e) => setLocalFinancialPurpose(e.target.value)}
                      rows={6}
                      minLength={20}
                      className="group-textarea"
                      placeholder="Explique de forma clara como os recursos financeiros do grupo serão utilizados..."
                      required
                    />
                    <small>
                      {localFinancialPurpose.length < 20 
                        ? `Mínimo de 20 caracteres (${localFinancialPurpose.length}/20)`
                        : `${localFinancialPurpose.length} caracteres`}
                    </small>
                  </div>
                )}

                {/* Regras do Grupo (Editável) */}
                <div className="group-setting-item">
                  <label>Regras do Grupo</label>
                  <textarea
                    value={localRulesText}
                    onChange={(e) => setLocalRulesText(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    className="group-textarea"
                    placeholder="Defina as regras e diretrizes do grupo..."
                  />
                  <small>{localRulesText.length}/5000 caracteres</small>
                </div>

                <div className="group-settings-actions">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="group-save-button"
                  >
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>

              <div className="group-info-note">
                <p><strong>Nota:</strong> Alguns campos não podem ser alterados após a criação do grupo:</p>
                <ul>
                  <li>Categoria</li>
                  <li>Tipo do grupo (financeiro/social)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
