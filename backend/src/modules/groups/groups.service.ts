// src/modules/groups/groups.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
// D9.2-B (DECISION-0188): CUTOVER Actor-first da membership — verdade unica =
// group_actor_memberships via groupActorMembershipService (5 fns governadas). group_members
// esta CONGELADA (projecao read-only). role NAO e autoridade (D11/D16): gestao do grupo =
// canRepresentActor(group_actor|owner_actor), nunca group_members.role.

import { randomUUID } from 'crypto';
import { groupsRepository } from './groups.repository';
import { groupActorMembershipService } from './group-actor-membership.service';
import { groupActorMembershipRepository } from './group-actor-membership.repository';
import type { GroupActorMembership } from './group-actor-membership.types';
import { bankIntegrationService } from '../bank/bank-integration.service';
import { eventBus } from '@core/events/event-bus';
import { devLog } from '@utils/devLog';
import { groupCreationPolicy } from './policies/GroupCreationPolicy';
import { runQueryWithTenant } from '@core/database/pool';
import { BadRequestError } from '@core/errors';
import { worldService } from '@core/world/services/world.service';
import type { Group, GroupMember, CreateGroupInput, UpdateGroupInput, GroupWithMembers, GroupInvite, GroupInviteStatus, CreateGroupInviteInput } from './groups.types';
import { ensureUserActor, ensureGroupActor } from '@modules/identity/actor-writer.service';

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

  /**
   * D9.2-B/D10: autoridade de GESTAO do grupo = canRepresentActor(group-actor do Group)
   * (fallback: owner-actor civil quando o group-actor nao existe em grupo legado).
   * Substitui a antiga autoridade por role legada — retirada no cutover (D16).
   */
  async userCanGovernGroup(tenantId: string, groupId: string, actingUserId: string): Promise<boolean> {
    if (!tenantId?.trim() || !groupId?.trim() || !actingUserId?.trim()) {
      return false;
    }
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      return false;
    }
    const { authorizationService } = await import('@core/authorization/authorization.service');
    const groupActorId = await groupsRepository.getGroupActorId(tenantId, groupId);
    if (groupActorId && (await authorizationService.canRepresentActor(tenantId, actingUserId, groupActorId))) {
      return true;
    }
    return authorizationService.canRepresentActor(tenantId, actingUserId, group.ownerActorId);
  }

  /** Cap civil-humano de participacao (D12) para o PRINCIPAL autenticado. */
  private async assertParticipationCapacity(tenantId: string, actingUserId: string): Promise<void> {
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, actingUserId);
    if (currentCount >= 3) {
      throw new Error('User cannot be in more than 3 groups');
    }
  }

  /** Cap civil-humano (D12) para um ACTOR candidato: so user-actor conta; institucional passa. */
  private async assertCandidateCapacity(tenantId: string, candidateActorId: string): Promise<void> {
    const activeCount = await groupsRepository.countActiveUserActorMemberships(tenantId, candidateActorId);
    if (activeCount !== null && activeCount >= 3) {
      throw new Error('User cannot be in more than 3 groups');
    }
  }

  /** Projeta a membership Actor-first no shape legado de member (role DERIVADA — D11). */
  private toLegacyMember(membership: GroupActorMembership, ownerActorId: string, userId: string | null): GroupMember {
    return {
      groupId: membership.groupId,
      userId,
      memberActorId: membership.memberActorId,
      membershipId: membership.id,
      role: membership.memberActorId === ownerActorId ? 'owner' : 'member',
      joinedAt: new Date(membership.createdAt),
    };
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

    // §3C.3 Etapa 4 — writer único: garante group-actor atômico (§4.8.1 LEI_COERENCIA).
    // ensureGroupActor: transacional, idempotente, fail-closed.
    // NÃO chamar dentro de transação ativa (tem TX interna própria).
    await ensureGroupActor(tenantId, group.groupId);

    // D9.2-B (DECISION-0188 D8): a membership ATIVA do owner nasce com o grupo, na casa
    // canonica group_actor_memberships, pelo writer governado (§4.8 — unico caminho de escrita).
    // Chave deterministica: replay do createGroup nao duplica.
    await groupActorMembershipService.enterMembershipSelf({
      tenantId,
      actingUserId: ownerUserId,
      groupId: group.groupId,
      idempotencyKey: `owner-genesis:${group.groupId}`,
    });

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
      // D9.2-B/D11: role legada perdeu efeito autorizativo — gestao = canRepresentActor
      const canGovern = await this.userCanGovernGroup(tenantId, groupId, userId);
      if (!canGovern) {
        throw new Error('Only the owner or a group representative can update the group');
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

  /**
   * D9.2-B (D13 superficie 1): entrada SELF — o membro E o user-actor canonico do PRINCIPAL
   * autenticado (resolvido server-side no service governado). actionContext NUNCA e identidade.
   */
  async joinGroup(
    tenantId: string,
    groupId: string,
    actingUserId: string
  ): Promise<GroupMember> {
    // Cap civil de participacao (D12): so memberships ATIVAS de user-actor em grupos ativos
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, actingUserId);
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
      throw new Error('Secret groups require an invitation from a group representative');
    }

    // Escrita UNICA: writer governado da casa nova (reentrada = nova linha; ativa duplicada falha)
    const membership = await groupActorMembershipService.enterMembershipSelf({
      tenantId,
      actingUserId,
      groupId,
      idempotencyKey: `join:${randomUUID()}`,
    });

    const member = this.toLegacyMember(membership, group.ownerActorId, actingUserId);

    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId,
        userId: actingUserId,
        memberActorId: membership.memberActorId,
        role: member.role,
      },
    });

    return member;
  }

  /**
   * D9.2-B (D13 superficie 2): saida SELF — resolve o user-actor do PRINCIPAL, encerra a
   * membership ATIVA (terminal 'left'; historia preservada). Owner bloqueado pela fn (D8).
   */
  async leaveGroup(
    tenantId: string,
    groupId: string,
    actingUserId: string
  ): Promise<boolean> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const memberActorId = await groupsRepository.findUserActorId(tenantId, actingUserId);
    if (!memberActorId) {
      return false;
    }
    const membership = await groupActorMembershipRepository.findActiveByGroupAndMember(tenantId, groupId, memberActorId);
    if (!membership) {
      return false;
    }

    // GAM_OWNER_CANNOT_LEAVE propaga da fn canonica (D8)
    await groupActorMembershipService.leaveMembership({ tenantId, actingUserId, membershipId: membership.id });

    await eventBus.publish({
      tenantId,
      type: 'group.member.left',
      payload: {
        groupId,
        userId: actingUserId,
        memberActorId,
      },
    });

    return true;
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

  // D9.2-B (DECISION-0188 D11): updateMemberRole foi APOSENTADO no cutover — role legada
  // nao tem poder, a casa nova nao persiste role e o endpoint responde 410 na rota.

  /**
   * Remover membro do grupo (terminal 'removed'; historia preservada).
   * D10: autoridade = canRepresentActor(group-actor do Group), provada NO service governado.
   * `memberUserId` e contrato legado da rota: resolve server-side ao user-actor membro.
   */
  async removeMember(
    tenantId: string,
    groupId: string,
    memberUserId: string,
    requesterUserId: string
  ): Promise<boolean> {
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const memberActorId = await groupsRepository.findUserActorId(tenantId, memberUserId);
    if (!memberActorId) {
      return false;
    }
    const membership = await groupActorMembershipRepository.findActiveByGroupAndMember(tenantId, groupId, memberActorId);
    if (!membership) {
      return false;
    }

    // GAM_OWNER_CANNOT_BE_REMOVED propaga da fn (D8); GAM_GROUP_NOT_REPRESENTED = 403 do service
    await groupActorMembershipService.removeMembership({
      tenantId,
      actingUserId: requesterUserId,
      membershipId: membership.id,
    });

    await eventBus.publish({
      tenantId,
      type: 'group.member.left',
      payload: {
        groupId,
        userId: memberUserId,
        memberActorId,
        removed: true,
      },
    });

    return true;
  }

  /**
   * D9.2-B (D13 superficie 6): convite = INTENCAO EXPLICITA kind='invite' na casa de intencoes.
   * Candidato = ACTOR canonico (namespace unico — nunca comparado com user_id).
   * Autoridade (lado grupo) = canRepresentActor(group-actor), provada no service governado.
   */
  async createInvite(
    tenantId: string,
    groupId: string,
    invitedActorId: string,
    requesterUserId: string
  ): Promise<GroupInvite> {
    // Verificar se grupo existe e está ativo
    const group = await groupsRepository.findById(tenantId, groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // 🔴 VALIDAÇÃO: nao convidar actor com membership JA ATIVA (casa nova, namespace ACTOR)
    const active = await groupActorMembershipRepository.findActiveByGroupAndMember(tenantId, groupId, invitedActorId);
    if (active) {
      throw new Error('User is already a member of this group');
    }

    // Intencao explicita governada (1 pendente por par; GAM_INTENT_PENDING_EXISTS fail-closed)
    const intentId = await groupActorMembershipService.createMembershipIntent({
      tenantId,
      actingUserId: requesterUserId,
      groupId,
      candidateActorId: invitedActorId,
      intentKind: 'invite',
      idempotencyKey: `invite:${randomUUID()}`,
    });

    const invite = await groupsRepository.getInviteById(tenantId, intentId);
    if (!invite) {
      throw new Error('Failed to create invite');
    }
    return invite;
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

    // D9.2-B/D10: gestao do grupo = canRepresentActor (owner civil ou group-actor)
    const isOwner = await this.requesterMatchesOwnerActor(
      tenantId,
      group.ownerActorId,
      requesterUserId,
      userContext
    );

    if (!isOwner && !(await this.userCanGovernGroup(tenantId, groupId, requesterUserId))) {
      throw new Error('Only the owner or a group representative can view invites');
    }

    return groupsRepository.getInvitesByGroup(tenantId, groupId, status);
  }

  /**
   * D9.2-B (D13 superficie 5): aceite ATOMICO da intencao 'invite' — intent accepted +
   * membership nascem na MESMA transacao (fn canonica). Autoridade do lado candidato
   * (self do user-actor resolvido server-side, ou representante) provada no service
   * governado. SEM fallback triplo userId‖globalUserId‖id.
   */
  async acceptInvite(
    tenantId: string,
    inviteId: string,
    actingUserId: string
  ): Promise<GroupMember> {
    const intent = await groupActorMembershipRepository.findIntent(tenantId, inviteId);
    if (!intent) {
      throw new Error('Invite not found');
    }
    if (intent.intentKind !== 'invite') {
      throw new Error('This is not an invite. Use approveJoinRequest for join requests.');
    }

    const group = await groupsRepository.findById(tenantId, intent.groupId);
    if (!group || !group.isActive) {
      throw new Error('Group is not active');
    }

    // Cap civil do CANDIDATO (D12) — antes de materializar a membership
    await this.assertCandidateCapacity(tenantId, intent.candidateActorId);

    const membership = await groupActorMembershipService.acceptMembershipIntent({
      tenantId,
      actingUserId,
      intentId: inviteId,
    });

    const memberUserId = await this.resolveActorUserId(tenantId, membership.memberActorId);
    const member = this.toLegacyMember(membership, group.ownerActorId, memberUserId);

    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId: intent.groupId,
        userId: memberUserId,
        memberActorId: membership.memberActorId,
        role: member.role,
        viaInvite: true,
      },
    });

    return member;
  }

  /** user_id tecnico de um actor (null p/ membro institucional) — resolucao, nao identidade. */
  private async resolveActorUserId(tenantId: string, actorId: string): Promise<string | null> {
    const row = await runQueryWithTenant<{ user_id: string | null }>(
      tenantId,
      `SELECT user_id FROM actors WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [actorId, tenantId]
    );
    return row?.user_id ?? null;
  }

  /**
   * Recusar convite (intencao 'invite' pendente -> 'rejected').
   * Lado candidato: self do user-actor resolvido server-side OU canRepresentActor(candidato).
   * D9: rejeicao NAO bloqueia novo convite (unicidade agora e pending-only).
   */
  async declineInvite(
    tenantId: string,
    inviteId: string,
    actingUserId: string
  ): Promise<boolean> {
    const intent = await groupActorMembershipRepository.findIntent(tenantId, inviteId);
    if (!intent) {
      throw new Error('Invite not found');
    }
    if (intent.intentKind !== 'invite') {
      throw new Error('This is not an invite. Use rejectJoinRequest for join requests.');
    }
    if (intent.status !== 'pending') {
      if (intent.status === 'expired') {
        throw new Error('Invite has expired');
      }
      throw new Error('Invite is not pending');
    }

    // namespace UNICO: principal -> user-actor canonico; representante institucional via authority
    const actingActor = await ensureUserActor(tenantId, actingUserId);
    if (actingActor.actor_id !== intent.candidateActorId) {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      const represents = await authorizationService.canRepresentActor(tenantId, actingUserId, intent.candidateActorId);
      if (!represents) {
        throw new Error('Only the invited actor (or its representative) can decline the invite');
      }
    }

    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'rejected');
    return true;
  }

  /**
   * D9.2-B (D13 superficie 3): convites do PRINCIPAL — resolve o user-actor canonico
   * server-side e consulta a coluna de ACTOR (nunca globalUserId‖id contra coluna de actor).
   */
  async getUserInvites(
    tenantId: string,
    actingUserId: string,
    status?: GroupInviteStatus
  ): Promise<GroupInvite[]> {
    const actingActor = await ensureUserActor(tenantId, actingUserId);
    return groupsRepository.getInvitesByUser(tenantId, actingActor.actor_id, status);
  }

  /**
   * D9.2-B (D13 superficie 4): request = INTENCAO EXPLICITA kind='request' (direcao declarada,
   * nunca a convencao implicita "invited_by = candidato"). Candidato = user-actor canonico do
   * PRINCIPAL, resolvido server-side. Rejeicao anterior NAO bloqueia novo request (D9).
   */
  async requestJoinGroup(
    tenantId: string,
    groupId: string,
    actingUserId: string,
    _input?: { expires_in_days?: number }
  ): Promise<GroupInvite> {
    // Cap civil (D12): pendencias nao contam; ativas contam
    const currentCount = await groupsRepository.getUserGroupCount(tenantId, actingUserId);
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
      throw new Error('Secret groups require an invitation from a group representative');
    }

    const actingActor = await ensureUserActor(tenantId, actingUserId);

    // 🔴 VALIDAÇÃO: nao solicitar com membership JA ATIVA (namespace ACTOR)
    const active = await groupActorMembershipRepository.findActiveByGroupAndMember(tenantId, groupId, actingActor.actor_id);
    if (active) {
      throw new Error('User is already a member of this group');
    }

    // NOTA (residual documentado): expires_in_days do contrato legado nao e persistido pelo
    // writer selado de intents (fn sem parametro de expiracao); expiracao de intents novas
    // fica para decisao/frente propria. Duplicidade pendente = GAM_INTENT_PENDING_EXISTS.
    const intentId = await groupActorMembershipService.createMembershipIntent({
      tenantId,
      actingUserId,
      groupId,
      candidateActorId: actingActor.actor_id,
      intentKind: 'request',
      idempotencyKey: `request:${randomUUID()}`,
    });

    const invite = await groupsRepository.getInviteById(tenantId, intentId);
    if (!invite) {
      throw new Error('Failed to create join request');
    }
    return invite;
  }

  /**
   * Aprovar request de entrada (aceite ATOMICO da intencao 'request').
   * Autoridade (lado grupo) = canRepresentActor(group-actor), provada no service governado.
   */
  async approveJoinRequest(
    tenantId: string,
    inviteId: string,
    requesterUserId: string
  ): Promise<GroupMember> {
    const intent = await groupActorMembershipRepository.findIntent(tenantId, inviteId);
    if (!intent) {
      throw new Error('Join request not found');
    }
    if (intent.intentKind !== 'request') {
      throw new Error('This is not a join request. Use acceptInvite for regular invites.');
    }

    const group = await groupsRepository.findById(tenantId, intent.groupId);
    if (!group) {
      throw new Error('Group not found');
    }
    if (!group.isActive) {
      throw new Error('Group is not active');
    }

    // Cap civil do CANDIDATO (D12)
    await this.assertCandidateCapacity(tenantId, intent.candidateActorId);

    const membership = await groupActorMembershipService.acceptMembershipIntent({
      tenantId,
      actingUserId: requesterUserId,
      intentId: inviteId,
    });

    const memberUserId = await this.resolveActorUserId(tenantId, membership.memberActorId);
    const member = this.toLegacyMember(membership, group.ownerActorId, memberUserId);

    await eventBus.publish({
      tenantId,
      type: 'group.member.joined',
      payload: {
        groupId: intent.groupId,
        userId: memberUserId,
        memberActorId: membership.memberActorId,
        role: member.role,
        viaRequest: true,
      },
    });

    return member;
  }

  /**
   * Rejeitar request de entrada (intencao 'request' pendente -> 'rejected').
   * Autoridade (lado grupo) = canRepresentActor (owner civil ou group-actor) — nunca role.
   */
  async rejectJoinRequest(
    tenantId: string,
    inviteId: string,
    requesterUserId: string
  ): Promise<boolean> {
    const intent = await groupActorMembershipRepository.findIntent(tenantId, inviteId);
    if (!intent) {
      throw new Error('Join request not found');
    }
    if (intent.intentKind !== 'request') {
      throw new Error('This is not a join request. Use declineInvite for regular invites.');
    }
    if (intent.status !== 'pending') {
      if (intent.status === 'expired') {
        throw new Error('Join request has expired');
      }
      throw new Error('Join request is not pending');
    }

    if (!(await this.userCanGovernGroup(tenantId, intent.groupId, requesterUserId))) {
      throw new Error('Only the owner or a group representative can reject join requests');
    }

    await groupsRepository.updateInviteStatus(tenantId, inviteId, 'rejected');
    return true;
  }
}

export const groupsService = new GroupsService();










