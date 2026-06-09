/**
 * E2E DECISION-0113 canal-4 (params :actorId) · marketplace actor-target reads
 *
 * `marketplace_manage_catalog` → `can_manage_marketplace`, que é DEFAULT de TODA company (actor-registry
 * getDefaultCapabilities). Logo `requirePermission('marketplace_manage_catalog')` passa para qualquer company
 * → `:actorId` em `/economic-identities/:actorId` e `/trust-events/:actorId` deixava company A ler a identidade
 * econômica / os trust events da company B (A vivo DB-backed, FAIL transversal da Yala sobre a classificação).
 * Agora exigem canRepresentActor(tenantId, req.user.userId, params.actorId) ANTES do service; 401/403 fail-closed.
 * zero Bank (identidade econômica + trust events + reputation, não bank_*). Tabelas: economic_identities / trust_events.
 *
 * Cobertura atual (4 rotas marketplace actor-target gateadas pela MESMA régua):
 *   - GET  /economic-identities/:actorId            (read, DB-backed)   ← selado ebd029d9
 *   - GET  /trust-events/:actorId                   (read, DB-backed)   ← selado ebd029d9
 *   - POST /economic-identities/:actorId/recalculate (A-WRITE, DB-backed) ← esta fatia
 *   - GET  /reputation-snapshots/:actorId           (read, Map in-memory) ← esta fatia (gate defensivo: vaza snapshot efêmero de B no mesmo processo)
 *
 * Fora desta fatia (declarado, intocado):
 *   - GET /b2b-contracts/actor/:actorId  = E (stub `return []`, b2b_contracts AUSENTE, materialidade futura)
 *   - GET /inventory/movements SEM actorId = B (broad read tenant-wide itemizado, DT própria)
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide (próprio=true / alheio=false / estranho=false).
 *   B estrutural — economic-identities e trust-events gateiam params.actorId ANTES do service; 401/403;
 *     requirePermission preservado; can_manage_marketplace não tratado como autoridade; sem ensureUserActor/
 *     getActiveActor; sem Bank; zero writes adicionados; rotas E/B fora do patch.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-marketplace-actor-target-authority-f6-5-c3.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const STRANGER_USER_ID = '00000000-0000-4000-8000-0000000000ee';
const MARKER = 'E2E-MKT-ACTOR-TARGET';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

async function main(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const dev = await pool.query<{ id: string }>(`SELECT id::text AS id FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1`, [DEV_EMAIL, TENANT_ID]);
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;
  const devActorRow = await pool.query<{ id: string }>(`SELECT id::text AS id FROM actors WHERE tenant_id=$1 AND user_id=$2::uuid AND actor_type='user' LIMIT 1`, [TENANT_ID, devUserId]);
  const devActor = devActorRow.rows[0]?.id;
  if (!devActor) { console.error('❌ user-actor do dev não encontrado.'); process.exit(1); }

  await pool.query(`DELETE FROM actors WHERE tenant_id=$1 AND display_name LIKE $2`, [TENANT_ID, `${MARKER}-%`]);
  const O = randomUUID(); // company B (page) — dev NÃO representa, mas can_manage_marketplace seria default dela
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`, [O, TENANT_ID, `${MARKER}-companyB`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o params.actorId (alvo do drill-down) —');
    record('A1 dev representa o PRÓPRIO actor → true (economic-identity/trust-events próprios alcançam o service)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev (company A) NÃO representa o actor O (company B) → false (ler economic-identity/trust de B → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    note('FAIL transversal da Yala: marketplace_manage_catalog → can_manage_marketplace é DEFAULT de company → o gate de capability passa p/ qualquer company; sem canRepresentActor, A lia identidade/trust de B.');
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: economic-identities (GET+recalculate) e trust-events gateiam params.actorId ANTES do service —');
  const route = readFileSync(join(process.cwd(), 'src/modules/marketplace/routes/marketplace-identity.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  // economic-identities GET: do registro da rota GET até o início do bloco /recalculate
  const econGet = sliceBetween("'/economic-identities/:actorId',", "'/economic-identities/:actorId/recalculate'");
  // economic-identities recalculate (A-write): do registro /recalculate até /trust-events
  const recalc = sliceBetween("'/economic-identities/:actorId/recalculate'", "'/trust-events/:actorId',");
  // trust-events GET: do registro da rota até o fim do arquivo
  const trust = sliceBetween("'/trust-events/:actorId',", "");

  // reputation-snapshots (read in-memory): outro arquivo
  const slaRoute = readFileSync(join(process.cwd(), 'src/modules/marketplace/routes/marketplace-sla.routes.ts'), 'utf8');
  const slaSlice = (a: string, b: string) => { const i = slaRoute.indexOf(a); const j = b ? slaRoute.indexOf(b, i + 1) : slaRoute.length; return i >= 0 ? slaRoute.slice(i, j > i ? j : slaRoute.length) : ''; };
  const reput = slaSlice("'/reputation-snapshots/:actorId',", "// POST /marketplace/payment-plan/:paymentPlanId/apply-sla-penalties");

  record('B0 import authorizationService presente',
    /from '@core\/authorization\/authorization\.service'/.test(route));
  record('B1 economic-identities: canRepresentActor(tenantId, userId, actorId) ANTES de getEconomicIdentity; 401/403',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(econGet)
    && econGet.indexOf('canRepresentActor(') < econGet.indexOf('getEconomicIdentity(')
    && /status\(401\)/.test(econGet) && /status\(403\)/.test(econGet)
    && /MARKETPLACE_ACTOR_NOT_REPRESENTABLE/.test(econGet));
  record('B2 trust-events: canRepresentActor(tenantId, userId, actorId) ANTES de listTrustEvents; 401/403',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(trust)
    && trust.indexOf('canRepresentActor(') < trust.indexOf('listTrustEvents(')
    && /status\(401\)/.test(trust) && /status\(403\)/.test(trust)
    && /MARKETPLACE_ACTOR_NOT_REPRESENTABLE/.test(trust));
  record('B2a recalculate (A-WRITE): canRepresentActor ANTES de recalculateTrustScore; 401/403',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(recalc)
    && recalc.indexOf('canRepresentActor(') < recalc.indexOf('recalculateTrustScore(')
    && /status\(401\)/.test(recalc) && /status\(403\)/.test(recalc)
    && /MARKETPLACE_ACTOR_NOT_REPRESENTABLE/.test(recalc));
  record('B2b reputation-snapshots: canRepresentActor ANTES de getReputationSnapshots; 401/403',
    /canRepresentActor\(tenantId, userId, actorId\)/.test(reput)
    && reput.indexOf('canRepresentActor(') < reput.indexOf('getReputationSnapshots(')
    && /status\(401\)/.test(reput) && /status\(403\)/.test(reput)
    && /MARKETPLACE_ACTOR_NOT_REPRESENTABLE/.test(reput)
    && /from '@core\/authorization\/authorization\.service'/.test(slaRoute));
  record('B3 params.actorId não chega cru ao service sem gate (gate precede o service nos 4 handlers)',
    econGet.indexOf('canRepresentActor(') >= 0 && econGet.indexOf('canRepresentActor(') < econGet.indexOf('getEconomicIdentity(')
    && trust.indexOf('canRepresentActor(') >= 0 && trust.indexOf('canRepresentActor(') < trust.indexOf('listTrustEvents(')
    && recalc.indexOf('canRepresentActor(') >= 0 && recalc.indexOf('canRepresentActor(') < recalc.indexOf('recalculateTrustScore(')
    && reput.indexOf('canRepresentActor(') >= 0 && reput.indexOf('canRepresentActor(') < reput.indexOf('getReputationSnapshots('));
  record('B4 requirePermission(marketplace_manage_catalog) preservado nas 4 rotas alvo',
    (route.match(/requirePermission\('marketplace_manage_catalog'\)/g) || []).length >= 3
    && /requirePermission\('marketplace_manage_catalog'\)/.test(econGet)
    && /requirePermission\('marketplace_manage_catalog'\)/.test(trust)
    && /requirePermission\('marketplace_manage_catalog'\)/.test(recalc)
    && /requirePermission\('marketplace_manage_catalog'\)/.test(reput));
  record('B5 can_manage_marketplace NÃO tratado como autoridade sobre o actor alvo (capability não é o gate do actorId)',
    !/can_manage_marketplace/.test(econGet.replace(/\/\/[^\n]*/g, '')) // só em comentário, não em lógica
    && /canRepresentActor\(/.test(econGet) && /canRepresentActor\(/.test(trust));
  record('B6 NÃO usa ensureUserActor/getActiveActor como authority shortcut (identity + sla)',
    !/ensureUserActor\(/.test(route) && !/getActiveActor\(/.test(route)
    && !/ensureUserActor\(/.test(reput) && !/getActiveActor\(/.test(reput));
  record('B7 zero Bank nos handlers tocados (identidade/trust/reputation, não bank_*)',
    !/bank_ledger|bank_transactions|bank_accounts/.test(route)
    && !/bank_ledger|bank_transactions|bank_accounts/.test(reput));
  record('B8 zero writes ADICIONADOS pelo patch (identity: POSTs pré-existentes create+recalculate; reputation é GET)',
    (route.match(/fastify\.(post|put|patch|delete)/g) || []).length === 2
    && !/fastify\.(post|put|patch|delete)/.test(reput));
  record('B9 b2b-contracts e inventory/movements SEM actorId permanecem fora do patch (não tocados aqui)',
    !/b2b-contracts/.test(route) && !/inventory\/movements/.test(route)
    && !/b2b-contracts/.test(reput) && !/inventory\/movements/.test(reput));

  note('Denominador marketplace actor-target: A corrigidas NESTA fatia = 1 write (recalculate) + 1 read in-memory (reputation-snapshots). '
    + 'A já corrigidas antes = inventory ×2 (by-actor saldo, movements?actorId) e identity reads ×2 (economic-identities GET, trust-events). '
    + 'E fora do patch = b2b-contracts/actor/:actorId (stub). B/G fora do patch = inventory/movements SEM actorId (broad read). M = 0.');

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
  console.log('✨ marketplace actor-target: economic-identities + trust-events gateados (canRepresentActor); E/B fora do patch preservados — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
