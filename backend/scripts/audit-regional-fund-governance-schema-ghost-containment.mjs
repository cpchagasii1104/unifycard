#!/usr/bin/env node
// Guard estrutural — F-REGIONAL-FUND-GOVERNANCE-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (achado
// colateral da Fatia 9 passo 3, DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST).
//
// As tabelas `regional_fund_proposals`/`regional_fund_votes` são schema ghost (ausentes no schema
// vivo). A rota estava VIVA e registrada (unifybank.module.ts), exigindo só `req.user`, alcançando
// `regionalFundGovernanceService` → 42P01/500 cru pra qualquer autenticado. Contida na BORDA
// (mesmo padrão de contact.routes.ts). FALHA se:
//   (a) o guard de feature sumir (to_regclass duplo + AppError 501 + REGIONAL_FUND_GOVERNANCE_
//       SCHEMA_GHOST_CONTAINED);
//   (b) a rota voltar a chamar regionalFundGovernanceService (religação exige gênese do schema,
//       frente própria);
//   (c) a rota perder o 501 CONTAINED em qualquer um dos 7 endpoints;
//   (d) aparecer CREATE TABLE regional_fund_proposals/regional_fund_votes em migration viva
//       (gênese é frente própria, NÃO esta contenção).
// Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const MOD = join(ROOT, 'src', 'core', 'unifybank');
const GUARD = join(MOD, 'regional-fund-governance-feature.guard.ts');
const ROUTES = join(MOD, 'regional-fund-governance.routes.ts');
const MIGRATIONS = join(ROOT, 'migrations');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

// (a) guard de feature.
const guard = read(GUARD);
must(guard, 'regional-fund-governance-feature.guard.ts ausente');
must(/to_regclass\('public\.regional_fund_proposals'\)/.test(guard), 'guard não faz probe to_regclass(public.regional_fund_proposals)');
must(/to_regclass\('public\.regional_fund_votes'\)/.test(guard), 'guard não faz probe to_regclass(public.regional_fund_votes)');
must(/new AppError\(\s*501/.test(guard), 'guard não lança 501');
must(/REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED/.test(guard), 'guard sem code REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED');

// (b)+(c) rota contida — comment-stripped (não confundir menção em comentário com uso real).
const rawRoutes = read(ROUTES);
must(rawRoutes, 'regional-fund-governance.routes.ts ausente');
const routes = rawRoutes.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
must(/REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED/.test(routes), 'rota não retorna code REGIONAL_FUND_GOVERNANCE_SCHEMA_GHOST_CONTAINED');
const contained501 = (routes.match(/reply\.status\(\s*501\s*\)\.send\(\s*CONTAINED\s*\)/g) || []).length;
must(contained501 >= 7, `rota esperado >= 7 endpoints contidos (501 CONTAINED), encontrados ${contained501} — não remover rotas`);
must(!/regionalFundGovernanceService\./.test(routes), 'rota voltou a chamar regionalFundGovernanceService (religação exige frente própria — gênese do schema)');
must(!/regionalFundGovernanceRateLimitService\./.test(routes), 'rota voltou a chamar o rate-limit service (caminho pro service alcançável de novo)');
must(!/req\.user\.id[\s\S]{0,80}resolveGlobalUserId/.test(routes), 'rota voltou a resolver globalUserId — sinal de lógica real reintroduzida na borda');

// (d) nenhuma migration viva cria as tabelas.
const migs = existsSync(MIGRATIONS) ? readdirSync(MIGRATIONS) : [];
let created = false;
for (const f of migs) {
  if (!/\.sql$/.test(f)) continue;
  const sql = read(join(MIGRATIONS, f));
  if (/CREATE TABLE (IF NOT EXISTS )?regional_fund_(proposals|votes)\b/i.test(sql)) created = true;
}
must(!created, 'migration viva cria regional_fund_proposals/regional_fund_votes (gênese é frente própria, NÃO esta contenção)');

if (failures.length) {
  console.error('GATE FAIL [regional-fund-governance-schema-ghost-containment]:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[regional-fund-governance-schema-ghost-containment] rota contida na borda (7 endpoints, 501 CONTAINED); zero caller de regionalFundGovernanceService; probe duplo to_regclass; nenhuma migration cria o schema.');
console.log('GATE OK [regional-fund-governance-schema-ghost-containment] — DT-REGIONAL-FUND-GOVERNANCE-LIVE-SCHEMA-GHOST contido fail-closed; gênese segue OPEN.');
