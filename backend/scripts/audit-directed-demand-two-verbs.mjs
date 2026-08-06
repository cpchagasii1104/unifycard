#!/usr/bin/env node
// backend/scripts/audit-directed-demand-two-verbs.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F4 · DECISION-0196 §G, GATE + GO Clayton 2026-08-06)
// ║ NORMA:   DECISION_0196 §G/§G.1 (dois verbos) · §C/D4 (dirigido = MESMA entidade)
// ║ NÃO:     fundir os dois verbos de novo, nem deixar a plateia dirigida ALARGAR
// ║ EM VEZ:  "Reservar horário" = janela publicada (QuoteRequestDialog) · "Pedir orçamento" =
// ║          demanda DIRIGIDA (DemandPublishForm com target)
// ╚════════════════════════════════════════════════════════════════
//
// ── O DEFEITO QUE ESTE GUARD IMPEDE DE VOLTAR ───────────────────────────────────────────────────
// `request_quote` abria um diálogo de RESERVA — que pressupõe janela publicada pelo fornecedor.
// Quem não publicou agenda via "Solicitar orçamento" e não tinha o que escolher. *O defeito nunca
// foi nenhuma das duas superfícies: foi o RÓTULO.* Nenhum marketplace grande funde os dois verbos.
//
// E protege a metade que não grita: a plateia do pedido DIRIGIDO tem de ESTREITAR (só o alvo vê).
// Se a cláusula de `target_actor_id` sumir do reader, o pedido dirigido vira broadcast EM SILÊNCIO
// — todo mundo passa a ver um pedido endereçado a uma pessoa.
//
// Estático, comment-stripped. Em validate:regression-guards (comando direto).

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? stripTs(readFileSync(p, 'utf-8')) : null; };
const readFront = (rel) => read(join('..', 'frontend', rel));

const REPO = 'src/modules/demands/demand.repository.ts';
const SVC = 'src/modules/demands/demand.service.ts';
const ACTOR_PAGE = 'src/pages/ActorPage.tsx';
const DIALOG = 'src/components/entity/QuoteRequestDialog.tsx';
const FORM = 'src/components/demands/DemandPublishForm.tsx';

const failures = [];

// ══ 1) A PLATEIA DIRIGIDA ESTREITA — nos DOIS readers ═════════════════════════════════════════
const repo = read(REPO);
if (repo === null) failures.push(`arquivo ausente: ${REPO}`);
else {
  for (const [nome, marca] of [['isActorInAudience', 'async isActorInAudience'], ['listOpportunities', 'async listOpportunities']]) {
    const i = repo.indexOf(marca);
    const j = repo.indexOf('\n  async ', i + 1);
    const bloco = i >= 0 ? repo.slice(i, j > i ? j : repo.length) : '';
    if (!bloco) { failures.push(`${REPO}: ${nome} sumiu.`); continue; }
    if (!/target_actor_id IS NULL OR d\.target_actor_id = \$/.test(bloco))
      failures.push(`${REPO}: ${nome} perdeu a cláusula de target_actor_id — o pedido DIRIGIDO vira broadcast EM SILÊNCIO (todo mundo vê um pedido endereçado a uma pessoa).`);
    if (!/d\.target_actor_id = \$/.test(bloco))
      failures.push(`${REPO}: ${nome} não deixa o ALVO entrar na plateia — dirigir para alguém que não pode ver é pior que não dirigir.`);
  }
  if (!/d\.target_actor_id/.test(repo) || !/target_actor_id/.test(repo))
    failures.push(`${REPO}: a projeção não carrega target_actor_id — a tela não sabe se o pedido é dirigido.`);
}

// ══ 2) O WRITER PROVA O ALVO (0113: o body declara, o servidor prova) ═════════════════════════
const svc = read(SVC);
if (svc === null) failures.push(`arquivo ausente: ${SVC}`);
else {
  if (!/DEMAND_TARGET_NOT_IN_TENANT/.test(svc))
    failures.push(`${SVC}: sumiu a recusa nomeada de alvo fora do tenant — alvo cru do body vira pedido cross-tenant.`);
  if (!/DEMAND_TARGET_IS_SELF/.test(svc))
    failures.push(`${SVC}: sumiu a recusa de pedido a SI MESMO.`);
  if (!/actorExistsInTenant/.test(svc))
    failures.push(`${SVC}: o alvo deixou de ser verificado contra o schema vivo (0113).`);
}

// ══ 3) OS DOIS VERBOS, com nomes honestos, na tela ════════════════════════════════════════════
const page = readFront(ACTOR_PAGE);
if (page === null) failures.push(`arquivo ausente: frontend/${ACTOR_PAGE}`);
else {
  if (!/'request_quote'[\s\S]{0,300}?setDemandOpen\(true\)/.test(page))
    failures.push(`frontend/${ACTOR_PAGE}: request_quote voltou a abrir o diálogo de RESERVA. Ele pressupõe janela publicada — quem não publicou agenda fica com um botão que não faz nada (§G.1).`);
  if (!/Pedir orçamento/.test(page))
    failures.push(`frontend/${ACTOR_PAGE}: o rótulo "Pedir orçamento" sumiu — o verbo do cliente que DECLARA a necessidade.`);
  if (!/Reservar horário/.test(page))
    failures.push(`frontend/${ACTOR_PAGE}: o rótulo "Reservar horário" sumiu do item com janela — voltar a chamá-lo de orçamento é o defeito original (nome e comportamento discordando).`);
  if (!/DemandPublishForm/.test(page))
    failures.push(`frontend/${ACTOR_PAGE}: o pedido dirigido deixou de reusar DemandPublishForm — construir um 2º formulário de demanda é superfície paralela.`);
}

const dialog = readFront(DIALOG);
if (dialog === null) failures.push(`arquivo ausente: frontend/${DIALOG}`);
else if (/<h2>Solicitar orçamento<\/h2>/.test(dialog))
  failures.push(`frontend/${DIALOG}: o diálogo de RESERVA voltou a se chamar "Solicitar orçamento" — é o rótulo que estava errado, e ele é a origem do defeito de §G.`);

const form = readFront(FORM);
if (form === null) failures.push(`arquivo ausente: frontend/${FORM}`);
else {
  if (!/target\?: \{ actorId: string; name: string \}/.test(form))
    failures.push(`frontend/${FORM}: o formulário perdeu o alvo — sem ele o "Pedir orçamento" da ActorPage vira broadcast.`);
  if (!/targetActorId: target\?\.actorId/.test(form))
    failures.push(`frontend/${FORM}: o alvo não é enviado ao servidor — a tela diria "dirigido" e o motor gravaria broadcast.`);
}

if (failures.length) {
  console.log('GATE FAIL [directed-demand-two-verbs]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log(
    '\n→ DOIS VERBOS (DECISION-0196 §G): "Reservar horário" = o fornecedor publica e o cliente escolhe;' +
    '\n  "Pedir orçamento" = o cliente declara a necessidade (demanda DIRIGIDA por target_actor_id).' +
    '\n→ Dirigido é a MESMA entidade (§C/D4). Duas entidades = segunda verdade sobre "o que é um pedido".' +
    '\n→ A plateia dirigida ESTREITA. Alargar vaza um pedido endereçado a uma pessoa.');
  process.exit(1);
}

console.log(
  'GATE OK [directed-demand-two-verbs] — os DOIS verbos com nomes honestos: request_quote abre demanda ' +
  'DIRIGIDA (DemandPublishForm com target) e o diálogo de janela publicada se chama "Reservar horário"; ' +
  'a plateia dirigida ESTREITA nos dois readers (o alvo vê, o terceiro não) e o writer prova o alvo no ' +
  'tenant (DEMAND_TARGET_NOT_IN_TENANT / DEMAND_TARGET_IS_SELF). Mesma entidade, sem tabela paralela.'
);
