// backend/src/scripts/seed-smoke-p3.ts
//
// 2026-05-18: Substrato Fase 2 — atores adicionais + delegação + saldos.
// EXECUTOR CONTÍNUO sob delegação operacional (Clayton 2026-05-18).
//
// Pré-requisitos:
//   - seed-test-ecosystem rodado (cria João, Maria, Pedro, Lúcia, Carla +
//     pages Clínica Sorrisos, Voltagem Bar Band, Bar do Tonho)
//   - seed-smoke-p2 rodado (cria contas bank PF João e PJ Voltagem Bar Band
//     com saldos 330000/1150000 centavos)
//
// Garante (idempotente):
//   - Contas bank PF: Maria, Pedro, Lúcia
//   - Conta bank PJ: Clínica Sorrisos
//   - Saldos iniciais distintos por actor (bleed visível em F3)
//   - actor_delegation ativa Lúcia → Voltagem Bar Band com scopes financeiros
//
// Usa workaround LOCAL para 'system' literal: passa actor humano como autor
// (mesma decisão de seed-smoke-p2 — ver DT-PRESSURE-BUILDSYSTEMAUTHORSHIP-INVALID-ACTOR-ID).
//
// APENAS DEV — bloqueia em NODE_ENV=production.

import dotenv from 'dotenv';
import { join } from 'path';
import { pool, runQueryWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';
import { actorDelegationRepository } from '../core/actor-delegation/actor-delegation.repository';
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

const TENANT_ID = 'fbe13b78-4516-493d-905a-363796aea1d1';

// Atores adicionais (já existentes via seed-test-ecosystem)
const EXTRA_USERS = [
  { email: 'maria.souza@teste.unificard.local', initialCents: 500000, tag: 'maria' },
  { email: 'pedro.tonho@teste.unificard.local', initialCents: 400000, tag: 'pedro' },
  { email: 'lucia.lopes@teste.unificard.local', initialCents: 200000, tag: 'lucia' },
];

// Segundo PJ do João — Clínica Sorrisos (já existente via seed-test-ecosystem)
const CLINICA_DISPLAY = 'Clínica Sorrisos';
const CLINICA_INITIAL_CENTS = 700000;

// Delegação Lúcia → Voltagem Bar Band
const VOLTAGEM_DISPLAY = 'Voltagem Bar Band';
const DELEGATION_SCOPES = ['bank.view_balance', 'company.view_reports'];

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
  metadata: Record<string, unknown>,
  authorActorId: string
) {
  const eventId = `${eventTag}-${tenantId}`;
  const authorship = buildSystemAuthorship({
    actingForAccountId: toAccount.accountId,
    actingForActorId: authorActorId,
  });
  try {
    const result = await bankTransactionService.createSimpleTransaction(tenantId, {
      eventId,
      referenceType: 'smoke_p3_seed',
      fromAccountId: reserveAccount.accountId,
      toAccountId: toAccount.accountId,
      amountCents,
      currency: 'BRL',
      transactionType: 'deposit',
      description,
      metadata: { type: 'smoke_p3_seed', eventTag, ...metadata },
      concept_id: 'system-reserve-credit',
      authorship,
    });
    console.log(`  ✅ ${eventTag}: +${amountCents} centavos (tx ${result.transaction.transactionId.substring(0, 8)})`);
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    if (msg.match(/duplic|already exist|idempot|unique constraint|conflict/i)) {
      console.log(`  ⏭️  ${eventTag}: já aplicado (idempotência)`);
      return;
    }
    throw err;
  }
}

async function resolveUserAndActor(email: string) {
  const userRow = await runQueryWithTenant<{ user_id: string }>(
    TENANT_ID,
    `SELECT user_id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
    [TENANT_ID, email]
  );
  if (!userRow) throw new Error(`User ${email} não existe — rode seed-test-ecosystem antes`);
  const actorRow = await runQueryWithTenant<{ actor_id: string }>(
    TENANT_ID,
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
    [TENANT_ID, userRow.user_id]
  );
  if (!actorRow) throw new Error(`Actor user para ${email} não existe`);
  return { userId: userRow.user_id, actorId: actorRow.actor_id };
}

async function resolveActorPage(displayName: string) {
  const row = await runQueryWithTenant<{ actor_id: string; company_id: string }>(
    TENANT_ID,
    `SELECT actor_id, company_id FROM actors WHERE tenant_id = $1 AND display_name = $2 AND actor_type = 'page' LIMIT 1`,
    [TENANT_ID, displayName]
  );
  if (!row) throw new Error(`Actor page "${displayName}" não existe — rode seed-test-ecosystem antes`);
  return row;
}

async function main() {
  console.log('=== seed-smoke-p3 ===');
  console.log(`tenantId: ${TENANT_ID}`);

  const reserveAccount = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve', 'BRL');
  if (!reserveAccount) throw new Error('Reserve system account não existe');
  console.log(`  reserveAccountId=${reserveAccount.accountId}`);

  // ============================================================
  // 1. Contas + saldos PF (Maria, Pedro, Lúcia)
  // ============================================================
  const resolved: Record<string, { userId: string; actorId: string; accountId: string }> = {};

  for (const u of EXTRA_USERS) {
    const { userId, actorId } = await resolveUserAndActor(u.email);
    const account = await bankAccountService.getOrCreateAccount(TENANT_ID, {
      ownerId: userId,
      ownerType: 'user',
      currency: 'BRL',
    });
    resolved[u.tag] = { userId, actorId, accountId: account.accountId };
    console.log(`  ${u.tag}: userId=${userId.substring(0, 8)} actorId=${actorId.substring(0, 8)} acct=${account.accountId.substring(0, 8)}`);
    await creditFromReserve(
      TENANT_ID,
      `smoke-p3-${u.tag}`,
      reserveAccount,
      account,
      u.initialCents,
      `Smoke P3 seed PF ${u.tag} (${u.initialCents} cents)`,
      { userId, tag: u.tag, side: 'PF' },
      actorId
    );
  }

  // ============================================================
  // 2. Conta + saldo PJ (Clínica Sorrisos — segundo PJ do João)
  // ============================================================
  const clinica = await resolveActorPage(CLINICA_DISPLAY);
  const clinicaAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: clinica.company_id,
    ownerType: 'company',
    currency: 'BRL',
  });
  console.log(`  clinica: actorId=${clinica.actor_id.substring(0, 8)} companyId=${clinica.company_id.substring(0, 8)} acct=${clinicaAccount.accountId.substring(0, 8)}`);
  await creditFromReserve(
    TENANT_ID,
    'smoke-p3-clinica',
    reserveAccount,
    clinicaAccount,
    CLINICA_INITIAL_CENTS,
    `Smoke P3 seed PJ Clínica Sorrisos (${CLINICA_INITIAL_CENTS} cents)`,
    { companyId: clinica.company_id, tag: 'clinica', side: 'PJ' },
    clinica.actor_id
  );

  // ============================================================
  // 3. Delegação Lúcia → Voltagem Bar Band (scopes financeiros)
  // ============================================================
  const voltagem = await resolveActorPage(VOLTAGEM_DISPLAY);
  console.log(`  voltagem: actorId=${voltagem.actor_id.substring(0, 8)}`);

  const luciaActor = resolved['lucia'].actorId;

  // Idempotência: revogar delegações ativas anteriores acontece dentro do create()
  // mas vamos verificar primeiro se já existe ativa com mesmos scopes
  const existingDel = await runQueryWithTenant<{ delegation_id: string; scopes_json: any }>(
    TENANT_ID,
    `
    SELECT delegation_id, scopes_json
    FROM actor_delegations
    WHERE tenant_id = $1
      AND user_actor_id = $2
      AND institutional_actor_id = $3
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
    `,
    [TENANT_ID, luciaActor, voltagem.actor_id]
  );
  if (existingDel) {
    const existingScopes = JSON.stringify((existingDel.scopes_json || []).sort());
    const wantedScopes = JSON.stringify([...DELEGATION_SCOPES].sort());
    if (existingScopes === wantedScopes) {
      console.log(`  ⏭️  Delegação Lúcia→Voltagem já ativa com mesmos scopes (${existingDel.delegation_id.substring(0, 8)})`);
    } else {
      console.log(`  ⚠️ Delegação ativa com scopes diferentes — recriando`);
      const del = await actorDelegationRepository.create(TENANT_ID, {
        userActorId: luciaActor,
        institutionalActorId: voltagem.actor_id,
        scopes: DELEGATION_SCOPES,
        isTransitive: false,
      });
      console.log(`  ✅ Delegação Lúcia→Voltagem criada: ${del.delegationId.substring(0, 8)}`);
    }
  } else {
    const del = await actorDelegationRepository.create(TENANT_ID, {
      userActorId: luciaActor,
      institutionalActorId: voltagem.actor_id,
      scopes: DELEGATION_SCOPES,
      isTransitive: false,
    });
    console.log(`  ✅ Delegação Lúcia→Voltagem criada: ${del.delegationId.substring(0, 8)}`);
  }

  // ============================================================
  // 4. Verificar saldos finais
  // ============================================================
  console.log('\n=== SUBSTRATE P3 READY ===');
  const balances: Record<string, number> = {};
  for (const u of EXTRA_USERS) {
    const b = await bankAccountService.getBalance(TENANT_ID, resolved[u.tag].accountId);
    balances[u.tag] = Number(b.balanceCents);
  }
  const clinicaBal = await bankAccountService.getBalance(TENANT_ID, clinicaAccount.accountId);

  console.log(JSON.stringify({
    tenantId: TENANT_ID,
    maria: { actorId: resolved['maria'].actorId, accountId: resolved['maria'].accountId, balanceCents: balances['maria'], expectedCents: 500000 },
    pedro: { actorId: resolved['pedro'].actorId, accountId: resolved['pedro'].accountId, balanceCents: balances['pedro'], expectedCents: 400000 },
    lucia: { actorId: resolved['lucia'].actorId, accountId: resolved['lucia'].accountId, balanceCents: balances['lucia'], expectedCents: 200000 },
    clinica: { actorId: clinica.actor_id, companyId: clinica.company_id, accountId: clinicaAccount.accountId, balanceCents: Number(clinicaBal.balanceCents), expectedCents: CLINICA_INITIAL_CENTS },
    voltagem: { actorId: voltagem.actor_id, companyId: voltagem.company_id },
    delegationLuciaVoltagem: { userActorId: luciaActor, institutionalActorId: voltagem.actor_id, scopes: DELEGATION_SCOPES },
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
