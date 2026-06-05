# Execução — F-PJ-KYB-APPROVED-REVOCATION-WRITER (β.2)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `b0ed4af2` · **Governança:** `DECISION-0101` (D2/D5/D6/D7/D8) · **Esteira:** spec da Batedora, executado.

## Objetivo
Materializar o "botão" fiscal de **saída de approved** (`approved → suspended|closed`) com **cascata atômica** de retração de publicações + recálculo da projeção — o gatilho que faltava para a regra de revogação de DECISION-0101. **Code-only, sem migration** (`kyb_status` já aceita suspended/closed). Sem rota admin nesta fatia (service+cascata+e2e primeiro).

## Prova normativa
KYB approved é gate **contínuo** (0101). Saída de approved retira publicações ativas + recalcula projeção, por **autoridade fiscal** (reviewer humano), **fail-closed** sem actor humano (sem system actor). Reaprovação não republica. CNAE/publicação decidem por estado fiscal, não por opinião de frontend. Esta fatia executa código governado pela 0101 (nenhuma DECISION nova).

## Implementação
**`backend/src/core/companies/company-publications.service.ts`** — novo helper EXPORTADO tx-aware:
`retireAllActivePublicationsForCompanyTx(client, tenantId, companyId, retiredByActorId): { retired, concepts }`
- SELECT publicações `active` da company FOR UPDATE → UPDATE cada para `retired` (retired_at/retired_by_actor_id) → `refreshOfferingAfterRetire(client, tenantId, conceptId)` por concept distinto. Roda no client PASSADO; **não abre/commita transação** (cascata atômica com o caller). Difere de `retireCompanyConceptPublication` (por-concept, autoridade do dono, tx própria): aqui é por autoridade FISCAL sobre o conjunto.

**`backend/src/core/identity/fiscal-identity-kyb.service.ts`** — import `getClientWithTenant` + novo método:
`revokeFiscalKybApproval({ fiscalIdentityId, newStatus:'suspended'|'closed', reason, reviewerActorId })`
1. Valida inputs (newStatus, reason não-vazio, reviewerActorId).
2. **Fail-closed (0101 D5/D6):** `SELECT actor_type FROM actors WHERE id=reviewerActorId`; ausente ou ≠ `'user'` → `KYB_REVOCATION_REQUIRES_HUMAN_REVIEWER` (page-actor/SYSTEM/inexistente recusado).
3. Resolve company+tenant via `companies.fiscal_identity_id` (≤1; CNPJ único). Sem company → flip sem cascata.
4. Tx (`getClientWithTenant(tenant)` com company; `pool.connect()` sem): BEGIN; lock `fiscal_identities` FOR UPDATE; **guard `kyb_status='approved'`** (senão `FISCAL_IDENTITY_NOT_APPROVED`).
5. UPDATE flip + auditoria (reviewed_by/reviewed_at/decision_reason).
6. Se company: `retireAllActivePublicationsForCompanyTx(client, ...)` (mesma tx; import dinâmico, evita ciclo).
7. COMMIT (ou ROLLBACK total em qualquer falha — **atômico**, 0101 D7/D8). Reaprovação não republica (método nunca republica).

## Prova (e2e efêmero `validate-pipeline-e2e-pj-kyb-revocation-cascade.ts` — 15/15 verde)
1. approved→suspended: kyb=suspended; pub=retired; tco=false; reviewer humano + reason gravados; pub retirada pelo reviewer; retiredPublications=1.
2. reviewer = page-actor → recusado (`HUMAN_REVIEWER`), kyb segue approved, pub active.
3. reviewer inexistente → recusado, sem efeito.
4. pending → `NOT_APPROVED`, segue pending.
5. approved sem company → suspended, 0 cascata, sem erro.
6. **atomicidade:** rollback do caller (após flip + cascata no mesmo client) reverte tudo (kyb=approved, pub=active, tco=true) → prova que o helper não auto-commita.
7. reaprovação não republica (pub continua retired).
8. closed: kyb=closed + pub retired + tco inativo.
9. Bank intocado.
- Cada empresa nasce sob OWNER próprio (anti-fraude limita 3 PROVISIONAL/CPF) e publica em PAR DISTINTO (isola o tco tenant×concept). REVIEWER = actor humano dedicado.

## Gates
Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards (financial/sql-lint/numbering) OK · `validate-architectural-patterns.mjs --strict` exit=0, `critical_new=0` (`warning_new=1` = c3 `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334`, baseline pré-existente). **Migrations 360→360** (sem nova migration).

## DTs
- `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` → **CLOSED** (writer + e2e provam).
- `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION` → **CLOSED** (cascata/projeção tem gatilho material).
- `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING` → permanece **OPEN** (filtro KYB no reader contextual = defesa-em-profundidade posterior, 0101 D9).

## Não-toque confirmado
migration/schema (zero) · KYB review (pending→approved|rejected intacto) · publish/retire unitário · frontend · marketplace/hybrid · CNAE seed · Bank · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`. Não criada rota admin (fatia futura opcional).

## Próximo passo
β.1 (aposentar `company-canonical` front+back) — autorizada por Clayton. Resíduo opcional: reader-defense filter (0101 D9). γ/CNAE bloqueada em fonte oficial.
