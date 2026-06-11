#!/usr/bin/env node
// Gate estrutural — F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE
// Sela a jornada PJ (humano íntegro → empresa → fiscal → vínculo → page actor → autoridade →
// ativação → KYB → review humano → publicação → discovery → reabertura → isolamento):
//   - nascimento fiscal-first ATÔMICO sem cura de actor humano;
//   - criador com vínculo server-side (can_manage_company imposto);
//   - readers de company por MEMBERSHIP (não autoria global_user_id);
//   - KYB: submit user-facing gateado + review/revogação humanos admin-only + gate documental;
//   - ativação: writer ÚNICO do par + lifecycle no MESMO UPDATE (PROVISIONAL ⇒ par);
//   - publicação KYB-gated + discovery com defesa em profundidade;
//   - dashboard PJ actor-correct e failure-honest (erro nunca vira zero/vazio);
//   - Bank writers PROIBIDOS no denominador PJ.
//
// Classificações: CLOSED_PJ / KNOWN_OPEN_OUTSIDE_PJ / FINANCIAL_HARD_STOP /
//                 FORBIDDEN_REGRESSION / NEW_UNCLASSIFIED.
// Este gate NÃO declara: marketplace completo / inventory fechado / venda fechada /
// money fechado / FASE 6 liberada / R2 liberado / produtos-serviços completos.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const BE = (p) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
const FE = (p) => readFileSync(join(process.cwd(), '..', 'frontend', 'src', p), 'utf8');
const MIG = (p) => readFileSync(join(process.cwd(), 'migrations', p), 'utf8');

const failures = [];
const surfaces = [];
function check(surface, ok, failMsg, cls = 'FORBIDDEN_REGRESSION') {
  surfaces.push([surface, ok ? 'CLOSED_PJ' : cls]);
  if (!ok) failures.push(`${cls}: ${failMsg}`);
}

// Strip de comentários ORDER-SAFE (F-PJ-KYB-DOCUMENT-ACTOR-CURE-CLOSURE §10): comentários de
// LINHA primeiro — um `/*` dentro de um comentário `// ... admin/*` abria um falso bloco e
// MUTILAVA o código analisado (provado: a varredura da família deixava de ver injeção real).
// Guarda `[^:"'\`]` preserva `://` (URLs em strings). LIMITAÇÃO HONESTA: heurística textual,
// não AST — `//` no meio de string ainda é stripado; nenhum arquivo da família depende disso
// (verificado), e falso-positivo aqui só torna o gate MAIS restritivo, nunca mais permissivo
// para os tokens proibidos (que são identificadores/SQL sem `//`).
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── 1. NASCIMENTO: fiscal-first atômico, sem cura de actor humano (PJ-B3) ──
{
  const src = BE('core/companies/companies.service.ts');
  const code = stripComments(src);
  const noCure = !code.includes('ensureUserActor') && !/\bensurePageActor\b(?!Tx)/.test(code);
  check('pj:birth-no-actor-cure', noCure && src.includes('COMPANY_CREATOR_ACTOR_MISSING') && src.includes('findByUserId'),
    'companies.service não pode curar actor (ensureUserActor/ensurePageActor não-Tx proibidos); resolução por leitura + erro COMPANY_CREATOR_ACTOR_MISSING.');

  const birth = src.slice(src.indexOf('async createCompany'), src.indexOf('async activateCompanyOperationally'));
  const atomic = /withTransaction/.test(birth)
    && /INSERT INTO fiscal_identities/.test(birth)
    && /INSERT INTO companies/.test(birth)
    && /INSERT INTO company_users/.test(birth)
    && /ensurePageActorTx/.test(birth)
    && !/DELETE FROM companies/.test(birth);
  check('pj:birth-atomic-fiscal-first', atomic,
    'createCompany: fiscal_identities + companies + company_users + page-actor devem nascer na MESMA withTransaction (sem cleanup compensatório).');

  check('pj:creator-authority-server-side', /canManageCompany: true,/.test(birth),
    'criador deve nascer com can_manage_company=true imposto server-side (Opção B).');
}

// ── 1b. FAMÍLIA PJ TRANSVERSAL: NENHUM serviço da jornada cria/cura ACTOR HUMANO ──
//        (F-PJ-KYB-DOCUMENT-ACTOR-CURE-CLOSURE §9 — a regra deixou de ser por arquivo único.)
//        Proibidos (código vivo, comment-stripped): ensureUserActor · findOrCreateUserActor ·
//        ensureCanonicalActorChain · INSERT INTO actors. Exceção ÚNICA: ensurePageActorTx
//        (page-actor da EMPRESA) dentro de companies.service.ts (transação canônica do nascimento).
//        "Auth-derived"/"idempotente"/"só legado" NÃO são exceção.
{
  const PJ_ACTOR_FAMILY = [
    'core/companies/companies.service.ts',
    'core/companies/companies.routes.ts',
    'core/companies/company-members.service.ts',
    'core/companies/company-members.repository.ts',
    'core/companies/company-members.routes.ts',
    'core/companies/company-publications.service.ts',
    'core/companies/company-validation.service.ts',
    'core/kyb-documents/kyb-document-submit.service.ts',
    'core/kyb-documents/kyb-request-submit.service.ts',
    'core/kyb-documents/kyb-document-download.service.ts',
    'core/identity/fiscal-identity-kyb.service.ts',
    'core/identity/fiscal-identity-document.service.ts',
    'core/identity/fiscal-identity-economic-activity.service.ts',
  ];
  const FORBIDDEN_CURE = /\bensureUserActor\b|\bfindOrCreateUserActor\b|\bensureCanonicalActorChain\b|INSERT INTO actors\b/;
  for (const f of PJ_ACTOR_FAMILY) {
    let code = stripComments(BE(f));
    if (f.endsWith('companies.service.ts')) {
      // remove a exceção transacional ANTES do match (ensurePageActorTx contém 'ensurePageActor',
      // não os tokens proibidos — a remoção é só clareza/robustez).
      code = code.replace(/ensurePageActorTx/g, '__PAGE_ACTOR_TX_ALLOWED__');
    }
    const short = f.split('/').pop();
    check(`pj:family-no-actor-cure:${short}`, !FORBIDDEN_CURE.test(code),
      `${f} contém criação/cura de actor humano (ensureUserActor/findOrCreateUserActor/ensureCanonicalActorChain/INSERT INTO actors) — PROIBIDO na jornada PJ (PJ-B3).`);
  }

  // Arquivo NOVO nos diretórios da jornada sem classificação → NEW_UNCLASSIFIED (falha).
  const CLASSIFIED_NON_RESOLVING = new Set([
    'companies.module.ts', 'companies.types.ts', 'company-members.types.ts', 'kyb-document-validation.ts',
  ]);
  const familyShort = new Set(PJ_ACTOR_FAMILY.map((f) => f.split('/').pop()));
  const unclassified = [];
  for (const dir of ['core/companies', 'core/kyb-documents']) {
    for (const entry of readdirSync(join(process.cwd(), 'src', dir))) {
      if (!/\.ts$/.test(entry)) continue;
      if (!familyShort.has(entry) && !CLASSIFIED_NON_RESOLVING.has(entry)) unclassified.push(`${dir}/${entry}`);
    }
  }
  surfaces.push(['pj:family-new-unclassified', unclassified.length === 0 ? 'CLOSED_PJ' : 'NEW_UNCLASSIFIED']);
  if (unclassified.length > 0) {
    failures.push(`NEW_UNCLASSIFIED: serviço PJ novo sem classificação no denominador de actor-resolution: ${unclassified.join(', ')} — classificar no gate antes de prosseguir.`);
  }
}

// ── 2. READERS por MEMBERSHIP (PJ-B4) ──
{
  const src = BE('core/companies/companies.service.ts');
  // NB: 'async updateCompany(' com parêntese — updateCompanyDomains existe no topo do arquivo.
  const list = src.slice(src.indexOf('async listCompanies'), src.indexOf('async updateCompany('));
  const listOk = /INNER JOIN company_users\s+cu/.test(list)
    && /cu\.global_user_id = \$2::uuid/.test(list)
    && !/WHERE c\.tenant_id = \$1 AND c\.global_user_id = \$2::uuid/.test(list);
  check('pj:list-membership-scoped', listOk,
    'listCompanies (caminho normal) deve derivar acesso de company_users ativo, não de companies.global_user_id.');

  const get = src.slice(src.indexOf('async getCompanyById'), src.indexOf('private async projectCallerCompanyUser'));
  const getOk = /EXISTS \(\s*SELECT 1 FROM company_users cu/.test(get)
    && !/AND global_user_id = \$3::uuid\s*\n\s*LIMIT 1/.test(get);
  check('pj:get-membership-scoped', getOk,
    'getCompanyById (caminho normal) deve derivar acesso de membership (EXISTS company_users), não de autoria.');

  const upd = src.slice(src.indexOf('async updateCompany('), src.indexOf('async getCompanyUserById'));
  check('pj:update-manage-gated', /canManageCompany\(/.test(upd),
    'updateCompany deve exigir canManageCompany (leitura por vínculo não concede gestão).');
  const del = src.slice(src.indexOf('async deleteCompany'));
  check('pj:delete-manage-gated', /canManageCompany\(/.test(del.slice(0, 2000)),
    'deleteCompany deve exigir canManageCompany.');
}

// ── 3. checkOwnership reconhece vocabulário canônico ──
{
  const src = BE('core/authorization/authorization.service.ts');
  const own = src.slice(src.indexOf('private async checkOwnership'));
  check('pj:checkownership-canonical', /canManageCompany\(/.test(own.slice(0, 1500)),
    "checkOwnership('companies') deve reconhecer o vocabulário canônico (canManageCompany: can_manage_company OR role='owner').");
}

// ── 4. KYB: submit USER-FACING gateado (PJ-B1) ──
{
  const routes = BE('core/companies/companies.routes.ts');
  check('pj:kyb-submit-user-facing', routes.includes("'/:companyId/kyb/requests'") && routes.includes("'/:companyId/kyb/status'"),
    'POST /companies/:id/kyb/requests (submit do responsável) e GET kyb/status devem existir — submit NÃO pode voltar a ser admin-only.');

  const svc = BE('core/kyb-documents/kyb-request-submit.service.ts');
  const ok = /canManageCompany\(/.test(svc)
    && /KYB_REQUEST_REQUIRES_DOCUMENTS/.test(svc)
    && /cnpj_registration/.test(svc) && /articles_of_association/.test(svc)
    && /findByUserId/.test(svc) && !/ensureUserActor/.test(svc);
  check('pj:kyb-submit-guards', ok,
    'kyb-request-submit: canManageCompany + documentos mínimos materialmente enviados + autoria por leitura (sem cura).');

  // F-PJ-KYB-DOCUMENT-ACTOR-CURE-CLOSURE: o submit DOCUMENTAL resolve actor por LEITURA com erro
  // estrutural + compensa INSERT falho pós-storage (deleteDocument). Vetor da Yala selado.
  const docSvc = stripComments(BE('core/kyb-documents/kyb-document-submit.service.ts'));
  const docOk = /findByUserId/.test(docSvc)
    && /KYB_DOC_ACTOR_MISSING/.test(docSvc)
    && /deleteDocument/.test(docSvc)
    && !/ensureUserActor|findOrCreateUserActor/.test(docSvc);
  check('pj:kyb-doc-submit-read-resolved-compensated', docOk,
    'kyb-document-submit: actor por LEITURA (findByUserId + KYB_DOC_ACTOR_MISSING) + compensação de storage no INSERT falho — cura PROIBIDA.');
}

// ── 5. KYB: review/revogação humanos, admin-only; founder não se auto-aprova ──
{
  const idr = BE('core/identity/identity.routes.ts');
  const reviewIdx = idr.indexOf("'/pj/kyb/admin/requests/:requestId/review'");
  const reviewGated = reviewIdx > 0 && idr.slice(reviewIdx, reviewIdx + 300).includes("requireRole(['admin'])");
  const revokeIdx = idr.indexOf("'/pj/kyb/admin/fiscal-identities/:fiscalIdentityId/revoke'");
  const revokeGated = revokeIdx > 0 && idr.slice(revokeIdx, revokeIdx + 300).includes("requireRole(['admin'])");
  check('pj:kyb-review-admin-only', reviewGated && revokeGated,
    'review e revogação KYB devem permanecer requireRole(admin) — founder/page-actor não revisam.');

  const kyb = BE('core/identity/fiscal-identity-kyb.service.ts');
  check('pj:kyb-doc-gate', /KYB_APPROVAL_REQUIRES_DOCUMENTS/.test(kyb),
    'aprovar KYB sem cnpj_registration+articles_of_association aceitos deve permanecer bloqueado (gate §3.10).');
  check('pj:kyb-revocation-human-cascade',
    /KYB_REVOCATION_REQUIRES_HUMAN_REVIEWER/.test(kyb) && /retireAllActivePublicationsForCompanyTx/.test(kyb),
    'revogação: reviewer humano fail-closed + cascata de retração de publicações (DECISION-0101).');
  check('pj:kyb-resubmission-contract',
    /kyb_status !== 'pending' && fi\.rows\[0\]\.kyb_status !== 'rejected'/.test(kyb),
    "reenvio pós-rejeição: submit aceita fonte em 'pending'/'rejected' (e SÓ esses) — contrato GO §3.1/8.4.");
}

// ── 6. ATIVAÇÃO: writer único do par + lifecycle no MESMO UPDATE ──
{
  // varredura: nenhum outro arquivo de src (fora scripts) pode escrever primary_company_type_id.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      const st = statSync(p);
      if (st.isDirectory()) {
        if (entry === 'scripts' || entry === 'node_modules') continue;
        walk(p);
      } else if (/\.ts$/.test(entry)) {
        const s = readFileSync(p, 'utf8');
        if (/SET primary_company_type_id/.test(s) && !p.endsWith(join('companies', 'companies.service.ts'))) {
          offenders.push(p);
        }
      }
    }
  };
  walk(join(process.cwd(), 'src'));
  check('pj:activation-single-writer', offenders.length === 0,
    `writer paralelo de primary_* detectado fora de activateCompanyOperationally: ${offenders.join(', ')}`);

  const src = BE('core/companies/companies.service.ts');
  const act = src.slice(src.indexOf('async activateCompanyOperationally'), src.indexOf('async canManageCompany'));
  const ok = /SET primary_company_type_id = \$1,\s*\n\s*primary_concept_id = \$2,\s*\n\s*company_status = CASE WHEN company_status = 'DRAFT' THEN 'PROVISIONAL'/.test(act)
    && /FOR UPDATE/.test(act)
    && /company_type_allowed_concepts/.test(act)
    && /findByUserId/.test(act) && /findByCompanyId/.test(act);
  check('pj:activation-pair-lifecycle-atomic', ok,
    'ativação: par + DRAFT→PROVISIONAL no MESMO UPDATE sob lock, allowlist validada, actors resolvidos por LEITURA.');

  const routes = BE('core/companies/companies.routes.ts');
  const schemaStart = routes.indexOf('const operationalActivationSchema');
  const schema = routes.slice(schemaStart, routes.indexOf('});', schemaStart) + 3);
  check('pj:activation-no-metadata-ssot', /companyTypeId: z\.string\(\)\.uuid\(\)/.test(schema) && !/businessType|businessCategory|metadata/.test(schema),
    'body da ativação aceita SÓ o par canônico — businessType/metadata não podem virar SSOT operacional.');
}

// ── 7. ALLOWLIST governada cobre os 7 company_types (PJ-B6) ──
{
  let ok = false;
  try {
    const mig = MIG('20260416125000_concepts_estabelecimento.sql');
    ok = ['supermercado', 'hortifruti', 'acougue', 'padaria', 'farmacia', 'salao', 'restaurante']
      .every((slug) => mig.includes(`'${slug}'`));
  } catch { ok = false; }
  check('pj:allowlist-7-types-governed', ok,
    'migration 20260416125000 deve manter os pares allowed dos 7 company_types governados.');
}

// ── 8. PUBLICAÇÃO: KYB-gated + discovery com defesa em profundidade ──
{
  const pub = BE('core/companies/company-publications.service.ts');
  const ok = /KYB_NOT_APPROVED/.test(pub) && /findByUserId/.test(pub) && !/ensureUserActor/.test(pub);
  check('pj:publication-kyb-gated-no-cure', ok,
    'publishCompanyConcept: KYB approved obrigatório + actor humano por LEITURA (sem cura).');

  const reader = BE('modules/marketplace/tenant-concept-offerings.repository.ts');
  check('pj:discovery-defense-in-depth',
    /company_concept_publications/.test(reader) && /kyb_status = 'approved'/.test(reader),
    'discovery reader deve exigir publicação active + fiscal kyb_status=approved (EXISTS) — PROVISIONAL/pending não vazam.');
}

// ── 9. DASHBOARD PJ: actor-correct e failure-honest (PJ-B5) ──
{
  const over = FE('components/company/tabs/CompanyOverviewTab.tsx');
  const fin = FE('components/company/tabs/CompanyFinancialTab.tsx');
  const okOver = /actorId: pageActorId/.test(over) && /indisponível/.test(over)
    && !/getBankBalance\(\)\.catch\(\(\) => null\)/.test(over)
    && !/getBankStatement\(\{ limit: \d+ \}\)\.catch/.test(over);
  const okFin = /actorId: pageActorId/.test(fin) && /indisponível/.test(fin)
    && !/getBankBalance\(\)\.catch\(\(\) => null\)/.test(fin);
  check('pj:dashboard-actor-correct-honest', okOver && okFin,
    'tabs PJ devem ler com o PAGE ACTOR (actorId) e exibir indisponibilidade honesta — catch→zero/vazio é regressão.');

  const bank = FE('api/bank.ts');
  check('pj:fe-statement-strict-option', /strictAuthErrors/.test(bank),
    'getBankStatement deve manter a opção strictAuthErrors (PJ não converte 401/403 em vazio).');
}

// ── 10. BANK WRITERS proibidos no denominador PJ ──
{
  const files = [
    'core/companies/companies.service.ts',
    'core/companies/companies.routes.ts',
    'core/companies/company-publications.service.ts',
    'core/kyb-documents/kyb-request-submit.service.ts',
    'core/kyb-documents/kyb-document-submit.service.ts',
    'core/identity/fiscal-identity-kyb.service.ts',
  ];
  const forbidden = /INSERT INTO bank_ledger|INSERT INTO bank_transactions|INSERT INTO bank_accounts|createBankAccount|provisionWallet/;
  const bad = files.filter((f) => forbidden.test(BE(f)));
  surfaces.push(['pj:no-bank-writers', bad.length === 0 ? 'CLOSED_PJ' : 'FINANCIAL_HARD_STOP']);
  if (bad.length > 0) failures.push(`FINANCIAL_HARD_STOP: writer financeiro no denominador PJ: ${bad.join(', ')}`);
}

// ── 11. COERÊNCIA dev: script de higiene presente (PROVISIONAL ⇒ par vigiado) ──
{
  const ok = existsSync(join(process.cwd(), 'src/scripts/dev-clean-pj-residues.ts'));
  check('pj:dev-coherence-script', ok,
    'dev-clean-pj-residues.ts (dry-run/apply; órfãs fiscais, PROBE, PROVISIONAL-sem-par) deve existir.');
}

// ── 12. E2Es da jornada presentes ──
{
  const must = [
    'src/scripts/validate-pipeline-e2e-pj-birth-membership-readers-http.ts',
    'src/scripts/validate-pipeline-e2e-pj-kyb-founder-lifecycle-http.ts',
    'src/scripts/validate-pipeline-e2e-pj-human-to-company-end-to-end.ts',
    'src/scripts/helpers/pj-fiscal-cleanup.ts',
  ];
  const missing = must.filter((f) => !existsSync(join(process.cwd(), f)));
  check('pj:e2e-suite-present', missing.length === 0,
    `E2Es/helpers da jornada PJ ausentes: ${missing.join(', ')}`);
}

// ── 13. Dívidas conhecidas FORA do denominador PJ (explícitas, não aprovadas) ──
const KNOWN_OPEN_OUTSIDE_PJ = [
  'produtos/ofertas/venda/checkout (marketplace pós-fechamento)',
  'inventory residual (products/visible, reconciliation, reports F6)',
  'providers prod de storage/scanner (fail-closed NOT IMPLEMENTED — dev usa local/noop)',
  'estado needs_more_info/"Ajustes Solicitados" (decisão futura; MVP = rejected+reason)',
  'UI de edição cadastral pós-criação (PUT existe; superfície fina)',
  'convite cross-tenant / system actor institucional / FASE 6 / R2 (delegação)',
];
for (const k of KNOWN_OPEN_OUTSIDE_PJ) surfaces.push([k, 'KNOWN_OPEN_OUTSIDE_PJ']);

// ── Relatório ──
console.log('[pj-human-to-company] denominador da jornada PJ:');
for (const [s, c] of surfaces) console.log(`  - ${s}: ${c}`);
const count = (cls) => surfaces.filter(([, c]) => c === cls).length;
console.log(`CLOSED_PJ=${count('CLOSED_PJ')} KNOWN_OPEN_OUTSIDE_PJ=${count('KNOWN_OPEN_OUTSIDE_PJ')} FINANCIAL_HARD_STOP=${count('FINANCIAL_HARD_STOP')} FORBIDDEN_REGRESSION=${count('FORBIDDEN_REGRESSION')}`);
console.log('[pj-human-to-company] NOTA: NÃO declara marketplace/inventory/venda/money/FASE6/R2/produtos-serviços fechados.');

if (failures.length > 0) {
  console.error('GATE FAIL [pj-human-to-company]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [pj-human-to-company] — jornada PJ selada (nascimento atômico sem cura · membership readers · KYB founder→review humano · ativação writer único · publicação KYB-gated · dashboard honesto · zero Bank writer).');
