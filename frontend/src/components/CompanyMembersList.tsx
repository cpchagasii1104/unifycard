// src/components/CompanyMembersList.tsx
// Componente para listar membros de uma empresa
// 🔴 BLINDAGEM: Frontend mínimo, NÃO UI de gestão completa

import { useState, useEffect } from 'react';
import {
  listCompanyMembers,
  type CompanyMember,
  CompanyMemberRole,
  CompanyMemberStatus,
} from '../api/companyMembers';
import './CompanyMembersList.css';

interface CompanyMembersListProps {
  companyId: string;
}

export default function CompanyMembersList({ companyId }: CompanyMembersListProps) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [companyId]);

  const loadMembers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCompanyMembers(companyId);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: CompanyMemberStatus): string => {
    switch (status) {
      case CompanyMemberStatus.ACTIVE:
        return 'Ativo';
      case CompanyMemberStatus.REVOKED:
        return 'Revogado';
      case CompanyMemberStatus.SUSPENDED:
        return 'Suspenso';
      default:
        return status;
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

  const getStatusClass = (status: CompanyMemberStatus): string => {
    switch (status) {
      case CompanyMemberStatus.ACTIVE:
        return 'status-active';
      case CompanyMemberStatus.REVOKED:
        return 'status-revoked';
      case CompanyMemberStatus.SUSPENDED:
        return 'status-suspended';
      default:
        return 'status-unknown';
    }
  };

  if (isLoading) {
    return <div className="company-members-loading">Carregando membros...</div>;
  }

  if (error) {
    return <div className="company-members-error">Erro: {error}</div>;
  }

  return (
    <div className="company-members-list">
      <h3>Membros da Empresa</h3>
      {members.length === 0 ? (
        <p>Nenhum membro cadastrado.</p>
      ) : (
        <ul className="members-list">
          {members.map(member => (
            <li key={member.memberId} className="member-item">
              <div className="member-info">
                <span className="member-actor-id">{member.actorId.substring(0, 8)}...</span>
                <span className={`member-role role-${member.role.toLowerCase()}`}>
                  {getRoleLabel(member.role)}
                </span>
                <span className={`member-status ${getStatusClass(member.status)}`}>
                  {getStatusLabel(member.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

