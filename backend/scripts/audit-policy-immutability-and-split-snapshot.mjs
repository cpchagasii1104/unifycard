#!/usr/bin/env node
// Guard estrutural — F-BANK-SPLIT-POLICY-ADMIN-FOUNDATION Fase 1 (DECISION-0166 D5, fatia F1-d).
//
// Trava as três conquistas da Fase 1 contra regressão:
//   (A) IMUTABILIDADE DA POLICY: migration F1-a com trigger economic_policies_immutability
//       (BEFORE UPDATE OR DELETE; deprecated terminal; active→deprecated único destino; DELETE
//       bloqueado em active/deprecated) — e nenhuma migration POSTERIOR dropa o trigger sem recriar.
//   (B) FREEZE DAS LINHAS: migration F1-b com trigger economic_policy_lines_freeze
//       (BEFORE INSERT OR UPDATE OR DELETE; pai active/deprecated congela; fail-closed pai invisível;
//       repoint de policy_id bloqueado) — idem anti-drop.
//   (C) RASTRO POR SPLIT: migration F1-c cria bank_splits.policy_version_id (FK economic_policies) +
//       jurisdiction_snapshot; e o INSERT canônico NÃO PERDE o dado — repository grava as colunas,
//       bank-transaction repassa por linha, bank-integration repassa, service-payment-execution origina
//       policyResult.policy.id.
// MORDE se qualquer elo da cadeia sumir (coluna, FK, repasse) ou se os triggers forem removidos/dropados.
// stripComments OBRIGATÓRIO (TS e SQL) — comentário não é prova. Heurística textual; NÃO altera runtime.
// Em validate:regression-guards via agregador audit-legacy-service-availability-containment-suite.mjs.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const failures = [];
const readTs = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const readSql = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripSql(readFileSync(p, 'utf-8')) : null; };
const need = (src, file, re, why) => { if (src === null) { failures.push(`arquivo ausente: ${file}`); return; } if (!re.test(src)) failures.push(`${file}: ${why}`); };

// ── (A) migration F1-a — imutabilidade de economic_policies ──
const MA = 'migrations/20260709140000_economic_policies_active_immutability.sql';
const ma = readSql(MA);
need(ma, MA, /CREATE TRIGGER economic_policies_immutability/, 'trigger economic_policies_immutability ausente (F1-a revertida).');
need(ma, MA, /BEFORE UPDATE OR DELETE ON economic_policies/, 'trigger não cobre UPDATE+DELETE em economic_policies.');
need(ma, MA, /IF OLD\.status = 'deprecated' THEN\s*RAISE EXCEPTION/, 'deprecated deixou de ser terminal/congelada (bypass deprecate→edita→reativa reaberto).');
need(ma, MA, /NEW\.status NOT IN \('active', 'deprecated'\)/, 'active→draft deixou de ser bloqueado.');
need(ma, MA, /NEW\.bps|NEW\.priority IS DISTINCT FROM OLD\.priority/, 'comparação de campos materiais sumiu do trigger.');
need(ma, MA, /OLD\.status IN \('active', 'deprecated'\)[\s\S]{0,220}DELETE not allowed/, 'DELETE de policy active/deprecated deixou de ser bloqueado.');

// ── (B) migration F1-b — freeze de economic_policy_lines ──
const MB = 'migrations/20260709150000_economic_policy_lines_freeze_when_active.sql';
const mb = readSql(MB);
need(mb, MB, /CREATE TRIGGER economic_policy_lines_freeze/, 'trigger economic_policy_lines_freeze ausente (F1-b revertida).');
need(mb, MB, /BEFORE INSERT OR UPDATE OR DELETE ON economic_policy_lines/, 'trigger não cobre INSERT+UPDATE+DELETE em economic_policy_lines.');
need(mb, MB, /IF parent_status IN \('active', 'deprecated'\) THEN\s*RAISE EXCEPTION/, 'lines de policy active/deprecated deixaram de congelar.');
need(mb, MB, /fail-closed|cannot verify immutability/, 'fail-closed de pai invisível (RLS) sumiu.');
need(mb, MB, /NEW\.policy_id IS DISTINCT FROM OLD\.policy_id/, 'repoint de policy_id (fuga da trava) deixou de ser verificado.');

// ── anti-drop: nenhuma migration POSTERIOR dropa os triggers sem recriar no MESMO arquivo ──
const migDir = join(ROOT, 'migrations');
for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql') && f > '20260709160000')) {
  const src = stripSql(readFileSync(join(migDir, f), 'utf-8'));
  for (const trg of ['economic_policies_immutability', 'economic_policy_lines_freeze']) {
    const drops = new RegExp(`DROP TRIGGER (IF EXISTS )?${trg}\\b`).test(src);
    const recreates = new RegExp(`CREATE TRIGGER ${trg}\\b`).test(src);
    if (drops && !recreates) failures.push(`migrations/${f}: dropa o trigger ${trg} sem recriar — imutabilidade da policy revogada silenciosamente.`);
  }
}

// ── (C) migration F1-c — colunas de rastro em bank_splits ──
const MC = 'migrations/20260709160000_bank_splits_policy_version_and_jurisdiction.sql';
const mc = readSql(MC);
need(mc, MC, /ADD COLUMN IF NOT EXISTS policy_version_id UUID NULL REFERENCES economic_policies\(id\)/, 'coluna policy_version_id (FK economic_policies) ausente da migration.');
need(mc, MC, /ADD COLUMN IF NOT EXISTS jurisdiction_snapshot JSONB NULL/, 'coluna jurisdiction_snapshot ausente da migration.');

// ── (C) cadeia viva do INSERT canônico — o dado não pode se perder em nenhum elo ──
const REPO = 'src/modules/bank/bank-split.repository.ts';
const repo = readTs(REPO);
need(repo, REPO, /INSERT INTO bank_splits \([\s\S]{0,300}policy_version_id, jurisdiction_snapshot/, 'INSERT de bank_splits não grava policy_version_id/jurisdiction_snapshot.');
need(repo, REPO, /policyVersionId \?\? null/, 'createSplit não passa policyVersionId ao INSERT (rastro perdido no repository).');

const TYPES = 'src/modules/bank/bank-split.types.ts';
need(readTs(TYPES), TYPES, /policyVersionId\?: string \| null/, 'CreateBankSplitInput perdeu policyVersionId.');

const TX = 'src/modules/bank/bank-transaction.service.ts';
const tx = readTs(TX);
if (tx === null) {
  failures.push(`arquivo ausente: ${TX}`);
} else {
  const start = tx.indexOf('async createTransactionWithExplicitSplitLines(');
  if (start === -1) failures.push(`${TX}: createTransactionWithExplicitSplitLines ausente.`);
  else {
    const nextAsync = tx.indexOf('\n  async ', start + 1);
    const body = nextAsync === -1 ? tx.slice(start) : tx.slice(start, nextAsync);
    if (!/policyVersionId: input\.policyVersionId \?\? null/.test(body)) {
      failures.push(`${TX}: createTransactionWithExplicitSplitLines não repassa policyVersionId ao createSplit (rastro perdido no sink).`);
    }
    // Fase 2c: per-LINE tem precedência (linha regional_fund carrega a própria jurisdição).
    if (!/jurisdictionSnapshot: line\.jurisdictionSnapshot \?\? input\.jurisdictionSnapshot \?\? null/.test(body)) {
      failures.push(`${TX}: createTransactionWithExplicitSplitLines não repassa jurisdictionSnapshot por linha (line ?? input ?? null).`);
    }
  }
}

const BI = 'src/modules/bank/bank-integration.service.ts';
const bi = readTs(BI);
if (bi === null) {
  failures.push(`arquivo ausente: ${BI}`);
} else {
  const start = bi.indexOf('async processServicePaymentExecutionCanonical(');
  if (start === -1) failures.push(`${BI}: processServicePaymentExecutionCanonical ausente.`);
  else {
    const nextAsync = bi.indexOf('\n  async ', start + 1);
    const body = nextAsync === -1 ? bi.slice(start) : bi.slice(start, nextAsync);
    if (!/policyVersionId: input\.policyVersionId \?\? null/.test(body)) {
      failures.push(`${BI}: processServicePaymentExecutionCanonical não repassa policyVersionId ao método canônico.`);
    }
  }
}

const SPE = 'src/modules/services/service-payment-execution.service.ts';
const spe = readTs(SPE);
need(spe, SPE, /policyVersionIdForSplits = policyResult\.policy!\.id/, 'service-payment-execution deixou de originar policyVersionId da policy resolvida.');
need(spe, SPE, /policyVersionId: policyVersionIdForSplits/, 'service-payment-execution não envia policyVersionId ao bank (rastro perdido na origem).');

// ── (C) snapshot LEGÍTIMO, não fabricado (invertido conscientemente na Fase 2c) ──
// Antes da 2c este bloco PROIBIA preencher jurisdiction_snapshot (contrato nullable). Com o
// resolver regional por FK vivo, a regra virou: o resolver regional DEVE construir o snapshot
// com os IDs canônicos realmente usados (countryId/stateId/cityId + basis), e NENHUM outro
// arquivo pode fabricar valor — só pass-through (dest./r./line./input. ?? null).
const SPE_RESOLVER_RE = /jurisdictionSnapshot:\s*\{\s*basis,\s*level:\s*'city',\s*countryId,\s*stateId,\s*cityId,?\s*\}/;
if (spe !== null) {
  if (!SPE_RESOLVER_RE.test(spe)) {
    failures.push(`${SPE}: resolver regional não constrói jurisdictionSnapshot legítimo ({basis, level, countryId, stateId, cityId}) — contrato D5 aberto de novo.`);
  }
  if (!/ensureRegionalFundAccount\(/.test(spe)) {
    failures.push(`${SPE}: resolver regional não usa ensureRegionalFundAccount (FK) — degradação para string pode ter voltado.`);
  }
}
function walkTs(dir, out = []) {
  let entries; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walkTs(full, out);
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
const PASSTHROUGH_RE = /^(dest|r|line|input)\.jurisdictionSnapshot(\s*\?\?\s*(input\.jurisdictionSnapshot\s*\?\?\s*)?null)?$/;
for (const f of walkTs(join(ROOT, 'src'))) {
  const src = stripTs(readFileSync(f, 'utf-8'));
  const isResolver = f.endsWith('service-payment-execution.service.ts');
  // (?!\s...) impede o backtracking de \s* de reposicionar o lookahead sobre um espaço e furar o veto.
  const re = /jurisdictionSnapshot\s*:\s*(?!\s|null\b|undefined\b|Record<)([^,\n}]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const value = m[1].trim();
    if (PASSTHROUGH_RE.test(value)) continue; // encanamento honesto, não fabricação
    if (isResolver && /^\{$/.test(value.slice(0, 1))) continue; // construção do resolver (validada acima por SPE_RESOLVER_RE)
    failures.push(`${f.replace(ROOT, '.')}: preenche jurisdictionSnapshot com valor fabricado (${value.slice(0, 60)}) — só o resolver regional por FK pode construí-lo.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [policy-immutability-and-split-snapshot]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [policy-immutability-and-split-snapshot] — DECISION-0166 D5 travada: economic_policies imutável em active/deprecated (trigger F1-a, deprecated terminal, anti-drop), economic_policy_lines congeladas com pai active/deprecated (trigger F1-b, fail-closed, anti-repoint), bank_splits.policy_version_id+jurisdiction_snapshot presentes e a cadeia canônica (repository→bank-transaction→bank-integration→service-payment-execution) não perde o rastro; jurisdiction_snapshot LEGÍTIMO (Fase 2c): resolver regional constrói {basis, level, IDs canônicos} via ensureRegionalFundAccount (FK), repasse por linha (line ?? input ?? null), fabricação fora do resolver PROIBIDA.');
