# ORGANIZAÇÃO DE EVENTO — orçamento → aceite → agenda → custo

> **Estado deste documento:** plano em revisão, **NÃO promulgado**. Passou por duas revisões
> independentes (YALA + instância de decisão de produto) em 2026-08-05; as correções delas já estão
> integradas aqui. **Faltam duas respostas de Clayton** (§7) antes de virar GATE.
>
> **Data da medição:** 2026-08-05 · **Banco:** `unificard_dev` · **runner:** 258 COMMANDS OK
>
> ⚠️ **Todo número aqui tem o comando que o produziu. Não acredite em nenhum — rode.**
> Quem escreveu isto errou **quatro** medições nesta mesma conversa (§9), todas do mesmo tipo.

> ## 🔴 ERRATA DO GATE F0 — 2026-08-06 · LEIA ANTES DE QUALQUER PARÁGRAFO ABAIXO
>
> O GATE deste plano rodou em 2026-08-05/06 (`docs/04_audit/GATE_F0_ORGANIZACAO_EVENTO_2026-08-05.md`,
> 3 rodadas) e **derrubou nove afirmações deste documento**. As correções estão marcadas ⛔ no corpo,
> **riscadas e não apagadas** — a afirmação original registra o que alguém acreditou, e apagá-la
> perderia a lição.
>
> **A omissão mais cara: este plano NÃO CITA a `DECISION-0164` uma única vez** — a decisão RATIFICADA
> **e SELADA (re-selo YALA, 2026-07-07)** que criou e governa `service_demands`. O cartório
> (`:13026`) fecha o módulo com cláusula expressa: *"reabertura só por **nova frente nomeada**
> (`F-SERVICE-DEMAND-*`), **não patch solto**"*. **Este documento é, hoje, um patch solto.**
>
> **Três fatias já saíram daqui e estão FEITAS** (não refaça): F-ZERO (3º ramo do confirm
> `3f36b9dce`) · a garantia de exclusividade da locação (`bb6ac8e73`) · a extensão verdadeira da
> janela na tela (`e7e09a21c`).
>
> **Estado real de cada fatia:** F-ZERO ✅ · F0 ✅ · **F1 parcialmente travada** · **F2 travada** ·
> **F3 travada — e não pelo motivo que este documento supõe (ver §7-BIS)** · **F4 travada** (depende
> da F1). ⛔ **NÃO comece a F4.**

---

## 1 · O PROBLEMA, EM UMA FRASE

O cartão **"Solicitar orçamento"** se comporta como **"Reservar horário"**: ele obriga o cliente a
escolher uma janela que o **fornecedor** publicou. Num orçamento, quem tem a necessidade é o
**cliente** — *"preciso no dia 20, das 14h às 22h; você consegue e por quanto?"*

**O nome e o comportamento discordam.** Todo o resto deste documento decorre disso.

---

## 2 · O QUE JÁ EXISTE (medido)

### 2.1 · Substrato de orçamento — completo, registrado no boot, **ZERO linhas**

```
service_demands
  actor_id · concept_id · title · description · vinculo
  quantity · quantity_filled              ← N fornecedores para a mesma demanda
  date_start · date_end                   ← A JANELA que o cliente declara
  time_start · time_end · weekdays
  radius_km · acceptance_mode(automatico|com_analise)
  pricing_mode(preco_ofertado|orcamento)  ← "valor final" vs "sob orçamento"
  offered_price_cents · cancel_notice_hours
  visibility(public|connections) · status · post_id

service_demand_responses
  provider_actor_id · quote_cents ← O VALOR JÁ VIAJA · message
  status(pending|accepted|chosen|rejected|withdrawn)
        ↑ já distingue "aceito" de "escolhido entre vários"
```

Rotas vivas: `POST /demands` · `GET /demands/mine` · `GET /demands/opportunities` ·
`GET /demands/:id` · `POST /demands/:id/respond` (com `quoteCents`).
Registrado em `app.builder.ts:740-742`.

⛔ **ERRATA (GATE, 2026-08-06): são SETE rotas, não cinco.** Faltam nesta lista
`GET /demands/concepts` · **`POST /demands/:id/responses/:rid/choose`** ·
**`POST /demands/:id/responses/:rid/withdraw`**. As duas últimas são exatamente o *"⑤ cliente aceita
ou recusa"* que o §4 trata como **a construir** — e estão vivas, ligadas ao frontend
(`OpportunitiesPage.tsx:146` e `:153`) desde 2026-07-07.

⛔ **ERRATA: o modo `orcamento` NÃO é novo.** `DECISION-0164 D2` (ADENDO 6) promulgou
`pricing_mode: preco_ofertado | orcamento` com CHECK físico, e o motor **já exige** `quoteCents`
quando é `orcamento` (`demand.service.ts:137`). O §1 deste plano trata orçamento como coisa a
construir; ele é **vocabulário governado desde 07/07**.

**Frontend alcança as duas pontas** (confirmado pela revisão de produto): `api/demands.ts`,
`DemandPublishForm.tsx` (embutido em `OpportunitiesPage:163` e `IntentComposer:853`),
`respondDemand()` → `POST /demands/:id/respond`.

⚠️ **Mas zero linhas nas duas tabelas.** Ninguém nunca atravessou esse caminho. *"Não regride
nada"* é verdade trivial; *"funciona"* é **não medido**.

### 2.2 · Molde de oferta (asset-first) — **com dado real**

```
actor_assets(4)          "Fiat Argo 2018 · Precision 1.8 AT6"  ← UMA identidade
                         "Tenda 10x10" · "Gerador 180 kVA" · "Banheiro químico"
actor_asset_modes(4)     activation_mode · enabled   ← modos LIGÁVEIS no mesmo objeto
actor_asset_rental_pricing_tiers(4)
      por_hora R$20 · por_dia R$70 · por_semana R$550 · por_mes R$2.000
      ↑ QUATRO unidades SIMULTÂNEAS no mesmo ativo
actor_asset_rental_terms(4) · actor_asset_sale_terms(0) · actor_asset_service_usages(0)
```

**Este é o molde certo e já está selado:** identidade única + modos ligáveis + termos por modo.
O carro pode estar à venda **e** para locação **e** para cessão ao mesmo tempo, sem virar três
cadastros.

📌 **Consequência para o cadastro do fornecedor:** *"solicite orçamento"* **não é um tipo de item —
é um MODO**, igual a venda e locação. O mesmo buffet liga preço fechado no coquetel e orçamento no
casamento, **no mesmo cadastro**.

### 2.3 · Trava de concorrência — existe, mas **só em dois dos três ramos**

```
unified-availability.service.ts
  if (ownerType === SERVICE_OFFERING) → confirmBookingWithProviderLock  → return
  if (ownerType === ACTOR_ASSET)      → confirmBookingWithResourceLock  → return
  ↓ cai fora
  updateBooking(...)                  → SEM LOCK NENHUM

repository.ts:425 → SELECT pg_advisory_xact_lock(hashtextextended('tenant:provider')) dentro de BEGIN
```

**Dado vivo:** `availability` por `owner_type` → **`service_offering` 58 · `page` 8 ·
`actor_asset` 4`**. O CHECK aceita 8 valores.

🔴 **`page` tem 8 agendas vivas e cai no ramo sem trava.** Dois aceites na mesma janela: **os dois
confirmam**. Achado da YALA, verificado no código.

### 2.4 · Precedente de expiração preguiçosa — funciona hoje

`group_invites` expira **na leitura** (`getInviteById`, `getInvitesByGroup`, `getInvitesByUser`),
sem worker. Verificado em 2026-08-05.

### 2.5 · Presença ("online tipo Uber")

`live_presence(0)`: `context_type · contact_id · status · opted_in · last_seen_at · expires_at`.
~~⚠️ **`status` SEM CHECK** — vocabulário sem trava. Foi assim que `actor_type` chegou a 3 gerações.~~

⛔ **ERRATA (GATE, 2026-08-06): FALSO. O CHECK EXISTE.**
```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid='live_presence'::regclass AND contype='c';
-- live_presence_status_check  CHECK (status = ANY (ARRAY['ONLINE','OFFLINE']))
```
O pré-requisito do §8 (*"CHECK em `live_presence.status`"*) **já está satisfeito**.
⚠️ Há um defeito real ali, e é **outro**: `status`/lifecycle é **minúsculo** por
`07_NOMENCLATURA §4.11`, e `ONLINE`/`OFFLINE` está **MAIÚSCULO**. Tabela vazia ⇒ é o momento mais
barato de convergir. Fica **NOMEADO, não tratado**.

---

## 3 · AS LACUNAS REAIS — três

| | lacuna | confirmada por |
|---|---|---|
| **L1** | **validade do orçamento** — nenhuma coluna em lugar nenhum | ambas as revisões |
| **L2** | **orçamento dirigido** — `service_demands` é broadcast (`public|connections`), não tem `target_actor_id` | ambas |
| **L3** | **custo por evento** — nenhuma agregação no sistema | ambas |

**NÃO são lacunas** (listei por engano e fui corrigida):
- ✗ *"valor na resposta"* → **`quote_cents` existe**
- ✗ *"falta trava de concorrência"* → **o advisory lock existe** (mas só em 2 de 3 ramos, §2.3)

---

## 4 · O FLUXO COMPLETO, DOS DOIS LADOS

> Lei de Clayton: cada elo tem **PAPEL · SUPERFÍCIE · AUTORIDADE · FATIA no split**.

**① FORNECEDOR CADASTRA** — molde asset-first: identidade única + modos ligáveis.
*"Solicite orçamento"* é MODO, não tipo. · Autoridade: dono do ativo.

**② CLIENTE DESCOBRE** — já funciona (descobribilidade 175/175 medida). Sem mudança.

**③ CLIENTE PEDE ORÇAMENTO** ← *o cartão apontado por Clayton*
Declara **a janela dele** (`date_start/end` + `time_start/end`), opcionalmente amarrada a um evento,
com quantidade. ⚠️ **NÃO toca agenda.**

**④ FORNECEDOR RESPONDE**
`quote_cents` + `message` + **`valid_until`** (L1).
🔴 **E grava uma `availability` DECLARADA** espelhando a janela do cliente — ver §5, F-1.
Superfície: caixa de entrada dele (existe). Autoridade: `canRepresentActor` sobre `provider_actor_id`.
⚠️ Declarar **não bloqueia** — `DECISION-0146 §A.1`.

**⑤ CLIENTE ACEITA OU RECUSA** — vocabulário já existe.
No aceite, **e só nele**, na MESMA transação:
1. valida `valid_until > now()` → vencido **falha honestamente aqui**
2. cria booking contra a availability declarada + confirma pelo chokepoint **com lock**
3. dois clientes na mesma janela: **UM** confirma, o outro recebe recusa honesta

⚠️ Se o confirm falhar, **o orçamento NÃO some** — estados separados. **Mas em que estado ele
fica?** → decisão pendente (§7, D7).

**⑥ VENCIMENTO** — expiração **preguiçosa**: `expirado` nunca é gravado, é **derivado** na leitura e
**imposto** no aceite. Zero worker.
🔴 **EXIGÊNCIA:** UMA função responde *"este orçamento ainda vale"*, e todos importam dela.
Derivação copiada em N telas diverge — é o defeito `free-time` consertado em 2026-08-05.

**⑦ EVENTO AGREGA** — read-model (VIEW) por `eventId`. **TRÊS números rotulados, nunca somados:**
**CONTRATADO** (aceito) ← manchete · **ORÇADO** (respondido) · **SOLICITADO** (sem resposta).
⚠️ Somar os três: organizador vê R$40k e tem R$12k contratado.
⚠️ **`quote_cents` NÃO é segundo ledger** — é preço **declarado**, não custódia. Mesma natureza de
`price_cents`. **Ambas as revisões confirmaram.** Fica escrito para ninguém "consertar" movendo para
o Bank depois.

**⑧ QUEM RESOLVE QUANDO DÁ ERRADO** — aceito e o fornecedor não cumpre: ~~**não tem caminho hoje**.
Fica NOMEADO, fora destas fatias.~~
⛔ **ERRATA: já está nomeado, e com mais régua do que este documento oferece.**
`DECISION-0164 ADENDO 4` define no-show como **FATO registrado pelo emissor**, avaliação mútua, e a
**régua do público**: só fatos agregados (nota, nº de serviços, taxa de cancelamento, taxa de
no-show); **proibido** julgamento de caráter. Renomear aqui **perde a régua**.

---

## 5 · OS TRÊS ACHADOS DAS REVISÕES — integrados

### 🔴 F-1 · "F2 = zero SQL nova" era FALSO

`bookings.availability_id` é **NOT NULL** → booking não existe sem availability. Mas ③ é o cliente
declarando uma janela que o fornecedor **nunca publicou**. **Não há linha para reservar.**

**Solução (revisão de produto), e ela não inventa nada:** a resposta do fornecedor (④) é
semanticamente uma **declaração de disposição** — e `DECISION-0146` já define que **declaração não
bloqueia; só compromisso confirmado bloqueia**. Então ④ grava a availability declarada, e ⑤ reserva
e confirma contra ela com o lock. ~~Cinco orçamentos na mesma janela = cinco declarações sobrepostas
(0146 abençoa) e **só um** vira compromisso.~~

~~**F2 passa a ter UMA escrita nova.**~~

> ⛔ **ERRATA (GATE, 2026-08-06) — esta era a afirmação mais consequente do documento.**
>
> Quando isto foi escrito, *"cinco declarações sobrepostas"* era **FALSO**: `createAvailability`
> recusava com `409 RENTAL_AVAILABILITY_OVERLAP` (`unified-availability.service.ts:93-100`) e havia
> ainda uma `EXCLUDE` de banco. O plano leu a **NORMA** e não o **CÓDIGO**.
>
> **Hoje é verdade — mas porque o CÓDIGO mudou, não porque o plano estava certo.** O GATE-pequeno
> provou que o bloqueio de declaração era desnecessário (a trava do COMPROMISSO,
> `confirmBookingWithResourceLock`, é **15 dias anterior** e cobre a impossibilidade física na camada
> que a `§A.7` prescreve). Os dois bloqueios saíram no commit `bb6ac8e73`, com GO.
>
> 🔴 **E a F2 continua TRAVADA, por outro motivo que o plano não vê:** `service_demand_responses` tem
> **9 colunas e NENHUMA diz o que está sendo ofertado** (só `provider_actor_id`). `service_offerings`
> **não tem `concept_id`** enquanto `service_demands` é chaveada por CONCEPT, e **4 dos 7 providers
> têm 2+ ofertas ativas**. Escolher o dono da declaração seria **adivinhar o recurso** — o que a
> `0146 G10` proíbe por nome. **"UMA escrita nova" é subestimar: falta uma COLUNA (FK) antes.**

### 🔴 ACRÉSCIMO DA DIREÇÃO — as declarações perdedoras não têm porta de saída

Se cinco orçamentos criam cinco `availability` e um vence, **quem apaga as outras quatro?** Sem
isso, cada orçamento não-aceito deixa **lixo permanente** na agenda do fornecedor.

É a família *"porta de saída sem gatilho"* consertada em 2026-08-05 — nasceria de novo, na mesma
semana. **A vida da declaração tem que estar amarrada à vida do orçamento. Entra na F1.**

⛔ **ERRATA: o princípio já estava decidido, e não por mim.** `DECISION-0164 ADENDO 3` (Clayton,
2026-07-07): cancelamento do provider reabre a vaga **e** *"a janela na agenda do cancelante
**LIBERA** (TEMPO consistente)"*. O acréscimo estava certo no mérito e **redundante na autoria** —
o que falta é **material**, não decisão.

### 🔴 ACRÉSCIMO DA DIREÇÃO — o "três casas" BLOQUEIA a F2, não é adiável

A YALA nomeou três vocabulários para "a coisa orçada" (`rentable_resources` 0 ·
`service_offerings` 15 · `actor_assets` 4) e mandou para o GATE. **Mas F-1 diz "availability
declarada, dono = oferta/ativo do fornecedor" — e é aí que a pergunta explode: `service_offering`
ou `actor_asset`?**

Os dois têm **ramos de lock diferentes**. A escolha do dono da declaração **decide qual trava
protege o aceite**. Não dá para adiar uma decisão que a fatia seguinte precisa executar.

### 🟡 F-2 · Contradição interna: `valid_until` NULL × D1

F1 dizia *"null = sem prazo"*; D1 propõe default de 7 dias. **Se `null` é legal, o orçamento eterno
continua sendo o caminho de MENOR esforço.**
**Correção aceita:** default injetado **na escrita**, configurável **por oferta**; `null` proibido.
*"Sem prazo"* só existe se Clayton decidir, como escolha **explícita**, nunca como omissão.

### 🟡 F-3 · O substrato é MULTI, o fluxo estava single

`service_demands.quantity` / `quantity_filled` **existem** — a demanda já nasce dizendo *"preciso de
3 seguranças"*. O ⑤ estava escrito para **um** aceite. → decisões D6a/b/c (§7).

---

## 6 · AS FATIAS, NA ORDEM (revisadas)

**F-ZERO · O TERCEIRO RAMO DO CONFIRM** — 🔴 **antes de tudo**
Hoje `page` (8 agendas vivas) confirma **sem lock**. O ramo tem que ganhar trava ou **recusar
explicitamente**. Hoje ele aceita calado. Depende da resposta de Clayton em §7.

**F0 · GATE (read-only)** — nada escrito. Mapa de:
(a) `page` como dona de agenda: **desenho ou resíduo?**
(b) onde mora a availability declarada do respond (§5, três casas)
(c) alcance real de `quantity`/`quantity_filled`
(d) quem lê `service_demands` hoje

**F1 · O ORÇAMENTO VIRA REAL**
`+ service_demand_responses.valid_until` (default na escrita, `null` proibido)
`+ service_demands.target_actor_id` (null = broadcast de hoje; nada regride)
`+` **legibilidade do orçamento dirigido** (quem vê: solicitante, alvo, organizador?)
`+` a **função única** de validade + guard de leitor único
`+` **ciclo de vida da declaração** amarrado ao orçamento
Prova vermelha: aceitar vencido **deve falhar dentro da transação**. Δbank = 0.

**F2 · ACEITE → COMPROMISSO** — religamento **+ uma escrita de declaração**
Prova vermelha: dois aceites na mesma janela → **exatamente um** confirma; e o orçamento aceito
**não some** quando o booking falha.

~~**F3 · DASHBOARD DO ORGANIZADOR** — read-model puro, três números rotulados. Zero tabela nova.~~

> ⛔ **ERRATA (2026-08-06) — A F3 ESTÁ TRAVADA, e a direção repetiu aqui o erro do §9.**
> Eu declarei a F3 *"não bloqueada, read-model puro, zero tabela nova"* no GATE **sem verificar a
> premissa dela**: que existe um elo demanda→evento. **Não existe.**
> ```sql
> SELECT column_name FROM information_schema.columns
>  WHERE table_name='service_demands' AND column_name ILIKE '%event%';   -- []  (só post_id)
> -- service_demand_responses: idem, []
> ```
> **Nem `service_demands` nem `service_demand_responses` sabem de evento nenhum.** Um read-model
> *"por `eventId`"* sobre CONTRATADO/ORÇADO/SOLICITADO **não tem por onde agrupar**.
>
> **O que EXISTE, medido:** `bookings.metadata->>'eventId'` (jsonb, **2 de 5** bookings o carregam) ·
> `event_operational_needs` — **14 linhas VIVAS**, com `event_id` + `need_concept_id` +
> `fulfillment_kind`, lida por `event-need-supplier-discovery.service.ts` (o mesmo serviço que
> alimenta o "Solicitar orçamento"). ⚠️ **Mas ela não tem coluna de VALOR** — nenhum `_cents`.
> ⚠️ `event_financial_execution` **não serve**: 0 linhas, e as colunas são
> `status/error_message/processed_at` — é rastreamento de execução, **não custo**. Nome que engana.
>
> ⇒ **A F3 exige decisão, não código:** onde o valor de uma necessidade atendida é registrado, e por
> qual chave a demanda/resposta se liga ao evento. **`event_operational_needs` é a candidata forte —
> é a única casa viva do elo evento↔fornecimento — e ela liga por CONCEPT, não por demanda.**
>
> 📌 **Isto é o §9 acontecendo de novo, comigo:** li *"read-model puro, zero tabela nova"* e não
> perguntei *"o agrupador existe?"*. **A régua desceu sobre a minha própria lista de "executável
> agora".**

**F4 · A TELA** — o campo de horário passa a aceitar data ou intervalo.

---

## 7 · DECISÕES DE CLAYTON — pendentes

| | decisão | sugestão |
|---|---|---|
| **Q1** | 🔴 **`page` como dona de agenda é DESENHO ou RESÍDUO?** Se resíduo, o furo do 3º ramo é dívida menor. Se desenho, é **bug de corrida vivo** e sobe na fila | — |
| **Q2** | 🔴 **Os N aceites de uma demanda são compromissos INDEPENDENTES ou um COMPOSTO?** Encosta em `0146 §B`, explicitamente reservado | independentes agora |
| **D1** | validade default | **7 dias, configurável por OFERTA** (não por tenant). Nunca hardcode |
| **D2** | vencido revive ou morre? | **morre e nasce outro** — renovar faz o histórico mentir sobre o que o cliente viu |
| **D3** | quem vê orçamentos do evento? ⚠️ *reformulada pela revisão:* a pergunta certa é **"QUAL CHAVE governa"**, não "privacidade sim/não" — o padrão existe (`DECISION-0189`, tríade chave×capability×grant) | registrar vocabulário |
| **D4** | orçamento dirigido e demanda aberta são a mesma entidade? | **mesma**, `target_actor_id` null = broadcast |
| **D5** | *"solicite orçamento"* é modo do item ou tipo de cadastro? | **MODO** — amarrar ao fornecedor recria a PJ duplicada |
| ~~**D6a**~~ | ⛔ **NÃO É DECISÃO — JÁ ESTÁ IMPLEMENTADO E ATÔMICO.** `fillSlot` (`demand.repository.ts:244`) é **um único `UPDATE`** com `status='open' AND quantity_filled < quantity` no `WHERE` — sem check-then-act, sem TOCTOU. `releaseSlot` reabre. Perguntar isto é pedir a Clayton que **redecida o que ele já decidiu** | — |
| **D6b** | ao encher, as pendentes auto-rejeitam ou ficam? ⛔ **ERRATA: não é decisão de produto — é DEPENDÊNCIA BLOQUEADA.** `DECISION-0164 D3`: *"a re-orquestração (push) é **fatia C** (depende de central de notificações)"* — **e a central não existe** (substrato notify é schema-ghost). Estado medido: as pendentes **ficam `pending` para sempre**; quem tentar responder depois recebe `409`, mas quem já estava na fila **não é avisado de nada** | bloqueada |
| **D6c** | os N aceites são independentes ou compostos? | = Q2 |
| **D7** | 🔴 aceito + confirm falhou = **em que estado o orçamento fica?** A máquina atual não tem nome para isso | — |

---

## 8 · O QUE ESTE PLANO **NÃO** RESOLVE

- **Não move dinheiro.** Δbank = 0 em todas as fatias. Pagamento é outro arco.
- **Trilho de urgência** (presença + capacidade agora — *"o segurança que faltou"*). É o fluxo
  **rápido**; orçamento é o **lento** (dias de validade). Uber separa os dois por baixo. Misturar
  entorta o desenho do orçamento. **Pré-requisito quando ativarem: CHECK em `live_presence.status`.**
- **Unidade de tempo no serviço.** Locação tem 4 faixas simultâneas; serviço só tem
  `duration_minutes` (pacote fixo, **não** unidade). Assimetria = decisão.
- **Convergência das três casas** de "coisa ofertável" — só o GATE diz o custo.
- **Substituição sob urgência** (aceito e não cumpriu).
- **Timing/mensagem do 404** de grupo secreto — aberto desde a auditoria de 2026-08-05.

---

## 9 · O PADRÃO DE ERRO DE QUEM ESCREVEU ISTO

Nesta conversa eu errei **quatro** medições. Todas foram derrubadas por quem conferiu, e **todas
são o mesmo erro**:

1. listei *"valor na resposta"* como lacuna **tendo medido `quote_cents` antes**;
2. disse que faltava trava de concorrência — **o advisory lock existia**;
3. apresentei `rentable_resources` como modelo vigente **sem verificar que tem ZERO linhas**
   enquanto o asset-first tem dado real;
4. escrevi *"F2 = zero SQL nova"* **tendo medido `availability_id NOT NULL` eu mesma**.

> **O padrão: medi um nome plausível e parei antes de perguntar qual está VIVO — ou medi certo e
> não carreguei a medição para dentro do desenho.**

**Assuma que sobrou pelo menos um erro desse tipo neste documento.** Os candidatos que eu ainda não
consegui derrubar sozinha:

- *"o frontend alcança as duas pontas de /demands"* — confirmado por grep, **não por navegação**;
- *"a availability declarada resolve o F-1"* — é desenho **no papel**, ninguém executou;
- *"expiração preguiçosa dispensa worker"* — vale **se TODO leitor derivar**; se um esquecer, o
  orçamento vencido vive naquela tela.

---

## 7-BIS · O QUE FALTA, DEPOIS DO GATE (2026-08-06)

**Executável sem decisão nenhuma:** ✅ esta errata · ✅ o `catch` que afirmava vazio em
`OpportunitiesPage` (corrigido: falha de leitura deixou de virar *"não há oportunidades"*).

**Travado em Clayton — e o que cada resposta destrava:**

| decisão | trava |
|---|---|
| 🔴 **Qual das duas casas vazias de orçamento morre:** `service_demand_responses.quote_cents` (tabela indexável, 0 linhas) × `events.metadata.rfqs[].quotes` (jsonb, 10 rotas vivas sob `FEATURE_RFQ_ENABLED=true`, **0 rfqs em 9 eventos**). ⚠️ **A `0164` se contradiz consigo:** `D1` rejeitou jsonb (*"não indexa"*), `ADENDO 6(c)` manda **compor com ele** | **F1 · F4** |
| 🔴 **Onde mora a availability declarada** — e, com o aperto: **sem uma FK do que é ofertado em `service_demand_responses`, o aceite não tem dono legítimo.** `ADENDO 7(c)` já aponta `service_offerings` (direção, não resposta completa) | **F2** |
| 🔴 **Por qual chave a demanda se liga ao EVENTO, e onde o valor é registrado** (ver errata da F3) | **F3** |
| 🔴 **Qual é o recurso de exclusividade da agenda `user`/`page`** — nasceu da F-ZERO; enquanto não vier, **agenda pessoal não é contratável** (501 `STOP_DECISION_REQUIRED`) | agenda pessoal |
| 🟠 Este documento vira **`F-SERVICE-DEMAND-<algo>`** antes de qualquer GO (cartório `:13026`) | **qualquer execução** |
| 🟡 `Q2`/`D6c` · `D1` · `D2` · `D3` · `D4` · `D5` · `D7` | **F1** |

**Ordem depois das decisões:** F1 é **fatiável** — `valid_until`, `target_actor_id` e a função única
de validade **não dependem** da decisão do dono da declaração; o **ciclo da declaração depende**.
F2 só depois da FK. **F4 por último. ⛔ NÃO comece a F4.**

## 10 · O QUE NÃO ESTÁ AUDITADO

- ~~Nenhuma das duas revisões rodou o runner ou typechecks~~ ⛔ **rodados no GATE**: `runner 259 OK`
  (subiu de 258 com `audit-window-render-truthful-extent`) · `tsc BE 0` · `tsc FE 0`.
- ~~não se sabe se `POST /respond` já valida autoridade sobre `provider_actor_id`~~
  ⛔ **VALIDA, e mais do que ④ promete.** `demand.routes.ts:96` → `assertRepresentsActor` →
  `canRepresentActor` **fail-closed 403** ANTES do service; o `providerActorId` é o actor do contexto,
  **nunca vem do body**; fora da plateia → **404** (não 403, para não vazar existência);
  UNIQUE `(demand_id, provider_actor_id)` no banco. **Registrado como CERTO de propósito.**
- Concorrência: **segue sem corrida provocada.** O 3º ramo virou `501` por leitura de código +
  prova de comportamento em efêmera — **não** por race reproduzida.
- ~~F0~~ ⛔ atacada (3 rodadas). **F3 e F4 seguem sem ninguém as atacar** — e a F3 acabou de se
  revelar travada (§7-BIS).
- 🔴 **Nunca aberto no navegador.** As duas pontas do frontend seguem provadas por **call-site**,
  não por uso. As 10 rotas RFQ: **registro ≠ alcance**, não foram abertas uma a uma.
