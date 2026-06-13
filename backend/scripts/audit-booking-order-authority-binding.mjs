#!/usr/bin/env node
// Gate estrutural — F-BOOKING-ORDER-BINDING-CANONICAL.
// Sela o fix do CONFUSED-DEPUTY booking -> decision -> service_order: a AUTORIDADE de
// decidir/confirmar deriva do DONO SOBERANO da availability (resolveAvailabilityOwner +
// canRepresentActor), NUNCA de booking.metadata.serviceId (hint cliente-declarado —
// DECISION-0113; AUTHORITY_LAW §17; AUTHORITY_ENFORCEMENT_MODEL §8 "availability vence").
// Integrado em validate:regression-guards. Heurística textual comment-stripped, não AST —
// falso positivo torna o gate MAIS restritivo.
//
// REGRA: todo WRITER que cria service_order (serviceOrderRepository.createOrder) OU decisão de
// booking (serviceBookingDecisionRepository.create) E lê metadata.serviceId DEVE também provar o
// binding canônico via resolveAvailabilityOwner — senão é regressão do confused-deputy.
// PROIBIDO o padrão antigo de autoridade-por-metadata: `service.actorId === <ator client-declared>`.

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

const SRC = join(process.cwd(), 'src');

const stripComments = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const read = (p) => stripComments(readFileSync(p, 'utf-8'));

// Sinks de escrita da cadeia (criar order OU criar decisão de booking).
const WRITE_SINK = /serviceOrderRepository\.createOrder\(|serviceBookingDecisionRepository\.create\(/;
// Leitura do hint cliente-declarado.
const METADATA_SERVICEID = /metadata\??\.serviceId\b/;
// Binding canônico exigido.
const OWNER_BINDING = /resolveAvailabilityOwner\(/;
// Padrão proibido: autoridade derivada do dono do service resolvido por metadata, comparada a
// ator client-declared (decidedByActorId / confirmedByActorId / actionContext.actorId).
const AUTHORITY_BY_SERVICE_OWNER =
  /service\.actorId\s*[!=]==?\s*(input\.decidedByActorId|decidedByActorId|confirmedByActorId|actionContext\.actorId)\b/;

// Denominador explícito: writers conhecidos da cadeia (devem permanecer conformes).
const KNOWN_WRITERS = [
  'modules/services/service-booking-decision.service.ts',
  'modules/services/service-order.service.ts',
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, files);
    } else if (extname(full) === '.ts' && full.endsWith('.service.ts')) {
      files.push(full);
    }
  }
  return files;
}

const failures = [];
let checked = 0;

// 1) Writers conhecidos existem e estão conformes (binding presente; padrão antigo ausente).
for (const rel of KNOWN_WRITERS) {
  const p = join(SRC, rel);
  if (!existsSync(p)) {
    failures.push(`FORBIDDEN_REGRESSION: writer canônico da cadeia desapareceu: ${rel}`);
    continue;
  }
  const code = read(p);
  checked++;
  if (METADATA_SERVICEID.test(code) && !OWNER_BINDING.test(code)) {
    failures.push(`CONFUSED_DEPUTY_REGRESSION: ${rel} lê metadata.serviceId sem resolveAvailabilityOwner (binding ao dono soberano da availability perdido).`);
  }
  if (AUTHORITY_BY_SERVICE_OWNER.test(code)) {
    failures.push(`CONFUSED_DEPUTY_REGRESSION: ${rel} voltou a derivar autoridade de service.actorId vs ator client-declared (autoridade por metadata — proibido).`);
  }
}

// 2) Varredura ampla: QUALQUER novo writer (cria order/decisão) que leia metadata.serviceId sem
//    binding canônico = nova violação.
for (const file of walk(SRC)) {
  const rel = file.replace(SRC, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
  const code = read(file);
  if (!WRITE_SINK.test(code)) continue;
  if (!METADATA_SERVICEID.test(code)) continue;
  checked++;
  if (!OWNER_BINDING.test(code)) {
    failures.push(`CONFUSED_DEPUTY_REGRESSION: ${rel} cria service_order/decision lendo metadata.serviceId SEM resolveAvailabilityOwner — vincule a autoridade ao dono da availability (DECISION-0113).`);
  }
  if (AUTHORITY_BY_SERVICE_OWNER.test(code)) {
    failures.push(`CONFUSED_DEPUTY_REGRESSION: ${rel} usa service.actorId == ator client-declared como autoridade (padrão confused-deputy — proibido).`);
  }
}

console.log(`[booking-order-authority-binding] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [booking-order-authority-binding]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log('GATE OK [booking-order-authority-binding] — decisão/order vinculam autoridade ao dono soberano da availability; metadata.serviceId é hint, não autoridade.');
