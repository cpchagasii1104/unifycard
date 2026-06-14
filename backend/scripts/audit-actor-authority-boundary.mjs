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
//   Forma C — R2 company-scoped: companiesService.canUserPerformCompanyCapability(tenantId, <subj>, '<can_*>',
//             {companyId}) COM prova de company-scope (resolveCompanyIdForActor) no arquivo. <subj> = const
//             local ligada a req.user.userId/req.user.id. Autoridade = company_users.can_* (per-empresa,
//             fail-closed sem companyId). O actorId client-declared nunca é subject.
//   Forma D — R2 tenant-level: companiesService.canUserPerformTenantCapability(tenantId, <subj>, '<can_tenant_*>')
//             onde <subj> = const local ligada a req.user.userId/req.user.id. Autoridade = tenant_operator_grants
//             .can_* (TENANT-LEVEL, DECISION-0126; tenant-scoped por construção, sem actorId/company/company_users;
//             grant em tenant A não vale tenant B). NÃO é Bank/payout/trust (esses seguem baselineados).
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
  // Aceita `req.user.id`/`req.user?.id`/`req.user.userId` (com ou sem optional chaining) — todos server-side.
  for (const m of code.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*req\.user\??\.(?:userId|id)(?:\s*\?\?\s*req\.user\??\.(?:userId|id))?\s*;/g)) {
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
  // Forma D — canUserPerformTenantCapability(tenantId, <subj=req.user var>, '<can_tenant_*>'): autoridade
  // material em tenant_operator_grants.can_* (TENANT-LEVEL, DECISION-0126). Subject server-side; tenant-scoped
  // por construção (NÃO usa actorId/company/company_users). Grant em tenant A não vale tenant B.
  for (const m of code.matchAll(/\bcanUserPerformTenantCapability\(\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*,/g)) {
    const subj = m[1].trim();
    if (serverSubjectVars.has(subj)) {
      return `D:canUserPerformTenantCapability(tenantId, ${subj}=req.user, can_tenant_*) — subject server-side, autoridade=tenant_operator_grants.can_* (tenant-scoped)`;
    }
  }
  // Forma E — reader bank: actorCapabilitiesService.resolveForUser(tenantId, <targetActorId>, <subj=req.user var>).
  // O 3º arg é o SUBJECT (req.user server-side); o 2º é o actorId ALVO (filtro client-declared). Capability
  // checada server-side (caps.capabilities), sem writer move-money no caminho. Reconhece o reader GET /balance
  // de bank-http (F-BANK-HTTP-AUTHORITY-BINDING) sem maquiar: a prova some se o subject deixar de vir de req.user.
  for (const m of code.matchAll(/\bactorCapabilitiesService\.resolveForUser\(\s*[^,()]+,\s*[^,()]+,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    const subj = m[1].trim();
    if (serverSubjectVars.has(subj)) {
      return `E:actorCapabilitiesService.resolveForUser(tenantId, targetActorId, ${subj}=req.user) — subject server-side, actorId=alvo (reader bank)`;
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
// F-R2-TENANT-LEVEL-OPERATOR-GRANTS (2026-06-14, DECISION-0126): as rotas tenant-wide deixaram de ser
// fail-closed e passaram a abrir por GRANT TENANT-LEVEL (tenant_operator_grants.can_*, Forma D) — NUNCA por
// company_users. As rotas actor-scoped seguem company-scoped (Forma C). reporting usa só Forma D e não tem
// canal client-declared (fora do escopo do guard).
  'modules/business-audit/business-audit.routes.ts':
    'MISTA. GET /business-audit-logs?actorId resolvível → company-scoped (Forma C, can_view_audit_logs); sem actor resolvível ou GET /:logId → tenant-level (Forma D, can_view_tenant_audit_logs). query.actorId = alvo (repo FILTRA por actor_id), nunca subject. Zero write.',
  'modules/risk-command-center/risk-dashboard.routes.ts':
    'MISTA. GET /actors/:actorId[/timeline] → company-scoped (Forma C, can_view_risk). /overview e /actors (lista) → tenant-level (Forma D, can_view_tenant_risk). params.actorId = alvo. Spoof subject==target CLOSED. Sem write.',
  'modules/policy-engine/policy.routes.ts':
    'MISTA. GET /policies/evaluate/:actorId e /policy-decisions/actor/:actorId/active → company-scoped (Forma C, can_manage_policy). Listar/criar/ativar/decisões/apply/revoke → tenant-level (Forma D, can_manage_tenant_policy; estado de política interno, sem efeito financeiro). params/query.actorId = alvo, nunca subject.',
  'modules/trust/trust.routes.ts':
    'TENANT-LEVEL (R2.4 UNFREEZE, DECISION-0127). Compliance/risco tenant-scoped. Reads (GET /trust/profile/:actorId, /profiles, /events, POST /can-proceed) → Forma D can_view_tenant_trust; mutations (POST /trust/events, /recalculate/:actorId) → Forma D can_manage_tenant_trust. requireRole(admin) REMOVIDO. params/query.actorId = alvo, nunca subject. Sem dinheiro (dispute_* = tipos de evento de score).',
  'core/unifybank/bank-http.routes.ts':
    'READER + REQUEST-ONLY (F-BANK-HTTP-AUTHORITY-BINDING, DECISION-0128). GET /balance: subject server-side (userId=req.user.id) + actorCapabilitiesService.resolveForUser (Forma E); query.actorId = ALVO de leitura, nunca subject; sem write/move-money (getUserBalance/getActorBalance = leitura). POST /transactions/simple|split: NÃO executam mais Bank — REQUEST-ONLY (createFinancialApprovalRequest no Core; sem bank_transaction/bank_ledger/split). Os writers usam só req.user.id (sem canal client-declared). Guard cercado por audit-bank-http-authority-binding.mjs.',
  'modules/payout/payout.routes.ts':
    'READER + FAIL-CLOSED (F-ACTOR-WALLET-PAYOUT-WIRING, DECISION-0128). GET /payouts/orders[?actorId]/batches: gateados por requirePayoutPermission → businessAuthorizationService.requirePermission(tenantId, userId=req.user.id, actor.actor_id, financial:execute_payout) = Forma B (subject server-side, subj!=target); query.actorId = FILTRO de leitura do operador, nunca subject. POST /payouts/batches, /orders/:id/execute-manual, /orders/:id/fail: FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED) — NÃO executam payout, NÃO chamam payoutService executor, NÃO movem dinheiro/settlement. Guard cercado por audit-payout-authority-binding.mjs.',
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
  // F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION (2026-06-13): policy-engine REMOVIDO. F-R2-TRUST-TENANT-GRANTS-
  // R24-UNFREEZE (2026-06-14): trust REMOVIDO — requireRole(admin) interino substituído por grant tenant-level
  // (Forma D, can_view/manage_tenant_trust). F-BANK-HTTP-AUTHORITY-BINDING (2026-06-14): bank-http REMOVIDO —
  // writers REQUEST-ONLY + GET /balance Forma E. F-ACTOR-WALLET-PAYOUT-WIRING (2026-06-14): payout REMOVIDO —
  // writers (batches/execute-manual/fail) FAIL-CLOSED (403 PAYOUT_HTTP_EXECUTION_DISABLED, sem executor) e GET
  // readers reconhecidos por Forma B (requirePermission com subject server-side) → SAFE_SUBJECT_READERS.
  // **BASELINE 0113 = 0** — os 2 resíduos financeiros (bank-http, payout) fechados. Execução real de Bank/payout
  // = frente futura (F-PAYOUT-EXECUTION-SEAL). Ver DECISION-0128 + audit-payout-authority-binding.mjs.
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
