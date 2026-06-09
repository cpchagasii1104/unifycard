/**
 * E2E DECISION-0113 canal-5 (:id recurso privado) · invoice by-id IDOR
 *
 * GET /invoices/:invoiceId tinha `preHandler requireInvoicePermission` (prova só que o CALLER tem
 * financial:view_ledger no PRÓPRIO actor) e devolvia a invoice por id SEM validar as PARTES reais do
 * documento → IDOR: caller com view_ledger lia invoice alheia do tenant por id. Agora resolve a invoice e
 * exige representar emissor (`actorId`) OU destinatário (`recipientActorId`); admin cross-actor só com
 * financial:view_all_ledger comprovado (caller-actor resolvido READ-ONLY, sem criar actor). 401/403 fail-closed.
 * Read-only (getInvoiceById = findById SELECT), zero Bank. GET /invoices list + writes intocados.
 *
 * Prova:
 *   A behavioral REAL no PRIMITIVO — canRepresentActor decide a parte (próprio=true / alheio=false / estranho=false).
 *     party-lê-invoice-REAL = N/A: tabela `invoices` AUSENTE em DEV (scaffold não exercido) — reportado, não vendido.
 *   B estrutural — by-id resolve invoice ANTES e gateia sobre AS PARTES (actorId/recipientActorId), não params.id;
 *     401/403 + admin escape view_all_ledger read-only (sem ensureUserActor); list + writes intactos.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-invoice-by-id-authority-f6-5.ts
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
  const O = randomUUID();
  try {
    await pool.query(`INSERT INTO actors (id, tenant_id, actor_type, display_name, actor_id, responsible_actor_id) VALUES ($1,$2,'page',$3,$1,$4)`,
      [O, TENANT_ID, `${MARKER}-other`, devActor]);

    const { authorizationService } = await import('../core/authorization/authorization.service');
    console.log('\n— A behavioral REAL: canRepresentActor sobre as PARTES (emissor/destinatário) —');
    record('A1 dev representa o PRÓPRIO actor → true (invoice onde ele é emissor/destinatário passa)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, devActor)) === true);
    record('A2 dev NÃO representa o actor O → false (invoice de partes alheias → 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, devUserId, O)) === false);
    record('A3 estranho NÃO representa o actor do dev → false (→ 403)',
      (await authorizationService.canRepresentActor(TENANT_ID, STRANGER_USER_ID, devActor)) === false);
    // parte 'system:platform' não é representável por humano → exige view_all_ledger (admin escape).
    // canRepresentActor com valor não-uuid lança → no route está em try/catch (fail-closed = false); espelho aqui.
    let sysRep = false;
    try { sysRep = await authorizationService.canRepresentActor(TENANT_ID, devUserId, 'system:platform'); } catch { sysRep = false; }
    record('A4 parte system (\'system:platform\') NÃO é representável (false ou throw→fail-closed) → exige admin escape',
      sysRep === false);

    // 🔴 §8/DECISION-0069: o resolver do admin escape NÃO usa LIMIT 1 — conta os user-actors e só concede com EXATAMENTE 1.
    const resolverSql = `SELECT actor_id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'`;
    const devRows = await pool.query(resolverSql, [TENANT_ID, devUserId]);
    record('A5 dev tem EXATAMENTE 1 user-actor → ramo "rows.length === 1" avalia o escape (não arbitra)',
      devRows.rowCount === 1);
    const strangerRows = await pool.query(resolverSql, [TENANT_ID, STRANGER_USER_ID]);
    record('A6 estranho tem 0 user-actor → ramo "0" NÃO concede admin escape (fail-closed)',
      strangerRows.rowCount === 0);
    note('caso >1 user-actor (ambíguo) = N/A behavioral — semear 2º user-actor seria anomalia que o modelo resiste; coberto estruturalmente por B3c (>1 → sem escape).');

    const invReg = await pool.query<{ r: string | null }>(`SELECT to_regclass('public.invoices') AS r`);
    note(`party-lê-invoice-REAL = N/A — tabela 'invoices' ${invReg.rows[0].r ? 'PRESENTE' : 'AUSENTE'} em DEV (scaffold não exercido). Behavioral por-invoice não vendável; primitivo provado acima.`);
  } finally {
    await pool.query(`DELETE FROM actors WHERE id=$1`, [O]);
  }

  console.log('\n— B estrutural: by-id gateia as PARTES da invoice; list + writes intactos —');
  const route = readFileSync(join(process.cwd(), 'src/modules/invoicing/invoice.routes.ts'), 'utf8');

  // slice do bloco GET /invoices/:invoiceId (do handler GET até a próxima rota)
  const byIdStart = route.indexOf('fastify.get<{ Params: { invoiceId: string } }>');
  const byIdEnd = route.indexOf('fastify.get<{', byIdStart + 20); // a list (próximo fastify.get)
  const byId = byIdStart >= 0 ? route.slice(byIdStart, byIdEnd > byIdStart ? byIdEnd : route.length) : '';

  record('B0 by-id resolve a invoice (getInvoiceById) ANTES de canRepresentActor',
    byId.indexOf('getInvoiceById(') >= 0 && byId.indexOf('getInvoiceById(') < byId.indexOf('canRepresentActor('));
  record('B1 by-id gateia sobre AS PARTES (invoice.actorId E invoice.recipientActorId), NÃO params.invoiceId',
    /\[invoice\.actorId, invoice\.recipientActorId\]/.test(byId)
    && /canRepresentActor\(tenantId, callerUserId, partyId\)/.test(byId)
    && !/canRepresentActor\([^)]*invoiceId/.test(byId));
  record('B2 401 sem user + 403 fail-closed (INVOICE_NOT_REPRESENTABLE)',
    /status\(401\)/.test(byId) && /status\(403\)/.test(byId) && /INVOICE_NOT_REPRESENTABLE/.test(byId));
  record('B3 admin escape = financial:view_all_ledger (não o view_ledger do caller) e resolve caller-actor READ-ONLY (sem ensureUserActor/getActiveActor)',
    /financial:view_all_ledger/.test(byId) && /'invoice_read'/.test(byId)
    && /requirePermission\(/.test(byId)
    && /actor_type = 'user'/.test(byId)
    && !/ensureUserActor\(/.test(byId) && !/getActiveActor\(/.test(byId));
  // 🔴 §8/DECISION-0069: o admin escape NÃO pode resolver por "primeiro resultado".
  record('B3b admin escape NÃO usa LIMIT 1 no SQL nem rows[0] arbitrário (resolve fail-closed por ambiguidade)',
    !/actor_type = 'user' LIMIT 1/.test(byId) && !/rows\[0\]\?\.actor_id/.test(byId));
  record('B3c admin escape concede SÓ com EXATAMENTE 1 user-actor (rows.length === 1); 0 ou >1 → sem escape (fail-closed)',
    /rows\.length === 1/.test(byId) && /requirePermission\(/.test(byId)
    && byId.indexOf('rows.length === 1') < byId.indexOf('requirePermission('));
  record('B4 GET /invoices (list) intacto — gate por-parte preservado (canRepresentActor + "actor filtrado")',
    /canRepresentActor\(tenantId, callerUserId, partyId\)/.test(route) && /Sem autoridade sobre o actor filtrado/.test(route));
  record('B5 writes intocados (createInvoiceFromPayout/issueInvoice/cancelInvoice presentes; nenhum canRepresentActor injetado neles)',
    /createInvoiceFromPayout\(/.test(route) && /issueInvoice\(/.test(route) && /cancelInvoice\(/.test(route)
    && !byId.includes('issueInvoice(') && !byId.includes('cancelInvoice('));
  record('B6 by-id read-only: nenhum Bank/escrita no bloco (getInvoiceById = findById SELECT)',
    !/bank_ledger|bank_transactions|INSERT INTO|UPDATE |DELETE FROM/.test(byId));

  console.log('\n— C service: getInvoiceById read-only —');
  const svc = readFileSync(join(process.cwd(), 'src/modules/invoicing/invoice.service.ts'), 'utf8');
  const gi = svc.slice(svc.indexOf('async getInvoiceById'));
  const giBlock = gi.slice(0, gi.indexOf('async ', 10) > 0 ? gi.indexOf('async ', 10) : 400);
  record('C1 getInvoiceById só findById + NotFoundError (sem INSERT/UPDATE/DELETE/Bank)',
    /invoiceRepository\.findById\(/.test(giBlock) && !/INSERT INTO|UPDATE |DELETE FROM|bank_ledger/.test(giBlock));
  note('Denominador do arquivo: GET /:invoiceId (esta fatia) + GET list (já gateado) + writes (fora de escopo). by-id fechado.');

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
  console.log('✨ invoice by-id gateado pelas partes reais (canRepresentActor emissor/destinatário + admin view_all_ledger); IDOR fechado — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
