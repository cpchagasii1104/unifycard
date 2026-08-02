# PARECER YALA — MANDATO F · arco pós-parecer-E (~20 commits) + amostra dos antigos · 2026-08-02

**Categoria:** AUDITORIA INDEPENDENTE — parecer de instância adversarial (Mandato F), sucede D e E.
**Status:** VIGENTE · emitido 2026-08-02 sobre `e44d8f355..9c61c0108` (branch `rescue-structural`). **Prova datada, não estado** — releia rodando os comandos colados.
**Fonte canônica:** NÃO É FONTE, é PARECER. A fonte é o CÓDIGO e o BANCO que ele mede; onde divergir, o comando vence o texto.
**Obrigatório:** SIM para quem for selar qualquer commit deste arco — **1 defeito-raiz VIVO não corrigido**, **1 ponteiro deslocado que a varredura não pegou**, **1 mudança de norma que não é conserto de ponteiro**.
**Governado por:** `docs/01_normative/00_AGENT_PROTOCOL.md` — rito GATE → GO → executora → verificação da direção → auditoria independente → selo. ⚠️ **Parecer não é selo. Selo é ato de Clayton.**

**Banco de TODAS as provas: `unificard_dev`** (oficial, **556** migrations). Só `SELECT`, catálogo do
Postgres, execução de guards read-only e um script de leitura próprio. **Zero escrita. Zero `dropdb`.**

| # | item | veredito |
|---|---|---|
| 1 | 3 migrations + DELETE de 59 linhas | **SOBREVIVE-COM-RESSALVA** |
| 2 | emendas nas duas Leis | **SOBREVIVE-COM-RESSALVA** — 1 ponteiro escapou · 1 emenda **não é** conserto |
| 3 | remoção do trust em payout | **SOBREVIVE** — mas 🔴 **a raiz continua viva** (a quinta) |
| 4 | detector de case-drift | **SOBREVIVE** — buraco real, **exposição zero hoje**; baseline heterogênea |
| 5 | getStats/getPenalties + teto 353→349 | **SOBREVIVE** — descida por conserto, allowlist intocada |
| 6 | amostra dos antigos | **fechou o meu próprio achado anterior** |

---

## 【1】 AS 3 MIGRATIONS + O DELETE — **SOBREVIVE-COM-RESSALVA**

### O banco confere, rótulo a rótulo
```
psql> SELECT t.typname, string_agg(e.enumlabel,', ' ORDER BY e.enumsortorder) …
 alert_type              | inventory_low_stock, inventory_out_of_stock, payment_failed, payout_failed,
                           fiscal_pending, order_expired, reservation_expired, other, risk_score_low
 inventory_movement_type | in, out, adjustment
psql> SELECT pg_get_constraintdef(oid) … conrelid='actor_debts'
 CHECK (status = ANY (ARRAY['pending','transferred_to_organizer']))
```

### Lei 5 — os invariantes do ledger físico permanecem, e por um motivo trivial
```
psql> SELECT movement_type, count(*) FROM inventory_movements GROUP BY 1;   → 0 linhas
```
**A tabela está vazia.** A conversão do enum não tocou dado nenhum do ledger; não houve remapeamento
de semântica, só de grafia (`IN→in`), e o writer (`inventory-movement.repository.ts:76,119`) passa
`input.movementType` já tipado minúsculo (`inventory.types.ts:8`). O allowlist da rota também é
minúsculo (`marketplace-inventory.routes.ts:18-22`). **Backend inteiramente convergido.**

### O DELETE — a direção provou o que disse
```
psql> SELECT count(*) total, count(*) FILTER (WHERE t.id IS NULL) tenant_orfa
      FROM availability a LEFT JOIN tenants t ON t.id=a.tenant_id;      → 8 | 0
psql> SELECT a.owner_type, count(*), count(*) FILTER (WHERE ac.id IS NULL AND a.owner_type='actor')
      FROM availability a LEFT JOIN actors ac ON ac.id=a.owner_id GROUP BY 1;   → page | 8 | 0
```
Sobraram **8**, **nenhuma** órfã por tenant, todas `owner_type='page'` e **nenhuma** com owner
ausente. **Não sobrou órfã por outro critério.** `bookings` segue em 0 — o vetor que eu havia
nomeado no Mandato E (JOINs sem `a.tenant_id`) continua sem material para atravessar.

### 🟠 RESSALVA — o par que escapou DESTA vez está no frontend, e é o **write** do ledger físico
```
frontend/src/components/marketplace/MarketplaceInventory.tsx:189-192
   <select name="movementType" required>
     <option value="IN">Entrada</option>  <option value="OUT">Saída</option>  <option value="ADJUSTMENT">Ajuste</option>
frontend/src/api/marketplace.ts:711,804     movementType: 'IN' | 'OUT' | 'ADJUSTMENT'
psql> SELECT 'IN'::inventory_movement_type;   → ERRO: valor de entrada é inválido … "IN"
psql> SELECT 'in'::inventory_movement_type;   → in
```
**Mas tracei até o handler antes de acusar, e o dano é menor do que parece:**
- O `addMovement` faz **POST** `/marketplace/inventory/movements`; no backend **não existe rota POST
  nesse path** — `grep -rn "'/inventory/movements'"` devolve **um único** sítio,
  `marketplace-inventory.routes.ts:129`, que é **GET**. → **404, não 22P02.**
- No GET, `movementType` é validado contra `ALLOWED_MOVEMENT_TYPES` (minúsculo) e devolve **400 com
  a lista permitida** (`:184-186`). → **falha visível, não silenciosa.**

**Conclusão honesta:** é divergência real de contrato, e o formulário está morto — mas **não é o
gêmeo silencioso do caixa do PDV**. Aqui o sistema grita (404/400); lá ele mentia (`totalPaid=0`).
Gravidade **AMARELA**. Não inflo.

---

## 【2】 AS EMENDAS — **SOBREVIVE-COM-RESSALVA**, com duas separações que importam

### 2.1 As 9 correções off-by-one estão **CORRETAS** — conferi contra os títulos reais
```
grep -nE "^### 2\.2\.[5-8]" docs/01_normative/00_AGENT_PROTOCOL.md
 200: ### 2.2.5 PROIBIÇÕES        206: ### 2.2.6 AMBIGUIDADE DE DOMÍNIO
 216: ### 2.2.7 PRECEDÊNCIA       238: ### 2.2.8 CONTRATOS DE API HTTP
```
Todas as remissões que diziam *ambiguidade → 2.2.5* passaram a **2.2.6**, e *precedência → 2.2.6*
passaram a **2.2.7**. **Nenhuma delas estava certa no original** — o deslocamento é uniforme e o
destino agora bate com o título. ✅

### 2.2 🔴 SOBROU UMA — a varredura não pegou
```
sed -n '440p' docs/01_normative/00_AGENT_PROTOCOL.md
 "Após cumprir o bootstrap (2.2.1), a prova (2.2.2), o carregamento modular … (2.2.3 …),
  e **2.2.5–2.2.6** quando aplicável — …"
```
É a **mesma construção** que foi corrigida no parágrafo irmão (que virou "**2.2.6 / 2.2.7**"), e
aqui ficou intacta. Como está, a obrigação passa a incluir **2.2.5 = PROIBIÇÕES** e a **excluir
2.2.7 = PRECEDÊNCIA** — exatamente a norma que o resto da emenda trabalhou para tornar citável.
Grau: **PROVADO** · gravidade **AMARELA** (norma, não runtime — mas é a norma que governa como toda
instância lê as outras).

### 2.3 A obrigação "declarada ausente" é conserto legítimo — **fico com esta leitura, e digo por quê**
A LEI citava *"**2.2.8** — Validação de coerência sistémica"*. A 2.2.8 real é **Contratos de API
HTTP**. Testei a hipótese alternativa (a seção existiria com outro número):
```
grep -niE "coer.ncia sist" docs/01_normative/00_AGENT_PROTOCOL.md   → 0 linhas
```
**O protocolo nunca teve seção de validação de coerência sistémica, sob número nenhum.** A obrigação
citada **não tinha alvo desde sempre**, e o dever substantivo vive no próprio
`LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — o documento que carregava a citação quebrada. Retargetar
para a 2.2.8 real teria **criado** uma obrigação de OpenAPI que ninguém promulgou. **É conserto de
ponteiro, não remoção de dever.**

### 2.4 🟡 MAS UMA DAS EMENDAS **NÃO** É CONSERTO DE PONTEIRO — e Clayton precisa saber
```diff
- executar SQL direto sobre … `bank_ledger`, `bank_transactions`, `bank_accounts`;
+ executar SQL direto sobre … `bank_ledger`, `bank_transactions`, `bank_accounts`, `bank_splits`
+   (emenda 2026-08-02, ratificada: … a lei estava mais estreita que o próprio gate);
```
Isto **acrescenta uma proibição** ao §4.6. É **mudança de norma**, não correção de remissão — e o
texto assume isso ("emenda… ratificada"). A direção do efeito é **restritiva** (alinha a Lei ao que
`validate-schema-code-coherence.mjs:636` já cobria), então o risco de abuso é baixo. **Ainda assim:
a ratificação verbal foi para "corrigir ponteiros quebrados"; alargar o §4.6 é outra coisa.**
Recomendo confirmação explícita de Clayton **sobre este item isolado** — não sobre o pacote.

---

## 【3】 PAYOUT — **SOBREVIVE**, e no meio dele está a QUINTA

### (b) Reproduzi a lógica — a alegação é **verdadeira**, e provei sem escrever
```
backend/src/modules/trust/trust.repository.ts:129-135
   INSERT INTO trust_profiles (profile_id, tenant_id, actor_id, current_score, risk_level)
   VALUES ($1,$2,$3,$4,$5)     values: [profileId, tenantId, actorId, 70, 'MEDIUM']
psql> SELECT pg_get_constraintdef(oid) … 'trust_profiles_risk_level_check'
   CHECK (risk_level = ANY (ARRAY['low','medium','high','critical']))
psql> SELECT 'MEDIUM' = ANY(ARRAY['low','medium','high','critical']);   → f
psql> SELECT count(*) FROM trust_profiles;                              → 0
```
`getOrCreateProfile` insere **`'MEDIUM'`** contra um CHECK **minúsculo** → **23514**. E como a tabela
tem **0 linhas**, **todo** actor cai no ramo de criação. O passo não passava em silêncio: **quebrava**.
Confirmado.

### (a) e (c) — o que consegui e o que **não** consegui
- **(a) "o gate canônico roda antes nos dois caminhos":** `grep -rn "validatePayoutEligibility"`
  fora do próprio service devolve **apenas um comentário** (`payout.types.ts:107`). **Não achei os
  "dois caminhos"** para comparar — a função não tem caller externo hoje. A alegação **não é
  verificável como enunciada**; o que é verificável é que a remoção não desprotege nada, porque
  nada a chama.
- **(c) "zero consumidores" de `riskLevel`/`trustScore`:** apliquei a lição do import dinâmico —
  procurei `await import(`, re-export por índice e spread do resultado. **Não achei consumidor**,
  dinâmico ou estático. Sobrevive.

### 🔴 A QUINTA — a raiz continua viva, e a remoção do payout tirou **um** caller de **seis**
`getOrCreateProfile` (o do trust, não o de `risk-identity`) **não foi tocado**. Continua inserindo
`'MEDIUM'`. Callers vivos que restaram:
```
modules/trust/trust-engine.service.ts:121,164,191,252   (registerTrustEvent, getTrustProfile, …)
modules/trust/trust.routes.ts:139        POST /api/trust/events → registerTrustEvent
modules/agreements/agreement.service.ts:261,270         → registerTrustEvent
modules/evidence/evidence.service.ts:140                → registerTrustEvent
modules/bypass-detection/bypass-detection.service.ts:168 → getTrustProfile
modules/agreements/agreement.service.ts:330             → detectValueBypass
```
**Alcance que eu tracei:** `POST /api/trust/events` está sob `requireTrustManage`, que exige
`can_manage_tenant_trust` via `tenant_operator_grants` — e
`SELECT count(*) FROM tenant_operator_grants` → **0**. **403 hoje**, logo essa porta é **latente**.
**O que NÃO tracei:** as rotas que chegam a `agreement.service` e `evidence.service` — esses chamam
`registerTrustEvent` **internamente**, e não segui cada uma até o handler. **Declaro como
não-auditado**, e é exatamente onde eu procuraria a sexta.

**A frase que resume:** a direção descreveu o crash com precisão no commit, removeu **o caller** e
**deixou a causa**. O commit é honesto; o conserto é parcial.

---

## 【4】 O DETECTOR — **SOBREVIVE**: o buraco existe, a exposição é **zero hoje**

### O buraco é real e eu o nomeio com precisão
`audit-case-drift-ratchet.mjs:168-184` monta `exact` como a **união dos vocabulários de TODAS as
tabelas do arquivo** e absolve qualquer literal que bata exato em **qualquer** um deles. Logo, em
arquivo que toque duas tabelas com vocabulários que colidem por case, o drift de uma é absolvido
pela outra. **O espaço de colisão existe e é grande** — 16 valores, medidos no banco:
```
ack   → alerts=ack | chat_reports=ACK          open  → alerts=open | chat_reports=OPEN | pdv_sessions=open …
critical → trust_events=CRITICAL | trust_profiles=critical      online → events=online | live_presence=ONLINE
person → actors=person | event_occupancy_models=PERSON          hybrid → economic_policies=HYBRID | events=hybrid
```

### Mas a exposição, hoje, é **ZERO** — e não aceitei isso por leitura: **rodei**
Reimplementei a lógica do próprio detector (vocabulário lido do banco vivo: enums **+** CHECKs com
`ANY`) contra **todos** os `.ts` de `backend/src` (exceto testes), procurando literal que seja
`exact` por uma tabela **e** drift por outra do mesmo arquivo:
```
node yala-hole-tmp.mjs   →  total expostos: 0        (script temporário, removido após a corrida)
```
**Nenhum arquivo vivo cai no buraco hoje.** Ele é uma bomba de gatilho futuro: basta um arquivo
passar a tocar duas tabelas de um dos 16 pares. **Recomendo** que a absolvição seja **por tabela**
(literal só é absolvido pelo vocabulário da tabela a que ele se refere), não pela união.
🟡 Nota adjacente: `companies` autoriza **as duas grafias** (`ACTIVE`+`active`, `SUSPENDED`+`suspended`)
— arquivo que toque só `companies` absolve ambas por construção. É a coluna que a própria direção
já nomeou em `093996c17`.

### 🔴 A baseline de 38 é **heterogênea** — amostrei 5 e nenhuma classificação distingue os tipos
| entrada | o que é de verdade |
|---|---|
| `trust.repository.ts::MEDIUM::trust_profiles` | 🔴 **CRASH VIVO (23514) estacionado na baseline** — é o mesmo defeito do §3, que a direção descreveu no commit de payout e não consertou |
| `financial-report.service.ts::SUCCESS::payment_transactions` | drift real (`pt.status='SUCCESS'` somaria 0) — **hoje contido em 501**, e ✅ **com `preHandler` PRESERVADO**, citando *"a lição das 6 rotas do parecer Yala"* (`reports.routes.ts:158`) |
| `event.repository.ts::DRAFT::events` | **falso positivo** — é MAPPER: `if (v === 'draft') return 'DRAFT'` (`:31`), tradução deliberada DB→API |
| `actor-page.repository.ts::CANCELLED::events` | **falso positivo** — `status NOT IN ('cancelled','CANCELLED')` (`:160`), cobre as duas de propósito |
| `checkout-ticket.service.ts::ACTIVE::events` | **atribuição errada** — o literal é de `event_tickets`, que **não tem CHECK de status** (`pg_constraint` só tem `price_cents>=0` e `quantity_total>0`) |
**1 de 5 é falha viva; 2 de 5 são falsos positivos; 1 é atribuição errada.** A baseline mistura as
três naturezas sem rótulo — e a que mais importa (o crash) está no mesmo saco das cosméticas.
**Correção:** separar por natureza (`FALHA-VIVA` / `MAPPER` / `DEFENSIVO` / `ATRIBUIÇÃO-INCERTA`) e
tirar `MEDIUM` da baseline — baseline não é lugar de defeito que levanta exceção.

---

## 【5】 getStats/getPenalties + 353→349 — **SOBREVIVE**

**A descida é conserto, não allowlist** — foi exatamente o ataque que derrubou o teto no Mandato D:
```
git show 3fd9e61f7 -- backend/scripts/schema-coherence-ratchet-baseline.json | grep '^-'
 -  "core/reputation/trust.service.ts::actor_penalties::FROM::C1-GHOST-READ::CORRUPTOR::vivo": 2,
 -  "core/reputation/trust.service.ts::event_participants::FROM::C1-GHOST-READ::CORRUPTOR::vivo": 2,
git show 3fd9e61f7 --stat | grep -i allowlist      → (vazio)
```
**2 chaves × 2 ocorrências = 4 = a descida 353→349**, e **a allowlist não foi tocada**. As queries
foram **removidas**, não isentadas. ✅

**A semântica não regrediu porque não havia semântica** — e isto é o ponto:
```
psql> actor_penalties=AUSENTE | event_participants=AUSENTE | event_attendees=event_attendees
diff: -  COUNT(CASE WHEN attendance_status = 'PRESENT' …)   -  FROM event_participants UNION ALL FROM event_attendees
      +  COUNT(CASE WHEN status = 'attended' …)             +  FROM event_attendees
```
A query antiga fazia `UNION ALL` com uma tabela **ausente** e lia `attendance_status`, **coluna que
`event_attendees` não tem**. Ela **nunca executou** — era 42P01/42703. Não há comportamento anterior
a preservar; a comparação "antes contava UNION" pressupõe que contava, e não contava.
**Sobre "0 provável, não desconhecido" em `getPenalties`: aceito a distinção**, com a condição que a
própria direção cumpriu — a tabela não existe **e** nenhuma outra fonte de penalidade existe, então
`0` é afirmação sobre o mundo, não sobre a leitura.
🟡 **Ressalva de contrato:** `left_early` **saiu** do retorno. Consumidor que tipava esse campo perde
a chave — ainda que antes recebesse erro, não número.

---

## 【6】 AMOSTRA DOS ANTIGOS — comecei pelo que me devolve a régua

Escolhi por risco: **os guards e as contenções**. O primeiro que ataquei fecha o meu próprio achado:
```
backend/scripts/audit-contained-route-antireopen.mjs   (runner: run-regression-guards.mjs:239)
node scripts/audit-contained-route-antireopen.mjs
 → GATE OK — as 6 rotas contidas (3 payout 503 · 3 métricas 501) mantêm o código de contenção,
   e nenhum símbolo de service reapareceu sem a proteção original (requirePayoutPermission / canViewEvent).
```
**As 6 rotas que eu apontei como "contidas sem guard" nos Mandatos D e E agora têm guard, no runner,
verde, e ele exige a proteção original de volta se alguém reabrir.** O padrão que nomeei foi
corrigido na causa, não no caso.
⚠️ **A amostra parou aqui.** Não é preguiça: os ~57 antigos continuam sem auditoria e eu prefiro
declarar isso a fingir cobertura — ver denominador.

---

## O QUE NÃO AUDITEI (denominador declarado)
- **Zero HTTP.** Nenhuma rota foi chamada. Todas as provas são `SELECT`/catálogo no banco oficial,
  execução de 2 guards read-only, um script de leitura próprio (removido) e `git show`.
- **§3:** não tracei até o handler as rotas que chegam a `agreement.service` e `evidence.service`,
  que chamam `registerTrustEvent` **internamente**. É a lacuna mais provável para a **sexta**.
- **§1:** não varri o frontend inteiro atrás de `alert_type` e `actor_debts` — só os literais dos
  três vocabulários nos módulos correspondentes.
- **§4:** o teste do buraco cobre `backend/src/**/*.ts` **exceto** testes; **não** cobre
  `backend/scripts/`, `frontend/src` nem `.mjs`. Amostrei **5** das 38 entradas da baseline; **33
  seguem sem conferência**.
- **§2:** conferi as remissões `2.2.x` nos **dois** documentos emendados; **não** varri os demais
  arquivos de `01_normative/` atrás de remissões deslocadas para as mesmas seções.
- **§6:** amostra de **1** commit. **Os ~57 antigos seguem sem auditoria** — terceira vez que declaro.
- `unificard_local` (aposentado) intocado. Nenhum item **selado** foi derrubado neste parecer.

---
*Read-only respeitado. Única escrita: este arquivo. **Parecer não é selo — selo é ato de Clayton.***
