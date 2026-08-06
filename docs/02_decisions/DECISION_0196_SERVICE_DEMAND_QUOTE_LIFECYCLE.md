# DECISION-0196 — Ciclo de vida do ORÇAMENTO na demanda de serviço (`F-SERVICE-DEMAND-QUOTE-LIFECYCLE`)

> **Categoria:** normativa
> **Status:** vivo — **RATIFICADA por Clayton 2026-08-06** ("adote como decisões para destravar")
> **Fonte canônica:** este documento; subordinado a `DECISION-0164` (SELADA) e `DECISION-0146` (PROMULGADA)
> **Obrigatório:** sim — leitura obrigatória para qualquer fatia de `modules/demands`
> **Governado por:** Clayton (decisão) · direção (execução)

**Deriva de / subordinada a:** `DECISION-0164` (substrato da demanda — **SELADA**, re-selo YALA
2026-07-07) · `DECISION-0146` (integridade temporal e conflito de booking) · `DECISION-0189`
(tríade chave×capability×grant) · `CONSTITUIÇÃO ART. II` (agenda é verdade única).

**Insumo:** `docs/04_audit/GATE_F0_ORGANIZACAO_EVENTO_2026-08-05.md` (GATE F0, 3 rodadas) ·
`organizacaoevento.md` (plano, com errata de 2026-08-06) · pacote de recomendação da instância de
produto, **adotado com três correções medidas** (ver §D).

---

## §0 — Por que esta decisão existe

A `DECISION-0164` criou e **selou** o motor de demanda, com a cláusula *"reabertura só por **nova
frente nomeada** (`F-SERVICE-DEMAND-*`), não patch solto"* (cartório `:13026`). O
`organizacaoevento.md` redesenhava esse motor **sem nome de frente e sem citar a 0164**. Esta
decisão **abre a porta pelo lado certo**: nomeia a frente, fixa o escopo, e resolve as quatro
perguntas que travavam o plano.

**O nome:** **`F-SERVICE-DEMAND-QUOTE-LIFECYCLE`** — diz o que abre (ciclo do orçamento) e o que
**não** abre (dinheiro).

---

## §A — D1 · A CASA DO ORÇAMENTO: vive a TABELA, morre o `jsonb`

**Decisão:** o orçamento vive em **`service_demand_responses`** (`quote_cents`, já existente e
medido). O trilho RFQ em `events.metadata.rfqs[].quotes` **não** é a casa do orçamento.

**Como a contradição da 0164 se resolve — princípio vence ponteiro:**
`D1` da 0164 é **princípio** (*"matching consulta concept∩tempo∩quantidade — jsonb em posts não
indexa"*). `ADENDO 6(c)` é **ponteiro** (*"o trilho RFQ JÁ EXISTE, compor dele"*), e foi escrito
**quando o jsonb era o único trilho**: a entrada da visão no cartório (`:13097`, com os ADENDOS 5–7)
é **anterior** à da execução (`:13088`, migration `20260707120000` que criou
`service_demand_responses`). O ponteiro envelheceu no mesmo dia em que foi escrito.

**Teste prático, que decide sozinho:** orçamento se consulta **por evento, por fornecedor, por
status e por validade** — quatro consultas que em `jsonb` viram varredura.

**Não se cria casa nova.** Escolhe-se a que já existe.

🔴 **A.1 — As 10 rotas RFQ NÃO se apagam neste ato.** Elas ganham **destino nomeado**: contenção
agora, aposentadoria por **frente própria**. Apagar em silêncio produz o padrão `chat_reports` — a
violação viva que ninguém pode invocar porque ninguém a condenou formalmente.
**Estado medido (2026-08-06):** 10 rotas registradas sob `FEATURE_RFQ_ENABLED=true`, persistindo em
`events.metadata.rfqs`; **0 rfqs em 9 eventos, 0 quotes**.
→ `DT-RFQ-JSONB-QUOTE-TRAIL-SUPERSEDED` — contida, com destino, **sem prazo ainda** (§F).

---

## §B — D2 · A SAÍDA DO (b): `[1]` como regra + a FK do que é ofertado

**Decisão, em duas metades que só funcionam juntas:**

**B.1 — Pedir e orçar NUNCA tocam a agenda. Só o ACEITE toca.**
`service_demands` e `service_demand_responses` são registro comercial. Nenhuma escrita em
`availability` acontece em ③ (pedido) nem em ④ (resposta). Isto preserva `ART. II` e `0146 §A.1` sem
esforço: não há declaração a bloquear porque não há declaração.

**B.2 — 🔴 A resposta do fornecedor DECLARA O QUE ESTÁ SENDO OFERTADO, por FK.**
Sem isso, `[1]` não aterrissa: no aceite, o sistema teria de **adivinhar** qual recurso travar — o
que a `0146 G10` proíbe por nome (`STOP_DECISION_REQUIRED`).

> ### ⚠️ CORREÇÃO MEDIDA AO PACOTE — a FK **não** é só de `service_offerings`
> O pacote propôs *"a FK de `service_offerings` na resposta"*. **Isso quebraria a metade locação que
> a própria `0164 ADENDO 5(c)` promulga** (*"a MESMA demanda serve pra RECURSOS […] o motor é UM
> só"*). Medido em `unificard_dev`, 2026-08-06:
> ```sql
> SELECT (SELECT count(DISTINCT provider_actor_id) FROM service_offerings WHERE status='active') com_oferta,
>        (SELECT count(DISTINCT owner_actor_id) FROM actor_assets) com_ativo;
> -- com_oferta 7 · com_ativo 2
> -- e os 2 donos de ativo têm ofertas_ativas = 0 · 0
> ```
> **Os dois fornecedores de locação — Tenda, Gerador, Banheiro, Fiat Argo — não têm uma única
> `service_offering`.** FK singular obrigatória os expulsa do motor.
>
> **Forma adotada:** `offering_id` **XOR** `asset_id` — duas FKs anuláveis com **CHECK de
> exclusividade** (exatamente um preenchido). É a forma que o GATE já havia nomeado.

**B.3 — Direção herdada, não inventada:** `0164 ADENDO 7(c)` já apontava
*"compõe com […] **`service_offerings`** (a política de visita pode morar na **oferta do provider**)"*.
Esta decisão **estende** aquele ponteiro para o par oferta/ativo, pela razão de B.2.

🔴 **B.4 — QUEM PODE RESPONDER, e onde o dono da agenda é resolvido.**

> ### ⚖️ EMENDA DE 2026-08-06 (ratificada: *"pode destravar a sequência"*)
> **A versão original desta cláusula está RISCADA abaixo, não apagada** — ela registra uma decisão
> que a medição derrubou, e apagar perderia a lição.

~~**Decisão original:** a FK é obrigatória para responder com orçamento (`pricing_mode='orcamento'`)
e opcional para `preco_ofertado`.~~

⛔ **DERRUBADA POR MEDIÇÃO.** Ela expulsaria a persona central do produto:
```sql
SELECT a.actor_type, count(DISTINCT o.provider_actor_id) FROM service_offerings o
  JOIN actors a ON a.id = o.provider_actor_id WHERE o.status='active' GROUP BY 1;
-- page 6 · group 1 · (NENHUMA linha 'user')
SELECT count(*) FROM actors WHERE actor_type='user';  -- 12
-- users sem oferta E sem ativo: 11
```
**Nenhuma pessoa física tem oferta cadastrada.** A FK obrigatória expulsaria **11 dos 12 `user`**
(o 12º é o dono do Fiat Argo, que poderia responder por `asset_id`). *Pessoa física respondendo com
preço é literalmente a persona do produto* — a regra não cortaria gordura, cortaria o público-alvo.
E torná-la opcional em `preco_ofertado` criaria **duas espécies de "aceito"** — um que compromete
agenda e um que não compromete nada: **segunda verdade sobre o que aceitar SIGNIFICA**.

### ✅ B.4 (VIGENTE) — FK opcional; o dono resolve em CASCATA no aceite

A saída não escolhe entre os dois males: **dissolve a pergunta**. Cada degrau já tem doutrina
ratificada — **nenhum inventa nada**:

| ordem | condição | dono da availability | doutrina |
|---|---|---|---|
| 1 | **FK presente** | `service_offering` ou `actor_asset` da FK | `§B.2` · `0164 ADENDO 7(c)` |
| 2 | FK ausente **e** respondente é **`user`** | **o próprio user-actor** | **`§D.1`** · `0146` V1 (*"`provider_actor_id` é o RECURSO"*) |
| 3 | FK ausente **e** respondente é **`page`** | ⛔ **recusa honesta NO ACEITE** | **R1** de Clayton (*"a empresa não tem agenda: ela AGREGA"*) — a mensagem diz o caminho: cadastre a oferta |

**Resultado:** ninguém é expulso na resposta (os 22 seguem podendo responder) · nenhum aceite fica
sem dono legítimo de agenda · `page` continua fail-closed **pela regra do dono**, não por limitação
técnica.

**✅ PRÉ-REQUISITO DE ORDEM — JÁ CUMPRIDO (2026-08-06).** O degrau 2 dependia da generalização do
rollup por `provider_actor_id` (sem ela o aceite criaria a janela e o confirm a recusaria com 501).
**Feito e provado sob corrida** (`validate:personal-agenda-exclusivity-race`: sobrepostas → exatamente
uma confirma; sem sobreposição e back-to-back → as duas). O degrau 2 está liberado.

**🔴 CUSTOS ACEITOS, declarados para ninguém descobrir depois:**
1. **A prova vermelha da F2 cobre os TRÊS degraus** — inclusive a recusa do `page` sem FK.
2. **A agenda pessoal do respondente passa a receber compromisso de venda.** É o comportamento
   DESEJADO (um corpo, uma agenda) — mas aceitar um preço fixo passa a **OCUPAR a agenda da pessoa**,
   e **a pessoa precisa VER isso acontecer**: exige **superfície**, não só substrato.

**Efeito imediato no writer:** `respond` **deixa de exigir** `offeringId`/`assetId` em
`pricing_mode='orcamento'`. A exclusividade (`offering` XOR `asset`) **permanece** — no banco e no
service. ⇒ `DT-QUOTE-RESPONSE-UI-MISSING-OFFER-PICKER` **dissolve-se**: a tela que manda só
`quoteCents` volta a funcionar. A superfície de escolha vira **melhoria**, não correção de botão
quebrado.

**B.5 — Fora desta decisão:** `[3]` (o overlap de declaração virar ALERTA) **não** entra aqui. É o
cluster do `ART. II` / `DT-AVAILABILITY-OVERLAP-ALERT-MISSING`, e anda em frente própria.

---

## §C — D3 · O LOTE (as sete que estavam em `§7` do plano)

| | decisão |
|---|---|
| **Q2 / D6c** | **Compromissos INDEPENDENTES**, agora. Composto encosta em `0146 §B`, **reservada** — destrave é ato próprio de Clayton, **nunca de carona num lote** |
| **D1 validade** | **7 dias**, configurável **POR OFERTA**, default injetado **NA ESCRITA**. `NULL` **PROIBIDO** — *"sem prazo"* só existe como escolha explícita futura, nunca como omissão |
| **D2 vencido** | **Morre e nasce outro.** Renovar `valid_until` faz o histórico **mentir sobre o que o cliente viu quando decidiu** |
| **D3 visibilidade** | **Chave exata da tríade `DECISION-0189`**, espelho de `company:view_reports`. Formulada como chave, vira **registro de vocabulário**, não debate de privacidade |
| **D4 dirigido** | **Mesma entidade.** `target_actor_id` nulo = broadcast. Duas entidades = **segunda verdade sobre "o que é um pedido"** |
| **D5 modo × tipo** | **MODO do item.** Amarrar ao fornecedor recria a **PJ duplicada** — o erro mais caro já pago aqui |
| **D6a** | ⛔ **NÃO É DECISÃO** — já implementado e atômico (`fillSlot`, um único `UPDATE` com o predicado no `WHERE`) |
| **D6b** | ⛔ **NÃO É DECISÃO** — é **dependência bloqueada**: `0164 D3` a põe na **fatia C**, que depende da central de notificações, **inexistente** |

### 🔴 D7 — o estado *"aceito + confirm falhou"* deixa de existir, em vez de ganhar nome

**Decisão:** o aceite é **atômico com o confirm**. Uma transação: *valida validade → cria a
availability → reserva → confirma*. Se qualquer passo falha, **reverte inteira**: o cliente vê erro
honesto, o orçamento continua **válido e aceitável**, e **nenhum estado órfão persiste**. Zero nome
novo no vocabulário.
**D7 só volta** se houver caso legítimo de *"aceita hoje, agenda depois"* — e aí é **decisão de
produto nova**, não nome de estado.

> ### ⚠️ CORREÇÃO MEDIDA AO PACOTE — a atomicidade **não é de graça**
> Medido no GATE §7.3(c): `repository.create` (availability) **não aceita** transação externa
> (`runQueryWithTenant`, pool); `confirmBookingWithProviderLock` e `confirmBookingWithResourceLock`
> **abrem o próprio client e dão `BEGIN`**. **Duas das quatro peças não sabem participar de uma
> transação externa.**
> Uma tentativa ingênua **não falha limpo**: o confirm roda em **outra conexão**, não enxerga a
> availability não-commitada, e devolve **`NotFoundError`** — falha pelo motivo errado, num caminho
> que vira dinheiro.
> **A decisão sustenta; o CUSTO fica declarado:** a F2 inclui **refatorar `create` e os dois
> `confirm*` para aceitar client externo**. Não é ajuste de chamada — é fatia com prova de corrida,
> porque toca a única trava de exclusividade que o sistema tem.

---

## §D — D4 · O RECURSO DE EXCLUSIVIDADE DA AGENDA `user` / `page`

**Decisão, em duas metades — e só uma destrava:**

**D.1 — `user`: o recurso é o PRÓPRIO ACTOR.** Um corpo, uma agenda. É literalmente o V1 da
`0146 §B` (*"V1 assume `provider_actor_id` como o RECURSO"*). A agenda pessoal volta a ser
contratável e o `501` de `owner_type='user'` **cai**.

> ### ⚠️ CORREÇÃO MEDIDA AO PACOTE — *"nada a inventar"* é otimista
> O advisory lock serve, mas a **checagem de conflito dentro dele é escopada a `service_offering`**:
> ```sql
> unified-availability.repository.ts:431-435
>   JOIN service_offerings so2 ON so2.id = a2.owner_id
>  WHERE a2.owner_type = 'service_offering' AND so2.provider_actor_id = $2
> ```
> **Para `owner_type='user'` ela não acha conflito nenhum.** Destravar exige **generalizar o rollup
> por `provider_actor_id` para atravessar os dois `owner_type`** — fatia pequena, **com prova de
> corrida obrigatória** (`0146 G7`), porque mexe na única trava de exclusividade existente.
> ⛔ **Enquanto a generalização não existir, o `501` de `user` PERMANECE.** Destravar por decisão sem
> destravar por código seria acender a superfície sem a trava — o oposto do que a `G10` protege.

**D.2 — `page`: NÃO é recurso. Ela AGREGA.** A regra R1 de Clayton (*"a empresa não tem agenda: ela
AGREGA"*) proíbe a resposta fácil: 10 seguranças são 10 agendas. Janela de `page` é **declaração de
horário de funcionamento**, não recurso reservável. Contratar *"a empresa"* tem de **resolver para
uma unidade concreta** (pessoa via membership, ou ativo) no aceite.
⛔ **Enquanto essa resolução não existir, o `501` de `page` está CERTO** — é fail-closed honesto,
**não é dívida**, e não deve ser contado como tal.

---

## §E — O QUE ESTA DECISÃO **NÃO** DECIDE

- **Não move dinheiro.** Δbank = 0 em todas as fatias. `quote_cents` é **preço declarado**, não
  custódia — mesma natureza de `price_cents`. **Não é segundo ledger** e não vai para o Bank.
- **Não destrava `0146 §B`** (compromisso composto de N agendas) — reservada, ato próprio.
- **Não decide a chave evento↔demanda** (a F3). `event_operational_needs` (14 linhas vivas, liga por
  CONCEPT, **sem coluna de valor**) é a candidata forte, mas escolher é decisão à parte.
- **Não decide o alerta de sobreposição** do `ART. II` (§B.5).
- **Não apaga o trilho RFQ** — contém e nomeia destino (§A.1).

---

## §F — RESÍDUOS COM DONO

| resíduo | dono | gatilho |
|---|---|---|
| `DT-RFQ-JSONB-QUOTE-TRAIL-SUPERSEDED` — aposentar as 10 rotas | frente própria | após a F1 desta frente entregar `quote_cents` como casa única |
| `DT-DEMAND-AGENDA-MIRROR-PHASE2-WITHOUT-DEADLINE` — o espelho na Agenda universal | **`F-SERVICE-DEMAND-QUOTE-LIFECYCLE`** (o espelho é dela por natureza) | **entrega da F2**. ⚠️ É marco, não query — se a F2 não ganhar definição de pronto, **reclassificar como não-planejado** em vez de seguir contando como plano |
| `501` de `page` | — | **não é dívida.** Só reabre com decisão de resolução para unidade |
| generalização do rollup para `user` | esta frente | pré-condição do §D.1 |

---

## Resumo seco

**A tabela vence o jsonb (princípio vence ponteiro) · pedir e orçar não tocam agenda, só o aceite
toca · a resposta declara o que oferta por `offering_id` XOR `asset_id` (FK singular quebraria a
locação) · validade 7 dias por oferta, `NULL` proibido, vencido morre · dirigido é a mesma entidade
· o estado "aceito + confirm falhou" deixa de existir por atomicidade — que custa refatorar três
métodos · `user` destrava depois de generalizar o rollup; `page` agrega e segue 501.**
