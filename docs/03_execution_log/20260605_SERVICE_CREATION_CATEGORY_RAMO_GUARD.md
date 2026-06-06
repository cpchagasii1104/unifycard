# Execução — F-SERVICE-CREATION-CATEGORY-RAMO-GUARD (DECISION-0109 D1/D3/D6) — code-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `446add0d` · **Decisão:** Clayton — guard de criação de serviço (Bank-free) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Garantir que a criação/atualização de serviço use **apenas** categoria `domain='servicos'` e, quando a empresa do page-actor está classificada, pertencente à ponte `company_type_service_categories`. Code-only, Bank-free, sem booking/availability.

## READ-FIRST
- `services.routes`: `POST /` (create) e `PUT /:id` (update) aceitam `categoryId` no payload (opcional/nullable). `actorId` obrigatório no create.
- `services.service.createService(tenantId, userId, input, intent)`: valida actor + intent → `servicesRepository.create`. `updateService`: carrega serviço atual (tem `actorId`) → valida owner → `repository.update`; `input.categoryId` pode trocar a categoria.
- `services.repository.create`: `INSERT INTO services (... category_id ...)`; `service_type` default = `'service'`.
- `services.actor_id → actors.id` (dono = page-actor de empresa OU user PF). **Sem** coluna `company_id` em `services`; **sem** `companyId` no payload → empresa derivada do **actor dono** (`actors.company_id`).

## Implementação (code-only)
- **`service-category-guard.ts` (novo):** `assertServiceCategoryAllowedForCompany(tenantId, actorId, categoryId, serviceType)`:
  1. escopo `service_type='service'` (event/job/rental fora de 0109);
  2. sem `categoryId` → bypass (MVP permite serviço sem categoria);
  3. categoria existe **E** `domain='servicos'` (D1) — senão Forbidden;
  4. empresa do serviço = `actors.company_id` do dono; sem company (PF/legado) → bypass de ramo (compat);
  5. empresa precisa estar classificada (`primary_company_type_id`) — senão Forbidden;
  6. categoria ∈ `company_type_service_categories` do company_type — senão Forbidden.
- **`services.service.ts`:** import + `await assertServiceCategoryAllowedForCompany(...)` em `createService` (antes do `repository.create`, com `input.actorId`/`input.categoryId`/`input.serviceType`) e em `updateService` (antes do `repository.update`, com `currentService.actorId`/`input.categoryId`/`input.serviceType ?? currentService.serviceType`).
- **NÃO** toca availability/booking/order/payment/Bank; **NÃO** usa `default_*_slugs`/`allowed_concepts`/label; **NÃO** migration/seed.

## Prova
- **e2e efêmero `validate-pipeline-e2e-service-category-ramo-guard.ts` 14/14 verde:**
  1–4. salão cria serviço nas 4 categorias do seu ramo (cabeleireiro/barbearia/manicure/estetica-facial) → OK.
  5. salão + `marketplace-cabelo` → **Forbidden** (domain≠servicos).
  6. salão + `servicos-encanador` (domain servicos, **fora da ponte**) → **Forbidden**.
  7. **supermercado** (empresa-produto, sem ponte de serviço) + `servicos-cabeleireiro` → **Forbidden**.
  8. empresa **não classificada** (sem `primary_company_type_id`) → **Forbidden**.
  9. **PF** (user actor, sem company): `servicos-cabeleireiro` → OK (compat); `marketplace-cabelo` → Forbidden (domínio universal).
  10. apenas 5 serviços válidos criados (4 salão + 1 PF); **zero availability**, **zero booking**, **Bank intocado**.
- Backend tsc só baseline geo. 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365** (zero migration).

## DT
- **`DT-SERVICE-RAMO-TAXONOMY-FORK` → CLOSED** (schema `407c7fb4` + seed `446add0d` + guard provados). Resíduo benigno: `salao.default_*_slugs` seguem `marketplace-*` (premoldagem de PRODUTO/Trilho A; salão é serviço-only — concern separado, não a fresta da taxonomia de serviço).
- **`DT-SERVICE-NO-COMPANY-RAMO-BRIDGE` → PARTIALLY MITIGATED** (autoridade de empresa na criação via page-actor; resíduo: não se exige que serviço PJ seja page-actor — PF compat por desenho).
- `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` / `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT` → OPEN.

## Não-toque confirmado
migration/seed · availability/booking/order/payment · Bank · frontend · `default_*_slugs` · `allowed_concepts` · `services` schema · restaurante · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Availability básica do salão (Bank-free, core `availability`) — endereçar `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT` (reconciliar frontend fantasma com o core). Booking/order/payment/Bank seguem bloqueados. Espera go do Clayton.
