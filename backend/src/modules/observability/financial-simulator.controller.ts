// Simulador Financeiro Interno — POST /internal/financial/simulate-payment
// Executa um fluxo completo: deposit → payment → escrow → settlement → release → payout → bank settlement.
// Apenas orquestra serviços existentes (SSOT: bankTransactionService); não escreve em bank_transactions/bank_ledger.
// Ontologia social (§4.8): humano = actor `user` (via users + ensureUserActor); empresa = actor `page` + row em `companies` (ensurePageActor). Contas user_wallet: owner_id canónico = user_id + ":user_wallet" (ver bank-account.service ensureLifecycleAccountsForOwner).

import type { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { getClientWithTenant } from '@core/database/pool';
import { tenantService } from '@core/tenants/tenant.service';
import { bankAccountService } from '../bank/bank-account.service';
import { bankTransactionService } from '../bank/bank-transaction.service';
import { paymentExecutionService } from '../marketplace/payment-execution.service';
import { buildSystemAuthorship } from '../bank/financial-authorship.helper';
import { ensurePageActor, ensureUserActor } from '../identity/actor-writer.service';

const SIMULATION_AMOUNT_CENTS = 10_000; // 100 BRL
/** Hash bcrypt fixo (não usado para login real) — exigido por `users.password_hash` NOT NULL */
const SIM_USER_PASSWORD_HASH =
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const financialSimulatorController: FastifyPluginAsync = async (app) => {
  app.post('/financial/simulate-payment', async (_req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({
        simulation: 'forbidden',
        error: 'Financial simulator is not available in production',
      });
    }
    const tenantId = uuidv4();
    const simUserId = uuidv4();
    let sellerCompanyId = '';
    let buyerActorId = '';
    let sellerActorId = '';
    const paymentIntentId = uuidv4();
    const payoutRequestId = uuidv4();
    const bankTransferId = uuidv4();

    try {
      await tenantService.createTenant({
        id: tenantId,
        name: 'Simulation Tenant',
        slug: `sim-${tenantId.replace(/-/g, '')}`,
      });

      const setupClient = await pool.connect();
      try {
        await setupClient.query("SELECT set_config('app.current_tenant', $1, false)", [tenantId]);
        await setupClient.query(
          `
          INSERT INTO users (user_id, tenant_id, email, password_hash, token_version, is_test)
          VALUES ($1, $2, $3, $4, 0, true)
          `,
          [
            simUserId,
            tenantId,
            `sim-${tenantId.replace(/-/g, '').slice(0, 16)}@sim.unificard.local`,
            SIM_USER_PASSWORD_HASH,
          ]
        );
        const co = await setupClient.query<{ company_id: string }>(
          `
          INSERT INTO companies (tenant_id, company_name, trade_name, status, company_status)
          VALUES ($1, $2, $3, 'active', 'ACTIVE')
          RETURNING company_id
          `,
          [tenantId, 'Sim Seller LTDA', 'Sim Seller']
        );
        sellerCompanyId = co.rows[0]!.company_id;
      } finally {
        setupClient.release();
      }

      const userActor = await ensureUserActor(tenantId, simUserId);
      const pageActor = await ensurePageActor(tenantId, sellerCompanyId, userActor.actor_id);
      buyerActorId = userActor.actor_id;
      sellerActorId = pageActor.actor_id;

      await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');
      await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, simUserId, 'user', 'BRL');
      await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, sellerCompanyId, 'company', 'BRL');

      const buyerWallet = await bankAccountService.getLifecycleAccount(
        tenantId,
        simUserId,
        'user',
        'user_wallet',
        'BRL'
      );
      const escrowAccount = await bankAccountService.getPlatformLifecycleAccount(
        tenantId,
        'escrow_payments',
        'BRL'
      );
      const systemReserve = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');

      if (!buyerWallet || !escrowAccount) {
        return reply.code(500).send({
          simulation: 'failed',
          error: 'buyerWallet or escrow_payments account not found',
        });
      }

      if (!systemReserve) {
        return reply.code(500).send({
          simulation: 'failed',
          error: 'System reserve account not found',
        });
      }

      const systemAuth = buildSystemAuthorship({ actingForAccountId: systemReserve.accountId });

      // C2: concept_id obrigatório (DECISION-C2-010) — uses existing concept
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: systemReserve.accountId,
        toAccountId: buyerWallet.accountId,
        amountCents: SIMULATION_AMOUNT_CENTS,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Simulation deposit',
        referenceType: 'simulation_deposit',
        referenceId: uuidv4(),
        authorship: systemAuth,
        treasurySource: 'treasury:simulation',
        concept_id: 'system-reserve-credit',
      });

      // C2: concept_id obrigatório (DECISION-C2-010) — uses existing concept
      await bankTransactionService.transfer(tenantId, {
        eventId: uuidv4(),
        fromAccountId: buyerWallet.accountId,
        toAccountId: escrowAccount.accountId,
        amountCents: SIMULATION_AMOUNT_CENTS,
        currency: 'BRL',
        transactionType: 'transfer',
        description: 'Simulation payment',
        referenceType: 'simulation_payment',
        referenceId: paymentIntentId,
        authorship: buildSystemAuthorship({ actingForAccountId: buyerWallet.accountId }),
        concept_id: 'escrow-hold',
      });

      const accountOpts = {
        escrowAccountId: escrowAccount.accountId,
        clearingAccountId: (await bankAccountService.getPlatformLifecycleAccount(tenantId, 'clearing', 'BRL'))!.accountId,
        sellerPendingAccountId: (await bankAccountService.getLifecycleAccount(tenantId, sellerCompanyId, 'company', 'seller_pending', 'BRL'))!.accountId,
        sellerAvailableAccountId: (await bankAccountService.getLifecycleAccount(tenantId, sellerCompanyId, 'company', 'seller_available', 'BRL'))!.accountId,
        sellerPayoutAccountId: (await bankAccountService.getLifecycleAccount(tenantId, sellerCompanyId, 'company', 'seller_payout', 'BRL'))!.accountId,
        bankSettlementAccountId: (await bankAccountService.getPlatformLifecycleAccount(tenantId, 'bank_settlement', 'BRL'))!.accountId,
      };

      await paymentExecutionService.settlePaymentToSeller(
        tenantId,
        paymentIntentId,
        SIMULATION_AMOUNT_CENTS,
        sellerCompanyId,
        'BRL',
        { orderId: uuidv4(), sellerActorId, ...accountOpts }
      );

      await paymentExecutionService.releaseSellerFunds(
        tenantId,
        paymentIntentId,
        SIMULATION_AMOUNT_CENTS,
        sellerCompanyId,
        'BRL',
        {
          sellerPendingAccountId: accountOpts.sellerPendingAccountId,
          sellerAvailableAccountId: accountOpts.sellerAvailableAccountId,
        }
      );

      await paymentExecutionService.requestSellerPayout(
        tenantId,
        sellerCompanyId,
        SIMULATION_AMOUNT_CENTS,
        'BRL',
        payoutRequestId
      );

      await paymentExecutionService.confirmBankPayout(
        tenantId,
        sellerCompanyId,
        SIMULATION_AMOUNT_CENTS,
        'BRL',
        bankTransferId,
        {
          sellerPayoutAccountId: accountOpts.sellerPayoutAccountId,
          bankSettlementAccountId: accountOpts.bankSettlementAccountId,
        }
      );

      const buyerBalance = await bankAccountService.getBalance(tenantId, buyerWallet.accountId);
      const sellerAvailable = await bankAccountService.getLifecycleAccount(tenantId, sellerCompanyId, 'company', 'seller_available', 'BRL');
      const sellerBalanceCents = sellerAvailable
        ? (await bankAccountService.getBalance(tenantId, sellerAvailable.accountId)).balanceCents
        : 0;
      const bankSettlementBalanceCents = (
        await bankAccountService.getBalance(tenantId, accountOpts.bankSettlementAccountId)
      ).balanceCents;

      const ledgerRows = await getClientWithTenant(tenantId).then((c) =>
        c
          .query(
            `SELECT id, account_id, transaction_id, direction, amount_cents, created_at
             FROM bank_ledger WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 200`,
            [tenantId]
          )
          .then((r) => r.rows)
          .finally(() => c.release())
      );
      const auditRows = await pool
        .query(
          `SELECT id, event_type, transaction_id, account_id, actor_id, amount_cents, created_at
           FROM financial_audit_trail WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100`,
          [tenantId]
        )
        .then((r) => r.rows)
        .catch(() => []);

      return reply.send({
        simulation: 'completed',
        balances: {
          buyerWalletCents: buyerBalance.balanceCents,
          sellerAvailableCents: sellerBalanceCents,
          bankSettlementCents: bankSettlementBalanceCents,
        },
        ledger: ledgerRows.map((r: any) => ({
          id: r.id,
          account_id: r.account_id,
          transaction_id: r.transaction_id,
          direction: r.direction,
          amount_cents: Number(r.amount_cents),
          created_at: r.created_at,
        })),
        audit: auditRows.map((r: any) => ({
          id: r.id,
          event_type: r.event_type,
          transaction_id: r.transaction_id,
          account_id: r.account_id,
          actor_id: r.actor_id,
          amount_cents: r.amount_cents != null ? Number(r.amount_cents) : null,
          created_at: r.created_at,
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(500).send({
        simulation: 'failed',
        error: message,
      });
    }
  });
};

export default financialSimulatorController;