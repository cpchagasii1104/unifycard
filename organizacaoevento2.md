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

### 🔴 PRÓXIMA, por decisão de Clayton: `DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT`

*"A mais importante das quatro"* (Clayton, 2026-08-06). A `0146 §A.7` faz **duas** coisas: proíbe
constraint forte na DECLARAÇÃO **e prescreve** que ela more no COMPROMISSO. Tirei da camada
proibida e **não pus na prescrita**: `bookings` não tem **nenhuma** constraint de exclusividade
(medido: só FKs, PK e 2 CHECKs).
⚠️ Hoje a exclusividade repousa **inteiramente no advisory lock de aplicação** — *o tipo de garantia
que **parece** existir*. **Fatia própria, com GATE e GO.**

### F2 — o aceite atômico · ⛔ EXIGE GATE PRÓPRIO (`0196 §I.1`)

*"Duas mãos no mesmo lock na mesma semana sem mapa é como nascem as corridas."*

O que ela precisa carregar:
1. **Refatorar** `repository.create` e os dois `confirm*` para aceitar **client externo** — hoje
   `create` usa `runQueryWithTenant` (pool) e os `confirm*` abrem o **próprio `BEGIN`**. Sem isso o
   aceite atômico **não falha limpo**: o confirm não enxerga a availability não-commitada e devolve
   `NotFoundError`, não rollback (`0196 §C/D7`).
2. **A cascata do `§B.4`**, com prova vermelha nos **TRÊS** degraus — inclusive a **recusa do `page`**.
3. **Nova prova de corrida** — a de hoje cobriu o *confirm*; a F2 cria availability + booking +
   confirm.
4. 🔴 **VETO DE SELO (`§I.2`):** não sela sem a pessoa **VER** a própria agenda ser ocupada.
   *Substrato certo com pessoa no escuro reprova.* **Não exige tela nova** — a visão de agenda que
   ela já tem + o outbox quando o notificador nascer.
5. Ao entregar: fecha `DT-DEMAND-AGENDA-MIRROR` e `DT-AVAILABILITY-OVERLAP-ALERT-MISSING`.

### F3 — dashboard do organizador · a chave já está decidida (`0196 §H`)

```
events → event_operational_needs → service_demands → service_demand_responses
          (o QUE precisa)           (o PEDIDO)         (o PREÇO)
```
Falta materializar **`service_demands.need_id`** (FK **anulável** para `event_operational_needs`;
nulo = demanda avulsa, **nada regride**). O **valor não entra** em nenhuma das duas — a F3 agrega
**da resposta**, de baixo para cima.
⚠️ `event_financial_execution` **não serve** e o nome engana (0 linhas; é rastreamento de execução).

### F4 — a tela · **encolheu** para "rotear e renomear" (`0196 §G`)

`request_quote` da `ActorPage` passa a abrir **demanda DIRIGIDA** (`target_actor_id`, já existe);
o `QuoteRequestDialog` sobrevive **renomeado para "Reservar horário"**.
⛔ **CONDIÇÃO ANTES DO SELO (`§G.3`): NAVEGAR.** Um clique em cada caminho. A tabela dos dois verbos
é **fato de código**, **não** experiência verificada. *Código confirmado ≠ jornada confirmada.*
📌 **Depende da F2** (o aceite tem de existir antes de a tela prometê-lo).

### Resíduos com dono e gatilho **por query** (`0196 §J`)

| resíduo | gatilho |
|---|---|
| `DT-RFQ-JSONB-QUOTE-TRAIL-SUPERSEDED` | `grep FEATURE_RFQ_ENABLED` = 0 e rotas removidas — ao **fim da F4** |
| `DT-DEMAND-AGENDA-MIRROR-…` | `SELECT` contável: booking aceito de demanda aparece na agenda unificada do provider |
| `DT-AVAILABILITY-OVERLAP-ALERT-MISSING` | selo da F2. Hoje `findOverlapping` **dormente está certo** — é a semente do alerta, **não limpe** |
| `DT-DB-GUARANTEE-SWEEP-INCOMPLETE` | antes da **próxima migração de substrato** (triggers/FKs/índices parciais não varridos: **`?`, não `0`**) |

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
