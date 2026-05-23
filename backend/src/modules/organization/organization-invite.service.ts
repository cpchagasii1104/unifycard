// backend/src/modules/organization/organization-invite.service.ts
// SPRINT 78: Service para Organization Invites

import { organizationInviteRepository } from './organization-invite.repository';
import { organizationRoleRepository } from './organization-role.repository';
import { organizationMemberRepository } from './organization-member.repository';
import { organizationRoleService } from './organization-role.service';
import type {
  OrganizationInvite,
  OrganizationMember,
  InviteUserInput,
  AcceptInviteInput,
  OrganizationInviteFilters,
} from './organization.types';

/**
 * Service para Organization Invites
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Apenas OWNER ou ADMIN pode convidar
 * - Convite exige aceite explícito
 * - Aceite cria vínculo usuário ↔ organização
 * - Sem aceite = sem acesso
 * - Tudo explícito e auditável
 */
class OrganizationInviteService {
  /**
   * Convidar usuário
   * 
   * SPRINT 78: Apenas OWNER ou ADMIN pode convidar
   */
  async inviteUser(
    tenantId: string,
    input: InviteUserInput,
    invitedByUserId: string,
    invitedByActorId: string
  ): Promise<OrganizationInvite> {
    // Validar que quem convida tem permissão (OWNER ou ADMIN)
    await this.validateCanInvite(tenantId, invitedByUserId, invitedByActorId);

    // Buscar role
    const role = await organizationRoleRepository.getRoleByKey(tenantId, input.roleKey);
    if (!role) {
      throw new Error(`Papel não encontrado: ${input.roleKey}`);
    }

    // Validar email
    const email = input.email.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      throw new Error('Email inválido');
    }

    // Verificar se já existe convite pendente para este email
    const existingInvites = await organizationInviteRepository.listInvites(tenantId, {
      status: 'PENDING',
    });
    const existingInvite = existingInvites.find((inv) => inv.email === email);
    if (existingInvite) {
      throw new Error('Já existe um convite pendente para este email');
    }

    // Criar convite (expira em 7 dias)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await organizationInviteRepository.createInvite(tenantId, {
      email,
      roleId: role.id,
      invitedByUserId,
      expiresAt,
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_INVITE_CREATED',
      inviteId: invite.id,
      email: invite.email,
      roleKey: input.roleKey,
      invitedByUserId,
    });

    return invite;
  }

  /**
   * Aceitar convite
   * 
   * SPRINT 78: Aceite cria vínculo usuário ↔ organização
   */
  async acceptInvite(
    tenantId: string,
    input: AcceptInviteInput
  ): Promise<OrganizationMember> {
    // Buscar convite por token
    const invite = await organizationInviteRepository.getInviteByToken(input.token);
    if (!invite) {
      throw new Error('Convite não encontrado');
    }

    // Validar tenant
    if (invite.tenantId !== tenantId) {
      throw new Error('Convite não pertence a este tenant');
    }

    // Validar status
    if (invite.status !== 'PENDING') {
      throw new Error(`Convite não está pendente. Status: ${invite.status}`);
    }

    // Validar expiração
    if (invite.expiresAt < new Date()) {
      // Marcar como expirado
      await organizationInviteRepository.markAsExpired(tenantId, invite.id);
      throw new Error('Convite expirado');
    }

    // Validar que usuário existe e email corresponde
    const { runQueryWithTenant } = await import('@core/database/pool');
    const userRow = await runQueryWithTenant<{ user_id: string; email: string }>(tenantId, {
      text: `
      SELECT user_id, email
      FROM users
      WHERE tenant_id = $1 AND user_id = $2
      `,
      values: [tenantId, input.userId],
    });

    if (!userRow) {
      throw new Error('Usuário não encontrado');
    }

    const user = userRow;
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error('Email do usuário não corresponde ao convite');
    }

    // Marcar convite como aceito
    const acceptedInvite = await organizationInviteRepository.markAsAccepted(tenantId, invite.id);

    // Criar membro
    const member = await organizationMemberRepository.createMember(tenantId, {
      actorId: input.actorId,
      userId: input.userId,
      roleId: acceptedInvite.roleId,
    });

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_INVITE_ACCEPTED',
      inviteId: acceptedInvite.id,
      memberId: member.id,
      userId: input.userId,
    });

    return member;
  }

  /**
   * Revogar convite
   */
  async revokeInvite(
    tenantId: string,
    inviteId: string,
    revokedByUserId: string,
    revokedByActorId: string
  ): Promise<OrganizationInvite> {
    // Validar que quem revoga tem permissão (OWNER ou ADMIN)
    await this.validateCanInvite(tenantId, revokedByUserId, revokedByActorId);

    const revokedInvite = await organizationInviteRepository.revokeInvite(tenantId, inviteId);

    // Registrar auditoria
    await this.recordAudit(tenantId, {
      eventType: 'ORGANIZATION_INVITE_REVOKED',
      inviteId: revokedInvite.id,
      revokedByUserId,
    });

    return revokedInvite;
  }

  /**
   * Lista convites
   */
  async listInvites(
    tenantId: string,
    filters: OrganizationInviteFilters = {}
  ): Promise<OrganizationInvite[]> {
    return await organizationInviteRepository.listInvites(tenantId, filters);
  }

  /**
   * Busca convite por ID
   */
  async getInviteById(tenantId: string, inviteId: string): Promise<OrganizationInvite | null> {
    return await organizationInviteRepository.getInviteById(tenantId, inviteId);
  }

  /**
   * Busca convite por token
   */
  async getInviteByToken(token: string): Promise<OrganizationInvite | null> {
    return await organizationInviteRepository.getInviteByToken(token);
  }

  /**
   * Valida que usuário pode convidar (OWNER ou ADMIN)
   */
  private async validateCanInvite(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<void> {
    // Buscar membro
    const member = await organizationMemberRepository.getMemberByUser(tenantId, userId, actorId);
    if (!member || member.status !== 'ACTIVE') {
      throw new Error('Usuário não é membro ativo da organização');
    }

    // Buscar role
    const role = await organizationRoleRepository.getRoleById(tenantId, member.roleId);
    if (!role) {
      throw new Error('Papel não encontrado');
    }

    // Validar que é OWNER ou ADMIN
    if (role.roleKey !== 'OWNER' && role.roleKey !== 'ADMIN') {
      throw new Error('Apenas OWNER ou ADMIN pode convidar usuários');
    }
  }

  private async recordAudit(
    tenantId: string,
    data: {
      eventType: string;
      inviteId: string;
      email?: string;
      roleKey?: string;
      memberId?: string;
      userId?: string;
      invitedByUserId?: string;
      revokedByUserId?: string;
    }
  ): Promise<void> {
    try {
      const { auditService } = await import('@core/audit/audit.service');
      await auditService.record(tenantId, {
        event_type: data.eventType,
        severity: 'medium',
        actor_id: (data.invitedByUserId || data.revokedByUserId || data.userId) ?? undefined,
        actor_type: 'user',
        source: 'organization',
        context: {
          invite_id: data.inviteId,
          email: data.email,
          role_key: data.roleKey,
          member_id: data.memberId,
          user_id: data.userId,
          invited_by_user_id: data.invitedByUserId,
          revoked_by_user_id: data.revokedByUserId,
        },
      });
    } catch (error) {
      console.warn('[OrganizationInvite] Erro ao registrar auditoria:', error);
    }
  }
}

export const organizationInviteService = new OrganizationInviteService();





