"use strict";
// src/core/economy/group-account.service.ts
//
// Serviço para resolver contas de grupos do usuário para splits econômicos
// Busca grupos do usuário e cria/busca contas correspondentes
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupAccountService = void 0;
const groups_repository_1 = require("../../modules/groups/groups.repository");
class GroupAccountService {
    accountService;
    logger;
    constructor(accountService, // AccountService instance
    logger) {
        this.accountService = accountService;
        this.logger = logger;
    }
    /**
     * Cria ou busca conta econômica para um grupo
     */
    async createOrGetGroupAccount(tenantId, groupId) {
        // Verificar se já existe conta vinculada
        const existingLink = await groups_repository_1.groupsRepository.getGroupAccount(tenantId, groupId);
        if (existingLink) {
            return existingLink.accountId;
        }
        // Buscar ou criar conta
        const groupAccounts = await this.accountService.getAccountsByOwner(tenantId, groupId, 'group');
        let groupAccount = groupAccounts[0];
        if (!groupAccount) {
            groupAccount = await this.accountService.createAccount(tenantId, {
                ownerId: groupId,
                ownerType: 'group',
                currency: 'BRL',
            });
        }
        // Vincular conta ao grupo
        await groups_repository_1.groupsRepository.linkAccount(tenantId, groupId, groupAccount.accountId);
        return groupAccount.accountId;
    }
    /**
     * Resolve groupAccountIds para splits econômicos
     * Busca grupos ativos do usuário e retorna contas correspondentes
     */
    async resolveGroupAccountIds(params) {
        const { tenantId, userId } = params;
        const groupAccountIds = [];
        try {
            // Buscar grupos ativos do usuário (já limitado a 3 pelo constraint)
            const userGroups = await groups_repository_1.groupsRepository.getUserGroups(tenantId, userId);
            if (userGroups.length === 0) {
                if (this.logger) {
                    this.logger.info({
                        tenantId,
                        userId,
                        groupCount: 0,
                        'economy.action': 'resolve-group-accounts',
                    }, 'User has no groups for split');
                }
                return [];
            }
            // Limitar a 3 grupos (já garantido pelo constraint, mas garantir aqui também)
            const groupsToProcess = userGroups.slice(0, 3);
            for (const group of groupsToProcess) {
                try {
                    const accountId = await this.createOrGetGroupAccount(tenantId, group.groupId);
                    groupAccountIds.push(accountId);
                }
                catch (error) {
                    if (this.logger) {
                        this.logger.warn({
                            tenantId,
                            userId,
                            groupId: group.groupId,
                            err: error,
                            'economy.action': 'resolve-group-accounts',
                        }, 'Error creating/finding group account');
                    }
                }
            }
            if (this.logger) {
                this.logger.info({
                    tenantId,
                    userId,
                    groupCount: groupAccountIds.length,
                    'economy.action': 'resolve-group-accounts',
                }, `Resolved ${groupAccountIds.length} group accounts for split`);
            }
        }
        catch (error) {
            if (this.logger) {
                this.logger.error({
                    tenantId,
                    userId,
                    err: error,
                    'economy.action': 'resolve-group-accounts',
                }, 'Error resolving group accounts');
            }
        }
        return groupAccountIds;
    }
}
exports.groupAccountService = new GroupAccountService(accountService);
