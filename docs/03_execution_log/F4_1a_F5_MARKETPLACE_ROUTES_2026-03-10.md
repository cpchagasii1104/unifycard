# Log de Execução — F4.1a + F5 Marketplace

**Data:** 2026-03-10  
**Modo:** EXECUTOR  
**Status:** SUCESSO

## F4.1a — Correção domain-no-cross-domain

- **Problema:** Dependency Cruiser apontava `domain-no-cross-domain`: `domain/types/index.ts → domain/types/mappers.ts`.
- **Ação:** `domain/types/index.ts` passou a exportar apenas de `./domain-types`. Mappers deixaram de ser reexportados pelo barrel; consumo de mappers deve ser via `./domain/types/mappers` ou `./mappers`.
- **Resultado:** `npm run arch:marketplace:validate` → **✔ no dependency violations found**.

## F5 — Divisão estrutural das rotas

### Arquivos criados/atualizados

1. **routes/marketplace-governance.routes.ts** (novo)  
   - `registerMarketplaceGovernanceRoutes(fastify, marketplaceService)`  
   - GET `/providers/:providerActorId/governance-metrics`  
   - GET `/providers/:providerActorId/matching-priority`

2. **routes/marketplace-checkout.routes.ts** (novo)  
   - `registerMarketplaceCheckoutRoutes(fastify, marketplaceService)`  
   - GET `/checkouts` (delegação a `marketplaceService.listCheckouts()`)

3. **routes/marketplace-services.routes.ts** (atualizado)  
   - Assinatura alinhada: `registerMarketplaceServicesRoutes(fastify, marketplaceService)`.  
   - Mantidos: templates, offerings, booking, add-service.  
   - Incluídos: visits (GET visit, GET by request, POST complete), quotes (POST create, GET by request, GET by quoteId, POST accept, POST decline).

4. **marketplace.routes.ts** (agregador)  
   - Novos imports e chamadas:  
     `registerMarketplaceServicesRoutes`, `registerMarketplaceCheckoutRoutes`, `registerMarketplaceGovernanceRoutes`.  
   - Remoção do bloco duplicado: visits, quotes e governance (governance-metrics, matching-priority) que estavam inline no arquivo principal.

### Ordem de registro no agregador

- registerMarketplaceDispatchRoutes  
- registerMarketplaceOrdersRoutes  
- registerMarketplaceCompanyRoutes  
- registerMarketplaceCapacityRoutes  
- registerMarketplaceOfferingsRoutes  
- registerMarketplaceServicesRoutes  
- registerMarketplaceCheckoutRoutes  
- registerMarketplaceGovernanceRoutes  

### Verificações

- **arch:marketplace:validate:** ✔ no dependency violations found (261 modules, 337 dependencies).  
- **TSC:** Nenhum erro no escopo marketplace (findstr marketplace sem saída).  
- **Linter:** Sem erros nos arquivos alterados.

### Estrutura atual em `routes/`

- marketplace-orders.routes.ts  
- marketplace-dispatch.routes.ts  
- marketplace-company.routes.ts  
- marketplace-capacity.routes.ts  
- marketplace-offerings.routes.ts  
- marketplace-services.routes.ts (com visits + quotes)  
- marketplace-checkout.routes.ts  
- marketplace-governance.routes.ts  
- (+ marketplace-catalog.routes.ts, marketplace-templates.routes.ts, etc., já existentes)

### Próximos passos sugeridos

- Continuar a extração de rotas inline do `marketplace.routes.ts` para os arquivos em `routes/` (catalog, pricing, inventory, payments, etc.) até o agregador ficar apenas com registros.  
- Garantir que `marketplace.service.ts` não volte a crescer (ex.: lint arquitetural / dependency-cruiser).

---

FIM DO REGISTRO
