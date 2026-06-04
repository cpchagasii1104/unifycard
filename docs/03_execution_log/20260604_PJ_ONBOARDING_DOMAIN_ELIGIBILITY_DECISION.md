# Execução — DECISION-0102 (Governança de elegibilidade de domínios no onboarding PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `454d74d3` · **Frente:** `F-PJ-ONBOARDING-DOMAIN-ELIGIBILITY`

## Objetivo
Promulgar DECISION docs-only que governa a elegibilidade de domínios de atuação no onboarding/criação de empresas PJ: antes de a empresa escolher onde aparece, o sistema deriva o ramo real (evidência fiscal + CONCEPT) e só disponibiliza opções compatíveis. **Sem código/schema/migration/frontend/backend-runtime.**

## SSOT / NÃO-SSOT
SSOT: semântica = CONCEPT (`primary_concept_id` no par); identidade operacional = `(primary_company_type_id, primary_concept_id)`; verificação fiscal = `fiscal_identities.kyb_status`; publicação = `company_concept_publications`; `bank_ledger` (fronteira negativa). NÃO-SSOT: businessType/businessCategory/hybrid/metadata/**DomainSelector**/**company_domains**/checkboxes/`MarketplaceDomain` hardcoded · frontend · marketplace orchestration. CNAE/Receita/CNPJ = evidência forte, não substitui CONCEPT. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > 0101 > **0102** > código.

## Evidência material (auditoria read-only)
Tela = `DomainSelector.tsx` (fluxo de criação via `CompaniesManager`), livre escolha por checkbox de 6 `MarketplaceDomain`. `createCompany` faz INSERT pós-commit em `company_domains` — **tabela inexistente** (42P01 engolido) = **ghost**; campo obrigatório não persiste. CNAE da Receita **descartado**. **Fork** `MarketplaceDomain`(6) ≠ `concepts.domain`(13 N0), sem mapeamento. Elegibilidade **derivável** hoje: `company_type_allowed_concepts ⋈ concepts.domain` (1 domínio/type).

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0102_PJ_ONBOARDING_DOMAIN_ELIGIBILITY_GOVERNANCE.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_ONBOARDING_DOMAIN_ELIGIBILITY_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0102)
- **Editado:** `REMEDIATION_DT_LOG.md` (ONBOARDING-DOMAIN-SELECTION nota; HYBRID nota; criadas 3 DTs)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D14)
D1 domínio NÃO é livre escolha (derivado de CONCEPT + backend) · D2 CONCEPT = fonte semântica; CNAE/Receita = evidência · D3 modelo 6 camadas (fiscal→identidade→elegível→solicitado→aprovado→em-revisão) · D4 evidência fiscal sugere/reforça, não aprova; CNAE persistir como evidência (não SSOT) · D5 elegíveis derivados de concept/company_type/concepts.domain (+GRAPH governado) · D6 solicitar≠aprovar (incompatível→revisão) · D7 aprovado = elegível∩autorizado; publica só após KYB+ato soberano · D8 fora da elegibilidade→revisão/comprovação · D9 `DomainSelector` livre = drift (remover/desabilitar/converter em "solicitação") · D10 `company_domains` = ghost (DT própria) · D11 reconciliar fork `MarketplaceDomain↔concepts.domain` antes de religar marketplace · D12 Empregos = capability transversal, não domínio · D13 Imóveis/Veículos = regulados (não checkbox livre) · D14 exemplos consultoria/restaurante.

## DTs
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED (+ elegibilidade governada).
- **Criada** `DT-PJ-COMPANY-DOMAINS-GHOST-WRITER` (OPEN) — write morto em tabela inexistente.
- **Criada** `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (OPEN) — `MarketplaceDomain` ≠ `concepts.domain` N0.
- **Criada** `DT-PJ-CNAE-EVIDENCE-NOT-PERSISTED` (OPEN) — CNAE da Receita descartado.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN (reforçada).
- Não reabertas: `SOVEREIGN-SHAPE-MISSING` · `TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` · `COMPANY-STATUS-KYB-SECOND-TRUTH` (CLOSED).

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes, warning_new=1 = c3 pré-existente).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · marketplace · publication · KYB · Bank · onboarding runtime · `DomainSelector` runtime · `company_domains` (não criada) · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
`F-PJ-DOMAIN-SELECTOR-NEUTRALIZE` (read-only/desenho → frontend): parar o ghost write `company_domains` + neutralizar a livre-escolha do `DomainSelector` (remover/desabilitar ou converter em "solicitação de domínios" governada, D6/D9) — resolve a UX mentirosa sem inventar verdade. Depois `F-PJ-CNAE-EVIDENCE-PERSIST` e `F-PJ-DOMAIN-ELIGIBILITY-DERIVATION`. Esta sessão decide quem pode pedir qual palco; não abre o palco.
