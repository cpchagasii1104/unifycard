# Execução — F-PJ-ONBOARDING-MODULES-DERIVED-FROM-CLASSIFICATION — frontend-only

**Data:** 2026-06-06 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `3c7ee6e0` · **Decisão:** Clayton — trocar a etapa module-first por resumo derivado da classificação · **Esteira:** eu (escritora); par verifica.

## Objetivo
Corrigir o resíduo **module-first** no onboarding PJ: a Etapa 2 mostrava uma tela genérica de módulos (Serviços/Eventos/Agenda/Financeiro) que ignorava a classificação recém-feita e forçava o usuário a marcar um módulo irrelevante para avançar. Substituir por **resumo derivado** do `domain` do concept classificado. Frontend-only.

## READ-FIRST (confirmado na auditoria)
- Tela em `CompanyOnboardingWizard.tsx` Etapa 2 (h2 "Quais módulos você quer ativar?"); 4 `module-card` hardcoded.
- `modules` (`CompanyModules`) = metadata de UX salva em `companies.metadata.onboarding.modules`, **não-operacional** (rotulada "Config de UX (NÃO é verdade operacional)"); **nenhum backend a consome operacionalmente** (só `@deprecated` em `marketplace-company.service.ts:306` + contexto de IA). Verdade operacional = par soberano (`activateCompanyOperationally` → `primary_company_type_id`/`primary_concept_id`).
- Gate l.129 (`!modules.services && !modules.events && !modules.calendar`) **forçava** escolher módulo irrelevante (hortifruti travado).
- O frontend já tem `AllowedOperationalConcept.domain` (api/companies). **STOP do envelope (backend consome modules) → NÃO disparado.**

## Implementação (frontend-only)
- **`frontend/src/utils/onboarding-track.ts` (novo):** `deriveOnboardingTrackFromConceptDomain(domain)` → `{ derivable, items[], note, modules }`. Mapa: `produtos-e-comercio` → Produtos/Catálogo/Estoque/Ofertas; `servicos` → Serviços/Agenda (nota: pagamento/booking bloqueados até a cadeia financeira); `cultura-lazer-e-eventos` → reservado; default → `derivable:false` + fallback honesto. `financial` **sempre false** (Bank é infra, não checkbox).
- **`CompanyOnboardingWizard.tsx`:** import do helper; consts derivados (`selectedConcept`/`selectedTypeName`/`onboardingTrack`); `useEffect([selectedConceptId, concepts])` mantém `modules` = trilho derivado (compat); **gate** passou a bloquear só quando `!onboardingTrack.derivable` (volta à Etapa 1) — não exige mais checkbox; **Etapa 2 JSX** = resumo derivado ("Seu {tipo} começará com: …" + nota); **removido** `handleModuleToggle` (e os 4 checkboxes). Submit inalterado (par soberano).
- **`CompanyOnboardingWizard.css`:** estilo de card para `.onboarding-track-summary`.
- **NÃO** toca backend/Bank/payment/booking/serviços runtime/catálogo/migration/DECISION financeira; **não** usa slug como identidade; **não** transforma módulo em SSOT; restaurante adiado.

## Prova
- **Frontend tsc exit 0.**
- Comportamento (por leitura do código): hortifruti (`produtos-e-comercio`) vê **Produtos/Catálogo/Estoque/Ofertas** e **avança sem marcar Serviços/Eventos/Agenda**; **sem Financeiro como checkbox**; salão (`servicos`) deriva **Serviços+Agenda**; domínio desconhecido → fallback honesto + volta à Etapa 1; **submit usa o par soberano** (`activateCompanyOperationally`); `displayName` só apresentação (DECISION-0107); `modules` no payload é compat derivado, não operacional.
- **Zero backend tocado.** 4 gates: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK (365) · arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 365→365.**

## DT
- **`DT-PJ-ONBOARDING-MODULE-FIRST-UX-DRIFT` → criada + CLOSED** (tela agora derivada da classificação). Residual benigno: metadata `modules` (`CompanyModules`) persiste como **compat de UX não-operacional**; retirá-la é cleanup futuro opcional. Restaurante (híbrido) adiado.

## Não-toque confirmado
backend (nenhum arquivo) · Bank/payment/booking/escrow · serviços do salão (runtime) · `canonical_products`/`product_offers`/catálogo · migration/schema (365) · flag `SERVICE_FINANCIAL_RUNTIME_ENABLED` (OFF) · DECISION financeira · restaurante · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Retomar a sequência financeira de serviço (`F-SERVICE-KYB-RELEASE-GATE-METHOD-CODE`) ou outra frente de produto, conforme go do Clayton. Cleanup opcional da metadata `modules` legada quando fizer sentido.
