# ORGANIZAÇÃO DE EVENTO — orçamento → aceite → agenda → custo

> **Estado deste documento:** plano em revisão, **NÃO promulgado**. Passou por duas revisões
> independentes (YALA + instância de decisão de produto) em 2026-08-05; as correções delas já estão
> integradas aqui. **Faltam duas respostas de Clayton** (§7) antes de virar GATE.
>
> **Data da medição:** 2026-08-05 · **Banco:** `unificard_dev` · **runner:** 258 COMMANDS OK
>
> ⚠️ **Todo número aqui tem o comando que o produziu. Não acredite em nenhum — rode.**
> Quem escreveu isto errou **quatro** medições nesta mesma conversa (§9), todas do mesmo tipo.

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
⚠️ **`status` SEM CHECK** — vocabulário sem trava. Foi assim que `actor_type` chegou a 3 gerações.

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

**⑧ QUEM RESOLVE QUANDO DÁ ERRADO** — aceito e o fornecedor não cumpre: **não tem caminho hoje**.
Fica NOMEADO, fora destas fatias.

---

## 5 · OS TRÊS ACHADOS DAS REVISÕES — integrados

### 🔴 F-1 · "F2 = zero SQL nova" era FALSO

`bookings.availability_id` é **NOT NULL** → booking não existe sem availability. Mas ③ é o cliente
declarando uma janela que o fornecedor **nunca publicou**. **Não há linha para reservar.**

**Solução (revisão de produto), e ela não inventa nada:** a resposta do fornecedor (④) é
semanticamente uma **declaração de disposição** — e `DECISION-0146` já define que **declaração não
bloqueia; só compromisso confirmado bloqueia**. Então ④ grava a availability declarada, e ⑤ reserva
e confirma contra ela com o lock. Cinco orçamentos na mesma janela = cinco declarações sobrepostas
(0146 abençoa) e **só um** vira compromisso.

**F2 passa a ter UMA escrita nova.** Declarar isso, não esconder atrás de "religamento".

### 🔴 ACRÉSCIMO DA DIREÇÃO — as declarações perdedoras não têm porta de saída

Se cinco orçamentos criam cinco `availability` e um vence, **quem apaga as outras quatro?** Sem
isso, cada orçamento não-aceito deixa **lixo permanente** na agenda do fornecedor.

É a família *"porta de saída sem gatilho"* consertada em 2026-08-05 — nasceria de novo, na mesma
semana. **A vida da declaração tem que estar amarrada à vida do orçamento. Entra na F1.**

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

**F3 · DASHBOARD DO ORGANIZADOR** — read-model puro, três números rotulados. Zero tabela nova.

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
| **D6a** | aceitar N respostas até encher `quantity`? | sim |
| **D6b** | ao encher, as pendentes auto-rejeitam ou ficam? | **auto-reject com aviso** |
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

## 10 · O QUE NÃO ESTÁ AUDITADO

- Nenhuma das duas revisões rodou o runner ou typechecks — os números de estado (258 OK, 0, 0) são
  medição minha, sem conferência independente.
- A YALA não leu `demand.routes.ts` nem o service: **não se sabe se `POST /respond` já valida
  autoridade sobre `provider_actor_id`** como ④ promete.
- Nenhuma testou concorrência de verdade — o achado do 3º ramo é **leitura de código**, não corrida
  provocada.
- F0/F3/F4 não foram atacadas por ninguém.
