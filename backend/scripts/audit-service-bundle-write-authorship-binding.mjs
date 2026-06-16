#!/usr/bin/env node
// Gate estrutural — F-SERVICE-BUNDLE-WRITE-AUTHORSHIP-BINDING (DT-SERVICE-BUNDLE-WRITE-AUTHORSHIP-SPOOF).
// Sela o fix do write-authorship-spoof dos 2 writes de service-bundle: book / confirm NÃO podem mais
// gravar autoria/autoridade a partir do actor cliente-declarado cru (`actionContext.actorId` no confirm;
// `requesterActorId` do body sem binding no book). A autoria tem de vir do par BINDADO (bindWriteActor:
// req.user.userId REAL + canRepresentActor do actor declarado). Integrado em validate:regression-guards.
// Heurística textual comment-stripped, não AST — falso positivo torna o gate MAIS restritivo.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC = join(process.cwd(), 'src');
const ROUTES_REL = 'modules/services/service-bundle.routes.ts';

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
let checked = 0;

const p = join(SRC, ROUTES_REL);
if (!existsSync(p)) {
  failures.push(`FORBIDDEN_REGRESSION: rota de service-bundle desapareceu: ${ROUTES_REL}`);
} else {
  const code = stripComments(readFileSync(p, 'utf-8'));
  checked++;

  // 1) Helper de binding presente: req.user.userId REAL + canRepresentActor.
  if (!/const bindWriteActor = async/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} perdeu o helper bindWriteActor.`);
  }
  if (!/req\.user\?\.userId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} binding não exige req.user.userId REAL.`);
  }
  if (!/canRepresentActor\(tenantId, userId, declaredActorId\)/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} binding não chama canRepresentActor(tenantId, userId, declaredActorId).`);
  }

  // 2) PROIBIDO: confirm gravar autoria a partir do actionContext.actorId cru.
  if (/(confirmedByActorId|confirmedByUserId): actionContext\.actorId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} confirm voltou a gravar confirmedBy* a partir de actionContext.actorId cru (spoof — proibido).`);
  }

  // 3) PROIBIDO: book passar actionContext.actorId como userId ao service (conflação actor↔user).
  if (/createBundleBookings\(\s*tenantId,\s*actionContext\.actorId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} book voltou a passar actionContext.actorId como userId ao createBundleBookings (conflação — proibido).`);
  }

  // 4) book deve passar o userId REAL bindado e o requesterActorId validado.
  if (!/createBundleBookings\(\s*tenantId,\s*bound\.userId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} book não passa bound.userId (userId REAL) ao createBundleBookings.`);
  }
  if (!/requesterActorId: bound\.actorId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} book não grava requesterActorId a partir do actor bindado.`);
  }

  // 5) confirm deve gravar autoria bindada + userId REAL.
  if (!/confirmedByActorId: bound\.actorId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} confirm não grava confirmedByActorId a partir do actor bindado.`);
  }
  if (!/confirmedByUserId: bound\.userId/.test(code)) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} confirm não grava confirmedByUserId com o userId REAL bindado.`);
  }

  // 6) O binding tem de rodar ANTES do write nos 2 handlers.
  const bindCount = (code.match(/const bound = await bindWriteActor\(req, reply, tenantId,/g) || []).length;
  if (bindCount !== 2) {
    failures.push(`WRITE_AUTHORSHIP_REGRESSION: ${ROUTES_REL} esperado 2 chamadas de bindWriteActor (book/confirm), encontradas ${bindCount}.`);
  }
}

console.log(`[service-bundle-write-authorship-binding] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [service-bundle-write-authorship-binding]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [service-bundle-write-authorship-binding] — autoria dos writes de bundle bindada ao actor representável; actionContext.actorId/requesterActorId são hint, não autoria.');
