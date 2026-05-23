// src/core/checkout/EventOrganizerResolver.ts
// Resolve conta financeira do organizador via actor_id + metadata legível (SSOT events).
import { runQueryWithTenant } from '@core/database/pool';
import { accountService } from '../economy/account.service';
import { actorRepository } from '@modules/social/actor.repository';

type EventOrganizerRow = {
  actor_id: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Resolve a conta financeira do organizador do evento.
 * Prioridade: empresa (actor.company_id) → utilizador (actor.user_id) → metadata.created_by_global_user_id.
 */
export async function resolveEventOrganizerAccount(
  tenantId: string,
  eventId: string
): Promise<string> {
  const row = await runQueryWithTenant<EventOrganizerRow>(
    tenantId,
    `
      SELECT actor_id, metadata
      FROM events
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
    `,
    [eventId, tenantId]
  );

  if (!row) {
    throw new Error(`Event not found: ${eventId}`);
  }

  const actor = await actorRepository.findById(tenantId, row.actor_id);
  if (!actor) {
    throw new Error(`Actor not found for event: ${eventId}`);
  }

  if (actor.company_id) {
    const companyAccounts = await accountService.getAccountsByOwner(
      tenantId,
      actor.company_id,
      'company'
    );

    if (companyAccounts.length > 0) {
      return companyAccounts[0].accountId;
    }

    const companyAccount = await accountService.createAccount(tenantId, {
      ownerId: actor.company_id,
      ownerType: 'company',
      currency: 'BRL',
    });

    return companyAccount.accountId;
  }

  if (actor.user_id) {
    const userAccount = await accountService.getOrCreateUserPrimaryAccount(
      tenantId,
      actor.user_id,
      'BRL'
    );

    return userAccount.accountId;
  }

  const meta = row.metadata || {};
  const legacyGlobal = meta.created_by_global_user_id;
  if (typeof legacyGlobal === 'string' && legacyGlobal.length > 0) {
    const userRow = await runQueryWithTenant<{ user_id: string }>(
      tenantId,
      `
        SELECT user_id
        FROM users
        WHERE global_user_id = $1::uuid AND tenant_id = $2
        LIMIT 1
      `,
      [legacyGlobal, tenantId]
    );
    if (userRow?.user_id) {
      const userAccount = await accountService.getOrCreateUserPrimaryAccount(
        tenantId,
        userRow.user_id,
        'BRL'
      );
      return userAccount.accountId;
    }
  }

  throw new Error(
    `Event ${eventId}: cannot resolve organizer account (actor without user_id/company_id)`
  );
}