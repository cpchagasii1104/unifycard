#!/usr/bin/env node
// Gate estrutural — F-C1-HUMAN-JOURNEY-END-TO-END-CLOSURE
// Sela a jornada humana C1 (cadastro → login → sessão → perfil → gender → profissional →
// learning → interests → agenda → Home → reabertura → isolamento) contra regressões:
//   - gender: vocabulário soberano de 5 valores em contracts + migration + writers/readers;
//   - /identity/me: sem fabricação de completude (cadeia quebrada = 409 observável);
//   - trilhos C1 (professional/learning/interest): actor guarded server-side;
//   - agenda: weekly-template com canRepresentActor antes de materializar;
//   - Home reads: erro estrutural NUNCA vira zero/empty/null falso em 200 (backend e frontend);
//   - Bank writers PROIBIDOS dentro do caminho C1.
//
// Classificações: CLOSED_C1 / KNOWN_OPEN_OUTSIDE_C1 / FINANCIAL_HARD_STOP /
//                 FORBIDDEN_REGRESSION / NEW_UNCLASSIFIED.
// Este gate NÃO declara: PJ / marketplace / inventory / convite cross-tenant /
// system actor institucional / FASE 6 / R2 fechados.

import { readFileSync } from 'fs';
import { join } from 'path';

const BE = (p) => readFileSync(join(process.cwd(), 'src', p), 'utf8');
const FE = (p) => readFileSync(join(process.cwd(), '..', 'frontend', 'src', p), 'utf8');
const PKG = (p) => readFileSync(join(process.cwd(), '..', 'packages', p), 'utf8');
const MIG = (p) => readFileSync(join(process.cwd(), 'migrations', p), 'utf8');

const failures = [];
const surfaces = [];
const FIVE = ['male', 'female', 'non_binary', 'other', 'prefer_not_to_say'];

function check(surface, ok, failMsg) {
  surfaces.push([surface, ok ? 'CLOSED_C1' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push(`FORBIDDEN_REGRESSION: ${failMsg}`);
}

// ── 1. GENDER: contracts com 5 valores ──
{
  const src = PKG('contracts/src/vocabulary.ts');
  check('gender:contracts', FIVE.every((v) => src.includes(`'${v}'`)),
    'GENDER_VALUES (contracts) deve conter os 5 valores soberanos.');
}

// ── 2. GENDER: migration do CHECK 5-valores existe ──
{
  let ok = false;
  try {
    const src = MIG('20260611130000_expand_global_users_gender_vocabulary.sql');
    ok = src.includes('non_binary') && src.includes('prefer_not_to_say') && /chk_global_users_gender/.test(src);
  } catch { ok = false; }
  check('gender:migration-check', ok, 'migration 20260611130000 (CHECK 5 valores) ausente/alterada.');
}

// ── 3. GENDER: writer canônico valida via isGender (não 3-literal) ──
{
  const src = BE('core/identity/identity.service.ts');
  const m = src.slice(src.indexOf('setUserGenderIfAbsent'));
  check('gender:writer-canonico', /isGender\(/.test(m.slice(0, 600)) && /WHERE global_user_id = \$1 AND gender IS NULL/.test(m),
    'setUserGenderIfAbsent deve validar via isGender (5 valores) e manter set-once (WHERE gender IS NULL).');
}

// ── 4. GENDER: extração no profile.service via isGender + blob stripado ──
{
  const src = BE('core/profile/profile.service.ts');
  const ok = /if \(isGender\(g\)\) genderToSave = g;/.test(src)
    && /delete \(metadataWithoutImmutables as any\)\.gender;/.test(src)
    && !/g === 'male' \|\| g === 'female'/.test(src);
  check('gender:profile-extracao', ok,
    'upsertProfile deve extrair gender via isGender (5) e continuar stripando o blob.');
}

// ── 5. GENDER: completude (hasGender) via isGender no core ──
{
  const src = BE('core/core.service.ts');
  check('gender:identity-status', /const hasGender = isGender\(gender\);/.test(src),
    'identity_status (core.service) deve aceitar os 5 valores via isGender.');
}

// ── 6. /identity/me: sem fabricação de completude ──
{
  const src = BE('core/identity/identity.routes.ts');
  const ok = src.includes('IDENTITY_CHAIN_INCOMPLETE')
    && !src.includes('Primeiro acesso detectado')
    && !/reputation: undefined,\s*\n\s*wallet: undefined/.test(src);
  check('identity-me:sem-fabricacao', ok,
    'GET /identity/me: cadeia quebrada deve ser 409 IDENTITY_CHAIN_INCOMPLETE, nunca perfil parcial fabricado em 200.');
}

// ── 7. Trilhos C1: actor guarded server-side (DECISION-0113) ──
for (const [name, file] of [
  ['professional', 'core/profile/professional-c1/professional-c1.service.ts'],
  ['learning', 'core/profile/learning-c1/learning-c1.service.ts'],
  ['interest', 'core/profile/interest-c1/interest-c1.service.ts'],
]) {
  const src = BE(file);
  check(`c1:${name}-actor-guarded`, /canRepresentActor\(/.test(src),
    `${file} deve provar canRepresentActor antes de ler/escrever (DECISION-0113).`);
}

// ── 8. Agenda: weekly-template com prova de representação antes de materializar ──
{
  const src = BE('core/availability/unified-availability.routes.ts');
  const ok = src.includes('WEEKLY_TEMPLATE_ACTOR_NOT_REPRESENTABLE')
    && src.includes('AVAILABILITY_NOT_REPRESENTABLE');
  check('agenda:weekly-template-guard', ok,
    'weekly-template e listagem de availability devem manter os gates fail-closed de representação.');
}

// ── 9. Home reads: catch NUNCA devolve zero/empty/null falso em 200 ──
{
  const src = BE('core/unifybank/bank-http.routes.ts');
  const bal = src.slice(src.indexOf("'/balance'"), src.indexOf("'/balance'") + 6000);
  const cat = bal.slice(bal.lastIndexOf('} catch'));
  check('home:bank-balance-catch', /status\(500\)/.test(cat) && /BANK_BALANCE_UNAVAILABLE/.test(cat) && !/balanceCents: 0/.test(cat),
    'catch de GET /bank/balance deve ser 500 BANK_BALANCE_UNAVAILABLE, nunca 200 balanceCents:0.');
}
{
  const src = BE('core/unifybank/transparency.routes.ts');
  check('home:bank-statement-catch', /BANK_STATEMENT_UNAVAILABLE/.test(src) && !/NUNCA retornar 500/.test(src),
    'catch de GET /bank/statement deve ser 500 BANK_STATEMENT_UNAVAILABLE, nunca 200 entries:[].');
  check('home:regional-fund-catch', /REGIONAL_FUND_UNAVAILABLE/.test(src),
    'catch de GET /bank/regional-fund deve ser 500 REGIONAL_FUND_UNAVAILABLE.');
}

// ── 10. Frontend: cliente não fabrica verdade financeira ──
{
  const src = FE('api/bank.ts');
  const fn = src.slice(src.indexOf('export async function getBankBalance'), src.indexOf('export async function getBankBalance') + 1200);
  check('home:fe-bank-no-fabrication', !/balanceCents: 0/.test(fn),
    'frontend getBankBalance não pode fabricar {balanceCents:0} em erro/401/403.');
}
{
  const src = FE('components/home/DashboardHome.tsx');
  const ok = /balanceToShow === null \? '—'/.test(src)
    && /regionalFundCents === null \? '—'/.test(src)
    && /Extrato indisponível/.test(src);
  check('home:fe-null-honesto', ok,
    'DashboardHome deve exibir "—"/indisponível para null (erro), nunca R$ 0,00/lista vazia falsos.');
}

// ── 11. Frontend: trilhos C1 sem blob/legado ──
{
  const profApi = FE('api/professionalC1.ts');
  const learnApi = FE('api/learningC1.ts');
  const intApi = FE('api/interestC1.ts');
  const prof = FE('components/ProfileProfessional.tsx');
  const learn = FE('components/ProfileLearning.tsx');
  const phys = FE('components/ProfilePhysical.tsx');
  const ok = /\/profile\/professional\/c1/.test(profApi) && /\/profile\/learning\/c1/.test(learnApi)
    && /\/profile\/interest\/c1/.test(intApi)
    && /professionalC1/.test(prof) && /learningC1|learning\/c1/.test(learn) && /interestC1/.test(phys)
    && !/metadata\.learnings/.test(learn) && !/metadata\.interests/.test(phys)
    && !/localStorage/.test(prof) && !/localStorage/.test(learn);
  check('c1:fe-trilhos-canonicos', ok,
    'frontends professional/learning/interest devem usar os clients C1 (rotas /profile/*/c1), sem blob metadata.* e sem localStorage como verdade.');
}

// ── 12. Bank writers PROIBIDOS no caminho C1 (register/profile/identity) ──
{
  const auth = BE('core/auth/auth.service.ts');
  const prof = BE('core/profile/profile.service.ts');
  const idr = BE('core/identity/identity.routes.ts');
  const forbidden = /INSERT INTO bank_ledger|INSERT INTO bank_transactions|INSERT INTO bank_accounts|createBankAccount|provisionWallet/;
  const ok = !forbidden.test(auth) && !forbidden.test(prof) && !forbidden.test(idr);
  surfaces.push(['c1:no-bank-writers', ok ? 'CLOSED_C1' : 'FINANCIAL_HARD_STOP']);
  if (!ok) failures.push('FINANCIAL_HARD_STOP: caminho C1 (auth/profile/identity) contém writer financeiro — PROIBIDO.');
}

// ── 13. Dívidas conhecidas FORA do denominador C1 (não aprovadas, só explícitas) ──
const KNOWN_OPEN_OUTSIDE_C1 = [
  'convite-cross-tenant (DT-C1-TENANT-INVITE-RESOLUTION-NO-SUBSTRATE)',
  'system-actor-institucional (DT-C1-INSTITUTIONAL-SYSTEM-ACTOR-PENDING)',
  'feed-unread visibility fantasma (DT-UNREAD-COUNTS-FEED-VISIBILITY-PHANTOM-COLUMN; null honesto)',
  'PJ (jornada própria — selada pelo gate audit-pj-human-to-company-closure; tabs catch->empty FECHADO lá)',
  'social-2.0 targeting gender enum 3-valores — superfície targeting, fora da jornada própria',
];
for (const k of KNOWN_OPEN_OUTSIDE_C1) surfaces.push([k, 'KNOWN_OPEN_OUTSIDE_C1']);

// ── Relatório ──
console.log('[c1-human-journey] denominador da jornada humana C1:');
for (const [s, c] of surfaces) console.log(`  - ${s}: ${c}`);
const count = (cls) => surfaces.filter(([, c]) => c === cls).length;
console.log(`CLOSED_C1=${count('CLOSED_C1')} KNOWN_OPEN_OUTSIDE_C1=${count('KNOWN_OPEN_OUTSIDE_C1')} FINANCIAL_HARD_STOP=${count('FINANCIAL_HARD_STOP')} FORBIDDEN_REGRESSION=${count('FORBIDDEN_REGRESSION')}`);
console.log('[c1-human-journey] NOTA: NÃO declara PJ/marketplace/inventory/convite/system-actor/FASE6/R2 fechados.');

if (failures.length > 0) {
  console.error('GATE FAIL [c1-human-journey]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [c1-human-journey] — jornada humana C1 selada (gender 5v · identity/me honesto · trilhos C1 guarded · agenda fail-closed · Home sem zero falso · zero Bank writer no C1).');
