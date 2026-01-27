// src/core/companies/company-members.service.ts
// Service para COMPANY MEMBERS
// 🔴 BLINDAGEM: Base estrutural, NÃO CRM/ERP completo
// 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário
// 🔴 BLINDAGEM: Empresa apenas associa, agenda e alerta

import { companyMembersRepository } from './company-members.repository';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { actorRegistryService } from '../actor-registry/actor-registry.service';
import { actorDelegationRepository } from '../actor-delegation/actor-delegation.repository';
import { pilotEventsService } from '../pilot/pilot-events.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import type {
  CompanyMember,
  CreateCompanyMemberInput,
  UpdateCompanyMemberInput,
  CompanyMemberFilters,
} from './company-members.types';
import { CompanyMemberStatus } from './company-members.types';

/**
 * Service para Company Members
 * 🔴 BLINDAGEM: Service apenas gerencia membros, não decide comportamento
 * 🔴 BLINDAGEM: Empresa NÃO pode editar agenda pessoal do funcionário
 */
class CompanyMembersService {
  /**
   * Cria um novo membro
   * 🔴 BLINDAGEM: companyId e actorId são OBRIGATÓRIOS
   * 🔴 BLINDAGEM: Actor deve ser do tipo 'user' (CPF)
   */
  async createMember(
    tenantId: string,
    userId: string,
    input: CreateCompanyMemberInput
  ): Promise<CompanyMember> {
    // 🔴 BLINDAGEM: Validar que companyId foi fornecido
    if (!input.companyId) {
      throw new BadRequestError('companyId é obrigatório para criar membro');
    }

    // 🔴 BLINDAGEM: Validar que actorId foi fornecido
    if (!input.actorId) {
      throw new BadRequestError('actorId é obrigatório para criar membro');
    }

    // 🔴 BLINDAGEM: Validar que actor existe e é do tipo 'user' (CPF)
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, input.actorId);
    if (!actor) {
      throw new NotFoundError('Actor não encontrado');
    }

    if (actor.actor_type !== 'user') {
      throw new BadRequestError('Actor deve ser do tipo "user" (CPF) para ser membro da empresa');
    }

    // 🔴 BLINDAGEM: Criar membro (empresa apenas associa, não edita agenda pessoal)
    const member = await companyMembersRepository.create(tenantId, input);

    // CONTINUOUS PRODUCTION: Criar delegação se membro está ativo
    if (member.status === CompanyMemberStatus.ACTIVE) {
      await this.createDelegationForMember(tenantId, member);
    }

    return member;
  }

  /**
   * Cria delegação para membro ativo
   */
  private async createDelegationForMember(
    tenantId: string,
    member: CompanyMember
  ): Promise<void> {
    // Buscar actor da company
    const actorRepository = socialPortsRegistry.getActorRepository();
    const companyActor = await actorRepository.findByCompanyId(tenantId, member.companyId);
    if (!companyActor) {
      return; // Company não tem actor ainda
    }

    // Registrar company no Actor Registry se não estiver
    await actorRegistryService.register(
      tenantId,
      companyActor.actor_id,
      'company',
      'companies',
      member.companyId
    );

    // Determinar scopes baseado no role
    const scopes = this.getScopesForRole(member.role);

    // Criar delegação
    const delegation = await actorDelegationRepository.create(tenantId, {
      userActorId: member.actorId,
      institutionalActorId: companyActor.actor_id,
      scopes,
      isTransitive: false,
    });

    // SPRINT 13: Observar primeira delegação (assíncrono, não bloqueia)
    pilotEventsService.recordEvent(tenantId, {
      eventType: 'first_delegation',
      actorId: member.actorId,
      actorType: 'user',
      metadata: {
        companyId: member.companyId,
        role: member.role,
      },
    }).catch((err) => {
      // Erro silencioso - não quebrar fluxo
      console.warn('[PilotObserver] Erro ao registrar evento de delegação:', err);
    });
  }

  /**
   * Obtém scopes baseado no role
   */
  private getScopesForRole(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['*']; // Admin tem todas as permissões
      case 'staff':
        return ['publish_feed', 'create_events'];
      case 'contractor':
        return ['publish_feed'];
      default:
        return [];
    }
  }

  /**
   * Busca membro por ID
   */
  async getMember(tenantId: string, memberId: string): Promise<CompanyMember> {
    const member = await companyMembersRepository.findById(tenantId, memberId);
    if (!member) {
      throw new NotFoundError('Membro não encontrado');
    }
    return member;
  }

  /**
   * Lista membros com filtros
   */
  async listMembers(
    tenantId: string,
    filters: CompanyMemberFilters
  ): Promise<CompanyMember[]> {
    return await companyMembersRepository.find(tenantId, filters);
  }

  /**
   * Atualiza membro
   * 🔴 BLINDAGEM: Empresa pode atualizar role/status, mas NÃO agenda pessoal
   */
  async updateMember(
    tenantId: string,
    memberId: string,
    userId: string,
    input: UpdateCompanyMemberInput
  ): Promise<CompanyMember> {
    // 🔴 BLINDAGEM: Validar que membro existe
    const existing = await companyMembersRepository.findById(tenantId, memberId);
    if (!existing) {
      throw new NotFoundError('Membro não encontrado');
    }

    // 🔴 BLINDAGEM: Atualizar membro (apenas role/status, não agenda pessoal)
    return await companyMembersRepository.update(tenantId, memberId, input);
  }

  /**
   * Remove membro (revoga delegação)
   * CONTINUOUS PRODUCTION: Revoga delegação imediatamente, mas mantém histórico
   */
  async removeMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<void> {
    // 🔴 BLINDAGEM: Validar que membro existe
    const existing = await companyMembersRepository.findById(tenantId, memberId);
    if (!existing) {
      throw new NotFoundError('Membro não encontrado');
    }

    // CONTINUOUS PRODUCTION: Revogar delegações relacionadas
    const actorRepository = socialPortsRegistry.getActorRepository();
    const companyActor = await actorRepository.findByCompanyId(tenantId, existing.companyId);
    if (companyActor) {
      const delegations = await actorDelegationRepository.findActiveByUserActor(
        tenantId,
        existing.actorId
      );
      
      for (const delegation of delegations) {
        if (delegation.institutionalActorId === companyActor.actor_id) {
          await actorDelegationRepository.revoke(tenantId, delegation.delegationId);
        }
      }
    }

    // 🔴 BLINDAGEM: Remover membro (mantém histórico)
    await companyMembersRepository.delete(tenantId, memberId);
  }

  /**
   * Ativa membro (muda status de 'invited' para 'active')
   * 🔴 BLINDAGEM: Ativação é apenas mudança de status, não edita agenda
   * CONTINUOUS PRODUCTION: Cria delegação quando ativado
   */
  async activateMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<CompanyMember> {
    const member = await this.updateMember(tenantId, memberId, userId, {
      status: CompanyMemberStatus.ACTIVE,
    });

    // Criar delegação quando membro é ativado
    if (member.status === CompanyMemberStatus.ACTIVE) {
      await this.createDelegationForMember(tenantId, member);
    }

    return member;
  }

  /**
   * Suspende membro (muda status para 'suspended')
   * 🔴 BLINDAGEM: Suspensão é apenas mudança de status, não edita agenda
   */
  async suspendMember(
    tenantId: string,
    memberId: string,
    userId: string
  ): Promise<CompanyMember> {
    return await this.updateMember(tenantId, memberId, userId, {
      status: CompanyMemberStatus.SUSPENDED,
    });
  }
}

export const companyMembersService = new CompanyMembersService();

