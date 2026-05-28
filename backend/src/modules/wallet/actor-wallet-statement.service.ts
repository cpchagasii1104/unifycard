// backend/src/modules/wallet/actor-wallet-statement.service.ts
//
// Read-model do extrato da actor_wallet (Camada 1 D-money — 2026-05-26).
//
// Retorna saldo + entradas com origem rastreável:
//   - Para entries originadas pelo D-money (reference_type=
//     'fixed_price_release_to_actor_wallet'), reconstrói service_order
//     + payment_request + payment_intent + payer via JOINs canônicos.
//   - Outras entries (legado, marketplace, gateway, etc.) aparecem com
//     sourceType='unknown' sem quebrar.
//
// REGRAS:
//   - Apenas leitura. Não move dinheiro. Não escreve em bank_ledger.
//   - Saldo SEMPRE vem do bank_ledger via bankAccountService.getBalance
//     (SSOT preservado). NÃO calcula saldo paralelo.
//   - Isolamento: caller controla actorId — sem actor_id, sem extrato.
//     Service NÃO valida que actorId pertence ao caller; a camada de
//     rota é responsável por garantir actionContext.actorId === actorId.
//
// Uso típico (rota): GET /identity/wallet/actor-statement
//   → actionContext.actorId
//   → getActorWalletStatement(tenantId, actorId).

import { pool } from '@core/database/pool';
import { bankAccountService } from '@modules/bank/bank-account.service';
import type { BankCurrency } from '@modules/bank/bank-account.types';

export type WalletEntryDirection = 'credit' | 'debit';

export type WalletEntrySourceType = 'service_order' | 'unknown';

export interface WalletEntry {
  direction: WalletEntryDirection;
  amountCents: number;
  createdAt: string;
  sourceType: WalletEntrySourceType;
  /** Preenchido quando sourceType='service_order'. */
  serviceOrderId: string | null;
  paymentRequestId: string | null;
  paymentIntentId: string | null;
  /** Actor que pagou pelo serviço (origem econômica). */
  payerActorId: string | null;
  /** Reference técnica do bank_transactions (sempre presente). */
  referenceType: string;
  referenceId: string;
  description: string;
}

export interface ActorWalletStatement {
  actorWallet: {
    accountId: string;
    /** Alias para grossBalanceCents. Mantido para compatibilidade. */
    balanceCents: number;
    /** Saldo bruto via bank_ledger. SSOT — não persistir, não usar para executar movimentações. */
    grossBalanceCents: number;
    /**
     * Soma de (amount_cents − recovered_amount_cents) de obrigações em
     * status 'approved' ou 'partially_recovered'. Projeção calculada em
     * leitura — NÃO é SSOT financeiro. NÃO usar como fonte para executar
     * movimentações financeiras. DECISION-0053.
     */
    pendingRecoveryCents: number;
    /**
     * max(0, grossBalanceCents − pendingRecoveryCents). Projeção calculada
     * em leitura — NÃO é SSOT financeiro. NÃO usar como fonte para
     * executar movimentações financeiras.
     */
    availableBalanceCents: number;
    currency: BankCurrency;
  } | null;
  entries: WalletEntry[];
}

interface StatementRow {
  direction: string;
  amount_cents: string;
  created_at: Date;
  reference_type: string;
  reference_id: string;
  service_order_id: string | null;
  payment_request_id: string | null;
  payer_actor_id: string | null;
  payment_intent_id: string | null;
}

class ActorWalletStatementService {
  /**
   * Retorna extrato da actor_wallet do actor informado.
   *
   * Caso a actor_wallet ainda NÃO exista, retorna actorWallet=null
   * (não cria — caller deve apresentar UI vazia ou orientar release).
   *
   * @param limit Máximo de entries a retornar (default 100).
   */
  async getActorWalletStatement(
    tenantId: string,
    actorId: string,
    limit = 100,
    currency: BankCurrency = 'BRL'
  ): Promise<ActorWalletStatement> {
    if (!tenantId || !actorId) {
      throw new Error('getActorWalletStatement: tenantId e actorId são obrigatórios');
    }
    const wallet = await bankAccountService.getActorWalletAccount(tenantId, actorId, currency);
    if (!wallet) {
      return { actorWallet: null, entries: [] };
    }
    const grossBalanceCents = (await bankAccountService.getBalance(tenantId, wallet.accountId))
      .balanceCents;

    // Pending recovery projection (read-only — SSOT é bank_ledger, não este campo).
    const obligResult = await pool.query<{ pending_cents: string }>(
      `SELECT COALESCE(SUM(amount_cents - recovered_amount_cents), 0)::text AS pending_cents
         FROM actor_wallet_recovery_obligations
        WHERE tenant_id = $1
          AND debtor_actor_id = $2
          AND status IN ('approved', 'partially_recovered')`,
      [tenantId, actorId]
    );
    const pendingRecoveryCents = parseInt(obligResult.rows[0]!.pending_cents, 10);
    const availableBalanceCents = Math.max(0, grossBalanceCents - pendingRecoveryCents);

    // Query única com JOINs LEFT — reconstrói origem para D-money entries.
    // Entries sem JOIN bem-sucedido (sourceType='unknown') aparecem
    // intactas (referenceType/referenceId/direction/amountCents/createdAt).
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    const result = await pool.query<StatementRow>(
      `
      SELECT
        bl.direction,
        bl.amount_cents::text AS amount_cents,
        bl.created_at,
        bt.reference_type,
        bt.reference_id,
        -- Para D-money entries: extrai serviceOrderId do composite
        --   reference_id='\${serviceOrderId}:\${splitId}'.
        CASE
          WHEN bt.reference_type = 'fixed_price_release_to_actor_wallet'
            THEN SPLIT_PART(bt.reference_id, ':', 1)
          ELSE NULL
        END AS service_order_id,
        spr.payment_request_id::text AS payment_request_id,
        spr.payer_actor_id::text     AS payer_actor_id,
        pi.id::text                  AS payment_intent_id
      FROM bank_ledger bl
      INNER JOIN bank_transactions bt ON bt.id = bl.transaction_id
      LEFT JOIN service_orders so
        ON bt.reference_type = 'fixed_price_release_to_actor_wallet'
       AND so.tenant_id = bl.tenant_id
       AND so.id::text = SPLIT_PART(bt.reference_id, ':', 1)
      LEFT JOIN service_payment_requests spr
        ON spr.tenant_id = so.tenant_id
       AND spr.booking_id = so.booking_id
      LEFT JOIN payment_intents pi
        ON pi.tenant_id = spr.tenant_id
       AND pi.reference_id = spr.payment_request_id::text
      WHERE bl.tenant_id = $1::uuid
        AND bl.account_id = $2::uuid
      ORDER BY bl.created_at DESC, bl.id DESC
      LIMIT $3
      `,
      [tenantId, wallet.accountId, safeLimit]
    );

    const entries: WalletEntry[] = result.rows.map((row) => {
      const direction = row.direction as WalletEntryDirection;
      const amountCents = parseInt(row.amount_cents, 10);
      const createdAt = row.created_at.toISOString();
      const referenceType = row.reference_type;
      const referenceId = row.reference_id;

      if (row.reference_type === 'fixed_price_release_to_actor_wallet' && row.service_order_id) {
        return {
          direction,
          amountCents,
          createdAt,
          sourceType: 'service_order',
          serviceOrderId: row.service_order_id,
          paymentRequestId: row.payment_request_id,
          paymentIntentId: row.payment_intent_id,
          payerActorId: row.payer_actor_id,
          referenceType,
          referenceId,
          description: `Recebimento por service_order ${row.service_order_id.slice(0, 8)}`,
        };
      }
      return {
        direction,
        amountCents,
        createdAt,
        sourceType: 'unknown',
        serviceOrderId: null,
        paymentRequestId: null,
        paymentIntentId: null,
        payerActorId: null,
        referenceType,
        referenceId,
        description: `Entrada não-canônica D-money (${referenceType})`,
      };
    });

    return {
      actorWallet: {
        accountId: wallet.accountId,
        balanceCents: grossBalanceCents,
        grossBalanceCents,
        pendingRecoveryCents,
        availableBalanceCents,
        currency,
      },
      entries,
    };
  }
}

export const actorWalletStatementService = new ActorWalletStatementService();
