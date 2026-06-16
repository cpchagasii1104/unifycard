#!/usr/bin/env node
// Gate estrutural — F-SERVICE-ORDER-WRITE-AUTHORSHIP-BINDING (DT-SERVICE-ORDER-WRITE-AUTHORSHIP-SPOOF).
// Sela o fix do WRITE-AUTHORSHIP-SPOOF das transições de estado de service_order: confirm / start /
// complete / cancel / buyer-confirm NÃO podem mais gravar a AUTORIA a partir do `actionContext.actorId`
// cru (HINT cliente-declarado — DECISION-0113). A autoria tem de vir do par BINDADO (bindOrderWriteActor:
// parte representável via canRepresentActor + req.user.userId REAL). Integrado em validate:regression-guards.
// Heurística textual comment-stripped, não AST — falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ROUTES_REL = 'modules/services/service-order.routes.ts';

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let checked = 0;

const p = join(SRC, ROUTES_REL);
if (!existsSync(p)) {
  failures.push(`FORBIDDEN_REGRESSION: rota de service-order desapareceu: ${ROUTES_REL}`);
} else {
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Helper de binding presente: req.user.userId REAL + party (customer|worker) + canRepresentActor.
  if (!/const bindOrderWriteActor = async/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} perdeu o helper bindOrderWriteActor (binding de autoria de write).`);
  }
  if (!/req\.user\?\.userId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} binding não exige req.user.userId REAL.`);
  }
  if (!/canRepresentActor\(tenantId, userId, actorId\)/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} binding não chama canRepresentActor(tenantId, userId, actorId).`);
  }
  if (!/order\.customerActorId !== actorId && order\.workerActorId !== actorId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} binding não exige que o actor declarado seja PARTE (customer|worker).`);
  }

  // 2) PROIBIDO: qualquer autoria de transição de estado gravada a partir do actionContext.actorId cru.
  //    (confirm-financial-terms é financeiro/503 e fica FORA — mas mesmo lá não é gravação não-financeira;
  //     a regra abaixo cobre só os campos de autoria dos writes não-financeiros, que NÃO podem usar
  //     actionContext.actorId. confirmFinancialTerms usa confirmedBy* mas é resíduo documentado: para
  //     não falso-positivar, a regra exige os campos NÃO-financeiros bindados E proíbe o padrão cru
  //     em start/complete/cancel/buyer-confirm, que não existem no fluxo financeiro.)
  const FORBIDDEN_SPOOF = /(startedByActorId|completedByActorId|cancelledByActorId|buyerActorId|startedByUserId|completedByUserId|cancelledByUserId|buyerUserId): actionContext\.actorId/;
  if (FORBIDDEN_SPOOF.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} voltou a gravar autoria de transição de estado a partir de actionContext.actorId cru (spoof — proibido).`);
  }

  // 3) Os 5 writes não-financeiros devem gravar a autoria a partir do par BINDADO.
  for (const m of [
    /confirmedByActorId: bound\.actorId/,
    /startedByActorId: bound\.actorId/,
    /completedByActorId: bound\.actorId/,
    /cancelledByActorId: bound\.actorId/,
    /buyerActorId: bound\.actorId/,
  ]) {
    if (!m.test(code)) {
      failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} write sem autoria bindada esperada (${m}).`);
    }
  }

  // 4) O *ByUserId não-financeiro deve ser o userId REAL bindado (não actionContext.actorId).
  for (const m of [
    /confirmedByUserId: bound\.userId/,
    /startedByUserId: bound\.userId/,
    /completedByUserId: bound\.userId/,
    /cancelledByUserId: bound\.userId/,
    /buyerUserId: bound\.userId/,
  ]) {
    if (!m.test(code)) {
      failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} *ByUserId não usa o userId REAL bindado (${m}).`);
    }
  }

  // 5) O binding tem de rodar ANTES do write em cada um dos 5 handlers não-financeiros.
  const bindCount = (code.match(/const bound = await bindOrderWriteActor\(req, reply, tenantId, existing\)/g) || []).length;
  if (bindCount !== 5) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} esperado 5 chamadas de bindOrderWriteActor (confirm/start/complete/cancel/buyer-confirm), encontradas ${bindCount}.`);
  }
}

console.log(`[service-order-write-authorship-binding] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-order-write-authorship-binding]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-order-write-authorship-binding] — autoria das transições de estado bindada ao actor representável e parte; actionContext.actorId é hint, não autoria.');
