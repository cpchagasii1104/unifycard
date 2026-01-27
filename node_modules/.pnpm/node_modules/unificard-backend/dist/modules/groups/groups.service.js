"use strict";
// src/modules/groups/groups.service.ts
// CONTINUOUS PRODUCTION: MIGRATED TO UNIFY BANK
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsService = void 0;
const groups_repository_1 = require("./groups.repository");
const event_bus_1 = require("@core/events/event-bus");
const devLog_1 = require("@utils/devLog");
const GroupCreationPolicy_1 = require("./policies/GroupCreationPolicy");
const errors_1 = require("@core/errors");
const world_service_1 = require("@core/world/services/world.service");
class GroupsService {
    /**
     * Valida se a hierarquia de localização está correta (país → estado → cidade)
     * 🔴 REUTILIZA: Usa worldService.validateLocation para evitar duplicação
     * @param countryId - ID do país (opcional)
     * @param stateId - ID do estado (opcional)
     * @param cityId - ID da cidade (opcional)
     * @throws BadRequestError se a hierarquia for inválida
     */
    async validateLocationHierarchy(countryId, stateId, cityId) {
        await world_service_1.worldService.validateLocation(countryId, stateId, cityId);
    }
    /**
     * Valida se a categoria existe e é de escopo permitido para grupos
     * @param tenantId - ID do tenant
     * @param categoryId - ID da categoria a validar (opcional)
     * @throws BadRequestError com mensagem "Categoria inválida ou fora do escopo permitido" se inválida
     */
    async validateCategoryForGroup(tenantId, categoryId) {
        // Se não há category_id, não precisa validar
        if (!categoryId) {
            return;
        }
        // Buscar categoria usando categoriesService canônico
        const { categoriesService } = await Promise.resolve().then(() => __importStar(require('@core/categories/categories.service')));
        const category = await categoriesService.getCategoryById(categoryId);
        // Verificar se categoria existe
        if (!category) {
            throw new errors_1.BadRequestError('Categoria não encontrada');
        }
        // Verificar se escopo é 'group'
        if (category.scope !== 'group') {
            throw new errors_1.BadRequestError(`Categoria inválida: apenas categorias com scope 'group' são permitidas (scope atual: '${category.scope}')`);
        }
    }
    /**
     * Busca a categoria raiz (level = 0) de uma categoria
     * @param categoryId - ID da categoria
     * @returns Categoria raiz ou null se não encontrada
     */
    async getRootCategory(categoryId) {
        const { CategoryRepository } = await Promise.resolve().then(() => __importStar(require('@core/categories/categories.repository')));
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
    async validateCoverageType(categoryId, coverageType) {
        const { CategoryRepository } = await Promise.resolve().then(() => __importStar(require('@core/categories/categories.repository')));
        const categoryRepository = new CategoryRepository();
        // Buscar categoria selecionada
        const category = await categoryRepository.findById(categoryId);
        if (!category) {
            throw new errors_1.BadRequestError('Categoria não encontrada');
        }
        // Verificar se categoria tem scope = 'group'
        // Nota: O campo scope indica o contexto da categoria (group, company, event, etc)
        // Vamos assumir que categorias de grupos devem ter scope = 'group' ou 'groups'
        const categoryScope = category.scope;
        if (categoryScope && categoryScope !== 'group' && categoryScope !== 'groups') {
            throw new errors_1.BadRequestError('Categoria não é válida para grupos');
        }
        // Verificar se é leaf (level > 0)
        if (category.level === 0) {
            throw new errors_1.BadRequestError('Categoria raiz não pode ser selecionada diretamente. Selecione uma subcategoria.');
        }
        // Buscar categoria raiz
        const rootCategory = await this.getRootCategory(categoryId);
        if (!rootCategory) {
            throw new errors_1.BadRequestError('Categoria raiz não encontrada');
        }
        // Verificar se metadata.allowed_scopes existe
        // REGRA CANÔNICA: CategoryRepository já normaliza allowed_scopes para categorias raiz de grupo
        const metadata = rootCategory.metadata || {};
        let allowedScopes = metadata.allowed_scopes;
        // Fallback: se ainda não tiver (edge case), aplicar default canônico
        if (!allowedScopes || !Array.isArray(allowedScopes) || allowedScopes.length === 0) {
            const rootScope = rootCategory.scope;
            if (rootScope === 'group' && rootCategory.level === 0) {
                // Default canônico para categorias raiz de grupo
                allowedScopes = ['national', 'state', 'city', 'neighborhood'];
            }
            else {
                throw new errors_1.BadRequestError('Categoria raiz não possui lista de abrangências permitidas (allowed_scopes)');
            }
        }
        // Verificar se coverage_type está em allowed_scopes
        if (!allowedScopes.includes(coverageType)) {
            throw new errors_1.BadRequestError(`Abrangência '${coverageType}' não é permitida para esta categoria. ` +
                `Abrangências permitidas: ${allowedScopes.join(', ')}`);
        }
    }
    async createGroup(tenantId, ownerUserId, input) {
        // 🔴 POLICY: Verificar limite de criação de grupos (conforme GROUP_CREATION_POLICY.md)
        // Aplicada ANTES de qualquer criação para evitar rollback desnecessário
        await GroupCreationPolicy_1.groupCreationPolicy.canCreateGroup(tenantId, ownerUserId);
        // 🔴 VALIDAÇÃO: Finalidade dos recursos é obrigatória se tem intenção financeira
        const hasFinancialIntent = input.metadata?.hasFinancialIntent === true;
        if (hasFinancialIntent && (!input.financial_purpose || input.financial_purpose.trim().length < 20)) {
            throw new Error('Finalidade dos recursos é obrigatória quando o grupo movimenta recursos financeiros (mínimo 20 caracteres)');
        }
        // 🔴 PREENCHIMENTO AUTOMÁTICO: Preencher country_id e state_id com base em city_id
        if (input.city_id) {
            // Preencher apenas se não estiverem definidos
            if (!input.country_id || !input.state_id) {
                const cityPath = await world_service_1.worldService.getCityFullPath(input.city_id);
                if (!cityPath) {
                    throw new errors_1.BadRequestError('Cidade não encontrada');
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
        // Criar grupo
        const group = await groups_repository_1.groupsRepository.create(tenantId, ownerUserId, input);
        // 🔴 INTENÇÃO FINANCEIRA: Criar conta econômica apenas se houver intenção financeira
        // Reutilizar variável hasFinancialIntent já declarada acima
        if (hasFinancialIntent) {
            // Grupo com intenção financeira - conta será criada automaticamente no Unify Bank
            // quando a primeira transação for processada via bankIntegrationService
            // Não precisamos criar conta aqui - bankIntegrationService.getOrCreateAccount fará isso
            devLog_1.devLog.success('group.created.with_financial_intent', {
                groupId: group.groupId,
                tenantId,
                hasFinancialIntent: true,
                message: 'Conta será criada automaticamente na primeira transação via Unify Bank',
            });
        }
        else {
            // Grupo social sem economia - não criar conta
            devLog_1.devLog.info('group.created.social', {
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
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            const userResult = await runQueryWithTenant(tenantId, `SELECT global_user_id FROM users WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`, [ownerUserId, tenantId]);
            if (userResult && userResult.global_user_id) {
                const { actorRepository } = await Promise.resolve().then(() => __importStar(require('@modules/social/actor.repository')));
                const actor = await actorRepository.findOrCreateUserActor(tenantId, ownerUserId);
                if (actor) {
                    const { social2Service } = await Promise.resolve().then(() => __importStar(require('@modules/social/social-2.0.service')));
                    // Criar post do tipo system anunciando criação do grupo
                    await social2Service.createPost(tenantId, ownerUserId, userResult.global_user_id, `📢 Novo grupo criado: ${group.name}`, actor.actor_id, // Actor do criador
                    [], // Sem mídia
                    'personal', // Intent personal
                    {
                        type: 'group_created',
                        groupId: group.groupId,
                        groupName: group.name,
                    }, undefined, // Sem targeting específico
                    undefined // Sem CTA
                    );
                    devLog_1.devLog.success('group.feed_item.created', {
                        groupId: group.groupId,
                        tenantId,
                        actorId: actor.actor_id,
                    });
                }
            }
        }
        catch (feedError) {
            // Não bloquear criação do grupo se feed falhar, mas logar erro
            devLog_1.devLog.error('group.feed_item.failed', {
                groupId: group.groupId,
                tenantId,
                error: feedError instanceof Error ? feedError.message : String(feedError),
            });
        }
        // Emitir evento
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'group.created',
            payload: {
                groupId: group.groupId,
                name: group.name,
                ownerUserId: group.ownerUserId,
            },
        });
        return group;
    }
    async getGroup(tenantId, groupId) {
        return groups_repository_1.groupsRepository.findById(tenantId, groupId);
    }
    async listGroups(tenantId, filters) {
        return groups_repository_1.groupsRepository.findAll(tenantId, filters);
    }
    async updateGroup(tenantId, groupId, userId, input, userContext) {
        // Verificar se usuário é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        // 🔴 CORREÇÃO UX: Permitir que owner OU admin atualize o grupo
        // Comparar com ambos userId e globalUserId para garantir compatibilidade
        // O ownerUserId pode ser armazenado como userId local ou globalUserId dependendo do contexto
        const isOwner = group.ownerUserId === userId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            // Verificar se é admin (também considerar globalUserId se disponível)
            let isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, userId);
            // Se não encontrou como admin com userId, tentar com globalUserId
            if (!isAdmin && userContext?.globalUserId && userContext.globalUserId !== userId) {
                isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, userContext.globalUserId);
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
                const cityPath = await world_service_1.worldService.getCityFullPath(input.city_id);
                if (!cityPath) {
                    throw new errors_1.BadRequestError('Cidade não encontrada');
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
        return groups_repository_1.groupsRepository.update(tenantId, groupId, sanitizedInput);
    }
    async deleteGroup(tenantId, groupId, userId) {
        // Verificar se usuário é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (group.ownerUserId !== userId) {
            throw new Error('Only the owner can delete the group');
        }
        return groups_repository_1.groupsRepository.delete(tenantId, groupId);
    }
    async joinGroup(tenantId, groupId, userId) {
        // Verificar limite de grupos
        const currentCount = await groups_repository_1.groupsRepository.getUserGroupCount(tenantId, userId);
        if (currentCount >= 3) {
            throw new Error('User cannot be in more than 3 groups');
        }
        // Verificar se grupo existe e está ativo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (!group.isActive) {
            throw new Error('Group is not active');
        }
        // 🔴 VALIDAÇÃO: Fluxo baseado em visibilidade
        if (group.visibility === 'public') {
            // Grupo público: join direto permitido
        }
        else if (group.visibility === 'private') {
            // Grupo privado: requer request-to-join
            throw new Error('Private groups require a join request. Use requestJoinGroup instead.');
        }
        else if (group.visibility === 'secret') {
            // Grupo secreto: somente convite
            throw new Error('Secret groups require an invitation from an admin or owner');
        }
        // Adicionar membro
        const member = await groups_repository_1.groupsRepository.addMember(tenantId, groupId, userId, 'member');
        // Emitir evento
        await event_bus_1.eventBus.publish({
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
    async leaveGroup(tenantId, groupId, userId) {
        // Verificar se é owner
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (group.ownerUserId === userId) {
            throw new Error('Owner cannot leave without transferring ownership');
        }
        const removed = await groups_repository_1.groupsRepository.removeMember(tenantId, groupId, userId);
        if (removed) {
            // Emitir evento
            await event_bus_1.eventBus.publish({
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
    async getGroupMembers(tenantId, groupId) {
        return groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
    }
    async getGroupWithMembers(tenantId, groupId) {
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            return null;
        }
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        return {
            ...group,
            members,
            memberCount: members.length,
        };
    }
    async getUserGroups(tenantId, userId) {
        return groups_repository_1.groupsRepository.getUserGroups(tenantId, userId);
    }
    /**
     * Atualizar role de um membro do grupo
     * Apenas owner/admin podem alterar roles
     * Owner não pode ter role alterada
     */
    async updateMemberRole(tenantId, groupId, memberUserId, newRole, requesterUserId, userContext) {
        // Verificar se grupo existe
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        // Verificar se requester é owner ou admin
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
            if (!isAdmin) {
                throw new Error('Only the owner or admin can update member roles');
            }
        }
        // Verificar se membro existe
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const member = members.find(m => m.userId === memberUserId);
        if (!member) {
            throw new Error('Member not found');
        }
        // 🔴 PROTEÇÃO: Owner não pode ter role alterada
        if (group.ownerUserId === memberUserId) {
            throw new Error('Cannot change role of the group owner');
        }
        // 🔴 PROTEÇÃO: Não permitir alterar para 'owner' (apenas um owner por grupo)
        if (newRole === 'owner') {
            throw new Error('Cannot set role to owner. Only one owner per group.');
        }
        // Atualizar role
        return groups_repository_1.groupsRepository.addMember(tenantId, groupId, memberUserId, newRole);
    }
    /**
     * Remover membro do grupo
     * Apenas owner/admin podem remover membros
     * Owner não pode ser removido
     */
    async removeMember(tenantId, groupId, memberUserId, requesterUserId, userContext) {
        // Verificar se grupo existe
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        // Verificar se requester é owner ou admin
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
            if (!isAdmin) {
                throw new Error('Only the owner or admin can remove members');
            }
        }
        // 🔴 PROTEÇÃO: Owner não pode ser removido
        if (group.ownerUserId === memberUserId) {
            throw new Error('Cannot remove the group owner');
        }
        // Remover membro
        return groups_repository_1.groupsRepository.removeMember(tenantId, groupId, memberUserId);
    }
    /**
     * Criar convite para grupo
     * Apenas owner/admin podem convidar
     * Não pode convidar quem já é membro
     */
    async createInvite(tenantId, groupId, invitedUserId, requesterUserId, userContext) {
        // Verificar se grupo existe e está ativo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (!group.isActive) {
            throw new Error('Group is not active');
        }
        // Verificar se requester é owner ou admin
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
            if (!isAdmin) {
                throw new Error('Only the owner or admin can invite members');
            }
        }
        // 🔴 VALIDAÇÃO: Não convidar quem já é membro
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const isAlreadyMember = members.some(m => m.userId === invitedUserId);
        if (isAlreadyMember) {
            throw new Error('User is already a member of this group');
        }
        // 🔴 VALIDAÇÃO: Não criar convite duplicado pendente
        const pendingInvites = await groups_repository_1.groupsRepository.getInvitesByGroup(tenantId, groupId, 'pending');
        const hasPendingInvite = pendingInvites.some(inv => inv.invitedUserId === invitedUserId);
        if (hasPendingInvite) {
            throw new Error('User already has a pending invite for this group');
        }
        // Criar convite (default 7 dias de expiração)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        return groups_repository_1.groupsRepository.createInvite(tenantId, groupId, invitedUserId, requesterUserId, expiresAt);
    }
    /**
     * Listar convites do grupo
     * Apenas owner/admin podem ver convites
     */
    async getGroupInvites(tenantId, groupId, requesterUserId, userContext, status) {
        // Verificar se grupo existe
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        // Verificar se requester é owner ou admin
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, groupId, requesterUserId);
            if (!isAdmin) {
                throw new Error('Only the owner or admin can view invites');
            }
        }
        return groups_repository_1.groupsRepository.getInvitesByGroup(tenantId, groupId, status);
    }
    /**
     * Aceitar convite
     * Apenas o usuário convidado pode aceitar
     */
    async acceptInvite(tenantId, inviteId, userId, userContext) {
        // Buscar convite
        const invite = await groups_repository_1.groupsRepository.getInviteById(tenantId, inviteId);
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
        const group = await groups_repository_1.groupsRepository.findById(tenantId, invite.groupId);
        if (!group || !group.isActive) {
            throw new Error('Group is not active');
        }
        // 🔴 VALIDAÇÃO: Não aceitar se já é membro
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, invite.groupId);
        const isAlreadyMember = members.some(m => m.userId === invite.invitedUserId);
        if (isAlreadyMember) {
            // Marcar convite como aceito mesmo assim (já é membro)
            await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
            throw new Error('User is already a member of this group');
        }
        // Atualizar status do convite
        await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
        // Adicionar como membro
        const member = await groups_repository_1.groupsRepository.addMember(tenantId, invite.groupId, invite.invitedUserId, 'member');
        // Emitir evento
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'group.member.joined',
            payload: {
                groupId: invite.groupId,
                userId: invite.invitedUserId,
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
    async declineInvite(tenantId, inviteId, userId, userContext) {
        // Buscar convite
        const invite = await groups_repository_1.groupsRepository.getInviteById(tenantId, inviteId);
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
        await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'declined');
        return true;
    }
    /**
     * Listar convites do usuário
     */
    async getUserInvites(tenantId, userId, status) {
        return groups_repository_1.groupsRepository.getInvitesByUser(tenantId, userId, status);
    }
    /**
     * Solicitar entrada em grupo privado
     * Cria um "request-to-join" usando a tabela group_invites
     * Para grupos privados: usuário solicita entrada
     * Para grupos secretos: não permitido (somente convite)
     */
    async requestJoinGroup(tenantId, groupId, userId, input) {
        // Verificar limite de grupos
        const currentCount = await groups_repository_1.groupsRepository.getUserGroupCount(tenantId, userId);
        if (currentCount >= 3) {
            throw new Error('User cannot be in more than 3 groups');
        }
        // Verificar se grupo existe e está ativo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, groupId);
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
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, groupId);
        const isAlreadyMember = members.some(m => m.userId === userId);
        if (isAlreadyMember) {
            throw new Error('User is already a member of this group');
        }
        // 🔴 VALIDAÇÃO: Não criar request duplicado pendente
        const pendingInvites = await groups_repository_1.groupsRepository.getInvitesByGroup(tenantId, groupId, 'pending');
        const hasPendingRequest = pendingInvites.some(inv => inv.invitedUserId === userId && inv.invitedByUserId === userId);
        if (hasPendingRequest) {
            throw new Error('User already has a pending join request for this group');
        }
        // 🔴 VALIDAÇÃO: Não reutilizar request rejeitado
        const rejectedInvites = await groups_repository_1.groupsRepository.getInvitesByGroup(tenantId, groupId, 'declined');
        const hasRejectedRequest = rejectedInvites.some(inv => inv.invitedUserId === userId && inv.invitedByUserId === userId);
        if (hasRejectedRequest) {
            throw new Error('Join request was previously rejected. Cannot create a new request.');
        }
        // Calcular expiração (default 7 dias)
        const expiresInDays = input?.expires_in_days || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        // Criar request-to-join (usando group_invites com invited_by_user_id = userId)
        return groups_repository_1.groupsRepository.createInvite(tenantId, groupId, userId, userId, expiresAt);
    }
    /**
     * Aprovar solicitação de entrada em grupo
     * Apenas admin/owner podem aprovar
     */
    async approveJoinRequest(tenantId, inviteId, requesterUserId, userContext) {
        // Buscar request
        const invite = await groups_repository_1.groupsRepository.getInviteById(tenantId, inviteId);
        if (!invite) {
            throw new Error('Join request not found');
        }
        // 🔴 VALIDAÇÃO: Verificar se é um request-to-join (invited_by_user_id === invited_user_id)
        if (invite.invitedByUserId !== invite.invitedUserId) {
            throw new Error('This is not a join request. Use acceptInvite for regular invites.');
        }
        // Verificar se grupo existe e está ativo
        const group = await groups_repository_1.groupsRepository.findById(tenantId, invite.groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        if (!group.isActive) {
            throw new Error('Group is not active');
        }
        // 🔴 VALIDAÇÃO: Apenas admin/owner podem aprovar
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, invite.groupId, requesterUserId);
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
        // 🔴 VALIDAÇÃO: Não aprovar se já é membro
        const members = await groups_repository_1.groupsRepository.getMembers(tenantId, invite.groupId);
        const isAlreadyMember = members.some(m => m.userId === invite.invitedUserId);
        if (isAlreadyMember) {
            // Marcar request como aceito mesmo assim (já é membro)
            await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
            throw new Error('User is already a member of this group');
        }
        // Atualizar status do request
        await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'accepted');
        // Adicionar como membro
        const member = await groups_repository_1.groupsRepository.addMember(tenantId, invite.groupId, invite.invitedUserId, 'member');
        // Emitir evento
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'group.member.joined',
            payload: {
                groupId: invite.groupId,
                userId: invite.invitedUserId,
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
    async rejectJoinRequest(tenantId, inviteId, requesterUserId, userContext) {
        // Buscar request
        const invite = await groups_repository_1.groupsRepository.getInviteById(tenantId, inviteId);
        if (!invite) {
            throw new Error('Join request not found');
        }
        // 🔴 VALIDAÇÃO: Verificar se é um request-to-join (invited_by_user_id === invited_user_id)
        if (invite.invitedByUserId !== invite.invitedUserId) {
            throw new Error('This is not a join request. Use declineInvite for regular invites.');
        }
        // Verificar se grupo existe
        const group = await groups_repository_1.groupsRepository.findById(tenantId, invite.groupId);
        if (!group) {
            throw new Error('Group not found');
        }
        // 🔴 VALIDAÇÃO: Apenas admin/owner podem rejeitar
        const isOwner = group.ownerUserId === requesterUserId ||
            (userContext?.globalUserId && group.ownerUserId === userContext.globalUserId) ||
            (userContext?.id && group.ownerUserId === userContext.id);
        if (!isOwner) {
            const isAdmin = await groups_repository_1.groupsRepository.isUserAdminOrOwner(tenantId, invite.groupId, requesterUserId);
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
        await groups_repository_1.groupsRepository.updateInviteStatus(tenantId, inviteId, 'declined');
        return true;
    }
}
exports.groupsService = new GroupsService();
