// src/pages/OrganizationInvitePage.tsx
// Formulário de Convite para Organização
// SPRINT: Organization MVP

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  inviteUserToOrganization,
  listOrganizationRoles,
  type InviteUserInput,
  type OrganizationRole,
  type OrganizationRoleKey,
} from '../api/organization';
import { showToast } from '../components/common/Toast';
import './OrganizationInvitePage.css';

export default function OrganizationInvitePage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [formData, setFormData] = useState<InviteUserInput>({
    email: '',
    roleKey: 'OPERATOR',
  });

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const result = await listOrganizationRoles();
      setRoles(result.roles);
      if (result.roles.length > 0 && !formData.roleKey) {
        setFormData(prev => ({ ...prev, roleKey: result.roles[0].roleKey }));
      }
    } catch (err) {
      console.error('Erro ao carregar papéis:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      showToast('Email é obrigatório');
      return;
    }

    if (!formData.roleKey) {
      showToast('Papel é obrigatório');
      return;
    }

    setIsSubmitting(true);

    try {
      await inviteUserToOrganization(formData);
      showToast('Convite enviado com sucesso', 'success');
      navigate('/organization/members');
    } catch (err: any) {
      showToast(err.message || 'Erro ao enviar convite', 'error');
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="organization-invite-page">
      <div className="page-header">
        <button onClick={() => navigate('/organization/members')}>← Voltar</button>
        <h1>Convidar Usuário</h1>
      </div>

      <form onSubmit={handleSubmit} className="invite-form">
        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="usuario@exemplo.com"
            required
          />
          <p className="form-hint">O usuário receberá um email com o convite</p>
        </div>

        <div className="form-group">
          <label htmlFor="roleKey">Papel *</label>
          <select
            id="roleKey"
            value={formData.roleKey}
            onChange={(e) => setFormData(prev => ({ ...prev, roleKey: e.target.value as OrganizationRoleKey }))}
            required
          >
            {roles.map((role) => (
              <option key={role.id} value={role.roleKey}>
                {getRoleLabel(role.roleKey)} {role.description ? `- ${role.description}` : ''}
              </option>
            ))}
          </select>
          <p className="form-hint">O papel define as permissões do usuário na organização</p>
        </div>

        <div className="form-actions">
          <button type="button" onClick={() => navigate('/organization/members')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Enviando...' : 'Enviar Convite'}
          </button>
        </div>
      </form>
    </div>
  );
}

