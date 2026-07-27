#!/usr/bin/env node
// audit-fiscal-economic-policy-composition.mjs — Guard dedicado FISCAL 4D-2 (DECISION-0178).
//
// Trava a EXTENSÃO GOVERNADA de economic_policy_lines.applies_to e a COMPOSIÇÃO fiscal × policy
// (comment-aware + liveness). Morde se:
//   V · vocabulário: CHECK físico ≠ 5; default DB não removido; coluna deixou de ser NOT NULL;
//       migration faz backfill/UPDATE; graváveis ≠ 3; legados gross|net não read-only; 6º valor;
//   W · writer: fallback TS 'gross' revivido; writer não valida via assertWritableAppliesTo;
//   G · governança: manifesto sem o gravável(3); 07_NOMENCLATURA sem a seção; distinção 5/3/2;
//   C · composição: orquestrador read-only não-SSOT, sem Bank, fiscal-provision 1×, policy version =
//       economic_policies.id, contexto imutável, sem economic_policy_versions, sem tax_rules direto;
//   R · caller: nenhum caller monetário vivo liga o orquestrador; sem rota/app.builder monetário;
//   B · fronteira: 3 arquivos B-CITY byte-intactos; 4c-3 hash reconciliado; provision-engine com pin
//       novo; tax_reserve fora de applies_to; 4e inexistente; invoicing intocado.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const exists = (p) => existsSync(resolve(ROOT, p));
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (m) => fails.push(m);

const AUTHORIZED_4D2_MIGRATION = '20260715120000_economic_policy_applies_to_composition.sql';
const F = {
  MIG: 'migrations/' + AUTHORIZED_4D2_MIGRATION,
  TYPES: 'src/modules/economy/policy-engine/economic-policy.types.ts',
  REPO: 'src/modules/economy/policy-engine/economic-policy.repository.ts',
  CTX: 'src/modules/economy/fiscal-policy-composition/economic-policy-evaluation-context.ts',
  SVC: 'src/modules/economy/fiscal-policy-composition/fiscal-economic-policy-composition.service.ts',
  MANIFEST: 'src/core/governance/governed-vocabularies.manifest.ts',
  NOMEN: '../docs/01_normative/07_NOMENCLATURA_CANONICA.md',
  GUARD_4C3: 'scripts/audit-fiscal-tax-catalog.mjs',
  GUARD_PROV: 'scripts/audit-fiscal-provision-engine.mjs',
  APPLY: 'scripts/apply-fiscal-4d1-migrations.mjs',
  RUNNER: 'scripts/run-regression-guards.mjs',
  ENGINE: 'src/modules/economy/policy-engine/economic-policy-engine.service.ts',
  SPE: 'src/modules/services/service-payment-execution.service.ts',
  GUARD_BCITY: 'scripts/audit-bank-city-curitiba-foundation.mjs',
};
const raw = {};
for (const [k, p] of Object.entries(F)) raw[k] = exists(p) ? read(p) : null;
const migS = raw.MIG != null ? stripSql(raw.MIG) : null;
const typesS = raw.TYPES != null ? stripTs(raw.TYPES) : null;
const repoS = raw.REPO != null ? stripTs(raw.REPO) : null;
const ctxS = raw.CTX != null ? stripTs(raw.CTX) : null;
const svcS = raw.SVC != null ? stripTs(raw.SVC) : null;

// ── V · vocabulário físico (migration) ──
if (migS == null) note('V0: migration 4d-2 ausente');
else {
  if (!/ALTER TABLE economic_policy_lines ALTER COLUMN applies_to DROP DEFAULT/.test(migS)) note('V1: migration não remove o DEFAULT gross (D2)');
  if (!/CHECK \(applies_to IN \('gross', 'net', 'gross_transaction', 'commission_gross', 'commission_distributable'\)\)/.test(migS)) note('V2: CHECK físico de 5 valores exato ausente (D1)');
  if (/ALTER COLUMN applies_to (SET NOT NULL|DROP NOT NULL)|ALTER COLUMN applies_to SET DEFAULT/.test(migS)) note('V3: migration mexeu em nullability ou reintroduziu default (D2/D12)');
  if (/(UPDATE|DELETE FROM|INSERT INTO) economic_policy_lines/.test(migS)) note('V4: migration toca LINHAS (backfill/seed/UPDATE — histórico congelado D3/D12)');
  if (/CREATE TABLE|CREATE FUNCTION|CREATE TRIGGER/.test(migS)) note('V5: migration cria tabela/função/trigger nova (D12 proíbe)');
  if (/NOT VALID/.test(migS)) note('V6: CHECK criado NOT VALID (deve validar imediatamente — D12)');
  if (/'tax_reserve'/.test(migS)) note('V7: tax_reserve na migration de applies_to (é 4e)');
}

// ── V · tipos: físico(5) × gravável(3) × legado(2) ──
if (typesS == null) note('V8: types ausente');
else {
  if (!/ECONOMIC_POLICY_APPLIES_TO_PHYSICAL = \[\s*'gross',\s*'net',\s*'gross_transaction',\s*'commission_gross',\s*'commission_distributable',\s*\] as const/.test(typesS))
    note('V9: ECONOMIC_POLICY_APPLIES_TO_PHYSICAL (5) divergiu/sumiu');
  if (!/ECONOMIC_POLICY_APPLIES_TO_WRITABLE = \[\s*'gross_transaction',\s*'commission_gross',\s*'commission_distributable',\s*\] as const/.test(typesS))
    note('V10: ECONOMIC_POLICY_APPLIES_TO_WRITABLE (3) divergiu/sumiu');
  if (!/ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY = \['gross', 'net'\] as const/.test(typesS))
    note('V11: ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY (2) divergiu/sumiu');
  // validador: fail-closed em ausência e em legado (não cast cego)
  if (!/export function assertWritableAppliesTo\(/.test(typesS)) note('V12: assertWritableAppliesTo ausente (narrowing governado)');
  if (!/ECONOMIC_POLICY_APPLIES_TO_REQUIRED/.test(typesS)) note('V13: ausência de applies_to não falha fechado (REQUIRED)');
  if (!/ECONOMIC_POLICY_APPLIES_TO_LEGACY_READONLY:/.test(typesS)) note('V14: legado gross|net não é rejeitado como read-only pelo validador');
  if (/as EconomicPolicyAppliesToWritable\b(?![^]*return value as EconomicPolicyAppliesToWritable)/.test('')) { /* placeholder */ }
}

// ── W · writer: fallback removido + validação viva ──
if (repoS == null) note('W0: repository ausente');
else {
  if (/input\.appliesTo \?\? 'gross'/.test(repoS)) note('W1: fallback TS \'gross\' REVIVIDO no writer (D2)');
  if (/\?\? 'gross'|\?\? 'net'|\|\| 'gross'|\|\| 'net'/.test(repoS)) note('W2: fallback legado gross/net no writer');
  if (!/assertWritableAppliesTo\(input\.appliesTo\)/.test(repoS)) note('W3: writer não valida via assertWritableAppliesTo (grava base sem governar)');
}

// ── G · governança: manifesto + nomenclatura, distinção 5/3/2 ──
if (raw.MANIFEST == null || !/symbol: 'ECONOMIC_POLICY_APPLIES_TO_WRITABLE'/.test(stripTs(raw.MANIFEST)))
  note('G1: manifesto sem o gravável(3) ECONOMIC_POLICY_APPLIES_TO_WRITABLE (D15)');
if (raw.MANIFEST != null) {
  const mn = stripTs(raw.MANIFEST);
  const entry = (mn.match(/name: 'economic_policy_lines\.applies_to \(writable\)'[\s\S]*?canonRef:[\s\S]*?\},/) || [''])[0];
  if (!/values: \['gross_transaction', 'commission_gross', 'commission_distributable'\]/.test(entry))
    note('G2: entrada do manifesto não lista EXATAMENTE os 3 graváveis');
  if (/values: \[[^\]]*'gross'[^\]]*'net'/.test(entry)) note('G3: manifesto registrou gross|net como graváveis (proibido)');
}
if (raw.NOMEN == null) note('G4: 07_NOMENCLATURA ausente');
else {
  const nm = raw.NOMEN;
  if (!/economic_policy_lines\.applies_to/.test(nm)) note('G5: 07_NOMENCLATURA sem a seção de applies_to (D15)');
  for (const v of ['gross_transaction', 'commission_gross', 'commission_distributable']) if (!nm.includes(v)) note(`G6: 07_NOMENCLATURA não documenta o gravável ${v}`);
  if (!/DECISION-0178/.test(nm)) note('G7: 07_NOMENCLATURA não referencia DECISION-0178');
  if (!/READ-ONLY|read-only|legad/i.test(nm)) note('G8: 07_NOMENCLATURA não distingue legado read-only');
}

// ── C · composição: orquestrador read-only, fiscal 1×, policy version, contexto uniforme ──
if (ctxS == null) note('C0: contexto de avaliação ausente');
else {
  if (!/Object\.freeze\(/.test(ctxS)) note('C1: EconomicPolicyEvaluationContext não é congelado (imutável)');
  if (!/economicPolicyId/.test(ctxS)) note('C2: contexto sem economicPolicyId');
  if (/economic_policy_versions/.test(ctxS)) note('C3: contexto referencia economic_policy_versions (NÃO existe)');
  if (!/selectAppliesToBaseCents/.test(ctxS)) note('C4: seleção fechada de base ausente');
  if (!/commission_distributable[\s\S]{0,200}fiscal_missing/.test(ctxS)) note('C5: distributable com fiscal ausente não é discriminado (vira zero/gross?)');
}
if (svcS == null) note('C6: orquestrador ausente');
else {
  // fiscal-provision chamado UMA vez (uma única invocação textual do método)
  const calls = (svcS.match(/fiscalProvisionService\.provisionPlatformCommission\(/g) || []).length;
  if (calls !== 1) note(`C7: fiscal-provision chamado ${calls}× (deve ser exatamente 1× por avaliação)`);
  if (!/resolved\.policy\.id/.test(svcS)) note('C8: policy version não é economic_policies.id (resolved.policy.id)');
  if (/economic_policy_versions/.test(svcS)) note('C9: orquestrador referencia economic_policy_versions (NÃO existe)');
  // zero Bank
  if (/bank_accounts|bank_transactions|bank_ledger|bank_splits|@modules\/bank|createTransactionWith|bankSplitEngine/.test(svcS + ctxS))
    note('C10: composição toca Bank (proibido — 4d-2 zero Bank)');
  // policy engine não lê tax_rules; orquestrador não lê tax_rules diretamente
  if (/tax_rules|taxCatalogRepository/.test(svcS + ctxS)) note('C11: composição lê tax_rules diretamente (fiscal é do motor, não da policy)');
  if (/roundingMode|rounding_mode/.test(svcS + ctxS)) note('C12: composição escolhe/recalcula rounding (proibido)');
  if (/invoice/i.test(svcS + ctxS)) note('C13: composição usa invoice (proibido)');
  // negativo/zero/missing governados
  if (!/COMMISSION_DISTRIBUTABLE_NEGATIVE/.test(svcS)) note('C14: negativo monetário não falha fechado (D9)');
  if (!/status: 'zero'/.test(svcS)) note('C15: zero não é resultado válido preservado (D10)');
  if (!/FISCAL_CONFIG_MISSING_FOR_DISTRIBUTABLE|fiscal_missing_blocked/.test(svcS)) note('C16: missing obrigatório para distributable não é fail-closed (D11)');
  if (/Math\.max\(0|Math\.min\([^)]*commission/.test(svcS)) note('C17: clamp silencioso de negativo (D9 proíbe)');
}

// ── R · nenhum caller monetário vivo liga o orquestrador ──
const MONETARY = ['src/modules/services/service-payment-execution.service.ts', 'src/modules/marketplace/payment-execution.service.ts', 'src/modules/marketplace/unifycard.service.ts', 'src/modules/pdv/pdv.service.ts', 'src/modules/bank/bank-integration.service.ts'];
for (const p of MONETARY) {
  if (exists(p) && /fiscalEconomicPolicyCompositionService|fiscal-policy-composition/.test(stripTs(read(p))))
    note(`R1: caller monetário vivo ${p} liga o orquestrador (proibido em 4d-2 — reachability é 4e)`);
}
if (raw.SVC != null && /fastify|FastifyPluginAsync|\.routes/.test(svcS)) note('R2: rota HTTP no orquestrador (evaluation read-only, sem rota)');
const appBuilder = exists('src/app.builder.ts') ? stripTs(read('src/app.builder.ts')) : '';
if (/fiscal-policy-composition/.test(appBuilder)) note('R3: orquestrador registrado no app.builder (reachability proibida)');

// ── B · fronteiras: 3 arquivos B-CITY byte-intactos; guards reconciliados ──
const BYTE_INTACT = {
  // RECONCILIAÇÃO AUTORIZADA PELA DIREÇÃO (2026-07-27, frente economic-policy FATIA 0).
  // O tripwire B1 disparou corretamente ao detectar a troca dos seletores territoriais do engine
  // (country/region/city TEXT livre → countryId/stateId/cityId governados pelo Location Core).
  // A executora PAROU e não se autorizou (feedback_executor_nao_se_autoriza) — correto.
  // A direção verificou em 1ª mão ANTES de reconciliar: (a) o diff é cirúrgico (só SELECTOR_FIELDS
  // + comentário); (b) a FRONTEIRA FISCAL que este guard realmente protege segue INTACTA — zero
  // ocorrência de commission_distributable/tax_reserve/fiscalEconomicPolicyCompositionService no
  // engine (o check B4 abaixo, defesa em profundidade, continua verde por conta própria).
  // B1 é tripwire de mudança, não a fronteira; a fronteira é B4. Hash abaixo = pós-FATIA 0.
  [F.ENGINE]: 'fbc3a108979124543499ed47f6b678645f50d0a27d3376db9e1e39d756206ee3',
  [F.SPE]: 'bb3f3fe6b494aac69a9642881f1d929aae9e0787e4f131fb30f88c069ff21050',
  [F.GUARD_BCITY]: 'd359f18db345137e91d06db1276475250f97e18c1bd4498ad5fab2cbc60387f9',
};
for (const [p, expected] of Object.entries(BYTE_INTACT)) {
  const h = createHash('sha256').update(read(p)).digest('hex');
  if (h !== expected) note(`B1: arquivo protegido B-CITY ${p} NÃO está byte-intacto (hash ${h}) — token novo não pode entrar aqui; se necessário, STOP e volte ao GATE`);
}
// token fiscal novo NÃO aparece nos 2 arquivos TS protegidos (defesa em profundidade além do hash)
for (const p of [F.ENGINE, F.SPE]) {
  if (/commission_distributable|tax_reserve|fiscalEconomicPolicyCompositionService/.test(stripTs(read(p))))
    note(`B2: token de composição fiscal apareceu no arquivo protegido ${p} (B-CITY-1)`);
}
// 4c-3 hash reconciliado bate com o pin do provision-engine
const h4c3 = createHash('sha256').update(read(F.GUARD_4C3)).digest('hex');
if (h4c3 !== '942142f3c49676e7ba651ee21e12516cf803a0e82b6da66526f3ace654953eaa')
  note(`B3: 4c-3 divergiu do hash reconciliado 4d-2 (${h4c3})`);
if (raw.GUARD_PROV == null || !raw.GUARD_PROV.includes('942142f3c49676e7ba651ee21e12516cf803a0e82b6da66526f3ace654953eaa'))
  note('B4: provision-engine não pina o hash reconciliado do 4c-3 (a inversão e o pin são indivisíveis)');
// aplicador reconhece a migration 4d-2 pelo hash fixo
if (raw.APPLY == null || !/sha256: 'd52e39e13b30033b630e0fbbb619fec5d6af78872d82759bf89f9d7abaee6c97'/.test(raw.APPLY))
  note('B5: aplicador seletivo não reconhece a migration 4d-2 pelo hash fixo');
const realMig = raw.MIG != null ? createHash('sha256').update(raw.MIG).digest('hex') : '';
if (realMig !== 'd52e39e13b30033b630e0fbbb619fec5d6af78872d82759bf89f9d7abaee6c97')
  note(`B6: migration 4d-2 divergiu do hash embutido (${realMig})`);
// 4e inexistente: nenhuma migration materializa tax_reserve/conta fiscal
for (const f of readdirSync(resolve(ROOT, 'migrations')).filter((x) => x.endsWith('.sql'))) {
  const src = stripSql(read('migrations/' + f));
  if (/line_type[\s\S]{0,120}'tax_reserve'/.test(src)) note(`B7: migrations/${f} materializa tax_reserve (é 4e — não aberta)`);
}
// runner wiring
if (raw.RUNNER == null || !raw.RUNNER.includes('audit-fiscal-economic-policy-composition.mjs'))
  note('B8: este guard está fora do runner');

if (fails.length) {
  console.error('\nGATE FAIL [fiscal-economic-policy-composition]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [fiscal-economic-policy-composition] — FISCAL 4D-2 (DECISION-0178): applies_to físico(5)=gross|net|gross_transaction|commission_gross|commission_distributable, GRAVÁVEL(3), LEGADO READ-ONLY(2)=gross|net; migration forward-only única remove o default, declara o CHECK físico, preserva NOT NULL e NÃO toca linha (histórico congelado); writer valida via assertWritableAppliesTo (fallback \'gross\' removido; ausência e legado fail-closed); manifesto+07_NOMENCLATURA distinguem 5/3/2; orquestrador FiscalEconomicPolicyCompositionService evaluation/read-only, não-SSOT, SEM Bank, fiscal-provision 1×, policy version=economic_policies.id, contexto imutável, sem economic_policy_versions, sem tax_rules direto; negativo fail-closed monetário / honesto em preview; zero válido; missing obrigatório fail-closed; nenhum caller monetário vivo; 3 arquivos B-CITY byte-intactos; 4c-3 hash reconciliado e pinado; tax_reserve fora de applies_to; 4e inexistente. (Comment-aware + liveness.)');
