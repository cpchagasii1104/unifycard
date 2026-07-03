# DECISION-0155 — Produto PJ-only no MVP inicial (Opção PJ-only)

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0155). Criado em 2026-07-03 para fechar a lacuna de rastreabilidade apontada no `auditoria.md`.

- **Data:** 2026-06-28
- **Frente:** F-PRODUCT-PUBLISH-W2-PJ-ONLY-DECISION (W2 do arco F-PRODUCT-PUBLISH-COMPANY-BIND) · **HEAD (pré-commit):** `f3c9d01e`
- **Tipo:** Arquitetural / produto-autoritativo (DOCS-ONLY) — **NÃO MATERIAL** (não toca runtime/migration/backend/frontend/schema/`docs/01_normative`). Promulga política; bloqueio em código é fatia material futura.
- **Status:** **PROMULGADA / DOCS-ONLY / DECISION_PROMULGATED.** Resolve a paridade W2 deixada aberta nas DECISION-0143/0144/0145 e no fechamento de W1.

## Contexto
W1 (DT-PRODUCT-PUBLISH-COMPANYID-NOT-BOUND-TO-ACTOR) fechou o crachá-de-empresa: `companyId` que governa o guard de ramo é DERIVADO server-side do actor representado. Restava W2: produto entra no modelo **actor-first/concept** (paridade com serviço) ou fica governado por **ramo/categoria** (taxonômico)? Coexistir os dois = dois modelos de autoridade respondendo à MESMA pergunta material (anti-padrão "frontend nunca cria verdade" / tensão com actor-unidade-soberana).

## Decisão soberana (Clayton · Opção PJ-only)
1. **Regra principal:** no MVP inicial, **publicação/oferta de PRODUTO é PJ/CNPJ-only**. Actor **PF/user NÃO publica/oferta produto**. Actor **PJ/page-company publica/oferta produto**. PF/user **continua prestando SERVIÇO** conforme os gates de serviço (DECISION-0147 etc.) — serviço NÃO é afetado.
2. **Elegibilidade PJ:** PJ segue governada por **ramo/CNAE/company_type/categorias pré-moldadas** conforme **DECISION-0108** (mantida). Produto **NÃO exige**, neste MVP, gate por concept-publication igual ao serviço. **Categoria/ramo = recorte de ELEGIBILIDADE de produto, NÃO SSOT semântico.** Identidade do produto permanece canônica: **CONCEPT → canonical_product → product/product_variant → product_offer**.
3. **NÃO criar agora:** **não** criar `actor_product_concepts`; **não** criar `company_product_concepts`; **não** estender `company_concept_publications` para produto; **não** aplicar paridade total serviço→produto neste MVP.
4. **Separação serviço vs produto:** serviço pode ser PF/autônomo OU PJ (cumpridos os gates de serviço); produto é **PJ-only** no MVP inicial. Uma mesma pessoa pode operar como **PF para serviço** e como **PJ para produto**, mas a **publicação de produto exige actor PJ/company** (server-side, cf. W1).

## Efeito sobre a DT
`DT-PRODUCT-PUBLISH-NO-PF-PJ-ELIGIBILITY-GATE` passa de **DECISION_REQUIRED / CLAYTON** para **DECISION_PROMULGATED / MATERIAL_REQUIRED**. **NÃO fecha como CLOSED** — falta a microfatia material que bloqueia PF no caminho de publicação/oferta de produto (`F-PRODUCT-PUBLISH-PF-BLOCK-SLICE-A`, HOLD até GO).

## Materialização / Prova
**NENHUMA** (docs-only). **ZERO** dinheiro/checkout/order/payment-plan/pagamento-PDV/payout/PORTA-1/bucket D/migration/runtime.

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8).
- **Deriva de / mantém:** DECISION-0108 · DECISION-0143 · DECISION-0113 · DECISION-0144/0145.
