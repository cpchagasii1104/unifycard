/**
 * E2E — F-AUTHORITY-Z2-R8H-AP-AR-REACTIVATION-TRAP-CONTAINMENT (DECISION-0113 / Z2; DECISION-0114 D5).
 * NÃO MOVE DINHEIRO. NÃO toca DB. Prova a CONTENÇÃO fail-closed defensiva de AP/AR (Proxy/dead, migrados ao Bank).
 *
 * AP/AR migrados ao Bank (service = Proxy reject-all; tabelas accounts_payable/accounts_receivable schema-ghost).
 * As 12 rotas públicas retornam 403 ANTES de actionContext/service → spoof não altera nada; zero write possível
 * (a rota nem chama o service; e a tabela é ghost). bank_ledger/transactions/splis NUNCA tocados pelas rotas.
 *
 *   A POST /accounts-payable/from-purchase-order → 403 ACCOUNTS_PAYABLE_DISABLED
 *   B POST /accounts-payable/manual → 403 · C GET /accounts-payable → 403 · D GET /accounts-payable/:id → 403
 *   E POST /accounts-payable/:id/schedule → 403 · F .../mark-paid → 403 · G .../cancel → 403
 *   H POST /accounts-receivable/manual → 403 ACCOUNTS_RECEIVABLE_DISABLED
 *   I GET /accounts-receivable → 403 · J GET /accounts-receivable/:id → 403
 *   K .../mark-received → 403 · L .../cancel → 403
 *   M spoof actionContext (header arbitrário) → ainda 403 (contenção independe de ator)
 *   N guard anti-reactivation verde · O baseline canal-1 verde
 *
 * 🔒 SEM DB: as rotas contidas não importam pool/service — `fastify.inject` não conecta a banco algum.
 * Modo: npx tsx src/scripts/validate-pipeline-e2e-ap-ar-reactivation-trap.ts
 */
import 'tsconfig-paths/register';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();

async function main(): Promise<void> {
  const Fastify = (await import('fastify')).default;
  const { default: apRoutes } = await import('../modules/marketplace/accounts-payable.routes');
  const { default: arRoutes } = await import('../modules/marketplace/accounts-receivable.routes');
  const app = Fastify();
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: randomUUID() };
    r.user = { userId: randomUUID() };
    r.actionContext = { actorId: req.headers['x-test-actor-id'] ? String(req.headers['x-test-actor-id']) : randomUUID() };
  });
  await app.register(apRoutes);
  await app.register(arRoutes);
  await app.ready();

  const isAP = (r: { statusCode: number; body: string }): boolean => { if (r.statusCode !== 403) return false; try { return JSON.parse(r.body)?.code === 'ACCOUNTS_PAYABLE_DISABLED'; } catch { return false; } };
  const isAR = (r: { statusCode: number; body: string }): boolean => { if (r.statusCode !== 403) return false; try { return JSON.parse(r.body)?.code === 'ACCOUNTS_RECEIVABLE_DISABLED'; } catch { return false; } };
  const id = randomUUID();
  const json = { 'content-type': 'application/json' };
  const POST = (url: string, hdr: Record<string, string> = json) => app.inject({ method: 'POST', url, headers: hdr, payload: '{}' });
  const GET = (url: string) => app.inject({ method: 'GET', url });

  try {
    console.log('\n— Accounts Payable contido (403) —');
    record('A POST /accounts-payable/from-purchase-order → 403 ACCOUNTS_PAYABLE_DISABLED', isAP(await POST('/accounts-payable/from-purchase-order')));
    record('B POST /accounts-payable/manual → 403', isAP(await POST('/accounts-payable/manual')));
    record('C GET /accounts-payable → 403', isAP(await GET('/accounts-payable')));
    record('D GET /accounts-payable/:id → 403', isAP(await GET(`/accounts-payable/${id}`)));
    record('E POST /accounts-payable/:id/schedule → 403', isAP(await POST(`/accounts-payable/${id}/schedule`)));
    record('F POST /accounts-payable/:id/mark-paid → 403', isAP(await POST(`/accounts-payable/${id}/mark-paid`)));
    record('G POST /accounts-payable/:id/cancel → 403', isAP(await POST(`/accounts-payable/${id}/cancel`)));

    console.log('\n— Accounts Receivable contido (403) —');
    record('H POST /accounts-receivable/manual → 403 ACCOUNTS_RECEIVABLE_DISABLED', isAR(await POST('/accounts-receivable/manual')));
    record('I GET /accounts-receivable → 403', isAR(await GET('/accounts-receivable')));
    record('J GET /accounts-receivable/:id → 403', isAR(await GET(`/accounts-receivable/${id}`)));
    record('K POST /accounts-receivable/:id/mark-received → 403', isAR(await POST(`/accounts-receivable/${id}/mark-received`)));
    record('L POST /accounts-receivable/:id/cancel → 403', isAR(await POST(`/accounts-receivable/${id}/cancel`)));

    console.log('\n— Spoof + guards —');
    record('M spoof actionContext (x-test-actor-id arbitrário) → ainda 403', isAP(await POST('/accounts-payable/manual', { ...json, 'x-test-actor-id': randomUUID() })));
    let gTrap = 0; try { execSync('node scripts/audit-ap-ar-reactivation-trap.mjs', { cwd, encoding: 'utf8' }); } catch { gTrap = 1; }
    record('N guard ap-ar-reactivation-trap verde', gTrap === 0);
    let gB = 0; try { execSync('node scripts/audit-actor-authority-boundary.mjs', { cwd, encoding: 'utf8' }); } catch { gB = 1; }
    record('O baseline canal-1 verde (AP/AR removidos honestamente)', gB === 0);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ R8H: AP/AR 12 rotas contidas fail-closed (403); spoof não altera nada; zero service/DB/Bank; reactivation trap blindado.');
  process.exit(0);
}

main().catch((e) => { console.error('💥 Erro não tratado:', e); process.exit(1); });
