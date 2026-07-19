# DECISION-0189A — ADENDO CORRETIVO (YALA CLOSEOUT) da DECISION-0189

**Data:** 2026-07-19 · **Status:** PROMULGADA (ordem soberana da campanha corretiva F-COMPANY-ACCESS-AUTHORITY-YALA-CLOSEOUT)
**Base:** HEAD `7fa4ae7fa` (os 7 commits da campanha original PERMANECEM INTOCADOS — este adendo corrige SEM reescrever histórico)
**Origem:** REPROVAÇÃO da auditoria YALA independente da DECISION-0189 — aceita integralmente (D1).

---

## 1. REGISTRO DA REPROVAÇÃO (3 fechamentos materiais + R19)

**Finding A — `create_events` SEM gate exato (BLOQUEADOR).** Os handlers de criação/gestão de
eventos decidiam por `canRepresentActor`/`resolveRepresentedActor` (representação) — a chave
exata `create_events` NUNCA era consultada na rota. A afirmação do §13.4 da DECISION-0189
("create_events: já passam por requirePermission/canActAs") era **FALSA** para `event.routes`.

**Finding B — `publish_feed` SOMBREADA (BLOQUEADOR; violação de R6-B/D3).** A rota de criação
de post tinha um PRE-GATE `canRepresentActor(validated.actor_id)` (que para empresa = GESTÃO,
`can_manage_company`) ANTES do guard; além disso `requirePermission('publish_feed')` checava o
actor do `actionContext`, NÃO o AUTOR declarado. Consequência dupla: (i) membro comum com
`can_publish_feed=true` era 403 no pre-gate — **o grant fino existia mas era INUTILIZÁVEL**;
(ii) o gate exato nunca rodava sobre o actor certo. O §13.4 ("publish_feed já passa por
requirePermission") era **OBSOLETO/FALSO em substância**.

**Finding C — exclusividade membership×delegação com WRITE-SKEW (BLOQUEADOR).** Os dois
constraint triggers (F4) liam a tabela OPOSTA sem serialização: duas transações concorrentes
(T1 membership→active; T2 delegação→active) podiam AMBAS passar no check pré-commit e commitar
a violação. O fechamento anterior era APENAS SEQUENCIAL; **o fechamento concorrente nasce
NESTA campanha** (D5/D6).

**R19 pendente.** `economic-overview`, `invoices` e money-paths sensíveis
(`financial:view_all_ledger`, `marketplace_execute_payouts`, `marketplace_manage_splits`)
permaneciam como "divergência declarada". **Requisito promulgado não se rebaixa a DT**: são
fechados nesta campanha (D7). Fica igualmente promulgado: **"zero linhas" NUNCA é argumento
de segurança** — schema-ghost não sela superfície.

---

## 2. D2/D3 — REPRESENTAÇÃO NÃO SOMBREIA GATE FINO

`canRepresentActor` segue sendo CONTENÇÃO fail-closed para call-sites AINDA NÃO migrados —
mas **NÃO PODE sombrear um gate fino em rota migrada**. Nas rotas migradas:

- membro ativo com o SUBJECT GRANT exato executa (SEM exigir `can_manage_company`);
- gestor SEM o grant exato é NEGADO;
- `canRepresentActor` isolado NUNCA autoriza;
- a decisão final é SEMPRE `canActAs(chave exata)` sobre o ACTOR-ALVO resolvido server-side.

**Reclassificação de DT:** DT-CANREPRESENTACTOR-PER-ROUTE-EXACT-PERMISSION **NÃO pode absorver
call-site vivo já coberto por PermissionKey/grant fino promulgado**. Feed (publish) e eventos
(create/manage/attendees) SAEM do denominador da DT nesta campanha.

**Perna capability lazy-heal (colateral do Finding B):** o registry de capabilities de empresa
era populado apenas pelo writer legado de membros (morto na F4) — membro aceito por CONVITE em
empresa sem linha de registry seria negado pela perna capability. Promulga-se: o dispatch
empresarial, ao encontrar empresa SEM linha em `actor_registry`, materializa os DEFAULTS DE TIPO
(mesma fonte `getDefaultCapabilities('company')`, upsert idempotente) antes de decidir — fato
de TIPO, não concessão por inferência.

## 3. D4 — CHAVES EXATAS DE EVENTOS (promulgado)

- criar evento → `create_events` (sobre o actor ORGANIZADOR resolvido server-side);
- alterar/publicar/ativar/encerrar/cancelar/excluir/plateia/time-windows/needs de evento
  existente → `manage_events` (sobre o actor DONO do evento carregado server-side);
- administrar participantes/commitments (criar commitment, check-in/out/fail administrativos)
  → `manage_attendees`;
- LEITURAS seguem a política de visibilidade do recurso — representação NÃO vira leitura
  administrativa;
- caminhos ECONÔMICOS de evento (advance/custody/split/payment/refund/chargeback) permanecem
  sob os bindings econômicos SELADOS (fora deste adendo).
- Resolução empresarial de `manage_events`/`manage_attendees` (sem coluna própria nesta fase):
  governança (`can_manage_company`) OU delegação externa com o scope exato — membro comum com
  `create_events` NÃO altera evento existente.

## 4. D5/D6 — EXCLUSIVIDADE SOB CONCORRÊNCIA REAL (promulgado)

- Função SQL auxiliar ÚNICA produz a chave determinística da RELAÇÃO
  (`tenant_id × company_id × global_user_id`) — evita algoritmos divergentes;
- AMBOS os trigger functions adquirem `pg_advisory_xact_lock` (transaction-level, NUNCA session)
  com ESSA chave ANTES do SELECT cross-table, e reexecutam a consulta DEPOIS do lock;
- escopo: SOMENTE relações empresariais (grupos/canais/representações não-empresariais e
  `regional_treasury` INTOCADOS);
- colisão de hash pode serializar relação não relacionada — aceito; NUNCA permite violação;
- relação declaradamente empresarial que não resolva company/identity → FAIL-CLOSED;
  não-empresarial → sai sem aplicar regra.

## 5. D7 — FECHAMENTO R19 (promulgado)

- `economic-overview` empresarial privado (qualquer saldo/receita/despesa/fluxo/recebível/
  obrigação/agregado econômico) → `view_financial` TERMINAL + no-store + audit ANTES do
  disclosure; manager sem view → deny;
- `invoices` → autorização PELO RECURSO carregado server-side: PF vê invoice da qual seu actor
  canônico é PARTE; para parte EMPRESARIAL, exige membership ativa + `view_financial` sobre
  aquele actor; `actorId` do cliente NUNCA prova participação; listagem escopada ANTES da query
  (nunca tenant-wide filtrado depois); inexistente/alheio não-enumerável; no-store + audit;
- `financial:view_all_ledger` → atribuição manual EXPLÍCITA; sem assignment → deny SEMPRE
  (nunca ownership genérico);
- `marketplace_execute_payouts` e `marketplace_manage_splits` → deixam de ser
  `legacy_ownership_contained`: **TERMINAIS FAIL-CLOSED enquanto PORTA 01 estiver fechada**
  (nenhum actor/dono/gestor os exerce; religar = decisão da PORTA 01);
- aliases/caminhos equivalentes auditados para impedir bypass por outra PermissionKey.

## 6. ERRATA AO §13.4 DA DECISION-0189 (histórico preservado)

Onde o §13.4 lê "publish_feed (posts) e create_events: já passam por requirePermission/
canActAs", LEIA-SE: "publish_feed tinha chave exata SOMBREADA por representação de gestão e
checada no actor errado; create_events NÃO tinha gate exato em event.routes — ambos corrigidos
pela campanha YALA-CLOSEOUT (DECISION-0189A §2/§3)". A afirmação de exclusividade do §6.3
("imposto por writer+trigger") vale apenas para o caso SEQUENCIAL até esta campanha; o caso
CONCORRENTE é fechado pelo §4 deste adendo.

---

*Promulgada sob a ordem soberana da campanha corretiva. Execução: Etapas B–E; provas e
cartório: Etapa F. A executora NÃO declara selo.*
