#!/usr/bin/env node
// Guard estrutural — F-RIDES-ANTIREVIVAL-GUARD-SLICE-A
//   (DT-RIDES-MONEY-NO-FIREWALL-DEAD-CODE-ONLY-CONTAINMENT / DT-RIDES-USER-SCOPE-LEGACY-NOT-ACTOR).
//
// CONTEXTO (RAIO-X F-RIDES-MONEY-AUTHORITY-READONLY, HEAD ea8005d21):
//   • rides NÃO vaza dinheiro hoje: o writer financeiro processRidePayment existe e toca o Bank
//     (distributionService.processRidePayment -> bankIntegrationService.processRidePayment -> ledger),
//     MAS só é alcançável por rotas MORTAS/não-registradas.
//   • processRidePayment NÃO tem firewall/flag default-OFF própria (não chama assertCheckoutFinancialRuntimeEnabled —
//     esse gate cobre só os métodos de EVENTOS do bankIntegration). A contenção atual é PURO dead-code/não-registro.
//   • rides.module.ts monta só rotas operacionais/admin; o agregador financeiro rides.routes.ts (que registra
//     distribution/lifecycle/matching/pricing/promotions/referrals) está COMENTADO no rides.module.ts.
//
// DECISÃO DESTA FATIA (Clayton): NÃO adicionar firewall runtime agora; NÃO reviver rides; só TRAVAR a reativação
//   acidental. Este gate MORDE (RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL) se rides financeiro voltar a ficar
//   alcançável sem firewall explícito:
//   (A) rides.module.ts registrar qualquer rota financeira morta (rides/matching/pricing/lifecycle/promotions/referrals)
//       ou registrar distribution; ou perder uma das 9 rotas operacionais permitidas.
//   (B) o agregador morto rides.routes.ts (ridesRoutes) for registrado em qualquer caminho vivo.
//   (C) qualquer caller NOVO de processRidePayment aparecer fora da allowlist morta/documentada
//       (distributionService.* ou bankIntegrationService.*).
//   (D) bank_transaction_id de rides passar a ser escrito por arquivo rides fora da allowlist morta.
//
// Em validate:regression-guards. Heurística textual comment-stripped (não AST). NÃO altera runtime/Bank/rides.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const norm = (p) => p.split(sep).join('/');

const failures = [];

// ───────────────────────────────────────────────────────────────────────────
// CHECK A — rides.module.ts: rotas financeiras mortas continuam mortas; operacionais continuam vivas.
// ───────────────────────────────────────────────────────────────────────────
const MODULE_REL = 'src/modules/rides/rides.module.ts';
const mod = read(MODULE_REL);
if (mod === null) {
  failures.push(`arquivo ausente: ${MODULE_REL}`);
} else {
  // Rotas financeiras / fluxo principal que DEVEM permanecer NÃO-registradas (comentadas).
  const DEAD_FINANCIAL = ['ridesRoutes', 'matchingRoutes', 'pricingRoutes', 'lifecycleRoutes', 'promotionsRoutes', 'referralsRoutes'];
  for (const r of DEAD_FINANCIAL) {
    // comment-stripped: se a chamada register(<r> aparece, a rota foi reativada.
    if (new RegExp(`register\\(\\s*${r}\\b`).test(mod)) {
      failures.push(`${MODULE_REL}: rota financeira/fluxo-principal '${r}' foi REGISTRADA (reativação). RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL — religar exige firewall explícito + frente própria.`);
    }
  }
  // distribution NÃO pode ser importada/registrada neste módulo (writer de banco mora atrás dela).
  if (/\bdistributionRoutes\b/.test(mod)) {
    failures.push(`${MODULE_REL}: 'distributionRoutes' apareceu — distribution não pode ser wireada no módulo rides (writer financeiro). RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL.`);
  }
  // As 9 rotas operacionais/admin permitidas DEVEM continuar registradas (documenta o conjunto vivo; morde se gutado/trocado).
  const LIVE_OPERATIONAL = ['driversRoutes', 'vehiclesRoutes', 'locationRoutes', 'availabilityRoutes', 'safetyRoutes', 'zonesRoutes', 'demandRoutes', 'serviceTypesRoutes', 'citiesRoutes'];
  for (const r of LIVE_OPERATIONAL) {
    if (!new RegExp(`register\\(\\s*${r}\\b`).test(mod)) {
      failures.push(`${MODULE_REL}: rota operacional permitida '${r}' deixou de ser registrada — mudança no conjunto vivo de rides exige revisão consciente desta trava.`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Allowlist de arquivos MORTOS/documentados que podem referenciar processRidePayment.
//   • bank-integration.service.ts = DEFINIÇÃO de bankIntegrationService.processRidePayment (lado Bank, frente própria).
//   • distribution.service.ts     = define distributionService.processRidePayment + chama bankIntegration + self-call;
//                                    único arquivo rides que escreve bank_transaction_id. MORTO (só via rotas não-registradas).
//   • lifecycle.routes.ts / services/lifecycle.service.ts / rides.service.ts = callers MORTOS (rotas comentadas).
// ───────────────────────────────────────────────────────────────────────────
const PRP_ALLOWLIST = new Set([
  'src/modules/bank/bank-integration.service.ts',
  'src/modules/rides/distribution/distribution.service.ts',
  'src/modules/rides/lifecycle/lifecycle.routes.ts',
  'src/modules/rides/services/lifecycle.service.ts',
  'src/modules/rides/rides/rides.service.ts',
]);
// Arquivos rides MORTOS que podem escrever bank_transaction_id.
const BTXID_RIDES_ALLOWLIST = new Set([
  'src/modules/rides/distribution/distribution.service.ts',
]);

// Walker recursivo sobre src/, comment-stripped, pulando node_modules/dist.
const SRC = join(ROOT, 'src');
const allTs = [];
(function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|mts|cts)$/.test(e) && !/\.d\.ts$/.test(e)) allTs.push(full);
  }
})(SRC);

// ───────────────────────────────────────────────────────────────────────────
// CHECK B — agregador morto rides.routes.ts (ridesRoutes) não pode ser registrado em nenhum caminho vivo.
// CHECK C — nenhum caller NOVO de processRidePayment fora da allowlist morta.
// CHECK D — bank_transaction_id em rides só nos arquivos rides allowlisted (mortos).
// ───────────────────────────────────────────────────────────────────────────
for (const full of allTs) {
  const rel = norm(relative(ROOT, full));
  let src;
  try { src = stripTs(readFileSync(full, 'utf-8')); } catch { continue; }

  // CHECK C — processRidePayment( fora da allowlist.
  if (/processRidePayment\s*\(/.test(src) && !PRP_ALLOWLIST.has(rel)) {
    failures.push(`${rel}: referencia processRidePayment( fora da allowlist morta — caller financeiro de rides NOVO/alcançável sem firewall. RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL.`);
  }

  // CHECK D — bank_transaction_id escrito por arquivo rides fora da allowlist.
  if (rel.startsWith('src/modules/rides/') && /bank_transaction_id/.test(src) && !BTXID_RIDES_ALLOWLIST.has(rel)) {
    failures.push(`${rel}: arquivo rides referencia bank_transaction_id fora da allowlist morta (só distribution.service.ts). RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL.`);
  }

  // CHECK B — ridesRoutes (agregador financeiro morto) registrado em caminho vivo (qualquer arquivo != o módulo,
  // que já é coberto comment-stripped pelo CHECK A). Se o register( aparece stripped, está vivo.
  if (rel !== MODULE_REL && /register\(\s*ridesRoutes\b/.test(src)) {
    failures.push(`${rel}: registra ridesRoutes (agregador financeiro morto rides.routes.ts) — wireia distribution/lifecycle/matching/pricing/promotions/referrals. RIDES_MONEY_REACTIVATED_WITHOUT_FIREWALL.`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CHECK C' — todos os callers mortos esperados ainda existem (a allowlist não envelheceu silenciosamente).
//   Se um arquivo da allowlist sumir, a trava perde precisão — força revisão consciente.
// ───────────────────────────────────────────────────────────────────────────
for (const rel of PRP_ALLOWLIST) {
  const c = read(rel);
  if (c === null) {
    failures.push(`allowlist desatualizada: ${rel} não existe mais — revisar a trava anti-reativação de rides (remoção/refactor do writer morto exige atualizar este guard conscientemente).`);
    continue;
  }
  if (!/processRidePayment/.test(c)) {
    failures.push(`allowlist desatualizada: ${rel} não referencia mais processRidePayment — revisar a trava (o writer morto mudou de forma).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [rides-money-antirevival-guard]:');
  for (const f of failures) console.error('   - ' + f);
  console.error('\n   Contexto: rides está MORTO para dinheiro e SEM firewall próprio. Esta trava congela o estado-morto.');
  console.error('   Reativar rides financeiro exige frente própria (F-RIDES-FINANCIAL-FIREWALL-*) com firewall default-OFF + decisão soberana.');
  process.exit(1);
}
console.log('GATE OK [rides-money-antirevival-guard] — rides financeiro congelado: rotas mortas (rides/matching/pricing/lifecycle/promotions/referrals + distribution) não-registradas; 9 rotas operacionais vivas; processRidePayment só na allowlist morta (distribution/lifecycle/rides.service + definição Bank); bank_transaction_id de rides só em distribution.service.ts. Reativação sem firewall = bloqueada.');
