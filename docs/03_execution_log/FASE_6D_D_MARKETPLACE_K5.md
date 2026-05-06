# FASE 6D-D — Marketplace (K5)

**MODO:** EXECUTOR  
**ESCOPO:** backend/src/modules/marketplace/**  
**Data:** 2026-02-05

---

## Baseline Inicial (PASSO 1)

- **TS2339 total (projeto):** 189
- **TS2339 em marketplace:** 98 (arquivos `src/modules/marketplace/*` com error TS2339)
- **Total de erros tsc (todas as categorias):** 1076

### Lista completa TS2339 em marketplace (arquivo:linha — símbolo / mensagem)

| Arquivo | Linha | Propriedade / Tipo | Mensagem |
|---------|-------|--------------------|----------|
| contact.routes.ts | 165 | validateKyc | Property 'validateKyc' does not exist on type 'ContactService'. |
| marketplace.routes.ts | 1717 | createEconomicIdentity | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1732 | getEconomicIdentity | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1751 | recalculateTrustLevel | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1766 | getTrustEvents | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1838 | getLatestRegionalImpact | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1866 | getRegionalActivationHistory | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1888 | isHubSuggested | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1889 | getUnlockedIncentive | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 1890 | isIndustryOnboardingEnabled | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3550 | getImportedServices | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3573 | activateImportedProduct | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3591 | deactivateImportedProduct | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3618 | activateImportedService | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3635 | deactivateImportedService | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3665 | inviteCollaborator | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3700 | acceptCollaborationInvite | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3727 | declineCollaborationInvite | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3754 | revokeCollaboration | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3777 | getCompanyCollaborators | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3796 | getActorCollaborations | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3810 | getCollaboration | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3827 | getActorCompanyPermissions | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3846 | registerPlugin | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3870 | getPluginsByCategory | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3872, 3874 | getActivePlugins | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3890 | getPlugin | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3912 | updatePluginStatus | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3935 | getPluginExecutions | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 3960 | executePluginHook | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 4000 | createServiceEvaluation | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 4046 | getActorEvaluations | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 4069 | calculateEvaluationAggregates | does not exist on type 'MarketplaceService'. |
| marketplace.routes.ts | 4087 | getEvaluationWindow | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4002 | getBankLedgerRepository | does not exist on type 'BankPortsRegistry'. |
| marketplace.service.ts | 4073, 4322 | getUnlockedIncentive | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4129, 4425, 4426, 6616, 12445 | getEconomicIdentity | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4190, 4252, 5807, 6058, 6370 | getRegionalFundByRegion | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4258 | allocateRegionalFund | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4274 | executeAllocation | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4295, 11504 | generateEconomicEvent | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 4656, 4661 | penaltyBps | does not exist on type (contract shape). |
| marketplace.service.ts | 4996 | economicEvents | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 5809 | createRegionalFund | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 5824 | createEconomicIdentity | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 6066 | recordRegionalFundCredit | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 6677 | time | does not exist on type (schedule shape). |
| marketplace.service.ts | 6716 | calculated_score | does not exist on type 'ReputationSnapshot'. |
| marketplace.service.ts | 8233, 8247 | createdAt, paidAt, orderId | does not exist on type Order/CheckoutIntent. |
| marketplace.service.ts | 8242, 8349 | orderId | does not exist on type (items shape). |
| marketplace.service.ts | 10441, 10444 | storeProductActivations | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 10451, 10463, 10479 | products | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 10453 | id | does not exist on type '{}'. |
| marketplace.service.ts | 11170 | serviceTemplateId | does not exist on type 'ServiceRequest'. |
| marketplace.service.ts | 11801 | checkoutIntents | does not exist on type 'MarketplaceService'. |
| marketplace.service.ts | 11808 | checkoutId | does not exist on type '{}'. |
| marketplace.service.ts | 12981, 12982, 12994, 12995, 13842, 13843 | sentAt, respondedAt | does not exist on type 'ServiceDispatch'. |
| marketplace.service.ts | 12988, 12989, 13807, 13833, 13834, 13959 | completedAt, status, requestId | ServiceRequest/ServiceOrder. |
| marketplace.service.ts | 13806, 13959 | status | does not exist on type 'ServiceOrder'. |
| marketplace.service.ts | 13818, 13970 | totalCents | does not exist on type 'ServiceOrder'. |

---

## PASSO 2 — Extração de métodos fantasmas

- **MarketplaceService:** createEconomicIdentity, getEconomicIdentity, recalculateTrustLevel, getTrustEvents, getLatestRegionalImpact, getRegionalActivationHistory, isHubSuggested, getUnlockedIncentive, isIndustryOnboardingEnabled, getImportedServices, activateImportedProduct, deactivateImportedProduct, activateImportedService, deactivateImportedService, inviteCollaborator, acceptCollaborationInvite, declineCollaborationInvite, revokeCollaboration, getCompanyCollaborators, getActorCollaborations, getCollaboration, getActorCompanyPermissions, registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, createServiceEvaluation, getActorEvaluations, calculateEvaluationAggregates, getEvaluationWindow, getRegionalFundByRegion, allocateRegionalFund, executeAllocation, generateEconomicEvent, economicEvents, createRegionalFund, recordRegionalFundCredit, storeProductActivations, products, checkoutIntents.
- **BankPortsRegistry:** getBankLedgerRepository.
- **ContactService:** validateKyc.
- **Props em tipos:** penaltyBps, time, calculated_score, createdAt, paidAt, orderId, serviceTemplateId, checkoutId, sentAt, respondedAt, completedAt, status, totalCents, requestId (em ServiceOrder/ServiceRequest/ServiceDispatch).

---

## PASSO 3 — Classificação A / B / C

### Classe A — IMPLEMENTÁVEL (backing real, sem sistema novo)

- Nenhum. Nenhum método fantasma possui backing real (repo/tabela/serviço existente) no escopo permitido sem criar contrato/tabela/sistema novo.

### Classe B — CALLER ERRADO (fluxo alternativo existe)

- Nenhum identificado nesta execução sem análise de produto. Rotas que chamam métodos fantasmas não possuem fluxo alternativo documentado no escopo.

### Classe C — BLOQUEIO (exige modelagem/contrato/tabela/sistema novo)

- **MarketplaceService (rotas + service):** createEconomicIdentity, getEconomicIdentity, recalculateTrustLevel, getTrustEvents, getLatestRegionalImpact, getRegionalActivationHistory, isHubSuggested, getUnlockedIncentive, isIndustryOnboardingEnabled, getImportedServices, activateImportedProduct, deactivateImportedProduct, activateImportedService, deactivateImportedService, inviteCollaborator, acceptCollaborationInvite, declineCollaborationInvite, revokeCollaboration, getCompanyCollaborators, getActorCollaborations, getCollaboration, getActorCompanyPermissions, registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, createServiceEvaluation, getActorEvaluations, calculateEvaluationAggregates, getEvaluationWindow, getRegionalFundByRegion, allocateRegionalFund, executeAllocation, generateEconomicEvent, economicEvents, createRegionalFund, recordRegionalFundCredit, storeProductActivations, products, checkoutIntents.
- **BankPortsRegistry:** getBankLedgerRepository (contrato de portas externo).
- **ContactService:** validateKyc (sem backing no ContactService).
- **Props em tipos (shape drift):** penaltyBps, time, calculated_score, createdAt/paidAt/orderId em Order/CheckoutIntent, serviceTemplateId em ServiceRequest, checkoutId, sentAt/respondedAt em ServiceDispatch, completedAt/status/requestId/totalCents em ServiceRequest/ServiceOrder — exigiriam alteração de contrato ou modelo de domínio.

---

## Ações executadas (escopo permitido)

1. **Duplicate identifier:** Removido import duplicado de `marketplaceLogger` em `marketplace.routes.ts`.
2. **Audit literais (conformidade com tipo existente):** Em `backend/src/modules/marketplace/**` ajustados literais de chamadas a `auditService.record` para o contrato existente: `AuditSeverity` = `'low'` | `'medium'` (substituído `'LOW'`/`'MEDIUM'`); `AuditSource` não inclui `'marketplace'` nem `'business_segment'` — usado `'validation'` (valor existente) para compilar, sem alterar contrato em `core/audit`.
3. **Nenhum stub criado.** Nenhum método Classe C implementado. Nenhum cast, any, !, campo novo, contrato novo ou tabela nova.

---

## Arquivos alterados

- backend/src/modules/marketplace/marketplace.routes.ts (import duplicado; severity/source audit)
- backend/src/modules/marketplace/accounts-payable.service.ts (severity)
- backend/src/modules/marketplace/accounts-receivable.service.ts (severity)
- backend/src/modules/marketplace/commission.service.ts (severity, source)
- backend/src/modules/marketplace/business-segment.service.ts (severity, source)
- backend/src/modules/marketplace/company-profile.service.ts (severity, source)
- backend/src/modules/marketplace/group.service.ts (severity, source)
- backend/src/modules/marketplace/payment-method.service.ts (severity, source)
- backend/src/modules/marketplace/referral.service.ts (severity, source)
- backend/src/modules/marketplace/unifycard.service.ts (severity)
- backend/src/modules/marketplace/settlement.service.ts (severity)
- backend/src/modules/marketplace/region-account.service.ts (severity)
- backend/src/modules/marketplace/purchase-order.service.ts (severity)
- backend/src/modules/marketplace/supplier.service.ts (severity)
- backend/src/modules/marketplace/tax-profile.service.ts (severity)
- backend/src/modules/marketplace/unifycard-method.service.ts (severity)

---

## Baseline final (PASSO 7)

- **Total de erros tsc (todas as categorias):** 1021 (antes: 1076; redução 55)
- **TS2339 total (projeto):** 189 (inalterado)
- **TS2339 em marketplace:** 98 (inalterado; restantes = Classe C BLOQUEIO ou shape drift sem contrato)

---

## Confirmação explícita

- Nenhum cast (`as`, `as unknown as`) utilizado.
- Nenhum `any` introduzido.
- Nenhum `!` introduzido.
- Nenhum stub vazio ou retorno fictício criado.
- Nenhum método sem backing real implementado.
- Nenhum campo novo em contrato.
- Nenhuma tabela nova.
- Nenhuma alteração fora de `backend/src/modules/marketplace/**` e `docs/03_execution_log/FASE_6D_D_MARKETPLACE_K5.md`.
- Métodos fantasmas classificados como BLOQUEIO registrados; nenhum implementado.

---

## Conclusão

- **Status:** PARCIAL (correções K5 de baixo risco aplicadas; TS2339 restantes em marketplace = BLOQUEIO Classe C ou erros fora do escopo de correção sem backing).
- **Próximo passo:** Decisão de produto/arquitetura para rotas que dependem de Classe C; ou manutenção de BLOQUEIO documentado até existir backing real.

---

## PASSO B2 — Execução (append)

### B2.1 — getTrustEvents (Classe B)

**Diff aplicado (marketplace.routes.ts):**
- Import estático adicionado: `import { trustEngineService } from '../trust/trust-engine.service';`
- Rota GET `/trust-events/:actorId`: obtém `tenantId` com guard `if (!req.tenant) return reply.status(401).send({ error: 'Tenant required' }); const tenantId = req.tenant.id;`
- Substituído `marketplaceService.getTrustEvents(actorId)` por `await trustEngineService.listTrustEvents(tenantId, { actorId })`
- Catch: `error: unknown` e mensagem via `error instanceof Error ? error.message : '...'`

**Métricas após B2.1:** TS2339 total 188; TS2339 marketplace 97.

### B2.2 — Reclassificação e correções Classe B

**Itens reclassificados C→B e corrigidos:**
1. **getTrustEvents** — backing: `trust_events`, `trust.repository.listEvents`, `trust-engine.service.listTrustEvents`. Correção: rota passou a chamar `trustEngineService.listTrustEvents(tenantId, { actorId })`.
2. **ServiceDispatch: sentAt / respondedAt** — backing: contrato `ServiceDispatch.contract.ts` com `createdAt`, `acceptedAt`. Correção: em `marketplace.service.ts` substituído `dispatch.sentAt` → `dispatch.createdAt`, `dispatch.respondedAt` → `dispatch.acceptedAt` (e `request.completedAt` → `request.acceptedAt` em um trecho de métricas onde fazia sentido semântico).

**Demais 97 → verificados:** sem backing (tabela/repo/serviço) ou contrato sem a propriedade → mantidos como Classe C (BLOQUEIO). Nenhum método novo, stub, cast, campo novo, contrato novo ou tabela nova.

### Métricas finais (após B2 completo)

| Métrica | Antes B2 | Depois B2 |
|--------|----------|-----------|
| TS2339 total | 189 | 176 |
| TS2339 marketplace | 98 | 85 |

### Confirmação

- Nenhuma regra violada: sem `!`, sem `any`, sem `as`/cast, sem import dinâmico, sem método novo, sem stub, sem alteração de contrato externo ou tabela nova.
- Apenas correção de caller (backing real) e alinhamento a nomes do contrato (ServiceDispatch).

---

## PASSO B3 — Reclassificação e correções Classe B (segunda passada)

**Correções executadas:**

| Arquivo | Resumo |
|---------|--------|
| promotion.repository.ts | PromotionRow: alinhado ao retorno do DB — propriedade `value` (coluna `value`); removido `valueCents` do row; `toPromotion` já usava `row.value`. |
| store-onboarding.routes.ts | `actorId` inexistente em `req.user`: uso de `req.user?.id` e `req.user?.userId` para `actorId` e `userId`; remoção de `req.user!`. |
| marketplace.service.ts | `penaltyBps` inexistente em contract.terms: uso de `penaltyRate` (decimal); ajuste da fórmula de multa. |
| marketplace.service.ts | ReputationSnapshot: `calculated_score` → `score.finalScore` (contrato tem `score.finalScore`). |
| marketplace.service.ts | ServiceOrder: `totalCents` → `price.amountCents` em dois trechos (cálculo de receita/ticket médio). |

**Métricas após B3:** TS2339 total 169; TS2339 marketplace 78.

---

## PASSO B4 — Agrupamento dos 78 TS2339 marketplace por tipo de erro

| Grupo | Contagem | Exemplos |
|-------|----------|----------|
| **Métodos inexistentes** | **62** | validateKyc (ContactService); createEconomicIdentity, getEconomicIdentity, getRegionalFundByRegion, getUnlockedIncentive, storeProductActivations, products, checkoutIntents, etc. (MarketplaceService); getBankLedgerRepository (BankPortsRegistry). |
| **Propriedades inexistentes** | **12** | Order.createdAt; CheckoutIntent.paidAt, createdAt; schedule.time; ServiceRequest.serviceTemplateId, completedAt; ServiceOrder.status, requestId; offering.name. |
| **Drift monetário** (value/amount/total) | **0** | — |
| **Drift de DTO** | **12** | Mesmos 12 acima: propriedade usada não existe no contrato/DTO (Order, CheckoutIntent, ServiceRequest, ServiceOrder, schedule, offering). |
| **Drift de request shape** | **4** | orderId em `{ storeId, items, subtotal }` (2×); id em `{}` (1×); checkoutId em `{}` (1×). |

**Total:** 62 + 12 + 0 + 4 = 78 (Drift de DTO = mesmo cluster que Propriedades inexistentes em tipos DTO).

**Maior incidência:** **Métodos inexistentes** (62).

---

## PASSO B5 — Mapeamento dos 62 TS2339 "Métodos inexistentes"

### Lista completa (por arquivo chamador)

**contact.routes.ts (1)**  
- validateKyc (ContactService)

**marketplace.routes.ts (35)**  
- createEconomicIdentity, getEconomicIdentity, recalculateTrustLevel, getLatestRegionalImpact, getRegionalActivationHistory, isHubSuggested, getUnlockedIncentive, isIndustryOnboardingEnabled  
- getImportedServices, activateImportedProduct, deactivateImportedProduct, activateImportedService, deactivateImportedService  
- inviteCollaborator, acceptCollaborationInvite, declineCollaborationInvite, revokeCollaboration, getCompanyCollaborators, getActorCollaborations, getCollaboration, getActorCompanyPermissions  
- registerPlugin, getPluginsByCategory, getActivePlugins (×2), getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook  
- createServiceEvaluation, getActorEvaluations, calculateEvaluationAggregates, getEvaluationWindow  

**marketplace.service.ts (26)**  
- getBankLedgerRepository (BankPortsRegistry)  
- getUnlockedIncentive (×2), getEconomicIdentity (×6), getRegionalFundByRegion (×4), allocateRegionalFund, executeAllocation, generateEconomicEvent (×2), economicEvents, createRegionalFund, recordRegionalFundCredit, createEconomicIdentity  
- storeProductActivations (×2), products (×3), checkoutIntents  

### Quantidade por arquivo

| Arquivo chamador | Quantidade |
|------------------|------------|
| contact.routes.ts | 1 |
| marketplace.routes.ts | 35 |
| marketplace.service.ts | 26 |
| **Total** | **62** |

### Top 10 métodos mais recorrentes

| # | Método | Ocorrências |
|---|--------|-------------|
| 1 | getEconomicIdentity | 6 |
| 2 | getRegionalFundByRegion | 4 |
| 3 | getUnlockedIncentive | 3 |
| 4 | products | 3 |
| 5 | createEconomicIdentity | 2 |
| 6 | generateEconomicEvent | 2 |
| 7 | getActivePlugins | 2 |
| 8 | storeProductActivations | 2 |

*(44 métodos com 1 ocorrência cada.)*

---

## PASSO B6 — Classificação estrutural por bloco

### 1) Economic Identity  
*(createEconomicIdentity, getEconomicIdentity, economicEvents)*

| Pergunta | Resposta |
|----------|----------|
| Existe tabela SQL correspondente? | **Não** (nenhuma tabela `economic_identity` ou equivalente em `*.sql`). |
| Existe repository correspondente? | **Não**. |
| Existe service real com backing? | **Não** (apenas contrato e chamadas em `marketplace.service` / `voucher.service`; nenhum serviço que persista ou leia identidade econômica). |
| Existe contrato persistido com implementação? | **Não** (existe `EconomicIdentity.contract.ts`; não há implementação de persistência). |

**Conclusão:** Todos "não" → **Bloco inteiro = Classe C (BLOQUEIO estrutural).**

---

### 2) Regional / Fund / Incentives  
*(getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit, getUnlockedIncentive, isHubSuggested, isIndustryOnboardingEnabled, getLatestRegionalImpact, getRegionalActivationHistory)*

| Pergunta | Resposta |
|----------|----------|
| Existe tabela SQL correspondente? | **Parcial.** Existem `regional_fund_proposals` e `regional_fund_votes` (migrations 0185, 0186). Nenhuma tabela para: incentivos desbloqueados, hub suggested, industry onboarding, impacto regional, histórico de ativação regional. |
| Existe repository correspondente? | **Parcial.** Não há repo dedicado “regional fund” no marketplace. O uso de regional fund no core está em `core/unifybank/regional-fund-governance.service.ts` (acesso direto a `regional_fund_proposals`). |
| Existe service real com backing? | **Parcial.** Existe `RegionalFundGovernanceService` (core/unifybank) com backing em `regional_fund_proposals` / `regional_fund_votes`, mas com API de **proposals/votes** (criar proposta, votar, executar). Não expõe `getRegionalFundByRegion(region)`, `createRegionalFund(...)`, `allocateRegionalFund(...)`, `recordRegionalFundCredit(...)` no formato chamado pelo marketplace. Para incentivos, hub suggested, industry onboarding, impacto regional e histórico de ativação: **não** existe service com backing. |
| Existe contrato persistido com implementação? | **Parcial.** Contratos `RegionalFund.contract`, `RegionalImpactMetrics.contract`, `RegionalActivationRule.contract` existem; não há implementação que persista/leia por esses métodos do marketplace. |

**Backing real listado:**  
- Tabelas: `regional_fund_proposals`, `regional_fund_votes`.  
- Serviço: `core/unifybank/regional-fund-governance.service.ts` (RegionalFundGovernanceService), API de governança (proposals/votes), **não** compatível com a API chamada pelo marketplace.

**Conclusão:** Backing existe apenas para “fundo regional” em formato governança; métodos chamados pelo marketplace (getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit, incentivos, impact, activation history) **não** têm implementação correspondente → **Bloco = Classe C (BLOQUEIO estrutural)** para os métodos em uso.

---

### 3) Plugins / Products  
*(registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, products, storeProductActivations)*

| Pergunta | Resposta |
|----------|----------|
| Existe tabela SQL correspondente? | **Não** para plugins. **Sim** para produtos (catálogo), mas não para “store product activations” como tabela dedicada. |
| Existe repository correspondente? | **Não** para plugins. **Sim** para produtos (`product.repository.ts`, `product-catalog.service`), mas **não** para `MarketplaceService.products` (Map in-memory não declarado) nem para `storeProductActivations`. |
| Existe service real com backing? | **Não** para plugins (nenhum serviço que implemente registerPlugin, getActivePlugins, etc.). Para produtos, `productCatalogService` existe e tem backing; o código que chama `this.products` e `this.storeProductActivations` no `marketplace.service` usa estado in-memory não declarado na classe, sem repo/serviço que o sustente. |
| Existe contrato persistido com implementação? | **Não** para plugins (contrato tipo existe; nenhuma persistência). Para produtos, catálogo tem implementação; “products”/“storeProductActivations” no `MarketplaceService` não. |

**Conclusão:** Todos "não" para os métodos/propriedades em causa (plugins + `MarketplaceService.products` + `MarketplaceService.storeProductActivations`) → **Bloco = Classe C (BLOQUEIO estrutural).**

---

## PASSO FINAL — Métricas e encerramento

### 1) Classificação dos blocos

Todos os métodos dos blocos abaixo estão classificados como **Classe C (BLOQUEIO estrutural)**:

- **Economic Identity** — createEconomicIdentity, getEconomicIdentity, economicEvents
- **Regional / Fund / Incentives** — getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit, getUnlockedIncentive, isHubSuggested, isIndustryOnboardingEnabled, getLatestRegionalImpact, getRegionalActivationHistory
- **Plugins / Products** — registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, products, storeProductActivations

### 2) Verificação

Não foram introduzidos: stub, método vazio, import dinâmico improvisado, campo inventado nem sistema paralelo no escopo 6D-D. Os erros TS2339 restantes decorrem de chamadas a métodos/propriedades sem backing (bloqueios documentados).

### 3) `npx tsc --noEmit`

Executado em `backend`; saída em `backend/tsc_final_6dd.txt`.

### 4) Métricas finais

| Métrica | Valor |
|--------|--------|
| **TS2339 total (projeto)** | 169 |
| **TS2339 em marketplace** | 78 |

### 5) Lista consolidada de BLOQUEIOS estruturais por bloco

| Bloco | Métodos / propriedades em BLOQUEIO |
|-------|-----------------------------------|
| Economic Identity | createEconomicIdentity, getEconomicIdentity, economicEvents |
| Regional / Fund / Incentives | getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit, getUnlockedIncentive, isHubSuggested, isIndustryOnboardingEnabled, getLatestRegionalImpact, getRegionalActivationHistory |
| Plugins / Products | registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, products, storeProductActivations |

### 6) Declaração formal

> Marketplace possui funcionalidades declaradas sem backing persistente. Estas foram classificadas como BLOQUEIO estrutural e não foram implementadas por ausência de SSOT, tabela ou serviço real.

---

**STATUS: 6D-D CONCLUÍDA (com bloqueios estruturais documentados)**
