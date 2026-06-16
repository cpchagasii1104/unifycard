/**
 * E2E — F-CONTACTS-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT. NÃO cria contacts. NÃO move dinheiro.
 *
 * Prova que, com a tabela `contacts` AUSENTE, as rotas/callers respondem 501 CONTACTS_SCHEMA_GHOST_CONTAINED
 * (falha honesta) em vez de 500 cru / 42P01, e que o `contactRepository` NÃO é alcançado (a contenção fira
 * ANTES do SQL). Inclui o caminho de caller interno (service direto).
 *
 * 🔒 DB EFÊMERA (run-contacts-schema-ghost-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import contactRoutes from '../modules/marketplace/contact.routes';
import { contactService } from '../modules/marketplace/contact.service';
import { errorHandlerPlugin } from '../plugins/error-handler.plugin';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/contact|ghost|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let CURRENT_USER = ''; let CURRENT_AC: Record<string, unknown> = {};

async function main(): Promise<void> {
  await assertEphemeralDb();

  // 🔴 PROVA DE GHOST: a tabela contacts NÃO existe (esta frente NÃO a cria).
  const reg = (await pool.query<{ t: string | null }>(`SELECT to_regclass('public.contacts') AS t`)).rows[0]?.t;
  record('G0 tabela contacts AUSENTE no schema vivo (schema ghost)', reg == null, `to_regclass=${reg}`);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Contacts Ghost', slug: `cg-${Date.now()}` });
  const userId = randomUUID();
  const actorId = randomUUID();

  const app = Fastify();
  await app.register(errorHandlerPlugin);
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => { req.user = { id: CURRENT_USER, userId: CURRENT_USER }; req.tenant = { id: TENANT }; req.actionContext = CURRENT_AC; });
  await app.register(contactRoutes);
  await app.ready();

  CURRENT_USER = userId; CURRENT_AC = { actorId, actingUserId: userId };
  const st = (r: any) => r.statusCode;
  const code = (r: any) => { try { return JSON.parse(r.body)?.error?.code; } catch { return null; } };
  const GHOST = 'CONTACTS_SCHEMA_GHOST_CONTAINED';
  const cid = randomUUID();

  try {
    const cases: Array<[string, () => Promise<any>]> = [
      ['T1 POST /contacts', () => app.inject({ method: 'POST', url: '/contacts', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ name: 'Fulano', type: 'PERSON' }) })],
      ['T2 PATCH /contacts/:id', () => app.inject({ method: 'PATCH', url: `/contacts/${cid}`, headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ name: 'Novo' }) })],
      ['T3 GET /contacts', () => app.inject({ method: 'GET', url: '/contacts' })],
      ['T4 GET /contacts/:id', () => app.inject({ method: 'GET', url: `/contacts/${cid}` })],
      ['T5 GET /contacts/search', () => app.inject({ method: 'GET', url: '/contacts/search?taxId=12345678901' })],
      ['T6 POST /contacts/:id/kyc/validate', () => app.inject({ method: 'POST', url: `/contacts/${cid}/kyc/validate`, headers: { 'content-type': 'application/json' }, payload: '{}' })],
    ];
    for (const [label, fn] of cases) {
      const r = await fn();
      record(`${label} → 501 ${GHOST} (não 500/42P01)`, st(r) === 501 && code(r) === GHOST, `status=${st(r)} code=${code(r)}`);
    }

    // Caller interno (service direto): deve lançar 501 ANTES do repository (não 42P01).
    let internalCode = ''; let internalStatus = 0;
    try { await contactService.getContactById(TENANT, cid); }
    catch (e: any) { internalCode = e?.code ?? ''; internalStatus = e?.statusCode ?? 0; }
    record('T7 caller interno (contactService.getContactById) → AppError 501 contido (não 42P01)', internalStatus === 501 && internalCode === GHOST, `status=${internalStatus} code=${internalCode}`);

    // Prova de que o repository NÃO foi alcançado: se tivesse alcançado, o erro seria 42P01/PG (code '42P01'),
    // não o nosso GHOST. O code GHOST em TODOS os casos prova a contenção ANTES do SQL.
    const noPgError = !results.some(rr => /42P01|undefined_table|relation .* does not exist/i.test(rr.reason ?? ''));
    record('T8 nenhum caso vazou 42P01 / relation does not exist (repository NÃO alcançado)', noPgError);
  } finally {
    await app.close();
  }

  const passed = results.filter(r => r.ok).length;
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`RESULTADO: ${passed}/${results.length} verdes`);
  if (passed === results.length) console.log('✨ contacts ausente → 501 CONTACTS_SCHEMA_GHOST_CONTAINED em todas as superfícies; repository não alcançado; zero tabela criada; zero dinheiro.');
  await pool.end();
  if (passed !== results.length) process.exit(1);
}

main().catch(async (e) => { console.error('💥', e?.message || e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
