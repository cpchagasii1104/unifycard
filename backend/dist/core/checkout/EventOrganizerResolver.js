"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEventOrganizerAccount = resolveEventOrganizerAccount;
// src/core/checkout/EventOrganizerResolver.ts
// 🔴 CRÍTICO: Resolve conta do organizador do evento
const pool_1 = require("@core/database/pool");
const account_service_1 = require("../economy/accounts/account.service");
/**
 * Resolve a conta financeira do organizador do evento
 * Prioridade: created_by_company_id > created_by_global_user_id
 */
async function resolveEventOrganizerAccount(tenantId, eventId) {
    // Buscar evento
    const eventResult = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT id, created_by_company_id, created_by_global_user_id
      FROM events
      WHERE id = $1
      LIMIT 1
    `, [eventId]);
    if (!eventResult) {
        throw new Error(`Event not found: ${eventId}`);
    }
    const event = eventResult;
    // Prioridade 1: Empresa organizadora
    if (event.created_by_company_id) {
        // Buscar ou criar conta da empresa (usar ownerType 'merchant' para empresas)
        const companyAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, event.created_by_company_id, 'merchant');
        if (companyAccounts.length > 0) {
            return companyAccounts[0].accountId;
        }
        // Criar conta da empresa se não existir
        const companyAccount = await account_service_1.accountService.createAccount(tenantId, {
            ownerId: event.created_by_company_id,
            ownerType: 'merchant',
            currency: 'BRL',
        });
        return companyAccount.accountId;
    }
    // Prioridade 2: Usuário organizador
    if (event.created_by_global_user_id) {
        const userAccount = await account_service_1.accountService.getOrCreateUserPrimaryAccount(tenantId, event.created_by_global_user_id, 'BRL');
        return userAccount.accountId;
    }
    // Evento sem organizador (não deveria acontecer)
    throw new Error(`Event ${eventId} has no organizer (neither company nor user)`);
}
//# sourceMappingURL=EventOrganizerResolver.js.map