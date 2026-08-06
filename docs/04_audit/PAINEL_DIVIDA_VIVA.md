# PAINEL ÚNICO DE DÍVIDA VIVA — **O PLACAR**

> ## 🔴 ESTE É O PLACAR ÚNICO. LEIA ISTO PRIMEIRO, ATUALIZE ISTO SEMPRE.
>
> **Decisão de Clayton, 2026-07-30.** Existiam **nove** arquivos rastreando dívida, e eles
> divergiam. O que se declarava obrigatório (`dividatecnica.md`) tinha placar de **06/07**
> dizendo *163 guards* quando já eram **227** — e três sessões seguidas fecharam dívida sem
> atualizá-lo, inclusive a direção, quatro vezes num único dia.
>
> **Um arquivo por papel, sem sobreposição:**
>
> | papel | arquivo |
> |---|---|
> | **PLACAR** — o que está vivo HOJE, cabe na cabeça | 🔴 **este arquivo** |
> | **CARTÓRIO** — história append-only, causa-raiz, provas | `REMEDIATION_DT_LOG.md` (topo = recente) |
> | **HISTÓRICO** — evidência antiga, não é placar | `dividatecnica.md`, `PLANO_ZERAGEM_DT.md` |
> | **PLANO** — estratégia das 6 fases | `PLANO_RECUPERACAO.md` |
>
> **Nome sem data, de propósito.** A versão anterior chamava-se `..._2026-07-29.md`, e nome
> datado em documento vivo é convite para a próxima instância criar um segundo. **Nunca
> versione este arquivo por nome — atualize-o.**
>
> **Toda fatia que fechar dívida atualiza o PLACAR abaixo e o REGISTRO DE SESSÕES.** Não é
> burocracia: é o que impede que a próxima instância meça o sistema por um número de 24 dias
> atrás.

## 📊 PLACAR — última medição **2026-08-05**, toda ela de 1ª mão pela direção

| métrica | valor | como foi medido |
|---|---|---|
| `validate:regression-guards` | ✅ **257 COMMANDS OK** · drift **0** | `npm run`, banco `unificard_dev` — **+11 no dia** (246 → 257) |
| `typecheck` backend + frontend | ✅ **0 erros** | `tsc --noEmit` nos dois |
| Gate `schema-coherence` | ⚠️ **1174 chaves congeladas, gate VERDE**. `GHOST-WRITE-vivo` **252** (desceu 1 hoje) | `audit-schema-coherence-ratchet.mjs`, dentro do runner |
| 🔴 **RLS — o denominador que ninguém calculava** | **239** tabelas com `tenant_id` · **128 SEM RLS** · 0 com RLS sem policy. E o app conecta como **`postgres` (superusuário, `bypassrls`)**, então as 111 conformes **não bloqueiam nada em runtime**. A role dedicada `unificard_app` existe e não é a usada. ⛔ **DECISÃO DE CLAYTON** — ligar as 128 antes de garantir contexto de tenant em cada query troca vazamento por **apagão silencioso** | query direta, 2026-08-05 |
| `schema_migrations` (`unificard_dev`) | **569** aplicadas | query direta, 2026-08-05 |
| Banco oficial | **`unificard_dev`** · **338** tabelas · trava fail-closed viva | query direta, 2026-08-05 |
| `bank_ledger` · `bank_transactions` · `bank_splits` | **16 · 8 · 0** | query direta, 2026-08-05 |
| ✅ **SSOT do dinheiro de grupo** | `group_accounts.balance_cents` **ELIMINADA** (GO de Clayton) + `EVENT TRIGGER` que **recusa** recriá-la. Varredura completa: 3 colunas de saldo fora de `bank_*`, só 1 era violação — `ledger_snapshots` é **projeção** do `bank_ledger` (verificada na query do worker), `impact_balances` é pontuação social | migration `20260805190000`, verificada no banco |
| ⚠️ **o Bank deixou de ser zero — e é DE PROPÓSITO** | R$ 1.000,00 emitidos para teste (autorização de Clayton, 2026-08-04) pelo caminho real do Bank (`liquidity_issuance`, partida dobrada). **Não é dinheiro fictício**: o ledger recusa apagar, e por isso não se marca dinheiro como falso. Saída existe: `recolher-recursos-dev.ts`. **`bank_splits` segue 0 — nenhuma fatia de hoje moveu dinheiro (Δbank=0 em todas).** | `semear-recursos-dev.ts` |
| Dado curado intacto | **75 bairros · 48 policies** | query direta, 2026-08-05 |

### 🔻 OS DOIS TETOS — a única métrica deste projeto que NÃO PODE SUBIR

Antes de 2026-07-31, *"diminuir dívida técnica"* não tinha número: fechava-se o que se
tropeçava e o total era desconhecido. Agora tem dois, ambos no runner, ambos com trava
estrutural (o teto é comparado contra a contagem do CÓDIGO — pôr a chave na allowlist não
salva):

| teto | valor congelado 2026-07-31 | o que conta | guard |
|---|---|---|---|
| `BLOCKER-vivo` | **260** | ⚠️ ver ERRATA abaixo — **não é só** tabela ausente | `audit-schema-coherence-ratchet.mjs` |
| `BLOCKER-scripts` | 105 | idem, em scripts/e2e | idem |
| `CORRUPTOR-vivo` | 364 | ⚠️ idem | idem |
| `CORRUPTOR-scripts` | 1047 | idem, em scripts/e2e | idem |
| `DEBT-vivo` / `-scripts` | 32 / 18 | — | idem |
| `query-param as any` | **181** | entrada de usuário chegando ao SQL sem tipo | `audit-query-param-boundary-validation.mjs` |

> ### 🔴 ERRATA DA DIREÇÃO (2026-07-31, mesmo dia) — o que estes tetos contam
>
> A versão anterior desta tabela dizia que `BLOCKER` = *"escrita em tabela que não existe"*.
> **É falso.** `validate-schema-code-coherence.mjs:710-775` classifica **sete condições
> diferentes** sob os mesmos três rótulos. Medido de 1ª mão, 1826 violações:
>
> | o que é de verdade | quantas | a tabela existe? |
> |---|---|---|
> | **fronteira `bank_*` / `actors`** — leitura/escrita fora do módulo autorizado (Condições 3, 4, 5) | **1178 (64%)** | ✅ **SIM** — é violação de AUTORIDADE, não de schema |
> | **tabela fantasma** — tabela realmente ausente (Condição 1) | **644** · 156 tabelas distintas · **259 escrita+vivo** | ❌ não |
> | `metadata_decision` sobre tabela transacional (Condição 7) | 4 | — |
>
> **Duas coisas mudam com isto:** (a) o número que dá medo — 1826 — é **majoritariamente
> fronteira de dinheiro**, um problema real mas de outra natureza, com outro remédio; (b) o
> universo de fantasmas é **644 sítios / 156 tabelas**, não 1826.
>
> **E a Condição 2 do gate detecta COLUNA fantasma — a classe ③ — e reporta ZERO.** A classe ③
> existe e está provada (`rides_service_types` tem `base_fare_cents`, o código pede `base_fare`;
> `rides_drivers` grava `level='bronze'` contra CHECK que aceita standard/silver/gold/platinum).
> Um detector que existe, roda e nunca acha nada é **decoração** — mesma classe do
> `check-migration-numbering` que cobria 131 de 551 arquivos e estava verde há meses.
>
> **Os tetos continuam válidos como ratchet** (nada sobe em silêncio), mas **não os leia como
> "fantasmas"** até serem separados por condição. Separar é fatia própria.

**Como ler:** número que sobe = alguém introduziu dívida nova e o runner fica vermelho.
Não há caminho silencioso para **cima**.

> ### 🔴 ERRATA (auditoria Yala, 2026-08-01) — HÁ caminho silencioso para BAIXO
>
> Este bloco afirmava: *"o teto é comparado contra a contagem do CÓDIGO — pôr a chave na
> allowlist não salva"* e *"número que desce = dívida paga de verdade"*. **As duas frases são
> enganosas, e a segunda é falsa.**
>
> Existem **DUAS** allowlists, e só uma está travada:
> · `backend/scripts/schema-coherence-ratchet-baseline.json` — a do ratchet. Pôr chave aqui
>   **não salva**: o teto estoura contra a contagem do código. Isto eu ataquei e é verdade.
> · `scripts/schema-coherence-allowlist.json` — a do gate SUBJACENTE. Esta **salva**:
>   `validate-schema-code-coherence.mjs:1001-1005` descarta o ref allowlistado **ANTES** de
>   entrar em `violations`, que é o `--json` que o ratchet consome. A violação some da fonte, e
>   o teto desce sozinho.
>
> **E foi esse o caminho usado na única descida de teto do projeto.** `GHOST-WRITE-vivo`
> 260→259 e `GHOST-READ-vivo` 355→353 vieram de `DT-BANK-RECONCILIATION-HISTORY-DORMANT` ser
> acrescentado à allowlist do gate — a própria entrada admitia *"Allowlistado (não consertado por
> remoção)"*. O conserto do caminho VIVO era real e vale — a rota deixou de bater em `42P01`.
> **Mas o número teria descido igual com zero linha de código alterada.**
>
> ### ✅ RESOLVIDO DA FORMA CERTA — 2026-08-01, GO de Clayton
> As 277 linhas de `bank-reconciliation-history.repository.ts` foram **APAGADAS**, e junto
> caíram, no MESMO commit: a isenção `DT-BANK-RECONCILIATION-HISTORY-DORMANT` da allowlist do
> gate · a entrada do guard anti-revival · a migalha que apontava para o arquivo.
> **O teto NÃO desceu: continua `259/353`.** E é esse o ponto — aquele número escondia 277 linhas
> de SQL para uma tabela que nunca existiu; agora descreve a realidade. **Trocou-se uma mentira
> confortável por uma verdade do mesmo tamanho.**
> ### 🔴 2026-08-01 · O TETO NÃO DESCEU COM A CONTENÇÃO POR ESCOPO — e quem está errado é o MEDIDOR
> A contenção de 9 módulos fora do mínimo de produto deixou `GHOST-WRITE-vivo` em **259/259**.
> Não foi descuido: **111 WRITE + 112 READ** (43% e 32% dos tetos) vivem dentro dos módulos
> contidos, e mesmo assim o número não se moveu. A razão é estrutural, não preguiça —
> **o gate conta referência textual a tabela fantasma, e a contenção preserva o handler DE
> PROPÓSITO**, porque é isso que faz a reabertura custar horas em vez de uma migration
> forward-only. Os dois requisitos são incompatíveis por construção.
>
> Havia três saídas e as três têm custo: apagar o SQL **destrói a porta de volta** para melhorar
> um placar · allowlistar é exatamente a isenção-disfarçada-de-conserto que a seção acima acabou
> de desfazer · deixar como está mantém o número acusando algo que não é mais verdade. Escolhida
> a terceira, **com a mentira nomeada aqui em vez de silenciada**:
>
> ⚠️ **O teto `GHOST-WRITE-vivo` NÃO distingue** *"escreve em tabela inexistente e está
> alcançável por HTTP"* de *"preservado atrás de um 501 nomeado, inalcançável"*. Enquanto não
> distinguir, **259 é um limite superior, não uma medida**. Quem ler este número sem ler este
> parágrafo vai concluir que a contenção não fez nada — e vai estar errado.
> **A dívida verdadeira aqui é do medidor.** Ele precisa de uma condição nova (*"o sítio está
> atrás de contenção de escopo?"*), e essa é a próxima fatia do gate, não do produto.
>
> O guard `audit-dormant-ghost-repository-antirevival.mjs` **permanece no runner com a lista
> vazia**, de propósito: é onde a PRÓXIMA isenção-por-caminho tem de se registrar. Isentar
> arquivo na allowlist sem entrada lá recria a porta — a allowlist não distingue *dormente* de
> *religado*.
>
> ⚠️ **Os 6 tetos listados na tabela acima estão vencidos dentro deste próprio documento:** o
> guard em HEAD usa **14 tetos por CONDIÇÃO** (`GHOST-WRITE-vivo`, `BOUNDARY-READ-scripts`…),
> trocados em `856c5529d`, commit deste mesmo arco.
>
> **O padrão que a auditoria nomeou, e que vale mais que os números:** *este PLACAR erra onde se
> ELOGIA, não onde se acusa.* Toda afirmação de vitória aqui precisa da mesma prova que a
> direção exige das instâncias.

⚠️ **Declarado, não escondido:** `BLOCKER-vivo` **superestima** o perigo real — parte das 260
está atrás de contenção 501/403 provada. O gate mede REFERÊNCIA no código; a contenção mede
ALCANÇABILIDADE em runtime. Ensinar o scanner a descontar contenção o faria mentir sobre a
primeira para relatar a segunda. Erra-se para o lado conservador de propósito.

### 🗺️ ONDE A DÍVIDA MORA — `BLOCKER-vivo` por módulo (205 chaves, medido 2026-07-31)

🔴 **NÃO é o módulo `rides`.** Ele é **29 de 205** (14%). A dívida está espalhada por **43
módulos** e **164 tabelas distintas**. O `rides` só foi o primeiro que abrimos.

| sítios | tabelas | módulo |
|---|---|---|
| 29 | 16 | `rides` |
| 18 | 11 | `marketplace` |
| 11 | 6 | `profile` |
| 11 | 5 | `work` |
| 10 | 6 | `pilot` |
| 9 | 4 | `human-mvp` |
| 7 | 7 | `observability` |
| 7 | 4 | `memory` · 7·3 `organization` · 7·5 `presence` |
| 6 | 4 | `loyalty` |
| 5 | 3-4 | `events` · `reporting` · `reputation` · `cultural` · `payments` · `venue` |
| 4 | 2 | `payout` · `policy-engine` |
| 3 | 2 | `publication` · `care` · `contextual-messaging` |
| ≤2 | 1 | **26 módulos** — `notify` · `agreements` · `evidence` · `invoicing` · `subscriptions` · `votes` · `automation` · `unifybank` · `bank` · `companies` · `social` · `media` · … |

**A forma da dívida importa mais que o total:** 7 módulos concentram ~46% dos sítios, e
**26 módulos têm 1 ou 2 sítios cada** — cauda longa, mecânica de conter.

**A unidade de trabalho NÃO é "205 sítios" nem "164 tabelas". São 43 decisões de módulo**, e
cada uma é a mesma pergunta binária: *este módulo é produto vivo?*
· **vivo** → materializar as tabelas a partir do `migrations_archive`, forward-only, frente
  própria com GATE (é ressuscitar desenho arquivado — nunca "criar a casa para caber o caller")
· **não vivo** → conter na borda com 501 nomeado e aposentar o caller
Sem essa resposta, cada tabela vira pesquisa. Com ela, a cauda de 26 módulos é uma fatia só.

### 🧬 AS TRÊS POPULAÇÕES — causas diferentes, remédios diferentes

| classe | quantas | causa | mede-se? |
|---|---|---|---|
| ① tabela AUSENTE, `CREATE TABLE` no `migrations_archive` | **140** | gênesis/REBASE-03 (`705792271`, 2026-02-11): 313 migrations arquivadas, schema refeito, **o código que as usava ficou**. Zero ambíguas — todas têm DDL no archive e nenhuma nas migrations atuais | ✅ pelo gate |
| ② tabela que **nunca existiu em lugar nenhum** — nem no archive | **~21** | 🔴 **DESCONHECIDA.** Não é dívida de migração. Nunca investigada | ✅ pelo gate |
| ③ tabela **EXISTE**, re-materializada no formato canônico, caller nunca convergido | **?** | ex.: as 14 tabelas vivas de `rides` — PK virou `id`, valores viraram `_cents`, vocabulário virou governado; o módulo ainda pede `driver_id`, `base_fare`, grava `level='bronze'` contra CHECK que aceita standard/silver/gold/platinum | 🔴 **NÃO** — o gate mede existência de tabela, não forma. Invisível. Sem medição |

⚠️ **Números NÃO remedidos nesta sessão:** contagem total de DTs abertas · estado da PORTA-01.

## 🔢 QUANTAS DTs EXISTEM — medido 2026-07-30, com o denominador declarado

| medida | valor | o que significa |
|---|---|---|
| IDs `DT-*` distintos na história do cartório | **556** | tudo que já foi nomeado como dívida, desde sempre |
| IDs `F-*` distintos (frentes, não dívidas) | 113 | campanhas, não débitos |
| `DT-*` **sem marcador de fechamento no cabeçalho** | **314** | varredura estrita — **teto**, não realidade |
| 🔴 **VIVAS E DEMONSTRADAS hoje** | **10** | alguém provou que quebra. **É este o número acionável.** Foi 7 → 11 após a auditoria Yala (2 reclassificações derrubadas + 1 divergência FE + 1 nova) → **10** com `event_custody` contida no mesmo dia |
| superfície contida (`501`) | **125** em 50 arquivos | **1 só declara prazo** — ver `DT-CONTAINMENT-WITHOUT-DEADLINE` |

> ### 🧭 REGRA DE DECISÃO — quando conter, consertar ou apagar (Clayton, 2026-07-30)
> A direção recomendou **conter** o `service_bookings` "seguindo o precedente do repo". Clayton
> devolveu: ***"contenção não é adiar o problema?"*** — e estava certo. A medição que veio
> depois deu razão a ele: **125 contenções, 1 prazo.**
>
> **Contenção NÃO é a resposta padrão. A pergunta que decide vem antes:**
>
> | a funcionalidade é pedida? | resposta |
> |---|---|
> | **sim** — há tela/API chamando | **CONSERTAR.** Conter aqui mata produto vivo |
> | **não** — nada chama | **APAGAR** (exige autorização de Clayton, CLAUDE.md §5) |
> | **não se sabe ainda** | conter — **com PRAZO e DONO**, nunca sem |
>
> 🔴 **Contenção sem prazo é abandono com status code melhor.** E o `REBASE-03` prova o custo:
> foi a maior contenção da história do projeto, sem prazo, e a conta chegou hoje.
| allowlist do gate (`C-*`) | 2 | `C3` e `C13`, prazo 2026-09-30, dono Clayton |

> ### ⚠️ POR QUE "314" NÃO É A RESPOSTA
> **O inteiro exato não é derivável por query, e isso já foi auditado** (Fable 5, 2026-07-06):
> o cartório fecha DT de formas heterogêneas — `CLOSED` · `CONTAINED` · `CONTIDO` · `FROZEN` ·
> `501` · tombstone · **fechamento no corpo sem re-carimbar o cabeçalho**. Na época a varredura
> estrita deu **301** e a reconciliação manual deu **~156**. Hoje a estrita dá **314**.
>
> **A diferença entre 314 e ~156 não é dívida: é convenção antiga.** Contar cabeçalho conta
> duas vezes o que foi fechado sem re-carimbo.
>
> 🔴 **Por isso o número que dirige o trabalho é o de VIVAS E DEMONSTRADAS**, não o histórico.
> 556 mede quanto o projeto já nomeou; 8 mede o que está quebrado agora.

## 🗓️ REGISTRO DE SESSÕES — o que cada fatia mudou no placar

### 🟢 SESSÃO 2026-08-06 — VALIDADE DO ORÇAMENTO · leitor único, expiração preguiçosa

`runner 259 → **260 OK**` · `tsc BE 0` · Δbank 0 · **zero migration**. Fatia ② da sequência.

**Duas metades, e o guard exige as duas:** **DERIVAR** na leitura (`isQuoteExpired` — `isExpired`
viaja na projeção; **`expirado` nunca é gravado**, porque gravar exigiria worker, e worker que não
roda produz vencido que o sistema jura estar vivo) e **IMPOR** no aceite (`assertQuoteUsable` dentro
do `choose` — derivar sem impor deixa a tela honesta e o motor permissivo).
`409 QUOTE_EXPIRED`, com **D2** na mensagem: vencido **morre**, não renova — renovar faria o
histórico mentir sobre o que o cliente viu quando decidiu.

**Prova 16/16** (seção F nova): vencida **derivada** · **o banco não gravou nada** (`status` segue
`pending`) · aceite de vencido **recusado** · 🔴 **orçamento vivo continua aceitável** (a metade que
não grita). O envelhecimento é feito **pelo banco**, não mexendo no relógio do processo.

**🛡️ `audit-quote-validity-single-reader.mjs`** — vermelha **5/5**. ⚠️ **Falso positivo corrigido na
hora, e a correção é a lição:** a v1 mordeu `actor_delegations.expires_at > NOW()` num seed —
**outro domínio, outra regra**. `expires_at` é nome comum no schema. **Escopo por DOMÍNIO, não por
nome de coluna.**

**F1 fechada no backend** (substrato ✅ · writer ✅ · validade ✅). Falta a **superfície**
(`DT-QUOTE-RESPONSE-UI-MISSING-OFFER-PICKER`) e o ciclo da declaração, que depende da F2.

### 🟢 SESSÃO 2026-08-06 — ROLLUP GENERALIZADO · **a agenda pessoal virou contratável** · corrida PROVOCADA

Execução material da `DECISION-0196 §D.1`. **Zero migration.** `runner 259 OK` · `tsc BE 0` · Δbank 0.

`confirmBookingWithProviderLock` filtrava `owner_type='service_offering'` e **para `user` não achava
conflito nenhum** — por isso o `501` teve de ficar de pé mesmo com a decisão tomada. Agora o rollup
atravessa as **duas** superfícies temporais do provider (`LEFT JOIN`, para a linha de `user` não ser
descartada). **Um corpo, uma agenda** — `0146 §A.3`.

🔴 **A DÍVIDA DE CORRIDA VENCEU AQUI.** A sessão inteira declarou *"nenhuma corrida provocada"* como
limite honesto. Esta fatia mexe na **única trava de exclusividade viva**, e a `0146 §A.8/G7` exige a
prova. `npm run validate:personal-agenda-exclusivity-race`, `Promise.allSettled` sem `await` entre as
chamadas: **R** sobrepostas → **exatamente UMA** confirmou, recusa nomeada, **banco com 1** sem
meia-escrita · **S** sem sobreposição → **as duas** confirmaram · **T** back-to-back → **as duas**
(G8, `[start,end)`).
**S e T são a metade que não grita** — sem elas, uma trava que barrasse todo mundo passaria verde.

**Guard +3 checagens por substância** (cláusula de `user` · `LEFT JOIN` · ramo no service),
**vermelha 3/3**. ⚠️ E o **cabeçalho do próprio guard virou mentira em 24h** (*"cobre APENAS
service_offering"*, *"confirma sem trava"*) — corrigido com errata dentro do arquivo. **Artefato que
descreve estado envelhece toda vez que o estado MELHORA.**

**Estado:** `user` **contratável** · `page` **segue 501** (correto pela `R1` — a empresa agrega) ·
`actor_asset`/`service_offering` provados não-regredidos.

### 🟢 SESSÃO 2026-08-06 — `F-SERVICE-DEMAND-QUOTE-LIFECYCLE` · **substrato da F1 (GO de Clayton)**

**`DECISION-0196` promulgada** (`docs/02_decisions/DECISION_0196_SERVICE_DEMAND_QUOTE_LIFECYCLE.md`) —
o primeiro ato foi **nomear a frente e escrever as decisões**, porque decisão que vive só no chat não
existe para a próxima instância. Migration `20260806120000` aplicada.
`runner 259 OK` · `tsc BE 0 / FE 0` · Δbank 0 · canários intactos · migrations 571 → **572**.

**Entrou:** `expires_at` (`NOT NULL`, **sem default de banco** — o default é da ESCRITA, 7 dias) ·
`offering_id` **XOR** `asset_id` com CHECK · `target_actor_id` (NULL = broadcast). **Prova 11/11** em
efêmera, nos dois sentidos, incluindo o **writer vivo**.

🔴 **A migration quase deixou uma REGRESSÃO:** `expires_at NOT NULL` sem default, e o writer
`createResponse` não o preenchia — **`POST /demands/:id/respond` daria 500 em toda resposta**. Zero
linhas afetadas, mas o caminho vivo estaria quebrado. **A fatia teve de incluir o writer.**
*Schema provado ≠ caminho vivo provado.*

🔴 **Três correções medidas ao pacote de recomendação** (adotei o pacote, não as suas falhas):
a FK **não** é só de `service_offerings` — os 2 donos de `actor_assets` têm **zero** oferta ativa, e a
FK singular expulsaria a metade locação que a `0164 ADENDO 5(c)` promulga · a atomicidade do `D7`
**custa refatorar três métodos** (dois não aceitam transação externa) · o lock de `user` **não é reuso
direto** (a checagem é escopada a `service_offering`), então o **`501` de `user` PERMANECE** até a
generalização do rollup, com prova de corrida.

🔴 **A norma venceu o rascunho no NOME:** o plano pedia `valid_until`; `07_NOMENCLATURA §4.6` exige
sufixo `_at`. Adotado **`expires_at`** — canônico e já vivo no repo. Não se cria a 34ª violação para
obedecer a um rascunho.

🆕 🟡 **`DT-QUOTE-RESPONSE-UI-MISSING-OFFER-PICKER`** — o vão que esta fatia **abre e não fecha**:
`§B.4` passa a exigir `offeringId`/`assetId` ao responder demanda de **orçamento**, e o frontend
manda só `quoteCents` (`OpportunitiesPage:73`) ⇒ **400 nomeado**. **Hoje não quebra nada (0 demandas)**,
mas é botão que falha na primeira. **Dono:** esta frente. **Gatilho por query:**
`SELECT count(*) FROM service_demands WHERE pricing_mode='orcamento'` > 0. É a **próxima fatia da F1**.

### 🟢 SESSÃO 2026-08-06 — `F-WINDOW-RENDER-TRUTHFUL-EXTENT` · fricção de uso do Clayton

`runner 258 → **259 OK**` · `tsc BE 0 / FE 0` · Δbank 0 · zero migration.

**Ele apontou:** *"o 'Solicitar orçamento' da Tenda oferece uma janela — 04 de ago. 08:00–18:00. A
única opção já passou."* **A leitura estava certa; a tela é que mentia.**
A janela vai de **2026-08-04 08:00 a 2026-09-03 18:00 — 30,4 dias, válida por mais 28**.
`janelaLegivel` imprimia a data do **início** e as duas **horas**, descartando a **data do fim**.

🔴 **O BACKEND ESTÁ SADIO** — `event-need-supplier-discovery.service.ts:680` filtra
`end_datetime >= now()`. **Não mexa no filtro.** O defeito era só de projeção.
⚠️ **Não era borda: 56 das 70 janelas (80%) são multi-dia.**

**Família de 4, e o 4º o grep não achou:** `QuoteRequestDialog` (o que ele viu, dado real) ·
`EventCheckoutModal` e `CulturalEventCard` (mesmo defeito, **0 caso observável** — `events` sem
multi-dia; correção **lógica, não verificada visualmente**) · 🔴 **`ActorPage.formatWindow`, achado
pelo GUARD** — usa `Intl.DateTimeFormat`, então meu grep por `toLocaleTimeString` passou por cima.
**Grep acha o que eu já sei procurar; guard por substância acha o que eu não sei.**

**🛡️ `audit-window-render-truthful-extent.mjs`** (novo, no runner no mesmo commit). Exige comparação
de DIAS onde a hora de um FIM é renderizada; detecta inclusive pela **assinatura** (par início/fim).
**Duas correções do próprio guard, na prova:** falso positivo em `validateDateRange` (validador, não
renderizador → passou a exigir que o arquivo também **formate**) e 🔴 **furo achado pela vermelha** —
renomear um parâmetro fazia o guard **perder um alvo em silêncio**; ganhou **PISO `MIN_SITES=4`**
(ratchet, só sobe). **Vermelha 5/5**, desfeita por BACKUP, restauração byte a byte.

### 🟢 SESSÃO 2026-08-06 — `F-CONFIRM-THIRD-BRANCH-STOP` · **EXECUTADA (GO de Clayton)** · reversão pura

`runner 258 OK` · `tsc BE 0 / FE 0` · **Δbank 0** · **zero migration, zero decisão nova**.

**✅ FECHADA — `DT-CONFIRM-THIRD-BRANCH-NO-LOCK`** (viva desde 2026-06-21). O bloco de confirm tinha
2 ramos com advisory lock e um **terceiro que caía fora e confirmava com `UPDATE` simples**. O
comentário dizia *"G10 […] confirma normal"*; a **G10 diz `STOP_DECISION_REQUIRED`** — *"para (não
adivinhar o recurso)"*. **Norma mandava parar, código passava, guard carimbava.** Agora lança
`501 BOOKING_CONFIRM_STOP_DECISION_REQUIRED`.

⚠️ **Consequência declarada:** agenda de `user`/`page` **deixa de ser contratável** até se decidir
qual é o recurso de exclusividade dela. **Custo hoje = 0** (0 bookings alcançados) — por isso a
reversão foi barata agora. **Destravar não é remover o STOP: é decidir o recurso.**
📌 **E o alcance era maior que "page, 8 janelas":** `PUT /availability/weekly-template` aceita
`{user, page}` com **`user` como DEFAULT** — o terceiro ramo era o comportamento **padrão** da
agenda pessoal.

**Guard por SUBSTÂNCIA:** `audit-booking-provider-conflict.mjs` recorta o bloco de confirm por
**balanceamento de chaves** e exige que **o último `throw` venha depois do último `return`** — pôr o
STOP dentro de um `if`, ou acrescentar um 4º ramo que escapa, **morde**. Não é presença de string.
**Vermelha 2/2**, desfeita por **BACKUP** (nunca `git checkout`), restauração byte a byte.

**🔴 E prova de COMPORTAMENTO, porque guard estático não basta** (`validate:confirm-third-branch-stop`,
efêmera, **3/3**): o STOP **dispara** (501) · o booking **permanece `requested`** (fail-closed sem
meia-escrita) · **`actor_asset` CONTINUA confirmando** — *trava nova é tão capaz de bloquear quem
pode quanto de liberar quem não pode, e só a segunda falha grita.*

**🧹 Achados de carona, nomeados e não consertados de afogadilho:** `@core/errors` tem **duas casas**
(`errors.ts` e `errors/`) e **o arquivo vence** — o `HttpError` da pasta é inalcançável por esse
specifier; `tsc` me pegou, deixei migalha no import · o header do harness novo **nasceu mentindo**
(copiado da fatia anterior), corrigido antes de rodar — *copiar harness propaga descrição, não só
código*.

### 🟢 SESSÃO 2026-08-06 — `F-RENTAL-EXCLUSIVITY-GUARANTEE` · **EXECUTADA (GO de Clayton)**

`runner 258 OK` · `tsc BE 0` · `tsc FE 0` · **Δbank 0** · canários **75·48·3** intactos ·
`schema_migrations` **570 → 571**.

**✅ RESOLVIDA — `DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION`.** A regra
`resource_type='equipment' OR quantity=1` **passou a viver em `actor_asset_rental_terms`**
(migration `20260806010000`), que é de onde `confirmBookingWithResourceLock` lê a capacidade.
Sem backfill — o dado já conformava. Prova em efêmera **7/7 nos dois sentidos**
(`npm run validate:rental-exclusivity-guarantee`).

**✅ RESOLVIDA — `DT-AVAILABILITY-DECLARATION-HARD-BLOCK-VS-ART-II`.** Saíram **as duas metades**: a
`EXCLUDE availability_rental_no_overlap` (banco) e o 409 de aplicação em
`createAvailability`/`updateAvailability`. Cumpre `ART. II` · `0146 §A.1/§A.7/G1` **sem emenda
constitucional** — o GATE-pequeno provou que a trava do COMPROMISSO é **15 dias anterior** e cobre a
impossibilidade física.

**✅ RESOLVIDA — `DT-GUARD-PINS-GUARANTEE-TO-DEAD-VOCABULARY-AND-BLOCKS-FIX`.**
`audit-rental-hardening-constraints.mjs` v2: **dinâmico** (confere no catálogo do banco, por
**substância**, não por nome) · **banco indisponível = FAIL** · morde ao **INTRODUZIR** EXCLUDE
(o sentido que a `G1` pede), não ao remover · **declara o alcance real** na mensagem de sucesso.
**Prova vermelha 4/4** nos dois ramos novos.

> ### 🔴 ESTA FATIA NÃO CONSERTA EXPOSIÇÃO — ELA RESTAURA PROFUNDIDADE
> Eu disse *"`quantity=10` num `vehicle` faz o confirm aceitar 10 reservas do mesmo carro"*.
> Verdadeiro sobre o **banco**; medido depois no **código**: os **dois** caminhos de escrita validam
> (`service.ts:92-96` e `:780-786`) e o seed usa o writer canônico. **Não havia superfície
> alcançável.**
> **Quem for medir o risco depois precisa desta distinção:** lido como *"fechamos um buraco"*,
> conclui-se que o sistema esteve exposto de 08/07 até agora — **e não esteve**. Lido como
> *"restauramos profundidade"*, chega-se ao certo: o sistema dependia de **uma** camada onde o
> desenho previa **duas**.
> 📌 O achado já estava publicado quando fui medir o código. `referência não é alcance` desceu sobre
> o meu próprio achado e o **rebaixou** — achado grande costuma ganhar peso, este perdeu, e perdeu
> porque foi remedido.

**🔴 O RUNNER ME PEGOU TRÊS VEZES, e as três valeram:** fixture irreal 3× (inclusive **adivinhando o
vocabulário** de `identities.kyc_level`) · `audit-schema-coherence-ratchet` mordeu meu teste por
`INSERT INTO actors` fora do writer soberano (**o guard estava certo; a fixture passou a nascer por
`authService.register`**) · o lint de vocabulário financeiro estourou 2× seguidas, a segunda porque
**meu comentário explicando a palavra continha a palavra**. **Nenhuma baseline foi afrouxada.**

**🟡 NOMEADAS, não construídas de carona:** `DT-AVAILABILITY-OVERLAP-ALERT-MISSING` (o resíduo
read-model do Art. II — `findOverlapping` fica **DORMENTE de propósito**, é a semente do alerta) ·
`DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT` (a exclusividade agora repousa só no advisory lock) ·
`DT-DB-GUARANTEE-SWEEP-INCOMPLETE` (**com dono e gatilho** — roda antes da próxima migração de
substrato).

> ### 🧭 REGRA NOVA E GENERALIZÁVEL — **"o `WHERE` prende um ESTADO ou um NOME?"**
> *"Esta garantia alcança o vivo?"* **não basta.** O banco tem **2 `EXCLUDE`** e **as duas alcançam
> 0 linhas** — mas só uma é dívida:
> · `pdv_sessions_one_open_per_actor` prende um **ESTADO** (`status='open'`) → 0 hoje, alcança
>   amanhã. **SADIA — não mexa.**
> · `availability_rental_no_overlap` prendia um **NOME** (`owner_type='rentable_resource'`)
>   aposentado → 0 **para sempre**. **DÍVIDA.**
> **Estado volta; nome aposentado não volta.** Com a bússola de um eixo só, eu teria "consertado" a
> `pdv_sessions` — destruindo uma trava correta. Vale para toda varredura de garantia de banco.

### 🟠 SESSÃO 2026-08-05 (noite, 3ª rodada) — GATE-PEQUENO + VARREDURA · **READ-ONLY, nada movido**

**A pergunta que destravou tudo:** *"o bug de 08/07 quebrou o quê, e o bloqueio do CONFIRM teria
prevenido?"* → **SIM. E não "teria": já prevenia, desde 15 dias antes.**
`confirmBookingWithResourceLock` + `RENTAL_RESOURCE_TIME_CONFLICT` nasceram em **2026-06-23**
(`6359d31cc`); o bloqueio de DECLARAÇÃO em **2026-07-08** (`f43a78e2c`).
E a migration do MESMO dia mediu o dano: *"recursos vivos NÃO estão sobrepostos: **overlap real=0**"*
— as 8 janelas sobrepostas eram **órfãs de smoke**.
⇒ **EMENDA CONSTITUCIONAL NÃO É NECESSÁRIA.** Art. II e `0146 §A.1/§A.7/G1` se cumprem **removendo**
o bloqueio da declaração, não emendando a norma. Resta só o resíduo de **read-model** (duas janelas
sobrepostas confundem a projeção) — e a resposta canônica é `FATO→ALERTA→humano`, alerta que **não
existe**.

| DT | o que é | grau |
|---|---|---|
| 🆕 `DT-GUARD-PINS-GUARANTEE-TO-DEAD-VOCABULARY-AND-BLOCKS-FIX` | `audit-rental-hardening-constraints.mjs` **exige** (`:36`) o `WHERE owner_type='rentable_resource'` — **mover a garantia para o substrato vivo faz o guard FALHAR**. Não é guard desatualizado: **é guard que reprova o conserto.** E morde ao **REMOVER** a `EXCLUDE`, quando `0146 G1` prescreve morder ao **INTRODUZIR** — norma e guard em sentidos opostos sobre o mesmo objeto. É **estático**: prova que o texto existe, não que protege linha | 🔴 bloqueia conserto |
| ⬆️ `DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION` **reclassificada** | eu a chamei de *"trava que não protege nada"* — soa decorativa. **É load-bearing.** A regra `resource_type='equipment' OR quantity=1` ficou em `rentable_resources` (0 linhas) e **não migrou** para `actor_asset_rental_terms` (4 linhas), que é **de onde o confirm lê a capacidade** (`repository.ts:490`). **`quantity=10` num `vehicle` faria o confirm aceitar 10 reservas do MESMO carro.** O dado vivo respeita a regra **por sorte** (Fiat Argo `vehicle` qty 1), não por trava | 🔴 estrutural → **caminho de exclusividade** |

**🧭 A BÚSSOLA REFINADA PELA MEDIÇÃO — vale para toda varredura futura:**
o banco inteiro tem **2 `EXCLUDE`**, e **as duas alcançam 0 linhas** — mas **só uma é dívida**.
`pdv_sessions_one_open_per_actor` prende um **ESTADO** (`status='open'`): 0 hoje, alcança amanhã, é
**sadia**. `availability_rental_no_overlap` prende um **NOME** (`owner_type='rentable_resource'`)
que foi **aposentado**: 0 **para sempre**, é **dívida**.
🔴 **"Alcança o vivo?" não separa as duas. A pergunta que separa é: o `WHERE` prende um ESTADO ou um
NOME?** Com a bússola só de alcance, eu teria "consertado" a `pdv_sessions` — estragando uma
garantia correta.

**Varredura:** ✅ exaustiva em `EXCLUDE` (2) e em CHECK/EXCLUDE citando `*_type` literal (18).
❌ **não varridos:** triggers, FKs, índices únicos parciais por `status` (centenas). **`?`, não `0`.**
⛔ **Nada movido** — mapear é o mandato; mover com a bússola errada multiplica o erro.

**Migalhas [D]: 2 propostas, 0 escritas** (mandato proíbe editar guard) — inclui
`audit-booking-provider-conflict.mjs:51`, que **atribui à `0146 G10` uma regra que a G10 não diz**.

### ⚪ SESSÃO 2026-08-05 (noite, rodadas 1-2) — GATE F0 `organizacaoevento.md` · **READ-ONLY, 0 commits de código**

**Nada mudou de estado material.** Runner **258 OK** · `tsc` BE **0** · FE **0** · Δbank **0**
(os três remedidos de 1ª mão). Artefato: `docs/04_audit/GATE_F0_ORGANIZACAO_EVENTO_2026-08-05.md`.
Detalhe e provas no cartório (topo).

**5 dívidas NOMEADAS — nenhuma entra em "VIVA E DEMONSTRADA", e o motivo é a errata de 30/07:**
*referência não é alcance.* As cinco estão provadas por **query e leitura**; **nenhuma corrida foi
provocada, nenhum servidor subiu.**

| DT | o que é | grau |
|---|---|---|
| `DT-DB-GUARANTEE-LEFT-BEHIND-BY-SUBSTRATE-MIGRATION` | a `EXCLUDE` `availability_rental_no_overlap` (TRAVA 3, **GO de Clayton 08/07**) cerca `owner_type='rentable_resource'` = **0 linhas**; o substrato vivo virou `actor_asset` (**4 janelas**) horas depois, no mesmo dia, e **a trava não foi junto**. Hoje o dado real é protegido só por check-then-act de aplicação. **Constraint que existe parece proteção** | 🔴 estrutural · irmãos **não varridos** (`?`, não `0`) |
| `DT-AVAILABILITY-DECLARATION-HARD-BLOCK-VS-ART-II` | o **409 de aplicação** (`unified-availability.service.ts:93-100`, todos os owner_types) bloqueia a DECLARAÇÃO — `ART. II` e `0146 §A.1/§A.7/G1` mandam `FATO→ALERTA→humano`. **Zero cartório, zero decisão, zero guard** (3 greps). ⚠️ metade irmã (a `EXCLUDE`) **é ratificada** e vira reconciliação de norma | 🔴 norma × código |
| `DT-TWO-EMPTY-QUOTE-ENGINES-NORM-CONTRADICTS-ITSELF` | `service_demand_responses.quote_cents` (tabela, 0 linhas) **e** `events.metadata.rfqs[].quotes` (jsonb, 10 rotas vivas sob `FEATURE_RFQ_ENABLED=true`, **0 rfqs em 8 eventos**). `0164 D1` rejeitou jsonb *"não indexa"*; `0164 ADENDO 6(c)` manda compor do jsonb | 🔴 norma × norma |
| `DT-DEMAND-MODULE-SEALED-REOPENED-AS-LOOSE-PATCH` | re-selo YALA de 07/07 (cartório `:13026`): *"módulo `demands` está FECHADO — reabertura só por frente nomeada `F-SERVICE-DEMAND-*`, **não patch solto**"*. O `organizacaoevento.md` o redesenha e **não cita a 0164 nenhuma vez** | 🟠 rito |
| `DT-DEMAND-AGENDA-MIRROR-PHASE2-WITHOUT-DEADLINE` | `hasScheduleConflict` decide agenda lendo `service_demand_responses`, não `availability`. **É contenção DECIDIDA** (cartório `:13083`, *"espelho na Agenda universal = fase 2 nomeada"*) — **sem prazo e sem dono**. Família `DT-CONTAINMENT-WITHOUT-DEADLINE` | 🟠 contenção |

**🔴 DUAS RETRATAÇÕES DA DIREÇÃO, ambas do mesmo dia e da mesma família:**
· afirmei que a trava de overlap **não era `EXCLUDE`** e tinha **zero ratificação**. Rodei
  `pg_constraint … AND contype='c'` — **filtro mais estreito que a afirmação** — e greppei pelo
  **código de erro** em vez do **nome da constraint**. A `EXCLUDE` existe, tem GO e tem cartório.
  *Procurar pelo nome que EU uso não prova ausência.*
· chamei `hasScheduleConflict` de violação constitucional **sem procurar ratificação** — ela existe.
  **No mesmo documento eu procurei para um achado e supus para o outro.**

**⚖️ Registrado como CERTO, de propósito** (impede a próxima instância de "consertar"):
`POST /demands/:id/respond` **valida autoridade** (`canRepresentActor` fail-closed antes do service;
`provider_actor_id` nunca vem do body; 404 para fora-da-plateia) · `fillSlot` é **UM `UPDATE` com o
predicado no `WHERE`** — zero TOCTOU no contador (⚠️ o *par* `fillSlot`+`createResponse` é
**compensado**, não transacional — já nomeado em 07/07) · `audit-demand-orchestration-boundary.mjs`
**já vigia** o módulo: nenhum guard novo foi construído.

**Hipótese da direção (*"o 409 do overlap é a solução, garantia de banco > advisory lock"*): CAI.**
Ele é `SELECT`+`INSERT` sem constraint/trigger/lock nos owner_types vivos (**check-then-act**),
agrupa por **oferta** quando `0146 §A.3` exige **provider**, e o banco já mostra **48 pares** de
janelas sobrepostas do mesmo provider em ofertas diferentes onde ele nunca disparou. É **mais fraca**
que o advisory lock, não mais forte.

### 🟢 SESSÃO 2026-08-05 (tarde) — INVENTÁRIO DE `ARQUITETURA/` VIRA BUSCA · 21 commits · runner 246 → **257**

**Método:** Clayton mandou usar o aprendizado da pasta `ARQUITETURA/` para corrigir o sistema. O
inventário de **19 famílias de defeito** de lá virou **busca executável** aqui. Medi **8 famílias**.

**Correção de rumo dele no meio da sessão, e ela mudou o trabalho:** *"Espero que já esteja
corrigindo ao invés de ficar registrando como dívida técnica."* Eu tinha congelado 65 `catch`
permissivos num teto e chamado de "dívida com saída". **Teto é adiamento com data melhor.** Fui pagar.

**🔧 CONSERTADO (produto, não documento):**
· `GET /groups?visibility=secret` **listava grupos secretos** — e fechar a vitrine não bastou: com o
  id, ainda se lia o grupo inteiro, os membros e **os totais econômicos**. `/economy` era a **porta
  dos fundos** de `/balance`. Resposta para secreto agora é **404, não 403** (403 confirma existência)
· **31 regras de negócio** que chegavam como **HTTP 500 em inglês** → erro tipado
· **conta de grupo nunca pôde existir**: 3 queries citando colunas inexistentes; o tipo TS
  **declarava as colunas erradas** e por isso compilava — tipo é afirmação, não checagem
· um `catch { return false }` **abria o portão da fase econômica** (falha de leitura ⇒ "não há
  reserva" ⇒ avança). Os dois pré-requisitos irmãos não engoliam: o engolidor era o ímpar
· `actor_active_location`: prazo **escrito** e **nunca honrado** na leitura
· feed cultural dizia *"não há"* quando estava **quebrado** (tabela ausente ⇒ 200 com lista vazia)
· **8 `catch`** que afirmavam ausência (fornecedor, estoque, coluna de schema) → propagam
· `INSERT` em tabela fantasma a **cada empresa criada**, com comentário mentindo (*"migration pode
  não ter rodado"* — não existe migration)

**🛡️ 5 guards novos**, todos com prova vermelha nos DOIS sentidos: visibilidade de descoberta ·
irmãos de leitura · teto de `catch` permissivo · porta de saída com gatilho · worker com partida ·
tabela com `tenant_id` nasce com RLS.

**🔴 RETRATAÇÕES — defeito que não existe custa igual:**
· *"8 workers com zero callers"* (estava na minha carta E no inventário) é **FALSO**: greps escopados
  em `src/`, e o boot mora em `BOOT.ts` **fora de `src/`**. São **26 de 26 com partida**. Caiu porque
  o banco me desmentiu no meio da medição — `ledger_snapshots` ganhou 3 linhas **enquanto eu contava**
· *"Δbank = 0 em todas as fatias"* lê-se como "o arco não tocou o Bank": ele **escreveu**, uma vez,
  com GO
· eu ia construir guard de tabela-fantasma — **já existia**, mais completo. A pergunta *"onde isso já
  existe?"* vale para **guards** também

**⚖️ O que NÃO fiz, de propósito:** 4 famílias estavam **sadias ou já vigiadas** (descobribilidade
175/175 · partida de workers 26/26 · prazos 12/15 · writer único de evento). Registrar isso é metade
do valor: impede a próxima instância de "consertar" o que funciona.


### 🟢 SESSÃO 2026-08-04/05 — FRICÇÃO DE USO DE CLAYTON · 21 commits · runner 238 → **246**

**Se você é a direção e acabou de chegar:** árvore LIMPA (fora de `backend/estrutura-backend.txt`,
untracked de outra instância) · HEAD `d5c31c771` · **Δbank = 0 em todas as fatias**.

**Método desta sessão:** Clayton navegando e apontando defeito por defeito — *"vamos fazer fricção
de uso (meu) pelo frontend"*. Rendeu mais que varredura: **cada apontamento dele descobriu um
defeito estrutural que nenhum guard pegava.**

| o que ele apontou | o que estava por baixo | commit |
|---|---|---|
| "falta filtrar por data específica" | fronteira devolvia **HTTP 500** com erro do Postgres vazado; `2026-02-31` virava 2 de março em silêncio | `47591cc05` |
| "não tenho interação com o que ela oferece" | contrato dizia `request_quote enabled` com **3 de 3 ofertas não-pedíveis**; motivo `rental_has_no_request_path` era **FALSO** | `858e900fc` |
| "'Ver todos' me joga para fora" | bloco já mostrava tudo (3 de 3, teto 10) e o link prometia mais | `858e900fc` |
| "'para qual evento' é de quem solicita?" | era — mas em **locação o campo era descartado no envio** | `0d36ac617` |
| "não preciso entrar empresa por empresa" | descoberta provava "tem janela", nunca "está livre"; subtração correta existia **ILHADA** | `cb3177fe9` |
| "pense nos dois lados" | caixa de entrada **cega para locação** e **recusando empresa** com 404 | `d5c31c771` |

**Guards novos (238 → 246):** `audit-date-query-param-boundary` (família de 13 rotas, várias no
caminho do dinheiro) · `audit-free-time-single-reader` (casa a **assinatura**, não o nome) ·
`audit-inbox-covers-every-owner-type` (lê o **enum vivo**, não lista paralela).

**🔴 A LEI QUE SAIU DAQUI (Clayton):** *"pense nos DOIS lados — consumir e operar"*. **Quatro** dos
defeitos acima são o mesmo erro: construído só do lado de quem age. Detalhe no cartório.

**⚠️ RETRATAÇÃO DA DIREÇÃO (5ª do arco):** afirmei — inclusive num mandato para a instância de
produto — que o filtro de meia-janela era *"ignorado em silêncio"*. **Era 400.** Derrubado por
pinpoint, e o "conserto" que eu tinha feito em cima da premissa falsa foi **revertido**.

**⛔ O QUE ESTA SESSÃO NÃO FECHOU (é de Clayton):** ratificar R1 (*"agenda é da unidade; empresa
agrega"*) e R2 (mediação) · destravar `0146 §B` (compromisso composto de N agendas — trava clínica,
trator+operador, guincho, obra e o carrinho) · reclassificar `quantity=10` · conceitos ausentes
(`trator`·`escavadeira`·`implemento`) · elo `actor_assets → item canônico`.

### 🔴 EM VOO AGORA — atualizado 2026-08-02

**Se você é a direção e acabou de chegar: árvore LIMPA · ~89 commits no arco · runner 238 ·
12 itens SELADOS por Clayton (fronteira no cartório) · 4 retratações da direção registradas.**

| frente | estado | o que falta |
|---|---|---|
| **🔴 `push` do branch** | **ÚNICO RISCO ALTO** | ~89 commits (3 migrations aplicadas, 2 emendas de norma, 1 selo) num disco só. Clayton digita no prompt: `! git push -u origin rescue-structural` (sem ponto final — a 1ª tentativa veio com ponto e não executou) |
| **SELO (Mandatos D+E)** | ✅ **FEITO** (`df526b427`) | 12 itens selados COM fronteira escrita; 4 ressalvas abertas nomeadas. ~57 commits do arco seguem SEM auditoria — próximo mandato Yala |
| **DETECTOR DE CASE-DRIFT** | ✅ **VIVO no runner** (`f079be6fe`) | lê o banco a cada corrida (195 vocabulários); baseline **55 → 40** com cada descida nomeada; drift NOVO = FAIL na hora. Cauda restante = maioria classificados; pendentes reais poucos (`financial-report` service atrás de rota contida) |
| **Ratificação de Clayton (case)** | ✅ **100% EXECUTADA** | §4.77+§4.78 promulgadas · 3 migrations aplicadas (`actor_debts` · `movement_type` · `alert_type`) · `countOpenAlerts` e reconciliação de reservas deixaram de mentir |
| **Capabilities da PF** | ✅ decisão (A) IMPLEMENTADA (`17b22c466`) | mapa estava VIVO (grep perdeu import dinâmico — 4ª retratação); linha `user` agora concede RECEIVE_FUNDS com a decisão citada. As 4 fontes concordam |
| **Reputação por participação** | 🗺️ mapeada, fatia própria | `getStats` morre em tabela fantasma (`event_participants`) + coluna fantasma + vocabulário sem sucessor (`LEFT_EARLY`). Morto desde o gênesis, não urgente |
| **`trust_profiles`/payout duplicado** | aguarda GO | remover a checagem morta de `validatePayoutEligibility` (deleção em caminho de dinheiro = ato de Clayton). O gate canônico `requireFinancialRiskClearance` já protege |
| **Escrow (2º ledger)** | 🏁 **FRENTE ENCERRADA** (f1-f4 ✅, 4 GOs de Clayton) | torneira fechada · zero leitores · ilha de UI apagada COM a intenção registrada como herança (`fc5026d1e`) · 11 rotas aposentadas em 501 `SECOND_LEDGER_RETIRED` (9ª superfície do guard) · service/repository dormentes cercados · tetos colhidos de carona: vocabulário 3883→3881, query-param 177→175. A custódia REAL nasce com a PORTA-01, herdando a intenção do cartório |
| **Eventos ponta a ponta** | ✅ construído+provado em efêmero | contagem real segue 0 — publicar evento REAL é dado de produto (ato de Clayton, de preferência pela tela) |

**Paradas com Clayton:** push · publicar 1 evento · 59 órfãs de `availability` (dado; medição
mente 8×) · cadáveres de FRONTEND (2 componentes de métricas + `EventCheckout.tsx` — órfãos por
RENDER, confirmados; deleção = ato dele) · emendas dos ponteiros quebrados das normas (§1 do
relatório da instância; direção pode redigir, ele ratifica).

---

**2026-08-01→02 · ~30 commits, o maior arco da recuperação. Detalhe no cartório (topo).**

| tema | efeito no placar |
|---|---|
| funil de publicação de eventos religado (3 elos + `new Date(null)`) | vertical eventos DEMONSTRÁVEL |
| 5 fatias de contenção (9 módulos · 3 payout readers · 3 métricas · financial-report) | 7 rotas sob guard anti-reabertura |
| case: 9+3 enums + `event_reservations` + `payment_transactions` + `orders` FE | 5 migrations aplicadas em `unificard_dev` |
| bugs silenciosos mortos: caixa PDV R$0 · posts de evento invisíveis · `countOpenAlerts` · reconciliação gritando · SLA morto · home-feed cego | classe inteira sob detector vivo |
| tetos: vocabulário 3884→3883 · query-param 181→**177** · case-drift 55→**40** · runner 232→**238** | só desceram |
| 4 retratações da direção (payout ×2 · availability · capabilities órfão) | todas com errata no cartório |

---

---

**2026-07-30 · 6 commits, 3 DTs fechadas, nenhuma selada.**

| commit | o que era | efeito no placar |
|---|---|---|
| `6414b3404` | ausência de `EXPECTED_DATABASE_NAME` valia como **permissão** para migrar qualquer banco | runner 225 → **226** |
| `090711185` | **proteção de força bruta não existia desde a gênese** — `auth_rate_limit_logs` nunca criada, `catch` devolvia 0 | runner 226 → **227** · migrations 547 → **548** |
| `01c54f53e` | gate escondia a própria lista (`slice(0,5)`); 165 acusações eram bugs dele | gate 1928 → **1802** |
| `c245b6112` | decomposição: as 1928 são **um commit de fevereiro**, não 136 problemas | — |
| `25aa17223` | +6 classes de bug do gate; a correção ingênua teria **cegado 220 escritas** | gate 1802 → **1794** |
| `d1e74cc62` | nove rastreadores → um placar | — |
| `3496f57d4`+4 | `DECISION-0195` — canal unificado de denúncia (17 cláusulas, **não-selada**) | — |
| (este) | balde "sem definição em lugar nenhum" **fechado**: 47/47 adjudicados | — |

**🔴 Categoria nova, e é a que a direção mais quer vigiar: `SUBSTRATO SUBSTITUÍDO`.** Não é
código morto — **é função viva chamando o nome errado**. Achados hoje: `accounts`/`transactions`
(o vivo é `bank_accounts`/`bank_transactions`) · `payout_transactions`/`payment_intent_splits`
(o vivo é `payment_transactions`/`bank_splits`) · `reputation_scores`/`actor_scores`/`reviews`
(o vivo é `actor_reputation`/`trust_score_snapshots`). **Parece fantasma e não é.** Quem
"limpa" apagando o código apaga funcionalidade; quem religa sem trocar o nome liga no vazio.

**Padrão das três dívidas fechadas hoje, que vale mais que os números:** nenhuma gritava.
Ausência de env var passava calada · `catch` devolvia zero calado · `slice(0,5)` cortava
calado. **O sistema não estava mentindo — estava mudo.** É por isso que *"guard que nunca
falha é decoração"* é lei aqui, e por que cada guard desta sessão foi atacado por ângulo
independente antes de ser aceito.

---

## Origem deste documento

**Produzido pela instância especialista DÍVIDAS TÉCNICAS.** Verificação de 1ª mão da direção: `DT-RBAC-V2-…-STRUCTURALLY-DEAD` reconfirmado (cadeia até `RETURN FALSE` na migration, 59 arquivos de rota usando `requirePermission` hoje).

> **POR QUE ESTE PAINEL EXISTE:** o `PLANO_RECUPERACAO.md` abre com o diagnóstico *"o cartório virou memória, não painel executivo"* — sendo append-only, a mesma frente aparece várias vezes com estados diferentes. Este arquivo é o corte transversal que faltava. **É índice, não fonte:** a verdade de cada item continua no cartório e nas normas.

---

## ✅ RESOLVIDO NO MESMO DIA — a Lei que mandava apagar o banco oficial

**`DT-LAW-MANDATES-DROPPING-OFFICIAL-DATABASE`** · achado pela instância GUARDIÃO em
2026-07-30, confirmado de 1ª mão pela direção, **corrigido com autorização de Clayton no mesmo
dia**. A regra passou a nomear **banco EFÊMERO** e a proibir explicitamente o oficial; o
histórico da correção ficou dentro da própria Lei.

⏳ **PENDENTE:** a Lei segue **sem enforcement** — nenhum guard verifica a REGRA DE AMBIENTE.
Invariante proposta: *todo `.ps1` que faz `CREATE DATABASE` declara `EXPECTED_DATABASE_NAME`*
(2 violações reais achadas em 2026-07-29, uma delas quebrando harness). Sem isso, a Lei é texto.

<details><summary>Registro do que a Lei dizia antes (histórico)</summary>

`docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md:196-206` — nível 2 de precedência, abaixo
apenas da Constituição:

```powershell
## REGRA DE AMBIENTE (CRÍTICA)
> OBRIGATÓRIO: Execução de migrations somente em ambiente recriado do zero.

# SEMPRE antes de rodar migrations
dropdb -h localhost -U postgres unificard_dev
createdb -h localhost -U postgres -E UTF8 unificard_dev

Execução fora de ambiente recriado = VIOLAÇÃO
```

🔴 **A Lei NOMEIA o banco oficial.** Um agente **cumprindo a norma** — que é exatamente o que o
protocolo exige dele — destrói:

| dado | medido em 2026-07-30 |
|---|---|
| bairros oficiais de Curitiba (N3 selada, *"NUNCA recarregar"*) | **75** |
| `economic_policies` | **48** |
| `actor_capability_grants` | **3** |
| `regional_fund_accounts` | **1** |

⚠️ **Colide frontalmente com `DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`** (selado em 2026-07-29),
que fez de `unificard_dev` o banco **oficial e protegido**, com trava fail-closed em `migrate.ts`
e no boot. **Duas normas, sentidos opostos, e a mais antiga manda destruir.**

🔴 **NÃO é a direção quem corrige.** Alterar Lei é ato de Clayton. A direção **não editou** a
norma — registrou, escalou e apontou daqui e do `CLAUDE.md`.

**Correção aplicada em 2026-07-30** (autorizada por Clayton): a regra passou a valer para
**banco efêmero**, com proibição explícita do oficial. **Não houve regressão** — `unificard_dev`
tinha 548 migrations acumuladas e os 75 bairros vivos, o que prova que o texto **já não era
seguido**; e a garantia protegida (schema determinístico do zero) é exercida pelos **216
harnesses** e vigiada por `audit-migration-runner-isolation.mjs`, dentro do runner.

</details>

## 🔴 VIVA E DEMONSTRADA — alguém provou que quebra hoje

| ID | O que é | Tipo | Prova |
|---|---|---|---|
| **Gate `schema-coherence` nunca verde** | 🔄 **remedido 2026-07-30: 1928**, não 1978. `scripts/validate-schema-code-coherence.mjs`, cabeado em `backend/package.json:146`, **fora do runner e do CI**. 🔴 **O gate ESCONDE a própria lista** (`slice(0,5)` + *"e mais N"*, linhas 853-874) — não há flag, env nem modo que mostre tudo; auditá-lo exige reescrever o script. 🔴 `CORRUPTOR` reprova igual a `BLOCKER` (`:903-905`), o nome engana. Composição: **1241 (64%) em `backend/src/scripts/`** (harnesses, não superfície viva) · ~80 são **bugs do próprio parser** (`information_schema`, CTE) · ~600 candidatos reais. **"Religar custa ~zero — só wiring" é FALSO** | **CAUSA-RAIZ** de C3/C13 seguirem vivas sem ninguém notar | medido pela direção 2026-07-30 |
| ~~**`DT-RBAC-V2-REQUIRE-PERMISSION-DECORATOR-STRUCTURALLY-DEAD`**~~ | 🔏 **SELADO por Clayton em 2026-07-31** — é **DESENHO**, não dívida. Auditado pela Yala, que **atacou e não derrubou** (executou `pg_get_functiondef`; provou que `SHADOW_DENY_LEGACY_ALLOW` é ruído do `canActAs`, não bypass). ⚠️ **O selo NÃO cobre `requireRole`** — usa `actor_has_any_role`, query real que **CONCEDE** (1 admin, 10 rotas): **segue ABERTO**. Não autoriza tocar na FASE 6 | — | selado |
| ~~**`DT-SOCIAL-IMPACT-BALANCE-UPSERT-42P10`**~~ | ✅ **RESOLVIDA** no commit `66cf49eee` — linha estava desatualizada aqui até 2026-07-30 | — | ver "JÁ RESOLVIDAS" |
| ~~**`event_custody` sem tabela**~~ | ✅ **CONTIDA 2026-07-30** — as 3 rotas que faltavam (`POST /advance` `:2639` · `GET /custody` `:2822` · `GET /split` `:2977`) ganharam o 501 da `DECISION-0190`; **11/11 agora**, verificado pela direção com o mesmo script que achou as lacunas. ⚠️ **NÃO é conserto — é contenção de decisão já selada.** A tabela segue inexistente; religar `economic/v2` exige GO próprio. 🔎 **Bônus:** o `POST /advance` tinha um **segundo** defeito não previsto no pacote — `coluna "status" não existe` em `payment_intents` — agora atrás do 501, **drift de schema NÃO resolvido** | — | Yala achou · executora conteve |
| <details><summary>histórico da derrubada</summary> | ⚠️ **RECLASSIFICAÇÃO DA DIREÇÃO DERRUBADA PELA YALA (2026-07-30), confirmada de 1ª mão.** A direção conferiu o 501 do **POST** `custody` e **generalizou para as 11**. Errado: **`GET /:eventId/economic/v2/custody` (`event.routes.ts:2812`) NÃO tem 501 e NÃO tem `preHandler`** — chama `listCustodiesByEvent` (`:2834`) → `SELECT * FROM event_custody` → tabela inexistente → **500 para qualquer autenticado do tenant**. `event_custody` **É dívida viva** </details> | — | Yala, 2026-07-30 |
| **Painel econômico A-1** | 🔏 **METADE SELADA por Clayton em 2026-07-31:** *"paga mais que o total"* está **REFUTADO** — a Yala refez a aritmética **do zero** com fixtures hostis e a invariante *conserva-ou-lança* sobreviveu. ⚠️ **A outra metade NÃO está selada e segue viva:** policy só-fixa publica limpa e quebra em tempo de PAGAMENTO — **falha tardia**, mitigada pelo aviso de mínimo derivado (`94e825abc`), **não eliminada**. <br>🔄 **CORRIGIDO 2026-07-30 — a alegação estava meio errada, e a metade errada era a que assustava.** ❌ **NÃO "paga mais que o total"**: o resolver lança `CALCULATION_INVALID` quando o split fica negativo (`economic-policy-engine.service.ts:292-298`) — **provado por execução**, 4 cenários. ✅ **Verdadeiro:** policy inválida **publica limpa** e só falha em tempo de PAGAMENTO. ✅ Parte já consertada: a exigência de linha `revenue_share` **saiu** do `if (hasBpsLine)` (`economic-policy-write-validation.ts:209`). ⚠️ **O resíduo não é conserto de código — é DECISÃO**: soma de linhas fixas contra o total **não é validável na escrita**, porque o valor da transação é desconhecido ali. ⚠️ FE **não** reverificado | **FALHA TARDIA**, não perda de dinheiro | provado 2026-07-30 |
| **`C3-actors-insert-fora-writer`** | `identity.service.ts:313` faz `INSERT INTO actors` fora do writer canônico. Alcance hoje **baixo** | CAUSA | `allowlist:8-16` |
| **`C13-bank-reads-fora-modulo`** | ~15 arquivos leem `bank_*` fora de `modules/bank`. Escopo **CRESCEU** em 28/07 | CAUSA | `allowlist:18-26` |
| ~~**`F-EVENT-CREATION-CONTRACT-SWEEP`** (metade-rota)~~ | ✅ **RESOLVIDA 2026-07-31** — os 2 `navigate` passaram a apontar para `/events/:id` (rota real). A executora achou que **um dos dois era MINA, não caminho**: `Step7FinalSummary` só desestruturava `onAdvanceToEconomic`, então `handleStep7Complete` nunca era clicado — o footer fixo só tem Cancelar/Voltar. Corrigidos os dois. Prop renomeada `onAdvanceToEconomic` → `onFinish`; CTA *"Avançar para Fase Econômica"* → *"Ver Evento"*; e o aviso ao usuário **deixou de prometer** *"criar custódia, calcular split e autorizar pagamentos"* — exatamente o que a `DECISION-0190` recusa com 501. Guard `audit-economic-v2-containment.mjs` ganhou cross-check de frontend; vermelha independente da direção pelo **outro** arquivo confirmou. ⚠️ **Validação visual final continua com Clayton** — não há infra de teste de navegador no projeto | — | 2026-07-31 |
| <details><summary>histórico da derrubada</summary> | ⚠️ **DERRUBADA PELA YALA (2026-07-30), confirmada de 1ª mão.** A direção disse *"varredura do `frontend/src` não achou nenhum caller"* — **a varredura foi TRUNCADA** (`Select-Object -First 10`) e a conclusão saiu de lista parcial. Existem **DOIS callers vivos**: `EventCreationGuidedFlow.tsx:399` (botão Finalizar da etapa 7) e `:619` (`Step7FinalSummary`), ambos `navigate('/events/${id}/economic')`. `App.tsx` registra `events/:id` (`:343`) e `events/new` (`:344`), **NÃO** registra `events/:id/economic`, e **não há catch-all** → **TELA BRANCA no fim do fluxo guiado de criação** </details> | — | Yala, 2026-07-30 |
| ~~`F-EVENT-…` (metade-coluna `event_type`)~~ | ⚪ **DESENHO** — reclassificação **mantida de pé pela Yala**: `event_type` órfão é **desenho** (Lei 7, `event.service.ts:188`, F-EVENT-CONCEPT-FIRST-MODEL). ⚠️ Yala mediu migração **parcial**: `event_format_concept_id` em 5/20 eventos, `event_type` em 9/20 | — | — |
| ~~**`DT-ECONOMIC-POLICY-PANEL-FE-BE-DIVERGENCE`**~~ | ✅ **RESOLVIDA 2026-07-31** (`3a3bb3802` + adendo) — `canSubmit` deixou de decidir validade; `sumOk` e `hasRevenueShareAmongBps` deletados; indicador virou **projeção**; a mensagem de 400 do backend é o que a tela mostra. Guard reescrito de **nominal para ESTRUTURAL** (BFS na cadeia de `canSubmit`, tolerância por **contagem**, nunca por nome). `D-B` absorvida: aviso âmbar do mínimo derivado, **sem bloquear**. <br>⚠️ **LIMITE DECLARADO DO GUARD:** a BFS resolve `const <nome> = <expr>`. A direção atacou 2×: `policyLooksValid` (pegou, depois da correção) e **`let ruleOk` (NÃO pegou — passa verde)**. `let`/`var`/função/`useMemo` escapam. O arquivo hoje é 100% `const` (zero `let`), então cobre a forma em uso — **mas quem confiar neste guard como prova de ausência vai errar.** Fix durável = regra de lint sobre AST; **bloqueado: não há infra de lint no frontend** (`eslint` não instalado) | — | 2026-07-31 |
| <details><summary>histórico</summary> | Yala auditou a metade FRONTEND que a direção declarara **não auditada**. `EconomicPoliciesPage.tsx:464` — `sumOk = bpsLines.length===0 \|\| …` e `canSubmit` exige `sumOk`: policy **só-fixa sem `revenue_share` mostra VERDE e é submetível**, e o backend rejeita com 400 (exigência incondicional em `economic-policy-write-validation.ts:209`). **Fail-closed**, mas o painel promete o que o backend recusa </details> | — | Yala, 2026-07-30 |
| 🆕🔴 **`DT-ALERTS-SUBSTRATE-MISSING-BREAKS-ARTIGO-II`** | **A cadeia constitucional do conflito está SEM SUBSTRATO.** `ARTIGO II` exige *conflito → fato → alerta → humano*; `modules/automation/alert.repository.ts` escreve em `alerts` (`:61` INSERT · `:112` UPDATE · `:154,:173,:231` FROM) e a tabela vive **só em `migrations_archive/0850`**. ⚠️ **`financial_alerts` NÃO é substituto** — está em `migrations/0033`, é 800 migrations **mais antiga** e sempre existiu; são coisas diferentes que coexistiram. Achado pela instância GUARDIÃO; a direção havia classificado errado como "estreitamento de domínio" | CAUSA | confirmado 2026-07-30 |
| ~~**`DT-DB-RESET-SCRIPT-TARGETS-OFFICIAL-DATABASE`**~~ | ✅ **RESOLVIDA 2026-07-30** (`3b695efd1`) — recusa fail-closed em duas camadas ANTES de conectar: nome oficial rejeitado + alvo sem `EXPECTED_DATABASE_NAME` rejeitado, reaproveitando `OFFICIAL_DATABASE_NAME`. Direção rodou o script contra o banco oficial de verdade: recusou, `exit 1`, dado idêntico antes/depois (`75 · 48 · 3 · 1`). Guard `audit-environment-rule-enforcement.mjs` no runner | — | — |
| 🆕🔴 **`DT-SERVICE-BUNDLE-READ-ROUTES-NO-AUTHORIZATION`** | **AUTORIDADE.** `service-bundle.routes.ts` tem **4 rotas e ZERO `preHandler`/`requirePermission`**. A checagem (`authorityService.canPerformAction`) vive **dentro do service, só nos 2 POSTs**. Os 2 GETs (`/service-bundles/:bundleId/bookings` `:107` e `/can-confirm` `:129`) filtram **apenas por `tenant_id` + `bundleId`** — **não verificam se quem pede participa do bundle**. Qualquer autenticado do tenant que obtenha um `bundleId` lê os bookings alheios (`serviceId`, `status`). O UUID não é adivinhável, mas **ID opaco não é autorização** — e no fluxo RFQ esses IDs circulam entre atores. Achado pela executora, confirmado de 1ª mão | CAUSA | 2026-07-30 |
| 🆕🔴 **`DT-CONTAINMENT-WITHOUT-DEADLINE`** | **125 respostas `501` em 50 arquivos** de backend (marketplace 22 · eventos 21 · unifybank 7 · companies 6 · profile 5). **De 43 arquivos com 501, apenas 1 declara PRAZO.** Contenção sem data não é contenção — é **abandono com status code melhor**. O `REBASE-03` foi a maior delas: arquivou 313 migrations e adiou a varredura do código; **a conta chegou 5 meses e meio depois** | **CAUSA-RAIZ de processo** | medido 2026-07-30 |
| ~~**`DT-SERVICE-BUNDLE-BOOKINGS-GHOST-TABLE-LIVE`**~~ | ✅ **RESOLVIDA 2026-07-30** — relocação pura, 2 linhas: `getBundleBookings` passou a ler de `bookings` com `metadata->>'serviceId'`. Prova de ida-e-volta 5/5 reexecutada pela direção. Guard `audit-service-bundle-write-authorship-binding.mjs` estendido (§7), vermelha independente confirmada. ⚠️ **CONTER ERA PROIBIDO AQUI — o frontend usa.** `frontend/src/api/service-bundles.ts:100` chama `/service-bundles/:id/bookings`, consumido por `ServiceBundleBookingModal.tsx` e pelo fluxo RFQ (`EventRFQConvertToBundleModal`, `EventRFQQuotesPage`). Funcionalidade **montada ponta a ponta** que devolve 500. **O ÚNICO da cauda do REBASE-03 que NÃO está mascarado.** `GET /services/service-bundles/:bundleId/bookings` (`service-bundle.routes.ts:107-114`) → `getBundleBookings` → `SELECT … FROM service_bookings` (`service-bundle.service.ts:290`). Tabela **não existe**. Módulo registrado em `app.builder.ts:569` (`protectedScope`, prefix `/services`), **ZERO `requirePermission`, ZERO contenção** → **qualquer usuário autenticado recebe 500 (42P01)**. ⚠️ `bookings` (vivo) **não serve de substituto**: não tem `service_id`. Os outros 3 endpoints do arquivo não tocam a tabela | CAUSA | verificado de 1ª mão 2026-07-30 |
| 🆕 **`DT-REPORTS-PREFIX-COLLISION`** | **`/reports` registrado 2×**: `core/reporting` (denúncia) em escopo **PÚBLICO** (`app.builder.ts:257`) e `modules/reports` (financeiro) em **protectedScope** (`:716`). Não quebra o boot hoje, mas `GET /reports/:id` público casa com qualquer segmento | CAUSA | medido 2026-07-30 |
| 🆕 **`DT-REPORTING-CHANNEL-DEAD-PUBLIC-SCOPE`** | Canal de denúncia **100% morto**: fora do `protectedScope`, `preHandler` exige `req.user`/`req.tenant` que só existem lá → **401 sempre**. Atrás dele, 3 tabelas que nunca existiram | CAUSA | `DECISION-0195` (não-selada) |

## 🧨 A CONTENÇÃO QUE SUSTENTA O PESO — `actor_has_permission` e a FASE 6

**Verificado de 1ª mão pela direção em 2026-07-30, contra o `unificard_dev` e o código vivo.**

A função SQL `actor_has_permission` no banco oficial faz **`RETURN FALSE` incondicional**.
Cadeia completa, cada elo lido:

```
fastify.requirePermission([...])        plugins/rbac.plugin.ts:145
  → rbacService.actorHasAllPermissions  core/rbac/rbac.service.ts:165
    → actorHasPermission                core/rbac/rbac.service.ts:173
      → SELECT actor_has_permission()   core/rbac/rbac.service.ts:124
        → RETURN FALSE  (incondicional) unificard_dev, função viva
          → throw forbidden             plugins/rbac.plugin.ts:181
```

**Alcance medido: 176 chamadas em 44 arquivos de rota** (fora de `scripts/`).

🔄 **ISTO É DESENHO, NÃO DÍVIDA.** A própria função documenta: *"FAIL-CLOSED: sem
implementação real de permissões, nenhuma permissão é concedida"*, citando
`AUTHORITY_PRECEDENCE.md §4.4` e nomeando a **FASE 6** como quem substitui. Pela regra do
vocabulário de dívida (*dormente por decisão não é dívida — procure a decisão antes*), a
classificação anterior como CAUSA/dívida viva estava **errada**. Corrigido aqui.

🧨 **MAS É CONTENÇÃO QUE SUSTENTA O PESO, E ISSO É O QUE IMPORTA.** Enquanto ela nega tudo,
qualquer defeito atrás daquelas 44 rotas fica **mascarado**. Caso concreto e provado:
`modules/bank/bank-reconciliation-history.repository.ts:87` faz `INSERT INTO
bank_reconciliation_history` — **tabela que não existe** (0 em `pg_class`, zero
`CREATE TABLE` nas migrations) — alcançável por
`core/unifybank/bank-balance-consolidation.routes.ts:167`, registrada em
`unifybank.module.ts:62` sob `/finance`, exigindo `admin:view_consolidated_balance`, que
**NÃO está** em `PORTA_HOLD_KEYS`. Hoje dá 403 antes do 500. **No dia em que a FASE 6
entregar o RBAC real, isso vira 500 vivo** — junto com o que mais estiver atrás das outras
43 rotas, que ninguém inventariou.

⚠️ Agravante: três harnesses e2e substituem `requirePermission` por um no-op que **libera
tudo** (`validate-pipeline-e2e-events-reputation-locations-ghost-containment.ts:141`,
`...-social-work-payment-ownership.ts:76`, `...-reports-transfers-sla-representation.ts:54`).
É o **fixture que exclui o problema por construção** — a suíte é estruturalmente incapaz de
pegar defeito de autorização nessas rotas.

🔴 **REGRA OPERACIONAL:** **ninguém encosta na FASE 6 do RBAC antes do
`F-SCHEMA-GHOST-REACHABILITY-SWEEP`.** Implementar o RBAC real sem saber o que está atrás
daquelas 44 rotas acende tudo de uma vez, em produção, sem inventário.

## 🟠 VIVA MAS CONTIDA — e **por quê** está contida

🆕 ⚖️ **DECISÃO DE PRODUTO ABERTA — `qual é o recurso de exclusividade da agenda `user`/`page`?`**
(2026-08-06) · **Dono: Clayton.** Não é dívida de código: é decisão que o código está esperando.
**Consequência VIVA enquanto não vier:** a **agenda pessoal não é contratável**. O confirm de
`owner_type ∈ {user, page}` responde `501 BOOKING_CONFIRM_STOP_DECISION_REQUIRED`
(`F-CONFIRM-THIRD-BRANCH-STOP`, reversão ao que a `0146 G10` sempre mandou). **Custo hoje = 0** —
zero bookings sobre essas janelas. **Destravar não é remover o STOP:** é nomear o recurso e dar a
esse `owner_type` a sua trava, como `service_offering`→provider e `actor_asset`→resource já têm.
⚠️ Alcance maior do que parece: `PUT /availability/weekly-template` aceita `{user, page}` com
**`user` como DEFAULT** — é a agenda pessoal do perfil (frente selada `DECISION-0072 B1`).

🆕 🔴 **`DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT`** (2026-08-06) — **a §A.7 está cumprida pela
METADE, e é a metade fácil que foi feita.** A `DECISION-0146 §A.7` faz duas coisas: **proíbe**
constraint forte na DECLARAÇÃO *e* **prescreve** que ela more no COMPROMISSO (*"se houver constraint
forte, ela mira compromisso real de booking"*). A `F-RENTAL-EXCLUSIVITY-GUARANTEE` **tirou da camada
proibida** (`availability_rental_no_overlap` dropada, migration `20260806010000`) e **não pôs na
camada prescrita**: não há **nenhuma** constraint de exclusividade em `bookings`.
**Contido por quê:** `confirmBookingWithResourceLock` (`repository.ts:473`) — `pg_advisory_xact_lock`
+ checagem e gravação na mesma transação. **Funciona, e é garantia de APLICAÇÃO.** Qualquer escrita
que não passe pelo service (script, migration, psql, worker futuro) **não encontra trava nenhuma no
banco**. ⚠️ Não é regressão desta fatia — `actor_asset` nunca teve constraint de banco; o que a fatia
fez foi **tornar o vão visível** ao remover a trava que fingia cobri-lo em outro nome.
**Fatia própria: GATE + GO.** Prova: `SELECT conname FROM pg_constraint WHERE conrelid='bookings'::regclass AND contype IN ('x','u')` → nenhuma de exclusividade.

**Cluster PORTA-1** — contido por **ledger vazio + firewall default-OFF**, *não* por desenho à prova de semeadura. Dentro: sink `executePayment` sem firewall interno (4 callers) · **Core de Aprovação Financeira** com MODEL vivo e EXECUTION HOLD, embora `DECISION-0128` o exija para todo movimento · split-engine stub · **≥8 callers do sink sem firewall** · e o vão `DECISION-0194` selada × código (sem trava de base única, motor ignora `applies_to`, allowlist vazia, agrupador multi-base vivo).

**`DT-BANK-SPLIT-ENGINE-LEGACY-NATIONAL-FUND-LANDMINE`** — 70/3/10/17 num fundo nacional único, sem território. Contido por **tripwire guard**, não por decisão.
**`DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — ⚠️ **é o MESMO defeito que `C13`**, rastreado em dois sistemas.
**`H3` regional-fund-governance** — motor de voto lê fundo nacional legado, não os territoriais. **O comentário MENTE:** alega filtrar por região e a query não filtra.
**`neighborhood` como base de fundo** — HOLD 501 com justificativa **parcialmente vencida** (N3 selou os 75 bairros), mas o resolver nunca foi religado.
Mais: `DT-ACTOR-EFFECT-INBOX-PROJECTOR-UNSUBSCRIBED` · `DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST` · `DT-GROUP-EVENTS-BINDING-DRIFT-SILENT-FAILURE` · `DT-EVENTS-SPRINT76-TICKET-SALE-REPOSITORY-SCHEMA-DRIFT` · `DT-EVENT-ENGINE-NAMING-CONVERGENCE-RESIDUAL`.

## ⚪ DORMENTE POR DECISÃO — **não é dívida**

> ### ⚖️ AUDITORIA YALA — 2026-07-30 · VEREDITO **B** · DUAS RECLASSIFICAÇÕES CAÍRAM
>
> A direção tirou 4 itens da lista viva. Clayton advertiu: *"resolver as dívidas, não varrer
> para debaixo do tapete."* A Yala foi mandatada a **derrubar**, e derrubou **2**:
>
> | item | veredito |
> |---|---|
> | ① RBAC `requirePermission` = desenho | **DE PÉ** — atacou o `SHADOW_DENY_LEGACY_ALLOW` e provou ser ruído esperado, não bypass |
> | ② `event_custody` = dormente | 🔴 **DERRUBADA** — o **GET** custody não tem 501; 500 vivo |
> | ③ Painel A-1 = falha tardia, não perda | **DE PÉ (dinheiro)** — refez a aritmética do zero com fixtures hostis; a plataforma nunca paga a mais |
> | ④ `F-EVENT-SWEEP` = desenho | 🔴 **DERRUBADA na metade-rota** — 2 callers vivos, tela branca. Metade-coluna de pé |
>
> 🔴 **AS DUAS QUEDAS SÃO O MESMO ERRO DA DIREÇÃO — E É O ERRO QUE ELA PASSOU O DIA
> CRITICANDO NOS OUTROS:** em ②, contou 11 rotas e 16 ocorrências da string `501` e
> **generalizou sem abrir as 11**; em ④, rodou um grep com `Select-Object -First 10` e
> **concluiu "nenhum caller" a partir de lista truncada**. Nos dois casos: **amostrou e
> generalizou.**
>
> ⚠️ **Achado adicional da Yala, que o painel omitia:** `requireRole` usa **outra** função —
> `actor_has_any_role` — que é query **real e CONCEDE** (1 admin vivo em `user_roles`, 10 rotas
> usam). A seção *"contenção que sustenta o peso"* descrevia só `requirePermission` e por isso
> **subestima o alcance quando a FASE 6 religar**.
>
> **Não auditado pela Yala (declarado):** backend/HTTP real não subiu — o 500 e a tela branca
> vêm de caminho de código + query real + registro de rotas; ~8 rotas `economic/v2` não foram
> abertas quanto a efeito antes do 501.
>
> ### 🔴🔴 QUATRO DAS SETE ALEGAÇÕES DO PAINEL NÃO SOBREVIVERAM À CONFERÊNCIA (2026-07-30)
>
> | alegação original | o que a verificação achou |
> |---|---|
> | `DT-RBAC-V2` — *"44 arquivos de rota o usam"* | **desenho** — fail-closed documentado, FASE 6 nomeada |
> | `event_custody` — *"500 garantido em qualquer caminho vivo"* | **11 rotas com 501** como primeira instrução |
> | `Painel A-1` — *"paga mais que o total"* | resolver **recusa split negativo**; falha tardia, não perda |
> | `F-EVENT-CREATION-CONTRACT-SWEEP` — rota ausente + coluna órfã | rota **sem caller**; coluna **superada por Lei 7** |
>
> 🔴 **As quatro eram alegações sobre CONSEQUÊNCIA, e as quatro foram escritas parando no
> `INSERT`, na chamada ou na ausência** — sem seguir até o guard, o 501, a validação final ou o
> caller. **Ler até a query prova que a query existe; não prova o que acontece quando ela roda.**
>
> ⚠️ **Isto é achado sobre o PAINEL, não sobre o código.** Uma taxa de 4 em 7 significa que
> nenhuma linha daqui deve virar fatia sem reconferência — e que a coluna "Prova" precisa citar
> **o caminho até o efeito**, não o `arquivo:linha` da query.
>
> ### 🔴 RECLASSIFICAÇÕES — o que saiu da lista viva
> `DT-RBAC-V2-…-STRUCTURALLY-DEAD` e `event_custody sem tabela` estavam listadas como **VIVAS E
> DEMONSTRADAS**. Ambas são **DESENHO**: a primeira é fail-closed documentado, a segunda é
> contenção 501 selada pela `DECISION-0190`.
>
> **As duas tinham alegação de alcance no painel — *"44 arquivos de rota o usam"*, *"500
> garantido em qualquer caminho vivo"* — e as duas alegações eram FALSAS.** Ninguém tinha
> seguido a cadeia até o fim; seguiram até o `INSERT` e pararam.
>
> ⚠️ **"Referencia tabela que não existe" não é alcance. Alcance é rota registrada, sem 501 e
> sem deny antes da chamada.** Enquanto o painel não separar as duas coisas, ele vai continuar
> inflando o número que dirige o trabalho — e fatia gasta em dívida inexistente é fatia que não
> foi gasta na real.

Migration N1 `20260713140000` (`IGNORED_MIGRATIONS`) · `group_actor_memberships`/`group_institutional_bindings` (D9.2-A selada; cutover = D9.2-B) · **4e** `tax_reserve` (firewall OFF, caller 0) · `economic/v2` 501 (`DECISION-0190` selada) · **B-CITY-2** (aguarda GATE registrado) · `/cta` + `social_ledger` (hard-block por desenho) · semear saldo (Clayton: *"só mecanismo por ora"*) · L2.4 (adiada por Clayton) · `DECISION-0192/0193` (não-seladas — doutrina pendente, não dívida de código).

## ✅ JÁ RESOLVIDAS — não reabra

**2026-08-05 · `DT-AI-MEMORY-NON-ATOMIC-WRITE`** — `saveMemory` fazia `writeFileSync` **direto no arquivo final**: processo morto no meio deixava JSON **truncado**, e o leitor encontrava corrupção que a própria escrita produzia. **Sobreviver ao corrompido sem parar de produzi-lo é meio conserto** — alguém acabaria investigando infraestrutura por defeito de código. Agora grava em temporário e **renomeia** (atômico: ou o antigo inteiro, ou o novo inteiro). Falha limpa o temporário e **propaga**. Prova de 1ª mão 5/5 no par leitor+escritor.

**2026-08-05 · `DT-AI-MEMORY-CORRUPT-READ-DESTROYS-HISTORY`** — `loadMemory` devolvia `[]` em arquivo CORROMPIDO (o `existsSync` acima já tratava "não existe"), e `saveMemory` faz `writeFileSync` do array inteiro: **uma leitura com falha SOBRESCREVIA todo o histórico**, sem erro e sem log. Vivo via `ai.routes.ts`. Agora **preserva** o arquivo corrompido com carimbo e segue com `[]`; se preservar falhar, **propaga** — continuar ali destruiria o original. ⚖️ O teto de `catch` permissivo **não desceu (11/11)** de propósito: ele conta a FORMA, e abrir exceção para melhorar métrica é ganhar verde sem ganhar sistema.

**2026-08-05 · `DT-GROUP-PARALLEL-BALANCE-OUTSIDE-BANK`** (migration `20260805190000`, GO de
Clayton) — `group_accounts.balance_cents` guardava valor **ao lado** de `bank_account_id`, que já
aponta para a conta do Bank: dois lugares afirmando quanto um grupo tem. Contradizia
`CONTRATO_GRUPOS_V2` §2.1 e `SSOT_EXCLUSIVE_BANK_RULE`. GATE antes de escrever: 0 linhas, 0 valores,
**zero leitor e zero escritor**. A tabela **continua** existindo — é o MAPA grupo→Bank, formato
certo. 🔒 **Não pode renascer:** `EVENT TRIGGER` recusa reintroduzir a coluna (testado no banco
oficial após aplicar). Varredura completa: das 3 colunas de saldo fora de `bank_*`, só esta era
violação — `ledger_snapshots` é **projeção** (`SUM(crédito−débito)` do `bank_ledger`, verificado na
query do worker) e `impact_balances` é **pontuação derivada** (`Math.min(10, amountCents/1000)`).

**2026-08-05 · `DT-SEED-MARKS-PRODUCTION-DATA-AS-DISPOSABLE`** — `seed-complete-draft-events.ts`
**carimbava eventos que JÁ EXISTIAM** com `completed_by_seed`, e `cleanup-demo-event-supply.ts`
apagava por esse carimbo. **Dado de produto virou descartável por ter sido TOCADO por um seed** — é
a explicação estrutural dos 25 eventos sumidos entre 01 e 03/08. A distinção que faltava:
`demo_seed` prova **CRIAÇÃO**, `completed_by_seed` prova apenas **EDIÇÃO**; apagar por prova de
edição é apagar o alheio. O cleanup agora **RECUSA** remover o que não criou. ⚠️ Ele já tinha
dry-run, alvo nomeado e trava de dinheiro — **nenhum protegia**, porque todos perguntavam *"você tem
certeza?"* e nenhum perguntava *"isto é seu?"*.

**2026-08-05 · `DT-GROUP-SECRET-VISIBILITY-LEAK`** + **`DT-GROUP-READ-SIBLINGS-UNGATED`** —
`?visibility=secret` **listava grupos secretos** (visibilidade vinha crua do cliente; o SQL nunca
filtrou visibilidade — o `visibilityConditions` de lá é **nome que mente**, são condições de
território). E fechar a listagem **não bastou**: com o id, 4 das 7 rotas de leitura ainda entregavam
tudo, incluindo `/:id/economy`, que era a **porta dos fundos** de `/:id/balance`. Resposta para
secreto agora é **404, não 403** (403 confirma existência). Guards
`audit-group-visibility-discovery-boundary` e `audit-group-read-siblings-same-gate`.

**2026-08-05 · `DT-GROUP-BUSINESS-RULES-AS-HTTP-500`** — 46 `throw new Error` crus no serviço +
rota com `err.statusCode ?? 500` = **toda** regra de negócio chegava como **500 em inglês**
(*"você já está em 3 grupos"* virava erro de servidor). **31 convertidos** para erro tipado; os 15
restantes são falha interna legítima.

**2026-08-05 · `DT-GROUP-ACCOUNT-IMPOSSIBLE-COLUMNS`** — as 3 queries da seção ACCOUNTS citavam
`account_id`/`createdAt`, **colunas que nunca existiram**; o `ON CONFLICT` nem era único de nada.
🔴 **O tipo TS declarava as colunas erradas e por isso compilava** — tipo de linha é AFIRMAÇÃO, não
checagem. `group_accounts` estava vazia porque **era impossível criar uma linha**, não porque
ninguém tentou.

**2026-08-05 · `DT-EVENT-PHASE-GATE-FAIL-OPEN-ON-READ-ERROR`** — `hasAgendaReservations` tinha
`catch { return false }`; lá em cima `false` = *"não há reserva"* ⇒ pré-requisito não entra ⇒
`canAdvance = true`. **Falha transitória de leitura LIBERAVA o avanço de fase que o portão existe
para bloquear.** Os dois pré-requisitos irmãos não engoliam — o engolidor era o ímpar. Agora
propaga. Teto `audit-permissive-catch-ceiling` (65 → **11**, e 8 sítios corrigidos de verdade).

**2026-08-05 · `DT-EXPIRY-DOOR-WITHOUT-TRIGGER`** — `actor_active_location.expires_at` era
**escrito** pelo INSERT do próprio repositório e **nenhuma** das duas leituras filtrava por ele.
Prazo decorativo. Contido até então só porque nenhuma linha tinha prazo — **sorte, não desenho**.
Guard `audit-expiry-door-has-trigger` (descobre as portas no código, sem lista fixa).

**2026-08-05 · `DT-CULTURAL-FEED-ASSERTS-EMPTY-WHEN-BROKEN`** — `GET /cultural/events` engolia
qualquer erro e respondia `200 { events: [] }`. Como `cultural_events` **não existe**, TODA chamada
caía ali: a tela mostrava seção vazia **para sempre**, indistinguível de "sem conteúdo". Agora
carrega `unavailable: true`. 📌 O frontend **já tinha** o conceito de feature indisponível — o ramo
nunca disparava porque o backend mentia do outro lado.

**2026-08-05 · `DT-AGREEMENTS-LIVE-ROUTES-LEAKING-42P01`** — 10 rotas **registradas e vivas**
consultando tabela inexistente, **sem contenção**: toda chamada devolvia **500 com o erro cru do
Postgres vazando**. Contido na **BORDA** (`onRequest` → 501 nomeado) — no service faria cada rota
nova nascer descoberta. Guard + **E2E de runtime** (`validate:agreements-ghost-containment`), porque
guard estático prova que a contenção está ESCRITA, não que DISPARA.

**2026-08-05 · `DT-COMPANY-GHOST-INSERT-EVERY-BIRTH`** — `INSERT` em
`company_opportunity_preferences` a cada empresa criada; a tabela não existe e **nenhuma migration a
cria** (logo o comentário *"migration pode não ter rodado"* era falso). Zero leitores. Precedente no
mesmo arquivo (`company_domains`, DECISION-0102). `GHOST-WRITE-vivo` 253 → **252**.

**2026-08-05 · `DT-RENTAL-UNDO-ASYMMETRIC-STATE-GATE`** — quem pede só cancelava em
`requested`/`confirmed`; **o dono não tinha trava nenhuma** e podia "recusar" reserva em
`checked_in`, **com o item já entregue** — o histórico passava a dizer que a reserva nunca
aconteceu. Uma regra para os dois lados. ⚠️ **NOMEADO e não decidido:** desfazer *durante* o uso não
tem caminho (devolução antecipada, cobrança proporcional, quem arbitra) — decisão de produto.

**2026-08-05 · `DT-POLICY-DESTINATION-PUBLISHABLE-BUT-UNPAYABLE`** — a validação de publicação
conferia o destino contra o **CHECK físico** (11 valores), não contra o que o motor paga (6). Dava
para publicar linha de indicação pelo painel, **e todo pagamento daquela política passava a falhar**
(o erro derruba a transação inteira). **Configuração administrativa que quebra pagamento é a pior
armadilha: quem configura não é quem descobre.** ⚠️ Havia migalha **prometendo** essa garantia via
`REGIONAL_*_RESOLVABLE_MVP` — parcialmente falsa, aquelas listas nunca olharam destino.

**2026-08-05 · `DT-NORMATIVE-POINTERS-CLAIM-NONEXISTENT-DOCS`** — 3 normas afirmavam que a regra
estava escrita onde não está: ontologia dizia vertical construção *"Definido em"* arquivo
inexistente · `CATEGORY_TREE_MAPPING` listava diagrama ausente com status **"Em uso"** ·
`PUBLIC-API-CONTRACT` referenciava invariantes inexistentes. Marcados como AUSENTE, citação
**riscada e não apagada** (a citação registra que alguém esperava o documento existir).

**2026-07-30 · `DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE`** — `auth_rate_limit_logs`
**nunca existiu**; o `catch` de `countByKey` engolia o 42P01 e devolvia 0 → `allowed:true`
sempre. Login, registro, check-cpf, check-referral, webauthn e refresh estavam **sem
proteção de força bruta**, em rota **pública** (não passa por `requirePermission`, nada os
continha). Migration `20260729160000`, colunas em `attempted_at` (o código usava
`attemptedAt` não-quotado, que Postgres dobra), `catch` agora **loga alto** mantendo
fail-open, guard `audit-auth-rate-limit-substrate.mjs` no runner. **Prova comportamental
verificada de 1ª mão pela direção: HTTP 429 na 6ª tentativa**, 5 linhas gravadas, harness
efêmero PASS 6/6, zero resíduo. ⚠️ Tabela **sem RLS de propósito** — com RLS a contagem
voltaria 0 sob `pool` cru e o fail-open continuaria invisível; razão gravada no
`COMMENT ON TABLE`.

**2026-07-29 · `DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`** (commit `6414b3404`) — ausência de
`EXPECTED_DATABASE_NAME` era tratada como permissão. Agora recai em `unificard_dev` e
aborta. Fechou também a porta deliberada (`setup-local-demo-db.mjs` recusa) e o convite por
escrito (`RODAR_LOCAL.md`).

`DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` **(a)+(b)** — ⚠️ **(c) segue OPEN e é o que permite (a)/(b) reincidirem** · **`C4`** paga (⚠️ data real **28/07**, não 29/07 — a instância corrigiu o mandato da direção) · **selo falso nº1** re-fechado de verdade (`3ca1df864`) · **selo falso nº2** fechado via `K_pe_7` — ⚠️ **sub-caso (b) `bps=10000` + linha fixa SEGUE aberto**, atrás do motor byte-pinado · `DT-EVENT-PUBLISHED-UPDATE-ALLOWLIST-CASE-MISMATCH` · `DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC` · `DT-EVENT-GUARDS-UNWIRED-FROM-RUNNER`.

## ⏰ PRAZO

**Nenhum item ativo vencido hoje.** `C3`/`C13` com prazo fresco (2026-09-30, owner Clayton).
🔴 **PADRÃO DE RISCO A VIGIAR:** o gate que cobraria esse prazo **não está no runner nem no CI**. Nada cobra automaticamente — é o mesmo mecanismo que deixou 10 entradas vencerem 57–89 dias sem ninguém notar.

## 🔗 MESMA CAUSA, NOMES DIFERENTES

1. **`C13` ≡ `DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — mesmo defeito, dois sistemas de rastreio (JSON × cartório). **Fundir ou linkar.**
2. **`C4` ≡ `DT-BANK-BALANCE-BY-REGION-READMODEL-METADATA-DESALINHADO`** — mesma coisa, duas etiquetas. Confirmar se o header da segunda foi re-carimbado.
3. `AUDIT-004` **é** a 6ª ocorrência que `ROOT-004` previa — agrupamento por causa-raiz funcionando (`§B.10`), não duplicata.
4. **Processo, não código:** os dois selos falsos compartilham a mesma causa — selo sem reprodução adversarial independente e sem entrada cartorial da correção.

---

## ⚠️ NÃO CLASSIFICADO (declarado, não inferido)

`REMEDIATION_DT_LOG.md` linhas **~1460–21654** (~20 mil) não lidas narrativamente. Três clusters densos de `DT-*` nomeados: **(a)** RLS/tenant-isolation · **(b)** ERP/CRM/marketplace · **(c)** payout E2E (aparentam CLOSED pelos cabeçalhos, não confirmado). A memória sugere que (a) e (b) já têm frentes fechadas — **NÃO reverificado**. Painel 100% completo exige passada dedicada a partir da linha 1461.

Também fora: `dividatecnica.md` linhas 300–2534.
