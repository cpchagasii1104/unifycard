#!/usr/bin/env node
// Guard estrutural — F-SERVICE-AVAILABILITY-PROVIDER-READERS-CONTAINMENT-SLICE-A2E
// (DECISION-0156 / DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT — resíduos R4/R5).
//
// pending-responsibilities e impact-overview NÃO podem resolver ownership/contagem do prestador pelo escopo
// legado owner_type='service'→services.owner_actor_id (coluna morta). Devem usar o SSOT canônico
// (owner_type='service_offering' + service_offerings.provider_actor_id). MORDE se: reaparecer
// owner_type = 'service' (SQL), s.owner_actor_id / s.title (coluna morta de services), sumir o predicado canônico
// (service_offerings + provider_actor_id), os branches user/group forem removidos, services.metadata.availability
// virar autoridade, ou o enum SERVICE for removido. Comment-stripped (// , /* */ e -- SQL). Em regression-guards.
//
// AMPLIADO — F-PROFILE-READERS-BROKEN-COLUMNS-FIX (DT-PROFILE-PENDING-IMPACT-READERS-BROKEN-COLUMNS):
// também MORDE se voltarem as colunas quebradas destes readers (schema vivo: groups PK `id`, dono
// `owner_actor_id`, `status` 'active'/'inactive', sem financial_purpose; SPR usa `requested_at`):
//   g.group_id / SELECT group_id cru contra groups · owner_user_id · g.is_active ou predicado
//   is_active=true/false · financial_purpose coluna crua · pr.requestedAt camelCase cru.
// NOTA de precisão (não é enfraquecimento): o cheque de coluna morta de services virou `s.owner_actor_id`
// porque `groups.owner_actor_id` é coluna VIVA (COE-2 NOT NULL) e é o dono correto no branch group.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
// strip //-comment, /* */-comment e --sql-comment (dentro de template literals dos readers)
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/--[^\n]*/g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const failures = [];

const FILES = [
  'src/core/profile/pending-responsibilities.routes.ts',
  'src/core/profile/impact-overview.routes.ts',
];
for (const rel of FILES) {
  const src = read(rel);
  if (src === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  // (1) sem escopo legado owner_type='service' (word-boundary p/ não bater em service_offering)
  if (/owner_type\s*=\s*'service'(?!_)/.test(src)) failures.push(`${rel}: reapareceu owner_type='service' (escopo legado) no SQL.`);
  // (2) sem coluna morta de services (alias s.) — groups.owner_actor_id é VIVA e permitida (branch group)
  if (/\bs\.owner_actor_id\b/.test(src)) failures.push(`${rel}: reapareceu s.owner_actor_id (coluna inexistente em services).`);
  if (/\bservices\b[\s\S]{0,200}?\bowner_actor_id\b(?![\s\S]{0,80}groups)/.test(src) && /FROM\s+services\s+\w*[\s\S]{0,120}owner_actor_id/.test(src)) failures.push(`${rel}: owner_actor_id referenciado em contexto de services (coluna inexistente).`);
  if (/s\.title\b/.test(src)) failures.push(`${rel}: reapareceu s.title (coluna inexistente em services).`);
  // (2b) colunas quebradas dos readers (F-PROFILE-READERS-BROKEN-COLUMNS-FIX) — schema vivo de groups/SPR
  if (/\bg\.group_id\b/.test(src)) failures.push(`${rel}: reapareceu g.group_id (groups usa PK id).`);
  if (/FROM\s+groups\b[\s\S]{0,400}?\bgroup_id\s*,/.test(src) || /SELECT\s+group_id\b/.test(src)) failures.push(`${rel}: SELECT group_id cru contra groups (usar id AS group_id).`);
  if (/\bowner_user_id\b/.test(src)) failures.push(`${rel}: reapareceu owner_user_id (coluna inexistente em groups; dono vivo = owner_actor_id).`);
  if (/\bg\.is_active\b/.test(src) || /\bis_active\s*=\s*(true|false)\b/.test(src)) failures.push(`${rel}: reapareceu is_active como coluna de groups (schema vivo usa status 'active'/'inactive').`);
  if (/\bg\.financial_purpose\b/.test(src) || /(?<![.\w])financial_purpose\s+IS\s+NULL/.test(src)) failures.push(`${rel}: financial_purpose usado como coluna crua de groups no SQL (vive em metadata->>'financialPurpose'; alias AS financial_purpose e row.financial_purpose são permitidos).`);
  if (/pr\.requestedAt\b/.test(src)) failures.push(`${rel}: pr.requestedAt camelCase cru (SPR usa requested_at; alias AS "requestedAt").`);
  if (/b\.requestedAt\b/.test(src)) failures.push(`${rel}: b.requestedAt camelCase cru (bookings usa requested_at desde 20260428260000; alias AS "requestedAt").`);
  // (2c) colunas mortas de events (schema vivo 20260525100000: actor_id + datetime_start/datetime_end;
  //      status CHECK sem completed/archived/ongoing)
  if (/\bcreated_by_global_user_id\b/.test(src)) failures.push(`${rel}: reapareceu created_by_global_user_id (coluna inexistente em events; organizer vivo = actor_id).`);
  if (/(?<!AS\s)\b(?:e\.)?(starts_at|ends_at)\s*[<>=]/.test(src)) failures.push(`${rel}: starts_at/ends_at usado como coluna crua de events em predicado (vivo: datetime_start/datetime_end; alias AS é permitido).`);
  if (/status\s*(!?=|IN)\s*[^)\n]*'(completed|archived|ongoing)'/.test(src)) failures.push(`${rel}: status morto ('completed'/'archived'/'ongoing') em query de events (CHECK vivo: draft/declared/published/active/ended/cancelled).`);
  // (2d) F-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-FIX (DT-IMPACT-OVERVIEW-MONEYLOCKED-CENTS-100X-INFLATION):
  //      amount_cents JÁ é centavos (nomenclatura 07) — moneyLocked NÃO pode multiplicar por 100 (inflava
  //      o display 100×). Só se aplica ao impact-overview (dono do moneyLockedCents).
  if (rel.endsWith('impact-overview.routes.ts') && /moneyLocked\w*\s*\*\s*100\b/.test(src)) {
    failures.push(`${rel}: moneyLocked * 100 reapareceu — amount_cents já é centavos; multiplicar infla o display 100× (display-only, não toca ledger).`);
  }
  // (3) predicado canônico presente
  if (!/service_offerings/.test(src)) failures.push(`${rel}: não consulta service_offerings (SSOT canônico ausente).`);
  if (!/provider_actor_id/.test(src)) failures.push(`${rel}: não resolve ownership por provider_actor_id (SSOT canônico).`);
  if (!/owner_type\s*=\s*'service_offering'/.test(src)) failures.push(`${rel}: não usa owner_type='service_offering' (SSOT canônico).`);
  // (4) branches legítimos preservados
  if (!/owner_type\s*=\s*'user'/.test(src)) failures.push(`${rel}: branch owner_type='user' removido indevidamente.`);
  if (!/owner_type\s*=\s*'group'/.test(src)) failures.push(`${rel}: branch owner_type='group' removido indevidamente.`);
  // (5) metadata.availability não é autoridade
  if (/metadata\.availability/.test(src)) failures.push(`${rel}: services.metadata.availability não pode virar autoridade.`);
  // (6) RFQ intocado por estes readers
  if (/event-rfq|acceptQuote/.test(src)) failures.push(`${rel}: readers de perfil não podem referenciar RFQ (fora de escopo).`);
}

// enum owner_type='service' preservado (contenção ≠ deleção)
const TYPES = 'src/core/availability/unified-availability.types.ts';
const types = read(TYPES);
if (types === null) { failures.push(`arquivo ausente: ${TYPES}`); }
else if (!/SERVICE\s*=\s*['"]service['"]/.test(types)) {
  failures.push(`${TYPES}: enum AvailabilityOwnerType.SERVICE removido — contenção NÃO deve deletar o enum.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [provider-availability-readers-canonical]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [provider-availability-readers-canonical] — pending-responsibilities + impact-overview resolvem ownership do prestador por service_offering→provider_actor_id (SSOT), sem owner_type=service/s.owner_actor_id/s.title; branches user/group preservados; enum preservado; colunas quebradas (g.group_id/owner_user_id/is_active/financial_purpose/pr.requestedAt) não voltam. DECISION-0156 R4/R5 + DT-PROFILE-PENDING-IMPACT-READERS-BROKEN-COLUMNS blindadas.');
