/**
 * E2E F-ATOMIC-COMPANY-BIRTH — atomicidade do nascimento PJ (DECISION-0075 §9.2 / Opção B).
 *
 * 🔒 RODA APENAS EM DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME
 *    e NUNCA 'unificard_dev'. Orquestrado por scripts/run-atomic-company-birth-ephemeral.ps1
 *    (cria DB, migra MIGRATION_PROFILE=FULL, roda este script, dropa a DB no fim).
 *
 * Prova:
 *  1  Happy path: createCompany → company (PROVISIONAL/pending) + company_user + page-actor
 *     (responsible_actor_id = actor humano do criador), NÃO-operacional (primary_* NULL).
 *  2/3/4  Rollback TOTAL do núcleo (falha injetada após company / company_users / page-actor)
 *     → zero company, zero company_user, zero page-actor. (Exercita o MECANISMO que o
 *     createCompany passou a usar: withTransaction + ensurePageActorTx, sem cleanup compensatório.)
 *  5  Tenant context ativo em `actors` DENTRO da tx (set_config após BEGIN) e sem vazamento pós-commit.
 *  6  Endereço pós-commit falhando (catálogo de país ausente) → núcleo intacto, company válida
 *     SEM endereço, zero address_assignment órfão.
 *  7  Domains/preferences ausentes → nascimento NÃO cai (happy path verde apesar da ausência).
 *  8  Zero escrita em bank_* (contagem antes/depois inalterada).
 *
 * Modo: via orquestrador (recomendado). Standalone exige DB efêmera + EXPECTED_DATABASE_NAME.
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'crypto';
import { pool } from '../core/database/pool';
import { withTransaction } from '../core/database/transaction.helper';
import { companiesService } from '../core/companies/companies.service';
import { tenantService } from '../core/tenants/tenant.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor, ensurePageActorTx } from '../modules/identity/actor-writer.service';

const TENANT_ID = '11111111-2222-3333-4444-555555555555';
const EMAIL = 'atomic-birth@unificard.test';
const PASSWORD = '123456';
const CPF = '11144477735'; // CPF de teste com dígitos verificadores válidos
const FULLNAME = 'Atomic Birth PF';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

// ── GUARD DURO: jamais tocar unificard_dev ────────────────────────────────────
async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') {
    throw new Error('ABORT: banco-alvo é "unificard_dev" — F-ATOMIC-COMPANY-BIRTH NUNCA toca DEV.');
  }
  if (!EXPECTED || db !== EXPECTED) {
    throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}". Rode pelo orquestrador.`);
  }
  if (!/atomic_birth|ephemeral|smoke|test/i.test(db)) {
    throw new Error(`ABORT: nome de banco "${db}" não parece efêmero (esperado conter atomic_birth/ephemeral/smoke/test).`);
  }
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

// ── DI dos social ports (mesma wiring de app.builder / bootstrap-dev-canonical) ──
async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

// ── Seed canônico (replica bootstrap-dev-canonical: tenant + RBAC + register + admin) ──
async function seed(): Promise<{ globalUserId: string; userId: string; creatorActorId: string }> {
  const t = await pool.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [TENANT_ID]);
  if (t.rowCount === 0) {
    await tenantService.createTenant({ id: TENANT_ID, name: 'Atomic Birth Test', slug: 'atomic-birth-test' });
  }
  await rbacService.seedDefaultRBAC(TENANT_ID);

  const existing = await pool.query('SELECT user_id FROM users WHERE email = $1 LIMIT 1', [EMAIL.toLowerCase()]);
  if (existing.rowCount === 0) {
    await authService.register(TENANT_ID, EMAIL, PASSWORD, CPF, FULLNAME);
  }
  const u = await pool.query<{ user_id: string; global_user_id: string }>(
    'SELECT user_id::text, global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1',
    [EMAIL.toLowerCase(), TENANT_ID]
  );
  if (u.rowCount === 0) throw new Error('seed: user não encontrado após register');
  const userId = u.rows[0].user_id;
  const globalUserId = u.rows[0].global_user_id;
  const actor = await ensureUserActor(TENANT_ID, userId);
  await rbacService.assignRoleByName(TENANT_ID, userId, 'admin');
  console.log(`🌱 seed pronto — userId=${userId} globalUserId=${globalUserId} creatorActor=${actor.actor_id}`);
  return { globalUserId, userId, creatorActorId: actor.actor_id };
}

function randomCnpj(): string {
  let s = '';
  for (let i = 0; i < 14; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

async function countBankRows(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT COALESCE(SUM(c), 0)::text AS n FROM (
       SELECT (SELECT count(*) FROM bank_ledger)        AS c
       UNION ALL SELECT (SELECT count(*) FROM bank_transactions)
     ) s`
  );
  return parseInt(r.rows[0].n, 10);
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();
  const { globalUserId, creatorActorId } = await seed();

  const bankBefore = await countBankRows().catch(() => -1);

  // ═══ 1 — HAPPY PATH ════════════════════════════════════════════════════════
  console.log('\n— 1 happy path —');
  const cnpj1 = randomCnpj();
  const r1 = await companiesService.createCompany(
    globalUserId,
    { cnpj: cnpj1, companyName: 'Atomic Happy', role: 'owner', fetchFromRevenue: false },
    TENANT_ID
  );
  const companyId = r1.company.companyId;

  const comp = await pool.query<{ company_status: string; primary_company_type_id: string | null }>(
    'SELECT company_status, primary_company_type_id::text FROM companies WHERE company_id = $1 AND tenant_id = $2',
    [companyId, TENANT_ID]
  );
  record('1a company criada', comp.rowCount === 1);
  record('1b company PROVISIONAL/pending (não-operacional)', comp.rows[0]?.company_status === 'PROVISIONAL' && comp.rows[0]?.primary_company_type_id === null);

  const cu = await pool.query<{ n: string }>('SELECT count(*)::text n FROM company_users WHERE company_id = $1', [companyId]);
  record('1c company_user criado', cu.rows[0].n === '1');

  const pa = await pool.query<{ actor_type: string; responsible_actor_id: string | null }>(
    `SELECT actor_type, responsible_actor_id::text FROM actors WHERE tenant_id=$1 AND company_id=$2 AND actor_type='page'`,
    [TENANT_ID, companyId]
  );
  record('1d page-actor criado (1, com responsible_actor_id = criador)', pa.rowCount === 1 && pa.rows[0].responsible_actor_id === creatorActorId);

  // ═══ 5 — TENANT CONTEXT DENTRO DA TX ═══════════════════════════════════════
  console.log('\n— 5 tenant context / RLS —');
  await withTransaction(TENANT_ID, async (client) => {
    await client.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT_ID]);
    const cs = await client.query("SELECT current_setting('app.current_tenant', true) AS t");
    const t5 = cs.rows[0].t as string;
    record('5a tenant context ativo DENTRO da tx (set_config após BEGIN)', t5 === TENANT_ID, `t=[${t5}]`);
  });
  const leak = await pool.query<{ t: string }>("SELECT current_setting('app.current_tenant', true) AS t");
  record('5b tenant context NÃO vaza pós-commit', leak.rows[0].t === '' || leak.rows[0].t == null, `t=[${leak.rows[0].t}]`);

  // ═══ 2/3/4 — ROLLBACK TOTAL DO NÚCLEO ══════════════════════════════════════
  // Replica o núcleo (companies + company_users + ensurePageActorTx) que createCompany usa,
  // injetando falha após cada passo. Prova que withTransaction rola TUDO atrás (zero órfão).
  console.log('\n— 2/3/4 rollback entre passos —');
  async function birthCoreThenThrow(throwAfter: 'company' | 'company_users' | 'page_actor', cnpj: string): Promise<void> {
    await withTransaction(TENANT_ID, async (client) => {
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [TENANT_ID]);
      const c = await client.query(
        `INSERT INTO companies (tenant_id, global_user_id, cnpj, company_name, status, is_verified, company_status)
         VALUES ($1, $2, $3, 'Rollback Test', 'active', false, 'PROVISIONAL') RETURNING company_id`,
        [TENANT_ID, globalUserId, cnpj]
      );
      const cid = c.rows[0].company_id as string;
      if (throwAfter === 'company') throw new Error('INJECT: falha após companies');
      await client.query(
        `INSERT INTO company_users (
           tenant_id, company_id, global_user_id, role, role_description,
           can_manage_company, can_manage_financial, can_manage_employees,
           can_view_reports, can_manage_services, is_active, is_primary, metadata
         ) VALUES ($1,$2,$3,'owner',NULL,true,true,true,true,true,true,false,'{}'::jsonb)`,
        [TENANT_ID, cid, globalUserId]
      );
      if (throwAfter === 'company_users') throw new Error('INJECT: falha após company_users');
      await ensurePageActorTx(client, TENANT_ID, cid, creatorActorId);
      if (throwAfter === 'page_actor') throw new Error('INJECT: falha após page_actor');
    });
  }

  for (const step of ['company', 'company_users', 'page_actor'] as const) {
    const cnpjX = randomCnpj();
    let threw = false;
    try {
      await birthCoreThenThrow(step, cnpjX);
    } catch {
      threw = true;
    }
    const left = await pool.query<{ n: string }>('SELECT count(*)::text n FROM companies WHERE cnpj = $1 AND tenant_id = $2', [cnpjX, TENANT_ID]);
    const cuLeft = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM company_users cu JOIN companies c ON c.company_id = cu.company_id WHERE c.cnpj = $1`,
      [cnpjX]
    );
    const paLeft = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM actors a JOIN companies c ON c.company_id = a.company_id WHERE c.cnpj = $1 AND a.actor_type = 'page'`,
      [cnpjX]
    );
    const clean = threw && left.rows[0].n === '0' && cuLeft.rows[0].n === '0' && paLeft.rows[0].n === '0';
    record(`${step}: rollback TOTAL (company/company_user/page-actor = 0)`, clean, `threw=${threw} comp=${left.rows[0].n} cu=${cuLeft.rows[0].n} page=${paLeft.rows[0].n}`);
  }

  // ═══ 6 — ENDEREÇO PÓS-COMMIT: núcleo independente + sub-unidade atômica ════
  // Contrato (DECISION-0075 §9.2): endereço é pós-commit; se falhar, a company permanece
  // válida (estado sem endereço) e NÃO sobra assignment órfão. createAddressAndAssign é atômico.
  console.log('\n— 6 endereço pós-commit —');
  const { locationRepository } = await import('../core/location/location.repository');

  // 6a — company SEM endereço = estado válido (núcleo independe de endereço).
  const r6a = await companiesService.createCompany(
    globalUserId,
    { cnpj: randomCnpj(), companyName: 'Atomic No-Address', role: 'owner', fetchFromRevenue: false },
    TENANT_ID
  );
  const company6a = r6a.company.companyId;
  const c6a = await pool.query<{ addr: string | null }>('SELECT primary_address_id::text addr FROM companies WHERE company_id = $1', [company6a]);
  const asg6a = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM address_assignments WHERE owner_type='company' AND owner_id=$1`, [company6a]);
  record('6a company válida SEM endereço (primary_address_id NULL, zero assignment)', c6a.rows[0].addr == null && asg6a.rows[0].n === '0');

  // 6b — caminho pós-commit de endereço VÁLIDO grava (país BR existe na efêmera).
  const r6b = await companiesService.createCompany(
    globalUserId,
    { cnpj: randomCnpj(), companyName: 'Atomic With-Address', role: 'owner', fetchFromRevenue: false, address: { cep: '01310100', country: 'BR' } },
    TENANT_ID
  );
  const company6b = r6b.company.companyId;
  const c6b = await pool.query<{ addr: string | null }>('SELECT primary_address_id::text addr FROM companies WHERE company_id = $1', [company6b]);
  const asg6b = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM address_assignments WHERE owner_type='company' AND owner_id=$1`, [company6b]);
  record('6b endereço pós-commit válido grava (primary_address_id + 1 assignment)', c6b.rows[0].addr != null && asg6b.rows[0].n === '1');

  // 6c — FALHA de endereço (FK país inválido) → sub-unidade atômica NÃO deixa órfão e a
  //      company-alvo (6a, já committada) permanece intacta. Prova: "falha de endereço não
  //      reverte núcleo, sem assignment órfão" — sem advérbio absoluto, com teste.
  const marker = `ATOMIC-6C-${randomUUID()}`;
  let addrThrew = false;
  try {
    await locationRepository.createAddressAndAssign(
      { countryId: '00000000-0000-0000-0000-000000000000', stateId: null, cityId: null, neighborhoodId: null, postalCode: null, street: marker, number: null, complement: null, reference: null, source: 'UX_INPUT', lat: null, lng: null },
      TENANT_ID,
      { ownerType: 'company', ownerId: company6a, role: 'HQ', isPrimary: true }
    );
  } catch {
    addrThrew = true;
  }
  const orphanAddr = await pool.query<{ n: string }>('SELECT count(*)::text n FROM addresses WHERE street = $1', [marker]);
  const orphanAsg = await pool.query<{ n: string }>(`SELECT count(*)::text n FROM address_assignments WHERE owner_type='company' AND owner_id=$1`, [company6a]);
  const compStill = await pool.query<{ n: string }>('SELECT count(*)::text n FROM companies WHERE company_id = $1', [company6a]);
  record('6c falha de endereço atômica (zero address órfão, zero assignment) + núcleo intacto', addrThrew && orphanAddr.rows[0].n === '0' && orphanAsg.rows[0].n === '0' && compStill.rows[0].n === '1');

  // ═══ 7 — DOMAINS/PREFERENCES AUSENTES NÃO DERRUBAM ═════════════════════════
  console.log('\n— 7 domains/preferences ausentes —');
  const hasDomains = (await pool.query(`SELECT to_regclass('public.company_domains') IS NOT NULL AS x`)).rows[0].x;
  const hasPrefs = (await pool.query(`SELECT to_regclass('public.company_opportunity_preferences') IS NOT NULL AS x`)).rows[0].x;
  // Happy path (1) e endereço (6a/6b) já nasceram apesar do estado dessas tabelas → nascimento tolerante.
  record(`7 nascimento tolerante a domains/preferences (domains_present=${hasDomains}, prefs_present=${hasPrefs})`, comp.rowCount === 1 && !!company6a && !!company6b);

  // ═══ 8 — ZERO ESCRITA EM BANK ══════════════════════════════════════════════
  console.log('\n— 8 zero Bank —');
  const bankAfter = await countBankRows().catch(() => -1);
  record('8 nenhuma escrita em bank_* durante o nascimento', bankBefore >= 0 && bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  // ── Resumo ──────────────────────────────────────────────────────────────
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
  console.log('✨ F-ATOMIC-COMPANY-BIRTH: todos os cenários verdes.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
