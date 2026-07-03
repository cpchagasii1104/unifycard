#!/usr/bin/env node
// Guard — F-GLOBAL-SEARCH-OMNI-SLICE-A (omnibox federado GET /search?q=).
//
// Protege as 4 invariantes da fatia:
//   1. ANTI-PII: o resolver de identidades (search-omni.service) NUNCA seleciona colunas
//      sensíveis de actors (user_id/global_user_id/external_id/kyc_*/metadata) — a projeção
//      pública é id/display_name/slug/avatar_url/bio/actor_type e NADA além (D13/IDENTITY_SSOT).
//   2. VOCABULÁRIO CANÔNICO (DECISION-0157): a query de identidades só admite actor_type
//      'user'/'page' — valor legado (person/company/actor_human/...) em superfície nova é regressão.
//   3. LEI DE COERÊNCIA (sem verdade paralela): o omni federa os readers canônicos —
//      servicesDiscoveryService.searchByTerm (serviços) + searchCanonicalItems (produtos) +
//      eventsService.searchEvents (eventos) + groupsService.listGroups (grupos). Se o service
//      deixar de importar/usar qualquer um deles e ganhar SQL próprio dessas entidades, morde.
//   4. PISO DE DISCOVERY: searchEvents mantém status IN ('published','active') — o `term` do omni
//      é aditivo e NÃO pode afrouxar o piso (draft/private não vazam pela busca).
//   + wiring: rota registrada no app.builder (prefix /search) e módulo existente.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
function read(p) {
  try { return readFileSync(join(ROOT, p), 'utf-8'); } catch { return ''; }
}
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').replace(/\/\/[^\n]*/g, '');
}

// ── 1+2: resolver de identidades — projeção segura + vocabulário canônico ──
{
  const src = stripComments(read('src/modules/search/search-omni.service.ts'));
  if (!src) {
    failures.push('search-omni.service.ts ausente — a fatia F-GLOBAL-SEARCH-OMNI foi removida sem decisão.');
  } else {
    // extrai o(s) SELECT ... FROM actors do service
    const actorSelects = src.match(/SELECT[\s\S]{0,400}?FROM\s+actors/gi) || [];
    if (actorSelects.length === 0) {
      failures.push('search-omni.service.ts: nenhum SELECT FROM actors — resolver de identidades sumiu (ou virou verdade paralela em outro lugar).');
    }
    for (const sel of actorSelects) {
      for (const col of ['user_id', 'global_user_id', 'external_id', 'kyc_verified_at', 'kyc_limit_cents', 'metadata', 'company_id', 'group_id']) {
        // limita o cheque à lista de colunas do SELECT (antes do FROM)
        const selectList = sel.replace(/FROM\s+actors/i, '');
        if (new RegExp(`\\b${col}\\b`).test(selectList)) {
          failures.push(`ANTI-PII: SELECT de actors no omni projeta coluna sensível '${col}' — a projeção pública é id/display_name/slug/avatar_url/bio/actor_type e NADA além.`);
        }
      }
    }
    // vocabulário canônico na cláusula de tipo
    if (!/actor_type\s+IN\s*\(\s*'user'\s*,\s*'page'\s*\)/i.test(src)) {
      failures.push("VOCABULÁRIO (DECISION-0157): a query de identidades deve restringir actor_type IN ('user','page') — superfície nova nunca expõe vocabulário legado.");
    }
    for (const legacy of ['person', 'actor_human', 'actor_organizational', 'actor_system']) {
      if (new RegExp(`'${legacy}'`).test(src)) {
        failures.push(`VOCABULÁRIO: valor legado '${legacy}' apareceu no search-omni.service — regressão do freeze D-C2.`);
      }
    }
    // 3: federação reusa readers canônicos
    for (const [imp, why] of [
      ['servicesDiscoveryService', 'serviços (alias→concept)'],
      ['searchCanonicalItems', 'produtos (item canônico)'],
      ['eventsService', 'eventos (piso de discovery)'],
      ['groupsService', 'grupos (reader canônico)'],
    ]) {
      if (!src.includes(imp)) {
        failures.push(`COERÊNCIA: omni deixou de federar o reader canônico de ${why} (${imp}) — se a seção ganhou SQL próprio, nasceu verdade paralela.`);
      }
    }
    for (const tbl of ['services', 'canonical_products', 'events', 'groups']) {
      if (new RegExp(`FROM\\s+${tbl}\\b`, 'i').test(src)) {
        failures.push(`COERÊNCIA: search-omni.service tem SQL direto em '${tbl}' — essas entidades DEVEM vir dos readers canônicos federados.`);
      }
    }
  }
}

// ── 4: piso de discovery de eventos intacto (o term não pode afrouxar) ──
{
  const src = stripComments(read('src/modules/events/events.service.ts'));
  if (!/status\s+IN\s*\(\s*'published'\s*,\s*'active'\s*\)/i.test(src)) {
    failures.push("PISO DE DISCOVERY: searchEvents perdeu o filtro status IN ('published','active') — draft/cancelled vazariam pela busca (regressão F6.5.6b-CANAL5-C).");
  }
  if (!/term/.test(src.slice(src.indexOf('async searchEvents'), src.indexOf('async searchEvents') + 2500))) {
    failures.push('searchEvents perdeu o suporte a `term` — a seção de eventos do omni quebra silenciosamente (fail-soft mascararia).');
  }
}

// ── wiring: rota + produto compartilhado ──
{
  const builder = stripComments(read('src/app.builder.ts'));
  if (!/search\.module/.test(builder) || !/prefix:\s*'\/search'/.test(builder)) {
    failures.push("WIRING: app.builder não registra o searchModule sob prefix '/search' — o omnibox morreu sem decisão.");
  }
  const prodRoute = stripComments(read('src/modules/marketplace/marketplace-canonical-search.routes.ts'));
  if (!/searchCanonicalItems/.test(prodRoute)) {
    failures.push('COERÊNCIA: /catalog/items/search deixou de usar searchCanonicalItems — o SELECT canônico de itens voltou a se duplicar (1 verdade, 2 callers).');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [search-omni-federation-contract]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [search-omni-federation-contract] — omnibox federado íntegro: projeção de identidade ANTI-PII (id/display_name/slug/avatar/bio apenas), vocabulário canônico user/page (DECISION-0157), federação via readers canônicos (Lei de Coerência, zero SQL paralelo), piso de discovery de eventos intacto, rota /search wired.');
