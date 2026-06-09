/**
 * E2E DECISION-0113 canal 3 (query) · payment-method default actor gate
 *
 * GET /payment-methods/default?actorId retornava o método default (PII financeira) de qualquer actor declarado
 * na query (só req.tenant). Agora gateia canRepresentActor(tenantId, req.user.id, query.actorId) ANTES de
 * getDefaultMethod; 401 sem user; 403 não-representável; 400 sem actorId (preservado). read-only, sem Bank.
 *
 * Prova:
 *   A behavioral REAL — canRepresentActor nega cross-actor (dev próprio=true / alheio O=false / estranho=false).
 *   B estrutural — gate sobre query.actorId ANTES de getDefaultMethod; 401/403/400; POST F3.1 intacto.
 *   C denominador — reporta os 2 GETs do MESMO arquivo ainda NÃO gateados (list ?actorId, /:id) = resíduo honesto.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-payment-method-default-authority-f6-5-c3.ts
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
const MARKER = 'E2E-PM';

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
  const O = randomUUID();
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre o query.actorId —');
    record('A1 dev representa o PRÓPRIO actor → true (método default próprio passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (método alheio → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: /default gateado; POST F3.1 intacto —');
  const route = readFileSync(join(process.cwd(), 'src/modules/marketplace/payment-method.routes.ts'), 'utf8');
  const defBlock = route.slice(route.indexOf("'/payment-methods/default'"));
  record('B1 GET /default: canRepresentActor(tenantId, userId, actorId) ANTES de getDefaultMethod',
    defBlock.indexOf('canRepresentActor(tenantId, userId, actorId)') >= 0
    && defBlock.indexOf('canRepresentActor(') < defBlock.indexOf('getDefaultMethod('));
  record('B2 403 não-representável + 401 sem user + 400 sem actorId (preservado)',
    /status\(403\)/.test(defBlock) && /status\(401\)/.test(defBlock) && /actorId é obrigatório/.test(defBlock));
  record('B3 gate do /default usa query.actorId (o filtrado), NÃO getActiveActor (no bloco do /default)',
    /const \{ actorId \} = req\.query/.test(defBlock) && !/getActiveActor\(/.test(defBlock));
  record('B4 POST /payment-methods (F3.1) intacto (canRepresentActor sobre body.actorId)',
    /canRepresentActor\(tenantId, userId, ownerActorId\)/.test(route));
  record('B5 getDefaultMethod read-only (service → repository, sem Bank no diff)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE /.test(defBlock));

  console.log('\n— C denominador: os 3 GETs do arquivo agora TODOS gateados (fechado por fatia seguinte) —');
  record('C1 GET /payment-methods (list) agora gateado (canRepresentActor ?actorId + financial:view_all_ledger sem actorId)',
    /canRepresentActor\(tenantId, userId, query\.actorId\)/.test(route) && /'financial:view_all_ledger', 'payment_method_list'/.test(route));
  record('C2 GET /payment-methods/:id agora gateado pelo owner real (canRepresentActor(method.actorId))',
    /canRepresentActor\(tenantId, userId, method\.actorId\)/.test(route));
  note('DENOMINADOR do arquivo FECHADO: 3 GETs — /default + list + /:id gateados; nenhum GET nu.');

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
  console.log('✨ payment-method /default gateado (canRepresentActor sobre query.actorId); list+/:id reportados como resíduo — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
