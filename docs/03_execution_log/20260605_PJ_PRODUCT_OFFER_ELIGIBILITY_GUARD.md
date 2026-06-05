# Execução — F-PJ-PRODUCT-OFFER-ELIGIBILITY-GUARD (DECISION-0108 na camada de oferta) — code-only

**Data:** 2026-06-05 · **Modo:** EXECUTOR CONTROLADO · **Branch:** `rescue-structural`
**HEAD antes:** `30096156` · **Decisão:** Clayton — aplicar a régua da 0108 na prateleira (sem DECISION nova) · **Esteira:** eu (escritora); par verifica.

## Objetivo
Fechar a fresta achada no Op2: o guard por categoria/ramo (DECISION-0108) protegia só a **materialização** (`canonical→products`, via `createProduct`); a **ativação comercial** (`product_offers`) não era reverificada. Quando o `product` já existe no tenant (reuso), `createProduct` é pulado → o guard de materialização não roda → uma empresa poderia ofertar item fora dos seus ramos. Reaplicar o guard **antes** de `createProductOffer`. Code-only.

## Antecedente (auditoria read-only `F-PJ-PRODUCT-OFFER-ELIGIBILITY-GUARD-READONLY`)
- `store-onboarding.service.createProductOffer` (l.703) é o **ÚNICO writer** de `product_offers` em produção (`offer.service.ts` só lê; `inventory-unit-actor.ts` só EXISTS-read; nenhum `INSERT INTO product_offers` fora dele).
- **Nenhum endpoint HTTP** cria offer direto.
- `merchant_id → actors.id` (page-actor de empresa COM `company_id`, ou user-actor PF SEM company).
- `resolvedInput.companyId` (Op1/Op2) + `canonical.id`/`canonical.categoryId` em escopo no passo da oferta; `products.category_id` populado.
- Política **já decidida na 0108** (elegibilidade por ramo protege a oferta quando há contexto de empresa) → **sem DECISION nova**.

## Implementação (code-only)
- **`store-onboarding.service.ts`:** `import { assertProductCategoryAllowedForCompany } from './product-concept-guard'`; **antes** de `createProductOffer` (dentro de `if (!existingOffer && hasRealPrice)`), `await assertProductCategoryAllowedForCompany(tenantId, canonical.id, resolvedInput.companyId)`. Roda **mesmo quando `createProduct` foi pulado por reuso**.
- `companyId` presente → **fail-closed** por categoria fora do ramo; ausente (PF/legado) → **bypass compat** (mesma régua do product guard). Sem preço real → nem chega ao guard (não há offer).
- **NÃO** cria endpoint/writer novo; **NÃO** reescreve store-onboarding; **NÃO** mexe em preço/estoque além do já aprovado (Op2); **NÃO** deriva policy por tenant; **NÃO** popula `tenants.company_type_id`.

## Prova
- **e2e efêmero `validate-pipeline-e2e-pj-product-offer-eligibility-guard.ts` 14/14 verde — TENANT COMPARTILHADO (o ponto):**
  - **A.** super materializa+oferta banana (hortifruti ∈ ramos), preço real `price_cents=450`.
  - **B (prova-chave).** farmácia (mesmo tenant) REUSA a banana materializada (`getProductByCanonicalId` → `createProduct` pulado) — mas o **guard de OFERTA barra** (`ForbiddenError`); **zero** offer para a farmácia; a banana **segue materializada** (barreira na prateleira, não no depósito).
  - **C.** farmácia oferta item do SEU ramo (medicamentos) → OK.
  - **D.** PF **sem `companyId`** → **bypass compat** (não lança); oferta criada (PF não tem ramo).
  - **E.** sem preço real → products materializados, **ZERO offers** (Op2 preservado).
  - **F.** zero `price_cents=0`; zero canônico novo; `company_type_allowed_concepts` intocado; `tenants.company_type_id` **NULL** (empresa é a única autoridade — prova que o tenant NÃO é fonte); **Bank intocado**.
- Backend tsc só baseline geo. 4 gates: actor-writer/bank-ledger/regression-guards OK; arch `--strict` exit=0 (`critical_new=0`; `warning_new=1`=c3). **Migrations 363→363.**

### Nota do e2e
Ruído `42P01` (`recordBusinessAuditSafely`, tabela de auditoria ausente no FULL efêmero) é **engolido com segurança** — não afeta o resultado (orthogonal). O tenant é **compartilhado de propósito**: é exatamente o cenário que expõe a fresta do reuso (em produção tenant≈empresa, mas a regra de Clayton é que isso **não** pode ser muleta — a autoridade é da empresa/actor).

## DT
- **`DT-PJ-PRODUCT-OFFER-ELIGIBILITY-GUARD-MISSING` → criada + CLOSED** (mesma fatia, provada).
- **Hardening futuro registrado (opcional, NÃO nesta fatia):** derivar a empresa por `merchant_id → actors.company_id` para writers futuros que criem offer **sem** `companyId`. Hoje o único writer já traz `companyId` → fresta demonstrada fechada.

## Não-toque confirmado
endpoint/writer novo · reescrita de store-onboarding · preço/estoque além do Op2 · `tenants.company_type_id` · `company_type_allowed_concepts` · `canonical_products` · migration/schema (363) · Bank · Trilho B · serviços (Op3) · peixaria · `CRIACAO_DE_EMPRESAS.md` · `criacao-de-empresa.png` · `fluxo-empresa.png`.

## Próximo passo
Op3 — Trilho A serviços (`servicos`), análogo. Peixaria FORA (decisão de produto pendente). Espera go do Clayton.
