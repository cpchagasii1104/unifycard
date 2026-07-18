/**
 * E2E F-PJ-DELETE-GUARD-BANK-PORT — deleteCompany bloqueia exclusão de PJ com vínculo financeiro
 * MATERIAL, usando o Bank READ PORT canônico (actor-keyed), sem tabelas fantasmas.
 *
 * Contexto: o guard legado consultava `accounts`/`transactions` (FANTASMAS — inexistentes no schema
 * vivo; o SELECT lançava "relation does not exist" e a proteção nunca existiu). O SSOT financeiro é
 * actor-keyed (bank_accounts.actor_id / bank_ledger; owner_type ∈ {actor,system,escrow}). O guard novo
 * resolve os actors da empresa (actors.company_id — criado por createCompany) e consulta
 * BankTransactionReadPort.getWalletSummaryByActorId/listRecentTransactionsByActorId.
 *
 * Estratégia: injeta um STUB do BankTransactionReadPort para controlar o veredito financeiro por
 * cenário. Isso exercita (a) o RESOLVER real companyId→actors.company_id contra o DB e (b) a lógica
 * fail-closed do guard — SEM fabricar linhas em bank_ledger/bank_accounts (substrato soberano).
 *
 * Prova:
 *   D1 sem vínculo (summary=null) → exclusão PERMITIDA (status='inactive'); company_status intocado.
 *   D2 saldo≠0 → BLOQUEADO (PJ_DELETE_BLOCKED_FINANCIAL_LINK); não soft-deleta.
 *   D3 conta vazia (saldo 0, sem movimento) → PERMITIDA (regra atual: conta vazia não bloqueia).
 *   D4 movimentação (≥1 entry) → BLOQUEADO (PJ_DELETE_BLOCKED_FINANCIAL_LINK).
 *   D5 port lança (indisponível) → BLOQUEADO fail-closed (PJ_DELETE_BLOCKED_BANK_UNAVAILABLE).
 *   D6 empresa SEM actor → guard pula o port → PERMITIDA.
 *   D7 estrutural: fonte sem `FROM accounts`/`FROM transactions`; usa getBankTransactionRead; soft-delete
 *      mexe em `status` (não em company_status); RETURNING no UPDATE.
 *
 * Base: tenant DEV + PF canônica (dev@unificard.local). LIMPO ao fim (DEV intacto).
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-pj-delete-guard-bank-port.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { companiesService } from '../core/companies/companies.service';
import type { BankTransactionReadPort, WalletSummary, RecentTransaction } from '../core/bank/ports';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}

// ── STUB do Bank READ PORT: controla o veredito financeiro por cenário ──────────────────────────
type Mode = 'none' | 'balance' | 'empty-account' | 'movement' | 'throw';
let mode: Mode = 'none';

const stubReadPort: BankTransactionReadPort = {
  async getWalletSummaryByActorId(_tenantId: string, actorId: string): Promise<WalletSummary | null> {
    if (mode === 'throw') throw new Error('SIMULATED_BANK_READ_FAILURE');
    if (mode === 'none') return null;
    const balanceCents = (mode === 'balance' ? 5000 : 0) as unknown as WalletSummary['balanceCents'];
    return { actorId, balanceCents, currency: 'BRL' as WalletSummary['currency'], accountsCount: 1 };
  },
  async listRecentTransactionsByActorId(): Promise<RecentTransaction[]> {
    if (mode === 'throw') throw new Error('SIMULATED_BANK_READ_FAILURE');
    if (mode === 'movement') {
      return [{
        entryId: 'stub-entry-1',
        accountId: 'stub-account-1',
        direction: 'credit',
        amountCents: 5000 as unknown as RecentTransaction['amountCents'],
        createdAt: new Date(0),
      }];
    }
    return [];
  },
  async getMetadataByTransactionIds(): Promise<Map<string, Record<string, unknown>>> {
    return new Map();
  },
};

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // Injeta o STUB do Bank READ PORT (no app real é o adapter de @modules; aqui controlamos o veredito).
  const { bankPortsRegistry } = await import('../core/bank/ports-registry');
  bankPortsRegistry.setBankTransactionRead(stubReadPort);
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

async function statusOf(companyId: string): Promise<{ status: string | null; companyStatus: string | null }> {
  const r = await pool.query<{ status: string | null; company_status: string | null }>(
    `SELECT status, company_status FROM companies WHERE company_id = $1::uuid LIMIT 1`,
    [companyId]
  );
  return { status: r.rows[0]?.status ?? null, companyStatus: r.rows[0]?.company_status ?? null };
}

async function main(): Promise<void> {
  await bootstrap();

  const dev = await pool.query<{ global_user_id: string }>(
    `SELECT global_user_id::text FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) {
    console.error('❌ PF DEV não encontrada — rode bootstrap-dev-canonical antes.');
    process.exit(1);
  }
  const devGlobalUserId = dev.rows[0].global_user_id;

  const createdCompanyIds: string[] = [];

  async function withCompany(name: string, fn: (companyId: string) => Promise<void>): Promise<void> {
    const c = await companiesService.createCompany(
      devGlobalUserId,
      { cnpj: validCnpj(), companyName: name, role: 'owner' as never, fetchFromRevenue: false, isPrimary: false },
      TENANT_ID
    );
    const id = c.company.companyId;
    createdCompanyIds.push(id);
    try {
      await fn(id);
    } finally {
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = $1::uuid`, [id]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
      await deleteCompaniesAndFiscal(pool, "company_id = $1::uuid", [id]);
      createdCompanyIds.splice(createdCompanyIds.indexOf(id), 1);
    }
  }

  async function expectBlocked(id: string, expectedCode: string): Promise<{ blocked: boolean; msg: string }> {
    try {
      await companiesService.deleteCompany(id, devGlobalUserId, TENANT_ID);
      return { blocked: false, msg: '(não lançou)' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { blocked: msg.includes(expectedCode), msg };
    }
  }

  try {
    console.log('\n— D (delete guard: Bank read port canônico) —');

    // D1 — sem vínculo (summary=null) → PERMITIDA + soft-delete + company_status intocado
    mode = 'none';
    await withCompany('E2E Delete D1 none', async (id) => {
      const before = await statusOf(id);
      const ok = await companiesService.deleteCompany(id, devGlobalUserId, TENANT_ID);
      const after = await statusOf(id);
      record('D1 sem vínculo → exclusão permitida (retorna true)', ok === true, `ok=${ok}`);
      record('D1 soft-delete: status=inactive', after.status === 'inactive', `status=${after.status}`);
      record('D1 company_status intocado', after.companyStatus === before.companyStatus, `${before.companyStatus}→${after.companyStatus}`);
    });

    // D2 — saldo≠0 → BLOQUEADO; não soft-deleta
    mode = 'balance';
    await withCompany('E2E Delete D2 balance', async (id) => {
      const r = await expectBlocked(id, 'PJ_DELETE_BLOCKED_FINANCIAL_LINK');
      record('D2 saldo≠0 → bloqueado (FINANCIAL_LINK)', r.blocked, r.msg);
      const after = await statusOf(id);
      record('D2 não soft-deletou (status≠inactive)', after.status !== 'inactive', `status=${after.status}`);
    });

    // D3 — conta vazia (saldo 0, sem movimento) → PERMITIDA
    mode = 'empty-account';
    await withCompany('E2E Delete D3 empty', async (id) => {
      const ok = await companiesService.deleteCompany(id, devGlobalUserId, TENANT_ID);
      const after = await statusOf(id);
      record('D3 conta vazia → permitida (regra atual)', ok === true && after.status === 'inactive', `ok=${ok} status=${after.status}`);
    });

    // D4 — movimentação (≥1 entry) → BLOQUEADO
    mode = 'movement';
    await withCompany('E2E Delete D4 movement', async (id) => {
      const r = await expectBlocked(id, 'PJ_DELETE_BLOCKED_FINANCIAL_LINK');
      record('D4 movimentação → bloqueado (FINANCIAL_LINK)', r.blocked, r.msg);
      const after = await statusOf(id);
      record('D4 não soft-deletou', after.status !== 'inactive', `status=${after.status}`);
    });

    // D5 — port lança (indisponível) → BLOQUEADO fail-closed
    mode = 'throw';
    await withCompany('E2E Delete D5 throw', async (id) => {
      const r = await expectBlocked(id, 'PJ_DELETE_BLOCKED_BANK_UNAVAILABLE');
      record('D5 port indisponível → bloqueado fail-closed (BANK_UNAVAILABLE)', r.blocked, r.msg);
      const after = await statusOf(id);
      record('D5 não soft-deletou', after.status !== 'inactive', `status=${after.status}`);
    });

    // D6 — empresa SEM actor → guard pula o port → PERMITIDA (mesmo com mode='balance' o port não é chamado)
    mode = 'balance';
    await withCompany('E2E Delete D6 no-actor', async (id) => {
      await pool.query(`DELETE FROM actors WHERE company_id = $1::uuid`, [id]);
      const ok = await companiesService.deleteCompany(id, devGlobalUserId, TENANT_ID);
      const after = await statusOf(id);
      record('D6 sem actor → permitida (port não consultado)', ok === true && after.status === 'inactive', `ok=${ok} status=${after.status}`);
    });

    // D7 — estrutural (fonte). Line-ending agnóstico (CRLF/LF): normaliza antes de fatiar —
    // o fallback antigo (arquivo inteiro) fazia o pin gritar sobre métodos vizinhos em CRLF.
    const src = readFileSync(join(process.cwd(), 'src/core/companies/companies.service.ts'), 'utf8').replace(/\r\n/g, '\n');
    const delStart = src.indexOf('async deleteCompany(');
    const delEnd = src.indexOf('\n  }\n', delStart);
    const delBody = delStart >= 0 && delEnd >= 0 ? src.slice(delStart, delEnd) : src;
    const noPhantom = !/FROM\s+accounts\b/.test(delBody) && !/FROM\s+transactions\b/.test(delBody);
    record('D7 deleteCompany sem tabelas fantasmas (accounts/transactions)', noPhantom);
    record('D7 deleteCompany usa Bank read port canônico', /getBankTransactionRead\(\)/.test(delBody));
    record('D7 resolve via actors.company_id', /FROM actors WHERE tenant_id = \$1 AND company_id/.test(delBody));
    record('D7 soft-delete mexe em status (não company_status)', /UPDATE\s+companies\s+SET status = 'inactive'/.test(delBody) && !/company_status\s*=/.test(delBody));
    record('D7 UPDATE com RETURNING (boolean confiável)', /RETURNING company_id/.test(delBody));
  } finally {
    console.log('\n— cleanup —');
    if (createdCompanyIds.length > 0) {
      const ids = createdCompanyIds;
      for (const t of ['company_opportunity_preferences', 'company_domains', 'company_users']) {
        try { await pool.query(`DELETE FROM ${t} WHERE company_id = ANY($1::uuid[])`, [ids]); }
        catch (e) { if ((e as { code?: string }).code !== '42P01') console.warn(`cleanup ${t}:`, (e as Error).message); }
      }
      await pool.query(`DELETE FROM actors WHERE company_id = ANY($1::uuid[])`, [ids]);
      await deleteCompaniesAndFiscal(pool, "company_id = ANY($1::uuid[])", [ids]);
    }
    const left = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM companies WHERE company_name LIKE 'E2E Delete %'`
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
  console.log('✨ Delete guard (Bank read port canônico) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
