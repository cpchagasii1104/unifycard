# Execução — DECISION-0098 (Vocabulário de ativação operacional PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `6d5dda34` · **Frente:** `F-PJ-OPERATIONAL-ACTIVATION-VOCAB-DECISION`

## Objetivo
Promulgar DECISION docs-only que reconcilia o vocabulário de ativação operacional PJ: o par `(primary_company_type_id, primary_concept_id)` é a única verdade; `businessType`/`businessCategory`/`serviceCategories`/`hybrid`/metadata são entrada/legado/projeção. **Sem código/schema/migration/runtime.**

## Domínios declarados
semântica/CONCEPT · navegação N0/N1/N2 · contexto · ativação operacional PJ · onboarding (projeção) · marketplace/services (trilhos) · financeiro (fronteira negativa).

## Documentos lidos
Full (cadeia): 18_DOMAIN_ONTOLOGY (949), DECISION-0097, SELO_DECISION_0097, CONSTITUICAO, LEIS (Lei 5/7), EMPRESA_NASCIMENTO_CANONICO, REGRA_CANONICA_CRIACAO_DE_CONTEXT, PROHIBITED_STRUCTURES, CRIACAO_DE_EMPRESAS.md (autoral). Por referência: SSOT_REGISTRY, 07_NOMENCLATURA, 19_N1, 20_N2, SERVICE_CANONICO, DEFINICAO_DE_PRODUTO.MD (casing `.MD`). Logs: REMEDIATION_DECISIONS_LOG, REMEDIATION_DT_LOG, STATUS, opus + auditoria read-only de vocabulário.

## SSOT / NÃO-SSOT
SSOT: CONCEPT (semântica); par `(primary_company_type_id, primary_concept_id)` (ativação); `company_type_allowed_concepts` (compat); `tenant_concept_offerings` (oferta futura); `actors(id)` (operacional); `bank_ledger` (fronteira negativa). NÃO-SSOT: businessType/businessCategory/serviceCategories/hybrid/metadata/frontend/slug/category isolada/N0-N1-N2 isolados/marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > DECISION-0097 > código/runtime.

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0098_PJ_OPERATIONAL_ACTIVATION_VOCABULARY.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_OPERATIONAL_ACTIVATION_VOCAB_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (append DECISION-0098)
- **Editado:** `REMEDIATION_DT_LOG.md` (VOCABULARY-DRIFT → GOVERNED; ONBOARDING-DOMAIN-SELECTION → OPEN-GOVERNED; criada MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D12)
D1 par=SSOT único da ativação · D2 validação company_type_allowed_concepts obrigatória, sem fallback · D3 separa eixo A (N0 produtos/serviços/ambos) × eixo B (vertical company_types+concept) · D4 businessType=vertical/UX legado · D5 businessCategory=domínio grosso legado→metadata · D6 serviceCategories≠CONCEPT · D7 hybrid atômico=anti-padrão DEPRECATED ("ambos"=dois trilhos via GRAPH) · D8 marketplace não é SSOT (hybrid→trilhos frente própria) · D9 tenant_concept_offerings=candidato a oferta (writer deriva do par) · D10 onboarding coleta domínio+vertical+concept+trilhos · D11 compat transitória · D12 bloqueios.

## DTs
- `DT-PJ-OPERATIONAL-ACTIVATION-VOCABULARY-DRIFT` → GOVERNED / DECISIONED (OPEN-em-execução).
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → OPEN — GOVERNED.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → criada OPEN.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → permanece CLOSED.

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes).

## Não-toque confirmado
backend · frontend · schema · migrations · Bank · KYB/fiscal · social gate · profile progress · onboarding/vocabulário runtime · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
(1) onboarding domain-selection (read-only/desenho → escreve o par + tenant_concept_offerings + rota de ativação); (2) reconciliação marketplace `hybrid`→trilhos; (3) simetria trilho de serviços. Norma → onboarding → marketplace.
