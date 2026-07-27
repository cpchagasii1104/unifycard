#!/usr/bin/env node
// backend/scripts/audit-bank-split-engine-context-containment.mjs
// GUARD ESTRUTURAL — tripwire de proteção do motor LEGADO de split
// (backend/src/modules/bank/bank-split-engine.service.ts) contra religamento silencioso.
//
// CONTEXTO (achado do GATE read-only, sessão da diretora, 2026-07-27): o caminho CANÔNICO de
// resolução de fundo regional é PE-3 (service-payment-execution.service.ts →
// bankAccountService.lookupRegionalFundAccount), que resolve a conta pelo FK territorial composto
// em regional_fund_accounts (cidade/estado/país reais do pagador/recebedor). bank-split-engine.
// service.ts é uma engine PARALELA e mais antiga: para os contextos 'event_ticket' / 'ride_payment'
// / 'service_booking' ela credita o "remanescente" via bankAccountService.getSystemAccount(tenantId,
// 'regional_fund', currency) — UMA conta NACIONAL por tenant, sem território, sem
// regionalOriginBasis. Se qualquer rota voltar a religar esses contextos através deste motor sem
// migrar para PE-3, dinheiro vai para o fundo ERRADO por desenho (bucket nacional único em vez do
// fundo real da comunidade do pagador/recebedor) — isso destrói a tese cooperativa da plataforma em
// silêncio (sem erro, sem 500, só endereço errado).
//
// O motor NÃO É deletado por este guard (deleção de módulo pré-existente exige autorização explícita
// de Clayton — fora de escopo). Este guard apenas cerca o motor: falha se (1) um caller de PRODUÇÃO
// (fora de tests/scripts) invocar createTransactionWithSplit com context fora do conjunto ratificado
// vivo; (2) aparecer um call-site de produção não classificado; (3) um módulo além de
// bank-transaction.service.ts passar a importar bankSplitEngineService; (4) calculateSplits passar a
// ser chamado de fora de bank-transaction.service.ts; (5) o call-site interno
// getSystemAccount(..., 'regional_fund', ...) dentro do próprio motor legado mudar de forma/contagem
// (sinal de refactor territorial que precisa de revisão humana, não de guard).
//
// RATIFICADO (pin explícito, não achado do guard): grep exaustivo de todo `.createTransactionWithSplit(`
// em backend/src produção viva (excluindo backend/src/scripts/ e backend/tests/, que são
// harness/teste do próprio motor) encontrou exatamente UM caller: bank-integration.service.ts:486,
// context 'group_contribution' (0% fee / 100% revenue_share — nunca toca regional_fund). Esse é o
// conjunto abaixo. Ampliar ALLOWED_LIVE_CONTEXTS é DECISÃO SOBERANA — registrar quem/quando no
// cartório (REMEDIATION_DT_LOG.md) ANTES de editar esta linha; não é um "achado" corrigível pelo guard.
const ALLOWED_LIVE_CONTEXTS = ['group_contribution'];

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/ quando chamado pelo runner ("node scripts/...")
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const rel = (p) => p.slice(ROOT.length + 1).replace(/\\/g, '/');
const readRel = (r) => { const p = join(ROOT, r); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const LANDMINE_MSG =
  'Este motor credita um fundo nacional único, sem território — migre para PE-3 (service-payment-execution.service.ts) antes de religar este contexto.';

function walk(dir, acc = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (e !== 'node_modules') walk(p, acc); }
    else if (e.endsWith('.ts') && !e.endsWith('.d.ts')) acc.push(p);
  }
  return acc;
}

// extrai o texto do call balanceado a partir do índice do '(' que abre a chamada
function callTextAt(src, openParenIdx) {
  let depth = 1;
  let i = openParenIdx + 1;
  const n = src.length;
  while (i < n && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  return src.slice(openParenIdx, i);
}

// encontra todos os call-sites que casam calleeRegexSource (deve terminar casando o '(' de abertura)
function findCalls(src, calleeRegexSource) {
  const re = new RegExp(calleeRegexSource, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const openParen = m.index + m[0].length - 1; // '(' é o último char do match
    out.push({ index: m.index, text: callTextAt(src, openParen) });
  }
  return out;
}

function extractContextLiterals(callText) {
  const re = /context\s*:\s*['"]([a-zA-Z0-9_]+)['"]/g;
  const out = [];
  let m;
  while ((m = re.exec(callText)) !== null) out.push(m[1]);
  return out;
}

const fails = [];

// allowlist explícita de arquivos de produção autorizados a chamar .createTransactionWithSplit(
// qualquer arquivo fora desta lista E fora de src/scripts// / tests/ / *.test.ts / *.spec.ts
// = call-site NÃO classificado → FAIL (novo caller precisa entrar aqui via revisão humana).
const PRODUCTION_ALLOW = {
  'src/modules/bank/bank-integration.service.ts': 'RATIFIED_LIVE',
  'src/modules/bank/adapters/bank-transaction.adapter.ts': 'PASSTHROUGH',
};

const isTestOrScript = (r) => r.startsWith('src/scripts/') || r.startsWith('tests/') || /\.(test|spec)\.ts$/.test(r);

const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))];

// ── 1. call-sites de .createTransactionWithSplit( — contexto ratificado + completude da allowlist ──
let productionCallSites = 0;
for (const abs of files) {
  const src = stripTs(readFileSync(abs, 'utf-8'));
  const r = rel(abs);
  const calls = findCalls(src, '\\.createTransactionWithSplit\\s*\\(');
  if (calls.length === 0) continue;
  if (isTestOrScript(r)) continue; // TEST_ONLY — harness testa o motor propositalmente com contextos legados

  const cls = PRODUCTION_ALLOW[r];
  if (!cls) {
    fails.push(`call-site de produção NÃO classificado: ${r} — classifique no guard (RATIFIED_LIVE/PASSTHROUGH) ou reverta a chamada. ${LANDMINE_MSG}`);
    continue;
  }
  productionCallSites++;

  for (const call of calls) {
    const ctxs = extractContextLiterals(call.text);
    if (cls === 'PASSTHROUGH') {
      if (ctxs.length > 0) fails.push(`${r}: PASSTHROUGH deixou de só encaminhar o input cru — passou a fixar context literal (${ctxs.join(',')}). O adapter deve normalizar amountCents, nunca decidir context.`);
      continue;
    }
    if (cls === 'RATIFIED_LIVE') {
      if (ctxs.length === 0) {
        fails.push(`${r}: chamada a createTransactionWithSplit sem context literal estático — guard não consegue verificar (context dinâmico proibido neste call-site ratificado; use literal string).`);
        continue;
      }
      for (const c of ctxs) {
        if (!ALLOWED_LIVE_CONTEXTS.includes(c)) {
          fails.push(`${r}: context '${c}' fora do conjunto RATIFICADO (${ALLOWED_LIVE_CONTEXTS.join(',')}). ${LANDMINE_MSG}`);
        }
      }
    }
  }
}

// ── 2. import graph — bankSplitEngineService só pode ser importado por bank-transaction.service.ts
//      (index.ts é barrel re-export, não invoca). Novo importador = novo caminho pro motor legado.
const IMPORT_ALLOW = new Set([
  'src/modules/bank/bank-transaction.service.ts',
  'src/modules/bank/index.ts',
]);
const ENGINE_FILE = 'src/modules/bank/bank-split-engine.service.ts';
const importRe = /from\s+['"][^'"]*bank-split-engine\.service['"]/;
for (const abs of files) {
  const r = rel(abs);
  if (r === ENGINE_FILE) continue;
  const src = stripTs(readFileSync(abs, 'utf-8'));
  if (importRe.test(src) && !IMPORT_ALLOW.has(r)) {
    fails.push(`${r}: NOVO importador de bank-split-engine.service (bankSplitEngineService) fora do allowlist. ${LANDMINE_MSG}`);
  }
}

// ── 3. calculateSplits só pode ser chamado a partir de bank-transaction.service.ts ────────────────
const CALC_ALLOW = new Set(['src/modules/bank/bank-transaction.service.ts']);
for (const abs of files) {
  const r = rel(abs);
  if (r === ENGINE_FILE) continue;
  const src = stripTs(readFileSync(abs, 'utf-8'));
  const calls = findCalls(src, 'bankSplitEngineService\\.calculateSplits\\s*\\(');
  if (calls.length > 0 && !CALC_ALLOW.has(r)) {
    fails.push(`${r}: NOVO caller de bankSplitEngineService.calculateSplits fora do allowlist. ${LANDMINE_MSG}`);
  }
}

// ── 4. forma do call-site interno getSystemAccount(..., 'regional_fund', ...) — deve permanecer
//      EXATAMENTE 1 ocorrência (o passo "remanescente"). Contagem != 1 = refactor territorial que
//      precisa de revisão humana antes do guard voltar a confiar na forma.
const engineSrc = readRel(ENGINE_FILE);
const engineAbsPath = join(ROOT, ENGINE_FILE);
const engineRaw = existsSync(engineAbsPath) ? readFileSync(engineAbsPath, 'utf-8') : null;
if (engineSrc === null) {
  fails.push(`${ENGINE_FILE} ausente — motor legado sumiu sem autorização (deleção de módulo pré-existente exige decisão explícita de Clayton).`);
} else {
  const regionalFundGetSystemAccountRe = /getSystemAccount\s*\(\s*tenantId\s*,[\s\S]{0,20}?['"]regional_fund['"]/g;
  const hits = engineSrc.match(regionalFundGetSystemAccountRe) || [];
  if (hits.length !== 1) {
    fails.push(`${ENGINE_FILE}: getSystemAccount(..., 'regional_fund', ...) mudou de forma — esperado EXATAMENTE 1 call-site (achado ${hits.length}). Mudança de forma na resolução territorial do motor legado exige revisão humana.`);
  }
  // DECISION-0048 é a doutrina (citada em COMENTÁRIO, por isso lida do RAW, não do stripped) que
  // mantém este motor em "defaults hardcoded" fora de policy governada; se a citação sumir, o motor
  // pode ter sido silenciosamente promovido sem convergir para PE-3 primeiro.
  if (!engineRaw || !/DECISION-0048/.test(engineRaw)) {
    fails.push(`${ENGINE_FILE}: referência a DECISION-0048 sumiu do motor legado — sinal de que ele pode ter sido promovido/alterado sem convergência para PE-3 (revisão humana necessária).`);
  }
}

if (fails.length > 0) {
  console.error('GATE FAIL [bank-split-engine-context-containment]:');
  for (const f of fails) console.error('   - ' + f);
  process.exit(1);
}
console.log(`GATE OK [bank-split-engine-context-containment] — motor legado bank-split-engine.service.ts contido: ${productionCallSites} call-site(s) de produção de createTransactionWithSplit, todos no context ratificado (${ALLOWED_LIVE_CONTEXTS.join(',')}); bankSplitEngineService importado só por bank-transaction.service.ts; calculateSplits chamado só de lá; getSystemAccount(...,'regional_fund',...) preserva forma única. Fundo nacional cego a território permanece inalcançável fora do caminho conhecido.`);
