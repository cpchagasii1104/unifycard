# Execution Log — DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD · Reconciliação A/B/C (docs-only)

**Data:** 2026-06-04
**Modo:** EXECUTOR DOCS-ONLY CONTROLADO
**Branch:** `rescue-structural`
**HEAD origem:** `685ad1b5`
**Frente:** `F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-READONLY` (3 auditorias paralelas) → reconciliação docs-only

---

## Objetivo
Atualizar a `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` com a reconciliação das 3 auditorias paralelas read-only (A/Norma, B/Schema, C/Blast). **NÃO decidir solução. NÃO criar DECISION. Zero schema/runtime/Bank/DML.**

## Correção da premissa (a DT cont.64 tratava as 3 camadas como iguais — não são)

### 1. `financeiro-*` (7) — AUTORIZADO + VIGA (load-bearing), NÃO drift
- Ratificado por **RFC C2**: `docs/02_decisions/RFC_C2_seed_concepts_financeiros.md`, `RFC_C2_rollout.md`, `RFC_C2_bank_transactions_concept_link.md`. Seed `20260530507000_seed_concepts_financeiros.sql` declara "taxonomia aprovada em 3 camadas de auditoria (Opus/Sonnet/ChatGPT)".
- **Load-bearing no Bank** (valores de domain são strings hardcoded):
  - `backend/src/modules/bank/bank-integration.service.ts:635` → `['financeiro-payment','ride-payment']`
  - `backend/src/modules/concept-resolution/concept-financial-resolver.service.ts:17-54` → `FINANCIAL_DOMAINS = ['financeiro-payment','financeiro-escrow','financeiro-payout',…]`, itera sobre os valores.
- **Consequência:** renomear/mover `financeiro-*` tem blast radius no Bank. **Não mexer sem tratar o hardcode.**
- A auditoria A (norma) havia classificado como "drift" por **não ter lido a RFC C2** (leu só ontologia + Lei 7 + DECISIONs PJ). Claim refutada por evidência.

### 2. `item-comercial` — o ponto REALMENTE ambíguo (candidato a drift/legado)
- 35 concepts comerciais; **sem RFC própria** equivalente à C2 (pegada fraca em `DEFINICAO_DE_PRODUTO.MD`).
- Camada comercial **paralela** ao N0 `produtos-e-comercio` (que tem só 5 concepts).
- Tratado como legado em código: `backend/src/modules/concept-resolution/concept-resolution-context.ts:3` — "ambientes legados podem usar `item-comercial` só onde a BD ainda o exige".
- Acoplado a `canonical_products` via `concept_id` (UUID), não via domain → desacoplado de runtime.

### 3. `domain='unificard'` — INERTE
- `marketplace-contextual.service.ts:43` tem `CASE WHEN domain='unificard' THEN 0 …`, mas SELECT live = **0 concepts, 0 domains** → não muda comportamento vivo. Claim C de "muda comportamento" exagerada.

### 4. Desacoplamento confirmado (auditoria C, H1/H3)
- Ativação (`activateCompanyOperationally`), publicação (`company_concept_publications`), `company_type_allowed_concepts`, CNAE e `MarketplaceDomain` decidem por `concept_id` (UUID), **não** por `concepts.domain`.

## Bloqueio refinado
`MarketplaceDomain → N0` continua bloqueado — mas pelo problema **correto**: (a) semântica oficial de `concepts.domain` (multi-camada com `financeiro-*` legítimo/RFC vs `item-comercial` legado); (b) split `item-comercial`(35) vs `produtos-e-comercio`(5). **Não** é mais "3 camadas de drift".

## Ações realizadas (docs-only)
1. `REMEDIATION_DT_LOG.md` — bullet de RECONCILIAÇÃO na `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD`.
2. `STATUS_EXECUCAO_GLOBAL.md` — entrada de status da reconciliação.
3. `opus.md` — memória curta (cont.65).
4. Este execution log.

## Não-toque (confirmado)
- Zero schema/migration/backend/frontend/DML/Bank/marketplace.
- 3 autorais intocados (`CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`, `fluxo-empresa.png`).

## Regra de segurança herdada
**NÃO mexer/renomear `financeiro-*`** — é viga (Bank hardcode). A decisão real recai sobre **`item-comercial`**: legitimar como camada / absorver em `produtos-e-comercio` / separar via `layer`/`n0_domain`.

## Próximo passo recomendado
`F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-DECISION-READONLY` — agora com a premissa correta (financeiro = carga autorizada; item-comercial = drift a decidir).
