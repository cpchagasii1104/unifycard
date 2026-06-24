#!/usr/bin/env node
// Gate estrutural — DECISION-0118 D2 (autoridade polimórfica do owner temporal).
// F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE — vigia o retorno
// da confusão resource-owner ↔ authority-actor na família da Unified Availability.
// Integrado em validate:regression-guards.
//
// Análise comment-stripped ORDER-SAFE (herdada dos gates PJ/canônico).
// Heurística textual, não AST; falso positivo torna o gate MAIS restritivo.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(process.cwd(), 'src');
const MIGRATIONS = join(process.cwd(), 'migrations');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let closed = 0;
function check(surface, ok, failMsg) {
  if (ok) closed++;
  else failures.push(`FORBIDDEN_REGRESSION: [${surface}] ${failMsg}`);
}

const read = (p) => stripComments(readFileSync(p, 'utf-8'));

// ── FAMÍLIA TEMPORAL (denominador explícito) ──────────────────────────────────
const FAMILY = [
  'core/availability/unified-availability.types.ts',
  'core/availability/unified-availability.service.ts',
  'core/availability/unified-availability.repository.ts',
  'core/availability/unified-availability.routes.ts',
  'core/availability/availability-owner-authority.ts',
  'core/availability/weekly-template-materializer.service.ts',
  'modules/services/service-offering.service.ts',
];

const types = read(join(SRC, 'core/availability/unified-availability.types.ts'));
const routes = read(join(SRC, 'core/availability/unified-availability.routes.ts'));
const resolver = read(join(SRC, 'core/availability/availability-owner-authority.ts'));
const soService = read(join(SRC, 'modules/services/service-offering.service.ts'));

// 1) ENUM ↔ CHECK físico: vocabulários ESPELHADOS (nem drift, nem owner_type livre).
{
  const enumBlock = (types.match(/export enum AvailabilityOwnerType\s*\{([\s\S]*?)\}/) ?? [, ''])[1];
  const enumValues = [...enumBlock.matchAll(/=\s*'([a-z_]+)'/g)].map((m) => m[1]).sort();
  // CHECK vigente = a ÚLTIMA migration (forward-only) que (re)define chk_availability_owner_type. Cada DROP+ADD
  // redefine o vocabulário; a definição canônica migra de arquivo (ex.: 20260624 adiciona rentable_resource).
  // Ler a fixa antiga daria falso "drift" quando um owner_type novo entra noutra migration.
  const CHECK_RE = /ADD CONSTRAINT chk_availability_owner_type\s+CHECK \(owner_type IN \(([^)]+)\)\)/;
  const defining = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql') && CHECK_RE.test(readFileSync(join(MIGRATIONS, f), 'utf-8')))
    .sort();
  const latest = defining[defining.length - 1];
  const checkMatch = latest ? readFileSync(join(MIGRATIONS, latest), 'utf-8').match(CHECK_RE) : null;
  const checkValues = checkMatch ? [...checkMatch[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort() : [];
  check('temporal:enum-check-parity',
    enumValues.length > 0 && checkValues.length > 0 && JSON.stringify(enumValues) === JSON.stringify(checkValues),
    `AvailabilityOwnerType (${enumValues.join(',')}) ≠ CHECK físico (${checkValues.join(',')}) — vocabulário divergiu (DECISION-0118 D2).`);
  check('temporal:service-offering-in-enum',
    enumValues.includes('service_offering'),
    'service_offering saiu do enum canônico com writer vivo (volta do drift `as never`).');
}

// 2) `as never` PROIBIDO na família temporal.
for (const f of FAMILY) {
  const p = join(SRC, f);
  if (!existsSync(p)) {
    failures.push(`FORBIDDEN_REGRESSION: arquivo da família temporal desapareceu: ${f}`);
    continue;
  }
  check(`temporal:no-as-never:${f}`, !/\bas never\b/.test(read(p)),
    `${f} reintroduziu \`as never\` (vocabulário contornado por cast — proibido, DECISION-0118 D2).`);
}

// 3) ROTAS usam o resolver central; PROIBIDO ownerId cru como actor.
{
  check('temporal:routes-use-resolver',
    /resolveAvailabilityOwner\(/.test(routes) &&
    /representsAvailabilityOwner\(/.test(routes) &&
    /authorityActorOfAvailability\(/.test(routes),
    'unified-availability.routes deixou de usar o resolver polimórfico central (resolveAvailabilityOwner/representsAvailabilityOwner/authorityActorOfAvailability).');

  const RAW_OWNER_AS_ACTOR =
    /canRepresentActor\([^)]*,\s*(availability\.ownerId|existing\.ownerId|parsed\.data\.ownerId|ownerIdHint|req\.query\.ownerId)\s*\)/;
  check('temporal:no-canrepresent-on-raw-ownerid',
    !RAW_OWNER_AS_ACTOR.test(routes),
    'canRepresentActor recebendo availability.ownerId CRU (owner-recurso tratado como actor — o vetor [B2] do FAIL Yala).');

  const CTX_EQ_OWNER =
    /actionContext\.actorId\s*[!=]==?\s*(availability\.ownerId|existing\.ownerId|parsed\.data\.ownerId)\b/;
  check('temporal:no-actioncontext-vs-raw-ownerid',
    !CTX_EQ_OWNER.test(routes),
    'actionContext.actorId comparado diretamente com ownerId cru como autorização (proibido — DECISION-0118 D2; compare com o authority actor RESOLVIDO).');
}

// 4) RESOLVER cobre TODOS os owner types do enum (policy por tipo; sem switch disperso).
{
  const ownerEnumBlock = (types.match(/export enum AvailabilityOwnerType\s*\{([\s\S]*?)\}/) ?? [, ''])[1];
  const enumMembers = [...ownerEnumBlock.matchAll(/^\s*([A-Z_]+)\s*=\s*'[a-z_]+'/gm)].map((m) => m[1]);
  const missing = enumMembers.filter((m) => !new RegExp(`\\[AvailabilityOwnerType\\.${m}\\]\\s*:`).test(resolver));
  check('temporal:policy-per-owner-type',
    enumMembers.length > 0 && missing.length === 0,
    `owner types SEM policy de autoridade no resolver: ${missing.join(', ')} — tipo novo não entra sem policy material (NEW_UNCLASSIFIED).`);
  check('temporal:resolver-derives-authority-from-schema',
    /provider_actor_id/.test(resolver) && /owner_actor_id/.test(resolver) && /canRepresentActor/.test(resolver),
    'resolver perdeu a derivação material do authority actor (provider_actor_id/owner_actor_id) ou a prova canRepresentActor.');
}

// 4b) CONTRATO FAIL-CLOSED do resolver (E1 — AVAILABILITY OWNER-AUTHORITY EXEMPLAR / REGRESSION LOCK).
// O gate já prova COBERTURA (policy por owner_type) mas não a REJEIÇÃO: o exemplar canônico da DECISION-0131
// é o triplo fail-closed do resolver — owner_type desconhecido→400, recurso inexistente/tipo incompatível→404,
// sem representabilidade→403 — materializando LEI §4.9 (autoridade server-side) + PROHIBITED_STRUCTURES (fail-closed).
// Trava os 3 throws + os 2 catches fail-closed (erro de policy/canRepresentActor → deny, nunca allow).
{
  check('temporal:resolver-failclosed-unknown-owner-type',
    /if\s*\(\s*!policy\s*\)/.test(resolver) && /AVAILABILITY_OWNER_TYPE_UNKNOWN/.test(resolver) &&
    /AvailabilityOwnerAuthorityError\(\s*400\s*,\s*['"]AVAILABILITY_OWNER_TYPE_UNKNOWN['"]/.test(resolver),
    'resolver perdeu o fail-closed de owner_type DESCONHECIDO (if(!policy) throw 400 AVAILABILITY_OWNER_TYPE_UNKNOWN) — tipo fora do vocabulário NÃO pode virar allow.');

  check('temporal:resolver-failclosed-owner-not-found',
    /AvailabilityOwnerAuthorityError\(\s*404\s*,\s*['"]AVAILABILITY_OWNER_NOT_FOUND['"]/.test(resolver) &&
    /authorityActorId\s*=\s*null/.test(resolver),
    'resolver perdeu o fail-closed de recurso INEXISTENTE/tipo incompatível (catch→authorityActorId=null + throw 404 AVAILABILITY_OWNER_NOT_FOUND) — UUID de outro tipo/ausente NÃO pode autorizar.');

  check('temporal:resolver-failclosed-not-representable',
    /AvailabilityOwnerAuthorityError\(\s*403\s*,\s*['"]AVAILABILITY_OWNER_NOT_REPRESENTABLE['"]/.test(resolver) &&
    /if\s*\(\s*!canRep\s*\)/.test(resolver) && /canRep\s*=\s*false/.test(resolver),
    'resolver perdeu o fail-closed de AUTORIDADE (canRepresentActor: catch→canRep=false + if(!canRep) throw 403 AVAILABILITY_OWNER_NOT_REPRESENTABLE) — autoridade não pode ser ignorada nem fail-open.');
}

// 5) WRITER de service_offering usa o ENUM (nunca string fora do vocabulário).
{
  check('temporal:so-writer-uses-enum',
    /AvailabilityOwnerType\.SERVICE_OFFERING/.test(soService),
    'service-offering.service deixou de declarar o owner pelo enum canônico (writer fora do vocabulário).');
}

// 6) ZERO actor cure na família temporal.
{
  const CURE = /\bensureUserActor\b|\bfindOrCreateUserActor\b|INSERT\s+INTO\s+actors\b/;
  for (const f of FAMILY) {
    const p = join(SRC, f);
    if (!existsSync(p)) continue;
    check(`temporal:no-actor-cure:${f}`, !CURE.test(read(p)),
      `caminho temporal ${f} cria/cura actor (proibido — DECISION-0113/0118).`);
  }
}

// 7) NEW_UNCLASSIFIED — arquivo novo em core/availability sem classificação.
{
  const familySet = new Set(FAMILY.map((f) => f.replace(/\\/g, '/')));
  const KNOWN_NON_RESOLVING = new Set([
    'core/availability/availability.module.ts',
    'core/availability/unified-availability.types.ts',
    // DECISION-0132: resolver/política de FINALIDADE temporal (CONCEPT). NÃO participa da resolução de
    // owner-authority (owner/recurso) — é a camada semântica de purpose. Guard próprio: audit-temporal-purpose.mjs.
    'core/availability/temporal-purpose.ts',
  ]);
  const base = join(SRC, 'core/availability');
  let unclassified = 0;
  if (existsSync(base)) {
    for (const entry of readdirSync(base)) {
      const full = join(base, entry);
      if (statSync(full).isDirectory() || extname(full) !== '.ts') continue;
      const rel = `core/availability/${entry}`;
      if (!familySet.has(rel) && !KNOWN_NON_RESOLVING.has(rel)) {
        unclassified++;
        failures.push(`NEW_UNCLASSIFIED: arquivo novo na família temporal sem classificação: ${rel} — classifique na FAMILY (com revisão de autoridade).`);
      }
    }
  }
  if (unclassified === 0) closed++;
}

// ── Saída ─────────────────────────────────────────────────────────────────────
console.log(`[availability-owner-authority] CLOSED=${closed} FAILURES=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [availability-owner-authority]:');
  failures.forEach((f) => console.error('  ', f));
  process.exit(1);
}
console.log('GATE OK [availability-owner-authority] — owner temporal é RECURSO; autoridade resolvida por policy (DECISION-0118 D2).');
