#!/usr/bin/env node
// MUTATIONS HOSTIS — FISCAL 4D-2 (DECISION-0178). Prova que os guards MORDEM (não são teatro).
// Cada mutação: lê o arquivo real → aplica a mutação → roda o guard → espera FAIL → RESTAURA (finally).
// Controles BENIGNOS: arquivo intacto → guard PASSA. Ao fim, confirma resíduo-zero (hashes restaurados).
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const P = (rel) => join(ROOT, rel);
const GUARD_4D2 = 'scripts/audit-fiscal-economic-policy-composition.mjs';
const GUARD_4C3 = 'scripts/audit-fiscal-tax-catalog.mjs';
const GUARD_PROV = 'scripts/audit-fiscal-provision-engine.mjs';
const MIG = 'migrations/20260715120000_economic_policy_applies_to_composition.sql';
const TYPES = 'src/modules/economy/policy-engine/economic-policy.types.ts';
const REPO = 'src/modules/economy/policy-engine/economic-policy.repository.ts';
const SVC = 'src/modules/economy/fiscal-policy-composition/fiscal-economic-policy-composition.service.ts';
const CTX = 'src/modules/economy/fiscal-policy-composition/economic-policy-evaluation-context.ts';
const MANIFEST = 'src/core/governance/governed-vocabularies.manifest.ts';
const NOMEN = '../docs/01_normative/07_NOMENCLATURA_CANONICA.md';
const ENGINE = 'src/modules/economy/policy-engine/economic-policy-engine.service.ts';
const SPE = 'src/modules/services/service-payment-execution.service.ts';

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log('  OK   ' + label); } else { fail++; console.log('  FAIL ' + label); } };
const runGuard = (guard) => { try { execFileSync('node', [guard], { cwd: ROOT, stdio: 'pipe' }); return 0; } catch { return 1; } };

// mutação hostil: espera que o GUARD reprove (exit != 0)
const bites = (label, file, transform, guard = GUARD_4D2) => {
  const abs = P(file); const orig = readFileSync(abs);
  try {
    const mutated = transform(orig.toString());
    if (mutated === orig.toString()) { ok(label + ' [MUTAÇÃO NÃO APLICADA]', false); return; }
    writeFileSync(abs, mutated);
    ok(label, runGuard(guard) !== 0);
  } finally { writeFileSync(abs, orig); }
};
const benign = (label, guard = GUARD_4D2) => ok('[benigno] ' + label, runGuard(guard) === 0);

// ── snapshot de hashes p/ prova de resíduo-zero ──
const files = [MIG, TYPES, REPO, SVC, CTX, MANIFEST, NOMEN, ENGINE, SPE, GUARD_4D2, GUARD_4C3, GUARD_PROV];
const before = Object.fromEntries(files.map((f) => [f, createHash('sha256').update(readFileSync(P(f))).digest('hex')]));

console.log('== MUTATIONS HOSTIS FISCAL 4D-2 ==');
// 1. sexto valor no CHECK
bites('1· sexto valor no CHECK físico', MIG, (s) => s.replace("'commission_distributable'))", "'commission_distributable', 'gross_v2'))"));
// 2. remover um dos 5 valores
bites('2· remover valor do CHECK', MIG, (s) => s.replace("'gross', 'net', 'gross_transaction'", "'net', 'gross_transaction'"));
// 3. default gross reintroduzido
bites('3· default gross reintroduzido', MIG, (s) => s.replace('ALTER COLUMN applies_to DROP DEFAULT;', "ALTER COLUMN applies_to SET DEFAULT 'gross';"));
// 4. coluna nullable
bites('4· applies_to virou nullable', MIG, (s) => s.replace('ALTER TABLE economic_policy_lines ALTER COLUMN applies_to DROP DEFAULT;', 'ALTER TABLE economic_policy_lines ALTER COLUMN applies_to DROP DEFAULT;\nALTER TABLE economic_policy_lines ALTER COLUMN applies_to DROP NOT NULL;'));
// 5. backfill / UPDATE das linhas
bites('5· backfill UPDATE das linhas', MIG, (s) => s.replace('COMMIT;', "UPDATE economic_policy_lines SET applies_to='commission_gross' WHERE applies_to='gross';\nCOMMIT;"));
// 6. tax_reserve na migration de applies_to
bites('6· tax_reserve materializado na migration', MIG, (s) => s.replace('COMMIT;', "-- x\nINSERT INTO economic_policy_lines (policy_id, line_type, destination_type, applies_to, bps, condition_json, priority, metadata) SELECT id, 'tax_reserve', 'risk_reserve', 'commission_gross', 100, '{}', 0, '{}' FROM economic_policies LIMIT 0;\nCOMMIT;"));
// 7. writer fallback 'gross' revivido
bites('7· fallback gross revivido no writer', REPO, (s) => s.replace('assertWritableAppliesTo(input.appliesTo)', "input.appliesTo ?? 'gross'"));
// 8. writer sem validação
bites('8· writer grava sem assertWritableAppliesTo', REPO, (s) => s.replace('assertWritableAppliesTo(input.appliesTo)', 'input.appliesTo'));
// 9. gravável vira 4 (adiciona gross)
bites('9· gravável inclui gross', TYPES, (s) => s.replace("ECONOMIC_POLICY_APPLIES_TO_WRITABLE = [\n  'gross_transaction',", "ECONOMIC_POLICY_APPLIES_TO_WRITABLE = [\n  'gross',\n  'gross_transaction',"));
// 10. validador não rejeita legado
bites('10· validador não rejeita legado', TYPES, (s) => s.replace('ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY:', 'ECONOMIC_POLICY_APPLIES_TO_LEGACY_XXX:'));
// 11. manifesto sem o gravável
bites('11· manifesto sem ECONOMIC_POLICY_APPLIES_TO_WRITABLE', MANIFEST, (s) => s.replace("symbol: 'ECONOMIC_POLICY_APPLIES_TO_WRITABLE',", "symbol: 'ECONOMIC_POLICY_APPLIES_TO_WRITABLE_X',"));
// 12. manifesto registra gross|net como graváveis
bites('12· manifesto lista gross|net como graváveis', MANIFEST, (s) => s.replace("values: ['gross_transaction', 'commission_gross', 'commission_distributable'],\n    canonRef: 'DECISION-0178", "values: ['gross', 'net', 'gross_transaction', 'commission_gross', 'commission_distributable'],\n    canonRef: 'DECISION-0178"));
// 13. nomenclatura sem seção
bites('13· 07_NOMENCLATURA sem a seção applies_to', NOMEN, (s) => s.replace('economic_policy_lines.applies_to', 'economic_policy_lines.XXX'));
// 14. fiscal-provision chamado 2×
bites('14· fiscal-provision chamado 2×', SVC, (s) => s.replace('for (const w of outcome.warnings) warnings.push(w);', 'for (const w of outcome.warnings) warnings.push(w);\n    await fiscalProvisionService.provisionPlatformCommission({ tenantId: input.tenantId, sourceModule: input.sourceModule, sourceReferenceId: input.sourceReferenceId, taxpayerKind: "platform", platformRevenueStream: input.platformRevenueStream, commissionGrossCents: input.commissionGrossCents, conceptId: null, countryId: input.countryId, occurredAt: input.occurredAt, currency: input.currency, consumptionMode: input.fiscalConsumptionMode, contractVersion: 1 });'));
// 15. economic_policy_versions referenciada (código real, não comentário)
bites('15· economic_policy_versions referenciada no orquestrador', SVC, (s) => s.replace('const warnings: string[] = [];', 'const warnings: string[] = [];\n    const _epv = "economic_policy_versions";'));
// 16. Bank no orquestrador
bites('16· orquestrador toca Bank', SVC, (s) => s.replace("import { fiscalProvisionService }", "import { x } from '@modules/bank/bank-integration.service';\nimport { fiscalProvisionService }"));
// 17. tax_rules direto no orquestrador (código real)
bites('17· orquestrador lê tax_rules', SVC, (s) => s.replace('const warnings: string[] = [];', 'const warnings: string[] = [];\n    const _tr = "tax_rules";'));
// 18. negativo não fail-closed (todas as ocorrências)
bites('18· negativo monetário sem fail-closed', SVC, (s) => s.replaceAll('COMMISSION_DISTRIBUTABLE_NEGATIVE', 'COMMISSION_DISTRIBUTABLE_OK'));
// 19. zero não preservado
bites('19· zero deixou de ser status válido', SVC, (s) => s.replaceAll("status: 'zero'", "status: 'allocatable'").replaceAll("'zero'", "'zeroX'"));
// 20. missing não fail-closed (todas as ocorrências)
bites('20· missing obrigatório sem fail-closed', SVC, (s) => s.replaceAll('FISCAL_CONFIG_MISSING_FOR_DISTRIBUTABLE', 'FISCAL_CONFIG_OK').replaceAll('fiscal_missing_blocked', 'fiscal_ok'));
// 21. contexto não congelado
bites('21· contexto não congelado (imutabilidade)', CTX, (s) => s.replace('return Object.freeze({', 'return ({'));
// 22. arquivo B-CITY protegido mutado (token novo no engine)
bites('22· token de composição no engine protegido (B-CITY-1)', ENGINE, (s) => s.replace('export const economicPolicyEngineService', '// commission_distributable\nexport const economicPolicyEngineService'));
// 23. arquivo B-CITY protegido mutado (SPE)
bites('23· token no service-payment-execution protegido', SPE, (s) => '// commission_distributable\n' + s);
// 24. 4c-3 alterado sem atualizar o pin do provision (mutar 4c-3 → provision G1 morde)
bites('24· 4c-3 alterado quebra o pin do provision-engine', GUARD_4C3, (s) => s.replace('// Guard estrutural', '// mutado\n// Guard estrutural'), GUARD_PROV);
// 25. aplicador não reconhece o hash da 4d-2
bites('25· aplicador sem o hash fixo da 4d-2', 'scripts/apply-fiscal-4d1-migrations.mjs', (s) => s.replace("sha256: 'd52e39e13b30033b630e0fbbb619fec5d6af78872d82759bf89f9d7abaee6c97'", "sha256: 'deadbeef13b30033b630e0fbbb619fec5d6af78872d82759bf89f9d7abaee6c97'"));

// ── controles BENIGNOS ──
benign('4d-2 guard passa no material real');
benign('4c-3 guard passa no material real', GUARD_4C3);
benign('provision-engine guard passa no material real', GUARD_PROV);

// ── prova de resíduo-zero: hashes restaurados ──
let restored = true;
for (const f of files) { const h = createHash('sha256').update(readFileSync(P(f))).digest('hex'); if (h !== before[f]) { restored = false; console.log('  FAIL restauração: ' + f); } }
ok('Z· todos os arquivos restaurados byte-a-byte (resíduo-zero)', restored);

console.log(`\n== MUTATIONS: ${pass} OK, ${fail} FAIL (hostis mordem + benignos passam + restauração) ==`);
process.exit(fail ? 1 : 0);
