# Execução — DECISION-0099 (Governança de publicação/oferta da empresa PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `c72fdd72` · **Frente:** `F-PJ-PUBLICATION-OFFERING-DECISION`

## Objetivo
Promulgar DECISION docs-only que separa **publicação/oferta** de **ativação operacional** PJ: ativar grava o que a empresa É (par `primary_*`); publicar decide se o mundo encontra/consome a empresa por um conceito. Publicação é company/page-actor-level, gateada por KYB/autoridade, reversível, auditável. Writer automático de oferta na ativação proibido. **Sem código/schema/migration/runtime.**

## Domínios declarados
semântica/CONCEPT · ativação operacional PJ · publicação/oferta · descoberta/matching · autoridade/page-actor · KYB/fiscal (gate) · marketplace (consumidor/fronteira) · financeiro (fronteira negativa).

## Documentos lidos
Cadeia normativa + decisões desta sessão: 00_AGENT_PROTOCOL · CONSTITUICAO · LEIS (5/7) · SSOT_REGISTRY · LEI_COERENCIA · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY · REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO (§8) · SERVICE_CANONICO · DEFINICAO_DE_PRODUTO.MD · DECISION-0097 · DECISION-0098 · execution logs PJ (route/read/onboarding/flow) · REMEDIATION_DECISIONS_LOG · REMEDIATION_DT_LOG · STATUS · opus + relatório read-only `F-PJ-TENANT-CONCEPT-OFFERINGS`.

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `actors(id)`/page-actor (operacional); `fiscal_identities.kyb_status` (verificação fiscal); publicação/oferta = **a definir por esta DECISION**, não pela tabela atual; `bank_ledger` (fronteira negativa). NÃO-SSOT de publicação: metadata/businessType/businessCategory/hybrid/frontend/marketplace orchestration/`tenant_concept_offerings` atual como shape soberano. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > **0099** > código.

## Evidência material (auditoria read-only)
tco = `tenant×concept` (UNIQUE tenant_id+concept_id), FK tenants/concepts, lifecycle só `is_active`, **sem** company_id/page_actor_id/created_by/source/published_at/retired_at/visibility/audit; 0 linhas; reader único `listTenantsOfferingConcept` → `marketplace-contextual` (`GET /marketplace/contextual`, cross-tenant, **sem gate KYB/capability/page-actor**); **sem writer**; ativação NÃO escreve oferta. Automático seria perigoso (publica tenant inteiro, sem reversibilidade por empresa, colapsa empresas, sem audit/KYB).

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0099_PJ_PUBLICATION_OFFERING_GOVERNANCE.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_PUBLICATION_OFFERING_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0099)
- **Editado:** `REMEDIATION_DT_LOG.md` (criada `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING`; notas em ONBOARDING-DOMAIN-SELECTION / VOCABULARY-DRIFT / MARKETPLACE-HYBRID)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D12)
D1 publicar≠ativar · D2 writer automático de oferta na ativação proibido · D3 granularidade company/page-actor×concept (tenant-level só agregação) · D4 `tenant_concept_offerings` = read-model/compat, sem writer novo · D5 publicação pública exige `kyb_status='approved'` · D6 autoridade `company_users` manage + page-actor + responsável humano · D7 reversível (despublicar uma empresa não apaga outra) · D8 auditável (quem/quando/source) · D9 discovery/matching só de publicações governadas · D10 não resolve hybrid (ortogonal) · D11 schema-alvo futuro company/page-actor×concept (autorizado a DESENHAR, não implementar) · D12 bloqueios totais (sem código/migration/writer/tco/marketplace/hybrid/Bank/KYB/onboarding).

## DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **criada OPEN** (governada por 0099).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED (offering automático bloqueado).
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → PARTIALLY MITIGATED (separação ativação/publicação).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN (ortogonal; nota 0099).
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes, warning_new=1 = c3 pré-existente).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · Bank · KYB/fiscal writer · marketplace/hybrid · onboarding · `tenant_concept_offerings` runtime · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
DESENHO técnico (read-only) do schema/writer de publicação company/page-actor×concept gated (KYB approved + `company_users` manage + page-actor, reversível, auditável) OU read-only marketplace `hybrid`→trilhos (ortogonal). Ordem: norma (esta) → desenho schema/writer publicação → execução gated.
