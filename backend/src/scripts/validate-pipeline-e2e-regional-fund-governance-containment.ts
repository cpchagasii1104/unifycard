/**
 * E2E — F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (achado colateral da
 * Fatia 9 passo 3, DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST). Roda SÓ em DB efêmera
 * (runner run-regional-fund-governance-containment-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova em runtime HTTP real (não só padrão estático) que os 7 endpoints da rota antes viva
 * agora respondem 501 CONTAINED honesto, sem nunca tocar regional_fund_proposals/votes
 * (que não existem no banco — provaria 42P01/500 se a contenção tivesse regredido):
 *   A-G · cada um dos 7 endpoints → 501 REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED;
 *   H · confirma que as tabelas realmente NÃO existem nesta DB (a contenção é a prova viva);
 *   I · Δbank=0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/governance|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'RFG Containment Tenant', slug: `rfg-${Date.now()}` });

  const governanceRoutes = (await import('../core/unifybank/regional-fund-governance.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: randomUUID() };
    req.tenant = { id: TENANT };
  });
  await app.register(governanceRoutes, { prefix: '/regional-fund' });
  await app.ready();

  const CODE = 'REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED';

  try {
    console.log('\n— regional fund governance containment END-TO-END (achado colateral Fatia 9 passo 3) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    const endpoints: Array<{ method: 'GET' | 'POST'; url: string; label: string }> = [
      { method: 'POST', url: '/regional-fund/proposals', label: 'A POST /proposals' },
      { method: 'GET', url: '/regional-fund/proposals', label: 'B GET /proposals' },
      { method: 'GET', url: `/regional-fund/proposals/${randomUUID()}`, label: 'C GET /proposals/:id' },
      { method: 'POST', url: `/regional-fund/proposals/${randomUUID()}/vote`, label: 'D POST /proposals/:id/vote' },
      { method: 'POST', url: `/regional-fund/proposals/${randomUUID()}/open`, label: 'E POST /proposals/:id/open' },
      { method: 'POST', url: `/regional-fund/proposals/${randomUUID()}/close`, label: 'F POST /proposals/:id/close' },
      { method: 'POST', url: `/regional-fund/proposals/${randomUUID()}/execute`, label: 'G POST /proposals/:id/execute' },
    ];

    for (const ep of endpoints) {
      const res = await app.inject({ method: ep.method, url: ep.url, payload: {} });
      const body = res.json() as any;
      record(`${ep.label} → 501 ${CODE}`, res.statusCode === 501 && body?.code === CODE,
        `status=${res.statusCode} code=${body?.code}`);
    }

    // H · confirma que as tabelas realmente não existem (a contenção é honesta, não decorativa)
    const schemaCheck = await pool.query<{ proposals: string | null; votes: string | null }>(
      `SELECT to_regclass('public.regional_fund_proposals') AS proposals, to_regclass('public.regional_fund_votes') AS votes`
    );
    record('H tabelas regional_fund_proposals/votes realmente ausentes nesta DB (contenção é honesta)',
      schemaCheck.rows[0].proposals === null && schemaCheck.rows[0].votes === null,
      `proposals=${schemaCheck.rows[0].proposals} votes=${schemaCheck.rows[0].votes}`);

    // I · Δbank=0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('I Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
