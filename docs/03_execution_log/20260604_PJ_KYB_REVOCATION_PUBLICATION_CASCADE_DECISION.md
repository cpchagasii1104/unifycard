# Execução — DECISION-0101 (Revogação/perda de KYB approved → cascata sobre publicações PJ)

**Data:** 2026-06-04 · **Modo:** EXECUTOR DOCS-ONLY CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `e90b3152` · **Frente:** `F-PJ-PUBLICATION-OFFERING-KYB-REVOCATION`

## Objetivo
Promulgar DECISION docs-only que define a regra normativa de revogação/perda de KYB approved e seu efeito sobre publicações PJ, consolidando as auditorias paralelas A/B/C. **Sem código/schema/migration/runtime; sem alterar KYB writer/publication writer/reader.**

## Domínios declarados
KYB/fiscal · publicação/oferta · discovery/read-model · autoridade/page-actor · audit/reversibilidade · financeiro (fronteira negativa).

## Documentos lidos
Cadeia normativa + decisões: 00_AGENT_PROTOCOL · CONSTITUICAO · LEIS (5/7) · SSOT_REGISTRY · LEI_COERENCIA · 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY · EMPRESA_NASCIMENTO_CANONICO · SERVICE_CANONICO · DECISION-0097/0098/0099/0100 · execution logs writer/projection/rebuild · REMEDIATION_DECISIONS_LOG · REMEDIATION_DT_LOG · STATUS · opus + auditorias A/B/C recebidas por Clayton.

## SSOT / NÃO-SSOT
SSOT: verificação fiscal = `fiscal_identities.kyb_status`; publicação = `company_concept_publications`; projeção/discovery = `tenant_concept_offerings` (read-model); CONCEPT (semântica); `actors(id)`/page-actor; `bank_ledger` (fronteira negativa). NÃO-SSOT: tco como fonte soberana · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration · **reader filter como substituto do SSOT**. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > **0101** > código.

## Base material (auditorias A/B/C)
A: KYB writer só `pending → approved|rejected`; sem writer para saída de approved; sem hook pós-KYB → cascata sem gatilho. B: publication writer escreve ccp + projeção; `retire` atual exige autoridade do dono (não serve p/ retirada sistêmica); schema suporta retirada mas há conflito sobre actor/audit institucional. C: reader não filtra KYB; filter sozinho mascararia ccp active inconsistente → corrigir SSOT primeiro. Audit: KYB review tem `reviewed_by_actor_id`; retire tem `retired_by_actor_id`; sem padrão de system actor soberano → reviewer humano é o caminho canônico.

## Arquivos alterados (docs-only)
- **Criado:** `docs/02_decisions/DECISION_0101_PJ_KYB_REVOCATION_PUBLICATION_CASCADE.md`
- **Criado:** `docs/03_execution_log/20260604_PJ_KYB_REVOCATION_PUBLICATION_CASCADE_DECISION.md` (este)
- **Editado:** `REMEDIATION_DECISIONS_LOG.md` (entrada DECISION-0101)
- **Editado:** `REMEDIATION_DT_LOG.md` (KYB-REVOCATION-PROJECTION → GOVERNED/DECISIONED; criadas 2 DTs)
- **Editado:** `STATUS_EXECUCAO_GLOBAL.md`, `opus.md`

## Resumo decisório (D1–D12)
D1 KYB approved = gate CONTÍNUO · D2 saída de approved RETIRA publicações ativas · D3 reaprovação NÃO republica · D4 retirada por KYB é sistêmica/institucional (não do dono) · D5 audit = actor humano do reviewer (`retired_by_actor_id`, `source='kyb_revocation'`) · D6 SEM `SYSTEM_ACTOR_ID` hardcoded; sem humano auditável → fail-closed · D7 retirada recalcula projeção (isolamento por empresa) · D8 atomicidade (KYB+retirada+projeção; senão rollback fail-closed) · D9 reader filter = defesa-em-profundidade posterior, não substituto · D10 rebuild não filtra KYB · D11 writer de saída de approved NÃO existe (ato fiscal vem antes da cascata) · D12 bloqueios totais.

## DTs
- `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION` → **GOVERNED / DECISIONED** (regra fixada; não CLOSED — falta runtime).
- **Criada** `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` (OPEN) — runtime sem writer de `approved → rejected/suspended/closed`.
- **Criada** `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING` (OPEN) — filtro defensivo KYB só após o writer.
- Não reabertas: `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` (CLOSED) · `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` (CLOSED) · `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (CLOSED).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN (ortogonal).

## Gates
actor-writer · bank-ledger · regression · arch --strict — resultado no relatório da sessão (docs-only; todos verdes, warning_new=1 = c3 pré-existente).

## Não-toque confirmado
backend runtime · frontend · schema · migrations · writer KYB · publication writer · marketplace/contextual reader · Bank · onboarding · hybrid · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo (sem execução)
`F-PJ-KYB-APPROVED-REVOCATION-WRITER` (read-only/DESENHO): o ato fiscal `approved → rejected/suspended/closed` com autoridade fiscal + actor humano do reviewer (D4/D5/D6) ANTES da cascata de retirada + projeção atômica (D2/D7/D8). Depois, reader defensivo (D9). Ortogonal: marketplace hybrid read-only. Esta sessão decidiu QUANDO a placa apaga; não mexeu no interruptor. O botão de sair de approved ainda nem existe — desenhá-lo é a próxima frente.
