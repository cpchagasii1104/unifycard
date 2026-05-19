// backend/src/scripts/seed-smoke-p2.ts
//
// 2026-05-18: Substrato mínimo para smoke browser PF↔PJ (Clayton).
// EXECUTOR CONTÍNUO sob delegação operacional.
//
// Garante:
//   - User João Silva PF logável (assumir seed-test-ecosystem rodado)
//   - Actor page Voltagem Bar Band vinculado (assumir idem)
//   - Membership Voltagem com can_manage_company + can_manage_financial = true
//     (já default do seed-test-ecosystem para staff — apenas verifica)
//   - Conta bank PF + saldo > 0
//   - Conta bank PJ + saldo > 0 — VALORES DIFERENTES (essencial para bleed visível)
//   - 2-3 transações por lado (statement não-vazio)
//
// Idempotente — re-rodar não duplica (eventId determinístico).
// Usa apenas APIs canônicas (bankAccountService.getOrCreateAccount +
// bankTransactionService.createSimpleTransaction + buildSystemAuthorship).
// Padrão clonado de seed-initial-balance.ts (template canônico reserve→user).
//
// APENAS DEV — bloqueia em NODE_ENV=production.

import dotenv from 'dotenv';
import { join } from 'path';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';
import 'tsconfig-paths/register';

dotenv.config({ path: join(process.cwd(), '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL ausente');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Script NÃO pode rodar em produção');
  process.exit(1);
}

// ============================================================
// Configuração (deve match com seed-test-ecosystem.ts)
// ============================================================
const TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';
const USER_EMAIL = 'joao.silva@teste.unificard.local';
const COMPANY_DISPLAY_NAME = 'Voltagem Bar Band';

// Saldos finais esperados após este seed (somatório dos créditos abaixo).
// PF e PJ DIFERENTES propositalmente — bleed visível se frontend confundir.
const PF_CREDITS_CENTS = [250000, 50000, 30000]; // R$ 2.500 + R$ 500 + R$ 300 = R$ 3.300
const PJ_CREDITS_CENTS = [800000, 200000, 150000]; // R$ 8.000 + R$ 2.000 + R$ 1.500 = R$ 11.500

interface AccountLike {
  accountId: string;
}

async function creditFromReserve(
  tenantId: string,
  eventTag: string,
  reserveAccount: AccountLike,
  toAccount: AccountLike,
  amountCents: number,
  description: string,
  metadata: Record<string, unknown>
) {
  // eventId determinístico → idempotência via gateway_webhook_events / dedupe
  const eventId = `${eventTag}-${tenantId}`;
  const authorship = buildSystemAuthorship({
    actingForAccountId: toAccount.accountId,
    actingForActorId: 'system',
  });

  try {
    const result = await bankTransactionService.createSimpleTransaction(tenantId, {
      eventId,
      referenceType: 'smoke_p2_seed',
      fromAccountId: reserveAccount.accountId,
      toAccountId: toAccount.accountId,
      amountCents,
      currency: 'BRL',
      transactionType: 'deposit',
      description,
      metadata: { type: 'smoke_p2_seed', eventTag, ...metadata },
      concept_id: 'system-reserve-credit',
      authorship,
    });
    console.log(`  ✅ ${eventTag}: +${amountCents} centavos (tx ${result.transaction.transactionId.substring(0, 8)})`);
    return true;
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.match(/duplic|already exist|idempot|unique constraint|conflict/i)) {
      console.log(`  ⏭️  ${eventTag}: já aplicado (idempotência)`);
      return false;
    }
    throw err;
  }
}

async function main() {
  console.log('=== seed-smoke-p2 ===');
  console.log(`tenantId: ${TENANT_ID}`);
  console.log(`userEmail: ${USER_EMAIL}`);
  console.log(`companyDisplay: ${COMPANY_DISPLAY_NAME}`);

  // 1. Resolver user PF via email
  const userRow = await runQueryWithTenant<{ user_id: string; global_user_id: string | null }>(
    TENANT_ID,
    `SELECT user_id, global_user_id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
    [TENANT_ID, USER_EMAIL]
  );
  if (!userRow) {
    throw new Error(`User ${USER_EMAIL} não existe. Rode seed-test-ecosystem antes.`);
  }
  const userId = userRow.user_id;
  console.log(`  user_id=${userId}`);

  // 2. Resolver actor user de João
  const actorUserRow = await runQueryWithTenant<{ actor_id: string }>(
    TENANT_ID,
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
    [TENANT_ID, userId]
  );
  if (!actorUserRow) {
    throw new Error(`Actor user para ${USER_EMAIL} não existe.`);
  }
  const actorUserId = actorUserRow.actor_id;
  console.log(`  actorUserId=${actorUserId}`);

  // 3. Resolver actor page Voltagem por display_name
  const actorPageRow = await runQueryWithTenant<{ actor_id: string; company_id: string }>(
    TENANT_ID,
    `SELECT actor_id, company_id FROM actors WHERE tenant_id = $1 AND display_name = $2 AND actor_type = 'page' LIMIT 1`,
    [TENANT_ID, COMPANY_DISPLAY_NAME]
  );
  if (!actorPageRow) {
    throw new Error(`Actor page "${COMPANY_DISPLAY_NAME}" não existe. Rode seed-test-ecosystem antes.`);
  }
  const actorPageId = actorPageRow.actor_id;
  const companyId = actorPageRow.company_id;
  console.log(`  actorPageId=${actorPageId}`);
  console.log(`  companyId=${companyId}`);

  // 4. Verificar membership e can_* (defensivo — não muta, só confirma)
  const membershipRow = await runQueryWithTenant<{
    role: string;
    can_manage_company: boolean;
    can_manage_financial: boolean;
    is_active: boolean;
  }>(
    TENANT_ID,
    `
    SELECT cu.role, cu.can_manage_company, cu.can_manage_financial, cu.is_active
    FROM company_users cu
    INNER JOIN users u ON cu.global_user_id = u.global_user_id
    WHERE cu.company_id = $1 AND u.user_id = $2 AND u.tenant_id = $3 AND cu.is_active = true
    LIMIT 1
    `,
    [companyId, userId, TENANT_ID]
  );
  if (!membershipRow) {
    throw new Error(`Membership ativa de ${USER_EMAIL} em ${COMPANY_DISPLAY_NAME} não existe.`);
  }
  console.log(`  membership: role=${membershipRow.role} can_manage_company=${membershipRow.can_manage_company} can_manage_financial=${membershipRow.can_manage_financial}`);
  if (!membershipRow.can_manage_company || !membershipRow.can_manage_financial) {
    console.warn('  ⚠️ ATENÇÃO: requisitos can_manage_company+can_manage_financial não estão BOTH true. Smoke HTTP passo 9 pode falhar critério.');
  }

  // 5. Resolver/criar conta PF
  const pfAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: userId,
    ownerType: 'user',
    currency: 'BRL',
  });
  console.log(`  pfAccountId=${pfAccount.accountId}`);

  // 6. Resolver/criar conta PJ (ownerType='company', ownerId=companyId)
  const pjAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: companyId,
    ownerType: 'company',
    currency: 'BRL',
  });
  console.log(`  pjAccountId=${pjAccount.accountId}`);

  // 7. Resolver conta system reserve (fonte dos créditos)
  const reserveAccount = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve', 'BRL');
  if (!reserveAccount) {
    throw new Error('Reserve system account não existe. Rode migrations.');
  }
  console.log(`  reserveAccountId=${reserveAccount.accountId}`);

  // 8. Creditar PF (3 transações, idempotentes)
  console.log('\nCreditando PF:');
  for (let i = 0; i < PF_CREDITS_CENTS.length; i++) {
    await creditFromReserve(
      TENANT_ID,
      `smoke-p2-pf-${i}`,
      reserveAccount,
      pfAccount,
      PF_CREDITS_CENTS[i],
      `Smoke P2 seed PF #${i} (${PF_CREDITS_CENTS[i]} cents)`,
      { userId, side: 'PF', sequence: i }
    );
  }

  // 9. Creditar PJ (3 transações, idempotentes)
  console.log('\nCreditando PJ:');
  for (let i = 0; i < PJ_CREDITS_CENTS.length; i++) {
    await creditFromReserve(
      TENANT_ID,
      `smoke-p2-pj-${i}`,
      reserveAccount,
      pjAccount,
      PJ_CREDITS_CENTS[i],
      `Smoke P2 seed PJ #${i} (${PJ_CREDITS_CENTS[i]} cents)`,
      { companyId, side: 'PJ', sequence: i }
    );
  }

  // 10. Verificar saldos finais
  const pfBalance = await bankAccountService.getBalance(TENANT_ID, pfAccount.accountId);
  const pjBalance = await bankAccountService.getBalance(TENANT_ID, pjAccount.accountId);

  const expectedPF = PF_CREDITS_CENTS.reduce((a, b) => a + b, 0);
  const expectedPJ = PJ_CREDITS_CENTS.reduce((a, b) => a + b, 0);

  console.log('\n=== SUBSTRATE READY ===');
  console.log(JSON.stringify({
    tenantId: TENANT_ID,
    userEmail: USER_EMAIL,
    userId,
    actorUserId,
    pfAccountId: pfAccount.accountId,
    pfBalanceCents: pfBalance.balanceCents,
    pfExpectedCents: expectedPF,
    actorPageId,
    companyId,
    pjAccountId: pjAccount.accountId,
    pjBalanceCents: pjBalance.balanceCents,
    pjExpectedCents: expectedPJ,
    pfMatchesExpected: Number(pfBalance.balanceCents) === expectedPF,
    pjMatchesExpected: Number(pjBalance.balanceCents) === expectedPJ,
    pfDifferentFromPJ: Number(pfBalance.balanceCents) !== Number(pjBalance.balanceCents),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error('❌ Erro:', err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
