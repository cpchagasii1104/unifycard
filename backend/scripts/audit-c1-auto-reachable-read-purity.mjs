#!/usr/bin/env node
// Gate estrutural — F-C1-AUTO-REACHABLE-READ-PURITY
// Impede regressão de write-on-GET / get-or-create / ensure-materializing / zero-falso nos
// GETs AUTO/REQUIRED-REACHABLE do caminho C1 (nascimento → sessão → onboarding → primeira Home).
//
// Invariante: nenhum GET auto/required-reachable cria actor/profile/identity/referral, faz
// upsert/insert/update, get-or-create, ensure materializador, nem transforma falha estrutural
// em zero/null/200 falso. NÃO declara C1/gender/Home/convite fechados.
//
// Classificações: PURE_APPROVED / KNOWN_OPEN / TOMBSTONE / FINANCIAL_HARD_STOP /
//                 FORBIDDEN_REGRESSION / NEW_UNCLASSIFIED.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(process.cwd(), 'src');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const failures = [];
const surfaces = [];

function region(src, startMarker, endMarker) {
  const i = src.indexOf(startMarker);
  if (i < 0) return '';
  const j = endMarker ? src.indexOf(endMarker, i + startMarker.length) : src.length;
  return src.slice(i, j > i ? j : src.length);
}

// ── 1. GET /social/actors/available → findAvailableActors NÃO cria actor ──
{
  const src = read('modules/social/actor.repository.ts');
  const m = region(src, 'async findAvailableActors(', 'async findOrCreateUserActorTx(');
  const fallback = m || region(src, 'async findAvailableActors(', 'async findByUserId(');
  const ok = !!fallback && !/findOrCreateUserActor\(/.test(fallback) && /findByUserId\(/.test(fallback);
  surfaces.push(['/social/actors/available', ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push('FORBIDDEN_REGRESSION: findAvailableActors deve LER (findByUserId), nunca findOrCreateUserActor (write-on-GET).');
}

// ── 2. GET /profile → handler NÃO cria profile ──
{
  const src = read('core/profile/profile.routes.ts');
  const m = region(src, 'const getProfileHandler', 'const updateProfileHandler') || region(src, "route: '/profile',", "GET /profile/progress");
  const ok = !!m && !/createProfileIfNotExists\(/.test(m);
  surfaces.push(['/profile', ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push('FORBIDDEN_REGRESSION: GET /profile não pode chamar createProfileIfNotExists (write-on-GET).');
}

// ── 3. GET /core/profile → getCoreProfile NÃO ensureUserActor nem getOrCreateReferralCode ──
{
  const src = read('core/core.service.ts');
  const okActor = !/await ensureUserActor\(/.test(src) && !/= ensureUserActor\(/.test(src);
  const okRef = !/getOrCreateReferralCode\(/.test(src);
  const ok = okActor && okRef;
  surfaces.push(['/core/profile', ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!okActor) failures.push('FORBIDDEN_REGRESSION: getCoreProfile não pode chamar ensureUserActor (ensure-materializing em GET).');
  if (!okRef) failures.push('FORBIDDEN_REGRESSION: getCoreProfile não pode chamar getOrCreateReferralCode (write-on-GET).');
}

// ── 4. GET /identity/me → NÃO cria profile ──
{
  const src = read('core/identity/identity.routes.ts');
  const ok = !/createProfileIfNotExists\(/.test(src);
  surfaces.push(['/identity/me', ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push('FORBIDDEN_REGRESSION: GET /identity/me não pode chamar createProfileIfNotExists (write-on-GET).');
}

// ── 5. GET /referral/code → LÊ (getReferralCode); só o POST /code gera ──
{
  const src = read('core/referral/referral.routes.ts');
  const get = region(src, "fastify.get('/code'", "fastify.post('/code'");
  const post = region(src, "fastify.post('/code'", "POST /referral/apply") || region(src, "fastify.post('/code'", undefined);
  const okGet = !!get && /getReferralCode\(/.test(get) && !/getOrCreateReferralCode\(/.test(get);
  const okPost = /getOrCreateReferralCode\(/.test(post); // writer explícito existe
  surfaces.push(['/referral/code', okGet ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!okGet) failures.push('FORBIDDEN_REGRESSION: GET /referral/code deve LER (getReferralCode), nunca getOrCreateReferralCode (write-on-GET).');
  if (!okPost) failures.push('NEW_UNCLASSIFIED: falta o writer explícito POST /referral/code (getOrCreateReferralCode idempotente).');
}

// ── 6. GET /profile/progress → erro estrutural NÃO vira 200/zero falso ──
{
  const src = read('core/profile/profile.routes.ts');
  const m = region(src, 'GET /profile/progress', '};\n');
  const prog = region(src, "fastify.get('/progress'", "export default") || src.slice(src.indexOf("/progress"));
  // o catch do /progress deve retornar status(500), não ok:true com progress:0
  const catchBlock = region(prog, '} catch (error) {', '});');
  const ok = /status\(500\)/.test(catchBlock) && !/ok:\s*true/.test(catchBlock);
  void m;
  surfaces.push(['/profile/progress', ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push('FORBIDDEN_REGRESSION: catch de GET /profile/progress deve retornar erro 500 observável, não 200 com progress:0 falso.');
}

// ── 7. unread counters → countOrNull (sem zero falso) ──
for (const f of ['modules/social/social.routes.ts', 'core/feed/feed.routes.ts']) {
  const src = read(f);
  const block = region(src, "'/unread-counts'", undefined);
  const ok = /countOrNull/.test(block) && !/const countOrZero/.test(block) && /return null;/.test(block);
  surfaces.push([`unread:${f.includes('feed') ? 'feed' : 'social'}`, ok ? 'PURE_APPROVED' : 'FORBIDDEN_REGRESSION']);
  if (!ok) failures.push(`FORBIDDEN_REGRESSION: ${f} unread-counts deve usar countOrNull (erro → null), nunca countOrZero (zero falso).`);
}

console.log('[c1-read-purity] denominador AUTO/REQUIRED-REACHABLE:');
for (const [s, c] of surfaces) console.log(`  - ${s}: ${c}`);
const knownOpen = surfaces.filter(([, c]) => c === 'KNOWN_OPEN').length;
console.log(`PURE_APPROVED=${surfaces.filter(([, c]) => c === 'PURE_APPROVED').length} KNOWN_OPEN=${knownOpen} FORBIDDEN_REGRESSION=${surfaces.filter(([, c]) => c === 'FORBIDDEN_REGRESSION').length}`);
console.log('[c1-read-purity] NOTA: NÃO declara C1 completo / gender / Home financeira / convite — fatias próprias.');

if (failures.length > 0) {
  console.error('GATE FAIL [c1-read-purity]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [c1-read-purity] — GETs auto/required-reachable são leitura pura (sem write/ensure/zero-falso). KNOWN_OPEN=0 na família.');
