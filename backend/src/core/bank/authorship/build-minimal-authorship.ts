// src/core/bank/authorship/build-minimal-authorship.ts
/**
 * Constrói autoria mínima canônica para createSimpleTransaction (CORE).
 * Não importa de @modules/*. Retorna BankTransactionAuthorship.
 */

import type { BankTransactionAuthorship } from '../ports/bank-authorship.types';

export function buildMinimalAuthorship(params: {
  performedByUserId: string | null;
  actingForActorId: string;
  actingForAccountId: string;
  authoritySource: string;
  permissionKey?: string;
}): BankTransactionAuthorship {
  const {
    performedByUserId,
    actingForActorId,
    actingForAccountId,
    authoritySource,
    permissionKey = 'financial.transaction.execute',
  } = params;

  return {
    performedByUserId,
    actingForActorId,
    actingForAccountId,
    authoritySource,
    permissionSnapshot: {
      permissionKey,
      allowed: true,
      actorId: actingForActorId,
      userId: performedByUserId ?? '',
      decidedAt: new Date().toISOString(),
    },
  };
}