# CLAUDE.md — leia antes de propor qualquer coisa

> **Este arquivo NÃO é fonte de verdade.** Ele é um **roteador**: aponta para os documentos que já decidem. Se algo aqui contradisser `docs/01_normative/` ou `docs/02_decisions/`, **a norma vence** e este arquivo está errado — corrija-o.

## 1. Sua condição

Você chegou com capacidade total e **memória zero**. O UnifiCard tem anos de decisão acumulada e passou por 3 reconstruções. Quase tudo que vai te parecer *faltando*, *estranho*, *mal resolvido* ou *boa ideia nova* **já foi pensado e decidido** — frequentemente pelo dono do projeto, e frequentemente **já está escrito**.

A continuidade não vive em você. Vive no **cartório** (`REMEDIATION_DT_LOG.md`, topo = mais recente), em `docs/01_normative/` e em `docs/02_decisions/`.

**As normas existem para que o sistema não seja redecidido por quem chegou hoje.** Quem chega hoje é você, toda vez.

## 2. A pergunta que você faz PRIMEIRO

> ❌ "Como eu construo isso?"   ·   ✅ **"Onde isso já existe?"**

Antes de escrever *"falta X"*, *"não existe X"*, *"precisa criar X"* — **prove** que X não existe sob outro nome, em outro módulo, ou dormente. Enquadre como **"existe em `arquivo:linha`, no lugar errado / não religado"**.

**Um "não existe" falso é o erro mais caro possível aqui**, porque cria uma **segunda verdade** — e duas verdades sobre *"para quem vai o dinheiro"* divergem em silêncio até ninguém saber qual manda. O trabalho padrão neste repositório é **RELOCAR lógica que funciona**, não autorá-la.

Ao despachar subagente, escreva o mandato como **inventário-primeiro, desenho-nunca**.

## 2.1 🔴 COMO VOCÊ VAI ERRAR — tem uma assinatura só, e ela se repete

Em **um único dia (2026-07-31) a direção errou 16 medições**. Não foram 16 erros diferentes:
foram **16 vezes o mesmo**, e ele tem forma fixa —

> **uma ferramenta configurada de um jeito, e o resultado lido como se fosse de outro.**

`Select-Object -First 10` truncou um grep e virou *"nenhum caller"* (havia dois, com tela branca
no fim) · `-match` do PowerShell é **case-insensitive** e casou minúsculo dentro de `[A-Z_]+`,
gerando relato de bug inexistente · `grep -c $'\r'` leu a letra "r" e acusou 23.284 CRLF falsos ·
pastas "gêmeas" deduzidas pelo NOME tinham **zero** arquivo em comum · um relatório de ONTEM em
`docs/_reports/` foi apresentado como medição de hoje · a tabela apontada por nome (`payout_requests`)
não era a que o código usa (`payout_orders`, ausente). **Os 16 casos, com quem derrubou cada um:
topo do `REMEDIATION_DT_LOG.md`, entrada "ERRATA DA DIREÇÃO".**

**As regras que sobraram — todas custaram caro:**

- 🔴 **Cole o COMANDO junto do achado.** Achado extraído por ferramenta vale o que a ferramenta
  vale. Foi assim que 7 dos 16 caíram — derrubados por outra instância, não por cuidado próprio.
- **Leia a QUERY, nunca o nome** do módulo, arquivo ou tabela. Nome que "bate" com a expectativa
  é a evidência mais fraca deste repositório.
- **Arquivo datado é foto, não estado.** Rode o comando.
- **Antes de despachar mandato, releia a norma que você vai citar.** Duas vezes a executora seria
  mandada ao lugar errado (uma delas para a tabela **legado** que a DECISION manda aposentar).
- **Conferir ≠ atacar.** Guard que você confere passa; guard que você ATACA revela o buraco.
  Construa a violação e prove que morde — no formato que ninguém testou.
- **Teto tem que ser COMPARADO, não impresso.** Dois guards nasceram com baseline declarada,
  impressa na mensagem de sucesso e **nunca comparada** — verdes anunciando *"a contagem só pode
  descer"* com a contagem maior. Compare contra a contagem do **CÓDIGO**, não só contra a
  allowlist; senão adicionar a chave "resolve" o vermelho.
- **Allowlist que pode crescer é permissão; que só encolhe é dívida com saída.**
- **Zero é uma afirmação; desconhecido é a verdade.** Métrica que falhou ao ler não pode reportar
  `0`/`false` — isso afirma *"não há"*. Reporte indefinido e faça o erro APARECER.
- **Contenção só não é adiamento** quando nada a alcança, OU quando tem prazo verificável por
  query e dono. *"Vence no primeiro usuário real"* não é gatilho; `SELECT count(*) FROM
  bank_transactions > 0` é.

## 3. Roteamento — assunto → fonte que JÁ decide

| Vai mexer em… | Leia ANTES |
|---|---|
| **Qualquer coisa** | `docs/01_normative/00_AGENT_PROTOCOL.md` §2.2 (prova de rastreabilidade) + §2.3.2 (GATE antes de alterar tabela/SSOT) |
| **Dinheiro / split / saldo** | pacote §8 obrigatório: `SSOT_EXCLUSIVE_BANK_RULE.md` · `SSOT_CONTRACT.md` · `SSOT_REGISTRY_UNIFICARD.md` · `PROHIBITED_STRUCTURES.md` |
| **Percentuais / política econômica** | `DECISION-0166` — D1 base · D6 *admin configura, admin NÃO move dinheiro* · D7 ordem · D8 painel |
| **"100% de quê?" · base do split · sobra do centavo** | ✅ `DECISION-0194` **SELADA 2026-07-28** — D2 *uma base por policy, misturar é PROIBIDO* · D3 *duas etapas encadeadas* · D1.1 *custo operacional sai ANTES, não-votável e visível* · D3.1-BIS *sobra = linha `revenue_share` bps=0 com destino de custo*. ⚠️ **Doutrina selada ≠ código conforme** — motor ignora `applies_to`, validação sem trava de base única, allowlist vazia. Ver a tabela do selo no cartório antes de presumir conformidade. |
| **Fundo regional / território** | `DECISION-0049` · `DECISION-0177` · ⚠️ `DECISION-0192` **NÃO-SELADA · REPROVADA (veredito C) na auditoria de 2026-07-27** — reverte silenciosamente 0166 D8 e apaga o ramo PJ de 0166 D0. **NÃO é autoridade de roteamento até correção+selo.** Vale 0166/0177. |
| **Grupos / economia de grupo** | 🔴 `docs/01_normative/CONTRATO_GRUPOS_V2.md` — **é LEI**, com cláusula *"implementação que contradiga é BUG por definição"* |
| **Categoria no split** | `DECISION-0048` — categoria **seleciona** policy; **não** calcula split; **não** é identidade |
| **Ontologia / N0-N1-N2** | `18_DOMAIN_ONTOLOGY_UNIFICARD.md` — N0/N1/N2 são **navegação** e **NUNCA** participam de roteamento financeiro |
| **Identidade semântica** | Lei 7 — CONCEPT é o SSOT; `categories` é árvore; `slug`/`metadata` **nunca** são identidade |
| **Migrations** | Lei 2 — **forward-only**; tag `GENESIS_CONSTITUCIONAL_v1` existe; **nunca** editar migration existente |
| **Votação / enquete / pauta** | Já existem **3** substratos + vocabulário promulgado (`START_VOTE`, `VOTE_REGISTERED`, `poll`, domínio `votes` em `MAPA_CANONICO_PERMISSIONS_v1.md`). **Não crie o 4º.** |
| **"onde isso já existe?" — QUALQUER assunto** | 🔴 `docs/04_audit/INDICE_ONDE_ESTA_O_QUE_2026-07-29.md` — assunto → documento que governa, com **status e data**. Inclui as armadilhas: `0191` tem header mentindo "não-selada" (está selada); `DECISION-0020` é citada e **não existe**; `10_EVENTS_CANONICA` **não é** sobre eventos-produto. **É ponteiro, não fonte** — norma vence. |
| **O que está vivo HOJE** | 🔴 `docs/04_audit/PAINEL_DIVIDA_VIVA.md` — **é O PLACAR** (decisão de Clayton, 2026-07-30): estado atual, números medidos com data, registro de sessões. Cabe na cabeça. Toda fatia que fecha dívida atualiza ele. |
| **História, causa-raiz, provas** | `REMEDIATION_DT_LOG.md` — **leia o topo**. É cartório append-only, **não é placar** |
| ⛔ **`dividatecnica.md`** | **HISTÓRICO.** Declara-se obrigatório e mentiu por 24 dias (placar de 06/07 dizendo 163 guards quando eram 227). Evidência sim, estado atual **não**. Não atualize — atualize o PLACAR |
| **Onde estão TODOS os documentos de dívida técnica, com papel e tarja** | 🔴 `docs/00_divida_tecnica/README.md` — a PORTA: tabela dos 11 documentos (PLACAR/CARTÓRIO/PLANO/HISTÓRICO + a exceção de nomenclatura), caminho real, e se já tem tarja. **É índice, não fonte** — nada além da tabela mora ali; um 12º documento vira linha, nunca parágrafo. |

## 3.2 🔬 OS INVARIANTES CONCRETOS — o que a §3 não te diz e você vai violar

A tabela acima roteia por **assunto**. Esta roteia por **forma**, e existe porque a §3 não
bastou: em 2026-07-31 a direção criou `alert_severity` em minúsculo **com o runner verde na
mão**, porque o roteador dizia "leia `07_NOMENCLATURA_CANONICA`" e ninguém lê 6.349 linhas.
Todas as seções abaixo foram **conferidas uma a uma** antes de serem citadas aqui.

> ### 💰 OS DOIS QUE VALEM MAIS QUE A TABELA INTEIRA (Clayton, 2026-08-01)
>
> **① O BANK É A ÚNICA VERDADE SOBRE DINHEIRO.** Saldo, custódia, movimento e histórico vivem
> no Bank e em mais lugar nenhum. Qualquer tabela fora dele que guarde valor, saldo ou custódia
> é **segundo ledger** — e segundo ledger diverge em silêncio até ninguém saber qual manda.
> Provado no mesmo dia em que isto foi escrito: `escrow_accounts` era um substrato de custódia
> paralelo ao Bank (`amount_cents`, `held_amount_cents`, `status` próprios) enquanto a custódia
> real já morava na conta `escrow_payments` do Bank, movida pelo ledger. E
> `bank_reconciliation_history` — que nunca existiu em lugar nenhum — ia ser criada, quando
> `reconciliation_runs` já estava lá com **15.866 linhas**.
> **Antes de criar qualquer casa para dinheiro: `SSOT_EXCLUSIVE_BANK_RULE.md`. A resposta quase
> sempre é "já existe no Bank, religue".**
>
> **② CENTS PARA TUDO.** Todo valor monetário é **inteiro, em centavos, `BIGINT`, sufixo
> `_cents`** (`§4.7`). Nunca `float`, nunca `NUMERIC`, nunca "reais com vírgula". Se o nome não
> termina em `_cents`, ou não é dinheiro, ou está errado — e as duas hipóteses se resolvem
> olhando, não supondo.
> Estado medido em 2026-07-31: **101/101 colunas `_cents` são `BIGINT`** — este o repositório
> respeita. O que escapa é a coluna que **deveria** ter o sufixo e não tem.

| Vai criar/tocar… | A regra, literal | Como isso mordeu de verdade |
|---|---|---|
| **DINHEIRO** | 💰 **`_cents`, `BIGINT`, inteiro. NUNCA float/`NUMERIC`.** Moeda explícita se multi: `_brl_cents` (`07_NOMENCLATURA §4.7`) | `bank_limit_change_requests.requested_amount` — **o código já chamava `requestedAmountCents`**; só a coluna ficou para trás |
| **timestamp** | sufixo **`_at`** + **`TIMESTAMPTZ`** sempre (`§4.6`) | 33 colunas medidas sem `_at` (`valid_from`, `datetime_start`, `effective_until`…). A norma já escreve `starts_at`/`ends_at` como ✔ |
| **boolean** | prefixo **`is_`/`has_`/`can_`/`should_`/`was_`/`requires_`** + default explícito (`§4.9`) | 17 colunas sem prefixo, **3 delas gate de autorização** (`invitable`, `delegable`, `protected`) |
| **status / lifecycle** | **`snake_case` MINÚSCULO** (`§4.11`) | família de 6 membros: `service_order_status` (500 em toda opção de filtro), `alert_status`, `events.status`, `services.status` (0 linhas **em silêncio**) |
| **severity / priority** | 🔴 **`UPPER_CASE`**, e **NÃO são sinônimos**: `severity` = impacto técnico (`CRITICAL·ERROR·WARNING·INFO·AUDIT`); `priority` = ordem de tratamento (`BLOCKING·CRITICAL·HIGH·MEDIUM·LOW·ATTENTION`) (`§4.34`) | 4 tabelas tinham o vocabulário de **priority** dentro de coluna **severity**, em minúsculo. É a exceção: quase tudo aqui é minúsculo, **isto é MAIÚSCULO** |
| **tabela / coluna** | `snake_case`; tabela **plural**; sem abreviação obscura (`§4.2`, `§4.3`) | 0 violações medidas — este o repositório respeita |
| **frontend** | **espelha EXATAMENTE o contrato da API. Não cria alias, não renomeia** (`§7`, linha 2788) | `EventStatusBadge` inventou `ONGOING`/`SOLD_OUT`/`FINISHED` — **interseção ZERO** com o banco, e 23 eventos renderizavam o status cru em inglês |
| **enum vs CHECK** | tanto faz para a norma — mas **enum grita** (`42704`) e **CHECK+TEXT falha em SILÊNCIO** (0 linhas, sem erro) | o caso mudo é sempre pior: `services.status` devolveria **200 com lista vazia** |
| **migration** | **forward-only** (Lei 2). Nunca editar migration existente. Formato canônico `YYYYMMDDHHMMSS_desc.sql` | ver `backend/migrations/README.md` (numeração, sufixo alfabético, gaps) |
| **escrever em `bank_*`** | só o domínio Bank (`SSOT_EXCLUSIVE_BANK_RULE`; `LEI_COERENCIA §4.6/§4.7`). Substrato paralelo de custódia é **proibido** | `escrow_accounts` era um **segundo ledger** ao lado do Bank; `escrow.repository.ts` está nomeado na §4 como legado em extinção |
| **valor que não se conseguiu ler** | **`undefined`, nunca `0`/`false`** — zero AFIRMA "não há", e não se sabe disso | painel de risco reportava zero bloqueio lendo 4 tabelas inexistentes |
| **entrada de usuário em rota** | **nunca `req.query.X as any`** — valide contra o vocabulário GOVERNADO e devolva **400**, não 500 | 181 sítios congelados por teto (`audit-query-param-boundary-validation.mjs`) |

### 🔠 A REGRA DO CASE — o defeito mais repetido do repositório

**O case NÃO depende da tabela. Depende do TIPO DE CAMPO.** A mesma tabela `alerts` tem
`status` minúsculo e `type`/`severity` MAIÚSCULOS. Errar isso produziu **seis** defeitos em dois
dias, dois deles com tela quebrada para o usuário.

| campo | case | valores REAIS, medidos em `unificard_dev` |
|---|---|---|
| `status` / lifecycle | 🔡 **minúsculo** | `events.status` = `draft·declared·published·active·ended·cancelled` · `service_order_status` = `draft·confirmed·in_progress·completed·seller_pending·release_approved·funds_released·cancelled` · `alert_status` = `open·ack·resolved` · `services.status` = `draft·active·paused` · `payout_requests.status` = `requested·processing·completed·failed` |
| `risk_level` | 🔡 **minúsculo** | `trust_profiles.risk_level` = `low·medium·high·critical` ⚠️ **não existe `BLOCKED`** |
| `severity` | 🔠 **MAIÚSCULO** | `CRITICAL·ERROR·WARNING·INFO·AUDIT` (`§4.34`) |
| `priority` | 🔠 **MAIÚSCULO** | `BLOCKING·CRITICAL·HIGH·MEDIUM·LOW·ATTENTION` (`§4.34`) — **não é sinônimo de severity** |
| `type` / `*_type` de alerta | 🔠 **MAIÚSCULO** | `alert_type` = `INVENTORY_LOW_STOCK·PAYMENT_FAILED·FISCAL_PENDING·RISK_SCORE_LOW·…` |
| event type (`domain.entity.action`) | 🔡 **minúsculo com pontos** | `payment.captured` · `order.delivered` (`§4.41`) |
| tabela · coluna | 🔡 **snake_case minúsculo** | `bank_transactions` · `amount_cents` (`§4.2`, `§4.3`) |

**Antes de comparar contra um literal, RODE:**
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'sua_tabela'::regclass AND contype = 'c';
-- enum nativo:
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
 WHERE t.typname = 'seu_enum' ORDER BY enumsortorder;
```
⛔ **Nunca deduza o case pelo nome do campo, pela tabela vizinha, nem pelo tipo TypeScript** —
o tipo TS é uma *afirmação*, não uma checagem: `response.json()` não valida nada em runtime, e
foi assim que `EventStatusBadge` ficou com **interseção ZERO** com o banco sem ninguém notar.

🔴 **ARMADILHA — o valor "inventado" quase sempre é o vocabulário ANTERIOR.** Antes de chamar um
literal de invenção do frontend, **procure no `backend/migrations_archive/`**. Em 2026-08-01 a
direção afirmou que `ONGOING`/`SOLD_OUT`/`FINISHED` eram valores inventados no frontend;
`migrations_archive/0790_events_lifecycle_extension.sql` tem
`CHECK (status IN ('DRAFT','PUBLISHED','ONGOING','FINISHED','CANCELLED'))` — **idêntico, byte por
byte, ao que `frontend/src/api/events.ts:18` declara.** O código não divergiu: ele está fiel ao
desenho antigo e **foi deixado para trás** quando o gênesis (REBASE-03) re-materializou a tabela
seguindo a norma. Idem `'BLOCKED'` (`migrations_archive/0213_payouts.sql`) e o enum de escrow
(`0187`).
**Consequência prática:** o conserto raramente é "descobrir o valor certo" — é **mapear um
desenho conhecido para outro conhecido**, e os dois estão escritos (archive × banco vivo).
⚠️ **Mas o mapa nem sempre é 1:1** — `events` foi de 5 para 6 valores (`declared` é estado NOVO,
decisão de Clayton em `event-visibility.service.ts:10`), e `severity` mudou de EIXO (urgência →
natureza técnica): `medium` não vira `MEDIUM` nem `WARNING` por regra, vira por julgamento.
**Conjunto igual ignorando case = renomeação, seguro em massa. Conjunto diferente = houve
mudança de desenho, exige decisão nomeada.**

**Como este defeito se manifesta, por substrato:**
· **enum nativo** → grita: `42704 invalid input value for enum` (alguém reclama)
· **TEXT + CHECK** → **cala**: devolve `200` com lista vazia, para sempre, sem erro nem log
· **comparação em JS** → cala: `undefined === 'HIGH'` é `false`, o botão some, o alerta não
  acende, o contador vira `NaN`
**O mudo é sempre o pior.** Se você achou um, procure os irmãos: o defeito nunca veio sozinho.

## 3.1 ☠️ ANTES DE RODAR MIGRATION — NUNCA contra `unificard_dev`

`unificard_dev` é o **banco OFICIAL** desde 2026-07-29 (`DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`)
e contém dado curado insubstituível: **75 bairros de Curitiba** (N3 selada, *"NUNCA recarregar"*),
48 policies, 3 grants, a conta do fundo regional. **Apagá-lo é perda irreversível.**

Validação de migration é em **banco efêmero**, criado e destruído na hora — o mecanismo é
`EXPECTED_DATABASE_NAME`, exercido pelos harnesses `run-*-ephemeral.ps1`. A regra está em
`docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` → "REGRA DE AMBIENTE (CRÍTICA)".

> ⚠️ **Correção deste parágrafo em 2026-07-31.** Até hoje esta seção avisava que a Lei mandava
> `dropdb unificard_dev` e pedia para desobedecê-la. **A Lei já tinha sido corrigida em
> `4060df0a2`** (autorizada por Clayton) e hoje diz o contrário — "⛔ NUNCA contra
> `unificard_dev`" — preservando o texto antigo num bloco de histórico. Este arquivo ficou
> avisando de um perigo que já não existia. **Roteador que descreve norma vencida é a mesma
> doença que ele existe para evitar** — se você achar outra divergência entre este arquivo e
> `docs/01_normative/`, a norma vence e é este arquivo que se corrige.

## 4. Armadilhas — parecem indecididas e NÃO são

- **`user_group_allocation`** ("usuário escolhe doar X% do que gasta"): **REVOGADO POR LEI** (`CONTRATO_GRUPOS_V2` — *"não é fonte do split comunitário, dívida a aposentar"*). O modelo correto é **PULL por membership**. A tabela **nem existe** no banco vivo. Não ressuscite.
- **Percentuais 70/3/10/17, 97/3, 5% de indicação**: são **defaults hardcoded de desenvolvedor** em `bank-split-engine.service.ts`, **NUNCA ratificados**. Tornar configuráveis = certo. Tratar como decisão do dono = **falso**.
- **Motor legado ≠ canônico.** `bank-split-engine.service.ts` é legado, cercado por tripwire. O canônico é `economic_policy_engine` + PE-3 → `createTransactionWithExplicitSplitLines`. **Não faça o legado ler policy** — `DECISION-0048` removeu `resolveSplitPolicy` e o arquivo diz *"NÃO reintroduzir"*.
- **Comentários podem MENTIR.** Casos reais confirmados: `regional-fund-governance.service.ts` diz que filtra elegibilidade "por região" e **a query não filtra região nenhuma**; `user-group-allocation.service.ts` se anuncia *"CONTINUOUS PRODUCTION"* estando revogado. **Confirme no código, não no comentário.**
- **Bloqueios podem estar VENCIDOS.** Ex.: o hold do nível `neighborhood` alega *"catálogo de bairros não governado"* — mas os 75 bairros oficiais de Curitiba foram selados (frente N3). Sempre verifique se a justificativa de um bloqueio ainda é verdadeira **e** se havia outras causas não resolvidas.
- **Cap de participação em grupos = 3** (D12/`DECISION-0188`) — é decisão vigente, **não é configuração**.
  🔴 **Mas NÃO tem garantia estrutural.** Até 2026-07-31 esta linha dizia *"vivo com trigger/lock"* e as
  duas metades eram falsas (derrubado por auditoria independente, verificado por mim em `unificard_dev`):
  os únicos triggers em tabela de grupo são de **imutabilidade** (`fn_gam_enforce_immutability`,
  histórico append-only da 0188 D7); **zero** função de cap em `pg_proc`; o único UNIQUE de
  `group_members` é `(tenant_id, group_id, user_id)` — impede o mesmo usuário no MESMO grupo, não
  limita a 3. Nenhum advisory lock / `FOR UPDATE` / `SERIALIZABLE` em `groups.service|repository`.
  O cap é **check-then-act em código** (`groups.service.ts`) → **TOCTOU**: dois requests concorrentes
  leem 2, ambos inserem, resulta 4. **Vai mexer em grupos? A garantia não existe — não presuma.**
- **Janela de indicação:** 1 ano está vivo e hardcoded; a de 5 anos é **PENDENTE, nunca promulgada** (`DECISION-0139`).

## 5. O rito (não se autorize)

**GATE** (read-only, mapa) → **GO do dono** → **executora** (escreve) → **verificação de 1ª mão da direção** → **auditoria independente** → **selo docs-only** no cartório.

- Executora que bate em **pin de campanha selada**: **para e reporta**. Reconciliar pin é ato da direção.
- Executora cujo **próprio código** viola regra existente: **conserta sozinha**.
- **Um guard que nunca falha é decoração** — force o vermelho antes de confiar nele.
- **Deleção de módulo pré-existente exige autorização explícita do dono**, mesmo com decisão que a justifique.
- **Instância que PARA vale mais que instância que entrega.** A executora parou duas vezes em
  2026-07-31 e as duas renderam mais que a fatia. Nunca recompense contorno de trava selada com
  bypass "só para o teste".
- Rode o **runner completo** (`npm run validate:regression-guards`), não só o E2E da sua fatia.

**Higiene de árvore compartilhada** — outras instâncias escrevem ao mesmo tempo:

- ⛔ **NUNCA `git add -A`** — varre trabalho alheio para dentro do seu commit (`2d0d2275c`:
  4 arquivos de frontend num commit sobre nota normativa; errata em `b60ccd0f7`).
- 🔴 **E `git add` por caminho explícito NÃO BASTA.** `git commit` sem pathspec commita **todo
  o índice**, incluindo o que outra instância já tinha deixado staged. Aconteceu em
  `581259803` — 5 caminhos explícitos no `add`, e o commit levou junto 6 arquivos do religamento
  do Bank de outra instância, sob mensagem que só fala de documentação. **Foi a segunda vez, com
  a regra anterior já escrita aqui.** A regra que funciona:
  ```
  git diff --cached --name-only     # OLHE antes. Se tiver algo que não é seu, PARE.
  git commit -- <caminho> <caminho> # pathspec NO COMMIT, não só no add
  ```
- ⛔ **Prova vermelha NÃO escreve em diretório compartilhado** (`backend/migrations/`). Um
  arquivo temporário envenenou a corrida do runner de outra instância, que investigou como
  flakiness.
- **CRLF:** a verificação autoritativa é `git ls-files --eol` (espera-se `i/lf w/lf`), **não**
  grep de `\r`. Alguns arquivos são **nativamente CRLF no índice** — "normalizar" ali gera diff
  de arquivo inteiro à toa. Rode `git diff --check` antes de commitar.
- **`git status` com `M` e blob idêntico ao HEAD** = cache de `stat` sujo (um `cp` tocou o
  mtime). Confirme com `git hash-object` × `git rev-parse HEAD:<arquivo>` antes de investigar.

## 6. A regra do acesso (DECISION-0193 · protocolo §7.1)

⚠️ **DECISION-0193 está NÃO-SELADA (veredito B em 2 auditorias) — isto é orientação, não lei, até correção+selo.**

**Tocou um arquivo em trabalho real e descobriu qual norma o governa? Deixe a migalha antes de sair** — 5 linhas, teto duro:

```
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO | LEGADO-CERCADO | DORMENTE | CONTIDO | REVOGADO
// ║ NORMA:   <caminho real do documento que governa>
// ║ NÃO:     <o que não fazer aqui>
// ║ EM VEZ:  <o caminho correto, NOMEADO>
// ╚════════════════════════════════════════════════════════════════
```

Sem campanha, sem varredura — só de carona no trabalho que já ia acontecer. **`EM VEZ` é obrigatório**: dizer "não" sem dizer "faça isto" é o que faz a IA seguinte inventar um terceiro caminho. **Anote só o que verificou** — cabeçalho falso é pior que ausente. **Achou comentário que mente? Corrigir é obrigatório.**

## 7. Ao registrar

Escreva no cartório **durante** a fatia, não depois. O registro não é para o dono — é **para o próximo você**, que não vai lembrar de nada disto.
