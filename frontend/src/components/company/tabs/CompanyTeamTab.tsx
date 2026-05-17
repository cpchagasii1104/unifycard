// frontend/src/components/company/tabs/CompanyTeamTab.tsx
// CONTINUOUS PRODUCTION: Aba Equipe & Permissões - SPRINT 2

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import {
  listCompanyMembers,
  createCompanyMember,
  updateCompanyMember,
  deleteCompanyMember,
  type CompanyMember,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '../../../api/companyMembers';
import { isAuthenticated, getTenantId } from '../../../config/auth';
import type { Company } from '../../../api/companies';
import GuardedButton from '../../operational/GuardedButton';
import { useActionExecutor } from '../../../hooks/useActionExecutor';
import { executeInviteCompanyMember } from '../../../handlers/action-handlers';
import { getExpectationText, getNonActionText } from '../../../utils/canonical-language';
import { IrreversibilityMarker } from '../../../utils/action-nature';
import { PassiveConfirmation } from '../../../utils/functioning-evidence';
import ActionFeedback from '../../feedback/ActionFeedback';
import './CompanyTabs.css';

interface CompanyTeamTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyTeamTab({ company, companyId }: CompanyTeamTabProps) {
  const { sessionReady, activeActor } = useSession();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteActorId, setInviteActorId] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyMemberRole>(CompanyMemberRole.STAFF);
  
  const actionExecutor = useActionExecutor({
    actionType: 'invite_member',
    checkPendingActions: true,
    invalidateQueries: true,
    onSuccess: () => {
      // Recarregar membros após convite bem-sucedido
      loadMembers();
      setShowInviteForm(false);
      setInviteActorId('');
      setInviteRole(CompanyMemberRole.STAFF);
    },
  });

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId()) {
      setLoading(false);
      return;
    }

    loadMembers();
  }, [sessionReady, companyId]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await listCompanyMembers(companyId);
      setMembers(data);
    } catch (err: any) {
      console.error('Erro ao carregar membros:', err);
      setError(err.message || 'Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteActorId.trim()) {
      return; // Validação será feita pelo executor
    }

    await actionExecutor.execute(
      () => executeInviteCompanyMember(companyId, {
        actorId: inviteActorId.trim(),
        role: inviteRole,
        status: CompanyMemberStatus.ACTIVE,
      })
    );
  };

  const handleUpdateRole = async (memberId: string, newRole: CompanyMemberRole) => {
    try {
      await updateCompanyMember(companyId, memberId, { role: newRole });
      await loadMembers();
    } catch (err: any) {
      console.error('Erro ao atualizar role:', err);
      alert(err.message || 'Erro ao atualizar permissões');
    }
  };

  const handleRevoke = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste membro?')) {
      return;
    }

    try {
      await deleteCompanyMember(companyId, memberId);
      await loadMembers();
    } catch (err: any) {
      console.error('Erro ao revogar acesso:', err);
      alert(err.message || 'Erro ao revogar acesso. Verifique se você tem permissão.');
    }
  };

  const getRoleLabel = (role: CompanyMemberRole): string => {
    switch (role) {
      case CompanyMemberRole.ADMIN:
        return 'Administrador';
      case CompanyMemberRole.STAFF:
        return 'Funcionário';
      case CompanyMemberRole.CONTRACTOR:
        return 'Contratado';
      default:
        return role;
    }
  };

  const getStatusLabel = (status: CompanyMemberStatus): string => {
    switch (status) {
      case CompanyMemberStatus.ACTIVE:
        return 'Ativo';
      case CompanyMemberStatus.INVITED:
        return 'Convidado';
      case CompanyMemberStatus.SUSPENDED:
        return 'Suspenso';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="company-tab-content">
        <div className="company-tab-loading">
          <div className="skeleton skeleton-item" />
          <div className="skeleton skeleton-item" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="company-tab-content">
        <div className="company-tab-error">
          <p>Erro: {error}</p>
          <button onClick={loadMembers}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      {actionExecutor.result && (
        <ActionFeedback result={actionExecutor.result} />
      )}

      <div className="team-header">
        <h3>Equipe & Permissões</h3>
        {/*
          DT-ORGANIZATION-SPRINT78-FROZEN (2026-05-16): 4 botões de
          navegação para /organization/{members,invites,roles,units}
          foram removidos. Rotas retornam HTTP 500 em runtime — tabelas
          organization_* não existem (Sprint 78 congelada via DECISION-0042).
          Restaurar este bloco quando Sprint 78 for descongelada.
        */}
      </div>

      {/* Formulário de Convite */}
      {showInviteForm && (
        <div className="team-invite-form">
          <h4>Convidar Colaborador</h4>
          <div className="form-group">
            <label>Actor ID (UUID do usuário):</label>
            <input
              type="text"
              value={inviteActorId}
              onChange={(e) => setInviteActorId(e.target.value)}
              placeholder="UUID do actor"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Papel:</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as CompanyMemberRole)}
              className="form-select"
            >
              <option value={CompanyMemberRole.STAFF}>Funcionário</option>
              <option value={CompanyMemberRole.ADMIN}>Administrador</option>
              <option value={CompanyMemberRole.CONTRACTOR}>Contratado</option>
            </select>
          </div>
          {actionExecutor.result && !actionExecutor.result.success && (
            <div className="form-error">{actionExecutor.result.message}</div>
          )}
          {/* SPRINT 17: Microtexto de expectativa */}
          <div className="expectation-text" style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            background: '#f8f9fa', 
            border: '1px solid #e0e0e0', 
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#666',
            lineHeight: '1.4'
          }}>
            {getExpectationText('inviteCollaborator')}
          </div>
          {/* SPRINT 18: Marcação de irreversibilidade */}
          <IrreversibilityMarker />
          <button
            onClick={handleInvite}
            disabled={actionExecutor.executing || !inviteActorId.trim()}
            className="form-submit"
            type="button"
          >
            {actionExecutor.executing ? 'Enviando...' : 'Convidar'}
          </button>
          {/* SPRINT 21: Evidência de funcionamento após ação bem-sucedida */}
          {actionExecutor.result?.success && (
            <PassiveConfirmation type="delegation" />
          )}
        </div>
      )}

      {/* Lista de Membros */}
      {members.length === 0 ? (
        <div className="team-empty">
          <p>Nenhum membro cadastrado ainda.</p>
          {/* SPRINT 17: Consequência da não-ação */}
          <p style={{ 
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#666',
            lineHeight: '1.4'
          }}>
            {getNonActionText('memberInvitation')}
          </p>
        </div>
      ) : (
        <div className="team-members-list">
          {members.map((member) => (
            <div key={member.memberId} className="team-member-item">
              <div className="member-info">
                <div className="member-id">{member.actorId.substring(0, 8)}...</div>
                <div className="member-role">{getRoleLabel(member.role)}</div>
                <div className={`member-status status-${member.status}`}>
                  {getStatusLabel(member.status)}
                </div>
              </div>
              <div className="member-actions">
                <select
                  value={member.role}
                  onChange={(e) => handleUpdateRole(member.memberId, e.target.value as CompanyMemberRole)}
                  className="member-role-select"
                >
                  <option value={CompanyMemberRole.STAFF}>Funcionário</option>
                  <option value={CompanyMemberRole.ADMIN}>Administrador</option>
                  <option value={CompanyMemberRole.CONTRACTOR}>Contratado</option>
                </select>
                <button
                  onClick={() => handleRevoke(member.memberId)}
                  className="member-revoke-button"
                  type="button"
                >
                  Revogar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


