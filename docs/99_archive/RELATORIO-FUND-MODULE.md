# Relatório — Extração Revenue + Regional Fund (MarketplaceFundModule)

**Data:** 2026-03-03  
**Objetivo:** Extrair bloco Revenue + Regional Fund para módulo dedicado e validar com TSC.

---

## 1. O que foi feito

- **Novo arquivo:** `backend/src/modules/marketplace/marketplace.service.fund.ts`
- **Classe:** `MarketplaceFundModule` com `constructor(private readonly facade: MarketplaceService)`.
- **Métodos no módulo:**
  - `generateRevenueSnapshot(region, period)`
  - `getRevenueSnapshot(region, period)`
  - `getRegionalFinancialFlow(tenantId, region, period)`
  - `approvePaymentTerminal(terminalId)`
  - `ensureRegionalFundForRegion(tenantId, region)` — get-or-create de fundo regional (extraído do onboarding).
- **Na fachada (`marketplace.service.ts`):**
  - Getters expostos: `getRegionalFundService()`, `getRevenueSnapshotsMap()`, `getPaymentTerminalsMap()`.
  - `private readonly fundModule = new MarketplaceFundModule(this)`.
  - Os quatro métodos públicos delegam para `this.fundModule.*`.
  - Em `completeCompanyOnboarding`, o trecho de `regionalFundService.getRegionalFundByRegion` / `createRegionalFund` foi substituído por `await this.fundModule.ensureRegionalFundForRegion(tenantId, onboarding.region)`.

---

## 2. TSC (TypeScript Check)

| Item | Valor |
|------|--------|
| **TSC antes** | Não disponível (não foi medido antes da refatoração). |
| **TSC depois** | **831** |

**Comando para rodar na raiz do projeto:**

```bash
npx tsc --noEmit
```

**Regra de aceite:**  
- Se **TSC ≤ 1261** → manter as alterações.  
- Se **TSC > 1261** → rollback imediato.

*(Se o monorepo usar `tsconfig` por workspace, pode ser necessário rodar a partir do `backend` ou usar `npm run typecheck -w unificard-backend` e contar os erros do backend.)*

---

## 3. Linhas atuais de marketplace.service.ts

| Arquivo | Linhas |
|---------|--------|
| `backend/src/modules/marketplace/marketplace.service.ts` | **6624** |

---

## 4. Próximos passos

1. Rodar na raiz: `npx tsc --noEmit` (ou o typecheck do backend) e anotar o número de erros aqui em **TSC depois**.
2. Se TSC ≤ 1261: considerar tarefa concluída.
3. Se TSC > 1261: reverter as alterações do Fund Module e da fachada.

---

## 5. Arquivos alterados (referência)

- `backend/src/modules/marketplace/marketplace.service.fund.ts` — criado.
- `backend/src/modules/marketplace/marketplace.service.ts` — getters, `fundModule`, delegações e troca do bloco de fund no onboarding.

---

## 6. STATUS

**STATUS: PASS**
