// frontend/src/components/company/tabs/CompanyTeamTab.tsx
// Aba Equipe & Permissões
//
// DECISION-0189 (F5): a criação direta de membro MORREU (backend: 410). A entrada de
// colaborador é o CONVITE CANÔNICO: lookup por código de indicação (diretório, zero poder)
// → seleção de permissões CONVIDÁVEIS (o servidor aplica os dois tetos) → token exibido
// UMA única vez (nunca em storage/analytics) → o convidado aceita em /convites.
// role = RÓTULO de UI (nunca autoridade); revogar = comando governado (revogação lógica).

import { useState, useEffect } from 'react';
import { useSession } from '../../../contexts/SessionProvider';
import {
  listCompanyMembers,
  updateCompanyMember,
  deleteCompanyMember,
  type CompanyMember,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '../../../api/companyMembers';
import {
  INVITABLE_PERMISSION_KEYS,
  lookupInviteeByReferralCode,
  createCompanyInvitation,
  listCompanyInvitations,
  revokeCompanyInvitation,
  type CompanyInvitation,
} from '../../../api/companyInvitations';
import { isAuthenticated, getTenantId } from '../../../config/auth';
import type { Company } from '../../../api/companies';
import { getNonActionText } from '../../../utils/canonical-language';
import { IrreversibilityMarker } from '../../../utils/action-nature';
import './CompanyTabs.css';

interface CompanyTeamTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyTeamTab({ companyId }: CompanyTeamTabProps) {
  const { sessionReady } = useSession();
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fluxo de convite
  const [referralCode, setReferralCode] = useState('');
  const [lookupResult, setLookupResult] = useState<{ globalUserId: string; displayName: string | null } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId()) {
      setLoading(false);
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionReady, companyId]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCompanyMembers(companyId);
      setMembers(data);
      // fila de convites exige manage_members — 403 é estado legítimo (membro comum)
      try {
        setInvitations(await listCompanyInvitations(companyId));
      } catch {
        setInvitations([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar equipe:', err);
      setError(err.message || 'Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async () => {
    setInviteError(null);
    setLookupResult(null);
    try {
      const person = await lookupInviteeByReferralCode(companyId, referralCode.trim());
      setLookupResult(person);
    } catch (err: any) {
      setInviteError(err.message || 'Pessoa não encontrada');
    }
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreateInvitation = async () => {
    if (!lookupResult) return;
    setInviteBusy(true);
    setInviteError(null);
    setIssuedToken(null);
    try {
      const out = await createCompanyInvitation(companyId, {
        inviteeGlobalUserId: lookupResult.globalUserId,
        permissionKeys: Array.from(selectedKeys),
      });
      setIssuedToken(out.token);
      setLookupResult(null);
      setReferralCode('');
      setSelectedKeys(new Set());
      await loadAll();
    } catch (err: any) {
      setInviteError(err.message || 'Erro ao criar convite');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      await revokeCompanyInvitation(companyId, invitationId);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Erro ao revogar convite');
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: CompanyMemberRole) => {
    try {
      // role é RÓTULO (DECISION-0189 §5) — nunca muda autoridade
      await updateCompanyMember(companyId, memberId, { role: newRole });
      await loadAll();
    } catch (err: any) {
      console.error('Erro ao atualizar rótulo:', err);
      alert(err.message || 'Erro ao atualizar rótulo');
    }
  };

  const handleRevokeMember = async (memberId: string) => {
    if (!confirm('Revogar o acesso deste membro? (revogação lógica — histórico preservado)')) {
      return;
    }
    try {
      await deleteCompanyMember(companyId, memberId);
      await loadAll();
    } catch (err: any) {
      console.error('Erro ao revogar acesso:', err);
      alert(err.message || 'Erro ao revogar acesso. Verifique se você tem permissão.');
    }
  };

  const getRoleLabel = (role: CompanyMemberRole): string => {
    switch (role) {
      case CompanyMemberRole.ADMIN: return 'Administrador';
      case CompanyMemberRole.STAFF: return 'Funcionário';
      case CompanyMemberRole.CONTRACTOR: return 'Contratado';
      default: return role;
    }
  };

  const getStatusLabel = (status: CompanyMemberStatus): string => {
    switch (status) {
      case CompanyMemberStatus.ACTIVE: return 'Ativo';
      case CompanyMemberStatus.SUSPENDED: return 'Suspenso';
      case CompanyMemberStatus.REVOKED: return 'Revogado';
      default: return status;
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
          <button onClick={loadAll}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      <div className="team-header">
        <h3>Equipe & Permissões</h3>
      </div>

      {/* Convite canônico (DECISION-0189 F5) */}
      <div className="team-invite-form">
        <h4>Convidar Colaborador</h4>
        <div className="form-group">
          <label>Código de indicação da pessoa (busca de diretório — não concede nada):</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="ex.: 1A2B3C4D"
              className="form-input"
            />
            <button type="button" className="form-submit" onClick={handleLookup} disabled={!referralCode.trim()}>
              Buscar
            </button>
          </div>
        </div>

        {lookupResult && (
          <>
            <div className="form-group">
              <strong>Pessoa:</strong> {lookupResult.displayName ?? 'Sem nome'}{' '}
              <span style={{ color: '#888', fontSize: '0.85rem' }}>({lookupResult.globalUserId.slice(0, 8)}…)</span>
            </div>
            <div className="form-group">
              <label>Permissões do convite (o servidor valida contra o SEU teto):</label>
              {INVITABLE_PERMISSION_KEYS.map((p) => (
                <label key={p.key} style={{ display: 'block', margin: '0.25rem 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(p.key)}
                    onChange={() => toggleKey(p.key)}
                  />{' '}
                  {p.label}
                </label>
              ))}
            </div>
            <IrreversibilityMarker />
            <button
              type="button"
              className="form-submit"
              onClick={handleCreateInvitation}
              disabled={inviteBusy}
            >
              {inviteBusy ? 'Criando…' : 'Criar convite'}
            </button>
          </>
        )}

        {inviteError && <div className="form-error">{inviteError}</div>}

        {issuedToken && (
          <div
            className="expectation-text"
            style={{
              marginTop: '1rem', padding: '0.75rem', background: '#f0f7f0',
              border: '1px solid #b7dfb9', borderRadius: '4px', fontSize: '0.9rem', lineHeight: 1.4,
            }}
          >
            <strong>Convite criado.</strong> Envie este código de aceite ao colaborador — ele aparece
            UMA única vez e só funciona para a pessoa convidada (em <code>/convites</code>):
            <div style={{ marginTop: '0.5rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{issuedToken}</div>
          </div>
        )}
      </div>

      {/* Convites pendentes */}
      {invitations.filter((i) => i.status === 'pending').length > 0 && (
        <div className="team-members-list" style={{ marginTop: '1rem' }}>
          <h4>Convites pendentes</h4>
          {invitations.filter((i) => i.status === 'pending').map((inv) => (
            <div key={inv.id} className="team-member-item">
              <div className="member-info">
                <div className="member-id">{inv.invitee_global_user_id.slice(0, 8)}…</div>
                <div className="member-role">{(inv.permission_keys ?? []).join(', ') || 'sem permissões'}</div>
                <div className="member-status">expira {new Date(inv.expires_at).toLocaleDateString()}</div>
              </div>
              <div className="member-actions">
                <button type="button" className="member-revoke-button" onClick={() => handleRevokeInvitation(inv.id)}>
                  Revogar convite
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de Membros */}
      {members.length === 0 ? (
        <div className="team-empty">
          <p>Nenhum membro cadastrado ainda.</p>
          <p style={{
            marginTop: '0.5rem', padding: '0.75rem', background: '#f8f9fa',
            border: '1px solid #e0e0e0', borderRadius: '4px', fontSize: '0.9rem',
            color: '#666', lineHeight: '1.4',
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
                <div className="member-role">{getRoleLabel(member.role)} <span style={{ color: '#999', fontSize: '0.8rem' }}>(rótulo)</span></div>
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
                {member.status !== CompanyMemberStatus.REVOKED && (
                  <button
                    onClick={() => handleRevokeMember(member.memberId)}
                    className="member-revoke-button"
                    type="button"
                  >
                    Revogar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
