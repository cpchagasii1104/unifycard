# PARECER YALA — auditoria independente das 4 reclassificações da direção (2026-07-30)

**Auditora:** YALA (independente, responde a Clayton) · **Modo:** guardião, read-only absoluto.
**Ambiente de toda prova:** `unificard_dev` (banco OFICIAL hoje; `backend/.env` → `unificard_dev`).
**Mandato:** TENTAR DERRUBAR as 4 reclassificações que baixaram o placar de 8→5 (commits
`58dbccd75` · `2f9318588` · `ad8bd7d1b` · `1d79775bc` · `d4131e0e6`). Não confirmar — atacar.

---

## VEREDITO POR ITEM

| # | item | veredito |
|---|---|---|
| ① | `DT-RBAC-V2-REQUIRE-PERMISSION-DECORATOR-STRUCTURALLY-DEAD` → DESENHO | **DE PÉ** (com achado colateral) |
| ② | `event_custody sem tabela` → DORMENTE | **DERRUBADA (parcial)** — há caminho vivo → 500 |
| ③ | `Painel econômico A-1` → FALHA TARDIA (não perda) | **DE PÉ** na questão do dinheiro (+ achado na metade FE) |
| ④ | `F-EVENT-CREATION-CONTRACT-SWEEP` → DESENHO | **DERRUBADA (parcial)** — rota tem caller vivo |

**Veredito global do mandato: B** — duas reclassificações caem em parte. Nenhuma envolve perda de
dinheiro nem furo de autoridade explorável; as duas quedas são defeitos VIVOS de confiabilidade/UX
(500 e tela-branca), exatamente a família que a direção vinha subestimando ao parar no `INSERT`.

---

## ① RBAC `requirePermission` — **DE PÉ**

### O que ataquei
- **Rodei a função no banco oficial** (não li o comentário). `pg_get_functiondef(actor_has_permission)`
  em `unificard_dev` = `RETURN FALSE` incondicional, `STABLE`, sem ramo de concessão. O decorator
  `requirePermission`/`requireAnyPermission` (rbac.plugin.ts:145/190 → rbac.service.ts:124) nega tudo.
  **PROVADO.**
- **Persegui o `SHADOW_DENY_LEGACY_ALLOW` / `decision_legacy:true`** que o mandato apontou. Origem:
  `authorization.service.ts:912-937` (`calculateAndLogShadowDivergence`). É emitido quando o caminho
  **legado `canActAs` ALLOW** e o shadow (RBAC, sempre-deny) DENY. Como `actor_has_permission`
  retorna FALSE sempre, o shadow **sempre** nega → **todo** allow legado gera esse log. É ruído
  ESPERADO, não bypass do decorator. `canActAs` é uma fachada de autorização **separada** (ownership/
  delegação/company-grant), usada DENTRO dos handlers — não é fallback do `requirePermission`.
  **PROVADO que não derruba.**
- **Testei a rota do "500 mascarado"** que o próprio painel cita (`bank-balance-consolidation`):
  `bank-balance-consolidation.routes.ts:124` a gateia por `requirePermission(['admin:view_consolidated_balance'])`
  → deny-all → 403 antes do 500. A contenção vale ali. **PROVADO.**

### Por que não caiu
A DT é nominalmente sobre o **decorator `requirePermission`**. Ele é fail-closed documentado
(cita `AUTHORITY_PRECEDENCE.md §4.4`, nomeia a FASE 6), e a função viva confirma. Nenhum caminho
CONCEDE *através* dele. Reclassificação para DESENHO está correta.

### 🟡 ACHADO COLATERAL (não derruba, mas o painel omite) — PROVADO
`requireRole` **NÃO** é fail-closed. Usa outra função SQL: `actor_has_any_role` (rbac.service.ts:208),
que no banco oficial é uma **query REAL** contra `user_roles`/`roles` (SECURITY DEFINER, sem
`RETURN FALSE`). Medi no `unificard_dev`: **1 linha em `user_roles` com role `admin`** → para esse
usuário, `requireRole(['admin'])` **CONCEDE**. Há **10 arquivos de rota** usando `requireRole`
(companies, catalog-governance, categories, ssot-admin…). A seção do painel "a contenção que
sustenta o peso" afirma que a camada de decorators é uniformemente fail-closed ("44 rotas… tudo
mascarado"); isso **descreve só `requirePermission`**. `requireRole` é caminho de concessão VIVO.
Não é defeito em si (é RBAC legítimo por role), mas o inventário do painel está **incompleto** — e
quando a FASE 6 for religada, quem confiar em "está tudo fail-closed" vai errar o alcance real.

---

## ② `event_custody` — **DERRUBADA (parcial)**

### A alegação da reclassificação
"As **11 rotas `economic/v2` têm 501 como PRIMEIRA instrução do handler**, incluindo `custody`
(2753) e `payment/execute` (3213). Os serviços de pagamento só são alcançáveis por essas rotas.
Não existe caminho vivo." (painel:177 / commit `2f9318588`).

### O que ataquei e o que caiu — PROVADO
Abri as rotas **uma a uma** (a direção conferiu o 501 do POST custody em 2753 e generalizou). O 501
é a primeira instrução **só nos POST**. Mas:

- 🔴 **`GET /events/:eventId/economic/v2/custody`** (event.routes.ts:2809-2848) **NÃO tem 501**.
  Só checa `req.user`/`req.tenant`, **sem `preHandler`, sem `requirePermission`, sem `canRepresentActor`**,
  e chama `eventCustodyService.listCustodiesByEvent` (2834) → `SELECT * FROM event_custody`
  (event-custody.service.ts:306-322), **sem try/catch tolerante**.
- Confirmei no `unificard_dev`: `to_regclass('public.event_custody')` = **NULL**, e a query exata
  do service devolve **`ERRO: relação "event_custody" não existe`** (42P01).
- Cadeia: 42P01 → `catch` da rota (2840) → não é `NotFoundError` → **500 INTERNAL_ERROR** (2845).
  **Qualquer usuário autenticado do tenant** que chame a rota com um `eventId` UUID → 500.

Também: **`POST /events/:eventId/economic/v2/advance`** (2635) **não tem 501** — mas funciona (grava
em `event_outbox`, lê `event_log`/`payment_intents`, todas existentes). Ou seja, a família economic/v2
**não é** uniformemente contida por 501: das ~11 rotas, 8 têm 501; advance funciona sem 501; **GET
custody e GET split não têm 501** (GET split é benigno — `event-split-declarative.service.ts:28` usa
`Map` em memória, não tabela).

### Conclusão do item
A reclassificação está **certa** sobre os *serviços de pagamento* (`event-payment-execution/prepared`
só são chamados pelos POST 501-guardados — confirmei todos os callers). Está **errada** sobre
`event_custody`: existe caminho vivo e não-contido (GET custody) que bate na tabela-fantasma e
devolve **500 determinístico**. A frase "não existe caminho vivo" é falsa.
**Gravidade: LARANJA** (500 read-only; sem dinheiro, sem corrupção). `event_custody` **não é**
puramente dormente — permanece dívida viva pela porta do GET.

---

## ③ Painel econômico A-1 — **DE PÉ (dinheiro) + achado na metade FE**

### Refiz a aritmética do zero (não conferi — recalculei) — REFUTADO "paga mais que o total"
`calculatePolicySplits` (economic-policy-engine.service.ts:231-304): por linha, floor(amount·bps/10000)
ou fixo; `drift = amount − Σ`; drift joga na **primeira** `revenue_share`; recalcula; se drift residual
≠ 0 → `CALCULATION_INVALID`; se qualquer split < 0 → `CALCULATION_INVALID`. Fixtures hostis que
montei:
- **fixo + bps=100%** (fee fixo 200 + rev_share bps=10000, amount=1000): fee=200, rs=1000, drift=−200
  → rs=800 → Σ=1000. Conserva.
- **duas `revenue_share`** (bps 5000 + 8000, amount=1000): 500+800, drift=−300 → rs[0]=200 → Σ=1000.
  Conserva (redistribui, mas não vaza).
- **só-fixo estourando** (fee 100000 + rev_share 100000, amount=1000): drift=−199000 → rs=−99000 <0
  → **CALCULATION_INVALID**.
- **bps=0 / sem revenue_share**: absorvido ou `DRIFT_NO_REVENUE_SHARE`.

**Invariante provada:** havendo `revenue_share`, `Σ == amount` no retorno (drift recalculado sobre
inteiros, exato) OU lança. **A plataforma nunca paga mais que `amount`.** A alegação original de perda
de dinheiro **não se sustenta**. O rebaixamento para FALHA TARDIA está **correto**: policy só-fixa
inválida publica limpa e só quebra no pagamento — decisão (permitir só-fixo? exigir mínimo?), não
conserto de executora. **PROVADO.**

### 🟡 Metade FE (a direção declarou NÃO auditada — eu auditei) — PROVADO
`admin/EconomicPoliciesPage.tsx:464`: `sumOk = bpsLines.length === 0 || (bpsSum === 10000 && hasRevenueShareAmongBps)`.
`canSubmit` (479-488) **exige `sumOk`**. Para policy **só-fixa** (`bpsLines.length===0`) → `sumOk=true`
→ indicador verde ("Nenhuma linha percentual… só valores fixos", 1017-1018) → botão habilitado.
Mas o FE só cobra `revenue_share` **entre linhas bps** (`hasRevenueShareAmongBps`, 463), enquanto o
BE (pós-fix) **exige `revenue_share` incondicionalmente** (economic-policy-write-validation.ts:209).
**Divergência FE/BE:** uma policy só-fixa **sem** `revenue_share` mostra verde e é submetível no FE,
mas o BE rejeita com **400**. O indicador do FE não foi atualizado quando a exigência saiu do bloco
`hasBpsLine`. **Fail-closed** (BE barra; nada ruim persiste). **Gravidade: AMARELA** (verde enganoso
+ erro de servidor; sem dinheiro, sem dado ruim). Não ressuscita a reclassificação — só mostra que
A-1 **não** está limpa: resta a falha-tardia (laranja, decisão) + esta divergência FE (amarela).

---

## ④ `F-EVENT-CREATION-CONTRACT-SWEEP` — **DERRUBADA (parcial)**

### Metade da ROTA — REFUTADO "nenhum caller"
A reclassificação (commit `58dbccd75`) diz: *"varredura do frontend/src não achou nenhum caller;
rota que não existe e ninguém chama é ausência, não defeito."* **Falso.** Grep no `frontend/src`:
- `EventCreationGuidedFlow.tsx:399` — `handleStep7Complete` (botão **Finalizar** da etapa 7):
  `navigate('/events/${data.event_id}/economic')`.
- `EventCreationGuidedFlow.tsx:619` — `Step7FinalSummary onAdvanceToEconomic`: mesma navegação.
- O componente está **montado**: `pages/EventCreationPage.tsx:33` o renderiza na rota `events/new`
  (App.tsx:344) e `components/social/IntentComposer.tsx:798` também.
- App.tsx registra **só** `events/:id` (343) e `events/new` (344) — **não** `events/:id/economic`,
  sem rota aninhada, **sem catch-all `path="*"`**. React-router não casa `events/:id/economic` →
  `<Routes>` renderiza **null → tela branca**.

Ou seja: concluir o fluxo guiado de criação de evento (o que Clayton clicou) **navega para uma rota
inexistente → tela branca**. É defeito VIVO no fim de um fluxo central, não "ausência que ninguém
chama". **PROVADO. Gravidade: LARANJA** (UX quebrada, sem dinheiro/dado).

### Metade da COLUNA — a reclassificação **fica de pé** como desenho
`event_type` órfão de escrita é **deliberado**: `event.service.ts:188` declara o caminho format-first
(Lei 7), identidade em `event_format_concept_id`. Confere. **Mas** medi o dado no `unificard_dev`:
`events` = 20 linhas · `event_format_concept_id` preenchido em **5** · `event_type` em **9**. A
identidade **não sumiu** (5 eventos format-first têm o conceito), mas a migração está **longe de
universal** (15/20 sem conceito de formato; 11/20 sem nenhum dos dois). Não é perda, é migração
parcial — e `Step7FinalSummary` que lê `event_type` mostra "Tipo: Não definido" para a maioria
(cosmético, deliberado).

---

## O QUE NÃO AUDITEI (declarado)
- Não subi o backend nem fiz chamada HTTP real autenticada: as provas de 500 (② GET custody) e de
  rota-branca (④) são por **caminho de código + query real no banco / registro de rotas**, não por
  request ao vivo. O 42P01 é determinístico (query exata rodada no banco); a tela-branca é dedução
  do registro de rotas do react-router (sem catch-all).
- Não auditei as **outras ~8 rotas economic/v2** com 501 quanto a efeito colateral antes do 501 (li
  o custody e o execute, ambos com o `return 501` como 1ª instrução incondicional).
- Não reauditei a cadeia inteira de `canActAs` (só o suficiente para provar que o
  `SHADOW_DENY_LEGACY_ALLOW` é o caminho legado, não bypass do decorator).
- `unificard_local` (aposentado) não foi tocado.

---

## CORREÇÕES EXIGIDAS (o placar precisa refletir isto)
1. **② event_custody:** manter como **VIVA** (não dormente). Conter o `GET /economic/v2/custody`
   (event.routes.ts:2809) com o mesmo 501 dos POST, OU dar a `listCustodiesByEvent` leitura tolerante
   à tabela ausente. Coluna "Prova" deve citar **o caminho até o 500** (GET → service → 42P01), não o
   `arquivo:linha` do INSERT.
2. **④ F-EVENT-SWEEP:** manter a **metade da rota como VIVA** (tela-branca no fim do fluxo). Registrar
   `events/:id/economic` OU trocar os dois `navigate` (EventCreationGuidedFlow.tsx:399,619) para
   destino existente. A metade `event_type` fica como desenho.
3. **③ A-1 (FE):** abrir item **AMARELO** para a divergência FE/BE — alinhar `sumOk`/`canSubmit`
   (EconomicPoliciesPage.tsx:464,479) à exigência incondicional de `revenue_share` do BE
   (economic-policy-write-validation.ts:209).
4. **① painel:** corrigir a seção "contenção que sustenta o peso" para registrar que `requireRole`
   (`actor_has_any_role`, 10 rotas, 1 admin vivo) é caminho de **concessão**, não fail-closed —
   sob pena de subestimar o alcance quando a FASE 6 for religada.

---
*Fim do parecer. Nada foi escrito fora deste arquivo.*
