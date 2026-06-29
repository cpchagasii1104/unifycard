#!/usr/bin/env node
// Gate estrutural — F-SERVICE-SEARCH-ALIAS-DISCOVERY-SLICE-A.
// Trava os invariantes da PONTE DE BUSCA termo→concept (advisory, discovery-only, money-free):
//   1) tabela service_search_aliases é advisory: FK concept_id→concepts, UNIQUE(normalized_term,
//      concept_id), CHECK review_status proposed|approved|retired; GLOBAL (sem tenant_id/RLS);
//   2) seed é BELEZA-ONLY e NÃO cria significado: aponta para concepts via INNER JOIN, NÃO faz
//      INSERT em concepts/canonical_services/categories, NÃO usa app.concept_governance, FALHA ALTO
//      (RAISE EXCEPTION) se concept-alvo faltar;
//   3) resolver resolveConceptsFromSearchTerm é READ-ONLY (sem INSERT/UPDATE/DELETE em
//      service_search_aliases) e só serve ponte viva+curada (is_active + review_status='approved');
//   4) método searchByTerm NÃO escreve alias, reusa discoverServices (descoberta concept-keyed) e
//      NÃO toca publicação gated (offerable / DECISION-0144 / canRepresentActor);
//   5) rota /search-by-term é fastify.get (READ-ONLY GET);
//   6) runtime NUNCA revive occupations_reference nem usa concept_labels como resolver de identidade;
//   7) caminho do alias é money-free (sem bank_ledger/bank_transactions/processRidePayment).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MIG_CREATE = join(ROOT, 'migrations/20260629140000_create_service_search_aliases.sql');
const MIG_SEED = join(ROOT, 'migrations/20260629150000_seed_service_search_aliases_beauty.sql');
const ADAPTER = join(ROOT, 'src/core/semantic/semantic.adapter.ts');
const SVC = join(ROOT, 'src/modules/services/services-discovery.service.ts');
const ROUTES = join(ROOT, 'src/modules/services/services-discovery.routes.ts');

const failures = [];
let checked = 0;

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/--[^\n]*/g, '');

// 1) Migration de criação: tabela advisory bem-formada.
{
  const raw = read(MIG_CREATE);
  if (!raw) {
    failures.push('SSA_REGRESSION: migration de criação service_search_aliases ausente.');
  } else {
    checked++;
    const sql = stripSql(raw);
    if (!/CREATE TABLE IF NOT EXISTS service_search_aliases/i.test(sql)) {
      failures.push('SSA_REGRESSION: CREATE TABLE service_search_aliases ausente.');
    }
    if (!/concept_id\s+UUID\s+NOT NULL\s+REFERENCES\s+concepts\s*\(\s*concept_id\s*\)/i.test(sql)) {
      failures.push('SSA_REGRESSION: concept_id sem FK NOT NULL para concepts(concept_id) — lado-valor tem de ser concept soberano.');
    }
    if (!/UNIQUE\s*\(\s*normalized_term\s*,\s*concept_id\s*\)/i.test(sql)) {
      failures.push('SSA_REGRESSION: UNIQUE(normalized_term, concept_id) ausente — par alias→concept poderia duplicar.');
    }
    if (!/review_status\s+IN\s*\(\s*'proposed'\s*,\s*'approved'\s*,\s*'retired'\s*\)/i.test(sql)) {
      failures.push('SSA_REGRESSION: CHECK review_status (proposed|approved|retired) ausente — curadoria sem vocabulário travado.');
    }
    // GLOBAL: catálogo não tem tenant_id nem RLS (igual concepts/cnae_concept_suggestions).
    if (/\btenant_id\b/i.test(sql)) {
      failures.push('SSA_REGRESSION: service_search_aliases tem tenant_id — catálogo/alias é GLOBAL, não tenant-scoped.');
    }
    if (/ENABLE\s+ROW\s+LEVEL\s+SECURITY|FORCE\s+ROW\s+LEVEL\s+SECURITY|CREATE\s+POLICY/i.test(sql)) {
      failures.push('SSA_REGRESSION: RLS em service_search_aliases — catálogo é global; RLS de catálogo fora de escopo.');
    }
  }
}

// 2) Migration de seed: beleza-only, não cria significado, fail-closed.
{
  const raw = read(MIG_SEED);
  if (!raw) {
    failures.push('SSA_REGRESSION: migration de seed beleza ausente.');
  } else {
    checked++;
    const sql = stripSql(raw);
    if (/INSERT\s+INTO\s+public\.concepts|INSERT\s+INTO\s+concepts\b/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed faz INSERT em concepts — alias NÃO cria significado (proibido nesta frente).');
    }
    if (/INSERT\s+INTO\s+(public\.)?canonical_services|INSERT\s+INTO\s+(public\.)?categories/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed faz INSERT em canonical_services/categories — alias só insere ponte.');
    }
    if (/app\.concept_governance/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed usa app.concept_governance — não deveria (não cria concept).');
    }
    if (!/INSERT\s+INTO\s+(public\.)?service_search_aliases/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed não insere em service_search_aliases (alias vazio?).');
    }
    // lado-valor resolvido por JOIN a concepts (não inventa concept_id literal).
    if (!/INNER JOIN\s+(public\.)?concepts\b/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed não resolve concept via INNER JOIN concepts — risco de concept_id fabricado.');
    }
    // fail-closed: tem de abortar alto se concept-alvo faltar.
    if (!/RAISE EXCEPTION/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed sem RAISE EXCEPTION — não falha alto quando concept-alvo falta.');
    }
    // beleza-only: nenhum domínio não-beleza no seed (defesa anti-escopo).
    if (/\b(advocacia|mecanic|encanad|eletricist|pedreir|motorista|transporte)\b/i.test(sql)) {
      failures.push('SSA_REGRESSION: seed contém termo fora de beleza — Slice-A é beleza-only.');
    }
  }
}

// 3) Resolver no semantic.adapter: READ-ONLY + filtro curado.
{
  const raw = read(ADAPTER);
  if (!raw) {
    failures.push('SSA_REGRESSION: semantic.adapter.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    const m = code.match(/export async function resolveConceptsFromSearchTerm\([\s\S]*?\n}/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('SSA_REGRESSION: resolveConceptsFromSearchTerm ausente — ponte de leitura some.');
    } else {
      if (/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i.test(body)) {
        failures.push('SSA_REGRESSION: resolveConceptsFromSearchTerm contém ESCRITA — resolver é READ-ONLY (runtime nunca grava alias).');
      }
      if (!/is_active\s*=\s*true/.test(body) || !/review_status\s*=\s*'approved'/.test(body)) {
        failures.push("SSA_REGRESSION: resolver não filtra is_active=true + review_status='approved' — ponte não-curada vazaria.");
      }
      if (!/service_search_aliases/.test(body)) {
        failures.push('SSA_REGRESSION: resolver não lê service_search_aliases — substrato errado.');
      }
      if (/concept_labels/.test(body)) {
        failures.push('SSA_REGRESSION: resolver usa concept_labels — proibido (label é apresentação, não resolve identidade).');
      }
    }
  }
}

// 4) Método searchByTerm: sem escrita de alias, reusa discoverServices, não toca publicação gated.
{
  const raw = read(SVC);
  if (!raw) {
    failures.push('SSA_REGRESSION: services-discovery.service.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    const m = code.match(/async searchByTerm\([\s\S]*?(?=\n {2}async |\n}\s*$)/);
    const body = m ? m[0] : '';
    if (!body) {
      failures.push('SSA_REGRESSION: método searchByTerm ausente.');
    } else {
      if (/INSERT\s+INTO\s+(public\.)?service_search_aliases/i.test(body)) {
        failures.push('SSA_REGRESSION: searchByTerm grava service_search_aliases — runtime NUNCA escreve alias.');
      }
      if (!/resolveConceptsFromSearchTerm\s*\(/.test(body)) {
        failures.push('SSA_REGRESSION: searchByTerm não resolve via resolveConceptsFromSearchTerm — trilho paralelo.');
      }
      if (!/discoverServices\s*\(/.test(body)) {
        failures.push('SSA_REGRESSION: searchByTerm não reusa discoverServices — descoberta concept-keyed contornada.');
      }
      if (/canRepresentActor\s*\(|assertActorRepresentable\s*\(|offerable|SERVICE_ELIGIBILITY_DECLARATION_REQUIRED/.test(body)) {
        failures.push('SSA_REGRESSION: searchByTerm toca caminho de publicação gated (offerable/DECISION-0144) — descobrir ≠ poder publicar.');
      }
      if (/bank_ledger|bank_transactions|processRidePayment|createSimpleTransaction|payment_intent/i.test(body)) {
        failures.push('SSA_REGRESSION: searchByTerm toca dinheiro — frente é money-free.');
      }
    }
  }
}

// 5) Rota /search-by-term: READ-ONLY GET; 6) não revive occupations_reference no caminho de serviços.
{
  const raw = read(ROUTES);
  if (!raw) {
    failures.push('SSA_REGRESSION: services-discovery.routes.ts ausente.');
  } else {
    checked++;
    const code = stripTs(raw);
    if (!/fastify\.get\('\/search-by-term'/.test(code)) {
      failures.push('SSA_REGRESSION: rota /search-by-term não é fastify.get — descoberta tem de ser READ-ONLY GET.');
    }
    if (/fastify\.(post|put|patch|delete)\('\/search-by-term'/.test(code)) {
      failures.push('SSA_REGRESSION: existe verbo de ESCRITA em /search-by-term — proibido.');
    }
    if (/occupations_reference/i.test(code)) {
      failures.push('SSA_REGRESSION: occupations_reference referenciado nas rotas de descoberta — substrato arquivado/morto não revive.');
    }
  }
}

console.log(`[service-search-alias-discovery] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-search-alias-discovery]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-search-alias-discovery] — alias advisory (FK/UNIQUE/CHECK, global); seed beleza-only sem criar significado + fail-closed; resolver READ-ONLY + filtro approved; searchByTerm reusa discovery sem tocar publicação gated nem dinheiro; rota GET; occupations_reference não revive.');
