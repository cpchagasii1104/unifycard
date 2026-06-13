#!/usr/bin/env node
// Guard estrutural — F-0113-AUTHORITY-FACADE-BOUNDARY-SEAL.
//
// Sela a fronteira da DECISION-0113: actorId/objeto-de-ator DECLARADO pelo CLIENTE é
// HINT, nunca prova. Inclui formalmente o 6º CANAL revelado pelo P0 dispute reversal:
//   body.actor · body.actor.actorId · body.actor.kind · authoritySource vindo do body ·
//   actor.kind vindo do body.
// Qualquer rota que LÊ um canal de ator client-declared para AGIR deve provar o binding
// server-side por authority.service / canActAs / canRepresentActor (ou caller sistêmico real).
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
import { join, extname } from 'path';

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

// ── BASELINE EXPLÍCITO (estado conhecido em 48da5536; cada item tem DT vinculada) ──
// Arquivo (rel a src/) → canais usados sem binding no arquivo + nota/DT. NOVOS arquivos
// fora desta lista que casem um canal sem binding = FALHA.
const BASELINE = {
  // 6º CANAL (body.actor) — alvo normativo:
  // reconciliation-dispute.routes.ts REMOVIDO do baseline (2026-06-13): /reversal contido
  // (403 DISPUTE_REVERSAL_HTTP_DISABLED) + irmãs from-discrepancy/to-review/resolve contidas
  // (403 DISPUTE_MUTATION_HTTP_DISABLED) — parseActor/req.body.actor eliminados; guard não mais
  // detecta canal. DT-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY → P1 CONTAINED.
  // core/events/event.routes.ts REMOVIDO do baseline (2026-06-13, F-0113-EVENT-ACTOR-BODY-BINDING):
  // todos os handlers que liam actor do body (POST /events · /events/v2/draft · /events/v2/create ·
  // /events/:id/v2/commitments · check-in/out · checkout) passaram a exigir representabilidade
  // server-side via canRepresentActor (req.user.userId → actor), fail-closed. metadata/actionContext
  // = HINT. DT-0113-EVENT-ACTOR-BODY-BINDING → CLOSED. Guard reconhece o binding helper.
  // Canais clássicos (params/query) em readers/filtros — DECISION-0113 clássica:
  'modules/public-profiles/public-profile.routes.ts': 'query.actorId — reader público (filtro). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/business-audit/business-audit.routes.ts':   'query.actorId — auditoria (log/filtro). DT-0113-CLASSIC-CHANNEL-READERS.',
  'core/unifybank/bank-http.routes.ts':                'query.actorId — bank read. DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/risk-command-center/risk-dashboard.routes.ts': 'params.actorId — risk dashboard (reader). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/policy-engine/policy.routes.ts':            'params/query.actorId — policy engine (reader). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/payout/payout.routes.ts':                   'query.actorId — payout (reader/filtro). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/trust/trust.routes.ts':                     'params/query.actorId — trust engine (reader). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/marketplace/marketplace-categories.routes.ts': 'query.actorId — categorias (log/filtro). DT-0113-CLASSIC-CHANNEL-READERS.',
  'modules/reporting/reporting.routes.ts':             'query.actorId — reporting (filtro). DT-0113-CLASSIC-CHANNEL-READERS.',
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

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const flagged = [];   // arquivos que casam canal sem binding (estado atual)
const newViolations = [];

for (const file of walk(SRC)) {
  const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
  const code = stripComments(readFileSync(file, 'utf-8'));
  const channels = CLIENT_ACTOR_CHANNELS.filter((c) => c.re.test(code)).map((c) => c.key);
  if (channels.length === 0) continue;
  const hasBinding = BINDING_HELPERS.test(code);
  if (hasBinding) continue; // binding presente no arquivo → fora do escopo do guard (heurística)
  flagged.push({ rel, channels });
  if (!(rel in BASELINE)) {
    newViolations.push({ rel, channels });
  }
}

// Baseline pode listar arquivos que hoje JÁ TÊM binding (organization) — não é erro;
// só reportamos baseline órfão como informativo (drift de limpeza), nunca FAIL.
const flaggedRels = new Set(flagged.map((f) => f.rel));
const staleBaseline = Object.keys(BASELINE).filter((b) => !flaggedRels.has(b));

console.log(`[actor-authority-boundary] flagged=${flagged.length} baseline=${Object.keys(BASELINE).length} new=${newViolations.length} stale_baseline=${staleBaseline.length}`);
if (staleBaseline.length > 0) {
  console.log('  ℹ️  baseline já não casa (binding adicionado/arquivo limpo — pode ser removido do baseline numa futura limpeza):');
  staleBaseline.forEach((b) => console.log(`     - ${b}`));
}

if (newViolations.length > 0) {
  console.error('GATE FAIL [actor-authority-boundary]: NOVA rota lê canal de ator CLIENT-DECLARED sem binding server-side (DECISION-0113):');
  newViolations.forEach((v) => console.error(`  ❌ ${v.rel}  [${v.channels.join(', ')}]  — vincule via authorityService.canActAs/canRepresentActor ou adicione ao BASELINE com DT.`));
  process.exit(1);
}

console.log('GATE OK [actor-authority-boundary] — 6º canal body.actor registrado; nenhuma NOVA violação client-declared sem binding fora do baseline.');
