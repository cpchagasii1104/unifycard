// src/modules/groups/groups.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK

import { groupsRepository } from './groups.repository';
import { bankIntegrationService } from '../bank/bank-integration.service';
import { eventBus } from '@core/events/event-bus';
import { devLog } from '@utils/devLog';
import { groupCreationPolicy } from './policies/GroupCreationPolicy';
import { runQueryWithTenant } from '@core/database/pool';
import { BadRequestError } from '@core/errors';
import { worldService } from '@core/world/services/world.service';
import type { Group, GroupMember, CreateGroupInput, UpdateGroupInput, GroupWithMembers, GroupInvite, GroupInviteStatus, CreateGroupInviteInput } from './groups.types';
import { ensureUserActor } from '@modules/identity/actor-writer.service';

class GroupsService {
  /**
   * Valida se a hierarquia de localização está correta (país → estado → cidade)
   * 🔴 REUTILIZA: Usa worldService.validateLocation para evitar duplicação
   * @param countryId - ID do país (opcional)
   * @param stateId - ID do estado (opcional)
   * @param cityId - ID da cidade (opcional)
   * @throws BadRequestError se a hierarquia for inválida
   */
  private async validateLocationHierarchy(
    countryId?: string | null,
    stateId?: string | null,
    cityId?: string | null
  ): Promise<void> {
    await worldService.validateLocation(countryId, stateId, cityId);
  }

  /**
   * Valida se a categoria existe e é de escopo permitido para grupos
   * @param tenantId - ID do tenant
   * @param categoryId - ID da categoria a validar (opcional)
   * @throws BadRequestError com mensagem "Categoria inválida ou fora do escopo permitido" se inválida
   */
  private async validateCategoryForGroup(tenantId: string, categoryId?: string | null): Promise<void> {
    // Se não há category_id, não precisa validar
    if (!categoryId) {
      return;
    }

    // Buscar categoria usando categoriesService canônico
    const { categoriesService } = await import('@core/categories/categories.service');
    const category = await categoriesService.getCategoryById(categoryId);

    // Verificar se categoria existe
    if (!category) {
      throw new BadRequestError('Categoria não encontrada');
    }

    // Verificar se escopo é 'group'
    if (category.scope !== 'group') {
      throw new BadRequestError(`Categoria inválida: apenas categorias com scope 'group' são permitidas (scope atual: '${category.scope}')`);
    }
  }

  /**
   * Busca a categoria raiz (level = 0) de uma categoria
   * @param categoryId - ID da categoria
   * @returns Categoria raiz ou null se não encontrada
   */
  private async getRootCategory(categoryId: string): Promise<any | null> {
    const { CategoryRepository } = await import('@core/categories/categories.repository');
    const categoryRepository = new CategoryRepository();

    let currentCategory = await categoryRepository.findById(categoryId);
    if (!currentCategory) {
      return null;
    }

    // Subir na hierarquia até level = 0
    while (currentCategory.level > 0 && currentCategory.parent_id) {
      const parent = await categoryRepository.findById(currentCategory.parent_id);
      if (!parent) {
        break;
      }
      currentCategory = parent;
    }

    return currentCategory.level === 0 ? currentCategory : null;
  }

  /**
   * Valida se o coverage_type (scope) do grupo é permitido pela categoria
   * @param categoryId - ID da categoria selecionada
   * @param coverageType - Tipo de abrangência do grupo ('national', 'state', 'city', 'neighborhood')
   * @throws BadRequestError se o coverage_type não for permitido
   */
  private async validateCoverageType(categoryId: string, coverageType: string): Promise<void> {
    const { CategoryRepository } = await import('@core/categories/categories.repository');
    const categoryRepository = new CategoryRepository();

    // Buscar categoria selecionada
    const category = await categoryRepository.findById(categoryId);
    if (!category) {
      throw new BadRequestError('Categoria não encontrada');
    }

    // Verificar se categoria tem scope = 'group'
    // Nota: O campo scope indica o contexto da categoria (group, company, event, etc)
    // Vamos assumir que categorias de grupos devem ter scope = 'group' ou 'groups'
    const categoryScope = (category as any).scope;
    if (categoryScope && categoryScope !== 'group' && categoryScope !== 'groups') {
      throw new BadRequestError('Categoria não é válida para grupos');
    }

    // Verificar se é leaf (level > 0)
    if (category.level === 0) {
      throw new BadRequestError('Categoria raiz não pode ser selecionada diretamente. Selecione uma subcategoria.');
    }

    // Buscar categoria raiz
    const rootCategory = await this.getRootCategory(categoryId);
    if (!rootCategory) {
      throw new BadRequestError('Categoria raiz não encontrada');
    }

    // Verificar se metadata.allowed_scopes existe
    // REGRA CANÔNICA: CategoryRepository já normaliza allowed_scopes para categorias raiz de grupo
    const metadata = (rootCategory as any).metadata || {};
    let allowedScopes = metadata.allowed_scopes;

    // Fallback: se ainda não tiver (edge case), aplicar default canônico
    if (!allowedScopes || !Array.isArray(allowedScopes) || allowedScopes.length === 0) {
      const rootScope = (rootCategory as any).scope;
      if (rootScope === 'group' && (rootCategory as any).level === 0) {
        // Default canônico para categorias raiz de grupo
        allowedScopes = ['national', 'state', 'city', 'neighborhood'];
      } else {
        throw new BadRequestError('Categoria raiz não possui lista de abrangências permitidas (allowed_scopes)');
      }
    }

    // Verificar se coverage_type está em allowed_scopes
    if (!allowedScopes.includes(coverageType)) {
      throw new BadRequestError(
        `Abrangência '${coverageType}' não é permitida para esta categoria. ` +
        `Abrangências permitidas: ${allowedScopes.join(', ')}`
      );
    }
  }

  /**
   * Verifica se algum identificador civil (user row / global / legado) resolve
   * para o mesmo actor que é dono do grupo (§4.8).
   */
  private async requesterMatchesOwnerActor(
    tenantId: string,
    ownerActorId: string,
    primaryUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<boolean> {
    const candidates = [primaryUserId, userContext?.globalUserId, userContext?.id].filter(
      (x): x is string => typeof x === 'string' && x.length > 0
    );
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      try {
        const actor = await ensureUserActor(tenantId, candidate);
        if (actor.actor_id === ownerActorId) return true;
      } catch {
        continue;
      }
    }
    return false;
  }

  private async memberUserIdIsGroupOwnerActor(
    tenantId: string,
    ownerActorId: string,
    memberUserId: string
  ): Promise<boolean> {
    try {
      const actor = await ensureUserActor(tenantId, memberUserId);
      return actor.actor_id === ownerActorId;
    } catch {
      return false;
    }
  }

  async createGroup(
    tenantId: string,
    ownerUserId: string,
    input: CreateGroupInput
  ): Promise<Group> {
    // 🔴 VALIDAÇÃO: Finalidade dos recursos é obrigatória se tem intenção financeira
    const hasFinancialIntent = input.metadata?.hasFinancialIntent === true;
    if (hasFinancialIntent && (!input.financial_purpose || input.financial_purpose.trim().length < 20)) {
      throw new Error('Finalidade dos recursos é obrigatória quando o grupo movimenta recursos financeiros (mínimo 20 caracteres)');
    }

    // 🔴 PREENCHIMENTO AUTOMÁTICO: Preencher country_id e state_id com base em city_id
    if (input.city_id) {
      // Preencher apenas se não estiverem definidos
      if (!input.country_id || !input.state_id) {
        const cityPath = await worldService.getCityFullPath(input.city_id);
        if (!cityPath) {
          throw new BadRequestError('Cidade não encontrada');
        }
        // Preencher apenas os campos que não estiverem presentes
        if (!input.country_id) {
          input.country_id = cityPath.country.countryId;
        }
        if (!input.state_id) {
          input.state_id = cityPath.state.stateId;
        }
      }
    }

    // 🔴 VALIDAÇÃO: Validar categoria se fornecida
    // 🔴 BLINDAGEM: Categorias de grupo usam a tabela categories com scope='group'
    // NÃO usam group_categories (tabela legada)
    if (input.category_id) {
      await this.validateCategoryForGroup(tenantId, input.category_id);
    }

    // 🔴 VALIDAÇÃO: Validar hierarquia de localização se fornecida
    await this.validateLocationHierarchy(input.country_id, input.state_id, input.city_id);

    // Resolver actor canônico (§4.8.1); policy conta grupos por owner_actor_id
    const ownerActor = await ensureUserActor(tenantId, ownerUserId);
    await groupCreationPolicy.canCreateGroup(tenantId, ownerActor.actor_id);

    const group = await groupsRepository.create(tenantId, ownerActor.actor_id, input);

    // 🔴 INTENÇÃO FINANCEIRA: Criar conta econômica apenas se houver intenção financeira
    // Reutilizar variável hasFinancialIntent já declarada acima

    if (hasFinancialIntent) {
      // Grupo com intenção financeira - conta será criada automaticamente no Unify Bank
      // quando a primeira transação for processada via bankIntegrationService
      // Não precisamos criar conta aqui - bankIntegrationService.getOrCreateAccount fará isso
      devLog.success('group.created.with_financial_intent', {
        groupId: group.groupId,
        tenantId,
        hasFinancialIntent: true,
        message: 'Conta será criada automaticamente na primeira transação via Unify Bank',
      });
    } else {
      // Grupo social sem economia - não criar conta
      devLog.info('group.created.social', {
        groupId: group.groupId,
        tenantId,
        hasFinancialIntent: false,
        message: 'Grupo criado como social (sem economia). Economia pode ser ativada depois.',
      });
    }

    // 🔴 FEED: Criar post no feed do tipo system anunciando criação do grupo
    // Feed é o HUB do sistema - toda ação social relevante deve aparecer no feed
    try {
      // Buscar globalUserId e actor do criador
      const { runQueryWithTenant } = await import('@core/database/pool');
      const userResult = await runQueryWithTenant<{ global_user_id: string }>(
        tenantId,
        `SELECT global_user_id FROM users WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [ownerUserId, tenantId]
      );
      
      if (userResult && userResult.global_user_id) {
        // ownerActor já resolvido antes do create (§4.8.1)
        const actor = ownerActor; // reutiliza actor resolvido canonicamente
        
        if (actor) {
          const { social2Service } = await import('@modules/social/social-2.0.service');
          
          // Criar post do tipo system anunciando criação do grupo
          await social2Service.createPost(
            tenantId,
            ownerUserId,
            userResult.global_user_id,
            `📢 Novo grupo criado: ${group.name}`,
            actor.actor_id, // Actor do criador
            [], // Sem mídia
            'personal', // Intent personal
            {
              type: 'group_created',
              groupId: group.groupId,
              groupName: group.name,
            },
            undefined, // Sem targeting específico
            undefined // Sem CTA
          );
          
          devLog.success('group.feed_item.created', {
            groupId: group.groupId,
            tenantId,
            actorId: actor.actor_id,
          });
        }
      }
    } catch (feedError) {
      // Não bloquear criação do grupo se feed falhar, mas logar erro
      devLog.error('group.feed_item.failed', {
        groupId: group.groupId,
        tenantId,
        error: feedError instanceof Error ? feedError.message : String(feedError),
      });
    }

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.created',
      payload: {
        groupId: group.groupId,
        name: group.name,
        ownerActorId: group.ownerActorId,
      },
    });

    return group;
  }

  async getGroup(tenantId: string, groupId: string): Promise<Group | null> {
    return groupsRepository.findById(tenantId, groupId);
  }

  async listGroups(tenantId: string, filters?: { isActive?: boolean; categoryId?: string }): Promise<Group[]> {
    return groupsRepository.findAll(tenantId, filters);
  }

  async updateGroup(
    tenantId: string,
    groupId: string,
    userId: string,
    input: UpdateGroupInput,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<Group> {
    // Verificar se usuário é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // 🔴 CORREÇÃO UX: Permitir que owner OU admin atualize o grupo (§4.8: owner = actor_id)
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      userId,
      userContext
    );
    
    if (!isOwner) {
      // Verificar se é admin (também considerar globalUserId se disponível)
      let isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, userId);
      
      // Se não encontrou como admin com userId, tentar com globalUserId
      if (!isAdmin && userContext?.globalUserId && userContext.globalUserId !== userId) {
        isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, userContext.globalUserId);
      }
      
      if (!isAdmin) {
        throw new Error('Only the owner or admin can update the group');
      }
    }

    // 🔴 VALIDAÇÃO: Validar categoria se fornecida (antes de remover do input)
    // Mesmo que category_id seja imutável, validamos para dar feedback claro ao usuário
    if (input.category_id !== undefined) {
      await this.validateCategoryForGroup(tenantId, input.category_id);
    }

    // 🔴 PREENCHIMENTO AUTOMÁTICO: Preencher country_id e state_id com base em city_id
    if (input.city_id !== undefined) {
      // Preencher apenas se não estiverem definidos
      if (input.country_id === undefined || input.state_id === undefined) {
        const cityPath = await worldService.getCityFullPath(input.city_id);
        if (!cityPath) {
          throw new BadRequestError('Cidade não encontrada');
        }
        // Preencher apenas os campos que não estiverem presentes
        if (input.country_id === undefined) {
          input.country_id = cityPath.country.countryId;
        }
        if (input.state_id === undefined) {
          input.state_id = cityPath.state.stateId;
        }
      }
    }

    // 🔴 VALIDAÇÃO: Validar hierarquia de localização se fornecida
    if (input.country_id !== undefined || input.state_id !== undefined || input.city_id !== undefined) {
      await this.validateLocationHierarchy(input.country_id, input.state_id, input.city_id);
    }

    // 🔴 SEGURANÇA: Ignorar alterações de campos imutáveis
    // Categoria e tipo financeiro não podem ser alterados após criação
    const sanitizedInput = { ...input };
    delete sanitizedInput.category_id; // Campo imutável
    // Tipo financeiro está em metadata.hasFinancialIntent - não permitir alteração
    if (sanitizedInput.metadata) {
      delete sanitizedInput.metadata.hasFinancialIntent; // Campo imutável
    }

    // 🔴 VALIDAÇÃO: Finalidade financeira não pode ser apagada completamente se grupo é financeiro
    const hasFinancialIntent = group.metadata?.hasFinancialIntent === true;
    if (hasFinancialIntent && sanitizedInput.financial_purpose !== undefined) {
      if (!sanitizedInput.financial_purpose || sanitizedInput.financial_purpose.trim().length < 20) {
        throw new Error('Finalidade dos recursos é obrigatória para grupos financeiros (mínimo 20 caracteres)');
      }
    }

    return groupsRepository.update(tenantId, groupId, sanitizedInput);
  }

  async deleteGroup(tenantId: string, groupId: string, userId: string): Promise<boolean> {
    // Verificar se usuário é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (!(await this.requesterMatchesOwnerActor(tenantId, group.ownerActorId, userId))) {
      throw new Error('Only the owner can delete the group');
    }

    return groupsRepository.delete(tenantId, groupId);
  }

  async joinGroup(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<GroupMember> {
    // Verificar limite de grupos
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, userId);
    if (currentCount >= 3) {
      throw new Error('User cannot be in more than 3 groups');
    }

    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // 🔴 VALIDAÇÃO: Fluxo baseado em visibilidade
    if (group.visibility === 'public') {
      // Grupo público: join direto permitido
    } else if (group.visibility === 'private') {
      // Grupo privado: requer request-to-join
      throw new Error('Private groups require a join request. Use requestJoinGroup instead.');
    } else if (group.visibility === 'secret') {
      // Grupo secreto: somente convite
      throw new Error('Secret groups require an invitation from an admin or owner');
    }

    // Adicionar membro
    const member = await groupsRepository.addMember(tenantId, groupId, userId, 'member');

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId,
        userId,
        role: member.role,
      },
    });

    return member;
  }

  async leaveGroup(
    tenantId: string,
    groupId: string,
    userId: string
  ): Promise<boolean> {
    // Verificar se é owner
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    if (await this.requesterMatchesOwnerActor(tenantId, group.ownerActorId, userId)) {
      throw new Error('Owner cannot leave without transferring ownership');
    }

    const removed = await groupsRepository.removeMember(tenantId, groupId, userId);

    if (removed) {
      // Emitir evento
      await eventBus.publish({
        tenantId,
        type: 'group.member.left',
        payload: {
          groupId,
          userId,
        },
      });
    }

    return removed;
  }

  async getGroupMembers(tenantId: string, groupId: string): Promise<GroupMember[]> {
    return groupsRepository.getMembers(tenantId, groupId);
  }

  async getGroupWithMembers(tenantId: string, groupId: string): Promise<GroupWithMembers | null> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      return null;
    }

    const members = await groupsRepository.getMembers(tenantId, groupId);

    return {
      ...group,
      members,
      memberCount: members.length,
    };
  }

  async getUserGroups(tenantId: string, userId: string): Promise<Group[]> {
    return groupsRepository.getUserGroups(tenantId, userId);
  }

  /**
   * Atualizar role de um membro do grupo
   * Apenas owner/admin podem alterar roles
   * Owner não pode ter role alterada
   */
  async updateMemberRole(
    tenantId: string,
    groupId: string,
    memberUserId: string,
    newRole: GroupMember['role'],
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<GroupMember> {
    // Verificar se grupo existe
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Verificar se requester é owner ou admin
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can update member roles');
      }
    }

    // Verificar se membro existe
    const members = await groupsRepository.getMembers(tenantId, groupId);
    const member = members.find(m => m.userId === memberUserId);
    if (!member) {
      throw new Error('Member not found');
    }

    // 🔴 PROTEÇÃO: Owner não pode ter role alterada
    if (await this.memberUserIdIsGroupOwnerActor(tenantId, group.ownerActorId, memberUserId)) {
      throw new Error('Cannot change role of the group owner');
    }

    // 🔴 PROTEÇÃO: Não permitir alterar para 'owner' (apenas um owner por grupo)
    if (newRole === 'owner') {
      throw new Error('Cannot set role to owner. Only one owner per group.');
    }

    // Atualizar role
    return groupsRepository.addMember(tenantId, groupId, memberUserId, newRole);
  }

  /**
   * Remover membro do grupo
   * Apenas owner/admin podem remover membros
   * Owner não pode ser removido
   */
  async removeMember(
    tenantId: string,
    groupId: string,
    memberUserId: string,
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<boolean> {
    // Verificar se grupo existe
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Verificar se requester é owner ou admin
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can remove members');
      }
    }

    // 🔴 PROTEÇÃO: Owner não pode ser removido
    if (await this.memberUserIdIsGroupOwnerActor(tenantId, group.ownerActorId, memberUserId)) {
      throw new Error('Cannot remove the group owner');
    }

    // Remover membro
    return groupsRepository.removeMember(tenantId, groupId, memberUserId);
  }

  /**
   * Criar convite para grupo
   * Apenas owner/admin podem convidar
   * Não pode convidar quem já é membro
   */
  async createInvite(
    tenantId: string,
    groupId: string,
    invitedUserId: string,
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<GroupInvite> {
    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // Verificar se requester é owner ou admin
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can invite members');
      }
    }

    // 🔴 VALIDAÇÃO: Não convidar quem já é membro
    const members = await groupsRepository.getMembers(tenantId, groupId);
    const isAlreadyMember = members.some(m => m.userId === invitedUserId);
    if (isAlreadyMember) {
      throw new Error('User is already a member of this group');
    }

    // 🔴 VALIDAÇÃO: Não criar convite duplicado pendente
    const pendingInvites = await groupsRepository.getInvitesByGroup(tenantId, groupId, 'pending');
    const hasPendingInvite = pendingInvites.some(inv => inv.invitedUserId === invitedUserId);
    if (hasPendingInvite) {
      throw new Error('User already has a pending invite for this group');
    }

    // Criar convite (default 7 dias de expiração)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return groupsRepository.createInvite(tenantId, groupId, invitedUserId, requesterUserId, expiresAt);
  }

  /**
   * Listar convites do grupo
   * Apenas owner/admin podem ver convites
   */
  async getGroupInvites(
    tenantId: string,
    groupId: string,
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string },
    status?: GroupInviteStatus
  ): Promise<GroupInvite[]> {
    // Verificar se grupo existe
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Verificar se requester é owner ou admin
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can view invites');
      }
    }

    return groupsRepository.getInvitesByGroup(tenantId, groupId, status);
  }

  /**
   * Aceitar convite
   * Apenas o usuário convidado pode aceitar
   */
  async acceptInvite(
    tenantId: string,
    inviteId: string,
    userId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<GroupMember> {
    // Buscar convite
    const invite = await groupsRepository.getInviteById(tenantId, inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // 🔴 VALIDAÇÃO: Apenas o usuário convidado pode aceitar
    const isInvitedUser = invite.invitedUserId === userId ||
                         (userContext?.globalUserId && invite.invitedUserId === userContext.globalUserId) ||
                         (userContext?.id && invite.invitedUserId === userContext.id);
    
    if (!isInvitedUser) {
      throw new Error('Only the invited user can accept the invite');
    }

    // 🔴 VALIDAÇÃO: Convite deve estar pendente e não expirado
    if (invite.status !== 'pending') {
      if (invite.status === 'expired') {
        throw new Error('Invite has expired');
      }
      throw new Error('Invite is not pending');
    }

    // Verificar se está expirado (dupla verificação)
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new Error('Invite has expired');
    }

    // 🔴 VALIDAÇÃO: Verificar se grupo está ativo
    const group = await groupsRepository.findById(tenantId, invite.groupId);
    if (!group || !group.isActive) {
      throw new Error('Group is not active');
    }

    const invitedActorUserRow = await runQueryWithTenant<{ user_id: string | null }>(
      tenantId,
      `SELECT user_id FROM actors WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [invite.invitedUserId, tenantId]
    );
    if (!invitedActorUserRow || !invitedActorUserRow.user_id) {
      throw new Error(`Actor ${invite.invitedUserId} não possui user_id associado para aceitar convite`);
    }
    const invitedUserIdForMembership = invitedActorUserRow.user_id;

    // 🔴 VALIDAÇÃO: Não aceitar se já é membro
    const members = await groupsRepository.getMembers(tenantId, invite.groupId);
    const isAlreadyMember = members.some(m => m.userId === invitedUserIdForMembership);
    if (isAlreadyMember) {
      // Marcar convite como aceito mesmo assim (já é membro)
      await groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
      throw new Error('User is already a member of this group');
    }

    // Atualizar status do convite
    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');

    // Adicionar como membro
    const member = await groupsRepository.addMember(tenantId, invite.groupId, invitedUserIdForMembership, 'member');

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId: invite.groupId,
        userId: invitedUserIdForMembership,
        role: member.role,
        viaInvite: true,
      },
    });

    return member;
  }

  /**
   * Recusar convite
   * Apenas o usuário convidado pode recusar
   */
  async declineInvite(
    tenantId: string,
    inviteId: string,
    userId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<boolean> {
    // Buscar convite
    const invite = await groupsRepository.getInviteById(tenantId, inviteId);
    if (!invite) {
      throw new Error('Invite not found');
    }

    // 🔴 VALIDAÇÃO: Apenas o usuário convidado pode recusar
    const isInvitedUser = invite.invitedUserId === userId ||
                         (userContext?.globalUserId && invite.invitedUserId === userContext.globalUserId) ||
                         (userContext?.id && invite.invitedUserId === userContext.id);
    
    if (!isInvitedUser) {
      throw new Error('Only the invited user can decline the invite');
    }

    // 🔴 VALIDAÇÃO: Convite deve estar pendente e não expirado
    if (invite.status !== 'pending') {
      if (invite.status === 'expired') {
        throw new Error('Invite has expired');
      }
      throw new Error('Invite is not pending');
    }

    // Verificar se está expirado (dupla verificação)
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new Error('Invite has expired');
    }

    // Atualizar status do convite
    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'declined');

    return true;
  }

  /**
   * Listar convites do usuário
   */
  async getUserInvites(
    tenantId: string,
    userId: string,
    status?: GroupInviteStatus
  ): Promise<GroupInvite[]> {
    return groupsRepository.getInvitesByUser(tenantId, userId, status);
  }

  /**
   * Solicitar entrada em grupo privado
   * Cria um "request-to-join" usando a tabela group_invites
   * Para grupos privados: usuário solicita entrada
   * Para grupos secretos: não permitido (somente convite)
   */
  async requestJoinGroup(
    tenantId: string,
    groupId: string,
    userId: string,
    input?: { expires_in_days?: number }
  ): Promise<GroupInvite> {
    // Verificar limite de grupos
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, userId);
    if (currentCount >= 3) {
      throw new Error('User cannot be in more than 3 groups');
    }

    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // 🔴 VALIDAÇÃO: Apenas grupos privados permitem request-to-join
    if (group.visibility === 'public') {
      throw new Error('Public groups allow direct join. Use joinGroup instead.');
    }
    if (group.visibility === 'secret') {
      throw new Error('Secret groups require an invitation from an admin or owner');
    }

    // 🔴 VALIDAÇÃO: Não solicitar se já é membro
    const members = await groupsRepository.getMembers(tenantId, groupId);
    const isAlreadyMember = members.some(m => m.userId === userId);
    if (isAlreadyMember) {
      throw new Error('User is already a member of this group');
    }

    // 🔴 VALIDAÇÃO: Não criar request duplicado pendente
    const pendingInvites = await groupsRepository.getInvitesByGroup(tenantId, groupId, 'pending');
    const hasPendingRequest = pendingInvites.some(inv => inv.invitedUserId === userId && inv.invitedByUserId === userId);
    if (hasPendingRequest) {
      throw new Error('User already has a pending join request for this group');
    }

    // 🔴 VALIDAÇÃO: Não reutilizar request rejeitado
    const rejectedInvites = await groupsRepository.getInvitesByGroup(tenantId, groupId, 'declined');
    const hasRejectedRequest = rejectedInvites.some(inv => inv.invitedUserId === userId && inv.invitedByUserId === userId);
    if (hasRejectedRequest) {
      throw new Error('Join request was previously rejected. Cannot create a new request.');
    }

    // Calcular expiração (default 7 dias)
    const expiresInDays = input?.expires_in_days || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Criar request-to-join (usando group_invites com invited_by_user_id = userId)
    return groupsRepository.createInvite(tenantId, groupId, userId, userId, expiresAt);
  }

  /**
   * Aprovar solicitação de entrada em grupo
   * Apenas admin/owner podem aprovar
   */
  async approveJoinRequest(
    tenantId: string,
    inviteId: string,
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<GroupMember> {
    // Buscar request
    const invite = await groupsRepository.getInviteById(tenantId, inviteId);
    if (!invite) {
      throw new Error('Join request not found');
    }

    // 🔴 VALIDAÇÃO: Verificar se é um request-to-join (invited_by_user_id === invited_user_id)
    if (invite.invitedByUserId !== invite.invitedUserId) {
      throw new Error('This is not a join request. Use acceptInvite for regular invites.');
    }

    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, invite.groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // 🔴 VALIDAÇÃO: Apenas admin/owner podem aprovar
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, invite.groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can approve join requests');
      }
    }

    // 🔴 VALIDAÇÃO: Request deve estar pendente e não expirado
    if (invite.status !== 'pending') {
      if (invite.status === 'expired') {
        throw new Error('Join request has expired');
      }
      throw new Error('Join request is not pending');
    }

    // Verificar se está expirado (dupla verificação)
    if (invite.expiresAt && invite.expiresAt <= new Date()) {
      throw new Error('Join request has expired');
    }

    const invitedActorUserRow = await runQueryWithTenant<{ user_id: string | null }>(
      tenantId,
      `SELECT user_id FROM actors WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [invite.invitedUserId, tenantId]
    );
    if (!invitedActorUserRow || !invitedActorUserRow.user_id) {
      throw new Error(`Actor ${invite.invitedUserId} não possui user_id associado para aprovar request de entrada`);
    }
    const invitedUserIdForMembership = invitedActorUserRow.user_id;

    // 🔴 VALIDAÇÃO: Não aprovar se já é membro
    const members = await groupsRepository.getMembers(tenantId, invite.groupId);
    const isAlreadyMember = members.some(m => m.userId === invitedUserIdForMembership);
    if (isAlreadyMember) {
      // Marcar request como aceito mesmo assim (já é membro)
      await groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
      throw new Error('User is already a member of this group');
    }

    // Atualizar status do request
    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');

    // Adicionar como membro
    const member = await groupsRepository.addMember(tenantId, invite.groupId, invitedUserIdForMembership, 'member');

    // Emitir evento
    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId: invite.groupId,
        userId: invitedUserIdForMembership,
        role: member.role,
        viaRequest: true,
      },
    });

    return member;
  }

  /**
   * Rejeitar solicitação de entrada em grupo
   * Apenas admin/owner podem rejeitar
   */
  async rejectJoinRequest(
    tenantId: string,
    inviteId: string,
    requesterUserId: string,
    userContext?: { globalUserId?: string; id?: string }
  ): Promise<boolean> {
    // Buscar request
    const invite = await groupsRepository.getInviteById(tenantId, inviteId);
    if (!invite) {
      throw new Error('Join request not found');
    }

    // 🔴 VALIDAÇÃO: Verificar se é um request-to-join (invited_by_user_id === invited_user_id)
    if (invite.invitedByUserId !== invite.invitedUserId) {
      throw new Error('This is not a join request. Use declineInvite for regular invites.');
    }

    // Verificar se grupo existe
    const group = await groupsRepository.findById(tenantId, invite.groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // 🔴 VALIDAÇÃO: Apenas admin/owner podem rejeitar
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );
    
    if (!isOwner) {
      const isAdmin = await groupsRepository.isUserAdminOrOwner(tenantId, invite.groupId, requesterUserId);
      if (!isAdmin) {
        throw new Error('Only the owner or admin can reject join requests');
      }
    }

    // 🔴 VALIDAÇÃO: Request deve estar pendente
    if (invite.status !== 'pending') {
      if (invite.status === 'expired') {
        throw new Error('Join request has expired');
      }
      throw new Error('Join request is not pending');
    }

    // Atualizar status do request para declined
    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'declined');

    return true;
  }
}

export const groupsService = new GroupsService();










