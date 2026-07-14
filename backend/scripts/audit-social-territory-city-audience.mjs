#!/usr/bin/env node
// Guard consolidado — S-CITY-1 · SOCIAL-TERRITORY-CITY-CURITIBA (DECISION-0176).
// Prova, de forma VIVA (comment-aware + liveness, não presença textual):
//  casa canônica ÚNICA de audiência; write com snapshot Curitiba-only fail-closed; leitura/detalhe compõem
//  a casa; readers paralelos que expõem conteúdo compõem a casa OU estão retirados/dead-at-db (contidos);
//  sem fallback profile/active_location; sem city_id do cliente; sem expansão por env; migration exata;
//  sem Address write/Bank/neighborhood/nacional; N1 dormante preservada; aplicação seletiva estreita.
// Parse/arquivo ausente = FAIL.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
const note = (m) => failures.push(m);

function stripSql(s) { return s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''); }
function stripTs(src) {
  let out = '', i = 0, mode = 'code'; const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; out += c; i++; continue; }
      if (c === '"') { mode = 'dq'; out += c; i++; continue; }
      if (c === '`') { mode = 'tpl'; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (mode === 'line') { if (c === '\n') { mode = 'code'; out += c; } i++; continue; }
    if (mode === 'block') { if (c === '*' && d === '/') { mode = 'code'; i += 2; } else i++; continue; }
    if (c === '\\') { out += c + (d || ''); i += 2; continue; }
    if (mode === 'sq' && c === "'") mode = 'code';
    else if (mode === 'dq' && c === '"') mode = 'code';
    else if (mode === 'tpl' && c === '`') mode = 'code';
    out += c; i++;
  }
  return out;
}
function load(rel, strip) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { note(`ARQUIVO AUSENTE: ${rel}`); return null; }
  const raw = readFileSync(p, 'utf8');
  return { raw, s: strip === 'sql' ? stripSql(raw) : stripTs(raw) };
}

const MIG = load('migrations/20260714120000_posts_audience_city_snapshot.sql', 'sql');
const HOUSE = load('src/modules/social/post-audience.house.ts', 'ts');
const SVC = load('src/modules/social/social-2.0.service.ts', 'ts');
const ROUTES = load('src/modules/social/social-2.0.routes.ts', 'ts');
const SOCIALROUTES = load('src/modules/social/social.routes.ts', 'ts');
const APIFEED = load('src/services/feed/feed.routes.ts', 'ts');
const APPLY = load('scripts/apply-posts-audience-city-migration.mjs', 'ts');

// ── 1. MIGRATION exata ──
if (MIG) {
  if (!/ADD COLUMN audience_city_id UUID NULL/i.test(MIG.s)) note('M1: coluna audience_city_id UUID NULL ausente');
  if (!/REFERENCES cities \(city_id\)/i.test(MIG.s)) note('M2: FK para cities(city_id) ausente');
  if (!/CREATE INDEX idx_posts_audience_city ON posts \(audience_city_id\) WHERE audience_city_id IS NOT NULL/i.test(MIG.s)) note('M3: índice parcial ausente');
  if (/ADD COLUMN audience_city_id UUID NULL[^,;]*\bDEFAULT\b/i.test(MIG.s)) note('M4: audience_city_id com DEFAULT (proibido)');
  if (/UPDATE posts SET audience_city_id|INSERT INTO posts/i.test(MIG.s)) note('M5: backfill/seed na migration (proibido)');
  if (/ADD COLUMN audience_neighborhood_id/i.test(MIG.s)) note('M6: cria audience_neighborhood_id (bairro bloqueado por N5)');
  if (/CREATE TABLE/i.test(MIG.s)) note('M7: tabela paralela na migration');
}

// ── 2. CASA CANÔNICA ÚNICA ──
if (HOUSE) {
  if (!/export function postAudiencePredicateSql\(/.test(HOUSE.s)) note('H1: postAudiencePredicateSql ausente');
  if (!/actor_id = \$\{viewerParam\}/.test(HOUSE.s)) note('H2: bypass de autoria ausente no predicado');
  if (!/audience_city_id IS NULL[\s\S]{0,80}audience_city_id = \$\{viewerCityParam\}/.test(HOUSE.s)) note('H3: predicado territorial (NULL OR = viewerCity) ausente');
  if (!/visibility = 'public'/.test(HOUSE.s) || !/visibility = 'connections'/.test(HOUSE.s)) note('H4: predicado relacional (public/connections) ausente');
  if (!/export async function canViewPost\(/.test(HOUSE.s)) note('H5: canViewPost (detalhe/derivado) ausente');
  if (!/resolveActorTerritory\([^)]*'ACTOR_RESIDENCE'\)/.test(HOUSE.s)) note('H6: resolveViewerResidenceCity não usa ACTOR_RESIDENCE');
  if (/profile|actor_active_location|active_location/i.test(HOUSE.s.replace(/\bactor_id\b/g, ''))) note('H7: casa referencia profile/active_location (proibido)');
  if (/process\.env|getenv|CONFIG\[/i.test(HOUSE.s)) note('H8: casa usa env/config (expansão silenciosa proibida)');
  if (!/'9d431002-1fd3-4b34-ae82-678f28f64288'/.test(HOUSE.s)) note('H9: CURITIBA_CITY_ID canônico ausente');
}

// ── 3. WRITE snapshot Curitiba-only fail-closed ──
if (SVC) {
  const cp = SVC.s.match(/async createPost\([\s\S]*?INSERT INTO posts[\s\S]*?\]\s*\)/);
  const cpBlock = cp ? cp[0] : '';
  if (!/audienceSameCity/.test(SVC.s)) note('W1: intenção audienceSameCity ausente no write');
  if (!/resolveActorTerritory\([^)]*'ACTOR_RESIDENCE'\)/.test(SVC.s)) note('W2: write não resolve residência do autor');
  if (!/!territory\.cityId[\s\S]{0,120}throw/.test(SVC.s)) note('W3: sem residência não é falha fechada (zero write)');
  if (!/territory\.cityId !== CURITIBA_CITY_ID[\s\S]{0,120}throw/.test(SVC.s)) note('W4: cidade ≠ Curitiba não é territorial_audience_not_enabled');
  if (!/territorial_audience_not_enabled/.test(SVC.s)) note('W4b: mensagem territorial_audience_not_enabled ausente');
  if (!/audience_city_id/.test(cpBlock)) note('W5: INSERT não grava audience_city_id');
  if (/audienceCityId\s*=\s*[^C\n;]*req|from.*client|body\.city/i.test(SVC.s)) note('W6: audienceCityId derivado de cliente');
}

// ── 4. LEITURA/DETALHE compõem a casa ──
if (SVC) {
  const uses = (SVC.s.match(/postAudiencePredicateSql\('p'/g) || []).length;
  if (uses < 3) note(`R1: nem todos os readers de coleção compõem a casa (achou ${uses}, esperado >=3)`);
  if (!/async getPostById\([\s\S]{0,400}?canViewPost\(/.test(SVC.s)) note('R2: detalhe-por-id canônico (getPostById via canViewPost) ausente');
  if (!/if \(!allowed\) return null/.test(SVC.s)) note('R2b: getPostById não retorna null quando não autorizado (404 sem revelar existência)');
  // nenhum predicado de audiência PARALELO redefinido no service (só compõe a casa)
  if (/function postVisibilitySql\(|function postAudiencePredicateSql\(/.test(SVC.s)) note('R3: predicado de audiência REDEFINIDO no service (deve só compor a casa)');
}
if (ROUTES) {
  if (!/audience_same_city: z\.boolean\(\)\.optional\(\)/.test(ROUTES.s)) note('RT1: schema aceita audience_same_city como boolean');
  if (/audience_city_id:|audienceCityId:|cityId:.*z\./.test(ROUTES.s)) note('RT2: rota aceita city_id/audience_city_id do cliente (proibido)');
  if (!/validated\.audience_same_city/.test(ROUTES.s)) note('RT3: rota não repassa audience_same_city ao service');
}

// ── 5. DETALHE legado CONVERGIDO + /api/feed RETIRADO ──
if (SOCIALROUTES) {
  if (!/social2Service\.getPostById\(/.test(SOCIALROUTES.s)) note('D1: detalhe /posts/:postId não convergiu para getPostById canônico');
  if (/socialService\.getPost\(/.test(SOCIALROUTES.s)) note('D2: detalhe ainda usa o legado dead-at-db socialService.getPost');
}
if (APIFEED) {
  if (!/410|SOCIAL_LEGACY_API_FEED_RETIRED/.test(APIFEED.s)) note('D3: /api/feed não retirado (410)');
  if (/feedService\.getFeed\(|new FeedService\(/.test(APIFEED.s)) note('D4: /api/feed ainda chama FeedService (bypass) — deve estar retirado');
}

// ── 6. CONTENÇÃO ESTRUTURAL: nenhum reader NOVO de conteúdo de posts sem compor a casa ──
// Escaneia src por queries que SELECIONAM conteúdo de post (p.content / content FROM posts) e expõem —
// devem compor postAudiencePredicateSql/canViewPost, salvo allowlist (dead-at-db conhecidos = colunas
// fantasma → contidos; internos = count/metadata). Revival (dead→live) sem a casa MORDE.
const ALLOW_DEADATDB = [ // selecionam colunas-fantasma (post_id/global_user_id/type/media/event_id) → dead-at-db, contidos
  'src/services/feed/FeedService.ts',
  'src/modules/events/events.service.ts',
  'src/modules/social/social-group.repository.ts',
  'src/modules/social/social-group-insights.routes.ts',
  'src/modules/social/social.repository.ts',
  'src/modules/social/social.service.ts',
];
const PHANTOM = /post_id|global_user_id|\bp\.type\b|\bp\.media\b|\.event_id\b/;
try {
  const walk = (dir, acc) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '__tests__') walk(p, acc); } else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) acc.push(p); } return acc; };
  for (const f of walk(join(ROOT, 'src'), [])) {
    const rel = f.slice(ROOT.length + 1).split('\\').join('/');
    if (/scripts\//.test(rel)) continue;
    const src = stripTs(readFileSync(f, 'utf8'));
    // seleciona conteúdo de post e vem de posts?
    const readsContent = /FROM\s+posts\b[\s\S]{0,600}?\bp?\.?content\b/i.test(src) || /\bp\.content\b[\s\S]{0,600}?FROM\s+posts\b/i.test(src);
    if (!readsContent) continue;
    const composes = /postAudiencePredicateSql\(|canViewPost\(/.test(src);
    if (composes) continue; // OK — compõe a casa
    // não compõe: só é tolerado se for dead-at-db conhecido (colunas fantasma) allowlistado
    if (ALLOW_DEADATDB.includes(rel)) {
      if (!PHANTOM.test(src)) note(`S-revival: ${rel} expõe conteúdo de post, não compõe a casa e NÃO é mais dead-at-db (revival sem enforcement)`);
      continue;
    }
    note(`S-bypass: reader de conteúdo de posts sem compor a casa canônica: ${rel}`);
  }
} catch (e) { note('S-scan: falha no scan de readers: ' + e.message); }

// ── 7. FRONTEIRAS NEGATIVAS nos arquivos tocados ──
for (const [name, F] of [['HOUSE', HOUSE], ['SVC', SVC], ['ROUTES', ROUTES], ['SOCIALROUTES', SOCIALROUTES], ['APIFEED', APIFEED]]) {
  if (!F) continue;
  if (/INSERT INTO addresses|UPDATE addresses|INSERT INTO address_assignments/i.test(F.s)) note(`F1: ${name} escreve em Address`);
  // F2: só MUTAÇÃO financeira/territorial introduzida por esta frente (o read pré-existente de impacto
  // via bank-split.repository em social-2.0.service é legítimo e não é escrita — não conta).
  if (/INSERT INTO (bank_|regional_fund|split_)|UPDATE (bank_|regional_fund|split_)|INTO bank_ledger/i.test(F.s)) note(`F2: ${name} faz DML financeiro (Bank/ledger/split/fundo)`);
  if (/audience_neighborhood_id|neighborhood_id\s*=\s*\$/i.test(F.s)) note(`F3: ${name} referencia neighborhood (bairro bloqueado por N5)`);
}

// ── 8. APLICAÇÃO SELETIVA estreita + N1 preservada ──
if (APPLY) {
  if (!/already !== 0\)[\s\S]{0,60}?throw[\s\S]{0,40}?already_applied/.test(APPLY.s)) note('A1: apply seletivo sem rerun fail-closed (already_applied throw)');
  if (!/MUST_STAY_UNREGISTERED[\s\S]*20260713140000_neighborhood_alias_first/.test(APPLY.s)) note('A2: apply não preserva N1 dormante não-registrada');
  if (!/pg_advisory_xact_lock/.test(APPLY.s)) note('A3: apply sem advisory lock');
  if (!/EXPECTED_SHA256/.test(APPLY.s)) note('A4: apply sem prova de hash do arquivo');
}

// ── runner wiring ──
{
  const runner = existsSync(join(ROOT, 'scripts', 'run-regression-guards.mjs')) ? readFileSync(join(ROOT, 'scripts', 'run-regression-guards.mjs'), 'utf8') : '';
  if (!runner.includes('audit-social-territory-city-audience.mjs')) note('R-runner: guard fora do runner');
}

if (failures.length) {
  console.error('GATE FAIL [social-territory-city-audience]\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('GATE OK [social-territory-city-audience] — casa canônica única de audiência (relacional ⋀ territorial, autoria=bypass); write snapshot Curitiba-only fail-closed (sem residência=zero write; ≠Curitiba=not_enabled; ID canônico server-side, sem env/cliente); leitura/detalhe compõem a casa (getPostById via canViewPost); detalhe legado convergido; /api/feed retirado; nenhum reader de conteúdo de posts sem compor a casa (dead-at-db contidos por colunas-fantasma, revival morde); migration exata (FK cities(city_id), sem default/backfill/enum/bairro); sem Address write/Bank/neighborhood; aplicação seletiva estreita preserva N1 dormante; rerun fail-closed. (Comment-aware + liveness.)');
