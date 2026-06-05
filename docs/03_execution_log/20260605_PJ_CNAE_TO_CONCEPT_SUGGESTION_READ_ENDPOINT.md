# Execução — F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `41967c88` · **Governança:** `DECISION-0104` · **Esteira:** eu (escritora); par verifica read-only; Clayton serializou.

## Objetivo
Transformar a matriz γ semeada (`cnae_concept_suggestions`, 8 sugestões curadas) em **sugestão consultável** via endpoint/serviço **read-only**. Normalizar `cnae_code` (resolve a costura de formato). Retornar display label do concept se disponível no substrato. CNAE **só sugere a porta**; não decide.

## Prova normativa
CNAE é sinal (DECISION-0104 D1): o endpoint **sugere** `concept`, NÃO ativa empresa, NÃO escreve `primary_company_type_id`/`primary_concept_id`, NÃO publica, NÃO toca `canonical_products`/Bank. CONCEPT segue identidade semântica; `company_type` derivado com segurança (não vira autoridade). Cadeia de produto: CNAE aponta a porta → company_type pré-molda → CONCEPT identifica → canonical_products fornece itens → empresa ativa mix.

## Implementação
**`backend/src/core/companies/companies.service.ts`** — `suggestConceptForCnae(rawCnae)` (read-only, matriz GLOBAL via `pool`):
- **Normalização:** `String(raw).replace(/\D/g,'')`; valida `^\d{7}$`. Inválido → `{ valid:false, normalizedCnaeCode, suggestion:null }`. **Fecha a `DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM`** (consumidor normaliza antes do lookup).
- **Lookup:** `cnae_concept_suggestions` JOIN `concepts`, `WHERE cnae_code=$ AND is_active AND review_status='approved'`, `ORDER BY confidence(high>medium>low), slug` `LIMIT 1`. Sem match → `suggestion:null` (válido, vazio honesto).
- **Derivação segura de company_type:** SÓ se **exatamente 1** type permite o concept (`company_type_allowed_concepts`); senão `null`.
- **Display name:** `concepts` não tem display name (`DT-PJ-CONCEPT-DISPLAY-NAME-MISSING`) → `suggestedConceptDisplayName = null` (leitura honesta do substrato, nunca nova fonte).
- **SELECT-only:** nenhum INSERT/UPDATE; resolve concept por FK/slug (sem hardcode de UUID).

**`backend/src/core/companies/companies.routes.ts`** — `GET /operational-activation/cnae-suggestion?cnae=<código>` (query param p/ aceitar máscara): 401 não-autenticado · 400 tenant ausente · **400 `INVALID_CNAE`** (com `normalizedCnaeCode`) · **200 `{ ok:true, data: suggestion|null }`** (data=null = vazio honesto, sem fallback).

## Prova (e2e efêmero `validate-pipeline-e2e-pj-cnae-suggestion-read-endpoint.ts`, app.inject + JWT — 16/16 verde)
1. sem máscara `4711302` → 200, `varejo-alimentar-integrado` [high], `normalizedCnaeCode=4711302`, source/version presentes, `companyTypeSlug=supermercado`, `displayName=null`.
2. **máscara `4711-3/02` → MESMA sugestão** (mesmo `suggestedConceptId`, `normalizedCnaeCode=4711302`) — normalização provada.
3. CNAE inválido `123` / não-numérico → **400 `INVALID_CNAE`**.
4. válido `9999999` sem sugestão → **200 `data=null`** (sem fallback).
5. `9602-5/01` → salão (`servicos-pessoais-beleza`, `companyTypeSlug=salao`).
6. **não-toque:** 8 curadas intactas; **zero** `companies.primary_*`; `company_concept_publications`/`tenant_concept_offerings`/Bank intocados.

- Backend tsc: só os 2 baseline `geo-enrichment.service.ts`. Gates: actor-writer/bank-ledger/regression-guards OK; `validate-architectural-patterns.mjs --strict` exit=0 (`critical_new=0`; `warning_new=1`=c3 baseline). **Migrations 361→361** (sem nova migration). Grep: `suggestConceptForCnae` SELECT-only (writes em createCompany/activate são pré-existentes, fora do caminho da sugestão).

## DTs
- `DT-PJ-CNAE-TO-CONCEPT-SUGGESTION-MATRIX-MISSING` → **CLOSED** (schema + seed γ + read endpoint).
- `DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM` → **CLOSED** (consumidor normaliza).
- Resíduos (frentes próprias): `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING` (OPEN); consumo no wizard frontend.

## Não-toque confirmado
migration/schema (zero; 361) · activation (não ativa; não escreve primary_*) · publication · `canonical_products` · Bank · Trilhos A/B · peixaria · frontend grande (só backend) · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
display name de concept (pra UI não exibir slug técnico — `DT-PJ-CONCEPT-DISPLAY-NAME-MISSING`) · consumo no wizard de onboarding (frontend) · Trilhos A/B (governados pela DT do catálogo canônico) · decisão peixaria. Estágio 3 (Classificação) agora funcional ponta a ponta (matriz semeada + consultável).
