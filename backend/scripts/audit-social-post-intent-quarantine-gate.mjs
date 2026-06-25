#!/usr/bin/env node
// Gate estrutural — F-SOCIAL-POST-INTENT-QUARANTINE-GATE (§4.8.4).
// Trava a cobertura de quarentena na superfície social canônica (social 2.0 createPost):
//   - createPost chama assertActorNotQuarantined(author=actor.actor_id) ANTES de validateIntent e de INSERT INTO posts;
//   - também checa o acting/createdAs (createdAsActorId) quando difere;
//   - o gate usa actorId RESOLVIDO (actor.actor_id / createdAsActorId), NUNCA userId/actionContext cru;
//   - canRepresentActor NÃO recebeu quarentena (segue puro);
//   - validateIntent (centralizado) preservado em createPost;
//   - createPost (escopo do método) NÃO toca payment runtime (executePayment/checkout/payment_intents/bank writer/payout/settlement);
//   - rota legada POST /social/posts/create continua 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED e não chama socialService.createPost.
// Heurística textual (não AST). Integrado em validate:regression-guards.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SVC = join(process.cwd(), 'src/modules/social/social-2.0.service.ts');
const LEGACY = join(process.cwd(), 'src/modules/social/social.routes.ts');
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
  failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: social-2.0.service.ts ausente.');
} else {
  const code = stripTs(raw);

  // helper de quarentena
  checked++;
  const helper = sliceMethod(code, 'private async assertActorNotQuarantined(');
  if (!helper || !/isActorEffectivelyBlocked\s*\(\s*tenantId,\s*actorId\s*\)/.test(helper)) {
    failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: helper assertActorNotQuarantined ausente/sem isActorEffectivelyBlocked.');
  }

  // createPost: gate author ANTES de validateIntent e de INSERT INTO posts
  {
    checked++;
    const body = sliceMethod(code, 'async createPost(');
    const iGate = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*actor\.actor_id\)/);
    const iActing = body.search(/this\.assertActorNotQuarantined\(tenantId,\s*createdAsActorId\)/);
    const iIntent = body.search(/actorIntentsService\.validateIntent\s*\(/);
    const iInsert = body.search(/INSERT\s+INTO\s+posts\b/i);
    const firstWrite = Math.min(...[iInsert].filter((i) => i >= 0));
    if (iGate < 0) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: createPost NÃO checa author (actor.actor_id) — post sem quarentena.');
    else {
      if (Number.isFinite(firstWrite) && iGate > firstWrite) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: createPost escreve (INSERT INTO posts) ANTES do gate (tarde demais).');
      if (iIntent >= 0 && iGate > iIntent) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: gate vem DEPOIS de validateIntent — deve preceder (bloqueia antes de qualquer trabalho de intent).');
    }
    if (iActing < 0) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: createPost NÃO checa o acting (createdAsActorId).');
    // intent validation centralizada preservada
    if (iIntent < 0) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: createPost perdeu actorIntentsService.validateIntent (validação centralizada).');
    // gate não usa userId/actionContext cru
    if (/assertActorNotQuarantined\(tenantId,\s*userId\b|assertActorNotQuarantined\(tenantId,\s*actionContext/.test(body)) {
      failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: gate usa userId/actionContext CRU (deve ser actorId resolvido).');
    }
    // createPost NÃO pode abrir money runtime (escopo do método — o arquivo tem bankSplitRepository p/ outros métodos)
    if (/executePayment|processCheckout|payment_intents|bankSplitRepository|bankIntegration|createTransactionWithSplit|payoutService|settlementService|RECEIVE_PAYMENT[\s\S]{0,80}?(bank|payment|payout)/i.test(body)) {
      failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: createPost passou a tocar payment runtime (executePayment/checkout/payment_intents/bank/payout/settlement) — proibido (intent é semântica).');
    }
  }
}

// legacy POST /social/posts/create continua 501 e não chama socialService.createPost
{
  const leg = read(LEGACY);
  if (leg) {
    checked++;
    const code = stripTs(leg);
    if (!/SOCIAL_LEGACY_POST_CREATE_CONTAINED/.test(code) || !/status\(501\)/.test(code)) {
      failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: rota legada /social/posts/create perdeu o 501 SOCIAL_LEGACY_POST_CREATE_CONTAINED (RELIGADA).');
    }
    if (/socialService\.createPost\s*\(/.test(code)) {
      failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: rota legada voltou a chamar socialService.createPost (RELIGADA).');
    }
  }
}

// canRepresentActor puro
{
  const authz = read(AUTHZ);
  if (authz) {
    checked++;
    const m = stripTs(authz).match(/async canRepresentActor\([\s\S]*?\n  \}/);
    if (m && /isActorEffectivelyBlocked/.test(m[0])) failures.push('SOCIAL_POST_QUARANTINE_REGRESSION: canRepresentActor passou a checar quarentena — representação deve ficar PURA.');
  }
}

console.log(`[social-post-intent-quarantine-gate] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [social-post-intent-quarantine-gate]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [social-post-intent-quarantine-gate] — createPost bloqueia author E acting quarentenado ANTES de validateIntent/INSERT; intent centralizado preservado; money-free; legacy 501 intacto; canRepresentActor puro.');
