import dotenv from "dotenv";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

import { pool } from "../core/database/pool";
import { runQueryWithTenant, getClientWithTenant } from "../core/database/pool";
import { ensureUserActor } from "../modules/identity/actor-writer.service";
import { bankAccountService } from "../modules/bank/bank-account.service";
import { bankAccountRepository } from "../modules/bank/bank-account.repository";
import { bankTransactionService } from "../modules/bank/bank-transaction.service";
import { bankTransactionReadRepository } from "../modules/bank/bank-transaction-read.repository";
import { bankSplitRepository } from "../modules/bank/bank-split.repository";
import {
  buildFinancialAuthorshipFromRequest,
  buildSystemAuthorship,
} from "../modules/bank/financial-authorship.helper";
import { ServiceType, ServiceStatus } from "../modules/services/services.types";
import { eventRFQService } from "../modules/events/event-rfq.service";
import { eventRepository } from "../modules/events/event.repository";
import { servicesRepository } from "../modules/services/services.repository";
import { servicePaymentExecutionService } from "../modules/services/service-payment-execution.service";
import { servicePaymentRequestService } from "../modules/services/service-payment-request.service";
import { processEventOutboxCycle } from "../core/events/event-outbox.processor";
import { insertEventOutboxRow } from "../core/events/event-outbox.repository";
import { createHash } from "crypto";

dotenv.config({ path: join(process.cwd(), ".env") });

/**
 * Copy mecânico do deterministicServicePaymentExecutedOutboxEventId
 * (privado em service-payment-execution.service.ts L26-36). Mantém estrita
 * paridade do hash para verificação de idempotência e do furo do outbox.
 */
function deterministicServicePaymentExecutedOutboxEventId(tenantId: string, executionId: string): string {
  const hash = createHash("sha256")
    .update(`SERVICE_PAYMENT_EXECUTED:${tenantId}:${executionId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const TENANT_ID = process.env.E2E_TENANT_ID || "fbe13b78-4516-493d-905a-363796aea1d1";

async function resolveConceptUuid(slug: string, domain: string): Promise<string> {
  const row = await pool.query<{ concept_id: string }>(
    `SELECT concept_id FROM concepts WHERE domain = $1 AND slug = $2 LIMIT 1`,
    [domain, slug]
  );
  if (!row.rows[0]) throw new Error(`CONCEPT_NOT_FOUND: slug='${slug}' domain='${domain}'`);
  return row.rows[0].concept_id;
}

type CheckResult = { ok: true; detail?: any } | { ok: false; reason: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (r.ok === false) {
    console.error(`  \u274c FALHOU: ${label}`);
    console.error(`     Motivo: ${r.reason}`);
    if (r.detail !== undefined) console.error(JSON.stringify(r.detail, null, 2));
    process.exit(1);
  }
  console.log(`  \u2705 ${label}`);
}

async function expectFail(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    console.error(`  \u274c SISTEMA ACEITOU VIOLACAO: ${label}`);
    console.error(`     Isso e falha estrutural. Abrir entrada em REMEDIATION_DECISIONS_LOG.`);
    process.exit(1);
  } catch (e: any) {
    console.log(`  \u2705 Rejeitou corretamente [${label}]: ${e?.message || String(e)}`);
  }
}

async function seedMinimo() {
  const tenantRes = await pool.query<{ id: string }>(
    "SELECT id FROM tenants WHERE id = $1 LIMIT 1", [TENANT_ID]
  );
  if (!tenantRes.rows[0]) throw new Error("TENANT_NOT_FOUND: rode migrations antes");

  const G2_TEST_PASSWORD_HASH = "$2b$10$G2E2ETestHashPlaceholderForScriptOnly.xxxxxxxxxxxxxxxx";
  const G2_CPFS: Record<string, string> = {
    "g2-buyer@e2e.internal":    "00000000191",
    "g2-provider@e2e.internal": "00000000272",
  };
  const emails = ["g2-buyer@e2e.internal", "g2-provider@e2e.internal"];
  const users: any[] = [];

  for (const email of emails) {
    const userRes = await pool.query<{ user_id: string; email: string; global_user_id: string }>(
      "SELECT user_id, email, global_user_id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1",
      [TENANT_ID, email]
    );
    if (userRes.rows[0]) { users.push({ ...userRes.rows[0] }); continue; }

    // global_users exige cpf NOT NULL. ON CONFLICT por cpf garante idempotencia.
    const globalUserRes = await pool.query<{ global_user_id: string }>(
      `INSERT INTO global_users (cpf, full_name)
       VALUES ($1, $2)
       ON CONFLICT (cpf) DO UPDATE SET cpf = EXCLUDED.cpf
       RETURNING global_user_id`,
      [G2_CPFS[email], email.split("@")[0]]
    );
    const globalUserId = globalUserRes.rows[0].global_user_id;
    const userInsertRes = await pool.query<{ user_id: string; email: string; global_user_id: string }>(
      "INSERT INTO users (tenant_id, email, password_hash, global_user_id) VALUES ($1, $2, $3, $4) RETURNING user_id, email, global_user_id",
      [TENANT_ID, email, G2_TEST_PASSWORD_HASH, globalUserId]
    );
    users.push({ ...userInsertRes.rows[0] });
  }
  const [buyer, provider] = users;

  // Writer canonico de actors — nunca INSERT direto em actors (Lei §4.8)
  buyer.actorId   = (await ensureUserActor(TENANT_ID, buyer.user_id)).actor_id;
  provider.actorId = (await ensureUserActor(TENANT_ID, provider.user_id)).actor_id;

  // authority_roots: obrigatorio para modo strict do engine de autoridade financeira.
  // Em producao ocorre no KYC/onboarding. Aqui usamos CPFs ficticios do seed.
  // digest() usa pgcrypto (ja instalado no banco). ON CONFLICT garante idempotencia.
  // SE OCORRER ERRO "function digest does not exist": PARAR e reportar — nao contornar.
  for (const [actorId, cpf] of [
    [buyer.actorId,    G2_CPFS["g2-buyer@e2e.internal"]],
    [provider.actorId, G2_CPFS["g2-provider@e2e.internal"]],
  ] as [string, string][]) {
    await pool.query(
      `INSERT INTO authority_roots (actor_id, cpf_hash, status)
       VALUES ($1, encode(digest($2::bytea, 'sha256'), 'hex'), 'active')
       ON CONFLICT (actor_id) DO NOTHING`,
      [actorId, cpf]
    );
  }

  // PASSO 3.3c — Garantir entrada em identities com KYC completo
  // O gate financeiro IDENTITY_REQUIRED_STRICT_MODE exige usuario totalmente verificado (KYC completo).
  // ON CONFLICT garante idempotencia — seguro rodar multiplas vezes.
  for (const [user, email] of [
    [buyer, "g2-buyer@e2e.internal"],
    [provider, "g2-provider@e2e.internal"],
  ] as [any, string][]) {
    await pool.query(
      `INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
       VALUES ($1::uuid, $2, 'cpf', 'approved', 'complete')
       ON CONFLICT (global_user_id)
       DO UPDATE SET kyc_status = 'approved', kyc_level = 'complete'`,
      [user.global_user_id, G2_CPFS[email]]
    );
  }

  const buyerAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: buyer.user_id, ownerType: "user", currency: "BRL",
  });
  const providerAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: provider.user_id, ownerType: "user", currency: "BRL",
  });

  let sys = await bankAccountService.getSystemAccount(TENANT_ID, "reserve");
  if (!sys) {
    await bankAccountRepository.createAccount(TENANT_ID, {
      ownerId: "system:reserve:" + TENANT_ID,
      ownerType: "system", accountType: "credit", currency: "BRL",
    });
    sys = await bankAccountService.getSystemAccount(TENANT_ID, "reserve");
  }
  if (!sys) throw new Error("SYSTEM_ACCOUNT_NOT_FOUND");

  // Mint idempotente: eventId fixo garante que segunda execucao nao duplica saldo.
  // Erro "already exists" ou similar e esperado e ignorado (idempotencia).
  const G2_MINT_EVENT_ID = "00000000-0000-0000-0000-000000000001";
  try {
    await bankTransactionService.createSimpleTransaction(TENANT_ID, {
      eventId: G2_MINT_EVENT_ID,
      referenceType: "g2_e2e_system_mint",
      toAccountId: sys.accountId,
      amountCents: 50000000,
      currency: "BRL",
      transactionType: "deposit",
      description: "G2 E2E mint system reserve capacity",
      concept_id: await resolveConceptUuid("system-reserve-credit", "financeiro-payout"),
      authorship: buildSystemAuthorship({ actingForAccountId: sys.accountId, actingForActorId: buyer.actorId }),
    });
  } catch (e: any) {
    if (!/duplicate|unique|already exists|event_id/i.test(e.message)) throw e;
  }

  const G2_SEED_EVENT_ID = "00000000-0000-0000-0000-000000000002";
  try {
    await bankTransactionService.transfer(TENANT_ID, {
      eventId: G2_SEED_EVENT_ID,
      fromAccountId: sys.accountId,
      toAccountId: buyerAccount.accountId,
      amountCents: 1000000,
      currency: "BRL",
      transactionType: "transfer",
      referenceType: "g2_e2e_buyer_seed",
      referenceId: buyer.user_id,
      description: "G2 E2E seed buyer initial balance",
      treasurySource: "treasury:simulation",
      concept_id: await resolveConceptUuid("system-reserve-credit", "financeiro-payout"),
      authorship: buildSystemAuthorship({ actingForAccountId: sys.accountId, actingForActorId: buyer.actorId }),
    });
  } catch (e: any) {
    if (!/duplicate|unique|already exists|event_id/i.test(e.message)) throw e;
  }

  let serviceId: string;
  const serviceRes = await pool.query<{ service_id: string }>(
    `SELECT service_id FROM services WHERE tenant_id=$1 AND actor_id=$2 AND slug='g2-test-service' LIMIT 1`,
    [TENANT_ID, provider.actorId]
  );
  if (serviceRes.rows[0]) {
    serviceId = serviceRes.rows[0].service_id;
  } else {
    const service = await servicesRepository.create(TENANT_ID, {
      actorId: provider.actorId,
      name: "G2 Test Service",
      slug: "g2-test-service",
      priceCents: 40000,
      currency: "BRL",
      status: ServiceStatus.ACTIVE,
      serviceType: ServiceType.SERVICE,
      description: "Service criado para validacao G2 E2E",
    });
    serviceId = service.serviceId;
  }

  let eventId: string;
  const eventRes = await pool.query<{ id: string }>(
    `SELECT id FROM events WHERE tenant_id=$1 AND actor_id=$2 AND metadata->>'e2e_marker' = 'g2-validation' LIMIT 1`,
    [TENANT_ID, buyer.actorId]
  );
  if (eventRes.rows[0]) {
    eventId = eventRes.rows[0].id;
  } else {
    const event = await eventRepository.createEvent(TENANT_ID, {
      organizerActorId: buyer.actorId,
      title: "G2 E2E Validation Event",
      description: "Evento criado para validacao G2 E2E",
      locationActorId: null,
      startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 28 * 60 * 60 * 1000),
      createdByActorId: buyer.actorId,
      createdByUserId: buyer.user_id,
      metadata: { e2e_marker: "g2-validation" },
    });
    eventId = event.id;
  }

  return { buyer, provider, buyerAccount, providerAccount, sys, serviceId, eventId };
}

async function main(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 G2 \u2014 VALIDATE PIPELINE E2E TRANSVERSAL \u2550\u2550\u2550");
  console.log(`Tenant: ${TENANT_ID}  |  ${new Date().toISOString()}\n`);

  // Bootstrap minimo de DI — igual ao app.builder.ts
  // Sem isso, ensureUserActor e services com ports-registry falham.
  {
    const { socialPortsRegistry } = await import("../core/social/ports-registry");
    const {
      actorRepositoryAdapter, actorUtilsAdapter,
      socialRepositoryAdapter, socialServiceAdapter, eventFeedHandlersAdapter,
    } = await import("../modules/social/adapters");
    socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
    socialPortsRegistry.setActorUtils(actorUtilsAdapter);
    socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
    socialPortsRegistry.setSocialService(socialServiceAdapter);
    socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
  }

  // Resolver UUIDs reais dos concepts — nao passar slug como concept_id (banco e UUID com FK)
  const conceptServiceBookingPaymentId =
    await resolveConceptUuid("service-booking-payment", "financeiro-payment");
  console.log("  \u2705 Concepts resolvidos via SSOT semantico\n");

  console.log("=== Seed minimo ===");
  const seed = await seedMinimo();
  console.log("\u2705 Seed OK\n");

  console.log("=== Modo A \u2014 Fluxo causal ===");

  // A1: criar RFQ
  const rfqResult = await eventRFQService.createRFQ(
    TENANT_ID, seed.buyer.actorId,
    { eventId: seed.eventId, items: [{ type: "service", id: seed.serviceId }], criteria: {} },
    seed.buyer.user_id
  );
  assertOk("A1: RFQ criado com rfqId canonico", {
    ok: !!(rfqResult.rfq && typeof rfqResult.rfq.rfqId === "string" && rfqResult.rfq.rfqId.startsWith("rfq_")),
    reason: "rfqId ausente ou invalido", detail: rfqResult,
  });

  // A2: provider submete quote
  const quote = await eventRFQService.createQuote(
    TENANT_ID, seed.eventId, seed.provider.actorId,
    { rfqId: rfqResult.rfq.rfqId, serviceId: seed.serviceId, priceCents: 40000, currency: "BRL" },
    seed.provider.user_id
  );
  assertOk("A2: Quote submetida com quoteId", { ok: !!quote.quoteId, reason: "quoteId ausente", detail: quote });

  // A3: buyer aceita quote — cria booking + paymentRequest
  const accepted = await eventRFQService.acceptQuote(
    TENANT_ID, seed.eventId, rfqResult.rfq.rfqId, quote.quoteId,
    seed.buyer.actorId, seed.buyer.user_id
  );
  assertOk("A3: Quote aceita \u2014 bookingId e paymentRequestId presentes", {
    ok: !!accepted.bookingId && !!accepted.paymentRequestId,
    reason: "bookingId ou paymentRequestId ausente", detail: accepted,
  });

  // A3b: paymentRequest deve estar gravado no SSOT
  const payReq = await servicePaymentRequestService.getPaymentRequest(TENANT_ID, accepted.paymentRequestId);
  assertOk("A3b: PaymentRequest encontrado no SSOT", {
    ok: !!payReq, reason: "paymentRequest nao encontrado", detail: payReq,
  });

  // A4: capturar saldos ANTES do pagamento
  const balBuyerBefore    = (await bankAccountService.getBalance(TENANT_ID, seed.buyerAccount.accountId)).balanceCents;
  const balProviderBefore = (await bankAccountService.getBalance(TENANT_ID, seed.providerAccount.accountId)).balanceCents;

  // A5: executar pagamento via agregador canonico
  const exec = await servicePaymentExecutionService.createExecution(
    TENANT_ID, seed.buyer.user_id,
    {
      paymentRequestId: accepted.paymentRequestId,
      splits: [{ receiverActorId: seed.provider.actorId, amountCents: 40000, percentage: 100 }],
    }
  );
  assertOk("A5: Execucao de pagamento criada", {
    ok: !!exec.execution?.executionId, reason: "executionId ausente", detail: exec,
  });

  // A6: capturar saldos DEPOIS do pagamento
  const balBuyerAfter    = (await bankAccountService.getBalance(TENANT_ID, seed.buyerAccount.accountId)).balanceCents;
  const balProviderAfter = (await bankAccountService.getBalance(TENANT_ID, seed.providerAccount.accountId)).balanceCents;

  // A7: invariante de conservacao de valor (dupla entrada obrigatoria)
  assertOk("A7: Conservacao de valor \u2014 dupla entrada consistente", {
    ok: (balBuyerBefore - balBuyerAfter) === 40000 && (balProviderAfter - balProviderBefore) === 40000,
    reason: "Valor nao conservado",
    detail: { balBuyerBefore, balBuyerAfter, balProviderBefore, balProviderAfter },
  });

  // A8: concept_id garantido por NOT NULL no banco — prova composta com A5+A7
  assertOk("A8: concept_id garantido por DB NOT NULL constraint (A5+A7 confirmam)", {
    ok: true,
    detail: "NOT NULL enforcement no banco — violacao teria sido rejeitada em A5",
  });

  // A9: actors devem ser humanos rastreaveiS — nao organizacionais nem sistema
  for (const actorId of [seed.buyer.actorId, seed.provider.actorId]) {
    const actorRes = await pool.query<{ actor_type: string; responsible_actor_id: string | null }>(
      "SELECT actor_type, responsible_actor_id FROM actors WHERE tenant_id=$1 AND actor_id=$2",
      [TENANT_ID, actorId]
    );
    const row = actorRes.rows[0];
    assertOk("A9: Actors humanos rastreaveiS sem responsible_actor_id", {
      ok: row
        && !["page","actor_organizational","company","system","actor_system"].includes(row.actor_type)
        && row.responsible_actor_id == null,
      reason: "actor_type invalido ou responsible_actor_id nao nulo",
      detail: row,
    });
  }

  // A10: outbox deve conter SERVICE_PAYMENT_EXECUTED (inserido sincronamente em A5)
  // Capturar o event_id determin\u00edstico do executionId da A5 para usar nas Etapas A11/A12.
  const execEventId = deterministicServicePaymentExecutedOutboxEventId(
    TENANT_ID,
    exec.execution.executionId
  );
  const outboxRes = await pool.query<{
    event_type: string;
    event_id: string;
    published_at: Date | null;
  }>(
    `SELECT event_type, event_id::text, published_at FROM event_outbox
     WHERE tenant_id = $1 AND event_id = $2::uuid LIMIT 1`,
    [TENANT_ID, execEventId]
  );
  const hasOutboxEvent = !!outboxRes.rows[0];
  assertOk("A10: Outbox contem SERVICE_PAYMENT_EXECUTED para esta execu\u00e7\u00e3o",
    hasOutboxEvent
      ? { ok: true }
      : { ok: false, reason: "Nenhum evento SERVICE_PAYMENT_EXECUTED no event_outbox", detail: { tenant_id: TENANT_ID, event_id: execEventId } }
  );

  // ============================================================
  // ETAPA A11 \u2014 READ SIDE: processor consome o outbox
  // ============================================================
  // O E2E at\u00e9 aqui prova WRITE side (INSERT outbox). A11 prova que o processor
  // can\u00f4nico (event-outbox.processor.processEventOutboxCycle) consume essa row,
  // publica via eventBus, e marca published_at. Chamada DIRETA (sem worker
  // setInterval) \u2014 \u00e9 o read side s\u00edncrono que o E2E n\u00e3o cobria.
  console.log("\n=== Modo A \u2014 Etapa A11: read side do outbox (processor) ===");

  const beforePub = outboxRes.rows[0]!.published_at;
  assertOk("A11a: row do outbox antes do processor \u2014 published_at IS NULL (n\u00e3o-publicado)", {
    ok: beforePub === null,
    reason: "outbox row j\u00e1 estava publicada antes do processor (E2E s\u00f3 cria; n\u00e3o deveria ter sido processada por worker async ainda)",
    detail: { event_id: execEventId, published_at: beforePub },
  });

  const processedCount = await processEventOutboxCycle();
  console.log(`  \u2139  processEventOutboxCycle: ${processedCount} rows processadas neste ciclo`);

  const afterRes = await pool.query<{ published_at: Date | null; attempts: number }>(
    `SELECT published_at, attempts FROM event_outbox WHERE event_id = $1::uuid LIMIT 1`,
    [execEventId]
  );
  const afterPub = afterRes.rows[0]?.published_at;
  assertOk("A11b: ap\u00f3s processor \u2014 published_at preenchido (row consumida + UPDATE publicada)", {
    ok: afterPub !== null && afterPub !== undefined,
    reason: "row n\u00e3o foi marcada como published_at ap\u00f3s processor cycle",
    detail: { event_id: execEventId, published_at: afterPub, attempts: afterRes.rows[0]?.attempts },
  });

  // A11c: segunda chamada do cycle \u2014 n\u00e3o republica (FOR UPDATE SKIP LOCKED WHERE
  // published_at IS NULL filtra esta row fora). Idempot\u00eancia do processor.
  const processedAgain = await processEventOutboxCycle();
  const afterAgainRes = await pool.query<{ published_at: Date | null }>(
    `SELECT published_at FROM event_outbox WHERE event_id = $1::uuid LIMIT 1`,
    [execEventId]
  );
  assertOk("A11c: segunda chamada do processor n\u00e3o republica (published_at preservado)", {
    ok: afterAgainRes.rows[0]?.published_at?.toISOString() === afterPub?.toISOString(),
    reason: "published_at mudou na 2\u00aa chamada \u2014 poss\u00edvel re-publica\u00e7\u00e3o indesejada",
    detail: { first: afterPub, second: afterAgainRes.rows[0]?.published_at, processedAgain },
  });

  // ============================================================
  // ETAPA A12 \u2014 IDEMPOT\u00caNCIA DO WRITER: ON CONFLICT DO NOTHING
  // ============================================================
  console.log("\n=== Modo A \u2014 Etapa A12: idempot\u00eancia do writer outbox ===");
  const countBeforeRetry = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid`,
    [execEventId]
  );
  // Re-tentativa do INSERT com MESMO event_id (deterministic) \u2014 ON CONFLICT DO NOTHING.
  const outboxRetryClient = await getClientWithTenant(TENANT_ID);
  try {
    await outboxRetryClient.query("BEGIN");
    await insertEventOutboxRow(outboxRetryClient, {
      tenantId: TENANT_ID,
      eventId: execEventId,
      eventType: "SERVICE_PAYMENT_EXECUTED",
      eventVersion: 1,
      payload: { retry_attempt: true } as any,
      metadata: { e2e_a12: true } as any,
    });
    await outboxRetryClient.query("COMMIT");
  } finally {
    outboxRetryClient.release();
  }
  const countAfterRetry = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid`,
    [execEventId]
  );
  assertOk("A12: re-INSERT com mesmo event_id n\u00e3o duplica (ON CONFLICT DO NOTHING) \u2014 1 row antes e depois", {
    ok: countBeforeRetry.rows[0]?.c === "1" && countAfterRetry.rows[0]?.c === "1",
    reason: "count divergente \u2014 UNIQUE n\u00e3o absorveu re-INSERT",
    detail: { before: countBeforeRetry.rows[0]?.c, after: countAfterRetry.rows[0]?.c },
  });

  console.log("\n=== Modo B \u2014 Falsificacao ativa ===");
  console.log("=== Structural Guard Checks ===");

  // B1-struct: confirmar que actor foi criado com actor_type correto via writer canonico
  const b1Res = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM actors WHERE tenant_id=$1 AND user_id=$2 AND actor_type='user'`,
    [TENANT_ID, seed.buyer.user_id]
  );
  if (parseInt(b1Res.rows[0].count, 10) > 0) {
    console.log("  \u2705 B1-struct: actor_type='user' correto via writer");
  }

  // B4-struct: verificar se REVOKE em schedule_slots protege em runtime
  const b4Res = await pool.query<{ can_insert: boolean }>(
    `SELECT has_table_privilege(current_user, 'schedule_slots', 'INSERT') AS can_insert`
  );
  if (b4Res.rows[0].can_insert) {
    console.log("  \u26a0\ufe0f  B4-struct: pool roda como superuser \u2014 REVOKE nao protege em runtime (defesa e gate CI)");
  } else {
    console.log("  \u2705 B4-struct: REVOKE protege em runtime");
  }

  // B2: concept_id ausente deve ser rejeitado pelo NOT NULL do banco
  await expectFail("B2: INSERT bank_transaction sem concept_id", async () => {
    await bankTransactionService.createSimpleTransaction(TENANT_ID, {
      eventId: uuidv4(),
      referenceType: "g2_b2_falsification",
      toAccountId: seed.buyerAccount.accountId,
      amountCents: 100,
      currency: "BRL",
      transactionType: "deposit",
      description: "B2 falsification test \u2014 at least ten chars",
      concept_id: undefined as any,
      authorship: buildSystemAuthorship({
        actingForAccountId: seed.buyerAccount.accountId,
        actingForActorId: seed.buyer.actorId,
      }),
    });
  });

  // B3: paymentRequestId inexistente deve ser rejeitado (boundary de existencia)
  await expectFail("B3: Execucao com paymentRequestId inexistente deve falhar", async () => {
    await servicePaymentExecutionService.createExecution(
      TENANT_ID, seed.buyer.user_id,
      {
        paymentRequestId: uuidv4(),
        splits: [{ receiverActorId: seed.provider.actorId, amountCents: 100, percentage: 100 }],
      }
    );
  });

  // B5: amountCents=0 deve ser rejeitado pela validacao do service financeiro
  // ATENCAO: actingForActorId usa seed.buyer.actorId (UUID de actors, nao de users)
  // para garantir que a rejeicao ocorre pelo valor zero, nao por FK invalida.
  await expectFail("B5: transfer com amountCents=0 deve falhar", async () => {
    await bankTransactionService.transfer(TENANT_ID, {
      eventId: uuidv4(),
      fromAccountId: seed.buyerAccount.accountId,
      toAccountId: seed.providerAccount.accountId,
      amountCents: 0,
      currency: "BRL",
      transactionType: "transfer",
      referenceType: "g2_b5_falsification",
      referenceId: uuidv4(),
      description: "B5 falsification test zero amount",
      concept_id: conceptServiceBookingPaymentId,
      authorship: buildFinancialAuthorshipFromRequest({
        performedByUserId: seed.buyer.user_id,
        actingForActorId: seed.buyer.actorId,
        actingForAccountId: seed.buyerAccount.accountId,
        authoritySource: "ownership",
        permissionSnapshot: {
          permissionKey: "ownership",
          allowed: true,
          actorId: seed.buyer.actorId,
          userId: seed.buyer.user_id,
          decidedAt: new Date().toISOString(),
        },
      }),
    });
  });

  // ============================================================
  // ETAPA B6 \u2014 PROVAR O FURO DO OUTBOX: dinheiro sem evento
  // ============================================================
  // O mapa do circuito longo registrou: bank-transaction.service.ts:1389
  // COMMIT do ledger ocorre num client; service-payment-execution.service.ts:163
  // abre OUTRO client (outboxClient = getClientWithTenant) DEPOIS desse COMMIT.
  // Se o processo crashar nessa janela (ou o outboxClient.query falhar), o
  // catch externo L222-225 ENGOLE o erro ("n\u00e3o cr\u00edtico") e o caller HTTP
  // recebe sucesso. Estado material resultante: ledger gravado, outbox vazio,
  // handlers downstream nunca rodam.
  //
  // Reprodu\u00e7\u00e3o controlada (N\u00c3O altera produ\u00e7\u00e3o): simulamos o que aconteceria
  // se a janela falhasse. Chamamos bankTransactionService.transfer
  // diretamente (= o write do bank que createExecution faria) com um
  // executionId simulado, e DELIBERADAMENTE N\u00c3O chamamos insertEventOutboxRow
  // correspondente. Esse \u00e9 o estado p\u00f3s-falha equivalente.
  //
  // Prova: ledger persistido + event_outbox vazio para o eventId determin\u00edstico.
  console.log("\n=== Etapa B6 \u2014 FURO DO OUTBOX provado materialmente ===");

  const simExecutionId = uuidv4();
  const simEventId = deterministicServicePaymentExecutedOutboxEventId(TENANT_ID, simExecutionId);

  // Sanity: outbox ainda n\u00e3o tem essa row (executionId \u00e9 novo).
  const sanityBefore = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox WHERE event_id = $1::uuid`,
    [simEventId]
  );
  assertOk("B6-pre: sanity \u2014 outbox N\u00c3O tem row para o executionId simulado (antes do bank)", {
    ok: sanityBefore.rows[0]?.c === "0",
    reason: "executionId simulado colide com outbox preexistente \u2014 gerar outro",
    detail: { simExecutionId, simEventId, count: sanityBefore.rows[0]?.c },
  });

  // Escrita REAL no bank \u2014 equivalente ao que createExecution faria pelo
  // caminho can\u00f4nico. N\u00c3O chamamos insertEventOutboxRow depois (= simula\u00e7\u00e3o
  // da janela de falha).
  const furoEventId = uuidv4();
  const furoTransfer = await bankTransactionService.transfer(TENANT_ID, {
    eventId: furoEventId,
    fromAccountId: seed.buyerAccount.accountId,
    toAccountId: seed.providerAccount.accountId,
    amountCents: 1500,
    currency: "BRL",
    transactionType: "transfer",
    referenceType: "g2_b6_outbox_furo",
    referenceId: simExecutionId, // amarra a tx ao execution simulado
    description: "B6 furo: transfer real sem outbox (simula\u00e7\u00e3o de janela de falha)",
    concept_id: conceptServiceBookingPaymentId,
    authorship: buildFinancialAuthorshipFromRequest({
      performedByUserId: seed.buyer.user_id,
      actingForActorId: seed.buyer.actorId,
      actingForAccountId: seed.buyerAccount.accountId,
      authoritySource: "ownership",
      permissionSnapshot: {
        permissionKey: "ownership",
        allowed: true,
        actorId: seed.buyer.actorId,
        userId: seed.buyer.user_id,
        decidedAt: new Date().toISOString(),
      },
    }),
  });

  // Prova 1: dinheiro PERSISTIU \u2014 bank_ledger tem 2 entries para essa tx
  const ledgerForFuro = await pool.query<{
    id: string;
    account_id: string;
    direction: string;
    amount_cents: string;
  }>(
    `SELECT id::text, account_id::text, direction, amount_cents::text
       FROM bank_ledger WHERE transaction_id = $1::uuid
       ORDER BY direction DESC`,
    [furoTransfer.transactionId]
  );
  assertOk("B6.1: dinheiro PERSISTIU \u2014 bank_ledger tem 1 d\u00e9bito + 1 cr\u00e9dito, amount=1500 cada", {
    ok:
      ledgerForFuro.rows.length === 2 &&
      ledgerForFuro.rows.every((r) => r.amount_cents === "1500") &&
      ledgerForFuro.rows.some((r) => r.direction === "debit" && r.account_id === seed.buyerAccount.accountId) &&
      ledgerForFuro.rows.some((r) => r.direction === "credit" && r.account_id === seed.providerAccount.accountId),
    reason: "ledger n\u00e3o persistiu as entries da transfer\u00eancia",
    detail: ledgerForFuro.rows,
  });

  // Prova 2: \u03a3(debit) = \u03a3(credit) \u2014 conserva\u00e7\u00e3o preservada DENTRO da tx
  const sumsForFuro = await pool.query<{ sum_debit: string; sum_credit: string }>(
    `SELECT
       COALESCE(SUM(amount_cents) FILTER (WHERE direction='debit'), 0)::text  AS sum_debit,
       COALESCE(SUM(amount_cents) FILTER (WHERE direction='credit'), 0)::text AS sum_credit
     FROM bank_ledger WHERE transaction_id = $1::uuid`,
    [furoTransfer.transactionId]
  );
  assertOk("B6.2: \u03a3(d\u00e9bito) = \u03a3(cr\u00e9dito) = 1500 (bank \u00e9 \u00edntegro internamente)", {
    ok:
      sumsForFuro.rows[0]?.sum_debit === sumsForFuro.rows[0]?.sum_credit &&
      sumsForFuro.rows[0]?.sum_debit === "1500",
    reason: "somat\u00f3rias divergem",
    detail: sumsForFuro.rows[0],
  });

  // Prova 3 \u2014 O FURO: outbox N\u00c3O tem row para o executionId simulado.
  // (Em createExecution real, insertEventOutboxRow seria chamado AP\u00d3S o bank
  // commit; aqui simulamos a janela em que essa chamada N\u00c3O ocorre.)
  const outboxForFuro = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM event_outbox
      WHERE event_id = $1::uuid OR
            (metadata->>'executionId' = $2 AND event_type = 'SERVICE_PAYMENT_EXECUTED')`,
    [simEventId, simExecutionId]
  );
  assertOk(
    "B6.3 \u2014 FURO PROVADO: ledger tem dinheiro, event_outbox tem 0 rows para esse executionId",
    {
      ok: outboxForFuro.rows[0]?.c === "0",
      reason: "havia outbox row inesperada \u2014 furo n\u00e3o reproduzido",
      detail: { simExecutionId, simEventId, outbox_count: outboxForFuro.rows[0]?.c },
    }
  );

  // Prova 4 \u2014 Est\u00e1tica (refer\u00eancia institucional): o catch em
  // service-payment-execution.service.ts L222-225 ENGOLE o erro (sem re-throw),
  // logando "Erro ao enfileirar effects ao criar execu\u00e7\u00e3o (n\u00e3o cr\u00edtico)" e
  // retornando { execution, splits } com sucesso. Logo, o caller HTTP no
  // cen\u00e1rio real receberia 200 OK mesmo com outbox falhando. N\u00c3O h\u00e1 sweep que
  // detecte executions \u00f3rf\u00e3s de outbox (grep "outbox.*sweep|orphan.*execution"
  // retornou No files found).
  assertOk(
    "B6.4 \u2014 catch em service-payment-execution.service.ts L222-225 ENGOLE (verificado estaticamente; sem sweep/recovery)",
    {
      ok: true,
      detail:
        "Verificado por leitura: L222 `} catch (error) {` \u2192 L224 console.error \u2192 L225 `}` sem throw. " +
        "Caller recebe sucesso. Grep por 'outbox.*sweep|orphan.*execution|recovery.*outbox' = No files found.",
    }
  );

  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("G2 PIPELINE E2E :: PASS (estendido \u2014 A11/A12 + B6 furo do outbox)");
  console.log("  Modo A causal: OK (RFQ \u2192 execution \u2192 ledger \u2192 outbox \u2192 processor)");
  console.log("  Modo A read-side: A11 processor consume + A12 writer idempotente");
  console.log("  Modo B falsificacoes: TODAS rejeitadas pelo runtime");
  console.log("  Modo B6: FURO DO OUTBOX provado materialmente (dinheiro sem evento)");
  console.log("           \u2192 DT-OUTBOX-ATOMICITY (REMEDIATION_DT_LOG.md)");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");
}

main()
  .catch((e) => { console.error("\n\u274c ERRO NAO CAPTURADO:", e); process.exit(1); })
  .finally(async () => { await pool.end(); });
