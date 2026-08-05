// backend/src/modules/bank/bank-account.types.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Tipos para contas do Unify Bank

import type { MoneyCents } from '@contracts/marketplace/canonical';

/**
 * Tipo de owner da conta
 */
/**
 * 🔴 `actor` ENTROU, e é o valor que o banco REALMENTE guarda (2026-08-04).
 *
 * O CHECK físico de `bank_accounts.owner_type` é `('actor','system','escrow')`. A aplicação usava
 * `'user' | 'company'`, e o tradutor colapsava OS DOIS em `'actor'` na ida — e na volta devolvia
 * `'user'` SEMPRE. Gravava-se `company`, lia-se `user`.
 *
 * Consequência medida antes do conserto: em `transparency.routes.ts` o ramo `=== 'company'` era
 * INALCANÇÁVEL — quem tinha grant financeiro legítimo de empresa era negado. Falso NEGATIVO, não
 * vazamento (o `ownerId` de conta de empresa é o `company_id`, que nunca casa com `userId`) — o
 * que não o torna aceitável: é código morto que parece vivo, num caminho de autoridade.
 *
 * A regra (armadilha #9 do fundamento de arquitetura): tradutor entre vocabulários ou é BIJETIVO,
 * ou mente na volta. Como a ida colapsa, o tradutor não deve existir: os dois lados falam o
 * vocabulário do banco. `'user'`/`'company'` seguem aceitos na ESCRITA (36 call sites) e viram
 * `'actor'`; a LEITURA passa a devolver `'actor'`, que é a verdade.
 *
 * Quem é a pessoa por trás do actor NÃO é assunto do Bank — é `actors.actor_type`, o SSOT disso.
 */
export type BankAccountOwnerType = 'user' | 'company' | 'actor' | 'system' | 'escrow';

/**
 * Moeda suportada pelo Unify Bank
 */
export type BankCurrency = 'BRL' | 'USD' | 'EUR' | 'TEST';

/**
 * Nome das contas do sistema
 */
export type SystemAccountName = 'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'platform_ops';

/**
 * Tipos de conta do motor financeiro (lifecycle + compatibilidade).
 * Constraint no banco: migration 0024.
 */
export type BankAccountType =
  | 'credit'
  | 'user_wallet'
  | 'escrow_payments'
  | 'escrow_disputes'
  | 'seller_pending'
  | 'seller_available'
  | 'seller_payout'
  | 'platform_revenue'
  | 'platform_fees'
  | 'clearing'
  | 'bank_settlement'
  | 'adjustment'
  | 'risk_reserve'
  /**
   * actor_wallet (Camada 1 D-money — 2026-05-26, decisão Clayton K_wallet_1
   * = Opção D):
   * Carteira interna do actor (PF, empresa, ou outro actor econômico)
   * dentro do UnifyBank. Lastreada exclusivamente por bank_ledger. Recebe
   * valores LIBERADOS de serviços/vendas após aprovação D2; NÃO é receita
   * da plataforma, NÃO é payout externo, NÃO é bank_settlement.
   */
  | 'actor_wallet';

/**
 * Conta do Unify Bank
 */
export interface BankAccount {
  accountId: string;
  tenantId: string;
  ownerId: string;
  ownerType: BankAccountOwnerType;
  accountType: BankAccountType;
  currency: BankCurrency;
  cachedBalanceCents: MoneyCents; // Cache apenas - saldo real vem do ledger (centavos)
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  /** Genesis: actor_id da conta (para INSERT em bank_transactions quando authorship não tem UUID) */
  actorId?: string | null;
}

/**
 * Input para criar uma conta
 */
export interface CreateBankAccountInput {
  ownerId: string;
  ownerType: BankAccountOwnerType;
  /** Tipo do lifecycle; default 'credit' para compatibilidade */
  accountType?: BankAccountType;
  currency?: BankCurrency;
  metadata?: Record<string, any>;
}

/**
 * Resultado de busca de contas
 */
export interface BankAccountsSearchResult {
  accounts: BankAccount[];
  /** Contagem de contas retornadas (paginação); não é montante monetário. */
  matchingAccountCount: number;
}

/**
 * Opções de busca de contas
 */
export interface BankAccountSearchOptions {
  ownerId?: string;
  ownerType?: BankAccountOwnerType;
  currency?: BankCurrency;
  limit?: number;
  offset?: number;
}









