// src/pages/OrganizationInvitesPage.tsx
// Lista de Convites da Organização
// SPRINT: Organization MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listOrganizationInvites,
  revokeOrganizationInvite,
  type OrganizationInvite,
  type OrganizationInviteStatus,
} from '../api/organization';
import { showToast } from '../components/common/Toast';
import './OrganizationInvitesPage.css';

export default function OrganizationInvitesPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrganizationInviteStatus | 'ALL'>('ALL');

  useEffect(() => {
    loadInvites();
  }, [activeActor, statusFilter]);

  const loadInvites = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      const result = await listOrganizationInvites(filters);
      setInvites(result.invites);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar convites');
      showToast(err.message || 'Erro ao carregar convites');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!window.confirm('Tem certeza que deseja revogar este convite?')) {
      return;
    }

    try {
      await revokeOrganizationInvite(inviteId);
      showToast('Convite revogado com sucesso', 'success');
      loadInvites();
    } catch (err: any) {
      showToast(err.message || 'Erro ao revogar convite', 'error');
    }
  };

  const getStatusLabel = (status: OrganizationInviteStatus): string => {
    const labels: Record<OrganizationInviteStatus, string> = {
      PENDING: 'Pendente',
      ACCEPTED: 'Aceito',
      REJECTED: 'Rejeitado',
      EXPIRED: 'Expirado',
    };
    return labels[status] || status;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="organization-invites-page">
        <div className="loading">Carregando convites...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="organization-invites-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadInvites}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-invites-page">
      <div className="page-header">
        <button onClick={() => navigate(-1)}>← Voltar</button>
        <h1>Convites Enviados</h1>
        <button onClick={() => navigate('/organization/invites/new')} className="btn-primary">
          Novo Convite
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrganizationInviteStatus | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="ACCEPTED">Aceito</option>
            <option value="REJECTED">Rejeitado</option>
            <option value="EXPIRED">Expirado</option>
          </select>
        </div>
      </div>

      {invites.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum convite encontrado.</p>
          <button onClick={() => navigate('/organization/invites/new')} className="btn-primary">
            Enviar Primeiro Convite
          </button>
        </div>
      ) : (
        <div className="invites-list">
          {invites.map((invite) => (
            <div key={invite.id} className="invite-item">
              <div className="invite-info">
                <div className="invite-email">{invite.email}</div>
                <div className="invite-details">
                  <span className={`invite-status status-${invite.status.toLowerCase()}`}>
                    {getStatusLabel(invite.status)}
                  </span>
                  <span className="invite-date">
                    Enviado em: {formatDate(invite.createdAt)}
                  </span>
                  {invite.expiresAt && (
                    <span className="invite-expires">
                      Expira em: {formatDate(invite.expiresAt)}
                    </span>
                  )}
                  {invite.acceptedAt && (
                    <span className="invite-accepted">
                      Aceito em: {formatDate(invite.acceptedAt)}
                    </span>
                  )}
                </div>
              </div>
              {invite.status === 'PENDING' && (
                <div className="invite-actions">
                  <button onClick={() => handleRevoke(invite.id)} className="btn-revoke">
                    Revogar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

