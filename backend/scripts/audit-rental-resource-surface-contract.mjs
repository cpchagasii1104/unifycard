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
  // DECISION-0151 ADENDO A (2026-07-07, ordem direta de Clayton): price_cents/pricing_unit
  // ENTRARAM como REGISTRO puro do anúncio (mesmo estatuto de service_demands.offered_price_cents,
  // já revisado por Yala) — NÃO é execução financeira. §D continua vetando EXECUÇÃO (caução real,
  // checkout, split, bank_*) — isso segue banido abaixo.
  const FIN_WORDS = ['bank_ledger', 'bank_transaction', 'amount_cents', 'deposit', 'payout', 'checkout', 'payment_intent'];
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

// ── 4: wiring (backend) ──
{
  const builder = stripComments(read('src/app.builder.ts'));
  if (!/rentals\.module/.test(builder)) {
    failures.push('app.builder não registra rentalsModule — a rota de recurso alugável morreu sem decisão.');
  }
}

// ── 5: wiring (frontend, F-RENTAL-RESOURCE-SURFACE-SLICE-B) ──
// module-registry deixou de ser STUB (a UI real existe agora); as páginas + rotas devem seguir vivas.
{
  const registry = stripComments(read('src/core/navigation/module-registry.ts'));
  if (/moduleKey:\s*'rentals'[\s\S]{0,120}?status:\s*'STUB'/.test(registry)) {
    failures.push("module-registry: 'rentals' voltou a STUB — a Slice B já entregou UI real; reverter exige decisão, não regressão silenciosa.");
  }
  const FE = join('..', 'frontend', 'src');
  const listPage = read(join(FE, 'pages', 'RentalResourceListPage.tsx'));
  const detailPage = read(join(FE, 'pages', 'RentalResourceDetailPage.tsx'));
  const appTsx = stripComments(read(join(FE, 'App.tsx')));
  if (!listPage) failures.push('RentalResourceListPage.tsx ausente — Slice B removida sem decisão.');
  if (!detailPage) failures.push('RentalResourceDetailPage.tsx ausente — Slice B removida sem decisão.');
  if (!/path="locacoes"/.test(appTsx) || !/path="locacoes\/:id"/.test(appTsx)) {
    failures.push('App.tsx perdeu as rotas locacoes/locacoes/:id — módulo LIVE no registry sem rota real seria dead-end.');
  }
  // 2026-07-07: searchCanonicalServices (catálogo INTEIRO) foi substituído por
  // listRentalConceptsByType (catálogo filtrado por tipo+offer_kind='rentable' — fix do
  // vazamento motoboy/guincho). A garantia continua a mesma: busca SEMPRE governada, nunca texto
  // livre virando concept_id.
  if (!/createRentableResource/.test(listPage) || !/listRentalConceptsByType/.test(listPage)) {
    failures.push('RentalResourceListPage.tsx: criação de recurso ou busca de concept governado sumiu — risco de reintroduzir taxonomia inventada no cliente.');
  }
  if (!/createAvailability|confirmBooking|createBooking/.test(detailPage)) {
    failures.push('RentalResourceDetailPage.tsx deixou de usar o client de availability existente — se reimplementou booking próprio, é segunda fonte de verdade (DECISION-0159).');
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rental-resource-surface-contract]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [rental-resource-surface-contract] — POST /rentable-resources deriva owner server-side (canRepresentActor, sem crachá-alheio), money-free (DECISION-0151 §D), availability/booking genérico intacto (RENTABLE_RESOURCE branch + nativeEnum), rota wired no app.builder.');
