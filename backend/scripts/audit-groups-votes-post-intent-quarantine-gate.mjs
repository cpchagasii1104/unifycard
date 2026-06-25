#!/usr/bin/env node
// Gate estrutural — F-GROUPS-VOTES-POST-INTENT-QUARANTINE-GATE (§4.8.4).
// Fecha a porta lateral: groups/votes cria estado de votação E um post inline com intent='vote' FORA do gate
// canônico de social 2.0. Trava:
//   - votesService.createVote chama assertActorNotQuarantined(actorId resolvido) ANTES de runTenantTransaction
//     e de qualquer escrita (votesRepository.createVote / createVoteOptions / INSERT INTO posts);
//   - votesService.vote chama o gate ANTES de votesRepository.createVoteResponse;
//   - o gate usa o actorId RESOLVIDO por ensureUserActor, NUNCA userId/globalUserId/createdByUserId cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - INSERT INTO posts inline com intent='vote' permanece (não movido) e protegido pelo gate;
//   - runTenantTransaction preservado (atomicidade);
//   - createVote NÃO toca payment runtime.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/groups/votes.service.ts');
const AUTHZ = join(process.cwd(), 'src/core/authorization/authorization.service.ts');
const failures = [];
let checked = 0;

const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
function sliceMethod(code, sig) {
  const start = code.indexOf(sig);
  if (start < 0) return '';
  const after = code.slice(start);
  const nextM = after.slice(sig.length).search(/\n  (async|private|public)\s/);
  return nextM >= 0 ? after.slice(0, nextM + sig.length) : after;
}

const raw = read(SVC);
if (!raw) {
  failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: votes.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // createVote: gate ANTES de runTenantTransaction e de qualquer escrita
  {
    checked++;
    const body = sliceMethod(code, 'async createVote(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/);
    const iTrx = body.search(/runTenantTransaction\s*\(/);
    const iRepoWrite = body.search(/votesRepository\.createVote\s*\(/);
    const iPost = body.search(/INSERT\s+INTO\s+posts\b/i);
    const firstWrite = Math.min(...[iTrx, iRepoWrite, iPost].filter((i) => i >= 0));
    if (iGate < 0) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote NÃO chama assertActorNotQuarantined — votação/post sem quarentena.');
    else if (Number.isFinite(firstWrite) && iGate > firstWrite) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote gateia DEPOIS da transação/escrita (tarde demais — escrita parcial possível).');
    // atomicidade preservada
    if (iTrx < 0) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote perdeu runTenantTransaction (atomicidade quebrada).');
    // INSERT INTO posts intent='vote' permanece inline e protegido
    if (iPost < 0) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote perdeu o INSERT INTO posts inline (post intent vote).');
    if (!/'vote'/.test(body)) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote perdeu intent=\'vote\'.');
    if (!/intentMetadata|intent_metadata/.test(body)) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote perdeu intent_metadata.');
    // gate não usa identidade crua
    if (/assertActorNotQuarantined\(tenantId,\s*(userId|globalUserId|createdByUserId)\b/.test(body)) {
      failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote gateia com userId/globalUserId/createdByUserId CRU (deve ser actorId resolvido por ensureUserActor).');
    }
    // createVote money-free
    if (/executePayment|processCheckout|payment_intents|payoutService|settlementService|bank_ledger|bank_transactions/i.test(body)) {
      failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: createVote passou a tocar payment/bank runtime — proibido.');
    }
  }

  // vote: gate ANTES de createVoteResponse
  {
    checked++;
    const body = sliceMethod(code, 'async vote(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/);
    const iWrite = body.search(/votesRepository\.createVoteResponse\s*\(/);
    if (iGate < 0) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: vote() NÃO chama assertActorNotQuarantined — registro de voto sem quarentena.');
    else if (iWrite >= 0 && iGate > iWrite) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: vote() gateia DEPOIS de createVoteResponse (tarde demais).');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('GROUPS_VOTES_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[groups-votes-post-intent-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [groups-votes-post-intent-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [groups-votes-post-intent-quarantine-gate] — createVote/vote bloqueiam actor quarentenado ANTES da transação/escrita; INSERT posts intent=vote inline e protegido; atomicidade preservada; actorId resolvido; canRepresentActor puro.');
