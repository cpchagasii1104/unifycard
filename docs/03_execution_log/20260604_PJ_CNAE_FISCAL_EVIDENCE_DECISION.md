# Execução — DECISION-0103 (Modelo de persistência de CNAE como evidência fiscal PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e064c36f` · **Frente:** `F-PJ-CNAE-EVIDENCE-PERSIST`

## Objetivo
Promulgar DECISION docs-only que define o modelo canônico de persistência de CNAE/atividade econômica como evidência fiscal auditável de PJ, sem transformar CNAE em SSOT semântico nem substituir CONCEPT. **Sem código/schema/migration/runtime; decide onde guardar a evidência, não grava ainda.**

## SSOT / NÃO-SSOT
SSOT: semântica = CONCEPT; ativação = `(primary_company_type_id, primary_concept_id)`; verificação fiscal = `fiscal_identities.kyb_status`; publicação = `company_concept_publications`; `bank_ledger` (fronteira negativa). NÃO-SSOT: CNAE/Receita/CNPJ (evidência) · DomainSelector/MarketplaceDomain/company_domains/businessType/businessCategory/hybrid/metadata/frontend. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > 0101 > 0102 > **0103** > código.

## Base material (auditoria read-only)
`fetchCNPJFromRevenue` busca backend-side (ReceitaWS+BrasilAPI) CNAE principal/secundários + natureza/porte/capital, em `createCompany` + `/fetch-cnpj`. **Descartado** na persistência: `companies` (14 cols) e `fiscal_identities` (9 cols) não têm colunas de atividade; sem snapshot/metadata. Ghost latente: mappers leem `row.main_activity_code`/`secondary_activities` (undefined) e `updateCompany` escreve `UPDATE companies SET main_activity_code=…` → **42703** se o caminho `activity` for exercido. Payload bruto da Receita inclui QSA (LGPD).

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0103_PJ_CNAE_FISCAL_EVIDENCE_MODEL.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_CNAE_FISCAL_EVIDENCE_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0103)
- **Editado:** `REMEDIATION_DT_LOG.md` (CNAE-EVIDENCE-NOT-PERSISTED → GOVERNED/DECISIONED; criadas 2 DTs)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D14)
D1 CNAE = evidência fiscal, não identidade · D2 mora na casa fiscal (`fiscal_identities`), não em companies · D3 CNAEs 1:N · D4 modelo-alvo `fiscal_identity_economic_activities` (id, fiscal_identity_id, cnae_code, cnae_description, is_primary, source, fetched_at, timestamps) + opcional colunas 1:1 (legal_nature/company_size) · D5 SEM QSA bruto (LGPD) · D6 backend é a fonte de coleta (não confiar no frontend) · D7 source/fetched_at obrigatórios · D8 fail-open no nascimento · D9 declarado ≠ fetched · D10 CNAE sugere, não decide · D11 elegibilidade vem depois · D12 limpar ghost `companies.activity` (não criar colunas) · D13 não reviver colunas arquivadas · D14 bloqueios.

## DTs
- `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` → **GOVERNED / DECISIONED** (modelo definido; não CLOSED — falta schema+writer).
- **Criada** `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` (OPEN) — refs runtime a colunas inexistentes (42703 latente).
- **Criada** `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` (OPEN) — sem matriz CNAE→suggested concept.
- Não reabertas: COMPANY-DOMAINS-GHOST-WRITER · SOVEREIGN-SHAPE-MISSING · TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD · COMPANY-STATUS-KYB-SECOND-TRUTH (CLOSED).
- OPEN: MARKETPLACE-DOMAIN-VOCABULARY-FORK · MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN · ONBOARDING-DOMAIN-SELECTION-MISSING.

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes, warning_new=1 = c3 pré-existente).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · provider Receita/BrasilAPI · `companies.service` runtime · KYB · marketplace · publication · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
`F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP` (backend, baixo risco: remover os refs mortos de `main_activity_code`/`secondary_activities` em `companies.service` → para o 42703 latente; pode vir antes do schema) → `F-PJ-CNAE-EVIDENCE-SCHEMA-MIGRATION` (cria `fiscal_identity_economic_activities`) → `F-PJ-CNAE-EVIDENCE-WRITER` (persistir do fetch já existente). Justificativa da ordem: o ghost-cleanup é a dor concreta (42703 latente em runtime) e independe do schema novo; depois cria-se a casa e o writer. Esta sessão decide onde guardar a evidência; não grava a evidência ainda.
