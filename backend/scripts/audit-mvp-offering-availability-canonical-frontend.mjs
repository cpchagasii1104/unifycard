#!/usr/bin/env node
// Guard estrutural — F-MVP-SERVICE-CHAIN-W1-OFFERING-AVAILABILITY-UX-CONTAINMENT (2026-06-27).
//
// LEI DA ROTA (não do botão): no MVP a disponibilidade operacional RESERVÁVEL = availability da OFERTA
//   (owner_type='service_offering'), declarada ao publicar o serviço e lida pelo consumer no
//   ServiceOfferingSelector. A agenda SERVICE-level (POST /services/:id/availability, owner=service) é
//   INVISÍVEL a quem reserva. Esta fatia contém a armadilha de UX no chokepoint da ROTA: /services/:id/
//   availability deixa de criar agenda service-level e passa a render terminal honesto. Isso fecha de uma
//   vez os DOIS vetores (ServiceDetailPage "Disponibilidade" + ServiceDiscoveryDetailPage "Ver
//   Disponibilidade Completa"). Frontend-only, money-free, sem migration, sem backend novo.
// Protege:
//   (A) App.tsx NÃO roteia mais <ServiceAvailabilityPage> (agenda service-level fora da árvore viva); a
//       rota /services/:id/availability renderiza ServiceLegacyQuarantinePage variant
//       'availability-offering-managed' (terminal honesto).
//   (B) ServiceCreatePage.tsx PRESERVA o caminho canônico offering-level (declareOfferingAvailability).
//   (C) ServiceOfferingSelector.tsx PRESERVA a leitura canônica do consumer (ownerType 'service_offering').
//   (D) Nenhuma superfície CONSUMER (discovery/selector) importa/chama createServiceAvailability —
//       a escrita service-level não pode virar consumer-facing.
//   (E) ServiceLegacyQuarantinePage.tsx possui a variante honesta 'availability-offering-managed' e NÃO
//       chama createServiceAvailability/listServiceAvailabilities.
//   (F) money-firewall + (G) sem schedules/schedule_slots nos arquivos tocados.
// Heurística textual (não AST). Integrado em validate:regression-guards. NÃO toca backend/src.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const APP = join(FE_SRC, 'App.tsx');
const CREATE_PAGE = join(FE_SRC, 'pages', 'ServiceCreatePage.tsx');
const SELECTOR = join(FE_SRC, 'components', 'ServiceOfferingSelector.tsx');
const QUARANTINE = join(FE_SRC, 'pages', 'ServiceLegacyQuarantinePage.tsx');
const DISCOVERY = join(FE_SRC, 'pages', 'ServiceDiscoveryPage.tsx');
const DISCOVERY_DETAIL = join(FE_SRC, 'pages', 'ServiceDiscoveryDetailPage.tsx');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const stripComments = (s) =>
  s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };
let checked = 0;

// (A) App.tsx — rota service-level contida ─────────────────────────────────────────────────────────
const appRaw = read(APP);
if (!appRaw) {
  failures.push('MVP_OFFERING_AVAIL_FE (A): App.tsx ausente.');
} else {
  const app = stripComments(appRaw);
  checked++;
  must(!/<ServiceAvailabilityPage\b/.test(app),
    'MVP_OFFERING_AVAIL_FE (A): App.tsx voltou a ROTEAR <ServiceAvailabilityPage> — a agenda service-level (owner=service) é invisível ao consumer e não pode ser superfície reservável viva.');
  must(!/import\s+ServiceAvailabilityPage\b/.test(app),
    'MVP_OFFERING_AVAIL_FE (A): App.tsx voltou a importar ServiceAvailabilityPage (página service-level deve ficar órfã em disco, fora da árvore viva).');
  // a rota /services/:id/availability deve resolver para o terminal honesto
  const routeLine = (app.split('\n').find((l) => /services\/:id\/availability/.test(l)) || '');
  must(/ServiceLegacyQuarantinePage/.test(routeLine) && /availability-offering-managed/.test(routeLine),
    'MVP_OFFERING_AVAIL_FE (A): a rota /services/:id/availability não renderiza mais ServiceLegacyQuarantinePage variant="availability-offering-managed" (terminal honesto).');
}

// (B) ServiceCreatePage — caminho canônico offering-level preservado ───────────────────────────────
const createRaw = read(CREATE_PAGE);
if (!createRaw) {
  failures.push('MVP_OFFERING_AVAIL_FE (B): ServiceCreatePage.tsx ausente (caminho offering-level canônico).');
} else {
  const create = stripComments(createRaw);
  checked++;
  must(/declareOfferingAvailability\s*\(/.test(create),
    'MVP_OFFERING_AVAIL_FE (B): ServiceCreatePage.tsx não declara mais availability da OFERTA (declareOfferingAvailability) — o caminho reservável canônico foi quebrado.');
  must(!/createServiceAvailability\b/.test(create),
    'MVP_OFFERING_AVAIL_FE (B): ServiceCreatePage.tsx passou a criar availability SERVICE-level (createServiceAvailability) — divergência proibida.');
}

// (C) ServiceOfferingSelector — leitura canônica do consumer preservada ────────────────────────────
const selRaw = read(SELECTOR);
if (!selRaw) {
  failures.push('MVP_OFFERING_AVAIL_FE (C): ServiceOfferingSelector.tsx ausente (leitura canônica do consumer).');
} else {
  const sel = stripComments(selRaw);
  checked++;
  must(/listAvailabilities\s*\(/.test(sel) && /ownerType:\s*['"]service_offering['"]/.test(sel),
    "MVP_OFFERING_AVAIL_FE (C): ServiceOfferingSelector.tsx não lê mais availability owner_type='service_offering' — a reserva do consumer depende disso.");
  must(!/createServiceAvailability\b|service-availability\b/.test(sel),
    'MVP_OFFERING_AVAIL_FE (C): ServiceOfferingSelector.tsx passou a tocar a agenda service-level (service-availability) — consumer não pode escrever/ler agenda divergente.');
}

// (D) superfícies CONSUMER não importam a escrita service-level ─────────────────────────────────────
for (const [label, path] of [['ServiceDiscoveryPage', DISCOVERY], ['ServiceDiscoveryDetailPage', DISCOVERY_DETAIL]]) {
  const raw = read(path);
  if (raw) {
    const code = stripComments(raw);
    checked++;
    must(!/createServiceAvailability\b/.test(code) && !/from\s+['"][^'"]*api\/service-availability['"]/.test(code),
      `MVP_OFFERING_AVAIL_FE (D): ${label}.tsx passou a usar a escrita service-level (createServiceAvailability / api/service-availability) — agenda divergente não pode virar consumer-facing.`);
  }
}

// (E) terminal honesto existe e não chama a agenda service-level ───────────────────────────────────
const qRaw = read(QUARANTINE);
if (!qRaw) {
  failures.push('MVP_OFFERING_AVAIL_FE (E): ServiceLegacyQuarantinePage.tsx ausente (terminal honesto).');
} else {
  const q = stripComments(qRaw);
  checked++;
  // exige a ENTRADA de COPY (chave com dois-pontos), não só a string solta no union de tipos —
  // é a COPY que renderiza o título/lead honesto.
  must(/['"]availability-offering-managed['"]\s*:/.test(q),
    "MVP_OFFERING_AVAIL_FE (E): ServiceLegacyQuarantinePage.tsx perdeu a COPY da variante honesta 'availability-offering-managed' (título/lead que o terminal renderiza).");
  must(!/createServiceAvailability\b|listServiceAvailabilities\b|from\s+['"][^'"]*api\/service-availability['"]/.test(q),
    'MVP_OFFERING_AVAIL_FE (E): o terminal honesto passou a chamar a agenda service-level (createServiceAvailability/listServiceAvailabilities) — deve apenas orientar.');
}

// (F) money-firewall + (G) sem schedules/schedule_slots no terminal honesto tocado ─────────────────
// (App.tsx é o router GLOBAL — já contém rotas de dinheiro/payout/settlement legítimas e pré-existentes;
//  varrê-lo aqui seria falso-positivo. A varredura money/schedules incide só na superfície NOVA desta fatia.)
{
  const raw = read(QUARANTINE);
  if (raw) {
    const code = stripComments(raw);
    checked++;
    must(!/api\/bank|\/payout|settlement\b|financial-terms|\bledger\b/i.test(code),
      'MVP_OFFERING_AVAIL_FE (F): ServiceLegacyQuarantinePage passou a tocar dinheiro (Bank/payout/settlement/financial-terms/ledger) nesta fatia money-free.');
    must(!/\/schedules\b|schedule_slots/.test(code),
      'MVP_OFFERING_AVAIL_FE (G): ServiceLegacyQuarantinePage passou a reabrir schedules/schedule_slots (fora do escopo do MVP).');
  }
}

console.log(`[mvp-offering-availability-canonical-frontend] checked=${checked} failures=${failures.length}`);
if (failures.length > 0) {
  console.error('GATE FAIL [mvp-offering-availability-canonical-frontend]:');
  failures.forEach((f) => console.error('  ❌', f));
  process.exit(1);
}
console.log("GATE OK [mvp-offering-availability-canonical-frontend] — rota /services/:id/availability contida em terminal honesto; agenda service-level fora da árvore viva; offering-level canônico (declareOfferingAvailability) + leitura do consumer (owner='service_offering') preservados; sem consumer-facing service-level; money-free; sem schedules.");
