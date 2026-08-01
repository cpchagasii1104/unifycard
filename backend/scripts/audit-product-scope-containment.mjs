#!/usr/bin/env node
// audit-product-scope-containment.mjs — F-OUT-OF-SCOPE-CONTAINMENT (2026-08-01)
//
// CONTEXTO (decisão de produto de Clayton, 2026-08-01 — cartório no topo do REMEDIATION_DT_LOG.md):
//   O mínimo pra demonstrar a UNIFICAÇÃO é: rede social · banco · cartão · compra/venda · locação ·
//   ingressos/shows/eventos · serviços. Tudo fora disso NÃO é dívida técnica — é ESCOPO NÃO
//   INICIADO, e deve dizer isso em voz alta (501 nomeado) em vez de quebrar em silêncio (500 cru).
//
//   Este guard existe porque a contenção é REVERSÍVEL POR DESENHO (uma linha de `addHook` por
//   arquivo de rota) — e o que é fácil de remover é fácil de remover POR ACIDENTE. Reabrir escopo
//   é decisão de Clayton + GATE, nunca efeito colateral de refatoração.
//
// ESTE GUARD MORDE SE:
//   (A) um módulo CONTIDO perder sua linha de contenção (`containModule(...)` no arquivo de rota);
//   (B) um módulo INALCANÇÁVEL (care/root-config/social-chat/subscriptions) voltar a ser
//       registrado em qualquer caminho vivo, sem contenção;
//   (C) a razão de contenção de um módulo mudar para a razão ERRADA (escopo × lei são coisas
//       diferentes: `revoked_by_law` é mais forte e NÃO se reabre por decisão de fatia);
//   (D) o vocabulário do mínimo de produto (PRODUCT_MINIMUM) mudar sem passar por aqui — o
//       mínimo é decisão do dono, não constante que se edita de passagem;
//   (E) `rides` perder o aviso de ESCOPO nas mensagens já contidas (a razão "substrato ausente"
//       EXPIRA quando o substrato for materializado; a de escopo não — razão errada envelhece e
//       vira armadilha, foi o que aconteceu com a AlertsPage).
//
// NÃO MORDE (de propósito): endpoint que usa tabela EXISTENTE e funciona hoje. Contenção de
// módulo inteiro apagaria o que presta — em `rides` há 3 endpoints vivos (GET /service-types,
// GET /vehicles/drivers/:id/vehicles, GET /location/distance) e eles seguem intocados.
//
// Heurística textual comment-aware, padrão da casa. NÃO altera runtime.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const failures = [];

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const readRaw = (rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf-8') : null;
};
const readCode = (rel) => {
  const raw = readRaw(rel);
  return raw === null ? null : stripTs(raw);
};
const norm = (p) => p.split(sep).join('/');

// ── O mínimo de produto, congelado aqui (checagem D) ─────────────────────────
const PRODUCT_MINIMUM_EXPECTED = [
  'rede social', 'banco', 'cartão', 'compra/venda', 'locação',
  'ingressos/shows/eventos', 'serviços',
];

// ── Módulos CONTIDOS por hook, com a razão esperada (checagens A e C) ────────
const CONTAINED_BY_HOOK = {
  'src/modules/presence/presence.routes.ts': { module: 'presence', reason: 'out_of_product_minimum' },
  'src/modules/loyalty/loyalty.routes.ts': { module: 'loyalty', reason: 'out_of_product_minimum' },
  'src/modules/human-mvp/human-mvp.routes.ts': { module: 'human-mvp', reason: 'out_of_product_minimum' },
  'src/modules/work/work.module.ts': { module: 'work', reason: 'out_of_product_minimum' },
  'src/core/pilot/pilot-events.routes.ts': { module: 'pilot-events', reason: 'out_of_product_minimum' },
  'src/core/pilot/pilot-invites.routes.ts': { module: 'pilot-invites', reason: 'out_of_product_minimum' },
  'src/core/pilot/pilot-human-observation.routes.ts': { module: 'pilot-human-observation', reason: 'out_of_product_minimum' },
  'src/core/pilot/institutional-memory.routes.ts': { module: 'institutional-memory', reason: 'out_of_product_minimum' },
  // 🔴 LEI, não escopo: CONTRATO_GRUPOS_V2 revoga. Trocar por 'out_of_product_minimum' AFROUXA.
  'src/core/user-group-allocation/user-group-allocation.routes.ts': { module: 'user-group-allocation', reason: 'revoked_by_law' },
};

// ── Módulos INALCANÇÁVEIS que não podem voltar a ser registrados (checagem B) ─
// Sem contenção 501 de propósito: 501 em rota inalcançável é decoração. A trava é NÃO montar.
const MUST_STAY_UNMOUNTED = {
  'careRoutes': 'src/modules/care/care.routes.ts',
  'rootConfigRoutes': 'src/core/root-config/root-config.routes.ts',
  'socialChatRoutes': 'src/modules/social-chat/social-chat.routes.ts',
  'subscriptionRoutes': 'src/modules/subscriptions/subscription.routes.ts',
};
// Os arquivos .module.ts destes 4 registram as rotas, mas os próprios .module.ts são órfãos.
// Só morde se um .module.ts (ou a rota direta) entrar num caminho ALCANÇÁVEL.
const MODULE_WRAPPERS_ALLOWED_TO_REGISTER = new Set([
  'src/modules/care/care.module.ts',
  'src/core/root-config/root-config.module.ts',
  'src/modules/social-chat/social-chat.module.ts',
]);

// ── rides: mensagens já contidas devem citar ESCOPO (checagem E) ─────────────
const RIDES_CONTAINED_FILES = [
  'src/modules/rides/availability/availability.routes.ts',
  'src/modules/rides/safety/safety.routes.ts',
  'src/modules/rides/demand/demand.routes.ts',
  'src/modules/rides/drivers/drivers.routes.ts',
  'src/modules/rides/location/location.routes.ts',
  'src/modules/rides/service-types/service-types.routes.ts',
];
const RIDES_SCOPE_MARKER = 'MODULE OUT OF PRODUCT MINIMUM';

// ── CHECK D — o vocabulário do mínimo não muda de passagem ───────────────────
{
  const rel = 'src/core/product-scope/out-of-scope-containment.ts';
  const src = readCode(rel);
  if (src === null) {
    failures.push(`arquivo ausente: ${rel} — a casa da contenção de escopo sumiu.`);
  } else {
    for (const term of PRODUCT_MINIMUM_EXPECTED) {
      if (!src.includes(`'${term}'`)) {
        failures.push(`${rel}: o mínimo de produto perdeu o termo '${term}'. O mínimo é decisão do dono (2026-08-01) — mudar exige GATE, não edição de passagem.`);
      }
    }
    for (const r of ['out_of_product_minimum', 'revoked_by_law']) {
      if (!src.includes(`'${r}'`)) {
        failures.push(`${rel}: razão de contenção '${r}' sumiu do vocabulário — escopo e lei são razões DIFERENTES e não podem colapsar numa só.`);
      }
    }
  }
}

// ── CHECK A + C — cada módulo contido mantém sua linha E sua razão ──────────
for (const [rel, { module, reason }] of Object.entries(CONTAINED_BY_HOOK)) {
  const src = readCode(rel);
  if (src === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  if (!/addHook\(\s*['"]onRequest['"]\s*,\s*containModule\(/.test(src)) {
    failures.push(`${rel}: perdeu a contenção de escopo (addHook onRequest + containModule). Módulo fora do mínimo voltou a ser alcançável — reabrir escopo é decisão de Clayton + GATE, não efeito colateral.`);
    continue;
  }
  if (!new RegExp(`module:\\s*['"]${module}['"]`).test(src)) {
    failures.push(`${rel}: a contenção existe mas não nomeia o módulo '${module}' — corpo de 501 sem nome é 501 genérico, exatamente o que o pacote proibiu.`);
  }
  if (!new RegExp(`reason:\\s*['"]${reason}['"]`).test(src)) {
    failures.push(`${rel}: razão de contenção mudou — esperado '${reason}'. Escopo × lei NÃO são intercambiáveis: 'revoked_by_law' é mais forte e não se reabre por decisão de fatia.`);
  }
}

// ── CHECK E — rides mantém o aviso de escopo (a razão que NÃO expira) ───────
for (const rel of RIDES_CONTAINED_FILES) {
  const raw = readRaw(rel);
  if (raw === null) { failures.push(`arquivo ausente: ${rel}`); continue; }
  if (!raw.includes(RIDES_SCOPE_MARKER)) {
    failures.push(`${rel}: perdeu o aviso "${RIDES_SCOPE_MARKER}" na mensagem de contenção. A razão "substrato ausente" EXPIRA quando o substrato existir; a de escopo não. Razão errada envelhece e vira armadilha.`);
  }
}

// ── CHECK B — os inalcançáveis não podem ser registrados em caminho vivo ────
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
    else if (/\.ts$/.test(e) && !/\.d\.ts$/.test(e)) allTs.push(full);
  }
})(SRC);

for (const full of allTs) {
  const rel = norm(relative(ROOT, full));
  if (MODULE_WRAPPERS_ALLOWED_TO_REGISTER.has(rel)) continue;
  let src;
  try { src = stripTs(readFileSync(full, 'utf-8')); } catch { continue; }
  for (const [symbol, home] of Object.entries(MUST_STAY_UNMOUNTED)) {
    if (rel === home) continue;
    if (new RegExp(`register\\(\\s*${symbol}\\b`).test(src)) {
      failures.push(`${rel}: registrou '${symbol}', que está FORA do mínimo de produto e hoje é inalcançável. Montar sem contenção reabre escopo não iniciado por acidente — exige decisão de Clayton + GATE.`);
    }
  }
}

// ── veredito ─────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('❌ [audit-product-scope-containment] FALHOU:');
  for (const f of failures) console.error('   · ' + f);
  process.exit(1);
}
console.log(
  '✅ audit-product-scope-containment: 9 módulos fora do mínimo contidos na borda (501 nomeado, razão ' +
  'preservada — escopo × lei distintos); 4 inalcançáveis seguem não-montados; rides mantém o aviso de ' +
  'ESCOPO (razão que não expira) nos 6 corpos já contidos; vocabulário do mínimo de produto íntegro. ' +
  'Endpoints que funcionam hoje NÃO foram tocados.'
);
