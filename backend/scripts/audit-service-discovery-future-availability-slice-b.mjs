#!/usr/bin/env node
// Guard estrutural — F-SERVICE-DISCOVERY-FUTURE-AVAILABILITY-SLICE-B
// (DT-SERVICE-DISCOVERY-IGNORES-FUTURE-AVAILABILITY D2+D3).
//
// `discoverServices` tinha startDate/endDate na assinatura mas NUNCA os usava para filtrar — a
// vitrine listava prestador sem nenhuma agenda futura. D2 (tem janela futura, sem data) já estava
// canonicamente resolvido (Slice A2D, hasCanonicalOfferingFutureAvailability), mas só disparava
// com hasAvailability===true EXPLÍCITO. D3 (janela compatível com data/hora) nunca existia.
//
// Achado extra: o frontend mandava start_date/end_date, mas o backend espera starts_at/ends_at —
// os filtros de data NUNCA chegavam ao backend (mismatch de nome de query param).
//
// MORDE:
//   (A) hasCanonicalOfferingFutureAvailability perder o parâmetro de window (D3 regredido pro D2 puro);
//   (B) discoverServices voltar a disparar o filtro SOMENTE com hasAvailability===true (perdendo o
//       gatilho implícito de startDate/endDate);
//   (C) o frontend voltar a mandar start_date/end_date em vez de starts_at/ends_at.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];

// (A) hasCanonicalOfferingFutureAvailability aceita window.
const REPO = join(ROOT, 'src', 'modules', 'services', 'services.repository.ts');
if (!existsSync(REPO)) {
  failures.push(`arquivo ausente: ${REPO}`);
} else {
  const src = stripTs(readFileSync(REPO, 'utf-8'));
  if (!/hasCanonicalOfferingFutureAvailability[\s\S]{0,300}window\?:\s*\{\s*windowStart/.test(src)) {
    failures.push(`${REPO}: hasCanonicalOfferingFutureAvailability perdeu o parâmetro window (D3 regredido).`);
  }
  if (!/a\.start_datetime < \$6/.test(src) || !/a\.end_datetime > \$5/.test(src)) {
    failures.push(`${REPO}: overlap de janela (D3) ausente na query SQL.`);
  }
}

// (B) discoverServices dispara filtro com startDate/endDate mesmo sem hasAvailability===true.
const SERVICE = join(ROOT, 'src', 'modules', 'services', 'services.service.ts');
if (!existsSync(SERVICE)) {
  failures.push(`arquivo ausente: ${SERVICE}`);
} else {
  const src = stripTs(readFileSync(SERVICE, 'utf-8'));
  if (!/wantsAvailabilityFilter = filters\.hasAvailability === true \|\| !!startDate \|\| !!endDate/.test(src)) {
    failures.push(`${SERVICE}: gatilho implícito de startDate/endDate ausente — voltaria a exigir hasAvailability===true.`);
  }
}

// (C) frontend usa starts_at/ends_at (não start_date/end_date) na query string real.
const FRONTEND_API = join(ROOT, '..', 'frontend', 'src', 'api', 'service-discovery.ts');
if (!existsSync(FRONTEND_API)) {
  failures.push(`arquivo ausente: ${FRONTEND_API}`);
} else {
  const src = stripTs(readFileSync(FRONTEND_API, 'utf-8'));
  if (!/queryParams\.append\('starts_at'/.test(src) || !/queryParams\.append\('ends_at'/.test(src)) {
    failures.push(`${FRONTEND_API}: query string não usa starts_at/ends_at — mismatch de nome com o backend reintroduzido.`);
  }
  if (/queryParams\.append\('start_date'/.test(src) || /queryParams\.append\('end_date'/.test(src)) {
    failures.push(`${FRONTEND_API}: voltou a mandar start_date/end_date na query string (nome errado, backend não reconhece).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [service-discovery-future-availability-slice-b]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [service-discovery-future-availability-slice-b] — D2 (janela futura) + D3 (janela compatível com data) ligados via SSOT canônico; startDate/endDate disparam filtro mesmo sem hasAvailability explícito; frontend manda starts_at/ends_at. DT-SERVICE-DISCOVERY-IGNORES-FUTURE-AVAILABILITY blindada.');
