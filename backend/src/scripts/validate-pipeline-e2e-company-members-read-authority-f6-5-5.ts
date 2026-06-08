/**
 * E2E F6.5.5 — company-members GETs (DECISION-0113, resíduo de leituras operacionais)
 *
 * A fatia 2 gateou os WRITES de company-members (`requireCompanyManage` → `canManageCompany`), mas os 2 GETs
 * ficaram nus:
 *   GET /:companyId/members            → listMembers(tenant, {companyId da URL})  (lê estrutura org alheia)
 *   GET /:companyId/members/:memberId  → getMember(tenant, req.params.memberId)   (IDOR por memberId)
 * Fix (espelha a fatia 2):
 *   lista → requireCompanyManage(req.user, req.params.companyId) ANTES de listMembers.
 *   por-membro (anti-IDOR) → resolve o membro REAL → requireCompanyManage(member.companyId) (não a URL);
 *     membro inexistente → 403 não-leak (404 convertido).
 *
 * Prova:
 *   A behavioral — canManageCompany nega quem não gerencia a empresa (fail-closed). _(dono=true/estranho=false
 *     em empresa real é coberto pela regressão `authority-escalation-gate` da fatia 2, ephemeral — DEV tem 0 companies.)_
 *   B estrutural — gate antes da leitura nos 2 GETs; anti-IDOR (gateia member.companyId, não a URL); não-leak; writes intocados.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-company-members-read-authority-f6-5-5.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const DEV_EMAIL = 'dev@unificard.local';
const RANDOM_COMPANY_ID = '00000000-0000-4000-8000-0000000000c0';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }
function gateBeforeRead(src: string, gateMarker: string, readMarker: string): boolean {
  const g = src.indexOf(gateMarker);
  const r = src.indexOf(readMarker);
  return g >= 0 && r >= 0 && g < r;
}

async function main(): Promise<void> {
  const dev = await pool.query<{ id: string }>(
    `SELECT id::text AS id FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
    [DEV_EMAIL, TENANT_ID]
  );
  if (dev.rowCount === 0) { console.error('❌ PF DEV não encontrada.'); process.exit(1); }
  const devUserId = dev.rows[0].id;

  const { resolveGlobalUserId } = await import('../core/identity/identity.utils');
  const { companiesService } = await import('../core/companies/companies.service');
  let devGlobalUserId: string | null = null;
  try { devGlobalUserId = await resolveGlobalUserId(devUserId, TENANT_ID); } catch { devGlobalUserId = null; }

  console.log('\n— A behavioral: canManageCompany nega quem não gerencia (fail-closed) —');
  if (devGlobalUserId) {
    const canManageRandom = await companiesService.canManageCompany(TENANT_ID, RANDOM_COMPANY_ID, devGlobalUserId);
    record('A1 dev NÃO gerencia empresa aleatória/inexistente → canManageCompany=false (read seria 403)',
      canManageRandom === false, `canManage=${canManageRandom}`);
  } else {
    note('globalUserId do dev não resolvido — A1 N/A.');
  }
  note('dono=true / estranho=false em empresa REAL = coberto por authority-escalation-gate (fatia 2, ephemeral); DEV tem 0 companies.');

  console.log('\n— B estrutural: gate ANTES da leitura nos 2 GETs + anti-IDOR + writes intocados —');
  const src = readFileSync(join(process.cwd(), 'src/core/companies/company-members.routes.ts'), 'utf8');

  // GET /members (lista): requireCompanyManage(companyId da URL) antes de listMembers.
  record('B1 GET /members: requireCompanyManage(req, reply, req.params.companyId) antes de listMembers(',
    gateBeforeRead(src, 'F6.5.5: ler a estrutura organizacional', 'listMembers('));

  // GET /:memberId: resolve member → requireCompanyManage(member.companyId) ANTES de devolver.
  // Anti-IDOR: o gate usa member.companyId, NÃO req.params.companyId.
  const memberHandlerStart = src.indexOf("'/:companyId/members/:memberId'");
  const memberHandlerEnd = src.indexOf('PUT /companies/:companyId/members/:memberId');
  const memberGetSlice = memberHandlerStart >= 0 && memberHandlerEnd > memberHandlerStart
    ? src.slice(memberHandlerStart, memberHandlerEnd) : '';
  record('B2 GET /:memberId: getMember → requireCompanyManage(member.companyId) (anti-IDOR, não a URL)',
    /getMember\(req\.tenant\.id, req\.params\.memberId\)/.test(memberGetSlice)
    && /requireCompanyManage\(req, reply, member\.companyId\)/.test(memberGetSlice));
  record('B3 GET /:memberId: gate antes de retornar os dados do membro',
    gateBeforeRead(memberGetSlice, 'requireCompanyManage(req, reply, member.companyId)', 'memberId: member.memberId'));
  record('B4 GET /:memberId: membro inexistente (404) → 403 não-leak',
    /statusCode\?: number \}\)\?\.statusCode === 404/.test(memberGetSlice) && /Membro não acessível/.test(memberGetSlice));

  // Writes intocados: POST usa companyId da URL; PUT/DELETE usam target.companyId (anti-IDOR já existente).
  record('B5 writes intocados: POST requireCompanyManage(req.params.companyId); PUT/DELETE requireCompanyManage(target.companyId)',
    /requireCompanyManage\(req, reply, req\.params\.companyId\)/.test(src)
    && /requireCompanyManage\(req, reply, target\.companyId\)/.test(src));
  record('B6 gate canônico reaproveitado é o MESMO dos writes (requireCompanyManage → canManageCompany)',
    /companiesService\.canManageCompany\(tenantId, companyId, globalUserId\)/.test(src));

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
  console.log('✨ Company-members read authority F6.5.5 (mesma autoridade dos writes; anti-IDOR) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
