#!/usr/bin/env node
// Guard — F-RENTAL-RESOURCE-SURFACE-SLICE-A (DECISION-0151/0159).
//
// Protege as invariantes da fatia:
//   1. OWNER SERVER-SIDE: POST /rentable-resources nunca aceita owner_actor_id do body — deriva de
//      actionContext.actorId, provado por canRepresentActor. Se um campo de owner aparecer no zod
//      schema de criação, é regressão (crachá-alheio).
//   2. MONEY-FREE: rentable_resources não ganha coluna financeira (DECISION-0151 §D — mesmo espírito
//      do comentário já presente na migration: "se aparecer, é violação").
//   3. SEM MUDANÇA no availability/booking genérico: unified-availability.routes.ts continua
//      owner_type-agnostic (nenhum "if resourceType" hardcoded por vertical vazou pra lá).
//   4. WIRING: rota registrada no app.builder; módulo existe.

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const failures = [];
function read(p) {
  try { return readFileSync(join(ROOT, p), 'utf-8'); } catch { return ''; }
}
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '').replace(/\/\/[^\n]*/g, '');
}

// ── 1: owner server-side (nunca aceito do body) ──
{
  const routes = stripComments(read('src/modules/rentals/rentable-resource.routes.ts'));
  if (!routes) {
    failures.push('rentable-resource.routes.ts ausente — a fatia F-RENTAL-RESOURCE-SURFACE-SLICE-A foi removida sem decisão.');
  } else {
    if (/ownerActorId\s*:/.test(routes.match(/const createSchema[\s\S]*?\}\);/)?.[0] ?? '')) {
      failures.push('CRACHÁ-ALHEIO: createSchema (POST /rentable-resources) declara ownerActorId no body — owner deve vir SÓ de actionContext.actorId provado por canRepresentActor.');
    }
    if (!/canRepresentActor/.test(routes)) {
      failures.push('POST /rentable-resources perdeu a checagem canRepresentActor — criação sem prova de autoridade.');
    }
    if (!/req\.actionContext\.actorId/.test(routes)) {
      failures.push('POST /rentable-resources não deriva mais o owner de req.actionContext.actorId.');
    }
  }
  const service = stripComments(read('src/modules/rentals/rentable-resource.service.ts'));
  if (service && !/canRepresentActor/.test(service.match(/async updateStatus[\s\S]*?\n  \}/)?.[0] ?? '')) {
    failures.push('updateStatus perdeu a checagem canRepresentActor contra o owner JÁ REGISTRADO do recurso.');
  }
}

// ── 2: money-free ──
{
  const files = [
    'src/modules/rentals/rentable-resource.types.ts',
    'src/modules/rentals/rentable-resource.repository.ts',
    'src/modules/rentals/rentable-resource.service.ts',
    'src/modules/rentals/rentable-resource.routes.ts',
  ];
  const FIN_WORDS = ['bank_ledger', 'bank_transaction', 'price_cents', 'amount_cents', 'deposit', 'payout', 'checkout', 'payment_intent'];
  for (const f of files) {
    const src = stripComments(read(f)).toLowerCase();
    for (const w of FIN_WORDS) {
      if (src.includes(w)) {
        failures.push(`MONEY-FREE (DECISION-0151 §D): '${w}' apareceu em ${f} — locação MVP é pré-money; caução/pagamento/checkout ficam fora até decisão própria.`);
      }
    }
  }
}

// ── 3: availability/booking genérico intacto ──
{
  const avail = stripComments(read('src/core/availability/unified-availability.service.ts'));
  if (!/RENTABLE_RESOURCE/.test(avail) || !/confirmBookingWithResourceLock/.test(avail)) {
    failures.push('unified-availability.service.ts perdeu o branch RENTABLE_RESOURCE em updateBooking — o confirm de locação pararia de disparar o resource-lock.');
  }
  const routes = stripComments(read('src/core/availability/unified-availability.routes.ts'));
  if (!/z\.nativeEnum\(AvailabilityOwnerType\)/.test(routes)) {
    failures.push('createAvailabilitySchema deixou de aceitar qualquer AvailabilityOwnerType (nativeEnum) — se virou allowlist manual sem rentable_resource, a fatia quebra sem tocar em locação.');
  }
}

// ── 4: wiring ──
{
  const builder = stripComments(read('src/app.builder.ts'));
  if (!/rentals\.module/.test(builder)) {
    failures.push('app.builder não registra rentalsModule — a rota de recurso alugável morreu sem decisão.');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rental-resource-surface-contract]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [rental-resource-surface-contract] — POST /rentable-resources deriva owner server-side (canRepresentActor, sem crachá-alheio), money-free (DECISION-0151 §D), availability/booking genérico intacto (RENTABLE_RESOURCE branch + nativeEnum), rota wired no app.builder.');
