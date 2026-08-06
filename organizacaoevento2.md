# ORGANIZAÇÃO DE EVENTO — o que FALTA · `F-SERVICE-DEMAND-QUOTE-LIFECYCLE`

> **Categoria:** operacional · **Status:** vivo · **Obrigatório:** sim, para quem for continuar esta frente
> **Fonte canônica:** `docs/02_decisions/DECISION_0196_SERVICE_DEMAND_QUOTE_LIFECYCLE.md` (+ ADENDO 1)
> **Governado por:** Clayton (decisão) · direção (execução)
>
> **Sucede** `organizacaoevento.md`, arquivado em `docs/99_archive/` em 2026-08-06. O antigo virou
> **histórico**: 9 das suas afirmações foram derrubadas e 4 fatias saíram dele. **Não o consulte
> para saber o estado** — ele descreve um plano, este descreve o que sobrou.

---

## 🚪 VOCÊ ACABOU DE CHEGAR E NÃO LEMBRA DE NADA

Isto é normal e é o desenho. Leia, **nesta ordem**, e não pule:

1. **`CLAUDE.md`** (raiz) — o roteador. §2.1 (como você vai errar) · §3.2 (case, `_cents`, `_at`)
2. **`docs/02_decisions/DECISION_0196_…md` INTEIRA, inclusive o ADENDO 1** — é a norma **desta**
   frente. Tudo que parece decisão em aberto provavelmente já está lá.
3. **§3 deste arquivo** — as sete armadilhas em que EU caí em 2026-08-06. Você vai cair nelas de
   novo se não ler.
4. `REMEDIATION_DT_LOG.md` (topo) — as entradas de 2026-08-06 são desta frente.

⛔ **NÃO comece a escrever antes de rodar o §1.** Estado é medição, nunca memória.

---

## §1 · CONFIRME O ESTADO — rode, não acredite

```bash
cd backend && npm run validate:regression-guards        # espera: 260 COMMANDS OK
cd backend && node_modules/.bin/tsc -p tsconfig.build.json --noEmit   # 0
cd frontend && npm run typecheck                        # 0
```
⚠️ **NUNCA `npx tsc`** — ele tenta INSTALAR e sai 0 **sem compilar**. Use o binário local.
**Banco oficial: `unificard_dev`.** ⛔ Migration contra ele **só** com `EXPECTED_DATABASE_NAME`
declarado; validação é em **efêmera**.

**Canários (devem estar intactos):** `75` bairros · `48` policies · `3` grants · `16` `bank_ledger`
· `0` `bank_splits` · `573` migrations.

**Harnesses desta frente** (todos criam e destroem banco efêmero):
```bash
npm run validate:quote-lifecycle-substrate          # 16 provas — substrato + writer + validade
npm run validate:personal-agenda-exclusivity-race   # a CORRIDA (0146 §A.8/G7)
npm run validate:confirm-third-branch-stop          # o STOP do 3º ramo
npm run validate:rental-exclusivity-guarantee       # a garantia de locação
```

---

## §2 · O QUE JÁ ESTÁ FEITO — ⛔ NÃO REFAÇA

9 commits em 2026-08-06, todos enviados (`0 commits à frente do remoto`):

| commit | o que fechou |
|---|---|
| `bb6ac8e73` | garantia de exclusividade da locação seguiu o substrato vivo; o bloqueio de DECLARAÇÃO saiu (Art. II) |
| `3f36b9dce` | 3º ramo do confirm **PARA** com `501 STOP_DECISION_REQUIRED` (`0146 G10`) |
| `e7e09a21c` | a tela deixou de encurtar a janela (4 sítios; 80% das janelas são multi-dia) |
| `4244a94f9` | errata no plano antigo · `catch` que afirmava vazio |
| `abc8a44ff` | **`DECISION-0196`** + substrato da F1 (`expires_at`, `offering_id` XOR `asset_id`, `target_actor_id`) |
| `a5c256c1b` | rollup por provider **generalizado** → agenda pessoal contratável, **com corrida provocada** |
| `1187e75c0` | validade com **leitor único** + expiração preguiçosa |
| `8d666d1ff` | emenda `§B.4` — a **cascata** |
| `c473d62b0` | **ADENDO 1** (dois verbos · `need_id` · GATE da F2 · veto de selo) + `live_presence` minúsculo + tombstone do barril de erros |

**A F1 está FECHADA NO BACKEND:** substrato ✅ · writer ✅ · validade com leitor único ✅.

**Guards desta frente, no runner:** `audit-quote-validity-single-reader` ·
`audit-window-render-truthful-extent` · `audit-booking-provider-conflict` (estendido) ·
`audit-rental-hardening-constraints` (v2, dinâmico).

---

## §3 · 🔴 COMO **EU** ERREI EM 2026-08-06 — sete vezes, e você vai repetir

> **Todas têm a mesma forma: afirmei o que era cômodo verificar depois.** As sete foram pegas — 4
> por mim ao remedir, 3 pelo runner. Nenhuma virou commit errado. **Isso só aconteceu porque eu
> medi de novo antes de entregar.**

1. **Filtrei mais estreito que a afirmação.** Rodei `pg_constraint … AND contype='c'` e falei sobre
   a ausência de `EXCLUDE`. **Existia uma.** → *Para negar existência, o filtro tem de ser mais
   largo que a afirmação.*
2. **Procurei pelo nome que EU uso.** Greppei pelo código de erro (`RENTAL_AVAILABILITY_OVERLAP`) e
   concluí "zero ratificação". O artefato se chamava `availability_rental_no_overlap` e tinha GO +
   cartório. → *Procurar pelo meu nome não prova ausência; prova que não sei o nome dele.*
3. **Supus ratificação para um achado e procurei para o outro, no MESMO documento.**
   → *Cadeia com um elo verificado e outro suposto é cadeia suposta.*
4. **Escrevi um número que não medi** (`runner 258 OK`, citando a rodada anterior). Fui rodar para
   tornar verdadeiro — e estava **vermelho**.
5. **Li um ADJETIVO e não a premissa.** O plano dizia *"F3 é read-model puro"* e eu repeti. Não
   existe elo demanda→evento. → *Adjetivo não é medição.*
6. **Não medi o TIPO dos 7.** Medi *"7 providers com oferta"* e decidi a `§B.4` com isso. O número
   que decidia era outro: **nenhum deles é `user`** — a regra expulsaria 11 de 12 pessoas físicas.
7. **Chamei de barato sem medir.** *"Convergir `@core/errors`"* custaria **213 imports**, e a pasta
   nem é duplicata. → *"Referência não é alcance" vale contra o meu próprio diagnóstico.*

**E três vezes o próprio repositório me pegou** (e estava certo nas três): fixture irreal ·
`INSERT INTO actors` fora do writer soberano · o lint de vocabulário financeiro — **duas vezes
seguidas**, a segunda porque meu comentário explicando a palavra **continha** a palavra.

**Duas armadilhas mecânicas que voltam sempre:**
- **CRLF:** `Edit` no Windows reescreve arquivo inteiro. **`git ls-files --eol` ANTES de decidir
  normalizar** — alguns arquivos são nativamente CRLF no índice; "consertar" ali gera diff à toa.
- **`node -e` por bash quebra no escape** → escreva arquivo no scratchpad.

---

## §4 · O QUE FALTA — e o que cada coisa espera

### ✅ `DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT` — **FECHADA em 2026-08-06** (GATE + GO Clayton)

Migration `20260806220000`: `bookings_commitment_no_overlap` (EXCLUDE gist) +
`chk_bookings_blocking_requires_interval`. Guard `audit-commitment-layer-db-constraint` no runner
(**vermelho forçado 6×**) · harness `npm run validate:commitment-layer-db-constraint` (16/16, efêmera).
**Alcance medido: 59 janelas confirmáveis sob a trava de banco · 3 de equipment fungível fora.**
Detalhe completo — inclusive **os dois furos de desenho que Clayton derrubou antes da migration** —
no topo do `REMEDIATION_DT_LOG.md`.

**O que nasceu dela, com gatilho por QUERY:**

| resíduo | gatilho contável |
|---|---|
| `DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE` | `SELECT count(*) FROM actor_asset_rental_terms WHERE resource_type='equipment' AND quantity > 1` — hoje **3**. `EXCLUDE` não sabe CONTAR; esses 3 seguem só no advisory lock |
| `DT-DECLARATION-DRIFTS-FROM-COMMITMENT` | `SELECT count(*) FROM bookings b JOIN availability a USING (availability_id) WHERE b.status IN ('confirmed','checked_in','checked_out') AND (a.start_datetime <> b.booked_start_datetime OR a.end_datetime <> b.booked_end_datetime)` |

⚠️ **NÃO reabra a "Forma 2" (trigger de bloqueio em `bookings`)** achando que ninguém pensou nela:
foi avaliada, cobriria também o fungível, e foi **REJEITADA** por duplicar a regra em duas linguagens.
Motivo registrado no cartório.

### ⚛️ F2 — **ENTREGUE em 2026-08-06 · ⛔ NÃO SELADA** (o veto da `§I.2` espera a navegação)

Aceitar demanda **cria compromisso na agenda**, numa transação só, pelos **DOIS** verbos.
Harness `npm run validate:demand-atomic-accept` **11/11** · guard `audit-demand-atomic-accept`
(vermelho forçado 3×) · cascata `§B.4` em **leitor único** (`demand-commitment.ts`).
✅ Fecha **`DT-DEMAND-AGENDA-MIRROR`** (prova `F1`, query contável do `§J`).
🔴 **`hasScheduleConflict` CONVERGIU para a agenda** — ele lia `service_demand_responses` com régua
`'[]'` FECHADA enquanto a agenda usava `[start,end)`. **Não reabra a fonte paralela.**
🔴 **Leitores também precisam da transação:** `findBookingById`/`findAvailabilityById` no pool
faziam o aceite falhar com `NotFoundError` em vez de rollback — o sintoma exato da `§D7`.
⛔ **Para SELAR falta a navegação de Clayton** (`§I.2`): substrato certo com pessoa no escuro reprova.

### (histórico do desenho da F2)

*"Duas mãos no mesmo lock na mesma semana sem mapa é como nascem as corridas."*

📌 **A fatia de 06/08 mudou o terreno da F2, e para melhor:** o aceite atômico deixa de depender de o
chamador lembrar de pegar o lock — a `EXCLUDE` é verificada pelo banco dentro da mesma transação, e
um 2º confirm concorrente **espera e falha**, em vez de passar. O refactor de client externo continua
necessário (o confirm precisa enxergar a availability não-commitada), mas a rede de segurança já está
no lugar.

✅ **GATE FECHADO em 2026-08-06** (read-only, `§I.1`) — mapa completo no topo do `REMEDIATION_DT_LOG.md`.
**Zero pergunta em aberto:** as 3 que eu ia levar ao dono já estavam decididas (`§B.4` = os DOIS
verbos de aceite · substrato vivo = fuso · `0146 G10` = `recorrente`/`efetivo` PARAM). **Falta só o GO.**

🔴 **REGRA VINCULANTE (Clayton, 2026-08-06): NÃO PODE EXISTIR SEGUNDA VERDADE.**
`hasScheduleConflict` (lê `service_demand_responses`, régua `[]` fechada) e a trava da agenda
(`bookings`+`availability`, régua `[start,end)` da `G8`) respondem à MESMA pergunta com fontes e
réguas diferentes. Hoje não colidem só porque a demanda nunca chega à agenda. Na F2:
**converge para a agenda ou morre · na MESMA fatia** (antes = zero checagem, depois = duas verdades
vivas) · **uma régua só, `[start,end)`**.

O que ela precisa carregar:
1. **Refatorar** `repository.create` e os dois `confirm*` para aceitar **client externo** — hoje
   `create` usa `runQueryWithTenant` (pool) e os `confirm*` abrem o **próprio `BEGIN`**. Sem isso o
   aceite atômico **não falha limpo**: o confirm não enxerga a availability não-commitada e devolve
   `NotFoundError`, não rollback (`0196 §C/D7`).
   ✅ **`createBooking` JÁ aceita `trx`** (`repository.ts:359-363`) com caller real
   (`checkout-ticket.service.ts:148`) — o contrato existe, é só seguir. `create` tem **1 caller**.
   🔴 **Mas o módulo `demands` é SAGA, não transação** (`fillSlot`→`createResponse`→`catch
   releaseSlot`) e nenhum método dele aceita client: os DOIS verbos precisam virar transação real.
1-bis. **`hasScheduleConflict` converge** (a regra da segunda verdade, acima).
2. **A cascata do `§B.4`**, com prova vermelha nos **TRÊS** degraus — inclusive a **recusa do `page`**.
3. **Nova prova de corrida** — a de hoje cobriu o *confirm*; a F2 cria availability + booking +
   confirm.
4. 🔴 **VETO DE SELO (`§I.2`):** não sela sem a pessoa **VER** a própria agenda ser ocupada.
   *Substrato certo com pessoa no escuro reprova.* **Não exige tela nova** — a visão de agenda que
   ela já tem + o outbox quando o notificador nascer.
5. Ao entregar: fecha `DT-DEMAND-AGENDA-MIRROR` e `DT-AVAILABILITY-OVERLAP-ALERT-MISSING`.

### F3 — 🔑 **SUBSTRATO ENTREGUE em 2026-08-06**; falta só o dashboard (cego até a navegação)

Migration `20260806230000` — `service_demands.need_id` FK anulável, `ON DELETE SET NULL`, índice
parcial · writer fail-closed `DEMAND_NEED_NOT_IN_TENANT` · guard
`audit-demand-need-tenant-coherence` (vermelho forçado 2×) · harness
`npm run validate:demand-need-event-key` **8/8**.
🔴 **A coerência de tenant é do WRITER, não do banco** — `event_operational_needs` não tem
`tenant_id` nem RLS (padrão de 6 tabelas `event_*`, **não endureça**); `0146 §A.6` prescreve
writer/guard fail-closed. **Não presuma que a FK isola.**
⚠️ **O dashboard não foi construído de propósito:** `service_demand_responses` = 0 linhas, ele
agregaria zero. Fica atrás da navegação.

### F3 (histórico do desenho) — a chave já estava decidida (`0196 §H`)

```
events → event_operational_needs → service_demands → service_demand_responses
          (o QUE precisa)           (o PEDIDO)         (o PREÇO)
```
✅ **GATE FECHADO em 2026-08-06** (read-only, `§2.3.2`) — mapa no topo do `REMEDIATION_DT_LOG.md`.
Confirmado de 1ª mão: **14 needs vivas** (12 `service` + 2 `rentable`) · `need_id` **não existe**
ainda · `event_financial_execution` = 0 linhas (a §H.3 está certa) · e **zero tabela** tentando ser
"custo do evento" — a F3 chega em terreno limpo.

Falta materializar **`service_demands.need_id`** (FK **anulável** para `event_operational_needs`;
nulo = demanda avulsa, **nada regride**). O **valor não entra** em nenhuma das duas — a F3 agrega
**da resposta**, de baixo para cima.
⚠️ `event_financial_execution` **não serve** e o nome engana (0 linhas; é rastreamento de execução).

🔴 **O QUE O PLANO NÃO DIZIA — a FK atravessa fronteira de isolamento.** `service_demands` tem
**RLS ligado** e `tenant_id NOT NULL`; `event_operational_needs` **não tem `tenant_id` e não tem
RLS** (o tenant mora um salto adiante, em `events`). FK simples deixaria uma demanda do tenant A
apontar para need de evento do tenant B — **duas respostas para "de quem é isto"**.
⚠️ **Não endureça o padrão:** 6 tabelas `event_*` são assim de propósito. A saída é a que a
`0146 §A.6` já prescreve — **writer fail-closed + guard**. A F3 carrega os três: FK anulável ·
writer que recusa `need_id` de outro tenant · guard que morde se a checagem sumir.

**Duas metades com maturidade diferente:** o **substrato** pode ir com o GO; o **dashboard**
agregaria **ZERO** hoje (`service_demand_responses` = 0 linhas) — fica cego até a navegação, mesma
dependência da F2.

### 🔤 F4 — **ENTREGUE em 2026-08-06 · ⛔ NÃO SELADA** (a `§G.3` exige NAVEGAR)

`request_quote` da `ActorPage` abre **demanda DIRIGIDA**; o `QuoteRequestDialog` sobreviveu
**renomeado para "Reservar horário"** e serve o item que TEM janela publicada.
Harness `npm run validate:directed-demand` **10/10** · guard `audit-directed-demand-two-verbs`
(vermelho forçado 2×) · o formulário de demanda foi **reusado com alvo**, sem 2ª superfície.
🔴 **CORREÇÃO AO PLANO:** *"`target_actor_id`, já existe"* era verdade da **coluna** e falso do
**código** — `grep` no módulo de demandas dava **ZERO**. A F4 teve de religar writer, projeção e os
**dois readers** de plateia.
🔴 **A plateia dirigida ESTREITA** (alvo vê, terceiro não vê/não abre/não responde) e **broadcast
não regride**. Se a cláusula sumir do reader, pedido dirigido vira broadcast **em silêncio**.
⛔ **CONDIÇÃO ANTES DO SELO (`§G.3`): NAVEGAR.** Um clique em cada caminho.
*Código confirmado ≠ jornada confirmada.*

### Resíduos com dono e gatilho **por query** (`0196 §J`)

| resíduo | gatilho |
|---|---|
| `DT-RFQ-JSONB-QUOTE-TRAIL-SUPERSEDED` | `grep FEATURE_RFQ_ENABLED` = 0 e rotas removidas — ao **fim da F4** |
| `DT-DEMAND-AGENDA-MIRROR-…` | `SELECT` contável: booking aceito de demanda aparece na agenda unificada do provider |
| `DT-AVAILABILITY-OVERLAP-ALERT-MISSING` | selo da F2. Hoje `findOverlapping` **dormente está certo** — é a semente do alerta, **não limpe** |
| `DT-DB-GUARANTEE-SWEEP-INCOMPLETE` | antes da **próxima migração de substrato** (triggers/FKs/índices parciais não varridos: **`?`, não `0`**). ⚠️ **Parcialmente pago em 06/08 para `bookings`+`availability`**: constraints (sem filtro de `contype`), índices, triggers (com `tgisinternal`) e rules foram varridos e estão no cartório. O resto do banco segue **`?`** |
| `DT-FUNGIBLE-CAPACITY-HAS-NO-DB-GUARANTEE` | `SELECT count(*) FROM actor_asset_rental_terms WHERE resource_type='equipment' AND quantity > 1` (hoje **3**) |
| `DT-DECLARATION-DRIFTS-FROM-COMMITMENT` | janela editada depois do confirm passa a divergir do intervalo comprometido — query no cartório |

---

## §5 · O QUE É DE CLAYTON — não decida por ele

- **GO da fatia `DT-COMMITMENT-LAYER-…`** e **GO da F2** (esta com GATE antes).
- A **navegação** da `§G.3` — é ele quem clica.
- `501` de **`page`**: ⛔ **NÃO é dívida.** É fail-closed pela **R1** dele (*"a empresa não tem
  agenda: ela AGREGA"*). Só reabre com decisão de **resolução para unidade**.

**⛔ NÃO são decisões — não gaste caneta** (já promulgadas ou dissolvidas): `D1` `D2` `D3` `D4` `D5`
`D7` `Q1` `Q2/D6c` · `D6a` (implementado e atômico) · `D6b` (dependência da fatia C / central de
notificações, **inexistente**) · `⑧` (a `0164 ADENDO 4` já nomeia, com régua do público) ·
`DT-QUOTE-RESPONSE-UI-MISSING-OFFER-PICKER` (**dissolveu** com a emenda da `§B.4`).

---

## §6 · O RITO — não se autorize

**GATE (read-only) → GO do dono → executar → prova de 1ª mão → registrar → commit.**

- **Registre no cartório DURANTE a fatia**, não depois. É para o **próximo você**.
- **Guard novo entra no runner no MESMO commit** — e **force o vermelho** antes de confiar
  (`guard que nunca falha é decoração`).
- **Prova que não acha o alvo deve ABORTAR** — prova vermelha que não altera nada passa com cara de
  sucesso.
- **Prove os DOIS sentidos.** *Trava nova bloqueia quem pode tão facilmente quanto libera quem não
  pode — e só a segunda falha grita.*
- **Desfaça prova vermelha por BACKUP**, nunca `git checkout`.
- ⛔ **NUNCA `git add -A`.** `git commit -- <caminho>` com pathspec, e `git diff --cached
  --name-only` **antes**. `backend/estrutura-backend.txt` é de **outra instância** — não toque.
- Δbank = 0 em tudo desta frente. `quote_cents` é **preço declarado**, não custódia — **não** vai
  para o Bank.

---

## §7 · O QUE NUNCA FOI MEDIDO — não relate como pronto

- 🔴 **O navegador nunca foi aberto.** Toda a jornada de frontend está provada por **call-site**,
  não por uso.
- As **10 rotas RFQ**: registro ≠ alcance — nunca foram abertas uma a uma.
- **F3 e F4** nunca foram atacadas por ninguém, em nenhuma revisão.
- A corrida provada cobre **o confirm**, não o aceite completo.
- `DT-DB-GUARANTEE-SWEEP-INCOMPLETE`: triggers, FKs e índices parciais **não varridos**.
