#!/usr/bin/env node
// audit-support-ticket-business-fact-gate.mjs
// Guard F-SUPPORT-TICKET-BUSINESS-FACT-GATE (Fatia 6, DESENHO_PAGINA_DO_ACTOR.md §5/§5B SELADO).
// Congela os invariantes do Chamado gated por FATO DE NEGÓCIO real:
//   1 · vocabulário GOVERNADO por CHECK (reference_type ∈ order/service_order/booking; status ∈
//       open/in_progress/resolved/closed); RLS ENABLE+FORCE; from<>to;
//   2 · a CATRACA CAUSAL — service rejeita (422) quando {from,to} declarados não batem EXATAMENTE
//       com as duas partes reais resolvidas da fonte viva (nunca confia no toActorId do cliente);
//   3 · composição pura — repository só LÊ orders/service_orders/availability+bookings (nunca
//       escreve nelas, nunca duplica a verdade de negócio numa tabela paralela);
//   4 · autoridade (DECISION-0113): abrir exige canRepresentActor sobre o autor; responder exige
//       ser uma das DUAS partes do PRÓPRIO chamado (fail-closed 403 pra estranho);
//   5 · zero dinheiro — Chamado NUNCA escreve bank_*/ledger/payment (isso é o domínio `disputes`,
//       módulo DIFERENTE, não tocado aqui — nomenclatura não pode se confundir);
//   6 · actor-page: ação 'support_ticket' acende SÓ com fato de negócio real (reusa o mesmo
//       resolver do módulo, nunca reinventa a checagem na página);
//   7 · frontend: renderiza o contrato, nunca decide o gate (localStorage=0).
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');
const fails = [];
const check = (label, ok) => { if (!ok) fails.push(label); console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`); };
const stripComments = (s) => s.split('\n').filter((l) => { const t = l.trim(); return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*'); }).join('\n');

const routes = read('src/modules/support-tickets/support-ticket.routes.ts');
const service = read('src/modules/support-tickets/support-ticket.service.ts');
const repo = read('src/modules/support-tickets/support-ticket.repository.ts');
const types = read('src/modules/support-tickets/support-ticket.types.ts');
const actorPageService = read('src/modules/actor-page/actor-page.service.ts');
const serviceCode = stripComments(service);
const repoCode = stripComments(repo);
const routesCode = stripComments(routes);

// 1 · migration + vocabulário
const migrationFile = readdirSync(resolve(ROOT, 'migrations')).find((f) => f.includes('support_tickets_business_fact_gate'));
check('migration: support_tickets_business_fact_gate existe', !!migrationFile);
if (migrationFile) {
  const migration = read(`migrations/${migrationFile}`);
  check("migration: reference_type CHECK exato (order/service_order/booking)",
    /CHECK \(reference_type IN \('order', 'service_order', 'booking'\)\)/.test(migration));
  check("migration: status CHECK exato (open/in_progress/resolved/closed)",
    /CHECK \(status IN \('open', 'in_progress', 'resolved', 'closed'\)\)/.test(migration));
  check('migration: from_actor_id <> to_actor_id (não abre chamado contra si mesmo)',
    /CHECK \(from_actor_id <> to_actor_id\)/.test(migration));
  check('migration: RLS ENABLE + FORCE', /ENABLE ROW LEVEL SECURITY/.test(migration) && /FORCE ROW LEVEL SECURITY/.test(migration));
}

// 2 · a catraca causal
check('service: rejeita (422) quando {from,to} não batem com as partes reais resolvidas',
  /declared\[0\] !== real\[0\] \|\| declared\[1\] !== real\[1\]/.test(serviceCode) && /422/.test(serviceCode));
check('service: resolve as partes da fonte VIVA antes de aceitar o chamado (resolveParties)',
  /resolveParties\(/.test(serviceCode));
check('service: fato de negócio ausente/tipo não suportado → 404 (nunca aceita silenciosamente)',
  /if \(!parties\)/.test(serviceCode) && /404/.test(serviceCode));

// 3 · composição pura no repository (só lê as fontes vivas, nunca escreve nelas)
check('repository: lê orders/service_orders/availability/bookings (fonte viva, sem duplicar)',
  /FROM orders/.test(repoCode) && /FROM service_orders/.test(repoCode) &&
  /FROM availability/.test(repoCode) && /FROM bookings/.test(repoCode));
check('repository: ZERO escrita nas tabelas-fonte (nunca INSERT/UPDATE em orders/service_orders/availability/bookings)',
  !/INSERT INTO (orders|service_orders|availability|bookings)\b/i.test(repoCode) &&
  !/UPDATE (orders|service_orders|availability|bookings)\b/i.test(repoCode));
check('repository: resolve owner polimórfico da booking (user/page direto; service_offering/service/rentable_resource via join) — nunca adivinha',
  /case 'service_offering'/.test(repo) && /case 'service'/.test(repo) && /case 'rentable_resource'/.test(repo) &&
  /default:\s*\n\s*return null;/.test(repoCode));

// 4 · autoridade
check('routes: POST /support-tickets exige canRepresentActor (abrir)',
  /'\/support-tickets'[\s\S]{0,400}assertRepresentsActor/.test(routes));
check('routes: POST /support-tickets/:id/respond exige canRepresentActor (responder)',
  /'\/support-tickets\/:id\/respond'[\s\S]{0,400}assertRepresentsActor/.test(routes));
check('service: responder exige ser uma das DUAS partes do PRÓPRIO chamado (fail-closed 403)',
  /ticket\.fromActorId !== respondingActorId && ticket\.toActorId !== respondingActorId/.test(serviceCode) && /403/.test(serviceCode));
check('routes: nenhum handler lê o actor-SUJEITO do body (actorId/fromActorId proibidos)',
  !/\bbody\??\.actorId\b|\bbody\??\.fromActorId\b/.test(routesCode));

// 5 · zero dinheiro (domínio DIFERENTE de `disputes` — não confundir)
check('módulo support-tickets: zero bank_/ledger/payment/payout (Δbank=0 por construção)',
  !/bank_|ledger|payment|payout/i.test(serviceCode + repoCode + routesCode));
check("types: vocabulário (identificadores de código, fora de comentários) não inclui reversão/estorno (nomenclatura não se confunde com `disputes`)",
  !/\brefund\b|\bchargeback\b/i.test(stripComments(types)));

// 6 · actor-page reusa o mesmo resolver (nunca reinventa)
check("actor-page.service: ação 'support_ticket' reusa supportTicketRepository.hasAnyBusinessFact (composição, não SQL novo)",
  /supportTicketRepository\.hasAnyBusinessFact/.test(actorPageService) &&
  /key: 'support_ticket'/.test(actorPageService));
check("actor-page.service: gatedBy 'SEM_FATO_DE_NEGOCIO' quando não há fato real (nunca enabled:true sem checar)",
  /gatedBy: hasFact \? undefined : 'SEM_FATO_DE_NEGOCIO'/.test(actorPageService));

// 7 · frontend
const FRONT = resolve(ROOT, '..', 'frontend', 'src');
const readF = (p) => readFileSync(resolve(FRONT, p), 'utf8');
try {
  const page = readF('pages/ActorPage.tsx');
  const apiTickets = readF('api/support-tickets.ts');
  check("frontend: ActorPage trata a ação 'support_ticket' (abre o fluxo, não hardcoded)",
    /support_ticket/.test(page));
  check('frontend: api support-tickets sem localStorage (zero verdade local)',
    !apiTickets.includes('localStorage'));
} catch (e) {
  check(`frontend: arquivos do Chamado legíveis (${e.message})`, false);
}

if (fails.length) {
  console.error(`\nSUPPORT-TICKET-BUSINESS-FACT-GATE: ${fails.length} FAIL`);
  process.exit(1);
}
console.log('\nSUPPORT-TICKET-BUSINESS-FACT-GATE: OK');
