/**
 * E2E F-MONEY-LIVE-AUTHORSHIP-GATE-F3_1 (DECISION-0113 fatia 3/6 — money LIVE)
 *
 * Gateia as 3 ÚNICAS rotas money vivas (mapa F-MONEY-LIVE-AUTHORSHIP-MAP; resto = Proxy dead):
 *   1. POST /events/:id/settlement/settle → autoridade = representar o ORGANIZER (`events.actor_id`).
 *   2. POST /payment-methods → `canRepresentActor(req.user, input.actorId)` antes do insert + unsetDefault.
 *   3. POST /unifycard/methods → tenant-admin (`requireRole(['admin'])`, bindado na fatia 1).
 *
 * Gates vivem nas ROTAS → prova (A) decisão behavioral dos gates (canRepresentActor) + (B) wiring
 * estrutural (gate ANTES da mutação + autoria server-side, não `actionContext.actorId` cru) +
 * (C) non-touch (zero bank_*; Proxies latentes seguem dead).
 *
 * Casos:
 *   A1 payment-method: canRepresentActor(dono) → true · A2 (estranho) → false.
 *   A3 event-organizer: canRepresentActor(dono-empresa, page-actor) → true · A4 (estranho) → false.
 *   B1 event-settlement: resolve `events.actor_id` + canRepresentActor ANTES de settleEvent;
 *      autoria = (organizerActorId, userId), não (actorId, actorId).
 *   B2 payment-method: canRepresentActor(input.actorId) ANTES de createMethod; autoria (ownerActorId, userId).
 *   B3 unifycard-method: preHandler requireRole(['admin']).
 *   C1 as 3 rotas não referenciam bank_*. C2 Proxies latentes seguem "migrated to Bank".
 *
 * Base: tenant DEV. LIMPO ao fim. Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-money-live-authorship-f3-1.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';
import { authorizationService } from '../core/authorization/authorization.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ff';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

function validCnpj(): string {
  const n: number[] = [];
  for (let i = 0; i < 12; i++) n.push(Math.floor(Math.random() * 10));
  const dv = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(n);
  const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

function gateBeforeService(src: string, routeAnchor: string, gateToken: string, serviceToken: string): boolean {
  const a = src.indexOf(routeAnchor);
  if (a < 0) return false;
  const g = src.indexOf(gateToken, a);
  const s = src.indexOf(serviceToken, a);
  return g > a && s > g;
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ id: string; global_user_id: string }>(
    `SELECT id::text AS id, global_user_id::text AS global_user_id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devGlobalUserId = dev.rows[0].global_user_id;
  const devActor = await pool.query<{ actor_id: string }>(
    `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2::uuid AND actor_type = 'user' LIMIT 1`,
    [TENANT_ID, devUserId]
  );
  const devUserActorId = devActor.rows[0]?.actor_id;

  const createdCompanyIds: string[] = [];

  try {
    console.log('\n— A (decisão dos gates) —');
    // payment-method owner gate
    const a1 = devUserActorId ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, devUserActorId) : false;
    record('A1 payment-method: canRepresentActor(dono) → true', a1 === true, `got=${a1}`);
    const a2 = devUserActorId ? await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devUserActorId) : true;
    record('A2 payment-method: canRepresentActor(estranho) → false', a2 === false, `got=${a2}`);

    // event-organizer gate (page-actor de empresa = organizer institucional)
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: 'E2E F31 Org', role: 'owner' as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    createdCompanyIds.push(c.company.companyId);
    const orgActor = (await pool.query<{ actor_id: string }>(
      `SELECT actor_id FROM actors WHERE tenant_id = $1 AND company_id = $2::uuid LIMIT 1`, [TENANT_ID, c.company.companyId]
    )).rows[0]?.actor_id;
    const a3 = orgActor ? await authorizationService.canRepresentActor(TENANT_ID, devUserId, orgActor) : false;
    record('A3 event-organizer: canRepresentActor(dono-empresa, page-actor) → true', a3 === true, `got=${a3}`);
    const a4 = orgActor ? await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, orgActor) : true;
    record('A4 event-organizer: canRepresentActor(estranho) → false', a4 === false, `got=${a4}`);

    console.log('\n— B (wiring estrutural: gate ANTES da mutação + autoria server-side) —');
    const ev = readFileSync(join(process.cwd(), 'src/modules/marketplace/event-settlement.routes.ts'), 'utf8');
    record('B1a event-settlement: resolve events.actor_id + canRepresentActor ANTES de settleEvent',
      gateBeforeService(ev, "'/events/:id/settlement/settle'", 'canRepresentActor(tenantId, userId, organizerActorId)', 'eventSettlementService.settleEvent')
      && /FROM events WHERE id = \$1 AND tenant_id = \$2/.test(ev));
    record('B1b event-settlement: autoria = (organizerActorId, userId), não actorId cru',
      /settleEvent\(\s*tenantId,\s*settlement\.id,\s*\{[\s\S]*?\},\s*organizerActorId,\s*userId\s*\)/.test(ev));

    const pm = readFileSync(join(process.cwd(), 'src/modules/marketplace/payment-method.routes.ts'), 'utf8');
    record('B2a payment-method: canRepresentActor(ownerActorId) ANTES de createMethod',
      gateBeforeService(pm, "'/payment-methods'", 'canRepresentActor(tenantId, userId, ownerActorId)', 'paymentMethodService.createMethod'));
    record('B2b payment-method: autoria = (ownerActorId, userId), não actionContext.actorId',
      /createMethod\(\s*tenantId,\s*req\.body,\s*ownerActorId,\s*userId\s*\)/.test(pm));

    const uc = readFileSync(join(process.cwd(), 'src/modules/marketplace/unifycard-method.routes.ts'), 'utf8');
    record('B3 unifycard-method: preHandler requireRole([\'admin\']) no POST',
      /'\/unifycard\/methods',\s*\{\s*preHandler:\s*\[fastify\.requireRole\(\['admin'\]\)\]\s*\}/.test(uc));

    console.log('\n— C (non-touch) —');
    const banktouch = [ev, pm, uc].some((s) => /bank_ledger|bank_transactions|bank_accounts|bank_splits/.test(s));
    record('C1 as 3 rotas NÃO referenciam bank_*', banktouch === false);
    const proxies = ['unifycard.service', 'settlement.service', 'accounts-payable.service', 'accounts-receivable.service', 'payment-split.service', 'payout.service']
      .map((f) => readFileSync(join(process.cwd(), `src/modules/marketplace/${f}.ts`), 'utf8'))
      .every((s) => /migrated to Bank/.test(s));
    record('C2 Proxies latentes seguem dead ("migrated to Bank")', proxies === true);
  } finally {
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      await pool.query(`DELETE FROM actor_delegations WHERE tenant_id = $1 AND institutional_actor_id IN (SELECT actor_id FROM actors WHERE company_id = ANY($2::uuid[]))`, [TENANT_ID, ids]);
      await pool.query(`DELETE FROM actor_registry WHERE tenant_id = $1 AND actor_id IN (SELECT actor_id FROM actors WHERE company_id = ANY($2::uuid[]))`, [TENANT_ID, ids]);
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await deleteCompaniesAndFiscal(pool, "company_id = ANY($1::uuid[])", [ids]);
    }
    const left = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM companies WHERE company_name LIKE 'E2E F31 %'`
    );
    record('CLEANUP DEV intacto (companies de teste = 0)', left.rows[0].n === '0', `restantes=${left.rows[0].n}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Money LIVE authorship gate (F3.1, 3 rotas vivas) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
