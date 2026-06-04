# Execução — F-PJ-PUBLICATION-OFFERING-PROJECTION-WRITER (publicação acende no discovery)

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `21e0beef` · **Governança:** `DECISION-0099` + `DECISION-0100` (D10)

## Objetivo
Projetar discovery em `tenant_concept_offerings` (read-model derivado) a partir do SSOT `company_concept_publications`, DENTRO da mesma transação dos writers publish/unpublish — acender a placa no discovery sem dar trono ao read-model. **Sem schema/migration/frontend; sem alterar o reader marketplace-contextual.**

## SSOT / NÃO-SSOT
SSOT publicação = `company_concept_publications`; projeção/discovery = `tenant_concept_offerings` (read-model derivado, NÃO fonte); CONCEPT (semântica); par `primary_*` (ativação); `actors(id)`/page-actor; `company_users` (autoridade); `fiscal_identities.kyb_status` (já validado no publish); `bank_ledger` (fronteira negativa). NÃO-SSOT: `tenant_concept_offerings` como fonte soberana · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > código.

## Implementação (arquivos)
- **`backend/src/core/companies/company-publications.service.ts`** — 2 helpers + projeção na transação:
  - `projectOfferingActive(client, tenantId, conceptId)` — `INSERT INTO tenant_concept_offerings (tenant_id, concept_id, is_active) VALUES (...,true) ON CONFLICT (tenant_id, concept_id) DO UPDATE SET is_active=true, updated_at=now()` (idempotente). Chamado no publish (caminho idempotente E novo INSERT), antes do COMMIT.
  - `refreshOfferingAfterRetire(client, tenantId, conceptId)` — reconta `company_concept_publications` active do tenant+concept; `UPDATE tenant_concept_offerings SET is_active = (resta ≥1) WHERE tenant_id AND concept_id` (NÃO cria linha inactive nova; NÃO apaga). Chamado no retire (caminho active), antes do COMMIT.
  - Falha na projeção → rollback do writer (atomicidade SSOT↔projeção; mesma tx/cliente).
- **`backend/src/scripts/validate-pipeline-e2e-pj-publication-projection.ts`** + **`scripts/run-pj-publication-projection-ephemeral.ps1`** (novos).
- **`backend/src/scripts/validate-pipeline-e2e-pj-publication-writer.ts`** — T11 ajustado: era "tco inalterada" (agora falso, pois publish projeta); passou a "tco(tenant,primaryConcept) reflete a publicação ativa".

## tenant_concept_offerings continua read-model (não SSOT)
A projeção é CONSEQUÊNCIA da publicação soberana (`company_concept_publications`), nunca fonte. A derivação é: *tenant oferece concept SSE existe ≥1 publicação `active` do tenant nesse concept* (D10). O reader `marketplace-contextual` (`GET /marketplace/contextual`) **não foi alterado** — passa a enxergar tenants indiretamente porque tco foi atualizada. Linhas legadas NÃO são apagadas/backfilladas (D11).

## Prova
- **e2e projeção 13/13** (DB efêmera, app.inject, teardown DROP): publish→tco active; idempotente→sem duplicar (count=1, UNIQUE tenant×concept); 2 empresas mesmo tenant+concept publicadas→tco active; unpublish 1 de 2→continua active; unpublish última→is_active=false (row mantida, não apagada); re-publish após inactive→reativa; KYB pending→409+tco inalterada; **legacy tco (outro concept) intocado**; ccp SSOT origem⇒tco consequência; Bank/actors-só-user-page/company_status não-toque.
- **writer e2e 20/20** (re-rodado; T11 reflete projeção).
- Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. **4 gates OK** (actor-writer/bank-ledger/regression; arch warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → **CLOSED** (shape + writer + projeção entregues; discovery aceso a partir do SSOT; escopo central completo).
- **Criada** `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION` (OPEN) — perda futura de KYB não retira publicação/projeção (gap temporal).
- **Criada** `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` (OPEN) — rebuild idempotente p/ tco legado em prod não-zero.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → CLOSED.

## KYB (frente futura registrada)
A projeção NÃO revalida KYB (o publish já validou no ato). Reação a KYB-revocation (perda futura) é frente própria — `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION`. Não tocou fiscal/KYB writer.

## Não-toque confirmado
schema/migrations · frontend · reader `marketplace-contextual` · hybrid · Bank · KYB/fiscal writer · onboarding · `createCompany` · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
`F-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` (rebuild idempotente p/ prod não-zero) OU `F-PJ-PUBLICATION-OFFERING-KYB-REVOCATION` (KYB-change retira publicação / reader filtra KYB) OU read-only marketplace `hybrid` (ortogonal). Esta fatia acendeu a placa no discovery; não deu trono ao read-model.
