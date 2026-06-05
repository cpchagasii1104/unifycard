# Execução — F-PJ-KYB-REVOCATION-READER-DEFENSE (#2)

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `1040130f` · **Governança:** `DECISION-0101` (D9) · autorizado por Clayton ("go #2").

## Objetivo
Implementar o **filtro defensivo KYB-approved** no reader de discovery contextual — a defesa-em-profundidade prevista em DECISION-0101 D9, agora liberada porque o writer de revogação (β.2) já corrige o SSOT. Fatia pequena, read-only/defesa, **zero schema/migration**.

## Nota de serialização
A DT (`REMEDIATION_DT_LOG.md:11190`) exigia explicitamente "**NÃO executar antes da palavra de Clayton (DECISION-0101 D9/D12)**". A instância verificadora pegou esse ponto; confirmei na fonte e só executei após o "go #2" de Clayton. Pré-requisito técnico (writer existir) cumprido por β.2; o gate de autoridade era a palavra de Clayton.

## SSOT / NÃO-SSOT
`company_concept_publications` = SSOT da publicação; `tenant_concept_offerings` = read-model derivado; o writer de revogação KYB (β.2) corrige ambos atomicamente. O filtro do reader é **cinto-e-suspensório** — NÃO inverte a fonte; só impede vazamento se a projeção ficar stale.

## Implementação
**`backend/src/modules/marketplace/tenant-concept-offerings.repository.ts`** — `listTenantsOfferingConcept(conceptId)` ganhou, além de `tco.is_active = TRUE`, um `EXISTS`:
```sql
AND EXISTS (
  SELECT 1 FROM company_concept_publications ccp
  INNER JOIN companies c ON c.company_id = ccp.company_id
  INNER JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
  WHERE ccp.tenant_id = tco.tenant_id AND ccp.concept_id = tco.concept_id
    AND ccp.status = 'active' AND fi.kyb_status = 'approved'
)
```
Contrato preservado (mesmo `TenantOfferingRow[]`; caller `marketplace-contextual.service` inalterado). Zero schema/migration.

## Prova
- **e2e efêmero `validate-pipeline-e2e-pj-kyb-revocation-reader-defense.ts` 6/6 verde:**
  1. aprovado+publicado → tenant **aparece** no reader.
  2. após revogação KYB (writer β.2) → tenant **some** (tco inativo + EXISTS falso).
  3. **DEFESA (teste central):** tco forçado `is_active=TRUE` (projeção **stale**) sem lastro KYB → tenant **NÃO aparece** (EXISTS barra) — prova que a defesa funciona mesmo se a projeção mentir.
  4. controle positivo: outro concept aprovado+publicado **aparece** (o filtro não super-exclui).
  5. tco legado active **sem publicação** alguma → tenant **não aparece** (EXISTS falso).
- Backend tsc: só os 2 baseline `geo-enrichment.service.ts`.
- Gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK · `validate-architectural-patterns.mjs --strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). Migrations **360→360**.

## DT
- `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING` → **CLOSED**.

## Não-toque confirmado
schema/migration (zero) · writer KYB (β.2 intacto) · publish/retire · Bank · frontend · CNAE · marketplace/hybrid · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Estado do ciclo de revogação KYB
**COMPLETO:** writer (β.2 `revokeFiscalKybApproval`) + cascata atômica (retração + projeção) + reader-defense (#2). A espinha PJ está fechada ponta-a-ponta (Fundação → Classificação → Gates/publicação/revogação).

## Próximo passo
γ/CNAE seed (bloqueado em fonte oficial do Clayton) OU profundidade (Trilhos A/B: catálogo/preço/estoque · agenda/booking).
