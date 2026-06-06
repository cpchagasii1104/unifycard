/**
 * E2E F-SERVICE-FINANCIAL-FIREWALL-CODE (DECISION-0110).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-service-financial-firewall-ephemeral.ps1.
 *
 * Prova: as rotas financeiras vivas de serviço ficam FAIL-CLOSED por DECISION-0110 (flag default OFF):
 *   POST /services/request/pay · POST /services/:serviceId/hire · POST /services/payments/:id/execute
 * → retornam 403 SERVICE_FINANCIAL_RUNTIME_DISABLED ANTES de qualquer lógica; nenhum dinheiro é movido
 * (bank_ledger/bank_transactions = 0). Com o flag ON, o firewall abre e a rota cai no PRÓXIMO guard
 * (auth/tenant), sem mover dinheiro — provando que o firewall é o portão, não apaga o código.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import servicePaymentExecutionRoutes from '../modules/services/service-payment-execution.routes';
import serviceHireRoutes from '../modules/services/service-hire.routes';
import servicesDiscoveryRoutes from '../modules/services/services-discovery.routes';
import {
  isServiceFinancialRuntimeEnabled,
  SERVICE_FINANCIAL_RUNTIME_FLAG,
} from '../modules/services/service-financial-firewall';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/firewall|financial|service|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

const count = async (sql: string): Promise<number> => Number((await pool.query(sql)).rows[0].n);

/** Monta um fastify mínimo espelhando services.module (discovery sem prefix; execution /payments; hire sem prefix). */
async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(servicesDiscoveryRoutes);
  await app.register(servicePaymentExecutionRoutes, { prefix: '/payments' });
  await app.register(serviceHireRoutes);
  await app.ready();
  return app;
}

const ROUTES = [
  { label: 'POST /request/pay', method: 'POST' as const, url: '/request/pay', payload: { requestId: '00000000-0000-0000-0000-000000000001' } },
  { label: 'POST /:serviceId/hire', method: 'POST' as const, url: '/svc-1/hire', payload: { availabilityId: '00000000-0000-0000-0000-000000000002', requesterActorId: '00000000-0000-0000-0000-000000000003', providerActorId: '00000000-0000-0000-0000-000000000004', amountCents: 1000 } },
  { label: 'POST /payments/:id/execute', method: 'POST' as const, url: '/payments/00000000-0000-0000-0000-000000000005/execute', payload: { paymentRequestId: '00000000-0000-0000-0000-000000000005' } },
];

async function main(): Promise<void> {
  await assertEphemeralDb();
  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  // ═══ flag OFF (default fail-closed) ═══
  delete process.env[SERVICE_FINANCIAL_RUNTIME_FLAG];
  record('0 flag default OFF → isServiceFinancialRuntimeEnabled() === false', isServiceFinancialRuntimeEnabled() === false);

  const appOff = await buildApp();
  for (const r of ROUTES) {
    const resp = await appOff.inject({ method: r.method, url: r.url, payload: r.payload });
    let body: any = {};
    try { body = JSON.parse(resp.body); } catch { /* noop */ }
    record(`${r.label} → 403 SERVICE_FINANCIAL_RUNTIME_DISABLED (fail-closed)`,
      resp.statusCode === 403 && body?.error === 'SERVICE_FINANCIAL_RUNTIME_DISABLED' && body?.decision === 'DECISION-0110',
      `status=${resp.statusCode} body=${resp.body.slice(0, 120)}`);
  }
  await appOff.close();

  // ═══ flag ON → firewall ABRE; rota cai no próximo guard (auth/tenant), sem dinheiro ═══
  process.env[SERVICE_FINANCIAL_RUNTIME_FLAG] = 'true';
  record('flag ON → isServiceFinancialRuntimeEnabled() === true', isServiceFinancialRuntimeEnabled() === true);
  const appOn = await buildApp();
  for (const r of ROUTES) {
    const resp = await appOn.inject({ method: r.method, url: r.url, payload: r.payload });
    let body: any = {};
    try { body = JSON.parse(resp.body); } catch { /* noop */ }
    // passou o firewall (não é mais o corpo disabled) e foi barrado pelo próximo guard (auth/tenant) — sem dinheiro
    record(`${r.label} (flag ON) → passa o firewall e cai no próximo guard (NÃO é mais SERVICE_FINANCIAL_RUNTIME_DISABLED)`,
      body?.error !== 'SERVICE_FINANCIAL_RUNTIME_DISABLED' && resp.statusCode >= 400,
      `status=${resp.statusCode} body=${resp.body.slice(0, 120)}`);
  }
  await appOn.close();
  // restaura OFF (não vaza o flag)
  delete process.env[SERVICE_FINANCIAL_RUNTIME_FLAG];
  record('restaura flag OFF', isServiceFinancialRuntimeEnabled() === false);

  // ═══ não-toque: nenhum dinheiro movido em nenhum caminho ═══
  record('Bank intocado (bank_ledger + bank_transactions inalterados, = 0)',
    (await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`)) === bankBefore && bankBefore === 0);
  record('zero service_orders / payment_intents / service_payment_executions',
    (await count(`SELECT ((SELECT count(*) FROM service_orders)+(SELECT count(*) FROM payment_intents)+(SELECT count(*) FROM service_payment_executions))::int AS n`)) === 0);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Firewall financeiro de serviço: rotas vivas fail-closed por DECISION-0110, zero dinheiro — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
