# PARECER YALA — MANDATO D · arco de 63 commits · 2026-08-01

> **Categoria:** AUDITORIA INDEPENDENTE — parecer de instância adversarial (Mandato D)
> **Status:** VIGENTE · emitido 2026-08-01 sobre o arco de 63 commits da branch `rescue-structural`. **Prova datada, não estado** — releia rodando os comandos.
> **Fonte canônica:** NÃO É FONTE, é PARECER. A fonte é o CÓDIGO e o BANCO que ele mede; onde divergir, o comando colado vence o texto.
> **Obrigatório:** SIM para quem for selar qualquer commit deste arco — **1 item DERRUBADO** (readers de payout) e **2 com ressalva aberta** (enums, from-price).
> **Governado por:** `docs/01_normative/00_AGENT_PROTOCOL.md` — rito GATE → GO → executora → verificação da direção → auditoria independente → selo.
> ⚠️ **Parecer não é selo.** Selo é ato de Clayton, não meu nem da direção.
**Auditora:** YALA (independente, adversarial) · **Modo:** read-only absoluto.
**Banco de TODAS as provas: `unificard_dev`** (oficial, **551** migrations). Só `SELECT`, catálogo
do Postgres e execução de guards read-only. **Nenhuma escrita. Nenhum `dropdb`.**

| # | item | veredito |
|---|---|---|
| 1 | migration `20260801120000` — 9 enums minúsculos, 3 intactos | **SOBREVIVE-COM-RESSALVA** |
| 2 | contenção de 9 módulos fora do mínimo (`515975743`) | **SOBREVIVE** |
| 3 | from-price por IGUALDADE (`a596f4427`) | **SOBREVIVE-COM-RESSALVA** |
| 4 | funil de publicação + `new Date(null)` (`a68192fe3`) | **SOBREVIVE** |
| 5 | readers de payout em 503 sem `preHandler` (`36c491851`) | 🔴 **DERRUBADA (parcial)** |
| 6 | os dois ratchets descidos hoje | **SOBREVIVE** |

🔴 **Os dois defeitos que você mandou procurar existem, e são exatamente estes:**
· **elogio sem prova** → item 1 (*"o código foi convergido primeiro"*)
· **acusação sem alcance** → item 5 (*"estavam devolvendo erro cru de banco"*)

---

## 【1】 OS 9 ENUMS — **SOBREVIVE-COM-RESSALVA**

### O lado do banco: **exato, conferi rótulo a rótulo**
```
SELECT t.typname, string_agg(e.enumlabel,', ' ORDER BY e.enumsortorder)
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid ... GROUP BY 1
```
Os **9** estão minúsculos: `pdv_session_status(open,closed)` ·
`purchase_order_status(draft,submitted,confirmed,partially_received,received,cancelled,completed)` ·
`fulfillment_status(pending,picked,shipped,cancelled)` · `fulfillment_item_status(pending,picked)` ·
`inventory_reservation_status(active,released,consumed)` ·
`receipt_status(in_progress,completed,cancelled)` ·
`stock_transfer_status(draft,pending,shipped,received,cancelled)` ·
`fulfillment_source(pdv,marketplace)` · `inventory_reservation_source(marketplace,pdv)`.
Os **3 declarados intactos** estão intactos e MAIÚSCULOS:
`alert_severity(CRITICAL,ERROR,WARNING,INFO,AUDIT)` ·
`alert_type(INVENTORY_LOW_STOCK,…,RISK_SCORE_LOW)` · `inventory_movement_type(IN,OUT,ADJUSTMENT)`.
O uso de `ALTER TYPE … RENAME VALUE` é a escolha certa (preserva OID, reescreve o DEFAULT sozinho,
converte linha existente in-place) — e as 8 tabelas estavam vazias. **Nada a derrubar aqui.**

### 🔴 A RESSALVA — o elogio sem prova
O commit `151f27625` afirma: *"**The code was converged first** and the migration was not applied"*.
Varri os 9 escritores dessas 8 tabelas atrás de literal MAIÚSCULO sobrevivente:

```
grep -rnE "'(OPEN|CLOSED|DRAFT|SUBMITTED|…|PDV|MARKETPLACE)'" backend/src/modules/marketplace/{fulfillment,inventory-reservation,purchase-order,stock-transfer,stock-transfer-receipt,inventory-sla}* backend/src/modules/pdv/pdv.repository.ts
→ backend/src/modules/marketplace/inventory-sla.service.ts:253:  } else if (row.status === 'PENDING' && row.receiving_started_at) {
```

**É um `if/else` meio convertido, e a prova está dentro dele:**
- `:247` — `if (row.status === 'shipped' …)` ← **minúsculo, convergido**
- `:253` — `} else if (row.status === 'PENDING' …)` ← **MAIÚSCULO, esquecido**

Seis linhas de distância, mesma cadeia, mesma tabela (`FROM stock_transfers st`, `:225`) e mesmo
enum (`stock_transfer_status`, que hoje tem `pending`). **Efeito:** a segunda regra de SLA
(atraso em conferência) **nunca dispara** — `isOverdue` fica `false`, `overdueReason` fica vazio, e
o filtro `onlyOverdue` devolve menos linhas. **Não dá erro: comparação de string em JS, não
predicado SQL.** Silencioso por construção.

**Alcance — tracei até o handler, como você exigiu:** `inventory-sla.service.ts:getTransferSla` ←
`modules/reports/reports.routes.ts:280` (`return reply.status(200).send(sla)`) ←
`fastify.get('/reports/transfers/sla', { preHandler: [fastify.requirePermission(['reports:view_operational'])] })`
(`:207-208`), registrado em `app.builder.ts:716` sob `protectedScope`.
🟡 **`requirePermission` é o decorador cuja função SQL `actor_has_permission` faz `RETURN FALSE`
incondicional** (provado por mim em auditoria anterior) → **403 para todos hoje**.
**Portanto: defeito REAL, alcance LATENTE.** Não inflo: não é 500 vivo, é uma regra de negócio
morta esperando a FASE 6 do RBAC acender a rota.

---

## 【2】 CONTENÇÃO DE 9 MÓDULOS — **SOBREVIVE**

**"O hook vaza?"** — este era o ataque decisivo, porque `addHook('onRequest')` **vaza para o app
inteiro** se o plugin de rotas for embrulhado em `fastify-plugin`. Nesse caso os 9 módulos
derrubariam TODA a API com 501.
```
for f in <os 10 arquivos tocados>; do grep -c "fastify-plugin\|fp(" $f; done   → 0 em TODOS
```
**Nenhum usa `fp()`.** O `register` do Fastify encapsula por padrão, logo o hook morre no escopo do
plugin. **Não vaza.** ✅

**A contagem é 9 mesmo?** `grep -rln "containModule"` → `institutional-memory` · `pilot-events` ·
`pilot-human-observation` · `pilot-invites` · `user-group-allocation` · `human-mvp` · `loyalty` ·
`presence` · `work` = **9 módulos** (o 10º hit é o próprio arquivo que define a função). ✅

**Ataquei a exceção declarada:** 4 arquivos foram tocados **sem** receber hook
(`root-config`, `care`, `social-chat`, `subscription`), com a justificativa *"não há rota
alcançável hoje"*. Testei a justificativa: `grep -cE "<módulo>" app.builder.ts` → **0 para os
quatro**. Não estão registrados. A exceção é honesta. ✅

**"O guard morde?"** — `audit-product-scope-containment.mjs` está no runner
(`run-regression-guards.mjs:164`). O desenho da contenção é reversível como anunciado: uma linha
de `addHook`, nenhum handler tocado, corpo intacto. E o corpo do 501 separa
`out_of_product_minimum` de `revoked_by_law` com `reversible: true/false` — distinção correta e
que importa (`user-group-allocation` é revogado por LEI, não escopo).
**Não caiu.**

---

## 【3】 FROM-PRICE POR IGUALDADE — **SOBREVIVE-COM-RESSALVA**

**A regra "≤" era mesmo inútil?** Sim, e a prova está no dado: um evento com
`ticket_price_cents=5000` e setor mínimo `8000` **passa** num teste `5000 <= 8000` enquanto anuncia
uma vitrine mentirosa. A igualdade fecha isso.

**Ataquei a derivação por três lados:**
1. **Setor inativo barato envenenaria o MIN?** `information_schema.columns` de `event_sectors`:
   `id · tenant_id · event_id · sector_number · name · capacity · meia_quota_bps ·
   inteira_price_cents · meia_price_cents · created_at · updated_at`. **Não existe coluna de
   status/ativo** → não há setor "desligado" para contaminar o MIN. ✅
2. **`MIN` pode voltar NULL e quebrar a cadeia?** `inteira_price_cents` é **NOT NULL** → com setor,
   `MIN` nunca é NULL. E a cadeia (`min_sector ?? ticket_price ?? null`) cobre os 3 casos. ✅
3. **Persistiu algo?** Não — é subquery no read (`event.service.ts`), a coluna crua continua 5000
   no banco. Confere com o que o commit declara. ✅

### 🟡 RESSALVA — a subquery não tem predicado de tenant
```sql
(SELECT MIN(s.inteira_price_cents) FROM event_sectors s WHERE s.event_id = events.id)
```
Filtra só por `event_id`; `event_sectors.tenant_id` **existe e não é usado**. Mitigado hoje por
duas coisas que **medi**: `pg_class.relrowsecurity` → **`event_sectors` tem RLS ligado (true)**, e
`event_id` é UUID PK (colisão entre tenants é impraticável). Mas a casa exige tenant explícito em
leitura de vitrine, e a irmã `events` **não tem RLS** (`false`) — a proteção vem de uma camada só.
Custo de corrigir: um `AND s.tenant_id = events.tenant_id`. Gravidade: **AMARELA**.

---

## 【4】 FUNIL DE PUBLICAÇÃO / `new Date(null)` — **SOBREVIVE**

**Seu ataque era "a validação ficou permissiva demais?".** Li o bloco inteiro
(`event.service.ts:519-533`) e testei cada porta:

| porta | comportamento hoje | veredito |
|---|---|---|
| roda quando? | `if (input.datetimeStart \|\| input.datetimeEnd)` — só quando alguém mexe em data | correto |
| data inválida | `if ((startDate && isNaN(…)) \|\| (endDate && isNaN(…))) throw` — valida **quando existe** | correto |
| ordem | `if (startDate && endDate && endDate <= startDate) throw` — compara **só com as duas pontas** | correto |

**Não ficou permissiva: ficou EXATA.** O defeito anterior era o oposto — `new Date(null)` vira
**epoch 1970**, que passa em `isNaN` e falsifica qualquer comparação. Ausência de data é estado
válido (`datetime_start/_end` são NULLABLE no schema), e agora ausência é `null`, não 1970.
"Início sem fim é válido" é decisão de produto declarada, não frouxidão.

🟡 Dois pontos menores, declarados e não inflados: (a) `input.datetimeStart ?? event.datetimeStart`
usa `??`, então **enviar `null` explícito não limpa a data** — cai no valor guardado; é
comportamento de produto, não defeito de validação; (b) o próprio E2E do commit registra em voz
alta que **`publishEvent()` do backend não valida `datetime_start`** — o portão é de frontend.
**Isso está declarado pela direção, não escondido** — por isso não conta como achado meu.

---

## 【5】 READERS DE PAYOUT — 🔴 **DERRUBADA (parcial): a acusação sem alcance**

### A justificativa do commit é FALSA — e é o segundo defeito que você mandou procurar
Título de `36c491851`: *"the three readers left out of both containment waves **were returning raw
database errors**"*.

**Não estavam. Não podiam.** Antes do commit, os três tinham porteiro:
```
git show 36c491851^:backend/src/modules/payout/payout.routes.ts
:75   GET /payouts/batches            { preHandler: requirePayoutPermission }
:95   GET /payouts/batches/:batchId   { preHandler: requirePayoutPermission }
:131  GET /payouts/orders/:orderId    { preHandler: requirePayoutPermission }
```
E `requirePayoutPermission` (`:25-58`) chama
`businessAuthorizationService.requirePermission(tenant, user, actor, 'financial:execute_payout', 'payout')`.
Segui até o fim:
- `business-authorization.service.ts:47-52` — *"DECISION-0189A §5 (D7 — PORTA_HOLD): deny
  ESTRUTURAL também neste caminho legado"*, e testa `PORTA_HOLD_KEYS.includes(action)`.
- `company-policy-registry.ts` — o array contém **`'financial:execute_payout'`**.

**Logo: deny terminal → 403, ANTES de qualquer SQL, para qualquer chamador, inclusive o dono.**
Nenhum usuário jamais viu erro cru de banco nessas três rotas. A tabela `payout_orders` de fato
não existe (`to_regclass` → NULL, confirmei), mas **ninguém chegava nela**. A acusação parou no
`SELECT` e não seguiu até o porteiro — exatamente o padrão que você pediu para eu caçar.

### E a pergunta que você fez — "removi uma proteção que importava?" — **sim, para o dia seguinte**
- **Hoje:** indiferente. 403 e 503 negam igual, e o 503 uniforme **é melhor de forma**: 403 para
  quem tem a chave e 503 para quem não tem **vazaria quem a detém**. O argumento anti-enumeração
  está certo, o corpo é idêntico com e sem `actorId`, e o service **deixou de ser importado**
  (`payout.routes.ts:6`) — não há caminho para dado. Isso eu ataquei e não caiu.
- **No reabrir:** os **corpos dos handlers foram removidos**, não preservados como dead-code. Quem
  restaurar um reader escreve handler novo **num arquivo onde não há mais `preHandler` para
  copiar** — e a chave que o protegia é justamente a que a PORTA-01 segura.
- 🔴 **E o guard não cobre.** `audit-porta01-financial-hold.mjs` está no runner
  (`run-regression-guards.mjs:238`), mas lê **uma única rota**:
  `payoutRoutes.match(/'\/payouts\/orders'[\s\S]*?\}\);/)` (`:53`) e valida 503/`PORTA_01_CLOSED`
  só nela (`:61-62`). **`/payouts/batches`, `/payouts/batches/:batchId` e `/payouts/orders/:orderId`
  — os três contidos NESTE commit — não têm guard nenhum.** Reabrir qualquer um deles, sem
  `preHandler`, não fica vermelho em lugar nenhum.

**Correção exigida:** estender `audit-porta01-financial-hold.mjs` às três rotas novas (mesma forma
do teste existente), e **corrigir a entrada do cartório**: a justificativa é anti-enumeração +
higiene de contenção, **não** "erro cru de banco vazando".

---

## 【6】 OS DOIS RATCHETS — **SOBREVIVE** (e a diferença para o arco anterior importa)

Vim para este item esperando repetir o achado do arco passado (teto que desceu por **allowlist**,
não por conserto). **Não é o caso destes dois — e a distinção é técnica, não de confiança:**

**a) `query-param` 181→180.** O ganho tem de estar no CÓDIGO, não na lista. Testei o código:
```
grep -nE "req\.query|as any" backend/src/modules/payout/payout.routes.ts   → nenhum
```
Os `req.query.status as any` **sumiram de verdade** porque os handlers viraram `503` de uma linha.
A allowlist encolheu no mesmo commit por exigência do próprio guard (`:160-163`). **Ganho real.**

**b) `financial_vocabulary` 3884→3883 e `financial_ssot` 591→590.** Não aceitei o número do JSON:
**rodei o gate.**
```
node scripts/audit-red-gates-baseline.mjs
   financial-vocabulary: 3883 / max 3883
   financial-ssot: 590 / max 590
   typecheck (tsconfig.build): 0 / max 0
   GATE OK [red-gates-baseline]
```
A contagem é medida contra o código vivo e **não passa por allowlist nenhuma** — é a diferença
estrutural para o `schema-coherence-ratchet`, onde a contagem chega ao ratchet **já filtrada**
(`validate-schema-code-coherence.mjs:1000-1005`). Aqui não há essa camada. **Ganho real.**

🟡 **Ressalva honesta sobre a MÉTRICA, não sobre o ato:** a nota do próprio baseline registra que o
guard bateu em 3886 contra a direção e que ela *"encurtou os comentários em vez de subir o teto"*.
Isso é o comportamento certo — mas expõe que `financial_vocabulary` é **sensível a prosa**: dá para
mover o número escrevendo ou apagando comentário, sem tocar em acoplamento nenhum. O saldo líquido
aqui é real (3 chamadas a `payoutService` saíram das rotas), e a nota declara os dois componentes
sem maquiar. **Registro para que ninguém leia uma queda futura desse teto como dívida paga sem
olhar o que a moveu.**

---

## O QUE NÃO AUDITEI (declarado)
- **Não subi backend nem frontend; zero requisição HTTP.** Provas = SQL real no banco oficial,
  catálogo do Postgres, execução de 2 guards read-only e leitura de código/`git show`.
- **Dos 63 commits, auditei os 6 itens do mandato**, não o arco inteiro. Os outros ~57 seguem sem
  auditoria independente — o mandato escolheu o recorte, e eu declaro o denominador.
- **Não rodei o runner completo**; confirmei o cabeamento dos guards citados (`:164`, `:238`), não
  que os demais passam.
- **Item 1:** varri os escritores das 8 tabelas afetadas. **Não** varri `frontend/src` atrás dos
  mesmos 9 vocabulários — se houver contrato de tela em MAIÚSCULO para `purchase_order_status` ou
  `fulfillment_status`, ele quebra igual ao `service_order_status` do arco anterior, e **não está
  medido aqui**. É onde eu procuraria em seguida.
- **Item 2:** verifiquei que o hook não vaza por construção (ausência de `fp`); **não** subi o app
  para provar que uma rota de outro módulo continua 200 com os hooks ativos.
- `unificard_local` (aposentado) intocado.

---
*Read-only respeitado. Única escrita: este arquivo. Selo é ato de Clayton.*
