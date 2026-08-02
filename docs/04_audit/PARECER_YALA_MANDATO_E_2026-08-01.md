# PARECER YALA — MANDATO E · segundo arco (7 commits, 3 tocaram o banco oficial) · 2026-08-01

**Categoria:** AUDITORIA INDEPENDENTE — parecer de instância adversarial (Mandato E), sucede o Mandato D.
**Status:** VIGENTE · emitido 2026-08-01 sobre `36c491851..b9ca5d5ea` (branch `rescue-structural`). **Prova datada, não estado** — releia rodando os comandos colados.
**Fonte canônica:** NÃO É FONTE, é PARECER. A fonte é o CÓDIGO e o BANCO que ele mede; onde divergir, o comando vence o texto.
**Obrigatório:** SIM para quem for selar qualquer commit deste arco — **1 DERRUBADO** (`item 4` parcial), **3 com ressalva aberta** e **1 defeito VIVO de dinheiro achado fora dos 6 itens**.
**Governado por:** `docs/01_normative/00_AGENT_PROTOCOL.md` — rito GATE → GO → executora → verificação da direção → auditoria independente → selo. ⚠️ **Parecer não é selo. Selo é ato de Clayton.**

**Banco de TODAS as provas: `unificard_dev`** (oficial, **553** migrations). Só `SELECT`, catálogo do
Postgres e leitura de código/`git show`. **Nenhuma escrita. Nenhum `dropdb`.**

| # | item | veredito |
|---|---|---|
| 1 | as 2 migrations aplicadas hoje | **SOBREVIVE-COM-RESSALVA** — e a ressalva é 🔴 grave |
| 2 | reescrever a migration × Lei 2 | **SOBREVIVE** — a Lei, como escrita, **não cobre o ato** |
| 3 | ERP duas faces / autoridade | **SOBREVIVE** — ataquei os 2 vetores decisivos |
| 4 | 3 rotas de métricas contidas | 🔴 **DERRUBADA (parcial)** — repetiu o defeito, e sem guard |
| 5 | 88% de `availability` órfã | **SOBREVIVE-COM-RESSALVA** — conclusão certa, **razão errada** |
| 6 | varredura do frontend (9 vocabulários) | **SOBREVIVE** — mas o irmão do mesmo dia está quebrado |

🔴 **ACHADO FORA DOS 6 ITENS, E É O PIOR DO ARCO:** o fechamento de caixa do PDV grava
**`totalPaid = 0` e `totalFailed = 0` sempre**, por causa exatamente do vocabulário que a migration
`b9ca5d5ea` acabou de selar. Detalhe no §1.3 — **é dinheiro, é vivo e não tem gate.**

---

## 【1】 AS DUAS MIGRATIONS — **SOBREVIVE-COM-RESSALVA**

### 1.1 Os CHECK batem com o código vivo? **Sim — varri writers e readers, não os commits**
```
psql> SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid::regclass::text IN ('event_reservations','payment_transactions') AND contype='c';
 event_reservations   | event_reservations_status_check   | CHECK (status = ANY (ARRAY['pending','confirmed','checked_in','no_show','cancelled']))
 payment_transactions | payment_transactions_status_check | CHECK (status = ANY (ARRAY['pending','success','failed']))
```
- **`event_reservations`** — os 5 sítios: `occupancy.service.ts:233` (writer, `'pending'`) ·
  `:297-299` (readers, `'confirmed'/'checked_in'/'no_show'`) · `occupancy.types.ts:15`
  (`ReservationStatus` minúsculo) · `home-feed.service.ts:129,318` (`'pending','confirmed'`).
  **Todos minúsculos, todos dentro do CHECK.** Nenhum sobrevivente MAIÚSCULO.
- **`payment_transactions`** — `payment-transaction.repository.ts` escreve `'pending'` (`:126`),
  `'success'` (`:196`) e `'failed'` (`:220`), e compara os mesmos (`:109,199,209,223,233`).
  **Exatamente os 3 valores do CHECK.**

### 1.2 "Inverti a culpa no `home-feed`?" — **NÃO. O git prova o contrário.**
Fui ao estado ANTERIOR ao commit, não ao texto do commit:
```
git show f609f9d06^:backend/src/modules/events/occupancy.service.ts
:233  VALUES (..., 'PENDING', ...)          ← writer MAIÚSCULO
:297  ... WHERE status = 'CONFIRMED' OR status = 'CHECKED_IN'
:299  ... status = 'NO_SHOW'
```
E `home-feed.service.ts:129` já era `IN ('pending','confirmed')`. **A afirmação é literalmente
verdadeira:** o home-feed era o único sítio que obedecia a norma, e o writer era o divergente.

**E o home-feed é alcançável** — o seu próprio contra-ataque, testado:
`app.builder.ts:472` → `protectedScope.register(homeFeedRoutes, { prefix: '/actors' })`;
`home-feed.routes.ts:15` → `GET /actors/:actorId/home-feed`, cujo único gate é
`if (!req.user?.id) return 401` (`:7`). **Sem `requirePermission` deny-all, sem 501.** Qualquer
autenticado alcança. O argumento **não** cai — ele se sustenta.

### 1.3 🔴 "O CHECK de `payment_transactions` morde?" — **MORDE. Provado sem escrever uma linha.**
```
psql> SELECT convalidated FROM pg_constraint WHERE conname='payment_transactions_status_check';  → t
psql> SELECT 'PENDING' IN ('pending','success','failed'), 'pending' IN ('pending','success','failed');  → f | t
```
`convalidated = true` significa constraint **ativa e validada**; o predicado avalia **falso** para a
grafia MAIÚSCULA. Logo qualquer `INSERT`/`UPDATE` com `'PENDING'` levanta **23514**. A sua
dificuldade foi de **harness** (os `NOT NULL` da tabela pai barram antes de chegar ao CHECK), **não
da trava**. **Não é decorativa.** Hoje ela é preventiva — nenhum writer vivo escreve MAIÚSCULO —
mas prende a deriva futura, que é o que um CHECK deve fazer.

### 🔴 1.4 O QUE VOCÊ NÃO PROCUROU — e é dinheiro vivo
Varri os **leitores** de `payment_transactions.status`, não só os escritores:

```
backend/src/modules/pdv/pdv.service.ts
:349   pt.status as payment_status         ← FROM orders o … LEFT JOIN payment_transactions pt (:352-353)
:365   paymentStatus: (row.payment_status || 'NONE') as 'SUCCESS' | 'FAILED' | 'PENDING' | 'NONE'
:371   .filter((o) => o.paymentStatus === 'SUCCESS').reduce(... amountCents ...)   → totalPaid
:374   .filter((o) => o.paymentStatus === 'FAILED') .reduce(... amountCents ...)   → totalFailed
:472/:478/:481  o MESMO padrão, no segundo método
```
O `as` é **cast de TypeScript — não converte**. O valor em runtime é `'success'`/`'failed'`, e a
comparação é contra `'SUCCESS'`/`'FAILED'`. **Nunca casa.**

**Consequência medida na leitura do código:** `closeSessionWithSummary` (`:317`) monta
`{ totalOrders, totalPaid, totalFailed }` e o comentário da linha seguinte diz *"Fechar sessão e
salvar resumo no metadata"* — ou seja, **um fechamento de caixa persiste `totalPaid = 0` e
`totalFailed = 0`**, com `totalOrders` correto. Um caixa que vendeu fecha declarando R$ 0,00
recebido.

**Alcance — tracei até o handler, sem parar no service:**
- `GET /pdv/sessions/:id/summary` → `pdv.routes.ts:176` → `getSessionSummary` (`:416`).
  **Sem `preHandler` nenhum.** O único hook do módulo (`pdv.routes.ts:46`) exige apenas
  `req.tenant` e `req.actionContext` — **não é autorização**. Registrado em `app.builder.ts:712`
  sob `protectedScope`. **Qualquer autenticado do tenant lê o resumo zerado. VIVO.**
- `POST /pdv/sessions/:id/close-with-summary` → `pdv.routes.ts:195`, gated por
  `requirePermission('marketplace_manage_orders')` — chave que **NÃO está em `PORTA_HOLD_KEYS`**
  (conferi o array), logo é concedível por ownership. **É o caminho que PERSISTE o zero.**

Grau: **PROVADO** · gravidade **VERMELHA** (dinheiro, vivo, silencioso, e persiste).
Não é regressão deste arco — é pré-existente. Mas a migration de hoje **selou em CHECK físico** a
grafia que torna a divergência permanente, e a varredura que a acompanhou não olhou os leitores.

---

## 【2】 REESCREVER A MIGRATION × LEI 2 — **SOBREVIVE** (e a acusação que você fez contra si é falsa)

**A prova factual está certa:** `schema_migrations` hoje registra as três de 2026-08-01 com
`executed_at` **posterior** à reescrita (`20260801130000` → `19:41:44`, checksum
`3d9c9b88…`), e o arquivo reescrito é o que rodou. Ambientes efêmeros são destruídos por
construção; `unificard_local` está aposentado. Não achei rastro de aplicação anterior.

**Mas o ponto que importa é outro — a Lei, lida na fonte:**
```
docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md · Lei 2: Forward-Only
  "⚠️ ATIVAÇÃO ESPECIAL: Somente após tag GENESIS_CONSTITUCIONAL_v1"
  Após a tag:
    - Nenhuma migration do Genesis pode ser alterada
    - Correções apenas via novas migrations (0006+)
    - Qualquer edição em 0001-0005 = VIOLAÇÃO CONSTITUCIONAL
```
**A Lei 2, como está escrita, governa as migrations do GENESIS (0001–0005).** Ela não diz "nunca
editar migration alguma"; diz que editar **0001-0005** é violação constitucional.
`20260801130000` não é do Genesis e nunca foi aplicada. **Não há violação de Lei 2 aqui — não
porque exista exceção conveniente, mas porque o ato está fora do escopo do texto.**

🟡 **O que existe é divergência entre a LEI e o ROTEADOR.** `CLAUDE.md:73` e `:118` afirmam
*"Lei 2 — forward-only; **nunca** editar migration existente"* — uma paráfrase **mais estrita que
a norma**. Pela hierarquia da casa (`01_normative` > roteador), **a Lei vence e o `CLAUDE.md` é que
está errado**. Registre isso: a próxima instância vai ler o roteador, achar que cometeu violação
constitucional, e ou vai travar, ou vai criar uma "exceção" que a Lei nunca precisou.

---

## 【3】 ERP DUAS FACES — **SOBREVIVE** (ataquei os dois vetores que derrubariam)

**Vetor 1 — "existe caminho em que `viewerActorId` chega sem prova?"** Fui da rota ao service:
```
backend/src/modules/actor-page/actor-page.routes.ts:50-61
  const declaredActorId = req.actionContext?.actorId ?? null;     // HINT do cliente
  if (declaredActorId) {
    const canRepresent = await authorizationService.canRepresentActor(tenantId, userId, declaredActorId);
    if (canRepresent) viewerActorId = declaredActorId;            // só aqui é honrado
  }
  if (!viewerActorId) { viewerActorId = <actor humano canônico do principal> }
```
Um visitante que declare `actionContext.actorId = <actor da empresa>` recebe `canRepresent = false`
→ cai no fallback do **próprio** actor humano → `viewerActorId === actorId` é **falso** →
`actingAsThisPage = false` (`service:191`) → **sem face de compra**. O comentário não está
mentindo; o código faz o que ele diz. ✅

**Vetor 2 — "`listByOwner` é escopado por dono em SQL ou só por tenant?"**
```
backend/src/modules/marketplace/purchase-order.repository.ts:260-270
  SELECT … FROM purchase_orders WHERE tenant_id = $1 AND owner_actor_id = $2 LIMIT $3
```
**Escopado pelos dois.** E o `ownerActorId` passado é o `actorId` da própria página
(`actor-page.service.ts:194`), alcançado só sob `actingAsThisPage`. **Não vaza pedido de compra de
empresa.** ✅ **Não caiu.**

---

## 【4】 AS 3 ROTAS DE MÉTRICAS — 🔴 **DERRUBADA (parcial)**

**O que sobreviveu, e provei nos DOIS lados:** *"ninguém chama"* é **verdade**.
```
frontend: getEventDashboard → 0 importadores · getOrganizerEventMetrics → 0 importadores
          EventMetricsDashboard → 0 montagens · OrganizerEventMetrics → 0 montagens
```
As funções-cliente existem (`api/events.ts:374,416`) apontando para os paths exatos, e os
componentes existem — **mas nada os importa e nada os monta**. E você **não inflou**: a irmã
`getEventMetrics` (`:348`, rota `/metrics`) tem **2 importadores** e **não foi contida**. A 3ª
rota (`compare`) partilha a quebra de verdade — `compareEvents` chama `getEventDashboard` por
dentro e herda o mesmo `42703`, e a contenção diz isso por escrito.

**O que cai — e é exatamente o que você me pediu para checar: repetiu, sim.**
As 3 rotas hoje **não têm `preHandler`**; e o diff mostra que, junto com o corpo, saiu a linha
```
- // 🔵 DECISION-0113 F6.5.6b-CANAL5-C: compare é multi-id → canViewEvent por eventId ANTES de comparar.
```
Ou seja: **a autorização foi removida com o corpo**, igual ao payout do parecer anterior. Atenuante
real: diferente do payout, **a justificativa aqui é verdadeira** e a contenção **avisa por escrito**
o que saiu (`events.routes.ts:660-670`). Mas quem reabrir continua sem `preHandler` para copiar, e
`canViewEvent` é gate de **autoridade**, não de forma.

🔴 **E não há guard nenhum.** `grep -rln "EVENT_METRICS\|event-metrics" backend/scripts/*.mjs` →
**vazio**. **Tamanho da dívida: 3 rotas contidas, 0 cobertas.** Some com as **3** de payout que
apontei no Mandato D (`audit-porta01-financial-hold.mjs` só cobre `/payouts/orders`): **6 rotas
contidas hoje sem guard de anti-reabertura**, todas com autorização removida junto do corpo.
Isto virou padrão do arco, não incidente.

---

## 【5】 `availability` — **SOBREVIVE-COM-RESSALVA: a conclusão está certa, a razão não**

**A medição está certa** — refiz do zero:
```
psql> SELECT count(*) total, count(*) FILTER (WHERE t.id IS NULL) orfas
      FROM availability a LEFT JOIN tenants t ON t.id = a.tenant_id;
 total | orfas
    67 |    59      (88%, confere)
```

**Mas a afirmação *"toda leitura filtra por tenant"* é FALSA**, e bastava uma:
```
core/profile/impact-overview.routes.ts:119        INNER JOIN availability a ON b.availability_id = a.availability_id
core/profile/pending-responsibilities.routes.ts:178  INNER JOIN availability a ON a.owner_type='service_offering' AND a.owner_id = so.id
core/profile/pending-responsibilities.routes.ts:265  INNER JOIN availability a ON b.availability_id = a.availability_id
modules/profile/commitments.routes.ts:177         JOIN availability a ON b.availability_id = a.availability_id
```
Quatro JOINs **sem `a.tenant_id`** — enquanto os irmãos de `rentals` e do próprio
`unified-availability.repository` carregam `AND a.tenant_id = b.tenant_id` explicitamente. E
```
psql> SELECT relrowsecurity FROM pg_class WHERE relname='availability';  → f   (RLS DESLIGADA)
```
Não há segunda camada. O que **de fato** contém hoje não é o filtro de tenant — é que o outro lado
do JOIN está vazio:
```
psql> SELECT count(*) FROM bookings;                                                    → 0
psql> SELECT count(*) FROM bookings b JOIN availability a USING(availability_id)
      LEFT JOIN tenants t ON t.id=a.tenant_id WHERE t.id IS NULL AND b.tenant_id IN (SELECT id FROM tenants);  → 0
```
**Conclusão:** cancelar a fatia de trigger continua defensável **hoje**, mas o motivo correto é
*"`bookings` está zerada e nenhuma linha real referencia as órfãs"* — não *"toda leitura filtra por
tenant"*. No dia em que `bookings` receber linhas, esses 4 JOINs podem trazer uma linha de tenant
inexistente para dentro da resposta de um tenant real, **sem RLS para barrar**. A fatia não morreu:
**adormeceu com gatilho medível** (`SELECT count(*) FROM bookings > 0`).

---

## 【6】 A VARREDURA DO FRONTEND — **SOBREVIVE**, e eu confirmo o seu "limpo"

Refiz a varredura que declarei pendente no Mandato D, nos 6 arquivos do frontend que sequer
mencionam esses domínios:
```
grep -rnE "'(DRAFT|SUBMITTED|PARTIALLY_RECEIVED|PICKED|CONSUMED|IN_PROGRESS|CLOSED)'" <os 6 arquivos>
→ único hit: frontend/src/api/marketplace.ts:848  — e é COMENTÁRIO (migalha), não código
```
**Para os 9 vocabulários convertidos, o frontend está limpo.** Você não errou aqui.

🔴 **Mas o irmão do MESMO DIA está quebrado**, e é o par do achado §1.4:
```
frontend/src/api/pdv.ts:75      paymentStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'NONE'
frontend/src/pages/PdvPage.tsx:478   {paymentResult.transaction.status === 'PENDING' && ' (Pendente)'}
```
`payment_transactions.status` agora é `pending|success|failed` **por CHECK físico** (migration
`b9ca5d5ea`, hoje). A comparação da tela **nunca casa** → o rótulo *"(Pendente)"* **nunca aparece**.
Silencioso, sem erro. **Front e back erram juntos, no mesmo vocabulário que a migration acabou de
selar.**

---

## TETOS — nenhum se moveu neste arco
```
git diff 36c491851..HEAD --stat -- backend/scripts/red-gates-baseline.json
        backend/scripts/schema-coherence-ratchet-baseline.json
        backend/scripts/audit-query-param-boundary-validation.mjs
        backend/scripts/audit-schema-coherence-ratchet.mjs
→ (vazio)
```
Nenhum baseline e nenhum `CEILING` foi tocado nos 7 commits. **Nada a explicar sobre prosa aqui** —
a ressalva que levantei no Mandato D (`financial_vocabulary` é sensível a comentário) não teve
oportunidade de agir neste arco.

---

## O QUE NÃO AUDITEI (denominador declarado)
- **Zero HTTP.** Não subi backend nem frontend. Todas as provas são `SELECT` no banco oficial,
  catálogo do Postgres, `git show` e leitura de código. O 23514 do §1.3 é provado por
  `convalidated` + avaliação do predicado, **não** por um INSERT (que seria escrita).
- **§1.4 (PDV):** provei a cadeia por código e a ausência de `preHandler` no `GET`; **não** executei
  a rota nem inspecionei um `metadata` de sessão real — `pdv_sessions` tem 0 linhas.
- **§2:** verifiquei `unificard_dev` e o registro de `schema_migrations`. **Não** tenho como provar
  negativamente que nenhum efêmero jamais a executou — efêmeros não deixam rastro por construção.
- **§5:** listei os SQL de `availability` fora de `scripts/`; **não** classifiquei os ~10 restantes
  de `rentals`/`repository` um a um (amostrei os que faltavam tenant). Não verifiquei FK composta
  em `bookings.availability_id`.
- **§4:** confirmei ausência de guard por `grep` nos `backend/scripts/*.mjs`; não rodei o runner.
- **Os ~57 commits antigos** que declarei pendentes no Mandato D **seguem sem auditoria**.
- `unificard_local` (aposentado) intocado.

---
*Read-only respeitado. Única escrita: este arquivo. **Parecer não é selo — selo é ato de Clayton.***
