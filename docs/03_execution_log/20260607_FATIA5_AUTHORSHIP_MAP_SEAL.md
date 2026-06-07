# Execução — F-PLAN-IDENTITY-PROFILE-LIFESTYLE-AUTHORSHIP-MAP-SEAL (DECISION-0113 fatia 5) — docs-only

**Data:** 2026-06-07 · **Modo:** EXECUTOR DOCS-ONLY · **Branch:** `rescue-structural` · **HEAD origem:** `4c8ea369`
**Decisor:** Clayton · **Esteira:** eu (escritora); par verifica.

## Objetivo
Persistir o mapa READ-ONLY da fatia 5, abrir DTs dos achados confirmados, e registrar a confirmação normativa de que **DECISION-0113 governa a autoria do consentimento de Lifestyle** — sem alterar runtime.

## READ-FIRST (confirmado)
- HEAD `4c8ea369`, dev 365, tree limpo. Nenhuma das 4 DTs existia.
- DECISION-0071 = conteúdo do consentimento (explícito/privado/anonimizar), **silente sobre autoria**.
- DECISION-0113 D4 (rota user-facing = autoria server-side) + D5 (leitura sensível exige binding) cobrem a autoria.

## O que foi registrado (docs-only)
1. **`REMEDIATION_DT_LOG.md`** — 4 DTs OPEN:
   - `DT-PLAN-PUT-PRIVILEGE-SPOOF` (duplo-spoof confirmado 1ª mão: privilégio e sujeito do actor declarado).
   - `DT-IDENTITY-CONFIG-ACTOR-SPOOF` (userType PF/PJ cross-user, sem gate).
   - `DT-PROFILE-C1-EXISTENCE-ONLY-RESOLVER` (resolver existence-only nos 3 módulos; bio texto-livre).
   - `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND` (consentimento LGPD forjável; confirmação 0113 registrada).
2. **`REMEDIATION_DECISIONS_LOG.md`** — **adendo interpretativo à DECISION-0113** (autoria do consentimento de Lifestyle), NÃO nova DECISION, NÃO altera DECISION-0071.
3. **STATUS / opus / este log** — atualizados; subfatiamento F5.1/F5.2/F5.3 e "próxima execução = F5.1".

## Confirmação normativa (Clayton)
DECISION-0113 governa a autoria do consentimento de Lifestyle: consentimento/escrita/retirada sensível só pelo principal autenticado representável (`canRepresentActor`) ou delegação formal futura; `performedBy` server-side de `req.user`. Não altera o conteúdo de 0071.

## Subfatiamento (próxima execução = F5.1)
- **F5.1** — `PUT /plan` (**redesign** de privilégio sobre `req.user`) + `PUT /identity/configurations` (`canRepresentActor`/self).
- **F5.2** — profile-C1 (gate `canRepresentActor` no `resolveActorGuarded`).
- **F5.3** — lifestyle (LGPD, por último; gate antes do consent + `performedBy` server-side).

## O que NÃO foi feito (escopo)
Zero código/migration/Bank/frontend/runtime · nenhuma rota/service alterada · F5.1 não executada · `docs/memorias/`/autorais intocados · nova DECISION **não** criada (adendo interpretativo).

## Prova
- **4 gates docs-only OK:** actor-writer · bank-ledger · regression-guards (365) · arch `--strict` `critical_new=0`/`warning_new=1`=c3.
- Working tree: só docs; commit `docs:`.

## DTs
- `DT-PLAN-PUT-PRIVILEGE-SPOOF` · `DT-IDENTITY-CONFIG-ACTOR-SPOOF` · `DT-PROFILE-C1-EXISTENCE-ONLY-RESOLVER` · `DT-LIFESTYLE-CONSENT-AUTHORSHIP-UNBOUND` → **OPEN**.

## Próximo passo
`F-PLAN-IDENTITY-CONFIG-AUTHORSHIP-GATE-F5_1` (código): redesign do privilégio do `PUT /plan` sobre `req.user` + gate `canRepresentActor`/self no `PUT /identity/configurations`.
