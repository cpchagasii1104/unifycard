# Execução — F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-DECISION

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `6daecd05` · **Promulga:** `DECISION-0104`

## Objetivo
Promulgar (docs-only) a governança da matriz CNAE → `suggested_concept`, consolidando o relatório read-only `F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX`. Fixar que CNAE é **sinal/evidência** e que CONCEPT continua a identidade semântica soberana — **decide como o CNAE pode sugerir, não deixa o CNAE escolher**. Sem código/schema/migration/seed/endpoint/frontend.

## Prova normativa
Semântica = CONCEPT (Lei 7). CNAE/Receita/CNPJ = evidência fiscal/cadastral, **não** SSOT semântico. CNAE **não** substitui `(primary_company_type_id, primary_concept_id)`, **não** autoriza publicação nem domínio, **pode sugerir** candidatos, **não** decide identidade. "Sugestão pode nascer sozinha; ação nunca." Frontend não cria taxonomia. Ativação operacional PJ continua sendo POST explícito do par soberano. Publicação/oferta só após KYB + ato soberano. Esta DECISION define **sugestão** — não ativação, não publicação, não elegibilidade final. Precedência: Constituição > Leis > SSOT Registry > Ontologia > DECISION-0097 > 0098 > 0102 > 0103 > **0104** > código/runtime.

## Base material (relatório read-only; dev HEAD `6daecd05`, 359 migrations)
- `fiscal_identity_economic_activities` viva (cnae_code/cnae_description/is_primary/source/fetched_at/fiscal_identity_id; 0 linhas). Writer persiste principal/secundários, idempotente, sem QSA.
- `company_types` = 7 (açougue, farmácia, hortifruti, padaria, restaurante, salão, supermercado).
- `company_type_allowed_concepts` = 7 (1:1 type↔concept). `concepts` = 137 em 13 N0, **sem display name** (só slug/domain). `concepts.domain` FK → `domains.domain_key` (21 N0).
- **Sem** lista oficial / seed / tabela CNAE no repo. **Sem** matriz CNAE→concept. Cobertura semântica estreita (7 verticais); fora delas (consultoria/imobiliária/veículos/indústria) sem alvo. Importar CNAE inteiro = risco alto → MVP seletivo.
- Precedente: `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE` (RASCUNHO, `02_decisions/`) + `SEMANTIC_CATALOG_GOVERNANCE` (complemento subordinado, `02_decisions/`) — sinal→sugestão pending→Aplicar; inferência antes; teste de desligamento.

## DECISION criada
`docs/02_decisions/DECISION_0104_PJ_CNAE_TO_CONCEPT_SUGGESTION_MATRIX.md` (próximo nº livre — 0103 era o maior; confirmado por glob + grep sem 0104+).

**Resumo D1–D16:** D1 sinal-não-autoridade · D2 CONCEPT soberano (par muda só por ativação explícita) · D3 cnae→`suggested_concept_id` (não MarketplaceDomain/N0/type) · D4 company_type derivado via `company_type_allowed_concepts` · D5 multi-candidato · D6 confidence obrigatório (principal>secundário) · D7 rationale/source/version · D8 review_status (curadoria humana) · D9 MVP seletivo (7 verticais; proibido CNAE oficial inteiro) · D10 exact-match primeiro (prefixo futuro) · D11 sugestão `pending` (aplicação explícita) · D12 **autoativação proibida** (sem `primary_*`/`company_concept_publications`/`tenant_concept_offerings`; sem chamar ativação) · D13 wizard pré-seleciona com confirmação · D14 consultoria/imóveis/veículos → nenhuma sugestão ou revisão · D15 Empregos fora (capability) · D16 alimenta só camada 1→2, não fecha elegibilidade de domínios.

## DTs criadas/atualizadas
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → **GOVERNED / DECISIONED** (não CLOSED — falta schema + seed MVP + read endpoint).
- **Criada** `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (OPEN) — concepts sem display name/label; wizard exibiria slug/domain até display governado.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → nota: matriz CNAE alimenta só camada 1→2; permanece PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` → nota: pré-requisito da camada `allowed domains`, **não** bloqueia a matriz CNAE→concept; permanece OPEN.
- Não reabertas: `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` / `DT-PJ-COMPANY-ACTIVITY-COLUMNS-GHOST` / `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` / `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (CLOSED).

## Gates (docs-only)
`git diff --name-only` = só markdown autorizado. actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards (financial/sql-lint/numbering) OK · `validate-architectural-patterns.mjs --strict` exit=0, `critical_new=0` (`warning_new=1` = `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334`, baseline pré-existente, fora desta fatia).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · CNAE writer · activation route · publication · KYB · marketplace/hybrid · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. Nenhum concept/company_type criado; nenhuma importação de CNAE.

## Próximo passo
`F-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-SCHEMA-MIGRATION` (schema-only: tabela da matriz `cnae_code`→`suggested_concept_id`, multi-candidato/confidence/rationale/source/version/review_status, global; forward-only; sem seed/writer; testes CHECK/FK/UNIQUE) → `...-SEED-MVP` (7 verticais) → `...-READ-ENDPOINT` → wizard suggestion. Ortogonal: `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-READONLY` (pré-req da camada de domínios elegíveis, não da matriz). Esta sessão decide como o CNAE pode sugerir; não deixa o CNAE escolher.
