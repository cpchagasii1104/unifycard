// src/pages/InvitesPage.tsx
// Página de inbox de convites para grupos

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyInvites, acceptGroupInvite, declineGroupInvite, getGroup, type GroupInvite, type Group } from '../api/groups';
import { replaceImplicitTime } from '../utils/temporal-state';
import { ClosureText, MemoryText } from '../utils/closure-continuity';
import './InvitesPage.css';

export default function InvitesPage() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingInvites, setProcessingInvites] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadInvites();
  }, []);

  const isExpired = (expiresAt?: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt?: string | null): boolean => {
    if (!expiresAt) return false;
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilExpiry > 0 && hoursUntilExpiry < 48;
  };

  const formatExpiryDate = (expiresAt?: string | null): string => {
    if (!expiresAt) return 'Sem data de expiração';
    const date = new Date(expiresAt);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadInvites = async () => {
    setLoading(true);
    setError(null);

    try {
      // Carregar apenas convites pendentes
      const invitesData = await getMyInvites('pending');
      const allInvites = invitesData.invites || [];

      // Filtrar convites expirados
      const validInvites = allInvites.filter(invite => !isExpired(invite.expiresAt));
      setInvites(validInvites);

      // Carregar informações dos grupos para cada convite
      const groupsMap: Record<string, Group> = {};
      await Promise.all(
        validInvites.map(async (invite) => {
          try {
            const group = await getGroup(invite.groupId);
            groupsMap[invite.groupId] = group;
          } catch (err) {
            console.warn(`Erro ao carregar grupo ${invite.groupId}:`, err);
            // Continuar mesmo se um grupo falhar
          }
        })
      );
      setGroups(groupsMap);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (invite: GroupInvite) => {
    if (processingInvites.has(invite.inviteId)) return;

    setProcessingInvites((prev) => new Set(prev).add(invite.inviteId));

    try {
      await acceptGroupInvite(invite.groupId, invite.inviteId);
      
      // Remover convite da lista
      setInvites((prev) => prev.filter((inv) => inv.inviteId !== invite.inviteId));
      
      // 🔴 ATUALIZAR BADGE: Disparar evento para atualizar badge no menu
      window.dispatchEvent(new CustomEvent('group-invite-updated'));
      
      // Feedback de sucesso
      alert('Convite aceito! Você agora é membro do grupo.');
      
      // Opcional: Redirecionar para o grupo
      // navigate(`/grupos/${invite.groupId}`);
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      alert(err instanceof Error ? err.message : 'Erro ao aceitar convite');
    } finally {
      setProcessingInvites((prev) => {
        const next = new Set(prev);
        next.delete(invite.inviteId);
        return next;
      });
    }
  };

  const handleDeclineInvite = async (invite: GroupInvite) => {
    if (processingInvites.has(invite.inviteId)) return;

    const confirmed = window.confirm('Tem certeza que deseja recusar este convite?');
    if (!confirmed) return;

    setProcessingInvites((prev) => new Set(prev).add(invite.inviteId));

    try {
      await declineGroupInvite(invite.groupId, invite.inviteId);
      
      // Remover convite da lista
      setInvites((prev) => prev.filter((inv) => inv.inviteId !== invite.inviteId));
      
      // 🔴 ATUALIZAR BADGE: Disparar evento para atualizar badge no menu
      window.dispatchEvent(new CustomEvent('group-invite-updated'));
    } catch (err) {
      console.error('Erro ao recusar convite:', err);
      alert(err instanceof Error ? err.message : 'Erro ao recusar convite');
    } finally {
      setProcessingInvites((prev) => {
        const next = new Set(prev);
        next.delete(invite.inviteId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="invites-page">
        <div className="invites-container">
          <div className="invites-loading">
            <p>Carregando convites...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invites-page">
        <div className="invites-container">
          <div className="invites-error">
            <p>{error}</p>
            <button onClick={loadInvites} className="invites-retry-button">
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invites-page">
      <div className="invites-container">
        <div className="invites-header">
          <h1>Convites de Grupos</h1>
          <button
            onClick={() => navigate('/grupos')}
            className="invites-back-button"
          >
            ← Voltar para Grupos
          </button>
        </div>

        {invites.length === 0 ? (
          <div className="invites-empty">
            <div className="invites-empty-icon">📬</div>
            <p>Você não tem convites pendentes</p>
            <button
              onClick={() => navigate('/grupos')}
              className="invites-explore-button"
            >
              Explorar Grupos
            </button>
          </div>
        ) : (
          <div className="invites-list">
            {invites.map((invite) => {
              const group = groups[invite.groupId];
              const isProcessing = processingInvites.has(invite.inviteId);
              const expired = isExpired(invite.expiresAt);
              const expiringSoon = isExpiringSoon(invite.expiresAt);

              return (
                <div key={invite.inviteId} className={`invite-card ${expiringSoon ? 'expiring-soon' : ''}`}>
                  {expiringSoon && (
                    <div className="invite-expiry-warning">
                      ⏰ Expira em breve
                    </div>
                  )}

                  <div className="invite-card-header">
                    {group?.avatarUrl ? (
                      <img
                        src={group.avatarUrl}
                        alt={group.name}
                        className="invite-group-avatar"
                      />
                    ) : (
                      <div className="invite-group-avatar-placeholder">
                        {group?.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="invite-card-info">
                      <h3 className="invite-group-name">
                        {group?.name || 'Grupo desconhecido'}
                      </h3>
                      <p className="invite-invited-by">
                        Convidado por: {invite.invitedByUserId.substring(0, 8)}...
                      </p>
                      {/* SPRINT 19: Tempo explícito ao invés de "Pendente" */}
                      <p className="invite-date">
                        {replaceImplicitTime('pending', invite.createdAt, { includeAbsolute: true })}
                      </p>
                      {invite.expiresAt && (
                        <p className="invite-expiry-date">
                          Expira em: {formatExpiryDate(invite.expiresAt)}
                        </p>
                      )}
                      <p className="invite-status">
                        Status: <span className="status-badge pending">Pendente</span>
                      </p>
                    </div>
                  </div>

                  {/* SPRINT 20: Encerramento explícito para convites expirados/aceitos/recusados */}
                  {(expired || invite.status === 'accepted' || invite.status === 'declined') && (
                    <ClosureText type="invite" />
                  )}
                  {/* SPRINT 20: Memória institucional para convites processados */}
                  {(invite.status === 'accepted' || invite.status === 'declined' || expired) && (
                    <MemoryText type="processed" />
                  )}

                  {group?.description && (
                    <p className="invite-group-description">
                      {group.description.length > 150
                        ? `${group.description.substring(0, 150)}...`
                        : group.description}
                    </p>
                  )}

                  {invite.status === 'pending' && !expired && (
                    <div className="invite-card-actions">
                      <button
                        onClick={() => handleAcceptInvite(invite)}
                        disabled={isProcessing || expired}
                        className="invite-action-button accept"
                      >
                        {isProcessing ? 'Processando...' : '✓ Aceitar'}
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(invite)}
                        disabled={isProcessing || expired}
                        className="invite-action-button decline"
                      >
                        {isProcessing ? 'Processando...' : '✕ Recusar'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

