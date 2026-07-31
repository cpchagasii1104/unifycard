#!/usr/bin/env node
// audit-rides-operational-schema-ghost-containment.mjs — F-RIDES-GHOST-CONTAINMENT (2026-07-31)
//
// CONTEXTO (censo em unificard_dev, 2026-07-31 — cartório no topo do REMEDIATION_DT_LOG.md):
//   O trilho FINANCEIRO de rides já estava contido (rotas comentadas + firewall + guard
//   audit-rides-money-antirevival-guard.mjs). O trilho OPERACIONAL ficou de pé QUEBRADO: rotas
//   MONTADAS escreviam/liam substrato que NÃO existe no schema canônico — usuário recebia 500
//   cru (42P01/42883) numa ação de usuário (ficar online). Esta fatia conteve endpoint a
//   endpoint (501 nomeado ANTES de service/SQL, padrão automation.routes.ts), preservando os
//   endpoints cujo substrato EXISTE (14 tabelas rides vivas).
//
// SUBSTRATO FANTASMA (12 tabelas + 4 funções; NÃO materializar sem frente própria GATE+GO):
//   tabelas: rides_driver_availability · rides_emergency_contacts · rides_ride_events ·
//            rides_ride_shares · rides_disputes · rides_safety_alerts · rides_zone_demand_pressure ·
//            rides_zone_incentives · rides_driver_services · rides_driver_documents ·
//            rides_driver_destinations · notify_queue
//   funções: rides_check_driving_limit · rides_calculate_realtime_earnings ·
//            rides_calculate_zone_pressure · rides_create_auto_zone_incentive
//
// ESTE GUARD MORDE SE:
//   (A) rides.module.ts deixar de registrar algum dos 9 grupos operacionais (contenção por
//       desmontagem é PROIBIDA — apagaria o que presta; o guard anti-revival também trava isso);
//   (B) alguma rota MONTADA voltar a usar substrato fantasma sem contenção: SQL direto
//       (FROM/JOIN/INTO/UPDATE tabela fantasma; chamada de função fantasma) ou entrypoint de
//       service que alcança substrato fantasma (lista congelada abaixo);
//   (C) um marcador de contenção 501 sumir de um arquivo contido (revival por remoção);
//   (D) um arquivo NOVO entrar no fecho de imports das rotas montadas referenciando substrato
//       fantasma, ou um arquivo já allowlistado ganhar referência fantasma NOVA.
//
// Heurística textual comment-stripped (não AST), padrão da casa. NÃO altera runtime.
// Reabrir um endpoint = frente própria que MATERIALIZA o substrato + atualização CONSCIENTE
// deste guard (remover o id da lista fantasma junto com a migration que o materializa).

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const failures = [];

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
};

const GHOST_TABLES = [
  'rides_driver_availability',
  'rides_emergency_contacts',
  'rides_ride_events',
  'rides_ride_shares',
  'rides_disputes',
  'rides_safety_alerts',
  'rides_zone_demand_pressure',
  'rides_zone_incentives',
  'rides_driver_services',
  'rides_driver_documents',
  'rides_driver_destinations',
  'notify_queue',
];
const GHOST_FUNCTIONS = [
  'rides_check_driving_limit',
  'rides_calculate_realtime_earnings',
  'rides_calculate_zone_pressure',
  'rides_create_auto_zone_incentive',
];

// Entrypoints de service cuja cadeia alcança substrato fantasma — rota montada NÃO pode chamá-los.
const GHOST_SERVICE_ENTRYPOINTS = [
  /locationService\s*\.\s*(updateLocation|updateDriverLocation)\b/,
  /availabilityService\s*\.\s*(goOnline|goOffline|isOnline|getStatus|setDestinationMode|incrementDrivingTime)\b/,
  /demandService\s*\.\s*\w+/,
  /safetyService\s*\.\s*\w+/,
  /notifyService\s*\.\s*send\b/,
  /driversService\s*\.\s*(uploadDriverDocument|approveDriver|checkExpiredDocuments)\b/,
];

// Os 9 grupos operacionais montados (mesmo conjunto vivo do guard anti-revival).
const MOUNTED_ROUTE_FILES = {
  'src/modules/rides/drivers/drivers.routes.ts': { marker: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED', min501: 1 },
  'src/modules/rides/drivers/vehicles/vehicles.routes.ts': { marker: null, min501: 0 },
  'src/modules/rides/location/location.routes.ts': { marker: 'RIDES_LOCATION_SCHEMA_GHOST_CONTAINED', min501: 1 },
  'src/modules/rides/availability/availability.routes.ts': { marker: 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED', min501: 4 },
  'src/modules/rides/safety/safety.routes.ts': { marker: 'RIDES_SAFETY_SCHEMA_GHOST_CONTAINED', min501: 5 },
  'src/modules/rides/zones/zones.routes.ts': { marker: null, min501: 0 },
  'src/modules/rides/demand/demand.routes.ts': { marker: 'RIDES_DEMAND_SCHEMA_GHOST_CONTAINED', min501: 4 },
  'src/modules/rides/service-types/service-types.routes.ts': { marker: 'RIDES_DRIVER_SERVICES_SCHEMA_GHOST_CONTAINED', min501: 2 },
  'src/modules/rides/cities/cities.routes.ts': { marker: null, min501: 0 },
};

// Fecho de imports: arquivos que PODEM manter referência fantasma (métodos sem caller montado —
// as rotas que os alcançavam estão contidas ou nunca existiram). CONGELADO: id novo morde.
const CLOSURE_ALLOWLIST = {
  'src/modules/rides/drivers/drivers.service.ts': ['rides_driver_documents'],
  'src/modules/rides/location/location.service.ts': ['rides_check_driving_limit', 'rides_calculate_realtime_earnings'],
  'src/modules/rides/availability/availability.service.ts': ['rides_driver_availability', 'rides_check_driving_limit', 'rides_driver_destinations'],
  'src/modules/rides/demand/demand.service.ts': ['rides_calculate_zone_pressure', 'rides_zone_incentives', 'rides_driver_availability', 'rides_zone_demand_pressure'],
  'src/modules/rides/zones/zones.service.ts': ['rides_calculate_zone_pressure'],
  // O notificador (frente própria — plataforma de notificação unificada) entra no fecho via
  // demand.service (importado por location.service). notify_queue é contido na BORDA (rotas 501),
  // NUNCA dentro do notify.service — decisão explícita do pacote F-RIDES-GHOST-CONTAINMENT.
  'src/core/notify/notify.service.ts': ['notify_queue'],
};

// Padrões de USO (não mera menção): SQL direto ou chamada de função.
const sqlUse = (id) => new RegExp(`(FROM|JOIN|INTO|UPDATE)\\s+${id}\\b`, 'i');
const fnCall = (id) => new RegExp(`${id}\\s*\\(`);

// ── CHECK A — os 9 grupos continuam registrados ─────────────────────────────
const mod = read('src/modules/rides/rides.module.ts');
if (mod === null) {
  failures.push('arquivo ausente: src/modules/rides/rides.module.ts');
} else {
  const modStripped = stripTs(mod);
  for (const r of ['driversRoutes', 'vehiclesRoutes', 'locationRoutes', 'availabilityRoutes', 'safetyRoutes', 'zonesRoutes', 'demandRoutes', 'serviceTypesRoutes', 'citiesRoutes']) {
    if (!new RegExp(`register\\(\\s*${r}\\b`).test(modStripped)) {
      failures.push(`rides.module.ts: grupo operacional '${r}' deixou de ser registrado — contenção por desmontagem é PROIBIDA (apaga o que presta).`);
    }
  }
}

// ── CHECK B + C — rotas montadas: sem uso fantasma; marcadores de contenção vivos ──
for (const [rel, { marker, min501 }] of Object.entries(MOUNTED_ROUTE_FILES)) {
  const raw = read(rel);
  if (raw === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  const src = stripTs(raw);

  for (const t of GHOST_TABLES) {
    if (sqlUse(t).test(src)) {
      failures.push(`${rel}: SQL vivo usa tabela FANTASMA '${t}' (FROM/JOIN/INTO/UPDATE) — substrato não existe; era isto que dava 500 cru. Revival sem materialização é PROIBIDO.`);
    }
  }
  for (const f of GHOST_FUNCTIONS) {
    if (fnCall(f).test(src)) {
      failures.push(`${rel}: chamada viva à função FANTASMA '${f}(' — não existe no schema (42883). Revival sem materialização é PROIBIDO.`);
    }
  }
  for (const re of GHOST_SERVICE_ENTRYPOINTS) {
    if (re.test(src)) {
      failures.push(`${rel}: rota montada chama entrypoint de service que alcança substrato fantasma (${re}) — a contenção é na BORDA (501 antes do service).`);
    }
  }
  if (marker) {
    if (!src.includes(marker)) {
      failures.push(`${rel}: marcador de contenção '${marker}' sumiu — endpoint fantasma pode ter sido reaberto sem materialização.`);
    }
    const n501 = (src.match(/status\(\s*501\s*\)/g) || []).length;
    if (n501 < min501) {
      failures.push(`${rel}: esperado ≥${min501} respostas 501 de contenção, encontrado ${n501} — endpoint contido pode ter sido reaberto.`);
    }
  }
}

// ── CHECK D — fecho de imports das rotas montadas: referência fantasma só onde congelado ──
const resolveImport = (fromRel, spec) => {
  let baseRel = null;
  if (spec.startsWith('.')) {
    const dir = dirname(fromRel);
    baseRel = join(dir, spec).split('\\').join('/');
  } else if (spec.startsWith('@core/')) {
    baseRel = 'src/core/' + spec.slice('@core/'.length);
  } else {
    return null; // pacote externo / outros aliases: fora do escopo rides
  }
  for (const cand of [baseRel + '.ts', baseRel + '/index.ts']) {
    if (existsSync(join(ROOT, cand))) return cand;
  }
  return null;
};

const closure = new Set();
const queue = Object.keys(MOUNTED_ROUTE_FILES);
while (queue.length > 0) {
  const rel = queue.pop();
  if (closure.has(rel)) continue;
  closure.add(rel);
  const raw = read(rel);
  if (raw === null) continue;
  const src = stripTs(raw);
  const importRe = /import\s+(?:type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const resolved = resolveImport(rel, m[1]);
    // segue só arquivos rides + o notificador (borda notify_queue); resto é fora do escopo
    if (resolved && (resolved.startsWith('src/modules/rides/') || resolved === 'src/core/notify/notify.service.ts')) {
      if (!closure.has(resolved)) queue.push(resolved);
    }
  }
}

for (const rel of closure) {
  if (rel in MOUNTED_ROUTE_FILES) continue; // já cobertos pelo CHECK B (regra mais dura: zero uso)
  const raw = read(rel);
  if (raw === null) continue;
  const src = stripTs(raw);
  const found = [];
  for (const id of [...GHOST_TABLES, ...GHOST_FUNCTIONS]) {
    if (sqlUse(id).test(src) || fnCall(id).test(src)) found.push(id);
  }
  if (found.length === 0) continue;
  const allowed = CLOSURE_ALLOWLIST[rel];
  if (!allowed) {
    failures.push(`${rel}: entrou no fecho de imports das rotas montadas referenciando substrato fantasma [${found.join(', ')}] e NÃO está na allowlist congelada — caminho novo até o fantasma.`);
    continue;
  }
  for (const id of found) {
    if (!allowed.includes(id)) {
      failures.push(`${rel}: referência fantasma NOVA '${id}' (allowlist congelada: [${allowed.join(', ')}]).`);
    }
  }
}

// ── veredito ─────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('❌ [audit-rides-operational-schema-ghost-containment] FALHOU:');
  for (const f of failures) console.error('   · ' + f);
  process.exit(1);
}
console.log(
  '✅ audit-rides-operational-schema-ghost-containment: 9 grupos montados; endpoints de substrato fantasma ' +
  '(12 tabelas + 4 funções) contidos com 501 nomeado antes de service/SQL; nenhum uso fantasma vivo em rota ' +
  'montada; fecho de imports congelado (referências dormentes só na allowlist).'
);
