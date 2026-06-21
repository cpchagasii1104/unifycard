# sistema/semantica — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa SEMÂNTICA (grafo/concepts). Fonte: IA-SEMANTICA/IA-COMERCIO/IA-BANCO · DECISION-0142/0092 · Lei 7 · 18_DOMAIN_ONTOLOGY §6.2.

## Invariante soberano (DECISION-0142)
- **folha = concept SSOT GLOBAL context-neutral.** `concept_id` = identidade; `concept.domain` = auxiliar/breadcrumb e **NÃO filtra matching**. Discovery/oferta casa por `concept_id`, **NUNCA por `domain`**. Uma folha por serviço (proibido duplicar / embutir vertical no slug; só o intent-root é vertical-específico). **Contexto/role mora na ARESTA**, nunca na folha.

## Estado vivo
- `concept_relations` = GLOBAL, sem `tenant_id` (0092 dropou; 0076 superado). `relation_type` = **6 tipos** (U1 `2a0d3c21`): enables/requires/evolves_to/related_to/part_of/substitutes (sem `suggests`).
- Governança: triggers **0075** (concepts, `app.concept_governance`) + **0077** (relations, `app.graph_governance`) ATIVOS, fail-closed. Seed só via porta governada.
- Árvore-piloto `festa-de-casamento` viva (U1b `9f5e9c5e`): 9 arestas (5 requires + 4 related_to); reuso de fotografia/musica/decoracao (cross-domain, referenciados não recriados).

## Verdade paralela semântica do MATERIAL (reconciliar em F-MATERIAL)
- **`product_concepts`** = árvore de concept SEPARADA do domain `concepts` ("distinct from domain table"). 2ª árvore de identidade para produto. Serviço unificou em `concepts`; produto NÃO. Cruzar serviço×material por concept exige convergir isto primeiro.
