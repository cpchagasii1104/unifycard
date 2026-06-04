# Execução — F-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD-SCRIPT

**Data:** 2026-06-04 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `72376330` · **Governança:** `DECISION-0099` + `DECISION-0100` (D10/D11)

## Objetivo
Criar um script idempotente de reconciliação de `tenant_concept_offerings` (read-model) a partir do SSOT `company_concept_publications`, para ambientes prod/staging com linhas legadas. **Limpa o read-model antigo sem mudar a verdade; não dá trono ao read-model.** Sem schema/migration/writer/reader/frontend/Bank.

## SSOT / NÃO-SSOT
SSOT publicação = `company_concept_publications`; read-model/discovery = `tenant_concept_offerings` (derivado, NÃO fonte); CONCEPT (semântica); par `primary_*` (ativação); `bank_ledger` (fronteira negativa). NÃO-SSOT: tco como fonte soberana · metadata · businessType · businessCategory · hybrid · frontend · marketplace orchestration. Precedência: Constituição > Leis > SSOT Registry > Ontologia > 0097 > 0098 > 0099 > 0100 > código.

## Regra soberana (única)
Tenant oferece concept **SSE** existe ≥1 publicação `active` em `company_concept_publications` para `(tenant_id, concept_id)`. Derivação **EXCLUSIVA** de `ccp.status='active'` — SEM join a `fiscal_identities`/`kyb_status` (reação a KYB-revocation é frente própria: `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION`).

## Implementação (arquivos — só script/teste)
- **`backend/src/scripts/rebuild-tenant-concept-offerings.ts`** (novo): função exportada `rebuildTenantConceptOfferings({ apply })` + `main()`.
  - **dry-run por PADRÃO** (zero DML); **`--apply`** explícito escreve.
  - **Guard** `EXPECTED_DATABASE_NAME` == `current_database()` (recusa alvo implícito/errado → ABORT exit 2).
  - **Apply** em transação única, 3 statements: (1) INSERT active dos pares soberanos ausentes; (2) UPDATE reativa tco inactive com lastro; (3) UPDATE desativa tco active sem lastro. **NUNCA deleta · NUNCA cria inactive nova** (insert só com is_active=true) · preserva `created_at`.
  - Dry-run imprime contagens (a criar / a reativar / a desativar / já-corretas / inactive-mantidas) + sample (tenant, concept, atual→alvo).
  - `main()` só executa se invocado diretamente (guard `process.argv[1]`), permitindo import limpo pelo e2e.
- **`backend/src/scripts/validate-pipeline-e2e-pj-tenant-concept-offerings-rebuild.ts`** (novo) + **`scripts/run-pj-tenant-concept-offerings-rebuild-ephemeral.ps1`** (novo).

## Prova
- **e2e 11/11** (DB efêmera, teardown DROP) sobre 5 estados — A: ccp active sem tco; B: tco inactive+ccp; C: tco active legado sem ccp; D: tco active+ccp; E: tco inactive sem ccp:
  dry-run conta 1/1/1/1/1 e NÃO altera; apply created=1/reactivated=1/deactivated=1 → A active, B active, C inactive, D active, E inactive; **nunca deleta** (rows 4→5); **não cria inactive nova** (inactive=2: C,E); **KYB não filtrado** (A ativa apesar da empresa com KYB pending); **idempotência** (2ª apply 0/0/0, estados estáveis); Bank intocado; actors só user/page.
- **Standalone** em `unificard_dev` (dry-run): banco coerente → 0/0/0/0/0 (no-op, exit 0). Guard com `EXPECTED_DATABASE_NAME` errado → `ABORT` exit 2.
- Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. **4 gates OK** (warning_new=1 = c3 pré-existente).

## DTs
- `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` → **CLOSED**.
- `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION` → permanece OPEN.
- `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` → permanece CLOSED.
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` → OPEN.
- `DT-PJ-ONBOARDING-DOMAIN-SELECTION-MISSING` → PARTIALLY MITIGATED / GOVERNED.
- `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` → CLOSED.

## Não-toque confirmado
schema/migrations · writer publish/unpublish · marketplace/contextual reader · frontend · hybrid · Bank · KYB/fiscal writer · onboarding · `createCompany` · `company_status` · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. (Só script + e2e tocados; nenhum DML fora do e2e efêmero e do dry-run no-op em dev.)

## Próximo passo
`F-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-READONLY` (desenho: KYB-change retira publicação / reader filtra KYB approved — defesa-em-profundidade) OU read-only marketplace `hybrid` (ortogonal). Esta fatia limpou o read-model antigo; não mudou a verdade; não deixou a vassoura virar rei.
