// src/pages/OrganizationMembersPage.tsx
// Lista de Membros da Organização
// SPRINT: Organization MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listOrganizationMembers,
  changeMemberRole,
  removeOrganizationMember,
  type OrganizationMember,
  type OrganizationMemberStatus,
  type OrganizationRoleKey,
} from '../api/organization';
import { getActorName } from '../utils/service-orders-helpers';
import { showToast } from '../components/common/Toast';
import './OrganizationMembersPage.css';

export default function OrganizationMembersPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrganizationMemberStatus | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<OrganizationRoleKey | 'ALL'>('ALL');
  const [memberNames, setMemberNames] = useState<Record<string, string | null>>({});

  useEffect(() => {
    loadMembers();
  }, [activeActor, statusFilter, roleFilter]);

  useEffect(() => {
    if (members.length > 0) {
      loadMemberNames();
    }
  }, [members]);

  const loadMembers = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;
      if (roleFilter !== 'ALL') filters.roleKey = roleFilter;

      const result = await listOrganizationMembers(filters);
      setMembers(result.members);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar membros');
      showToast(err.message || 'Erro ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberNames = async () => {
    const names: Record<string, string | null> = {};
    for (const member of members) {
      try {
        const name = await getActorName(member.actorId);
        names[member.actorId] = name;
      } catch (err) {
        names[member.actorId] = null;
      }
    }
    setMemberNames(names);
  };

  const handleChangeRole = async (memberId: string, roleKey: OrganizationRoleKey) => {
    if (!window.confirm('Deseja alterar o papel deste membro?')) {
      return;
    }

    try {
      await changeMemberRole(memberId, roleKey);
      showToast('Papel alterado com sucesso', 'success');
      loadMembers();
    } catch (err: any) {
      showToast(err.message || 'Erro ao alterar papel', 'error');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!window.confirm('Tem certeza que deseja remover este membro da organização?')) {
      return;
    }

    try {
      await removeOrganizationMember(memberId);
      showToast('Membro removido com sucesso', 'success');
      loadMembers();
    } catch (err: any) {
      showToast(err.message || 'Erro ao remover membro', 'error');
    }
  };

  const getRoleLabel = (roleKey: OrganizationRoleKey): string => {
    const labels: Record<OrganizationRoleKey, string> = {
      OWNER: 'Proprietário',
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      OPERATOR: 'Operador',
      FINANCE: 'Financeiro',
    };
    return labels[roleKey] || roleKey;
  };

  const getStatusLabel = (status: OrganizationMemberStatus): string => {
    return status === 'ACTIVE' ? 'Ativo' : 'Suspenso';
  };

  if (isLoading) {
    return (
      <div className="organization-members-page">
        <div className="loading">Carregando membros...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="organization-members-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadMembers}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-members-page">
      <div className="page-header">
        <button onClick={() => navigate(-1)}>← Voltar</button>
        <h1>Membros da Organização</h1>
        <button onClick={() => navigate('/organization/invites/new')} className="btn-primary">
          Convidar Usuário
        </button>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrganizationMemberStatus | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="SUSPENDED">Suspenso</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="role-filter">Papel:</label>
          <select
            id="role-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as OrganizationRoleKey | 'ALL')}
          >
            <option value="ALL">Todos</option>
            <option value="OWNER">Proprietário</option>
            <option value="ADMIN">Administrador</option>
            <option value="MANAGER">Gerente</option>
            <option value="OPERATOR">Operador</option>
            <option value="FINANCE">Financeiro</option>
          </select>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum membro encontrado.</p>
          <button onClick={() => navigate('/organization/invites/new')} className="btn-primary">
            Convidar Primeiro Membro
          </button>
        </div>
      ) : (
        <div className="members-list">
          {members.map((member) => (
            <div key={member.id} className="member-item">
              <div className="member-info">
                <div className="member-name">
                  {memberNames[member.actorId] || `${member.actorId.substring(0, 8)}...`}
                </div>
                <div className="member-details">
                  <span className="member-role">{getRoleLabel(member.roleId as OrganizationRoleKey)}</span>
                  <span className={`member-status status-${member.status.toLowerCase()}`}>
                    {getStatusLabel(member.status)}
                  </span>
                </div>
              </div>
              <div className="member-actions">
                <select
                  value={member.roleId}
                  onChange={(e) => handleChangeRole(member.id, e.target.value as OrganizationRoleKey)}
                  className="role-select"
                >
                  <option value="OWNER">Proprietário</option>
                  <option value="ADMIN">Administrador</option>
                  <option value="MANAGER">Gerente</option>
                  <option value="OPERATOR">Operador</option>
                  <option value="FINANCE">Financeiro</option>
                </select>
                <button onClick={() => handleRemove(member.id)} className="btn-remove">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

