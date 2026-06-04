# Execução — DECISION-0097 (Nascimento e ativação operacional da empresa PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `0c4abed2` · **Frente:** `F-PJ-COMPANY-BIRTH-CANONICAL`

## Objetivo
Promulgar DECISION docs-only que institucionaliza o desenho canônico de nascimento/classificação/ativação de empresa PJ (artefato autoral `CRIACAO_DE_EMPRESAS.md`), sincronizado com o estado vivo pós-DECISION-0090–0096 e com a verificação read-only. **Sem código/schema/migration/runtime.**

## Domínios declarados
Identidade/actors · autoridade · ontologia/CONCEPT · navegação N0/N1 · estado/lifecycle · financeiro (fronteira negativa, sem tocar Bank) · documentação/governança.

## Documentos lidos
- **Full (esta sessão):** `00_AGENT_PROTOCOL` (bootstrap), `CONSTITUICAO_UNIFICARD`, `LEIS_OPERACIONAIS_UNIFICARD` (Lei 5/7), `EMPRESA_NASCIMENTO_CANONICO`, `02_ACTORS_SSOT`, `PROHIBITED_STRUCTURES`, `IDENTITY_SSOT_PRECEDENCE`, `SSOT_EXCLUSIVE_BANK_RULE`, `REGRA_CANONICA_CRIACAO_DE_CONTEXT`, `18_DOMAIN_ONTOLOGY` (princípios/critério N0/camadas), `CRIACAO_DE_EMPRESAS.md` (autoral).
- **Por referência (design doc cita file:line; sem claim novo):** `SSOT_REGISTRY`, `08_AUTORIDADE`, `AUTHORITY_LAW/ENFORCEMENT`, `SERVICE_CANONICO`, `DEFINICAO_DE_PRODUTO`, `19_N1`/`20_N2`, `03_IDENTITY`, `LEI_DE_COERENCIA`.
- **Logs:** `REMEDIATION_DECISIONS_LOG`, `REMEDIATION_DT_LOG`, `STATUS_EXECUCAO_GLOBAL`, `opus`. **Ausente registrado:** `SEMANTIC_CATALOG_GOVERNANCE.md`.
- **Conhecimento direto da cadeia:** DECISION-0075/0089–0096 (sessões anteriores).

## SSOT aplicáveis / NÃO-SSOT
- SSOT: `global_user_id`/`identities` (civil); `actors(id)`/page-actor (operacional); `fiscal_identities.kyb_status` (CNPJ/KYB PJ); CONCEPT (semântica); N0/N1/N2/categories (navegação); `bank_ledger`/UnifyBank (financeiro — fronteira negativa).
- NÃO-SSOT de verificação: `company_status`/`companies.status`/`is_verified`/`verifiedAt`/frontend/metadata/presencial. NÃO identidade semântica: `businessType`/`businessCategory`/`category_id`/`slug`/N1/N2.
- Precedência: `Constituição > Leis > SSOT Registry > Ontologia > DECISIONs > código/runtime`.

## Verificação read-only (psql, unificard_dev)
- 3 migrations fiscais/KYB (`20260603120000/130000/140000`) **APLICADAS**; `fiscal_identities` com `uq_fiscal_identities_cnpj` + `chk_fiscal_identities_approved_audit`; `fiscal_identity_kyb_requests`/`fiscal_identity_documents` presentes.
- `companies`: `status` (default `active`) **e** `company_status` (default `ACTIVE`) + `is_verified` (false) + `fiscal_identity_id`/`primary_company_type_id`/`primary_concept_id` (nullable).
- `product_offers.price_cents BIGINT` (claim NUMERIC do desenho = STALE) · `services.price_cents INTEGER`.

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0097_PJ_COMPANY_BIRTH_AND_OPERATIONAL_ACTIVATION.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_COMPANY_BIRTH_CANONICAL_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (append entrada DECISION-0097)
- **Editado:** `REMEDIATION_DT_LOG.md` (update SECOND-TRUTH + 2 DTs novas)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md` (entrada da sessão)
- **Editado:** `opus.md` (memória cont.38)

## DTs
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → OPEN (governada pela 0097; resíduo = só schema/Fase 3.3).
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → criada OPEN.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → criada OPEN.
- DT de preço NUMERIC em produto → **não criada** (claim refutada pelo disco).

## Gates
- `validate:actor-writer-boundaries` · `validate:bank-ledger-boundaries` · `validate:regression-guards` · `validate-architectural-patterns --strict` — resultado registrado no relatório da sessão (todos verdes; docs-only).

## Não-toque confirmado
backend · frontend · schema · migrations · Bank · KYB writer · social gate · profile progress · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
(1) Fase 3.3 schema derivada da 0097; ou (2) read-only vocabulário de ativação; ou (3) desenho domain-selection. Nada antes da palavra de Clayton (§9.1–4 do desenho / D10).
