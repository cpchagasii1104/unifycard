# DECISION-0113 — ActionContext.actorId é hint não-soberano: autoridade exige binding com o principal autenticado (Opção 3 híbrida)

**Data:** 2026-06-07
**Tipo:** Arquitetura / Autoridade / Segurança (autoria & ownership) — **docs-only**
**Status:** PROMULGADA (docs-only) — **emenda** os contratos vigentes (`ACTIONCONTEXT_CONTRACT`, `RBAC_V2_CONTRACT`) e **governa** a sequência de remediação. **NÃO** contém código/migration/Bank/frontend/middleware/rbac runtime. A primeira fatia de código (`F-RBAC-PLUGIN-BIND-REQ-USER`) é autorizada-por-norma mas executada em fatia própria.
**Frente:** `D-ACTIONCONTEXT-ACTORID-OWNERSHIP-BINDING` (cartório institucional, após `F-ACTIONCONTEXT-ACTORID-OWNERSHIP-AUDIT` READ-ONLY)
**HEAD de origem:** `8db09ceb`
**Decisor:** Clayton (Opção 3 híbrida cravada no go de `D-ACTIONCONTEXT-ACTORID-OWNERSHIP-BINDING`)
**Deriva de / subordinada a:** `CONSTITUICAO_UNIFICARD`, `LEIS_OPERACIONAIS_UNIFICARD`, `AUTHORITY_PRECEDENCE` (autoridade > produto; vence a trava mais restritiva), `SSOT_REGISTRY_UNIFICARD §5.1/§5.16`, `AUTHORITY_LAW`/`AUTHORITY_ENFORCEMENT_MODEL`, `DECISION-0088`/`0094`/`0112 §10 A4` (resolver server-side; posse de ID não é autorização).
**Emenda (supersede parcial):** `docs/06_technical/authority/ACTIONCONTEXT_CONTRACT.md` (§3.1/§4/§6.2/§6.3) e `docs/06_technical/authority/RBAC_V2_CONTRACT.md` (§4/§7.1/§11) — ver §4 desta DECISION.
**Vinculada a:** `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` (governada por esta DECISION; inventário da auditoria persistido nela), `kyb-document-submit.service.ts` (precedente correto), `require-permission.guard.ts` (primitivo correto), `authorization.service.ts::canActAs`.

---

## 1. Contexto / gap (auditoria READ-ONLY `F-ACTIONCONTEXT-ACTORID-OWNERSHIP-AUDIT`, HEAD `8db09ceb`)

- **Raiz (confirmada de 1ª mão).** O `action-context.middleware` popula `req.actionContext.actorId` de header/body/query e valida **só** presença + `scope ⊇ tenantId` — **zero SELECT em `actors`**. Logo `actionContext.actorId` é **client-declared e spoofável**. O drift é **normativo**: o `ACTIONCONTEXT_CONTRACT §4/§6` e o `RBAC_V2_CONTRACT §4/§7/§11` **proíbem referenciar `req.user`** — o design spoofável é mandado pelo contrato vigente.
- **Amplificador sistêmico (confirmado).** `plugins/rbac.plugin.ts` (`requireRole`/`requirePermission`/`requireAnyPermission`) decide **só** com `actorId+intent+scope` (`rbacService.actorHasAnyRole(tenantId, actorId, …)`), sem `req.user`. Resultado: **todo `requireRole(['admin'])` é spoofável** — basta declarar um actorId que detenha a role. Isso rebaixa inclusive as rotas admin de KYB. (Atenção à colisão de nomes: o `requirePermission` de `rbac.plugin` é spoofável; o de `require-permission.guard.ts` → `canActAs(req.user.id,…)` é o correto.)
- **Raio medido.** **425 ocorrências de `actionContext.actorId` em 63 arquivos**, incluindo money-sensitive (unifycard/settlement/accounts-*/services-pay/events-money/ledger) e authority-sensitive (company-members/organization/plan/profile-C1/lifestyle). **NÃO** todas exploráveis — subconjunto que confia no actorId cru para autoria de escrita **sem** gate; classificação completa persistida no DT.
- **Primitivo correto JÁ EXISTE.** `require-permission.guard.ts → authorityService.canPerformAction → authorizationService.canActAs(tenantId, req.user.id, actorId)` prova `actor.user_id===userId` / ownership de entidade / delegação ativa. `kyb-document-submit.service.ts` (ensureUserActor(req.user)+canManageCompany), `confirm-first-access` (req.user.id), `pdv`/`dashboard`/`reports` (via guard) e social V2 `createPost`/`castVote` já fazem certo. A remediação é **propagar este padrão**, não inventar.

**Tese central (vinculante):** `actionContext` é a **declaração explícita do contexto operacional** — quem age, com que intenção, em que escopo — e isso é ótimo para rastreabilidade/auditoria/intent. **Mas declarar ≠ autorizar.** A autoridade soberana não pode repousar sobre uma string declarada pelo cliente. **Crachá impresso em casa não é credencial.** Autoria/autoridade exige que o **principal autenticado (`req.user`)** esteja **habilitado a agir como** o `actorId` declarado.

## 2. O que esta DECISION promulga (D1–D9)

- **D1 — `actionContext.actorId` é HINT operacional não-soberano.** Declara quem age (preserva intent/source/scope/auditoria), mas **não é, por si só, prova de autoria nem de autoridade**.
- **D2 — Autoridade soberana exige BINDING com o principal autenticado.** Critério canônico: **`actorId ∈ canActAs(req.user)`** — ownership (`actor.user_id === req.user.id`) **OU** delegação ativa — verificado **server-side** via `authorizationService.canActAs(tenantId, req.user.id, actorId)` **ou** gate específico equivalente (`companiesService.canManageCompany`, `ensureUserActor(req.user.userId)` + vínculo explícito). **Posse/declaração do ID não basta.**
- **D3 — RBAC não decide só com actorId declarado.** `requireRole`/`requirePermission`/`requireAnyPermission` **devem** provar `actorId ∈ canActAs(req.user)` **antes** (ou como parte) do lookup de role/permission. O RBAC **passa a poder/dever consultar `req.user`** para esse binding (emenda às proibições vigentes — §4). A decisão final ainda se expressa como `actorId+intent+scope`, mas **só após** provar que o principal pode representar o actorId.
- **D4 — Rota user-facing: autoria server-side.** O padrão canônico é `req.user.userId → ensureUserActor() → canActAs/canManageCompany/authority gate`. `actionContext.actorId` serve para **declaração/auditoria**, nunca como autoria soberana de escrita.
- **D5 — Leitura sensível também exige binding.** Não expor ledger/wallet/PII/localização/`moneyLocked` de um `actorId` que o `req.user` não está habilitado a representar (`canActAs`). Vazamento cross-user é violação.
- **D6 — Não-user-facing (system/job/webhook).** Quando não há `req.user`, a fronteira de confiança é a **credencial de sistema própria** (não um actorId declarado por cliente). `actionContext` segue declarando o actor de sistema para auditoria; a autoridade vem da credencial de sistema.
- **D7 — Precedência (autoridade > produto).** Em conflito, vence a **trava mais restritiva**; produto é a camada mais fraca. Os contratos técnicos vigentes (que mandavam o design spoofável) ficam **subordinados** a esta DECISION e às leis de autoridade/precedência.
- **D8 — Defesa em profundidade (Opção 3 híbrida).** (a) `actionContext` vira hint não-soberano; (b) **corrigir o `rbac.plugin`** para bindar `req.user` (re-segura todas as rotas admin de uma vez); (c) o **middleware** pode adicionar o binding `actorId ∈ canActAs(req.user)` como camada central; (d) **rotas sensíveis** usam autoria server-side / gate de autoridade. Nenhuma rota sensível pode depender **só** do middleware nem **só** do RBAC atual.
- **D9 — Sem regressão de multi-actor legítimo.** O binding é **`∈ canActAs`** (ownership **OU** delegação), **não** o ingênuo `actorId == actor-próprio-do-user`. Um humano agindo como page/empresa que ele administra ou delega **continua válido** — a soberania do actor (actor-first / capability-additive) é preservada; só a **falsificação** (agir como actor que o principal não pode representar) é vedada.

## 3. Invariante reforçado (não enfraquecido)

A emenda **não reintroduz autoridade implícita/ambiente** (o que o contrato original corretamente combatia). Ela **acrescenta** uma exigência explícita: **declaração não é autorização — a habilitação do principal sobre o actor declarado precisa ser provada.** O princípio "declara, não adivinha" **permanece** (o actor é declarado, não inferido); soma-se "declarar ≠ autorizar".

## 4. Emenda dos contratos vigentes (supersede parcial — texto histórico preservado)

> Os contratos `ACTIONCONTEXT_CONTRACT.md` e `RBAC_V2_CONTRACT.md` recebem um banner de EMENDA apontando para esta DECISION; o texto original é preservado como história, com as cláusulas abaixo **superadas no ponto específico**.

**`ACTIONCONTEXT_CONTRACT.md`:**
- **§3.1 / §4 (actorId não inferido):** PRESERVADO no que diz respeito a *não adivinhar* o actor. SUPERADO no que insinua que o actorId declarado **basta** como autoridade. Passa a valer: o actorId é declarado (não inferido) **E** a autoridade exige `actorId ∈ canActAs(req.user)`.
- **§6.2 (handlers NÃO acessam `req.user` para decisão):** SUPERADO. Handlers/serviços de ação sensível **devem** derivar autoria/gate de `req.user` (canActAs/canManageCompany/ensureUserActor).
- **§6.3 (RBAC NÃO referencia `req.user`):** SUPERADO — ver emenda do RBAC abaixo.

**`RBAC_V2_CONTRACT.md`:**
- **§4 (entradas fechadas, proíbe `req.user`) / §7.1 (proíbe referenciar `req.user.*`) / §11 (conformidade = nunca acessa `req.user`):** SUPERADOS. O RBAC **passa a consultar o principal autenticado** (`req.user`) para **bindar** o actorId (`actorId ∈ canActAs(req.user)`) **antes** de decidir role/permission. O tripé `actorId+intent+scope` permanece como **expressão** da decisão, mas a decisão só é válida sobre um actorId **representável** pelo principal. §2 (Princípio-Mãe) é lido sob esta luz: "actorId" passa a significar "actorId **provado representável** pelo principal".

## 5. Sequência de remediação (governada — NÃO executada nesta DECISION)

Ordem cravada (cada fatia com e2e fail-closed + prova de não-regressão):
1. **`F-RBAC-PLUGIN-BIND-REQ-USER`** — maior ROI: bindar `req.user` no `rbac.plugin` re-segura **todas** as rotas admin (KYB inclusive). É o amplificador sistêmico → vem **primeiro**.
2. **`F-COMPANY-MEMBERS-AUTHORITY-GATE`** + **`F-ORG-INVITES-AUTHORITY-GATE`** — fecham as primitivas de escalonamento (mint de `actor_delegations` com escopo até `['*']`).
3. **Money LIVE:** `unifycard` (authorize/capture/settle) + `settlement`/region credit-debit + `accounts-payable`/`accounts-receivable` + `payment-method`/`unifycard-method`.
4. **Money LATENTE:** `services` (`payAcceptedRequest`/`confirm-financial-terms`) — **antes** de qualquer `isServiceFinancialRuntimeEnabled=ON`; eventos money (`createTicketType`/`reserve`/`acceptQuote`/organizers billing).
5. **Autoridade/identidade restante:** `plan` PUT, `identity /configurations`, profile-C1 (`professional`/`learning`/`interest`) + `lifestyle` (LGPD).
6. **Leitura cross-user:** `ledger`/`wallet-statement`/`active-location`/`impact-overview`/`pending-responsibilities`.

## 6. O que esta DECISION NÃO faz / bloqueios

docs-only · **zero** código/migration/Bank/frontend/middleware-runtime/rbac-plugin-code · não fecha o DT (segue OPEN até a remediação) · não promulga detalhes de implementação de cada fatia (assinatura/erro-code/e2e ficam na fatia) · não altera o vocabulário canônico de roles · não toca `actor_delegations`/`authorization.service` runtime · dev permanece **365**.

## 7. DTs

- `DT-ACTIONCONTEXT-ACTORID-OWNERSHIP-UNVALIDATED` → **GOVERNED/DECIDED** (desenho promulgado; inventário da auditoria persistido). **Segue OPEN** até a remediação por fatias. Resíduos = as 6 fatias da §5.
- Possíveis DTs derivadas por fatia (a abrir quando cada fatia rodar): `DT-RBAC-PLUGIN-REQ-USER-BINDING`, `DT-SERVICE-MONEY-AUTHORSHIP-SPOOFABLE`, etc. — **não abertas agora** (a auditoria já as cobre no inventário do DT-mãe).
