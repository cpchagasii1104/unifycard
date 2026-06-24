#!/usr/bin/env node
// Guard — F-GROUPS-VOTES-SCHEMA-DRIFT-FIX (DT-GROUPS-VOTES-SCHEMA-DRIFT).
//
// O schema vivo de groups votes é ACTOR-KEYED (migration 20260530430000):
//   group_votes(id, created_by_actor_id, is_anonymous, ...)
//   group_vote_options(id, label, ...)              -- vote_id é FK válida
//   group_vote_responses(id, actor_id, UNIQUE(vote_id, actor_id))  -- vote_id/option_id são FKs válidas
// Este guard MORDE se o código de modules/groups/votes*.ts voltar a falar o schema antigo/imaginado
// (user_id/created_by_user_id/response_id/option_id-como-PK/text-coluna/vote_id-como-PK), perder a
// resolução de actor (ensureUserActor), duplicar SQL no service, ou perder o trx opcional no repository.
// DTOs em camelCase (voteId/optionId/responseId/createdByActorId) são PERMITIDOS — aliases derivados de id.
// Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIR = 'src/modules/groups';
// strip // e /* */ (preserva template literals em backtick = o SQL); evita falso-positivo em comentários.
const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? stripComments(readFileSync(p, 'utf-8')) : null;
};
const failures = [];

const REPO = read(`${DIR}/votes.repository.ts`);
const SVC = read(`${DIR}/votes.service.ts`);
const TYPES = read(`${DIR}/votes.types.ts`);
const ROUTES = read(`${DIR}/votes.routes.ts`);

for (const [name, code] of [['votes.repository.ts', REPO], ['votes.service.ts', SVC], ['votes.types.ts', TYPES], ['votes.routes.ts', ROUTES]]) {
  if (code === null) failures.push(`${DIR}/${name}: ausente.`);
}

const all = [REPO, SVC, TYPES, ROUTES].filter(Boolean).join('\n/*FILE-SEP*/\n');

// ── (A) tokens de drift inequívocos (nenhuma coluna actor-keyed os usa) ─────────────────
if (/created_by_user_id/.test(all)) {
  failures.push('coluna `created_by_user_id` em votes*.ts — schema real = group_votes.created_by_actor_id.');
}
if (/\bresponse_id\b/.test(all)) {
  failures.push('coluna `response_id` em votes*.ts — schema real = group_vote_responses.id (DTO responseId é alias).');
}
// \buser_id\b NÃO casa `global_user_id` (sem boundary antes de "user") nem `userId` (camel) nem `user.id` (ponto).
if (/\buser_id\b/.test(all)) {
  failures.push('coluna `user_id` em votes*.ts — schema real = group_vote_responses.actor_id (identidade operacional = actor).');
}

// ── (B) drift contextual (vote_id/option_id/text são válidos noutros lugares) ────────────
if (/INSERT INTO group_vote_options\s*\(\s*[^)]*\btext\b/i.test(all)) {
  failures.push('INSERT INTO group_vote_options usa coluna `text` — schema real = label.');
}
if (/\bgroup_votes\b[\s\S]{0,150}\bvote_id\b/i.test(all)) {
  failures.push('query de `group_votes` referencia `vote_id` como coluna — PK real = group_votes.id (vote_id só existe como FK em options/responses).');
}

// ── (C) join errado em getVotersByOption (users.global_user_id = gvr.*) ──────────────────
if (/global_user_id\s*=\s*gvr\./i.test(all) || /JOIN\s+users\s+\w+\s+ON[^\n]*gvr\./i.test(all)) {
  failures.push('getVotersByOption faz join users.global_user_id = gvr.* — identidade do votante é actor; join correto = actors a ON a.id = gvr.actor_id.');
}

// ── (D) presença canônica (a correção tem que ser real, não só ausência) ────────────────
if (REPO) {
  if (!/created_by_actor_id/.test(REPO)) failures.push('repository perdeu `created_by_actor_id` (coluna canônica de autoria).');
  if (!/\bactor_id\b/.test(REPO)) failures.push('repository perdeu `actor_id` (identidade do voto).');
  if (!/\blabel\b/.test(REPO)) failures.push('repository perdeu `label` (coluna canônica da opção).');
  if (!/JOIN\s+actors\b/i.test(REPO)) failures.push('repository (getVotersByOption) perdeu o join em `actors` (a.id = gvr.actor_id).');
  if (!/getActorVote/.test(REPO)) failures.push('repository perdeu `getActorVote` (voto por actor; getUserVote era user-keyed).');
  if (/\bgetUserVote\b/.test(REPO) || (SVC && /\bgetUserVote\b/.test(SVC))) {
    failures.push('`getUserVote` ainda referenciado — renomeado para getActorVote (chave operacional = actor_id).');
  }
  // trx opcional nos métodos de criação (preserva atomicidade sem duplicar SQL no service)
  if (!/async createVote\([\s\S]{0,220}\btrx\?:/.test(REPO)) {
    failures.push('repository.createVote perdeu o parâmetro `trx?` opcional — service voltaria a duplicar SQL inline.');
  }
  if (!/async createVoteOptions\([\s\S]{0,220}\btrx\?:/.test(REPO)) {
    failures.push('repository.createVoteOptions perdeu o parâmetro `trx?` opcional.');
  }
}

// ── (E) service: resolve actor + delega SQL ao repository (não duplica) ──────────────────
if (SVC) {
  if (!/ensureUserActor/.test(SVC)) {
    failures.push('votes.service.ts não usa `ensureUserActor` — voto/votação devem resolver a identidade operacional (actor).');
  }
  // service não pode duplicar o SQL de votação/opção (dono é o repository); posts inline é permitido.
  if (/INSERT INTO group_votes\b/i.test(SVC)) {
    failures.push('votes.service.ts contém `INSERT INTO group_votes` inline — deve delegar a votesRepository.createVote(..., trx).');
  }
  if (/INSERT INTO group_vote_options\b/i.test(SVC)) {
    failures.push('votes.service.ts contém `INSERT INTO group_vote_options` inline — deve delegar a votesRepository.createVoteOptions(..., trx).');
  }
  // o voto deve ser gravado por actor (createVoteResponse recebe actorId), não globalUserId cru.
  if (/createVoteResponse\([^)]*globalUserId/.test(SVC)) {
    failures.push('votes.service.ts passa `globalUserId` para createVoteResponse — a chave do voto é actor_id (resolvido por ensureUserActor).');
  }
  if (!/createVoteResponse\([^)]*actorId/.test(SVC)) {
    failures.push('votes.service.ts não passa `actorId` para createVoteResponse — voto deve ser keyed por actor.');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [groups-votes-schema-drift]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  '[groups-votes-schema-drift] votes*.ts alinhado ao schema actor-keyed: sem user_id/created_by_user_id/response_id/' +
  'text-coluna/vote_id-como-PK; getVotersByOption join em actors; getActorVote por actor_id; service usa ensureUserActor ' +
  'e delega SQL ao repository (trx opcional, atomicidade preservada); posts inline mantido.'
);
console.log('GATE OK [groups-votes-schema-drift] — código de groups votes em uníssono com o schema vivo (DT-GROUPS-VOTES-SCHEMA-DRIFT).');
