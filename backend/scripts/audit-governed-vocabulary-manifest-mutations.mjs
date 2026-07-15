#!/usr/bin/env node
// Harness REPRODUZÍVEL de mutation/prova do guard de vocabulário governado
// (audit-governed-vocabulary-manifest.mjs) — DECISION-0181, remediação Yala Veredito B (vetor 18).
//
// NÃO é um guard, NÃO entra no runner (run-regression-guards.mjs), NÃO ocupa a posição 186.
// É prova reproduzível: cada vetor tem assertion própria (esperado × obtido); resíduo byte-exato ZERO;
// fail-closed (exit != 0 em qualquer divergência). Sem rede, sem instalar dependências, sem tocar DB.
//
// Uso:  (cwd = backend/)   node scripts/audit-governed-vocabulary-manifest-mutations.mjs
//
// Categorias de prova:
//   • guard-estrutural  → escreve fixture temporário em src/, roda o guard real, espera BITE/PASS, remove.
//   • sandbox-arquivo   → muta um arquivo real (manifesto/fonte/consumidor) com restauração byte-exata.
//   • estado-vivo       → assertion direta sobre o estado vivo (hashes/pins/contagens/valores).

import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const GUARD = 'scripts/audit-governed-vocabulary-manifest.mjs';
const GUARD_4D2 = 'scripts/audit-fiscal-economic-policy-composition.mjs';
const RUNNER = 'scripts/run-regression-guards.mjs';
const SPE = 'src/modules/services/service-payment-execution.service.ts';
const BINT = 'src/modules/bank/bank-integration.service.ts';
const BENG = 'src/modules/bank/bank-split-engine.service.ts';
const MAN = 'src/core/governance/governed-vocabularies.manifest.ts';
const TYPES = 'src/modules/bank/bank-split.types.ts';
const NOM = '../docs/01_normative/07_NOMENCLATURA_CANONICA.md';
const FIX = 'src/__vocab_mutation_fixture__.ts';

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const runOK = (cmd) => { try { execSync(cmd, { stdio: 'pipe' }); return true; } catch { return false; } };
const runGuard = () => (runOK(`node ${GUARD}`) ? 'PASS' : 'BITE');
const run4d2 = () => (runOK(`node ${GUARD_4D2}`) ? 'PASS' : 'BITE');

const UNION = `'fee' | 'regional_fund' | 'reserve' | 'escrow' | 'revenue_share' | 'referral'`;
const ARR6 = `['fee', 'regional_fund', 'reserve', 'escrow', 'revenue_share', 'referral']`;
const IMP = `import type { BankSplitType } from './modules/bank/bank-split.types';`;
const OBJ6 = `{ fee: 'fee', regional_fund: 'regional_fund', reserve: 'reserve', escrow: 'escrow', revenue_share: 'revenue_share', referral: 'referral' }`;

// escreve fixture temporário, roda o guard, remove o fixture (sempre).
function onFixture(content) {
  try { writeFileSync(FIX, content); return runGuard(); }
  finally { if (existsSync(FIX)) rmSync(FIX); }
}
// muta um arquivo real com restauração byte-exata, roda um runner e devolve o resultado.
function onSandbox(path, transform, runner = runGuard) {
  const orig = readFileSync(path, 'utf8');
  const before = createHash('sha256').update(orig).digest('hex');
  let got;
  try { writeFileSync(path, transform(orig)); got = runner(); }
  finally { writeFileSync(path, orig); }
  const after = createHash('sha256').update(readFileSync(path, 'utf8')).digest('hex');
  if (after !== before) throw new Error(`RESTORE FALHOU para ${path}`);
  return got;
}

const guardSrc = readFileSync(GUARD, 'utf8');
const nomSrc = readFileSync(NOM, 'utf8');
const typesSrc = readFileSync(TYPES, 'utf8');
const manSrc = readFileSync(MAN, 'utf8');
// pin vivo de SPE dentro do guard 4d-2 + hash vivo da SPE
const g4d2 = readFileSync(GUARD_4D2, 'utf8');
const spePin = (g4d2.match(/\[F\.SPE\]:\s*'([0-9a-f]{64})'/) || [])[1];
const bcityPin = (g4d2.match(/\[F\.GUARD_BCITY\]:\s*'([0-9a-f]{64})'/) || [])[1];
const speLive = sha(SPE);
// byte-intactez vs HEAD pela própria comparação do git (imune a normalização CRLF↔LF do blob).
const gitIntact = (path) => (runOK(`git diff --quiet HEAD -- ${path}`) ? 'INTACT' : 'CHANGED');
const runnerCmds = (readFileSync(RUNNER, 'utf8').match(/^\s*"(node|npx|pnpm|npm|tsx) /gm) || []).length;

// ── VETORES HOSTIS (42): cada um deve MORDER (ou o estado protegido deve estar correto) ──
const hostile = [
  // 1-11: declaração paralela + tentativa de bypass → deve MORDER (bypass não perdoa).
  { n: 1, name: 'comentário contendo BankSplitType + union', got: () => onFixture(`// BankSplitType\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 2, name: 'string contendo BankSplitType + union', got: () => onFixture(`const s = "BankSplitType";\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 3, name: 'template string com o nome + union', got: () => onFixture('const s = `BankSplitType`;\n' + `type _P = ${UNION};\n`), exp: 'BITE' },
  { n: 4, name: 'import não usado + union', got: () => onFixture(`${IMP}\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 5, name: 'alias do import + union', got: () => onFixture(`import type { BankSplitType as _X } from './modules/bank/bank-split.types';\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 6, name: 'declaração local homônima (union)', got: () => onFixture(`type BankSplitType = ${UNION};\n`), exp: 'BITE' },
  { n: 7, name: 'namespace falso + union', got: () => onFixture(`namespace _N { export type BankSplitType = ${UNION}; }\n`), exp: 'BITE' },
  { n: 8, name: 'cast as BankSplitType + union', got: () => onFixture(`${IMP}\nconst x = ('fee' as BankSplitType);\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 9, name: 'type assertion + union', got: () => onFixture(`${IMP}\nconst x = <BankSplitType>('fee');\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 10, name: 're-export intermediário + union', got: () => onFixture(`export type { BankSplitType } from './modules/bank/bank-split.types';\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 11, name: 'wrapper local + union', got: () => onFixture(`${IMP}\ntype _Wrap<T> = T;\ntype _P = _Wrap<${UNION}>;\n`), exp: 'BITE' },
  // 12-19: construtos paralelos diretos.
  { n: 12, name: 'union paralela com import canônico', got: () => onFixture(`${IMP}\ntype _P = ${UNION};\n`), exp: 'BITE' },
  { n: 13, name: 'enum paralelo', got: () => onFixture(`enum _E { A='fee', B='regional_fund', C='reserve', D='escrow', E='revenue_share', F='referral' }\n`), exp: 'BITE' },
  { n: 14, name: 'tuple paralelo', got: () => onFixture(`type _T = ['fee','regional_fund','reserve','escrow','revenue_share','referral'];\n`), exp: 'BITE' },
  { n: 15, name: 'array paralelo', got: () => onFixture(`const _A = ${ARR6};\n`), exp: 'BITE' },
  { n: 16, name: 'Set paralelo', got: () => onFixture(`const _S = new Set(${ARR6});\n`), exp: 'BITE' },
  { n: 17, name: 'schema paralelo (array de tokens)', got: () => onFixture(`const _schema = { enum: ${ARR6} };\n`), exp: 'BITE' },
  { n: 18, name: 'registry object-keyed (vetor 18)', got: () => onFixture(`const _R = ${OBJ6};\n`), exp: 'BITE' },
  { n: 19, name: 'segunda lista em terceiro arquivo', got: () => onFixture(`export const _SPLITS = ${ARR6} as const;\n`), exp: 'BITE' },
  // 20-24: contrato source×derived (sandbox no manifesto / na fonte).
  { n: 20, name: 'sourceFile incorreto', exp: 'BITE',
    got: () => onSandbox(MAN, (c) => c.replace(`sourceFile: 'src/modules/bank/bank-split.types.ts',\n    sourceKind: 'ts-const-array',\n    symbol: 'BANK_SPLIT_TYPES',\n    derivedTypeSymbol: 'BankSplitType',`,
      `sourceFile: 'src/modules/bank/bank-account.types.ts',\n    sourceKind: 'ts-const-array',\n    symbol: 'BANK_SPLIT_TYPES',\n    derivedTypeSymbol: 'BankSplitType',`)) },
  { n: 21, name: 'sourceSymbol incorreto', exp: 'BITE',
    got: () => onSandbox(MAN, (c) => c.replace(`symbol: 'BANK_SPLIT_TYPES',\n    derivedTypeSymbol: 'BankSplitType',`, `symbol: 'BANK_SPLIT_TYPES_WRONG',\n    derivedTypeSymbol: 'BankSplitType',`)) },
  { n: 22, name: 'derivedTypeSymbol incorreto', exp: 'BITE',
    got: () => onSandbox(MAN, (c) => c.replace(`derivedTypeSymbol: 'BankSplitType',`, `derivedTypeSymbol: 'BankSplitTypeWrong',`)) },
  { n: 23, name: 'tipo derivado NÃO derivado do tuple', exp: 'BITE',
    got: () => onSandbox(TYPES, (c) => c.replace('export type BankSplitType = (typeof BANK_SPLIT_TYPES)[number];', 'export type BankSplitType = string;')) },
  { n: 24, name: 'tipo derivado de segunda lista', exp: 'BITE',
    got: () => onSandbox(TYPES, (c) => c.replace('export type BankSplitType = (typeof BANK_SPLIT_TYPES)[number];', 'const OTHER = [\'x\'] as const;\nexport type BankSplitType = (typeof OTHER)[number];')) },
  // 25-28: revival das 4 unions nos arquivos reais.
  { n: 25, name: 'revival union ResolvedSplitDestination (SPE)', exp: 'BITE',
    got: () => onSandbox(SPE, (c) => c.replace('  splitType: BankSplitType;', `  splitType: ${UNION};`)) },
  { n: 26, name: 'revival union LocalSplitRecipient (SPE)', exp: 'BITE',
    got: () => onSandbox(SPE, (c) => c.replace('      splitType?: BankSplitType;', `      splitType?: ${UNION};`)) },
  { n: 27, name: 'revival union splitRecipients (bank-integration)', exp: 'BITE',
    got: () => onSandbox(BINT, (c) => c.replace('        splitType?: BankSplitType;', `        splitType?: ${UNION};`)) },
  { n: 28, name: 'revival union splitLines (bank-integration)', exp: 'BITE',
    got: () => onSandbox(BINT, (c) => c.replace('      splitType?: BankSplitType;', `      splitType?: ${UNION};`)) },
  // 29-33: integridade do guard/runner (estado vivo).
  { n: 29, name: 'sem allowlist para bank_splits.split_type', exp: 'ABSENT',
    got: () => /PARALLEL_ALLOWLIST\s*=\s*\{[^}]*bank_splits\.split_type/.test(guardSrc) ? 'PRESENT' : 'ABSENT' },
  { n: 30, name: 'limiar n-1 preservado (sem redução)', exp: 'N-1',
    got: () => guardSrc.includes('e.values.length - 1') && !/values\.length\s*-\s*[2-9]/.test(guardSrc) ? 'N-1' : 'REDUZIDO' },
  { n: 31, name: 'sem import runtime do tuple nos consumidores', exp: 'NONE',
    got: () => [SPE, BINT, BENG].some((p) => /import\s*\{[^}]*BANK_SPLIT_TYPES/.test(readFileSync(p, 'utf8'))) ? 'FOUND' : 'NONE' },
  { n: 32, name: 'alterar 1 das 28 entradas antigas → morde (anti-drift)', exp: 'BITE',
    got: () => onSandbox(MAN, (c) => c.replace("values: ['gratuito', 'pago', 'contribuicao_opcional'],", "values: ['gratuito', 'pago', 'contribuicao_opcional', 'valor_fantasma'],")) },
  { n: 33, name: 'runner sem comando 186 (=185)', exp: '185', got: () => String(runnerCmds) },
  // 34-42: proteções materiais (estado vivo).
  { n: 34, name: 'SPE sem alteração funcional (hash == pin)', exp: spePin, got: () => speLive },
  { n: 35, name: 'Bank Integration byte-intacto vs HEAD', exp: 'INTACT', got: () => gitIntact(BINT) },
  { n: 36, name: 'Bank Split Engine byte-intacto vs HEAD', exp: 'INTACT', got: () => gitIntact(BENG) },
  { n: 37, name: 'repin da SPE presente no guard 4d-2', exp: 'PRESENT', got: () => spePin ? 'PRESENT' : 'ABSENT' },
  { n: 38, name: 'repin correto (guard 4d-2 verde)', exp: 'PASS', got: () => run4d2() },
  { n: 39, name: 'B-CITY byte-intacto e pino coerente', exp: 'd359f18db345137e91d06db1276475250f97e18c1bd4498ad5fab2cbc60387f9',
    got: () => { const h = sha('scripts/audit-bank-city-curitiba-foundation.mjs'); return h === bcityPin ? h : `MISMATCH(${h}≠pin ${bcityPin})`; } },
  { n: 40, name: 'platform NÃO é split_type (tuple + fence §4.55)', exp: 'ABSENT',
    got: () => {
      const tuple = typesSrc.match(/BANK_SPLIT_TYPES = \[[\s\S]*?\]/)[0];
      const s455 = (nomSrc.match(/### 4\.55[\s\S]*?### 4\.56/) || [''])[0];
      const fence = (s455.match(/```sql[\s\S]*?```/) || [''])[0];
      return /'platform'/.test(tuple) || /'platform'/.test(fence) ? 'PRESENT' : 'ABSENT';
    } },
  { n: 41, name: 'escrow presente (fonte + nomenclatura)', exp: 'PRESENT',
    got: () => /'escrow'/.test(typesSrc.match(/BANK_SPLIT_TYPES = \[[\s\S]*?\]/)[0]) && /'escrow'/.test(nomSrc) ? 'PRESENT' : 'ABSENT' },
  { n: 42, name: 'tax_reserve ausente (fonte + manifesto values)', exp: 'ABSENT',
    got: () => /'tax_reserve'/.test(typesSrc.match(/BANK_SPLIT_TYPES = \[[\s\S]*?\]/)[0]) || /values:\s*\[[^\]]*'tax_reserve'/.test(manSrc) ? 'PRESENT' : 'ABSENT' },
];

// ── CONTROLES BENIGNOS (8 obrigatórios) — NÃO podem morder ──
const benign = [
  { n: 1, name: 'import type direto (sem declaração paralela)', exp: 'PASS', got: () => onFixture(`${IMP}\nexport const x: BankSplitType = 'fee';\n`) },
  { n: 2, name: 'uso tipológico real', exp: 'PASS', got: () => onFixture(`${IMP}\nexport function f(s: BankSplitType): BankSplitType { return s; }\n`) },
  { n: 3, name: 'valores escalares individuais', exp: 'PASS', got: () => onFixture(`const a='fee';const b='regional_fund';const c='reserve';const d='escrow';const e='revenue_share';\n`) },
  { n: 4, name: 'cinco valores distribuídos na SPE (estado vivo)', exp: 'PASS', got: () => runGuard() },
  { n: 5, name: 'cinco valores distribuídos no Bank Split Engine (estado vivo)', exp: 'PASS', got: () => runGuard() },
  { n: 6, name: "targetType='platform'", exp: 'PASS', got: () => onFixture(`let targetType = 'other';\nif (true) targetType = 'platform';\nconst a='fee';const b='regional_fund';const c='reserve';const d='escrow';const e='revenue_share';\nexport { targetType, a, b, c, d, e };\n`) },
  { n: 7, name: 'comentário documental sem poder legitimador', exp: 'PASS', got: () => onFixture(`// menciona fee regional_fund reserve escrow revenue_share referral em prosa\nexport const z = 1;\n`) },
  { n: 8, name: 'entrada antiga sem derivedTypeSymbol (estado vivo)', exp: 'PASS', got: () => runGuard() },
];

// ── CONTROLES COMPLEMENTARES ──
const extra = [
  { name: 'config map numérico (tokens só nas chaves)', exp: 'PASS', got: () => onFixture(`const _cfg = { fee:0.03, regional_fund:0.01, reserve:0.02, escrow:0, revenue_share:0.05, referral:0.01 };\n`) },
  { name: 'handler map (tokens só nas chaves)', exp: 'PASS', got: () => onFixture(`const h1=()=>{};const _h = { fee:h1, regional_fund:h1, reserve:h1, escrow:h1, revenue_share:h1, referral:h1 };\n`) },
  { name: 'Record<BankSplitType, number> (valores numéricos)', exp: 'PASS', got: () => onFixture(`${IMP}\nconst _r: Record<BankSplitType, number> = { fee:1, regional_fund:2, reserve:3, escrow:4, revenue_share:5, referral:6 };\n`) },
  { name: 'objetos distribuídos abaixo do limiar (não agregados)', exp: 'PASS', got: () => onFixture(`const a={v:'fee'};const b={v:'regional_fund'};const c={v:'reserve'};const d={v:'escrow'};const e={v:'revenue_share'};\n`) },
  { name: 'objeto com 2 valores (abaixo do limiar)', exp: 'PASS', got: () => onFixture(`const _o = { first:'fee', second:'regional_fund' };\n`) },
  { name: 'Object.freeze registry 6/6 → morde', exp: 'BITE', got: () => onFixture(`const _R = Object.freeze(${OBJ6});\n`) },
  { name: 'registry as-const nos valores → morde', exp: 'BITE', got: () => onFixture(`const _R = { fee:'fee' as const, regional_fund:'regional_fund', reserve:'reserve', escrow:'escrow', revenue_share:'revenue_share', referral:'referral' };\n`) },
];

function report(title, list) {
  let ok = 0;
  console.log(`\n=== ${title} ===`);
  for (const v of list) {
    let got;
    try { got = v.got(); } catch (e) { got = `ERROR:${e.message}`; }
    const pass = got === v.exp;
    if (pass) ok++;
    const tag = title.startsWith('HOSTIL') ? `HOSTIL ${String(v.n).padStart(2, '0')}` : title.startsWith('BENIGNO') ? `BENIGNO ${String(v.n).padStart(2, '0')}` : 'EXTRA';
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${tag}  ${v.name}  esperado=${v.exp} obtido=${got}`);
  }
  return ok;
}

// snapshot de integridade ANTES (resíduo-zero)
const guarded = [SPE, BINT, BENG, MAN, TYPES, GUARD, GUARD_4D2, 'scripts/audit-bank-city-curitiba-foundation.mjs'];
const preHash = Object.fromEntries(guarded.map((p) => [p, sha(p)]));

const okH = report('HOSTIL', hostile);
const okB = report('BENIGNO', benign);
const okE = report('COMPLEMENTAR', extra);

// resíduo-zero: nenhum arquivo protegido alterado + fixture removido
const residue = guarded.filter((p) => sha(p) !== preHash[p]);
const fixtureLeft = existsSync(FIX);

console.log('\n================ MATRIZ ================');
console.log(`HOSTIS:        ${okH}/${hostile.length}`);
console.log(`BENIGNOS:      ${okB}/${benign.length}`);
console.log(`COMPLEMENTARES:${okE}/${extra.length}`);
console.log(`RESÍDUO:       ${residue.length === 0 && !fixtureLeft ? 'ZERO' : `!! ${residue.join(',')} fixture=${fixtureLeft}`}`);

const allPass = okH === hostile.length && okB === benign.length && okE === extra.length && residue.length === 0 && !fixtureLeft;
console.log(allPass ? '\nGATE OK [vocab-mutations] — 42/42 hostis, 8/8 benignos, complementares verdes, resíduo ZERO.' : '\nGATE FAIL [vocab-mutations] — ver acima.');
process.exit(allPass ? 0 : 1);
