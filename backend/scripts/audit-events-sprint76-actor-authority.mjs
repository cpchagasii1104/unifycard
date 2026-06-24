#!/usr/bin/env node
// Guard — F-CAMADA-1-GATE-ACTIONCTX-TENANT-BINDING (DECISION-0113, resíduo events-sprint76).
//
// events-sprint76.routes.ts é o path VIVO de criação de evento/ticket/reserva (reserve cria PaymentIntent). Escapou
// do F-0113-EVENT-ACTOR-BODY-BINDING. Os WRITE paths devem tratar actionContext.actorId como HINT (canal 0113) e
// re-checar canRepresentActor com o userId AUTENTICADO (req.user) — nunca conflar actorId↔userId.
// MORDE se: (1) authorship usar actionContext.actorId como createdByUserId; (2) ticketService receber actionContext.actorId
// como userId (conflação); (3) faltar canRepresentActor nos writes; (4) userId não for derivado de req.user.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FILE = 'src/modules/events/events-sprint76.routes.ts';
const p = join(ROOT, FILE);
const failures = [];

if (!existsSync(p)) {
  failures.push(`${FILE}: ausente.`);
} else {
  const code = readFileSync(p, 'utf-8');

  // (1) conflação actorId→userId no authorship do evento.
  if (/createdByUserId:\s*actionContext\.actorId/.test(code)) {
    failures.push(`${FILE}: createdByUserId = actionContext.actorId — conflação actorId↔userId (DECISION-0113; use req.user.userId).`);
  }
  // (2) ticketService write passando actionContext.actorId como AMBOS args (actorId + userId).
  if (/(createTicketType|reserveTicket)\([\s\S]{0,220}?actionContext\.actorId,\s*actionContext\.actorId/.test(code)) {
    failures.push(`${FILE}: ticketService write passa actionContext.actorId como userId (conflação — o 2º arg deve ser req.user.userId).`);
  }
  // (3) canRepresentActor nos writes (GET discovery já tinha 1; +3 writes = >=4).
  const nCanRep = (code.match(/canRepresentActor\(/g) || []).length;
  if (nCanRep < 4) {
    failures.push(`${FILE}: canRepresentActor presente ${nCanRep}× (esperado >=4: GET discovery + 3 writes events/tickets/reserve).`);
  }
  // (4) userId derivado de req.user (não de actionContext) nos writes.
  const nUserId = (code.match(/const userId = req\.user\?\.userId/g) || []).length;
  if (nUserId < 3) {
    failures.push(`${FILE}: userId derivado de req.user ${nUserId}× (esperado >=3 nos writes events/tickets/reserve).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [events-sprint76-actor-authority]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [events-sprint76-actor-authority] — writes (events/tickets/reserve) bindam canRepresentActor com req.user.userId; actionContext.actorId = HINT (DECISION-0113); sem conflação actorId↔userId.');
