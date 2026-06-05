# Execução — F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `7b62d1cf` · **Governança:** `DECISION-0103` (D12/D13)

## Objetivo
Remover as referências runtime mortas em `companies.service` às colunas inexistentes de atividade econômica em `companies` (`main_activity_code`/`main_activity_description`/`secondary_activities`). **Tira o fio desencapado (42703 latente no update); não instala a tomada nova (evidência CNAE) ainda.** Sem schema/migration/CNAE-persistence/provider.

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `primary_*` (ativação); `fiscal_identities.kyb_status` (verificação). CNAE = evidência fiscal, não SSOT; deve morar na casa fiscal futura, não em `companies` (projeção). `archive não é SSOT vigente`. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097…0103 > código.

## Diagnóstico
`companies` (14 cols) NÃO tem `main_activity_code`/`main_activity_description`/`secondary_activities`. Os read-SELECTs usam `c.*` → row.main_activity_* = undefined (leitura harmless); mas `updateCompany` montava `UPDATE companies SET main_activity_code=$…` → **42703** se um PUT trouxer `activity`. Vestígio de colunas arquivadas (mesmo padrão de `company_domains`).

## Implementação (`backend/src/core/companies/`)
**companies.service.ts:**
1. `updateCompany` — bloco `if (input.activity) { … }` (3 pushes `SET main_activity_code/main_activity_description/secondary_activities`) **REMOVIDO** → elimina o 42703 latente.
2. 3 read-mappers (`getCompanyById`/`listCompanies`/`getCompanyByCnpj`) — `activity: { mainActivityCode: row.main_activity_code, … }` → `activity: { secondaryActivities: [] }` (não lê colunas-ghost).
3. 5 declarações de row-type das colunas-ghost (`main_activity_code: string|null; …`) **removidas**.
4. `createCompany` — `let activity = input.activity || {}` + a extração de CNAE da Receita para esse `activity` local (nunca persistido) **removidos**.

**companies.types.ts:**
5. `activity?: Partial<CompanyActivity>` **removido** de `CreateCompanyInput` e `UpdateCompanyInput`. `Company.activity` (DTO) **preservado** (mappers retornam vazio); `CompanyActivity` type preservado.

**Preservado:** `fetchCNPJFromRevenue` + fallback ReceitaWS/BrasilAPI (prefill de nome/endereço/contato intacto). `companies` NÃO ganhou colunas (D13). Zod schemas (`activity`) deixados (harmless, parsed-unused; cast descarta). Frontend NÃO tocado.

## Prova
- **Grep:** `SET main_activity` / `row.main_activity` / `input.activity` / `main_activity_code` (não-comentário) em `backend/src` = **0**.
- **Backend tsc:** só os 2 baseline `geo-enrichment.service.ts`.
- **e2e `F-ATOMIC-COMPANY-BIRTH` 18/18** (efêmero): `createCompany` (nascimento fiscal-first + page-actor + rollbacks + CNPJ-DV + zero-bank) intacto.
- **4 gates OK** (actor-writer/bank-ledger/regression; arch warning_new=1 = c3 pré-existente).
- O 42703 do update é eliminado **estruturalmente** (o bloco que montava o SQL não existe mais).

## DTs
- `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` → **CLOSED**.
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → permanece GOVERNED / DECISIONED (não CLOSED — falta schema + writer).
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → OPEN.
- CLOSED permanecem: COMPANY-DOMAINS-GHOST-WRITER · SOVEREIGN-SHAPE-MISSING · TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD · COMPANY-STATUS-KYB-SECOND-TRUTH.

## Não-toque confirmado
schema/migrations · CNAE persistence (não criada) · provider Receita/BrasilAPI · KYB · marketplace · publication · Bank · frontend (não tocado) · `CompanyOnboardingWizard` · `DomainSelector` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION`: criar `fiscal_identity_economic_activities` na casa fiscal (DECISION-0103 D4), forward-only/idempotente, sem writer; testes CHECK/FK. Depois `F-PJ-CNAE-EVIDENCE-WRITER` (persistir do `fetchCNPJFromRevenue` já existente, fail-open, sem QSA). Esta fatia tirou o fio desencapado; não instalou a tomada nova ainda.
