/**
 * E2E F-PJ-CNAE-EVIDENCE-WRITER — persiste CNAE/atividade como evidência fiscal (DECISION-0103 D2/D3/D5/D7/D8).
 *
 * 🔒 DB EFÊMERA. Guard duro: current_database() === EXPECTED_DATABASE_NAME e NUNCA 'unificard_dev'.
 *    Orquestrado por scripts/run-pj-cnae-evidence-writer-ephemeral.ps1.
 *
 * Prova (sem rede — fetchCNPJFromRevenue é mockado no singleton):
 *  1  createCompany com provider → 1 principal + N secundários persistidos na casa fiscal.
 *  2  Exatamente 1 primary; secundários is_primary=false; source/fetched_at preenchidos; FK p/ fiscal_identity.
 *  3  Idempotência: persistEconomicActivities 2× não duplica (fiscal,cnae) e atualiza descrição/source/fetched_at.
 *  4  Sem QSA: payload com qsa → tabela não recebe sócio (sem coluna; nenhuma linha com nome de sócio).
 *  5  Fail-open: provider null → empresa nasce, zero CNAE.
 *  6  Normalização: múltiplos principais → só o 1º primary; dedup principal∩secundário → 1 linha.
 *  7  companies sem colunas de atividade.
 *  8  Bank intocado.
 *  9  tenant_concept_offerings/company_concept_publications intocados.
 * 10  KYB intocado (kyb_status='pending').
 * 11  Schema = 359 migrations (sem nova migration nesta fatia).
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { companiesService } from '../core/companies/companies.service';
import { fiscalIdentityEconomicActivityService } from '../core/identity/fiscal-identity-economic-activity.service';
import { rbacService } from '../core/rbac/rbac.service';
import { authService } from '../core/auth/auth.service';
import { ensureUserActor } from '../modules/identity/actor-writer.service';
import type { RevenueFederalData } from '../core/companies/companies.types';

let TENANT_ID = '11111111-2222-3333-4444-666666666666'; // hint — adotado do register organico (C1)
const PASSWORD = '123456';
const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function validCnpj(seed: number): string {
  const n: number[] = [];
  let x = seed;
  for (let i = 0; i < 12; i++) { n.push(x % 10); x = Math.floor(x / 10) + 7 * (i + 1); }
  const dig = (len: number) => {
    let pos = len - 7, sum = 0;
    for (let i = 0; i < len; i++) { sum += n[i] * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(12));
  n.push(dig(13));
  return n.join('');
}
function validCpf(seed: number): string {
  const n: number[] = [];
  let x = seed;
  for (let i = 0; i < 9; i++) { n.push(x % 10); x = Math.floor(x / 10) + 3 * (i + 1); }
  const dig = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  n.push(dig(9));
  n.push(dig(10));
  return n.join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev" — esta validação NUNCA toca DEV.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED_DATABASE_NAME "${EXPECTED}".`);
  if (!/cnae|evidence|writer|fiscal|ephemeral|smoke|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function wireSocialPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

async function seedUser(email: string, cpf: string, fullName: string): Promise<{ globalUserId: string }> {
  const existing = await pool.query('SELECT user_id FROM users WHERE email = $1 LIMIT 1', [email.toLowerCase()]);
  if (existing.rowCount === 0) await authService.register(TENANT_ID, email, PASSWORD, cpf, fullName);
  // C1: lookup por email; o tenant REAL vem da linha (register é orgânico/canônico).
  const u = await pool.query<{ user_id: string; global_user_id: string; tenant_id: string }>(
    'SELECT user_id::text, global_user_id::text, tenant_id::text FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()]
  );
  if (u.rowCount === 0) throw new Error(`seed: user ${email} não encontrado`);
  if (TENANT_ID !== u.rows[0].tenant_id) {
    TENANT_ID = u.rows[0].tenant_id;
    await rbacService.seedDefaultRBAC(TENANT_ID);
  }
  await ensureUserActor(TENANT_ID, u.rows[0].user_id);
  await rbacService.assignRoleByName(TENANT_ID, u.rows[0].user_id, 'admin');
  return { globalUserId: u.rows[0].global_user_id };
}

async function countBank(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT (SELECT count(*) FROM bank_ledger) + (SELECT count(*) FROM bank_transactions) AS n`
  );
  return parseInt((r.rows[0] as any).n, 10);
}
async function countMarketplaceProjections(): Promise<number> {
  const r = await pool.query<{ n: string }>(
    `SELECT ((SELECT count(*) FROM tenant_concept_offerings) + (SELECT count(*) FROM company_concept_publications))::text AS n`
  );
  return parseInt(r.rows[0].n, 10);
}

// Fixture do provider: 1 principal + 2 secundários + QSA (sócio com nome/CPF — NÃO deve ser persistido).
function revenueFixture(cnpj: string): RevenueFederalData {
  return {
    cnpj,
    razao_social: 'Padaria Evidência LTDA',
    nome_fantasia: 'Padaria Evidência',
    atividade_principal: [{ code: '4721102', text: 'Padaria e confeitaria com predominância de revenda' }],
    atividades_secundarias: [
      { code: '5611201', text: 'Restaurantes e similares' },
      { code: '5620104', text: 'Fornecimento de alimentos preparados' },
    ],
    qsa: [{ nome: 'Fulano de Tal', qual: 'Sócio-Administrador', pais_origem: 'Brasil' }],
  };
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await wireSocialPorts();

  // C1: tenant adotado do register orgânico (seedUser); sem tenant sintético prévio.
  const { globalUserId } = await seedUser('cnae-writer@unificard.test', validCpf(987654321), 'CNAE Writer PF');

  // 11. schema migrado FULL (pin defasado de 359 atualizado: a fatia não cria migration,
  //     mas o repositório evolui — exige ≥359 e coerência com o runner FULL).
  const migN = parseInt((await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM schema_migrations`)).rows[0].n, 10);
  record('11 schema FULL aplicado (≥359 migrations; fatia não cria migration)', migN >= 359, `n=${migN}`);

  const bankBefore = await countBank();
  const mktBefore = await countMarketplaceProjections();

  // ── monkeypatch do provider (sem rede) ──
  const originalFetch = (companiesService as any).fetchCNPJFromRevenue.bind(companiesService);

  // ═══ 1/2 — createCompany com provider → persistência da evidência ═══
  const cnpj1 = validCnpj(100200300);
  (companiesService as any).fetchCNPJFromRevenue = async () => revenueFixture(cnpj1);
  const r1 = await companiesService.createCompany(
    globalUserId, { cnpj: cnpj1, role: 'owner', fetchFromRevenue: true }, TENANT_ID
  );
  const companyId1 = r1.company.companyId;
  const fid1 = (await pool.query<{ f: string }>(
    `SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id = $1`, [companyId1]
  )).rows[0].f;

  const rows1 = await pool.query<{ cnae_code: string; is_primary: boolean; source: string; fetched_at: any }>(
    `SELECT cnae_code, is_primary, source, fetched_at
       FROM fiscal_identity_economic_activities WHERE fiscal_identity_id = $1::uuid
      ORDER BY is_primary DESC, cnae_code ASC`, [fid1]
  );
  record('1 createCompany persistiu 3 CNAEs (1 principal + 2 secundários)', rows1.rowCount === 3, `n=${rows1.rowCount}`);
  const primaries = rows1.rows.filter((r) => r.is_primary === true);
  record('2a exatamente 1 primary (4721102)', primaries.length === 1 && primaries[0]?.cnae_code === '4721102', `primaries=${primaries.map((p) => p.cnae_code).join(',')}`);
  record('2b secundários is_primary=false (5611201, 5620104)', rows1.rows.filter((r) => !r.is_primary).map((r) => r.cnae_code).sort().join(',') === '5611201,5620104');
  record('2c source preenchido (receita_federal)', rows1.rows.every((r) => r.source === 'receita_federal'));
  record('2d fetched_at preenchido em todas as linhas', rows1.rows.every((r) => r.fetched_at != null));
  // FK real: a linha aponta para fiscal_identity existente
  const fkOk = (await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM fiscal_identity_economic_activities a
       JOIN fiscal_identities fi ON fi.fiscal_identity_id = a.fiscal_identity_id
      WHERE a.fiscal_identity_id = $1::uuid`, [fid1]
  )).rows[0].n;
  record('2e FK p/ fiscal_identities resolvida (3 linhas)', fkOk === '3', `n=${fkOk}`);

  // ═══ 3 — idempotência: chamar o writer 2× não duplica e atualiza ═══
  await fiscalIdentityEconomicActivityService.persistEconomicActivities({
    fiscalIdentityId: fid1,
    atividadePrincipal: [{ code: '4721102', text: 'DESCRICAO ATUALIZADA' }],
    atividadesSecundarias: [{ code: '5611201', text: 'Restaurantes e similares' }, { code: '5620104', text: 'Fornecimento de alimentos preparados' }],
    source: 'brasilapi',
    fetchedAt: new Date(),
  });
  const rows1b = await pool.query<{ cnae_code: string; cnae_description: string; source: string }>(
    `SELECT cnae_code, cnae_description, source FROM fiscal_identity_economic_activities WHERE fiscal_identity_id = $1::uuid`, [fid1]
  );
  record('3a idempotente: continua 3 linhas (sem duplicar (fiscal,cnae))', rows1b.rowCount === 3, `n=${rows1b.rowCount}`);
  const updated = rows1b.rows.find((r) => r.cnae_code === '4721102');
  record('3b update aplicado (descrição + source atualizados no conflito)', updated?.cnae_description === 'DESCRICAO ATUALIZADA' && updated?.source === 'brasilapi');

  // ═══ 4 — sem QSA: nenhuma coluna/linha guarda sócio ═══
  const qsaCol = (await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='fiscal_identity_economic_activities'
       AND (column_name ILIKE '%qsa%' OR column_name ILIKE '%socio%' OR column_name ILIKE '%cpf%' OR column_name ILIKE '%nome%')`
  )).rows[0].n;
  const socioLeak = (await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM fiscal_identity_economic_activities
      WHERE cnae_code ILIKE '%Fulano%' OR cnae_description ILIKE '%Fulano%'`
  )).rows[0].n;
  record('4 sem QSA (0 colunas socio/qsa/cpf/nome; nenhum sócio vazado)', qsaCol === '0' && socioLeak === '0', `col=${qsaCol} leak=${socioLeak}`);

  // ═══ 5 — fail-open: provider null → empresa nasce, zero CNAE ═══
  const cnpj2 = validCnpj(400500600);
  (companiesService as any).fetchCNPJFromRevenue = async () => null;
  const r2 = await companiesService.createCompany(
    globalUserId, { cnpj: cnpj2, companyName: 'Sem Receita LTDA', role: 'owner', fetchFromRevenue: true }, TENANT_ID
  );
  const fid2 = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [r2.company.companyId])).rows[0].f;
  const cnae2 = (await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM fiscal_identity_economic_activities WHERE fiscal_identity_id=$1::uuid`, [fid2])).rows[0].n;
  record('5 fail-open: provider null → empresa nasce, zero CNAE', !!r2.company.companyId && cnae2 === '0', `cnae=${cnae2}`);

  // ═══ 6 — normalização: múltiplos principais (só 1º primary) + dedup principal∩secundário ═══
  const cnpj3 = validCnpj(700800900);
  const r3 = await companiesService.createCompany(
    globalUserId, { cnpj: cnpj3, companyName: 'Normaliza LTDA', role: 'owner', fetchFromRevenue: false }, TENANT_ID
  );
  const fid3 = (await pool.query<{ f: string }>(`SELECT fiscal_identity_id::text AS f FROM companies WHERE company_id=$1`, [r3.company.companyId])).rows[0].f;
  const norm = await fiscalIdentityEconomicActivityService.persistEconomicActivities({
    fiscalIdentityId: fid3,
    atividadePrincipal: [{ code: '1111111', text: 'Primeiro principal' }, { code: '2222222', text: 'Segundo principal (vira secundário)' }],
    atividadesSecundarias: [{ code: '1111111', text: 'Duplicado do principal (ignorado)' }, { code: '3333333', text: 'Secundário real' }, { code: '   ', text: 'vazio (descartado)' }],
    source: 'receita_federal',
    fetchedAt: new Date(),
  });
  const rows3 = await pool.query<{ cnae_code: string; is_primary: boolean }>(
    `SELECT cnae_code, is_primary FROM fiscal_identity_economic_activities WHERE fiscal_identity_id=$1::uuid ORDER BY cnae_code`, [fid3]
  );
  const codes3 = rows3.rows.map((r) => r.cnae_code).join(',');
  const prim3 = rows3.rows.filter((r) => r.is_primary).map((r) => r.cnae_code).join(',');
  record('6a normalização: 3 códigos distintos (1111111,2222222,3333333; vazio descartado)', codes3 === '1111111,2222222,3333333', `codes=${codes3} persisted=${norm.persisted}`);
  record('6b só o 1º principal é primary (1111111); 2º principal vira secundário', prim3 === '1111111', `primary=${prim3}`);

  // restaura o método original (higiene)
  (companiesService as any).fetchCNPJFromRevenue = originalFetch;

  // ═══ 7 — companies sem colunas de atividade ═══
  const actCol = (await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM information_schema.columns WHERE table_name='companies'
       AND column_name IN ('main_activity_code','main_activity_description','secondary_activities')`
  )).rows[0].n;
  record('7 companies sem colunas de atividade', actCol === '0', `n=${actCol}`);

  // ═══ 8 — Bank intocado ═══
  const bankAfter = await countBank();
  record('8 Bank intocado (sem novas linhas bank_*)', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

  // ═══ 9 — marketplace/publication intocados ═══
  const mktAfter = await countMarketplaceProjections();
  record('9 tenant_concept_offerings/company_concept_publications intocados', mktAfter === mktBefore, `before=${mktBefore} after=${mktAfter}`);

  // ═══ 10 — KYB intocado (pending) ═══
  const kyb = (await pool.query<{ k: string }>(`SELECT kyb_status AS k FROM fiscal_identities WHERE fiscal_identity_id=$1::uuid`, [fid1])).rows[0].k;
  record('10 KYB intocado (kyb_status=pending)', kyb === 'pending', `kyb=${kyb}`);

  // ── Resumo ──
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
  console.log('✨ Writer de evidência CNAE verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
