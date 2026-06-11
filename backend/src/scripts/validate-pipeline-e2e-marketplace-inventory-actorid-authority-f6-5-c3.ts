/**
 * E2E DECISION-0113 canal-3 (query) · marketplace-inventory actorId gates
 *
 * `can_manage_marketplace` é DEFAULT de TODA company (actor-registry getDefaultCapabilities) → o gate
 * `requirePermission('marketplace_manage_inventory')` passa para qualquer company. Logo `query.actorId` em
 * by-actor/movements deixava company A ler o estoque/extrato da company B (A vivo, FAIL da Yala sobre a
 * classificação F). Agora: by-actor (actorId obrigatório) e movements (quando actorId presente) exigem
 * canRepresentActor(tenantId, req.user.userId, query.actorId) ANTES do service; 401/403 fail-closed.
 * read-only, zero Bank (estoque físico: inventory_movements/balances). /inventory/balance (sem actorId) intocado.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor decide (próprio=true / alheio=false / estranho=false).
 *   B estrutural — by-actor e movements gateiam query.actorId ANTES de getCurrentBalanceByActor/getMovements;
 *     movements sem actorId preservado; balance intocado; can_manage_marketplace não tratado como autoridade;
 *     sem ensureUserActor/getActiveActor; sem Bank.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-marketplace-inventory-actorid-authority-f6-5-c3.ts
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
const MARKER = 'E2E-INV';

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
    console.log('\n— A behavioral REAL: canRepresentActor sobre o query.actorId (alvo do drill-down) —');
    record('A1 dev representa o PRÓPRIO actor → true (estoque/extrato próprio passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev (company A) NÃO representa o actor O (company B) → false (ler estoque de B → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    note('FAIL da Yala: can_manage_marketplace é DEFAULT de company (actor-registry getDefaultCapabilities) → o gate de capability passa p/ qualquer company; sem canRepresentActor, A lia o estoque de B.');
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: by-actor + movements gateiam query.actorId ANTES do service —');
  const route = readFileSync(join(process.cwd(), 'src/modules/marketplace/routes/marketplace-inventory.routes.ts'), 'utf8');
  const sliceBetween = (a: string, b: string) => { const i = route.indexOf(a); const j = b ? route.indexOf(b, i + 1) : route.length; return i >= 0 ? route.slice(i, j > i ? j : route.length) : ''; };
  const byActor = sliceBetween("Saldo operacional por actor", "Extrato de movimentações");
  const movements = sliceBetween("Extrato de movimentações", "Saldo CONSOLIDADO da empresa");
  const balanceBlock = sliceBetween("TOMBSTONE 501", "Saldo operacional por actor");

  record('B1 import authorizationService presente',
    /from '@core\/authorization\/authorization\.service'/.test(route));
  record('B2 by-actor: canRepresentActor(req.tenant.id, userId, actorId) ANTES de getCurrentBalanceByActor; 401/403',
    /canRepresentActor\(req\.tenant\.id, userId, actorId\)/.test(byActor)
    && byActor.indexOf('canRepresentActor(') < byActor.indexOf('getCurrentBalanceByActor(')
    && /status\(401\)/.test(byActor) && /INVENTORY_ACTOR_NOT_REPRESENTABLE/.test(byActor));
  // ATUALIZADO F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL: movements passou a EXIGIR
  // actorId (antes era opcional). canRepresentActor ANTES do service; ausência → 400.
  record('B3 movements: actorId OBRIGATÓRIO (400 INVENTORY_ACTOR_ID_REQUIRED) + canRepresentActor ANTES de getMovements; 401/403',
    /INVENTORY_ACTOR_ID_REQUIRED/.test(movements)
    && /canRepresentActor\(req\.tenant\.id, userId, actorId\)/.test(movements)
    && movements.indexOf('canRepresentActor(') < movements.indexOf('getMovements(')
    && /status\(401\)/.test(movements) && /INVENTORY_ACTOR_NOT_REPRESENTABLE/.test(movements));
  record('B4 movements SEM actorId REJEITADO (não mais tenant-wide): 400 antes de montar options',
    /if \(!actorId\?\.trim\(\)\) \{[\s\S]{0,200}INVENTORY_ACTOR_ID_REQUIRED/.test(movements)
    && movements.indexOf('INVENTORY_ACTOR_ID_REQUIRED') < movements.indexOf('getMovements('));
  record('B5 can_manage_marketplace NÃO tratado como autoridade sobre o actor alvo (requirePermission continua, mas canRepresentActor é o gate do actorId)',
    /requirePermission\('marketplace_manage_inventory'\)/.test(route) && /canRepresentActor\(/.test(route));
  record('B6 NÃO usa ensureUserActor/getActiveActor; sem Bank',
    !/ensureUserActor\(/.test(route) && !/getActiveActor\(/.test(route)
    && !/bank_ledger|bank_transactions|bank_accounts/.test(route));
  // ATUALIZADO: /inventory/balance (sem owner) deixou de ser INTOCADO — virou TOMBSTONE 501.
  record('B7 /inventory/balance = TOMBSTONE 501 (INVENTORY_TENANT_WIDE_BALANCE_DISABLED, sem getCurrentBalance/calculateBalance)',
    /INVENTORY_TENANT_WIDE_BALANCE_DISABLED/.test(balanceBlock)
    && /status\(501\)/.test(balanceBlock)
    && !/getCurrentBalance\(/.test(balanceBlock));
  record('B8 zero writes adicionados (só app.get no arquivo)',
    !/app\.(post|put|patch|delete)/.test(route));

  console.log('\n— C service: estoque físico read-only, sem Bank —');
  const svc = readFileSync(join(process.cwd(), 'src/modules/marketplace/inventory.service.ts'), 'utf8');
  record('C1 inventory.service sem Bank (inventory_movements/balances, não bank_*)',
    !/bank_ledger|bank_transactions|bank_accounts/.test(svc));
  note('Denominador (pós F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL): /inventory/balance tenant-wide = TOMBSTONE 501; /inventory/movements sem actorId = 400 (actorId obrigatório). Ambas as folhas fechadas. KNOWN_OPEN fora desta correção: products/visible, reconciliation metrics, reports/* (FASE 6 stub) — ver gate validate:inventory-reader-scope.');

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
  console.log('✨ marketplace-inventory: by-actor + movements?actorId gateados (canRepresentActor); broad read sem actorId preservado — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
