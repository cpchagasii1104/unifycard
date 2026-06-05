# DECISION-0105 — Semântica de `concepts.domain`: dimensão multi-camada legítima (N0 de atuação + financeiro RFC C2 + item/SKU comercial)

**Data:** 2026-06-04
**Tipo:** Arquitetura / Ontologia / Semântica
**Status:** PROMULGADA POR CLAYTON (docs-only — não autoriza código/schema/migration/rename/DML/runtime)
**Frente:** `F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-DECISION`
**HEAD de origem:** `970a208d`
**Decisor:** Clayton (Opção 1 + Opção 2, sem rename e sem schema)

---

## 1. Contexto

A frente `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK` (guardião read-only) tentou mapear `MarketplaceDomain → N0` e bateu numa divergência **12 N0 normativos vs 21 `domains` vivos**. A reconciliação live (`F-CONCEPTS-DOMAIN-LAYER-SEMANTICS-READONLY`, 3 auditorias paralelas A/Norma + B/Schema + C/Blast) provou que `concepts.domain` **carrega materialmente três naturezas distintas** numa única coluna, e que essas naturezas **não têm o mesmo status** (`DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD` + sua reconciliação).

## 2. Problema

Antes desta DECISION, `concepts.domain` era ambíguo: tratado informalmente ora como "N0 puro" (norma), ora como "qualquer domínio semântico" (banco). Sem promulgar o que a coluna **é**, qualquer mapeamento `MarketplaceDomain → N0` ou derivação de domínios elegíveis miraria um catálogo cuja semântica não estava decidida ("endereçar a rua que mudou de nome").

## 3. Evidência material (reconciliada, banco vivo `unificard_dev`)

- `domains` = 21 vivos = 12 N0 (`18_DOMAIN_ONTOLOGY §7`) + 1 condicional (`construcao-e-infraestrutura`, §8.1) + 7 `financeiro-*` + 1 `item-comercial`. `concepts.domain ⊆ domains.domain_key` (zero órfãos — problema é semântico, não FK).
- **`financeiro-*` (7):** AUTORIZADO pela **RFC C2** (`docs/02_decisions/RFC_C2_seed_concepts_financeiros.md` + rollout + bank-link; seed `20260530507000`). **Load-bearing no Bank:** strings hardcoded em `bank-integration.service.ts:635` e `concept-financial-resolver.service.ts:17-54` (`FINANCIAL_DOMAINS`). Renomear/mover = blast radius no Bank.
- **`item-comercial` (35):** camada de **item/SKU** — concepts como `arroz-branco-tipo-1`, `banana-prata`, `agua-mineral-500ml`, `analgesico-comum`; **35 `canonical_products`** dependem dela via `concept_id` (UUID; sem string-coupling). Sem RFC própria até esta DECISION.
- **`produtos-e-comercio` (5):** N0 de **atuação/vendedor** — concepts como `varejo-alimentar-especializado-carnes/hortifruti/padaria`, `saude-varejo-farmaceutico`; é o que os **7 company_types** usam na ativação.
- **`domain='unificard'`:** INERTE (0 concepts / 0 domains; branch em `marketplace-contextual:43` não casa nenhuma linha).
- Consumidores (ativação, publicação, `company_type_allowed_concepts`, CNAE, MarketplaceDomain) decidem por `concept_id`, **não** por `concepts.domain`.

## 4. Decisão (D1–D10)

**D1 — `concepts.domain` é oficialmente uma dimensão semântica MULTI-CAMADA.** Não é, e nunca foi obrigada a ser, exclusivamente "N0 de atuação". A coluna comporta legitimamente naturezas distintas.

**D2 — Camadas legítimas reconhecidas:**
  1. **N0 de atuação** (tipo de negócio/vendedor; os 12 N0 da ontologia + condicional);
  2. **domínios financeiros** autorizados pela **RFC C2** (`financeiro-*`);
  3. **camada de item/SKU comercial** (`item-comercial`).

**D3 — `financeiro-*` permanece INTOCADO.** Autorizado pela RFC C2 e **load-bearing no Bank**. **NÃO é drift.** Qualquer mudança em `financeiro-*` exige frente financeira própria — fora do escopo desta e de qualquer frente de ontologia/marketplace.

**D4 — `item-comercial` fica LEGITIMADO como camada de item/SKU comercial.** Deixa de ser tratado como "drift bruto". É a dimensão canônica de **mercadoria/produto/SKU**.

**D5 — `item-comercial` NÃO será absorvido em `produtos-e-comercio`.** Absorver conflataria dois níveis distintos (mercadoria × tipo de negócio) — `banana-prata` não é "tipo de empresa".

**D6 — `produtos-e-comercio` representa tipo de comércio/vendedor** (atuação/N0). É o eixo que os company_types usam.

**D7 — `item-comercial` representa mercadoria/produto/SKU.** É o catálogo de itens (lastro de `canonical_products`).

**D8 — NÃO criar `layer`, `n0_domain` ou qualquer schema agora.** A distinção entre camadas é, nesta fase, **documental/contratual**, não estrutural. (Enforcement estrutural via coluna `layer` fica como evolução futura possível, não autorizada aqui.)

**D9 — NÃO renomear `item-comercial` agora.** O nome permanece; o significado fica promulgado.

**D10 — NÃO tocar runtime, migrations, Bank, marketplace, CNAE, publication ou frontend.** Esta DECISION é puramente semântica/documental.

## 5. O que esta DECISION resolve

- Promulga a **identidade oficial** de `concepts.domain` (multi-camada com 3 naturezas nomeadas).
- Remove a falsa premissa de que `financeiro-*`/`item-comercial` são drift indistinto.
- **Desbloqueia** a próxima decisão de mapeamento de marketplace, agora sobre catálogo correto: `market` poderá mapear para a camada de comércio/vendedor (`produtos-e-comercio`) **com `item-comercial` reconhecido como catálogo de produto**, sem conflação.

## 6. O que esta DECISION NÃO faz / NÃO autoriza

- Não cria schema (`layer`/`n0_domain`), não renomeia, não move dado (DML).
- Não toca `financeiro-*`, Bank, marketplace, CNAE, publication, frontend.
- Não mapeia `MarketplaceDomain` (frente própria seguinte).
- Não reescreve a ontologia `18_DOMAIN_ONTOLOGY` — a reflexão normativa formal (emenda/RFC reconhecendo as camadas) fica como **resíduo** (ver §7), por isso a DT não fecha integralmente.

## 7. Impacto em DTs

- **`DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD`** → **PARTIALLY MITIGATED / GOVERNED** (sai de OPEN). A semântica está promulgada; **não CLOSED** porque ainda falta refletir formalmente as 3 camadas em `18_DOMAIN_ONTOLOGY`/RFC (resíduo normativo). `financeiro-*` deixa de ser tratado como drift; `item-comercial` deixa de ser "drift bruto" e vira camada legitimada.
- **`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`** → permanece **OPEN**, agora **DESBLOQUEADA** para a próxima decisão de mapeamento (premissa de catálogo corrigida).
- **`DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN`** → inalterada (OPEN).

## 8. Travas (vinculantes)

```text
NÃO tocar/renomear financeiro-* (viga do Bank — frente financeira própria).
NÃO renomear domínio usado por string no Bank.
NÃO mapear MarketplaceDomain ainda.
NÃO derivar allowed domains ainda.
NÃO mexer em CNAE seed.
NÃO criar layer/n0_domain/schema. NÃO renomear item-comercial. NÃO DML.
```

## 9. Próximas frentes autorizáveis (sem execução aqui)

1. **`F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-DECISION`** — mapear `MarketplaceDomain` com a semântica promulgada: `market → comércio/vendedor (produtos-e-comercio)` com `item-comercial` como catálogo de produto; `services → servicos`; `events → cultura-lazer-e-eventos`; `jobs → capability, não domínio`; `real_estate`/`vehicles → regulados`.
2. **Reflexo normativo** (resíduo da DT): emenda/RFC reconhecendo as 3 camadas em `18_DOMAIN_ONTOLOGY` — fecha a DT.
3. (Futuro/opcional) enforcement estrutural via `layer` — só se Clayton quiser.

## 10. Referências normativas

`18_DOMAIN_ONTOLOGY_UNIFICARD.md §7/§8` · `LEIS_OPERACIONAIS` (Lei 7 — CONCEPT = SSOT semântico) · `SSOT_REGISTRY` · `07_NOMENCLATURA` · `DECISION-0098` (par = SSOT ativação) · `DECISION-0102` (D5/D11 domínios elegíveis/fork) · `DECISION-0104` (CNAE→concept) · **RFC C2** (`RFC_C2_seed_concepts_financeiros.md`) · `DT-CONCEPTS-DOMAIN-LAYER-OVERLOAD`.

## 11. Superada por

(em aberto — decisão vigente)
