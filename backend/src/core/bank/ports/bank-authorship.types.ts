// src/core/bank/ports/bank-authorship.types.ts
/**
 * Tipo mínimo de autoria para operações financeiras (CORE).
 * Contrato canônico: toda transação deve ter autoria rastreável.
 * A implementação em @modules/bank satisfaz este contrato (FinancialAuthorshipContext).
 * Core NÃO importa tipos do módulo.
 */

export interface BankTransactionAuthorship {
  performedByUserId: string | null;
  actingForActorId: string;
  actingForAccountId: string;
  authoritySource: string;
  permissionSnapshot: {
    permissionKey: string;
    allowed: boolean;
    actorId: string;
    userId: string;
    decidedAt: string;
  };
  policySnapshot?: unknown;
}