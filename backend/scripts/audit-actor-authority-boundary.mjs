#!/usr/bin/env node
// Guard estrutural — F-0113-AUTHORITY-FACADE-BOUNDARY-SEAL + F-R2-GUARD-SAFE-SUBJECT-RECOGNITION.
//
// Sela a fronteira da DECISION-0113: actorId/objeto-de-ator DECLARADO pelo CLIENTE é
// HINT, nunca prova. Inclui formalmente o 6º CANAL revelado pelo P0 dispute reversal:
//   body.actor · body.actor.actorId · body.actor.kind · authoritySource vindo do body ·
//   actor.kind vindo do body.
// Qualquer rota que LÊ um canal de ator client-declared para AGIR deve provar o binding
// server-side por authority.service / canActAs / canRepresentActor (ou caller sistêmico real)
// — OU, para readers/admin-filters, provar que o SUBJECT da permissão vem de req.user
// server-side (FATIA A; ver SAFE_SUBJECT_READERS / safeSubjectProof abaixo).
//
// Hierarquia normativa vigente (documentada em DECISION-0113 + STATUS):
//   porta normativa  → authorizationService (authority.service)
//   resolvedor       → canActAs
//   representabilidade→ canRepresentActor
//   PJ membership SSOT→ company_users
//   RBAC V2          → NÃO soberano (FASE 6 / dormente-divergente)
//   CNAE             → evidência fiscal, não autorização
//
// MODELO: BASELINE EXPLÍCITO. Este guard NÃO corrige os fluxos — congela o estado
// conhecido (BASELINE) e FALHA em QUALQUER rota NOVA que use um canal client-declared
// SEM helper de binding no arquivo. Heurística file-level (não AST): um arquivo com
// canal + binding helper passa; falso-negativo possível por handler — por isso o guard
// é uma CERCA DE REGRESSÃO, não prova de correção total. Violações conhecidas têm DT
// vinculada (ver REMEDIATION_DT_LOG). Integrado em validate:regression-guards.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const SRC = join(process.cwd(), 'src');

// Canais de ator DECLARADO pelo cliente (hints; exigem binding server-side).
const CLIENT_ACTOR_CHANNELS = [
  { key: 'body.actor-object',     re: /parseActor\(\s*req\.body|req\.body\??\.actor\??\.(kind|actorId|actor_id)|req\.body\??\.actor\b(?!_)/ },
  { key: 'body.actorId',          re: /req\.body\??\.(actorId|actor_id)\b/ },
  { key: 'authoritySource:system',re: /authoritySource:\s*['"]system['"]/ },
  { key: 'params.actorId',        re: /req\.params\??\.actorId\b/ },
  { key: 'query.actorId',         re: /req\.query\??\.actorId\b/ },
  { key: 'header.x-actor-id',     re: /['"]x-actor-id['"]/ },
  { key: 'metadata.serviceId',    re: /metadata\.serviceId\b/ },
];

// Helpers de binding server-side (a presença NO ARQUIVO satisfaz a heurística file-level).
const BINDING_HELPERS = /\bcanActAs\b|\bcanRepresentActor\b|\bcanPerformAction\b|\brequireRepresentable\b|\brequireRepresentableActor\b|\bauthorityActorOf\b|\brepresentsAvailabilityOwner\b|\bcanManageCompany\b/;

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ── FATIA A (F-R2-GUARD-SAFE-SUBJECT-RECOGNITION) ─────────────────────────────────────────
// PROVA DE SUBJECT SERVER-SIDE (DECISION-0113): o SUBJECT da autorização é derivado server-side
// de req.user, NUNCA de um canal de ator client-declared (params/query/body/actionContext).
// Duas formas reconhecidas:
//   Forma A — fastify.requirePermission([...]) preHandler: o rbac.plugin resolve o subject a
//             partir de req.user (ESTRUTURAL — o decorator nunca aceita subject client-declared).
//   Forma B — businessAuthorizationService.requirePermission(tenantId, <subj>, <target>, ...)
//             onde <subj> é uma const local ligada a req.user.userId/req.user.id E subj !== target.
//   Forma C — R2 (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION): companiesService
//             .canUserPerformCompanyCapability(tenantId, <subj>, '<can_*>') onde <subj> é uma const
//             local ligada a req.user.userId/req.user.id. A autoridade material é company_users.can_*
//             (SSOT de membership PJ); a identidade global é resolvida server-side (JOIN users.global_user_id)
//             DENTRO do authorizer — o actorId client-declared nunca é subject. Não é writer move-money.
// Retorna string de prova (truthy) ou null. Recebe código bruto OU já sem comentários — strip interno.
// É PROIBIDO reconhecer subject vindo de req.actionContext.actorId / req.params.* / req.query.* /
// req.body.* (não são server-side); e subject == target SEMPRE falha (ver SUBJECT_EQUALS_TARGET).
function safeSubjectProof(rawCode) {
  const code = stripComments(rawCode);
  // Forma A — preHandler decorator fastify.requirePermission(['key', ...]).
  if (/\brequirePermission\(\s*\[/.test(code)) {
    return 'A:fastify.requirePermission([...]) preHandler — subject=req.user via rbac.plugin (estrutural)';
  }
  // Forma B — subject = const local derivada DIRETAMENTE de req.user.userId/req.user.id.
  const serverSubjectVars = new Set();
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*req\.user\?\.(?:userId|id)(?:\s*\?\?\s*req\.user\?\.(?:userId|id))?\s*;/g)) {
    serverSubjectVars.add(m[1]);
  }
  if (serverSubjectVars.size === 0) return null;
  for (const m of code.matchAll(/\brequirePermission\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$.]*)\s*,/g)) {
    const subj = m[1].trim();
    const target = m[2].trim();
    if (serverSubjectVars.has(subj) && subj !== target) {
      return `B:requirePermission(tenantId, ${subj}=req.user, ${target}) — subject server-side, subj!=target`;
    }
  }
  // Forma C — canUserPerformCompanyCapability(tenantId, <subj=req.user var>, '<can_*>', { companyId })
  // COM prova de COMPANY-SCOPE server-side no arquivo (resolveCompanyIdForActor). O 2º arg é o SUBJECT
  // (req.user, não o alvo). O primitivo é fail-closed sem companyId (grant per-empresa, nunca tenant-wide,
  // DECISION-0125 §escopo) — reconhecer Forma C exige a prova de escopo company para não maquiar tenant-wide.
  const hasCompanyScopeProof = /\bresolveCompanyIdForActor\s*\(/.test(code);
  if (hasCompanyScopeProof) {
    for (const m of code.matchAll(/\bcanUserPerformCompanyCapability\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,/g)) {
      const subj = m[1].trim();
      if (serverSubjectVars.has(subj)) {
        return `C:canUserPerformCompanyCapability(tenantId, ${subj}=req.user, can_*, {companyId}) + resolveCompanyIdForActor — subject server-side, company-scoped (fail-closed sem companyId)`;
      }
    }
  }
  return null;
}

// READERS/ADMIN-FILTERS AUDITADOS HUMANAMENTE em F-R2-GUARD-SAFE-SUBJECT-RECOGNITION (2026-06-13).
// Cada um é rota de LEITURA/filtro-admin cujo SUBJECT de autorização vem server-side (req.user); o
// actorId client-declared é apenas FILTRO/ALVO de leitura — sem writer/move-money e sem subject==target.
// O guard só remove o arquivo do escopo se a PROVA (safeSubjectProof) AINDA estiver presente em runtime:
// se alguém reverter o subject para client-declared, a prova some, o arquivo volta a flaggar e (não
// estando no BASELINE) FALHA. NÃO inclui payout/bank-http (move-money HARD STOP), policy-engine
// (mutations mixed — per-actor binding R2 DECISION_REQUIRED) nem trust (requireRole interino R2.4):
// esses PERMANECEM no BASELINE com justificativa material própria. Ver DECISION-0124 + DT-0113-CLASSIC.
// F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE (2026-06-14): escopo corrigido. As rotas tenant-wide são
// FAIL-CLOSED (company_scope_required); as rotas ACTOR-SCOPED resolvem actors.company_id e exigem o grant
// NAQUELA empresa (Forma C company-scoped). reporting saiu do allowlist: virou 100% fail-closed e teve o
// `actorId` morto removido ⇒ não casa mais canal client-declared (fora do escopo do guard). Os 3 abaixo
// mantêm canal (query/params.actorId como ALVO) + Forma C com prova de company-scope (resolveCompanyIdForActor).
const SAFE_SUBJECT_READERS = {
  'modules/business-audit/business-audit.routes.ts':
    'ACTOR-SCOPED. GET /business-audit-logs?actorId → resolveCompanyIdForActor → canUserPerformCompanyCapability(can_view_audit_logs, {companyId}). Sem actorId resolvível (listagem tenant-wide) e GET /:logId = FAIL-CLOSED (company_scope_required). query.actorId = alvo (repo FILTRA por actor_id), nunca subject. Zero write.',
  'modules/risk-command-center/risk-dashboard.routes.ts':
    'ACTOR-SCOPED. GET /actors/:actorId[/timeline] → resolveCompanyIdForActor(params.actorId) → canUserPerformCompanyCapability(can_view_risk, {companyId}). /overview e /actors (lista) = tenant-wide FAIL-CLOSED. params.actorId = alvo. Spoof subject==target CLOSED. Sem write.',
  'modules/policy-engine/policy.routes.ts':
    'ACTOR-SCOPED. GET /policies/evaluate/:actorId e /policy-decisions/actor/:actorId/active → resolveCompanyIdForActor → canUserPerformCompanyCapability(can_manage_policy, {companyId}). Demais (listar/criar/ativar/decisões/apply/revoke) = tenant-wide/mixed FAIL-CLOSED. params/query.actorId = alvo, nunca subject.',
};

// ── BASELINE EXPLÍCITO (estado conhecido; cada item tem DT vinculada) ──
// Arquivo (rel a src/) → canais usados sem binding no arquivo + nota/DT. NOVOS arquivos
// fora desta lista (e fora de SAFE_SUBJECT_READERS) que casem um canal sem binding = FALHA.
const BASELINE = {
  // 6º CANAL (body.actor) — alvo normativo:
  // reconciliation-dispute.routes.ts REMOVIDO do baseline (2026-06-13): /reversal contido
  // (403 DISPUTE_REVERSAL_HTTP_DISABLED) + irmãs from-discrepancy/to-review/resolve contidas
  // (403 DISPUTE_MUTATION_HTTP_DISABLED) — parseActor/req.body.actor eliminados; guard não mais
  // detecta canal. DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY → P1 CONTAINED.
  // core/events/event.routes.ts REMOVIDO do baseline (2026-06-13, F-0113-EVENT-ACTOR-BODY-BINDING):
  // todos os handlers que liam actor do body passaram a exigir representabilidade server-side via
  // canRepresentActor (req.user.userId → actor), fail-closed. DT-0113-EVENT-ACTOR-BODY-BINDING → CLOSED.
  // F-0113-CLASSIC-CHANNEL-READERS-BINDING (2026-06-13): public-profiles + marketplace-categories REMOVIDOS
  // (binding canRepresentActor). F-R2-GUARD-SAFE-SUBJECT-RECOGNITION (2026-06-13): reporting + business-audit +
  // risk-dashboard REMOVIDOS do baseline — reconhecidos por SAFE_SUBJECT_READERS (subject server-side provado).
  // F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION (2026-06-13): policy-engine REMOVIDO — todas as rotas (reads
  // + mutations) passaram a usar canUserPerformCompanyCapability(can_manage_policy) com subject server-side
  // (Forma C), tornando o arquivo provável. Os 3 abaixo PERMANECEM baselineados COM JUSTIFICATIVA MATERIAL (não
  // maquiagem): Bank/financeiro HARD STOP (move-money), ou requireRole interino R2.4 congelado. Ver DECISION-0124.
  'core/unifybank/bank-http.routes.ts':                'D · BANK domain (HARD STOP) + move-money writers (POST /transactions/simple|split). GET /balance tem autoridade via actorCapabilitiesService.resolveForUser (não reconhecida pelo guard nem é requirePermission). Não tocar. DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/payout/payout.routes.ts':                   'D · FINANCIAL (HARD STOP) + move-money writers (POST /payouts/batches, /orders/:id/execute-manual, /fail). subject server-side (req.user.id → requirePermission financial:execute_payout) mas é money-writer — não auto-reconhecer. query.actorId em GET /payouts/orders = filtro do operador. Não tocar. DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/trust/trust.routes.ts':                     'D · params/query.actorId sob requireRole(admin) INTERINO (DECISION-0113, pendente R2.4) + mixed writes (POST /trust/events, /can-proceed, /recalculate). requireRole NÃO é prova de subject server-side reconhecida (e o modelo fino é R2.4 congelado). Manter interino. DECISION_REQUIRED. DT-0113-CLASSIC-CHANNEL-READERS.',
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (extname(full) === '.ts' && full.endsWith('.routes.ts')) {
      files.push(full);
    }
  }
  return files;
}

// 🔴 ANTIPADRÃO DURO (F-RISK-DASHBOARD-PERMISSION-SPOOF-CONTAINMENT): subject == target em chamada de
// autorização — ex.: requirePermission(tenantId, actorId, actorId, ...) onde o 2º arg (subject/userId)
// e o 3º (target/actor) são o MESMO identificador (geralmente derivado de actionContext/params/query).
// O SUBJECT da permissão deve vir SERVER-SIDE de req.user; nunca do alvo. SEMPRE FALHA (não baselineável).
const SUBJECT_EQUALS_TARGET = /requirePermission\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)\s*,\s*\1\s*,/;

function runGuard() {
  const flagged = [];          // arquivos que casam canal sem binding e sem safe-subject (estado atual)
  const newViolations = [];
  const safeRecognized = [];   // readers reconhecidos por subject server-side (FATIA A)

  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    const raw = readFileSync(file, 'utf-8');
    const code = stripComments(raw);
    const channels = CLIENT_ACTOR_CHANNELS.filter((c) => c.re.test(code)).map((c) => c.key);
    if (channels.length === 0) continue;
    const hasBinding = BINDING_HELPERS.test(code);
    if (hasBinding) continue; // binding presente no arquivo → fora do escopo do guard (heurística)
    // FATIA A: reader/admin-filter AUDITADO + prova de subject server-side AINDA presente → reconhecido.
    if (rel in SAFE_SUBJECT_READERS) {
      const proof = safeSubjectProof(raw);
      if (proof) {
        safeRecognized.push({ rel, channels, proof });
        continue;
      }
      // estava no allowlist mas perdeu a prova → cai como violação (não está no BASELINE).
    }
    flagged.push({ rel, channels });
    if (!(rel in BASELINE)) {
      newViolations.push({ rel, channels });
    }
  }

  const subjectSpoof = [];
  for (const file of walk(SRC)) {
    const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    if (SUBJECT_EQUALS_TARGET.test(stripComments(readFileSync(file, 'utf-8')))) subjectSpoof.push(rel);
  }

  // Baseline pode listar arquivos que hoje JÁ TÊM binding — não é erro; reportamos baseline órfão
  // como informativo (drift de limpeza), nunca FAIL.
  const flaggedRels = new Set(flagged.map((f) => f.rel));
  const staleBaseline = Object.keys(BASELINE).filter((b) => !flaggedRels.has(b));
  // Allowlist de safe-subject órfão (entrada que não foi exercida nem reconhecida) → informativo.
  const recognizedRels = new Set(safeRecognized.map((f) => f.rel));
  const staleSafeReaders = Object.keys(SAFE_SUBJECT_READERS).filter((r) => !recognizedRels.has(r) && !flaggedRels.has(r));

  console.log(`[actor-authority-boundary] flagged=${flagged.length} baseline=${Object.keys(BASELINE).length} new=${newViolations.length} stale_baseline=${staleBaseline.length} safe_subject_recognized=${safeRecognized.length}`);
  if (safeRecognized.length > 0) {
    console.log('  ✅ subject server-side reconhecido (FATIA A — fora do baseline, prova verificada em runtime):');
    safeRecognized.forEach((s) => console.log(`     - ${s.rel}  [${s.channels.join(', ')}]  → ${s.proof}`));
  }
  if (staleBaseline.length > 0) {
    console.log('  ℹ️  baseline já não casa (binding adicionado/arquivo limpo — pode ser removido do baseline numa futura limpeza):');
    staleBaseline.forEach((b) => console.log(`     - ${b}`));
  }
  if (staleSafeReaders.length > 0) {
    console.log('  ℹ️  SAFE_SUBJECT_READERS órfão (sem canal/sem uso — revisar numa futura limpeza):');
    staleSafeReaders.forEach((r) => console.log(`     - ${r}`));
  }

  if (subjectSpoof.length > 0) {
    console.error('GATE FAIL [actor-authority-boundary]: SUBJECT==TARGET client-declared em requirePermission (spoof de autoridade — F-RISK-DASHBOARD-PERMISSION-SPOOF). O subject deve vir de req.user server-side, nunca do alvo:');
    subjectSpoof.forEach((f) => console.error(`  ❌ ${f}  — requirePermission(tenantId, X, X, ...) com mesmo identificador; use req.user como subject (ex.: requirePermission(tenantId, req.user.id, targetActorId, ...)).`));
    process.exit(1);
  }

  if (newViolations.length > 0) {
    console.error('GATE FAIL [actor-authority-boundary]: NOVA rota lê canal de ator CLIENT-DECLARED sem binding server-side (DECISION-0113):');
    newViolations.forEach((v) => console.error(`  ❌ ${v.rel}  [${v.channels.join(', ')}]  — vincule via authorityService.canActAs/canRepresentActor, OU (reader/admin-filter) prove subject=req.user e adicione a SAFE_SUBJECT_READERS, OU adicione ao BASELINE com DT.`));
    process.exit(1);
  }

  console.log('GATE OK [actor-authority-boundary] — 6º canal body.actor registrado; safe-subject (FATIA A) reconhecido; nenhuma NOVA violação client-declared sem binding fora do baseline.');
}

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  runGuard();
}

export { safeSubjectProof, runGuard, SAFE_SUBJECT_READERS, BASELINE, CLIENT_ACTOR_CHANNELS, BINDING_HELPERS };
