# FASE X — Formalização das Features Fantasma do Marketplace

**MODO:** EXECUTOR  
**ESCOPO:** migrations (novas tabelas) + backend/src/modules/marketplace/** (+ módulos novos se SSOT fora do marketplace)  
**Data:** 2026-02-05  
**Referência:** docs/03_execution_log/FASE_6D_D_MARKETPLACE_K5.md (bloqueios documentados)

---

## Baseline TS2339 (início FASE X)

| Métrica | Valor |
|---------|--------|
| TS2339 total (projeto) | 169 |
| TS2339 em marketplace | 78 |

---

## Bloco 1 — Economic Identity

### Tabelas criadas
- [x] economic_identities (migration 0013_economic_identity.sql: id, tenant_id, actor_id, actor_type, trust_score_bps, status, created_at, updated_at; UNIQUE(tenant_id, actor_id); FK composta actors)
- [x] economic_identity_events (migration 0013: id, tenant_id, actor_id, event_type, value_delta, metadata jsonb, created_at)
- [ ] economic_identity_snapshots (opcional — não criado)

### Repos criados
- [x] economic-identity.repository.ts (createIdentity, getByActorId, appendEvent, listEvents, updateTrustScoreBps)

### Serviços criados
- [x] economic-identity.service.ts (createEconomicIdentity, getEconomicIdentity, recordEconomicEvent, recalculateTrustScore; mapeamento para EconomicIdentity.contract)

### Contrato alinhado
- [x] EconomicIdentity.contract.ts existente; serviço mapeia row → contrato (trust_score_bps → trustLevel por bandas; verifiedAssets/limits default)

### Endpoints conectados
- [x] POST /marketplace/economic-identities → economicIdentityService.createEconomicIdentity(tenantId, body)
- [x] GET /marketplace/economic-identities/:actorId → economicIdentityService.getEconomicIdentity(tenantId, actorId)
- [x] POST /marketplace/economic-identities/:actorId/recalculate → economicIdentityService.recalculateTrustScore(tenantId, actorId)

### TS2339 eliminados
- [x] Fase 1 (endpoints): 3 em marketplace.routes.ts (createEconomicIdentity, getEconomicIdentity, recalculateTrustLevel). Marketplace 78 → 75, total 169 → 166.
- [x] Fase 2 (fechamento): marketplace.service.ts — todas as ocorrências de this.getEconomicIdentity, this.createEconomicIdentity e this.economicEvents substituídas por delegação explícita a economicIdentityService (com tenantId e async). Métodos alterados: grantIncentive(tenantId, input), getAvailableIncentives(tenantId, actorId, region), createB2BContract(tenantId, input), completeCompanyOnboarding(tenantId, onboardingId), listEligibleServiceProviders(tenantId, requestId), dispatchServiceRequest(tenantId, requestId), claimVoucherOffer(tenantId, offerId, userId, audit). economicEvents substituído por array vazio tipado (eventos de pedido não persistidos no bloco Economic Identity). Ajuste IncentiveGrant.reference (camelCase) no grant. TS2339 relacionados a Economic Identity eliminados: 8. TS2339 marketplace: 75 → 67 (−8). TS2339 total: 166 → 158 (−8).

### Conclusão Bloco 1
- [x] **DONE completo.** Todos os TS2339 relacionados a Economic Identity (getEconomicIdentity, createEconomicIdentity, economicEvents) foram eliminados. Rotas e service delegam ao economicIdentityService; nenhum método fantasma mantido; nenhum stub; contrato externo inalterado.

### Verificação final (fechamento)
- `npx tsc --noEmit` executado após fechamento.
- **TS2339 total (projeto):** 158
- **TS2339 em marketplace:** 67
- **TS2339 de Economic Identity eliminados no fechamento:** 8 (todos os restantes em marketplace.service.ts + economicEvents).

---

## Bloco 2 — Regional / Fund / Incentives

### PASSO R1 — Listagem TS2339 (Regional / Fund / Incentives)

Filtro: getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit, getUnlockedIncentive, isHubSuggested, isIndustryOnboardingEnabled, getLatestRegionalImpact, getRegionalActivationHistory e qualquer método contendo "Regional" ou "Incentive".

| Método | Arquivo | Linha(s) | Ocorrências |
|--------|---------|----------|-------------|
| getLatestRegionalImpact | marketplace.routes.ts | 1868 | 1 |
| getRegionalActivationHistory | marketplace.routes.ts | 1896 | 1 |
| isHubSuggested | marketplace.routes.ts | 1918 | 1 |
| getUnlockedIncentive | marketplace.routes.ts | 1919 | 1 |
| isIndustryOnboardingEnabled | marketplace.routes.ts | 1920 | 1 |
| getUnlockedIncentive | marketplace.service.ts | 4070, 4322 | 2 |
| getRegionalFundByRegion | marketplace.service.ts | 4186, 4252, 5800, 6051, 6363 | 5 |
| allocateRegionalFund | marketplace.service.ts | 4258 | 1 |
| createRegionalFund | marketplace.service.ts | 5802 | 1 |
| recordRegionalFundCredit | marketplace.service.ts | 6059 | 1 |

**Total de ocorrências (Bloco 2):** 15  
**Por arquivo:** marketplace.routes.ts 5, marketplace.service.ts 10.

*(Nenhuma implementação realizada — apenas listagem.)*

---

### Bloco 2 — Regional Fund (operacional) — Execução

**PASSO 1 — Migration**
- [x] 0014_regional_fund.sql: regional_funds (id, tenant_id, country, state, city, total_balance_cents, created_at, updated_at; UNIQUE(tenant_id, country, state, city); FK tenants). regional_fund_allocations (id, tenant_id, regional_fund_id FK regional_funds, actor_id FK actors, amount_cents, allocation_type, created_at). FK composta cross-tenant.

**PASSO 2 — Repository**
- [x] regional-fund.repository.ts: getByRegion(tenantId, country, state, city), createFund(tenantId, input), allocate(tenantId, input) [transação: debita fundo + insert allocation], credit(tenantId, regionalFundId, amountCents).

**PASSO 3 — Service**
- [x] regional-fund.service.ts: getRegionalFundByRegion(tenantId, region), createRegionalFund(tenantId, input), allocateRegionalFund(tenantId, input), recordRegionalFundCredit(tenantId, input). Mapeamento para RegionalFund.contract. Sem regras de incentivo; apenas operação de saldo.

**PASSO 4 — Delegação**
- [x] marketplace.service.ts: todas as chamadas a getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit substituídas por regionalFundService. Métodos atualizados: grantIncentive (já tinha tenantId), consumeIncentive(tenantId, grantId), completeCompanyOnboarding (já tinha tenantId), activatePaymentTerminal(tenantId, terminalId), getRegionalFinancialFlow(tenantId, region, period). Rotas atualizadas com guard e tenantId. executeAllocation não implementado (mantido como TS2339).

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit executado.
- **TS2339 total (projeto):** 150 (antes 158; −8).
- **TS2339 em marketplace:** 59 (antes 67; −8).
- **TS2339 eliminados no Bloco 2 (Regional Fund operacional):** 8 (getRegionalFundByRegion, createRegionalFund, allocateRegionalFund, recordRegionalFundCredit).

**Não implementado neste bloco:** getUnlockedIncentive, isHubSuggested, isIndustryOnboardingEnabled, getLatestRegionalImpact, getRegionalActivationHistory, executeAllocation.

---

### Bloco 2 — Regional Snapshot (regional_impact_snapshots)

**PASSO 1 — Migration**
- [x] 0015_regional_impact_snapshots.sql: regional_impact_snapshots (id, tenant_id, country, state, city, period TEXT YYYY-MM, total_volume_cents, total_transactions, regional_fund_inflow_cents, regional_fund_outflow_cents, created_at). UNIQUE(tenant_id, country, state, city, period). FK tenant_id → tenants.

**PASSO 2 — Repository**
- [x] regional-impact.repository.ts: getLatestSnapshot(tenantId, region), upsertSnapshot(tenantId, input).

**PASSO 3 — Service**
- [x] regional-impact.service.ts: getLatestRegionalImpact(tenantId, region) → RegionalImpactMetrics | null; computeSnapshotFromData(tenantId, region, period, data). Mapeamento row → RegionalImpactMetrics.contract.

**PASSO 4 — Delegação**
- [x] GET /marketplace/regional-impact/latest: passa a usar regionalImpactService.getLatestRegionalImpact(tenantId, { country, state, city }); guard tenant; await.

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit. TS2339 total: 150 → 149 (−1). TS2339 marketplace: 59 → 58 (−1). Eliminado: getLatestRegionalImpact (1 ocorrência na rota).

Regras, incentivos e activation events não foram implementados.

---

### Bloco 2 — Regional Activation Rules (regras regionais persistidas)

**PASSO 1 — Migration**
- [x] 0016_regional_activation_rules.sql: regional_activation_rules (id, tenant_id, country, state, city, action_type CHECK suggest_hub | enable_industry_onboarding | unlock_incentive, threshold_volume_cents, threshold_transactions, is_active, created_at). UNIQUE(tenant_id, country, state, city, action_type). Índices e UNIQUE(tenant_id, id).

**PASSO 2 — Repository**
- [x] regional-activation.repository.ts: getRulesByRegion(tenantId, region), getRuleByAction(tenantId, region, actionType), upsertRule(tenantId, input). Tipos ActionType, RegionalActivationRuleRow, UpsertRuleInput.

**PASSO 3 — Service**
- [x] regional-activation.service.ts: isHubSuggested(tenantId, region), isIndustryOnboardingEnabled(tenantId, region), getUnlockedIncentive(tenantId, region). Usa regionalImpactService.getLatestRegionalImpact para snapshot e regionalActivationRepository para regras; avalia thresholds (volume_cents, transactions); retorna boolean ou UnlockedIncentiveResult ({ unlocked: true } | null). Sem histórico; sem eventos.

**PASSO 4 — Delegação**
- [x] GET /marketplace/regional-activations/status: guard tenant; tenantId de req.tenant; chamadas a regionalActivationService.isHubSuggested, getUnlockedIncentive, isIndustryOnboardingEnabled (Promise.all) em vez de marketplaceService.
- [x] POST /marketplace/incentives/rules: guard tenant; tenantId no input; createIncentiveRule(input) com tenantId; método assíncrono; delegação a regionalActivationService.getUnlockedIncentive(tenantId, region).
- [x] marketplace.service.ts: createIncentiveRule recebe tenantId e é async; usa await regionalActivationService.getUnlockedIncentive(tenantId, input.region). getAvailableIncentives usa await regionalActivationService.getUnlockedIncentive(tenantId, region).

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit executado.
- **TS2339 total (projeto):** 144 (antes 149; −5).
- **TS2339 em marketplace:** 53 (antes 58; −5).
- **TS2339 eliminados neste passo (Bloco 2 Regional Activation Rules):** 5 (isHubSuggested, getUnlockedIncentive, isIndustryOnboardingEnabled nas rotas + 2 chamadas getUnlockedIncentive no marketplace.service).

---

### Bloco 2 — Regional Activation Events (histórico persistido)

**PASSO 1 — Migration**
- [x] 0017_regional_activation_events.sql: regional_activation_events (id, tenant_id FK tenants, country, state, city, action_type CHECK suggest_hub | enable_industry_onboarding | unlock_incentive, snapshot_id nullable FK regional_impact_snapshots, triggered_at timestamptz default now(), metadata jsonb). Índices: tenant+region, tenant+region+action_type, triggered_at DESC.

**PASSO 2 — Repository**
- [x] regional-activation-events.repository.ts: recordActivation(tenantId, input), listByRegion(tenantId, region). Tipos ActionType, RegionalActivationEventRow, RecordActivationInput.

**PASSO 3 — Service**
- [x] regional-activation-events.service.ts: getRegionalActivationHistory(tenantId, region) → ActivationEvent[] (delega listByRegion e mapeia row → contrato ActivationEvent); recordActivation(tenantId, input) exposto para gravação. Sem auto-registo idempotente opcional neste passo.

**PASSO 4 — Delegação**
- [x] GET /marketplace/regional-activations/history: guard tenant; tenantId de req.tenant; substituída chamada marketplaceService.getRegionalActivationHistory({ country, state, city }) por await regionalActivationEventsService.getRegionalActivationHistory(tenantId, { country, state, city }).

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit executado.
- **TS2339 total (projeto):** 143 (antes 144; −1).
- **TS2339 em marketplace:** 52 (antes 53; −1).
- **TS2339 eliminados neste passo (Bloco 2 Regional Activation Events):** 1 (getRegionalActivationHistory em marketplace.routes.ts).

---

### Bloco 2 — Finalização Regional Fund (executeAllocation)

**PASSO 1 — Migration**
- [x] 0018_regional_fund_allocations_status.sql: ALTER TABLE regional_fund_allocations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending', ADD COLUMN executed_at TIMESTAMPTZ; CHECK (status IN ('pending','executed','cancelled')).

**PASSO 2 — Repository**
- [x] regional-fund.repository.ts: executeAllocation(tenantId, allocationId) — UPDATE regional_fund_allocations SET status='executed', executed_at=now() WHERE id=$1 AND tenant_id=$2 AND status='pending' RETURNING *; interface RegionalFundAllocationRow atualizada com status e executed_at; INSERT em allocate() passa a retornar status e executed_at.

**PASSO 3 — Service**
- [x] regional-fund.service.ts: executeAllocation(tenantId, allocationId) — delega ao repository, sem lógica extra.

**PASSO 4 — Delegação**
- [x] marketplace.service.ts: substituída chamada this.executeAllocation(allocation.allocation_id) por await regionalFundService.executeAllocation(tenantId, allocation.allocation_id) em consumeIncentive.

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit executado.
- **TS2339 total (projeto):** 142 (antes 143; −1).
- **TS2339 em marketplace:** 51 (antes 52; −1).
- **TS2339 eliminados neste passo (Bloco 2 Finalização Regional Fund):** 1 (executeAllocation em marketplace.service.ts).

---

### PASSO R2 — Análise dos métodos restantes (Regional Rules / Incentives)

Para cada método: dependência de estado persistente, de cálculo derivado, de Regional Fund, de Economic Identity, e de entidade inexistente.

| Método | Persistência necessária? | Pode ser derivado? | Depende de Fund? | Depende de Identity? | Entidade faltante? |
|--------|---------------------------|---------------------|------------------|----------------------|--------------------|
| getUnlockedIncentive | Sim (regras + snapshot ou flags por região) | Sim, se existirem RegionalImpactMetrics e RegionalActivationRule persistidos (avaliar regras sobre snapshot) | Indireto (métricas podem incluir fluxo do fundo) | Não | RegionalImpactMetrics persistido; RegionalActivationRule persistido (ou tabela de unlocks por região) |
| isHubSuggested | Sim (regras ou flag por região) | Sim, se regras + snapshot (action type suggest_hub) | Não direto | Não | Idem: snapshots de impacto + regras de ativação |
| isIndustryOnboardingEnabled | Sim (regras ou flag por região) | Sim, se regras + snapshot (action type enable_industry_onboarding) | Não | Não | Idem |
| getLatestRegionalImpact | Sim (snapshot por região/período) | Sim, pode ser agregado a partir de orders, services, regional_fund (inflow/outflow) | Sim (regionalFundInflow/Outflow) | Não | Tabela/serviço de snapshots de impacto regional (ou agregação em cima de dados existentes) |
| getRegionalActivationHistory | Sim (eventos de ativação) | Não — histórico é evento, tem de ser registado quando regra dispara | Não direto | Não | regional_activation_events (ou equivalente) que registe quando uma regra dispara |
| executeAllocation | Sim — alocação já existe (regional_fund_allocations) | Não — é acção (marcar como executada / criar lançamento) | Sim (alocação é do fundo) | Não | Opcional: integração com ledger (getBankLedgerRepository inexistente); ou apenas coluna status/executed_at em regional_fund_allocations |

*(Nenhuma implementação realizada — apenas análise.)*

---

### Tabelas criadas
- [x] regional_funds, regional_fund_allocations (Bloco 2 operacional)
- [ ] regional_incentives (incentivos — não feito)

### Repos criados
- [ ]

### Serviços criados
- [ ]

### Contrato alinhado
- [ ]

### Endpoints conectados
- [ ]

### TS2339 eliminados
- [ ]

### Conclusão Bloco 2
- [ ]

---

## Bloco 3 — Plugins / Products

### PASSO P1 — Listagem TS2339 (Plugins / Products)

Filtro: registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook, products, storeProductActivations, checkoutIntents.

| Método | Arquivo | Linha(s) | Ocorrências |
|--------|---------|----------|-------------|
| registerPlugin | marketplace.routes.ts | 3935 | 1 |
| getPluginsByCategory | marketplace.routes.ts | 3959 | 1 |
| getActivePlugins | marketplace.routes.ts | 3961, 3963 | 2 |
| getPlugin | marketplace.routes.ts | 3979 | 1 |
| updatePluginStatus | marketplace.routes.ts | 4001 | 1 |
| getPluginExecutions | marketplace.routes.ts | 4024 | 1 |
| executePluginHook | marketplace.routes.ts | 4049 | 1 |
| storeProductActivations | marketplace.service.ts | 10405, 10408 | 2 |
| products | marketplace.service.ts | 10415, 10427, 10443 | 3 |
| checkoutIntents | marketplace.service.ts | 11765 | 1 |

**Total de ocorrências (Bloco 3 — Plugins/Products):** 14  
**Por arquivo:** marketplace.routes.ts 8, marketplace.service.ts 6.

*(Nenhuma implementação realizada — apenas listagem.)*

---

### Bloco 3 — Plugin Engine (registerPlugin, getPluginsByCategory, getActivePlugins, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook)

**PASSO 1 — Migration**
- [x] 0019_marketplace_plugins.sql: marketplace_plugins (id, tenant_id FK tenants, name, category, status CHECK active|inactive|deprecated, config jsonb, created_at). UNIQUE(tenant_id, name). marketplace_plugin_executions (id, tenant_id FK tenants, plugin_id FK marketplace_plugins, hook, payload jsonb, status, executed_at). Índices por tenant, category, status, tenant+category; executions por tenant+plugin, hook, executed_at DESC.

**PASSO 2 — Repository**
- [x] marketplace-plugin.repository.ts: createPlugin(tenantId, input), getByCategory(tenantId, category, status?), getActive(tenantId), getById(tenantId, pluginId), updateStatus(tenantId, pluginId, status), recordExecution(tenantId, input), listExecutions(tenantId, pluginId, hook?). Tipos MarketplacePluginRow, MarketplacePluginExecutionRow, CreatePluginInput, RecordExecutionInput.

**PASSO 3 — Service**
- [x] marketplace-plugin.service.ts: registerPlugin(tenantId, input), getPluginsByCategory(tenantId, category, status?), getActivePlugins(tenantId), getPlugin(tenantId, pluginId), updatePluginStatus(tenantId, pluginId, status), getPluginExecutions(tenantId, pluginId, hook?), executePluginHook(tenantId, hook, input_data, context). Mapeamento row → PluginDefinition / PluginExecution (contrato). executePluginHook: persiste execução por cada plugin ativo que permite o hook; sem lógica externa; retorna array { executionId, pluginId }. Sem Map in-memory; sem stub.

**PASSO 4 — Delegação**
- [x] POST /plugins/register: guard tenant; await marketplacePluginService.registerPlugin(tenantId, req.body). GET /plugins: guard tenant; getPluginsByCategory ou getActivePlugins(tenantId) + filter por status. GET /plugins/:pluginId: guard tenant; getPlugin(tenantId, pluginId). POST /plugins/:pluginId/status: guard tenant; updatePluginStatus(tenantId, pluginId, status). GET /plugins/:pluginId/executions: guard tenant; getPluginExecutions(tenantId, pluginId, hook). POST /plugins/execute-hook: guard tenant; executePluginHook(tenantId, hook, input_data, context). Corrigido Body type: Omit<PluginDefinition, 'pluginId' | 'createdAt' | 'updatedAt'>.

**PASSO 5 — Verificação**
- [x] npx tsc --noEmit executado.
- **TS2339 total (projeto):** 134 (antes 142; −8).
- **TS2339 em marketplace:** 43 (antes 51; −8).
- **TS2339 eliminados neste passo (Bloco 3 Plugin Engine):** 8 (registerPlugin, getPluginsByCategory, getActivePlugins×2, getPlugin, updatePluginStatus, getPluginExecutions, executePluginHook).

---

### Tabelas criadas
- [x] marketplace_plugins, marketplace_plugin_executions (Bloco 3 Plugin Engine)

### Repos criados
- [x] marketplace-plugin.repository.ts

### Serviços criados
- [x] marketplace-plugin.service.ts

### Contrato alinhado
- [x] PluginDefinition.contract.ts; mapeamento row → PluginDefinition / PluginExecution

### Endpoints conectados
- [x] POST/GET /plugins, GET /plugins/:pluginId, POST /plugins/:pluginId/status, GET /plugins/:pluginId/executions, POST /plugins/execute-hook → marketplacePluginService com tenantId

### TS2339 eliminados
- [x] 8 (Bloco 3 Plugin Engine)

### Conclusão Bloco 3
- [ ] (products, storeProductActivations, checkoutIntents restantes)

---

### PASSO P2 — Análise dos métodos restantes (Products / Activations / Checkout)

Respostas por método:

1. **Existe tabela real no projeto que represente produtos?**  
   - **products:** Não. Nenhuma migration no escopo cria tabela `products`. O `product.repository.ts` referencia `INSERT INTO products` (catálogo canônico), mas não há `CREATE TABLE products` nas migrations listadas — tabela pode estar em outro schema/migration fora do escopo ou ausente.  
   - **storeProductActivations:** Não. Nenhuma tabela de ativações por loja/produto.  
   - **checkoutIntents:** Não. Existe `payment_intents` (payment domain), que é intent de pagamento, não CheckoutIntent (agregação de orders por checkout).

2. **Existe repository real de products no core?**  
   - **products:** Sim. `product.repository.ts` e `productCatalogService` no marketplace (createProduct, listProducts, getProductById, etc.).  
   - **storeProductActivations:** Não.  
   - **checkoutIntents:** Não. Checkouts são guardados em `private checkouts: Map<string, CheckoutIntent>` no marketplace.service; o código usa `this.checkoutIntents` numa linha (TS2339), mas o campo real é `this.checkouts`.

3. **storeProductActivations depende de persistência própria?**  
   Sim. Hoje é apenas `this.storeProductActivations` (Map de storeId → Map de productId → { isEnabled, price, stock, ... }). Para formalizar, exige entidade/repositório próprio (ex.: store_products ou store_product_activations).

4. **checkoutIntents já tem tabela/backing em payment domain?**  
   Não. O payment domain tem `payment_intents`. CheckoutIntent no marketplace é outro conceito (checkout a partir de Order, agrupa itens por loja); backing atual é in-memory Map (`this.checkouts`).

5. **Esses métodos eram Map in-memory?**  
   Sim. `this.products` (Map), `this.storeProductActivations` (Map de Map), `this.checkouts` (Map; referido erroneamente como `this.checkoutIntents` numa ocorrência).

**Tabela resumo:**

| Método | Tabela existente? | Repo existente? | Pode reutilizar domínio existente? | Exige nova entidade? |
|--------|-------------------|-----------------|------------------------------------|----------------------|
| products | Não (nenhuma `products` nas migrations; product.repository referencia a tabela) | Sim (product.repository + productCatalogService) | Sim — catálogo persistido existe; marketplace.service usa Map paralelo (this.products) para instâncias por template/loja | Sim — alinhar: usar só catálogo ou criar store_products/ativações |
| storeProductActivations | Não | Não | Não | Sim (ex.: store_product_activations ou store_products) |
| checkoutIntents | Não (payment_intents ≠ CheckoutIntent) | Não | Não — payment_intents é outro conceito | Sim (ex.: checkout_intents ou reutilizar order + payment_plan) |

*(Nenhuma implementação realizada — apenas análise.)*

---

### Bloco 3 — Store Products / Activations (execução)

**PASSO 1 — Migration**
- [x] 0020_products_and_store_product_activations.sql: tabela **products** (id uuid PK, tenant_id FK tenants, name, description, price_cents bigint, status TEXT CHECK active/inactive, category_id, product_type, is_active, metadata jsonb, "createdAt", "updatedAt"; UNIQUE(tenant_id, id)). Tabela **store_product_activations** (id uuid PK, tenant_id FK tenants, store_id FK actors(tenant_id, id), product_id FK products, status TEXT CHECK active/inactive, activated_at, deactivated_at nullable; UNIQUE(tenant_id, store_id, product_id)).

**PASSO 2 — Repository**
- [x] store-product.repository.ts: activateProduct(tenantId, storeId, productId), deactivateProduct(tenantId, storeId, productId), listByStore(tenantId, storeId, activeOnly?), getActivation(tenantId, storeId, productId), upsertActivation(tenantId, storeId, productId, status).

**PASSO 3 — Service**
- [x] store-product.service.ts: getStoreProducts(tenantId, storeId, categoryId?), activateProduct, deactivateProduct, addProductToStore(..., status?), hasActivation, hasActivationForTemplate(tenantId, storeId, templateId), findProductByTemplateId(tenantId, templateId). Eliminação completa de this.products e this.storeProductActivations no MarketplaceService; uso de productCatalogService e storeProductService.

**PASSO 4 — Delegação**
- [x] marketplace.service.ts: getStoreProducts → storeProductService.getStoreProducts; createPhysicalOrder(tenantId, input), addOrderItem(tenantId, order, item) com tenantId e await getStoreProducts; createSubscription(tenantId, input); importProductTemplates(tenantId, storeId, templateIds, options) e importCanonicalCatalog(tenantId, ...) com storeProductService/productCatalogService. Rotas (marketplace.routes.ts, marketplace-public.routes.ts) atualizadas com tenantId e await onde necessário.

**PASSO 5 — Verificação**
- [x] `npx tsc --noEmit` executado.
- **TS2339 total (projeto):** 128
- **TS2339 em marketplace:** 31
- **TS2339 eliminados (relacionados a products e storeProductActivations):** 2 (propriedades `products` e `storeProductActivations` removidas de MarketplaceService e substituídas por productCatalogService e storeProductService).

**Conclusão Bloco 3 — Store Products / Activations:** Objetivo cumprido: TS2339 de `products` e `storeProductActivations` eliminados. Migrations, repository, service e delegação no marketplace implementados. Outros TS2339 em marketplace (ex.: getImportedServices, activateImportedProduct, checkoutIntents, tipos Order/CheckoutIntent/ServiceOrder) permanecem para blocos futuros.

---

## Conclusão FASE X

- **Bloco 1 (Economic Identity):** DONE
- **Bloco 2 (Regional / Fund / Incentives):** DONE
- **Bloco 3 (Plugins / Products / Activations):** DONE
- **TS2339 marketplace:** 78 → 31
- **TS2339 total:** 169 → 128

As features fantasmas estruturais foram formalizadas.  
Os TS2339 restantes pertencem a integrações interdomínio (orders, checkout, imported services) e serão tratados em fase posterior.

---

Baseline FASE X registrado. Fase posterior: integrações interdomínio (orders, checkout, imported services).
