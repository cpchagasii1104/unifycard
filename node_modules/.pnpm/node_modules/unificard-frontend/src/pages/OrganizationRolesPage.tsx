// src/pages/OrganizationRolesPage.tsx
// Lista de Papéis da Organização (Read-only)
// SPRINT: Organization MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listOrganizationRoles,
  type OrganizationRole,
  type OrganizationRoleKey,
} from '../api/organization';
import { showToast } from '../components/common/Toast';
import './OrganizationRolesPage.css';

export default function OrganizationRolesPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
  }, [activeActor]);

  const loadRoles = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await listOrganizationRoles();
      setRoles(result.roles);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar papéis');
      showToast(err.message || 'Erro ao carregar papéis');
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="organization-roles-page">
        <div className="loading">Carregando papéis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="organization-roles-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadRoles}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="organization-roles-page">
      <div className="page-header">
        <button onClick={() => navigate(-1)}>← Voltar</button>
        <h1>Papéis da Organização</h1>
      </div>

      <div className="info-banner">
        <p>Os papéis definem as permissões dos membros na organização. A criação e edição de papéis é gerenciada pelo sistema.</p>
      </div>

      {roles.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum papel encontrado.</p>
        </div>
      ) : (
        <div className="roles-list">
          {roles.map((role) => (
            <div key={role.id} className="role-item">
              <div className="role-header">
                <span className="role-key">{getRoleLabel(role.roleKey)}</span>
                <span className="role-id">ID: {role.id.substring(0, 8)}...</span>
              </div>
              {role.description && (
                <div className="role-description">{role.description}</div>
              )}
              <div className="role-meta">
                <span>Criado em: {new Date(role.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

