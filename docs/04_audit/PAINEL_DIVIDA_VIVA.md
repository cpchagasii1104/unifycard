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

## 📊 PLACAR — última medição **2026-07-30**, toda ela de 1ª mão pela direção

| métrica | valor | como foi medido |
|---|---|---|
| `validate:regression-guards` | ✅ **232 COMMANDS OK** · drift **0** | `npm run`, banco `unificard_dev` |
| `typecheck` backend + frontend | ✅ **0 erros** | `tsc --noEmit` nos dois |
| Gate `schema-coherence` | ⚠️ **1188 chaves congeladas, gate VERDE** — antes `FAIL 1776`, fora do runner | agora **DENTRO do runner** via `audit-schema-coherence-ratchet.mjs` (`5feeb3de5`) |
| `schema_migrations` (`unificard_dev`) | **550** aplicadas · 551 arquivos · 1 skip governado | query direta |
| Banco oficial | **`unificard_dev`** · 334 tabelas · trava fail-closed viva | query direta |
| `bank_ledger` · `bank_transactions` · `bank_splits` | **0 · 0 · 0** | query direta, 2026-07-31 |
| Dado curado intacto | **75 bairros · 48 policies** | query direta, 2026-07-31 |

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

### 🔴 EM VOO AGORA — atualizado 2026-08-01, fim da sessão

**Se você é a direção e acabou de chegar: isto é o que está aberto. Árvore LIMPA.**

| frente | estado | o que falta |
|---|---|---|
| **YALA — auditoria do arco** | ✅ **ENTREGUE E ABSORVIDA** (`f9cef79c7`) | 2 SOBREVIVEM (severity · 17 contenções `rides`) · 1 COM RESSALVA (reconciliação: `reference_id` guarda CONTA no motor e TENANT no manual — **não tratado**) · **2 DERRUBADAS**, as duas da direção. Achado 【4】 **fechado por remoção** em `b9f21c07b`. 🔴 **NADA FOI SELADO** — selo é ato de Clayton; o que sobreviveu ao ataque está pronto. |
| **EVENTOS — vocabulário de status** | ✅ **COMMITADO** (`c00732439`) | verificado de 1ª mão: 6 valores contra o banco, zero resíduo maiúsculo nos 5 arquivos, typecheck BE+FE 0, runner 234. ⚠️ `SocialFeed2:630` intocado de propósito — é `cultural_events`, tabela que **não existe** no schema vivo. |
| **EVENTOS — lista + retomar rascunho** | **BLOQUEADA por decisão de Clayton** | *"meus eventos" inclui o que criei representando outro actor?* Sem isso a query não se escreve. Desenho já fechado: lista = `actor_id` todos os estados · feed = published+ de todos · retomar = reidratar por `eventId`, passo **derivado no backend** (nunca `localStorage` — seria 2ª verdade sobre os 12 rascunhos que JÁ estão no banco). |
| **DETECTOR DE 3 LADOS** | desenhado, **não despachado** | Clayton propôs padronizar case em massa; medição mostrou que só **2 de 7** membros eram case puro — os outros 5 eram vocabulário. Mas os "valores inventados" são o **desenho anterior** (ver `CLAUDE.md §3.2`). O detector compara **código × `migrations_archive` × banco vivo** e classifica: renomeação pura (seguro em massa) · conversão conhecida · estado novo · estado morto. `GHOST-COLUMN 0/0` já reservado no ratchet; a Condição 2 do `schema-coherence` está **cega por apelido** (89,9% do SQL usa `a.`/`bt.`). |
| **BLINDAGEM DE MIGRATION** | mandato escrito, **não despachado** | 166 de 551 migrations citam norma por caminho (30%). Teto congelado nas 385 sem blindagem; migration NOVA sem `o quê + norma por caminho + por quê` = FAIL. ⛔ Não é campanha — Lei 2 é forward-only e "cabeçalho falso é pior que ausente". |
| **`payout.service.ts:44`** | 🔴 **achado, não consertado** | `trustProfile.riskLevel === 'BLOCKED'` — `BLOCKED` **não existe** em `trust_profiles.risk_level` (`low·medium·high·critical`) e vem de `migrations_archive/0213`. **A trava que bloqueia desembolso por risco nunca dispara.** Gate de dinheiro: fatia própria, com prova de que passa a morder. |
| **`push` do branch** | **bloqueado pelo classificador** | `rescue-structural` **não existe no remoto** (`git ls-remote` vazio; só `main`/`master`). O arco inteiro vive num disco só, sem backup. Varredura de segredo passou limpa. Clayton roda: `git push -u origin rescue-structural` |

**Decisões paradas com Clayton:** autoridade da lista de eventos · as **43 decisões de módulo**
(*"é produto vivo?"*) que destravam as ~161 fantasmas · reescrever ou não os 2 commits que
carregam trabalho da executora sob mensagem alheia (**decidido: NÃO reescrever** — árvore
compartilhada, sem remoto, errata registrada).

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
