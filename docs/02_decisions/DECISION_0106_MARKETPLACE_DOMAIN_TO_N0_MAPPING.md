# DECISION-0106 — Mapeamento canônico `MarketplaceDomain → N0` (fecha o fork de vocabulário)

**Data:** 2026-06-05
**Tipo:** Arquitetura / Ontologia / Navegação
**Status:** PROMULGADA POR CLAYTON (docs-only — não autoriza código/schema/migration/frontend/DML)
**Frente:** `F-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK-DECISION` (FRENTE α)
**HEAD de origem:** `44e44f34`
**Decisor:** Clayton (ratificação do menu α; decisão de produto em `vehicles` = opção b)

---

## 1. Contexto

A DECISION-0105 promulgou que `concepts.domain` é **dimensão semântica multi-camada** (N0 de atuação + `financeiro-*` RFC C2 + `item-comercial` SKU), desbloqueando o mapeamento do fork de vocabulário `MarketplaceDomain` (6 valores hardcoded no frontend) ↔ N0 canônico. Esta DECISION promulga o **mapa**, fechando o fork (`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`).

## 2. Princípio aplicado

`MarketplaceDomain` **não é SSOT** — é rótulo de navegação/UX do frontend. Mapear ≠ dar autoridade: o mapa diz **a que N0 de atuação cada rótulo corresponde** (quando corresponde), sem que o frontend passe a decidir identidade. Identidade semântica continua em CONCEPT (Lei 7). Forçar um rótulo num N0 errado seria "semântica errada → arquitetura → destino → prisão" — exatamente o que a 0105 protegeu.

## 3. Evidência material (banco vivo `unificard_dev`, HEAD `44e44f34`)

- `produtos-e-comercio` = 5 concepts (tipos de varejo/negócio); `servicos` = 5; `cultura-lazer-e-eventos` = 11. (3 alvos N0 vivos e inequívocos.)
- **Imóveis: ausente** — zero `domains`/`concepts` com `imov/imobil/real` (grep vazio). Não há N0-alvo para `real_estate`.
- **`mobilidade-e-logistica` é LOAD-BEARING do rides** — seus 12 concepts são tipos de veículo (`carro/moto/van/caminhao/iate/aviao/…`), **consumidos** por `backend/src/modules/rides/drivers/vehicles/vehicles.service.ts:17,89` (coluna `concept_id`, gravada) + script `report-rides-vehicles-concept-mapping.ts`. Mapear `vehicles` ali conflataria *vender veículo* com *operar veículo no rides* num domínio que já tem dono.

## 4. Decisão — o mapa α (D1–D6)

**D1 — `market` → `produtos-e-comercio`.** N0 de atuação/vendedor. `item-comercial` é reconhecido como **catálogo/SKU** (camada de item, 0105), **não** como domínio de atuação — `market` aponta ao N0 do vendedor, com o catálogo de produto vivendo em `item-comercial`.

**D2 — `services` → `servicos`.** N0 de atuação direto.

**D3 — `events` → `cultura-lazer-e-eventos`.** N0 vivo (11 concepts).

**D4 — `jobs` → capability transversal, NÃO domínio.** Contratação/emprego é capacidade que atravessa atores, não área de atuação (ratifica DECISION-0102 D12).

**D5 — `real_estate` → REGULADO, SEM ALVO VIVO.** Não existe N0 de imóveis. Não forçar num N0 existente. Domínio próprio é evolução futura governada (regulado — DECISION-0102 D13).

**D6 — `vehicles` → REGULADO, SEM ALVO VIVO (opção b).** **NÃO mapear para `mobilidade-e-logistica`** — esse domínio é load-bearing do rides (catálogo de tipos de veículo consumido por `concept_id`). Mapear ali conflataria venda/listagem de veículo com a taxonomia operacional do motorista. Venda-de-veículo é N0 futuro próprio (regulado — DECISION-0102 D13). Decisão de produto de Clayton (a/b); **escolhida (b)** com evidência de conflação real.

## 5. Travas herdadas

- **NÃO renomear/remapear `mobilidade-e-logistica`** sem frente própria de rides (viga, igual `financeiro-*`).
- `real_estate`/`vehicles` só ganham alvo quando existir N0/concept próprio (regulado), fora do MVP.
- `MarketplaceDomain` permanece rótulo de UI; discovery de domínio deriva de CONCEPT, não do enum de frontend.

## 6. Impacto em DTs

- **`DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`** → **GOVERNED / DECISIONED** (sai de OPEN — o mapa está promulgado). **Não CLOSED:** resta o consumo downstream (a camada `concept/company_type → allowed domains` de DECISION-0102 D5 e a derivação do `DomainSelector` a partir do N0) e a remoção do `hybrid` atômico — frentes próprias.
- **`DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN`** → permanece OPEN (o "ambos" = dois trilhos via GRAPH, não valor atômico — frente própria).

## 7. O que NÃO está autorizado

Docs-only. Não toca frontend (`DomainSelector`/`MarketplaceDomain`), backend, schema, marketplace, rides, CNAE. A materialização do mapa em código (derivar allowed domains, alimentar discovery por CONCEPT) é frente própria posterior.

## 8. Referências

`DECISION-0105` (semântica multi-camada de `concepts.domain`) · `DECISION-0102` (D11 fork / D12 capability / D13 regulados) · `18_DOMAIN_ONTOLOGY §7/§8` · Lei 7 (CONCEPT = SSOT semântico) · `vehicles.service.ts:17,89` + `report-rides-vehicles-concept-mapping.ts` (evidência load-bearing) · `DT-PJ-MARKETPLACE-DOMAIN-VOCABULARY-FORK`.

## 9. Superada por

(em aberto — decisão vigente)
