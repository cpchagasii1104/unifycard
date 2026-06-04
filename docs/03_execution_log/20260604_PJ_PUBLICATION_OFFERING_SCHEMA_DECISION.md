# Execução — DECISION-0100 (Modelo de schema/writer de publicação/oferta PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e5163e60` · **Frente:** `F-PJ-PUBLICATION-OFFERING-SCHEMA-DECISION`

## Objetivo
Promulgar DECISION técnica docs-only que ratifica o modelo de schema/writer de publicação/oferta PJ (executa DECISION-0099 D11), resolvendo as sub-decisões abertas antes de qualquer migration: tabela soberana, nome, granularidade, escopo do concept, KYB/autoridade, lifecycle, anti-duplicidade, audit, destino do read-model. **Sem migration/código/writer/schema/runtime.**

## Domínios declarados
publicação/oferta · descoberta/matching · autoridade/page-actor · KYB/fiscal (gate) · semântica/CONCEPT · schema futuro · tenant como agregação/projeção · financeiro (fronteira negativa).

## Documentos lidos
Cadeia normativa + decisões: 00_AGENT_PROTOCOL · CONSTITUICAO · LEIS (5/7) · SSOT_REGISTRY · LEI_COERENCIA · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY · REGRA_CANONICA_CRIACAO_DE_CONTEXT · EMPRESA_NASCIMENTO_CANONICO · SERVICE_CANONICO · DECISION-0097/0098/0099 · execution log 0099 · REMEDIATION_DECISIONS_LOG · REMEDIATION_DT_LOG · STATUS · opus + relatório read-only `F-PJ-PUBLICATION-OFFERING-SCHEMA-WRITER-DESIGN`.

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); publicação futura = `company_concept_publications` (company/page-actor×concept); `actors(id)`/page-actor; `company_users` (autoridade); `fiscal_identities.kyb_status` (verificação fiscal); `bank_ledger` (fronteira negativa). NÃO-SSOT de publicação: `tenant_concept_offerings` atual · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > **0100** > código.

## Evidência material (desenho read-only)
`tenant_concept_offerings` = tenant×concept (UNIQUE tenant+concept, sem company/actor/audit), 0 linhas dev; reader vivo `marketplace-contextual` (`GET /marketplace/contextual`, cross-tenant, sem gate KYB). `actors` PK=`id` (id===actor_id). Gate KYB de page-actor **já vivo** (`authority-decision.evaluateKybLayer`, DECISION-0088/0094: actors→companies.fiscal_identity_id→fiscal_identities.kyb_status='approved', fail-closed). `canManageCompany` já existe. Opção 2 (evoluir tco) rejeitada; Opção 3 (tabela soberana + projeção) recomendada.

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0100_PJ_PUBLICATION_OFFERING_SCHEMA_MODEL.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_PUBLICATION_OFFERING_SCHEMA_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0100)
- **Editado:** `REMEDIATION_DT_LOG.md` (SOVEREIGN-SHAPE-MISSING → GOVERNED/DECISIONED)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D12)
D1 Opção 3 (tabela soberana + tco projeção) · D2 nome `company_concept_publications` · D3 granularidade (tenant_id, company_id, page_actor_id, concept_id) · D4 MVP só `primary_concept_id` (`CONCEPT_NOT_ACTIVATED`) · D5 KYB approved obrigatório (`KYB_NOT_APPROVED`, fail-closed) · D6 autoridade `company_users` manage/owner + page-actor (`PUBLICATION_FORBIDDEN`) · D7 lifecycle `active|retired` (retired_at coerente; published_at obrigatório) · D8 UNIQUE parcial `(company_id, concept_id) WHERE status='active'` · D9 audit inline (published_at/retired_at/created_by/retired_by/source/intent) · D10 tco = read-model/projeção derivada, reader contextual intocado · D11 sem backfill/auto-publicação/apagar legado/fail por legado · D12 bloqueios totais.

## DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **GOVERNED / DECISIONED** (sai de OPEN; schema decidido + migration autorizável; **não CLOSED**).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes, warning_new=1 = c3 pré-existente).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · Bank · KYB/fiscal writer · marketplace/hybrid · onboarding · `tenant_concept_offerings` runtime · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
`F-PJ-PUBLICATION-OFFERING-SCHEMA-MIGRATION` (schema-only: cria `company_concept_publications`, forward-only/idempotente, sem writer, testes CHECK/UNIQUE/FK) OU read-only marketplace `hybrid` (ortogonal). Ordem: schema-migration → writer gated → projeção. Esta sessão escolheu o molde da placa pública; não instala a placa.
