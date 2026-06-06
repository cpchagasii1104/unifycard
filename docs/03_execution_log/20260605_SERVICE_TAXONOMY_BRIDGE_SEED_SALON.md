# Execução — F-SERVICE-TAXONOMY-BRIDGE-SEED-SALON (DECISION-0109 D3 / Opção A) — seed governado

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `407c7fb4` · **Decisão:** Clayton — go seed salão (após confirmar que o schema já estava entregue) · **Esteira:** eu (escritora); par verifica.

## Nota de disciplina
O envelope do **schema** (`F-SERVICE-TAXONOMY-BRIDGE-SCHEMA-MIGRATION`) foi recolado antes deste go. Reconheci que já estava entregue (`407c7fb4`, dev 364) e **parei** em vez de re-executar (criaria migration duplicada) — `feedback_executor_nao_se_autoriza`. Clayton então deu o go do **seed**, executado aqui.

## Objetivo
Semear a ponte `company_type_service_categories` para o piloto **salão**: ligar `salao` às 5 categorias de serviço (`domain='servicos'`). Seed/DML governado, fail-closed, idempotente. **NÃO** cria fluxo de serviço.

## Implementação
- **`backend/migrations/20260605200000_seed_company_type_service_categories_salon.sql`** (BEGIN/COMMIT, bloco `DO`):
  - Resolve `company_type` por `slug='salao'` (`company_types.id`); RAISE se ausente.
  - Valida que as 5 categorias existem **E** são `domain='servicos'`; se `count <> 5` → **RAISE/rollback total (fail-closed, sem parcial)**.
  - INSERT idempotente (`ON CONFLICT (company_type_id, service_category_id) DO NOTHING`): `is_department=true` só para `servicos-estetica-bem-estar`; demais = ramo. `source='clayton_curated_service_bridge_salon_2026_06_05'`.
  - Verificação final: exatamente 5 linhas para salão + exatamente 1 departamento; senão RAISE.
- **Mapa semeado:** `servicos-estetica-bem-estar` (departamento) + `servicos-cabeleireiro` / `servicos-barbearia` / `servicos-manicure` / `servicos-estetica-facial` (ramos).

## Prova
- Aplicada pelo **runner canônico** (`tsx src/core/db/migrate.ts`, `EXPECTED_DATABASE_NAME=unificard_dev`).
- **5 linhas** para `salao`, todas `domain='servicos'` ✓; **1** `is_department=true` (`servicos-estetica-bem-estar`) + **4** ramos ✓; `source` uniforme ✓.
- **Idempotente:** re-INSERT do mesmo conjunto inseriu **0** (ON CONFLICT), mantém 5 ✓.
- **Fail-closed:** o bloco DO RAISE/rollback se faltar categoria ou domínio ≠ servicos (sem seed parcial).
- Não-toque: `salao.default_*_slugs` (marketplace-*) intocado; `company_type_allowed_concepts` (7) intocado; `services` (0)/`availability` (32) intocados; nenhuma categoria alterada; total bridge rows = 5 (só salão).
- `schema_migrations` **364→365**, registrada, **files (365) = registered (365)** → **sem fantasma**.
- 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365, numeração única) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3).

## DT
- **`DT-SERVICE-RAMO-TAXONOMY-FORK` → GOVERNED / PARTIALLY MITIGATED** (schema+seed prontos; falta guard/runtime de criação de serviço).
- **`DT-SERVICE-NO-COMPANY-RAMO-BRIDGE`** → metade de categoria endereçada; segue OPEN/PARTIAL (falta companyId/page-actor + guard).
- `DT-SERVICE-AVAILABILITY-ENDPOINT-DISCONNECT` / `DT-SERVICE-COMMERCIAL-FLOW-BANK-COUPLED` → intocadas.

## Não-toque confirmado
runtime/`.ts` · endpoint · frontend · serviço/availability/booking · Bank · `company_types.default_*_slugs` · `company_type_allowed_concepts` · `services.category_id` · categorias existentes · restaurante · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Guard de criação de serviço (Bank-free): `services.category_id` deve ser `domain='servicos'` **E** pertencer à ponte do `company_type` da empresa; companyId/page-actor entra no fluxo. Booking/order/payment/Bank seguem bloqueados. Espera go do Clayton.
