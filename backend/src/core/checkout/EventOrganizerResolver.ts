// src/core/checkout/EventOrganizerResolver.ts
// 🔴 CRÍTICO: Resolve conta do organizador do evento
import { runQueryWithTenant } from '@core/database/pool';
import { accountService } from '../economy/accounts/account.service';

interface EventRow {
  id: string;
  created_by_company_id: string | null;
  created_by_global_user_id: string;
}

/**
 * Resolve a conta financeira do organizador do evento
 * Prioridade: created_by_company_id > created_by_global_user_id
 */
export async function resolveEventOrganizerAccount(
  tenantId: string,
  eventId: string
): Promise<string> {
  // Buscar evento
  const eventResult = await runQueryWithTenant<EventRow>(
    tenantId,
    `
      SELECT id, created_by_company_id, created_by_global_user_id
      FROM events
      WHERE id = $1
      LIMIT 1
    `,
    [eventId]
  );

  if (!eventResult) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const event = eventResult;

  // Prioridade 1: Empresa organizadora
  if (event.created_by_company_id) {
    // Buscar ou criar conta da empresa (usar ownerType 'merchant' para empresas)
    const companyAccounts = await accountService.getAccountsByOwner(
      tenantId,
      event.created_by_company_id,
      'merchant'
    );

    if (companyAccounts.length > 0) {
      return companyAccounts[0].accountId;
    }

    // Criar conta da empresa se não existir
    const companyAccount = await accountService.createAccount(tenantId, {
      ownerId: event.created_by_company_id,
      ownerType: 'merchant',
      currency: 'BRL',
    });

    return companyAccount.accountId;
  }

  // Prioridade 2: Usuário organizador
  if (event.created_by_global_user_id) {
    const userAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      event.created_by_global_user_id,
      'BRL'
    );

    return userAccount.accountId;
  }

  // Evento sem organizador (não deveria acontecer)
  throw new Error(`Event ${eventId} has no organizer (neither company nor user)`);
}















