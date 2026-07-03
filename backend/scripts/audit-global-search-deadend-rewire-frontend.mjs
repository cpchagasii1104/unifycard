#!/usr/bin/env node
// Guard estrutural — F-GLOBAL-SEARCH-DEADEND-REWIRE-SLICE-A (2026-07-01).
//
// A busca universal AINDA NÃO existe. Esta fatia matou os dead-ends visíveis da busca reapontando-os para
// a única busca semanticamente viva — descoberta de serviços (/discover/services?term=..., termo→alias→
// CONCEPT→discovery, resolvido no backend). Frontend-only, money-free, authority-free, sem busca federada.
//
// MORDE (regressão real) se voltar qualquer dead-end:
//   (A) GlobalHeader.tsx: navigate('/marketplace?q= (o Marketplace ignora q) — deve apontar para
//       /discover/services?term=.
//   (B) MarketplaceSimpleHeader.tsx: handleSearch terminar em console.log (busca fake) — deve navegar
//       para /discover/services?term=.
//   (C) SearchPage.tsx: placeholder "em desenvolvimento" SEM caminho real — deve ou redirecionar
//       (Navigate) ou navegar/linkar para /discover/services.
//   (D) ServiceDiscoveryPage.tsx: deixar de consumir o termo da URL (useSearchParams + .get('term')) —
//       senão o header manda o termo e a página o ignora (novo dead-end silencioso).
//
// Heurística textual comment-stripped (não AST). Integrado em validate:regression-guards. NÃO toca backend/src.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const GLOBAL_HEADER = join(FE_SRC, 'components', 'layout', 'GlobalHeader.tsx');
const MKT_HEADER = join(FE_SRC, 'components', 'marketplace', 'MarketplaceSimpleHeader.tsx');
const SEARCH_PAGE = join(FE_SRC, 'pages', 'SearchPage.tsx');
const DISCOVERY_PAGE = join(FE_SRC, 'pages', 'ServiceDiscoveryPage.tsx');

// strip //-comment, /* */-comment e {/* jsx comment */}
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => { if (!existsSync(p)) { failures.push(`arquivo ausente: ${p}`); return null; } return stripTs(readFileSync(p, 'utf-8')); };

const failures = [];
const DISCOVERY_TARGET = /\/discover\/services\?term=/;

// (A) GlobalHeader — sem /marketplace?q= ; com destino de discovery.
const gh = read(GLOBAL_HEADER);
if (gh !== null) {
  if (/\/marketplace\?q=/.test(gh)) failures.push('GlobalHeader.tsx: navigate(/marketplace?q=…) reapareceu — dead-end (Marketplace ignora q). Apontar para /discover/services?term=.');
  if (!DISCOVERY_TARGET.test(gh)) failures.push('GlobalHeader.tsx: a busca do header não aponta mais para /discover/services?term= (rewire perdido).');
}

// (B) MarketplaceSimpleHeader — handleSearch sem console.log ; com destino de discovery.
const mh = read(MKT_HEADER);
if (mh !== null) {
  const m = mh.match(/handleSearch\s*=\s*[\s\S]*?\n\s{2}\};/);
  const body = m ? m[0] : mh;
  if (/console\.log/.test(body)) failures.push('MarketplaceSimpleHeader.tsx: handleSearch voltou a terminar em console.log (busca fake).');
  if (!DISCOVERY_TARGET.test(mh)) failures.push('MarketplaceSimpleHeader.tsx: handleSearch não navega para /discover/services?term= (rewire perdido).');
}

// (C) SearchPage — sem placeholder "em desenvolvimento" morto ; com caminho real p/ discovery.
const sp = read(SEARCH_PAGE);
if (sp !== null) {
  const hasRealPath = /\/discover\/services/.test(sp) && /(Navigate|navigate\(|<Link)/.test(sp);
  if (/em desenvolvimento/i.test(sp) && !hasRealPath) failures.push('SearchPage.tsx: placeholder "em desenvolvimento" sem caminho real — deve redirecionar/linkar para /discover/services.');
  if (!/\/discover\/services/.test(sp)) failures.push('SearchPage.tsx: não oferece caminho para /discover/services (página voltou a ser dead-end).');
}

// (D) ServiceDiscoveryPage — consome o termo da URL.
const dp = read(DISCOVERY_PAGE);
if (dp !== null) {
  if (!/useSearchParams/.test(dp)) failures.push("ServiceDiscoveryPage.tsx: não usa useSearchParams — o termo vindo da URL (?term=) deixaria de ser consumido.");
  if (!/get\(\s*['"]term['"]\s*\)/.test(dp)) failures.push("ServiceDiscoveryPage.tsx: não lê searchParams.get('term') — header manda termo e a página o ignora (dead-end silencioso).");
}

// (E) F-GLOBAL-SEARCH-OMNI Slice B — a busca universal AGORA EXISTE (nota histórica do topo superada):
// o GlobalHeader deve manter o omnibox federado wired (client searchOmni de api/search →
// GET /search?q= do backend + OmniSearchDropdown com a pista IR PARA vinda da projeção
// getNavigationModules). Sumir qualquer peça = regressão ao estado dead-end.
const OMNI_CLIENT = join(FE_SRC, 'api', 'search.ts');
const OMNI_DROPDOWN = join(FE_SRC, 'components', 'layout', 'OmniSearchDropdown.tsx');
const oc = read(OMNI_CLIENT);
if (oc !== null && !/\/search\?q=/.test(oc)) {
  failures.push('api/search.ts: client do omnibox não bate mais em /search?q= (§9.3) — contrato com o gateway federado quebrado.');
}
const od = read(OMNI_DROPDOWN);
if (od !== null) {
  for (const section of ['Ir para', 'Pessoas', 'Empresas', 'Grupos', 'Serviços', 'Produtos', 'Eventos']) {
    if (!od.includes(section)) failures.push(`OmniSearchDropdown.tsx: seção "${section}" sumiu do omnibox — pista removida sem decisão.`);
  }
}
if (gh !== null) {
  if (!/searchOmni/.test(gh)) failures.push('GlobalHeader.tsx: deixou de consumir searchOmni — o omnibox federado (Slice B) foi deswired; a barra voltou a ser funil de uma vertical só.');
  if (!/getNavigationModules/.test(gh)) failures.push('GlobalHeader.tsx: pista IR PARA perdeu a projeção getNavigationModules — ou virou rota hardcoded (violaria "navegação organiza, não define verdade") ou sumiu.');
  if (!/OmniSearchDropdown/.test(gh)) failures.push('GlobalHeader.tsx: OmniSearchDropdown não é mais renderizado — omnibox morto no header.');
}

if (failures.length > 0) {
  console.error('GATE FAIL [global-search-deadend-rewire-frontend]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [global-search-deadend-rewire-frontend] — omnibox federado wired no GlobalHeader (searchOmni → GET /search?q= + IR PARA via projeção de navegação + 7 seções no dropdown); fallback de página cheia (/discover/services?term=) preservado; MarketplaceSimpleHeader/SearchPage/ServiceDiscoveryPage íntegros.');
