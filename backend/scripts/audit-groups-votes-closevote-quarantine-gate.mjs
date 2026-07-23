#!/usr/bin/env node
// Gate estrutural — F-GROUPS-VOTES-CLOSEVOTE-QUARANTINE-GATE (§4.8.4).
// Fecha o REMAINDER do reseal YALA da 9ª fatia: closeVote (user-alcançável, state-changing) não tinha gate.
// Trava:
//   - votesService.closeVote resolve actor via ensureUserActor e chama assertActorNotQuarantined ANTES de
//     votesRepository.closeVote (UPDATE group_votes SET status='closed');
//   - o gate usa o actorId RESOLVIDO (userActor.actor_id), NUNCA userId/globalUserId/createdByUserId cru;
//   - a rota PATCH /:groupId/votes/:voteId/close passa userId ao service (mantém admin/owner);
//   - createVote e vote (gates da 9ª fatia) permanecem; runTenantTransaction de createVote preservado;
//   - canRepresentActor não recebeu quarentena (segue puro);
//   - votesRepository.closeVote continua só status update (não vira post/dinheiro).
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/groups/votes.service.ts');
const ROUTES = join(process.cwd(), 'src/modules/groups/votes.routes.ts');
const REPO = join(process.cwd(), 'src/modules/groups/votes.repository.ts');
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
  failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: votes.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper presente
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // closeVote: resolve actor + gate ANTES de votesRepository.closeVote
  {
    checked++;
    const body = sliceMethod(code, 'async closeVote(');
    const iEnsure = body.search(/ensureUserActor\s*\(\s*tenantId,\s*userId\s*\)/);
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*userActor\.actor_id\)/);
    const iWrite = body.search(/votesRepository\.closeVote\s*\(/);
    if (iEnsure < 0) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: closeVote NÃO resolve actor via ensureUserActor(tenantId, userId).');
    if (iGate < 0) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: closeVote NÃO chama assertActorNotQuarantined(actor resolvido) — fechar votação sem quarentena.');
    else if (iWrite >= 0 && iGate > iWrite) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: closeVote gateia DEPOIS de votesRepository.closeVote (tarde demais).');
    if (iEnsure >= 0 && iGate >= 0 && iEnsure > iGate) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: gate antes de resolver o actor (ordem inválida).');
    // não usa identidade crua
    if (/assertActorNotQuarantined\(tenantId,\s*(userId|globalUserId|createdByUserId)\b/.test(body)) {
      failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: closeVote gateia com userId/globalUserId/createdByUserId CRU (deve ser actorId resolvido).');
    }
  }

  // createVote/vote (9ª fatia) preservados
  {
    checked++;
    const cv = sliceMethod(code, 'async createVote(');
    if (cv.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/) < 0) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: gate de createVote (9ª fatia) regrediu.');
    if (cv.search(/runTenantTransaction\s*\(/) < 0) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: runTenantTransaction de createVote regrediu.');
    const vt = sliceMethod(code, 'async vote(');
    if (vt.search(/this\.assertActorNotQuarantined\(tenantId,\s*actorId\)/) < 0) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: gate de vote() (9ª fatia) regrediu.');
  }
}

// rota passa userId ao closeVote
{
  const routes = read(ROUTES);
  if (routes) {
    checked++;
    const code = stripTs(routes);
    if (!/votesService\.closeVote\s*\([^)]*\buserId\b[^)]*\)/.test(code)) {
      failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: rota /close NÃO passa userId ao votesService.closeVote.');
    }
    // D9.2-B (DECISION-0188 D11/D16): autoridade por role RETIRADA — o gate da rota /close
    // agora é canRepresentActor via groupsService.userCanGovernGroup (nunca group_members.role).
    if (!/userCanGovernGroup\s*\(/.test(code)) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: rota /close perdeu o check de gestão do grupo (userCanGovernGroup/canRepresentActor).');
    if (/isUserAdminOrOwner\s*\(/.test(code)) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: rota /close voltou à autoridade por role (isUserAdminOrOwner) — retirada no cutover D9.2-B.');
  }
}

// repository.closeVote continua só status update (não vira post/dinheiro)
{
  const repo = read(REPO);
  if (repo) {
    checked++;
    const body = sliceMethod(stripTs(repo), 'async closeVote(');
    if (!/UPDATE\s+group_votes\s+SET\s+status\s*=\s*'closed'/i.test(body)) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: repository.closeVote não é mais o status update esperado.');
    if (/INSERT\s+INTO\s+posts|payment|bank_ledger|payout/i.test(body)) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: repository.closeVote passou a tocar posts/payment/bank — proibido (status-only).');
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('CLOSEVOTE_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[groups-votes-closevote-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [groups-votes-closevote-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [groups-votes-closevote-quarantine-gate] — closeVote resolve actor e bloqueia quarentenado ANTES do UPDATE status=closed; admin/owner preservado; createVote/vote intactos; status-only; canRepresentActor puro.');
