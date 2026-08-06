#!/usr/bin/env node
// backend/scripts/audit-demand-atomic-accept.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F2 · DECISION-0196 §D7, GATE + GO Clayton 2026-08-06)
// ║ NORMA:   DECISION_0196 §B.1/§B.4/§D7 · DECISION_0146 G7/G8/G10 · CONSTITUIÇÃO ART. II
// ║ NÃO:     voltar a compensar à mão (fillSlot → catch releaseSlot) nem cobrir só UM verbo de aceite
// ║ EM VEZ:  UMA transação para os DOIS verbos, com a cascata no leitor único demand-commitment.ts
// ╚════════════════════════════════════════════════════════════════
//
// ── O QUE ESTE GUARD PROTEGE ────────────────────────────────────────────────────────────────────
// 1. 🔴 **UMA VERDADE SOBRE TEMPO** (regra de Clayton, 2026-08-06). `hasScheduleConflict` LIA
//    `service_demand_responses` com régua `daterange '[]'` FECHADA, enquanto a agenda respondia a
//    MESMA pergunta com `[start,end)` MEIO-ABERTA (G8) — duas fontes E duas réguas, divergindo
//    exatamente no back-to-back. Convergiu para a AGENDA. Voltar a ler a tabela de respostas
//    ressuscita a segunda verdade.
// 2. **OS DOIS VERBOS.** `respond` (automático) e `choose` produzem compromisso. Cobrir só um cria
//    "duas espécies de aceito" — segunda verdade sobre o que aceitar SIGNIFICA (§B.4, literal).
// 3. **TRANSAÇÃO, NÃO SAGA.** O `catch → releaseSlot` existia porque não havia transação. Com
//    ROLLBACK real ele é ruído perigoso: mascara falha e devolve vaga duas vezes.
// 4. **O CHOKEPOINT ÚNICO de confirm** continua sendo `unifiedAvailabilityService.updateBooking` —
//    um 2º caminho de confirm seria segunda verdade sobre o que confirmar significa.
// 5. **A CASCATA em LEITOR ÚNICO** (`demand-commitment.ts`), com os três degraus e os STOPs.
//
// Estático, comment-stripped. Em validate:regression-guards (comando direto).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };

const SVC = 'src/modules/demands/demand.service.ts';
const REPO = 'src/modules/demands/demand.repository.ts';
const CASC = 'src/modules/demands/demand-commitment.ts';
const AVREPO = 'src/core/availability/unified-availability.repository.ts';
const AVSVC = 'src/core/availability/unified-availability.service.ts';

const failures = [];

// ══ 1) UMA VERDADE SOBRE TEMPO — hasScheduleConflict lê a AGENDA ══════════════════════════════
const repo = read(REPO);
if (repo === null) failures.push(`arquivo ausente: ${REPO}`);
else {
  const i = repo.indexOf('async hasScheduleConflict');
  const j = repo.indexOf('\n  async ', i + 1);
  const bloco = i >= 0 ? repo.slice(i, j > i ? j : repo.length) : '';
  if (!bloco) failures.push(`${REPO}: hasScheduleConflict sumiu — o aviso antecipado de conflito deixou de existir.`);
  else {
    if (!/FROM bookings b/.test(bloco) || !/JOIN availability a/.test(bloco))
      failures.push(`${REPO}: hasScheduleConflict NÃO lê a agenda (bookings+availability). Se voltou a ler service_demand_responses, ressuscitou a SEGUNDA VERDADE sobre "quem está ocupado".`);
    if (/service_demand_responses/.test(bloco))
      failures.push(`${REPO}: hasScheduleConflict voltou a consultar service_demand_responses — fonte paralela de ocupação (proibido: "não pode existir segunda verdade").`);
    if (/daterange/.test(bloco))
      failures.push(`${REPO}: hasScheduleConflict usa daterange '[]' (FECHADO) — a régua da agenda é [start,end) meio-aberta (G8). Fechado trata back-to-back como conflito.`);
    if (!/COALESCE\(b\.booked_start_datetime, a\.start_datetime\)\s*<\s*\$4/.test(bloco) ||
        !/COALESCE\(b\.booked_end_datetime,\s*a\.end_datetime\)\s*>\s*\$3/.test(bloco))
      failures.push(`${REPO}: a comparação não é meio-aberta sobre o intervalo COMPROMETIDO — régua divergente da do confirm.`);
    if (!/a\.owner_type = 'user'\s*AND a\.owner_id = \$2/.test(bloco))
      failures.push(`${REPO}: o rollup do aviso não cobre owner_type='user' — cega a agenda pessoal, que é a persona central (§D.1).`);
  }
  if (!/async (fillSlot|createResponse)[\s\S]{0,200}?client\?: PoolClient/.test(repo))
    failures.push(`${REPO}: os métodos do aceite não aceitam client externo — sem isso o aceite volta a ser saga com compensação manual.`);
}

// ══ 2) OS DOIS VERBOS + 3) TRANSAÇÃO, NÃO SAGA ════════════════════════════════════════════════
const svc = read(SVC);
if (svc === null) failures.push(`arquivo ausente: ${SVC}`);
else {
  if (!/aceitarComCompromisso/.test(svc))
    failures.push(`${SVC}: o aceite atômico (aceitarComCompromisso) sumiu — aceitar voltaria a não tocar a agenda.`);
  const chamadas = (svc.match(/this\.aceitarComCompromisso\(/g) || []).length;
  if (chamadas < 2)
    failures.push(`${SVC}: só ${chamadas} verbo(s) de aceite usam o caminho atômico. São DOIS (respond automático + choose) — cobrir um cria "duas espécies de aceito" (§B.4).`);
  if (/catch[\s\S]{0,200}?releaseSlot/.test(svc))
    failures.push(`${SVC}: voltou a compensar à mão (catch → releaseSlot). Com transação real o ROLLBACK desfaz a vaga; compensar por cima devolve a vaga DUAS vezes.`);
  if (!/await client\.query\('BEGIN'\)/.test(svc) || !/await client\.query\('COMMIT'\)/.test(svc) || !/ROLLBACK/.test(svc))
    failures.push(`${SVC}: o aceite não abre/fecha transação própria — sem BEGIN/COMMIT/ROLLBACK não há atomicidade (§D7).`);
  // 4) chokepoint único de confirm
  if (!/unifiedAvailabilityService\.updateBooking\(/.test(svc))
    failures.push(`${SVC}: o aceite não confirma pelo chokepoint único (unifiedAvailabilityService.updateBooking) — um 2º caminho de confirm é segunda verdade sobre o que confirmar significa.`);
  if (/confirmBookingWith(Provider|Resource)Lock\(/.test(svc))
    failures.push(`${SVC}: o módulo de demandas chama o confirm do repositório DIRETO, pulando a cascata/avisos do chokepoint.`);
}

// ══ 5) A CASCATA EM LEITOR ÚNICO, com os três degraus e os STOPs ══════════════════════════════
const casc = read(CASC);
if (casc === null) failures.push(`arquivo ausente: ${CASC} (leitor único da cascata §B.4)`);
else {
  for (const [rot, re] of [
    ['degrau 1 (FK → offering)', /ownerType: 'service_offering'/],
    ['degrau 1 (FK → asset)', /ownerType: 'actor_asset'/],
    ['degrau 2 (user → o próprio actor)', /'user'[\s\S]{0,200}?ownerType: 'user'/],
    ['degrau 3 (page → recusa nomeada)', /DEMAND_COMMITMENT_PAGE_HAS_NO_AGENDA/],
    ['STOP G10 para tipo não decidido', /DEMAND_COMMITMENT_STOP_DECISION_REQUIRED/],
    ['STOP para vínculo sem janela única', /DEMAND_COMMITMENT_VINCULO_HAS_NO_SINGLE_WINDOW/],
  ]) {
    if (!re.test(casc)) failures.push(`${CASC}: ${rot} ausente — a cascata §B.4 ficou incompleta.`);
  }
  // 🔴 SUBSTÂNCIA, não grafia. A 1ª versão desta linha exigia o TEXTO `'recorrente' || 'efetivo'`
  // e reprovou o próprio conserto quando a comparação passou a ser COMPOSTA do vocabulário
  // governado (`DEMAND_VINCULOS`) — que é o que o `governed-vocabulary-manifest` exige e o que
  // impede a lista de envelhecer calada. Guard que prova grafia reprova conserto: 3ª vez hoje.
  if (!/DEMAND_VINCULOS/.test(casc))
    failures.push(`${CASC}: a decisão sobre janela deixou de COMPOR de DEMAND_VINCULOS — lista copiada à mão envelhece calada (smell C1/R2).`);
  if (!/Record<DemandVinculo, 'single' \| 'none'>/.test(casc))
    failures.push(`${CASC}: sumiu o mapa EXAUSTIVO por tipo — sem ele, um vínculo novo cai num ramo por omissão em vez de forçar decisão.`);
  for (const v of ['recorrente', 'efetivo']) {
    if (!new RegExp(`${v}:\\s*'none'`).test(casc))
      failures.push(`${CASC}: '${v}' deixou de ser 'none' — ele não tem UMA janela, e inventar uma é adivinhar o compromisso (G10).`);
  }
  for (const v of ['diaria', 'periodo']) {
    if (!new RegExp(`${v}:\\s*'single'`).test(casc))
      failures.push(`${CASC}: '${v}' deixou de ser 'single' — a trava passaria a bloquear quem PODE comprometer agenda.`);
  }
}
// leitor único: ninguém mais pode reimplementar a cascata
for (const rel of [SVC, REPO]) {
  const s = read(rel);
  if (s && /ownerType\s*[:=]\s*'service_offering'[\s\S]{0,300}?ownerType\s*[:=]\s*'user'/.test(s))
    failures.push(`${rel}: a cascata §B.4 foi reimplementada fora de ${CASC} — duas cópias divergem (leitor único).`);
}

// ══ 6) as peças da agenda continuam aceitando client externo ══════════════════════════════════
const avrepo = read(AVREPO);
if (avrepo === null) failures.push(`arquivo ausente: ${AVREPO}`);
else {
  for (const [rot, re] of [
    ['create (availability)', /async create\([\s\S]{0,200}?client\?: PoolClient/],
    ['confirmBookingWithProviderLock', /async confirmBookingWithProviderLock\([\s\S]{0,300}?externalClient\?: PoolClient/],
    ['confirmBookingWithResourceLock', /async confirmBookingWithResourceLock\([\s\S]{0,300}?externalClient\?: PoolClient/],
    ['findBookingById (o LEITOR que faltava)', /async findBookingById\([\s\S]{0,150}?client\?: PoolClient/],
    ['findAvailabilityById (o LEITOR que faltava)', /async findAvailabilityById\([\s\S]{0,150}?client\?: PoolClient/],
  ]) {
    if (!re.test(avrepo)) failures.push(`${AVREPO}: ${rot} deixou de aceitar client externo — o aceite atômico volta a falhar com NotFoundError em vez de rollback (§D7).`);
  }
  if (!/const owns = !externalClient/.test(avrepo))
    failures.push(`${AVREPO}: sumiu a regra "quem abre, fecha" (owns) — commitar/rollbackar transação alheia corrompe o aceite.`);
}
const avsvc = read(AVSVC);
if (avsvc && !/findBookingById\(tenantId, bookingId, client\)/.test(avsvc))
  failures.push(`${AVSVC}: updateBooking voltou a ler o booking pelo POOL — dentro da transação do aceite ele não enxerga a linha não-commitada e devolve NotFoundError (o sintoma exato da §D7).`);

if (failures.length) {
  console.log('GATE FAIL [demand-atomic-accept]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    '\n→ A DECISION-0196 §D7 elimina o estado "aceito + confirm falhou" por ATOMICIDADE, não por nome novo.' +
    '\n→ Uma verdade sobre tempo: a AGENDA (ART. II). Régua única: [start,end) meio-aberto (G8).' +
    '\n→ EM VEZ de reimplementar a cascata: importe de src/modules/demands/demand-commitment.ts.');
  process.exit(1);
}

console.log(
  'GATE OK [demand-atomic-accept] — aceite ATÔMICO vivo nos DOIS verbos (respond automático + choose), ' +
  'em transação real (BEGIN/COMMIT/ROLLBACK), sem compensação manual; confirm pelo chokepoint ÚNICO com ' +
  'client externo; create/confirm*/finders da agenda aceitando a transação do chamador ("quem abre, fecha"); ' +
  'cascata §B.4 em LEITOR ÚNICO (demand-commitment.ts) com os 3 degraus e os STOPs nomeados; e ' +
  'hasScheduleConflict lendo a AGENDA com a régua [start,end) — uma fonte, uma régua.'
);
