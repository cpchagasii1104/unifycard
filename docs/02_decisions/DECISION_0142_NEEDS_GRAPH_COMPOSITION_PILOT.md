# DECISION-0142 — Needs-graph: composição-piloto (festa de casamento) + invariante folha-SSOT-global

**Status:** **PROMULGADA / MATERIALIZADA (Slice U1b).** Materializa a cabeça da orquestração (MACRO 1):
a árvore-piloto de composição de necessidades + o invariante que rege o catálogo de folhas como SSOT global.

**Data:** 2026-06-20 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `6c93c648` · **dev:** 398/398
· **Tipo:** arquitetural / ontologia (CONCEPT graph) · **Frente:** F-ONTOLOGY-COMPOSITION-NEEDS-GRAPH (U1b)
· **Responsável:** Clayton / IA-DIRETORA (executor: Claude Opus 4.8) · **Ratificação:** Clayton + ChatGPT
(APPROVED_WITH_SMALL_ADJUSTMENTS) + IA-SEMANTICA (proposta/lente de reuso) + IA-YALA (reseal PASS) + IA-BANCO (prova-viva).

**Deriva de / subordinada a:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md` (§6.2 tipos de relação) ·
`SSOT_REGISTRY_UNIFICARD.md` (Lei 7 — concept = identidade semântica SSOT) · DECISION-0070 (taxonomia
governada; sem runtime/IA/frontend criando) · DECISION-0092 (grafo semântico GLOBAL, sem `tenant_id`) ·
DECISION-0105 (`concepts.domain` multi-camada; domínio não limita matching — ADENDO 2026-06-16) ·
DECISION-0107 (labels em `concept_labels`, D12 = sem seed) · U1 (widening `concept_relations.relation_type` 3→6).

---

## §0 — Natureza

A 0142 promulga a **primeira composição-piloto** do needs-graph (vertical "festa de casamento") **e** o
**invariante folha-SSOT-global** que faz "um substrato, N verticais" funcionar. É a primeira materialização
da MACRO 1; **não** toca oferta, fornecedor, RFQ, presença, dinheiro, worker ou payout.

## §A — Árvore-piloto ratificada (versão-REUSO)

Raiz/intent-root `festa-de-casamento` (`cultura-lazer-e-eventos`, NOVO) + 9 arestas governadas:
- **requires:** `local-de-evento`(servicos) · `buffet`(servicos) · `fotografia`(educacao-e-conhecimento) ·
  `musica`(educacao-e-conhecimento) · `decoracao`(educacao-e-conhecimento)
- **related_to:** `servicos-pessoais-beleza`(servicos) · `locacao-de-traje`(servicos) ·
  `transporte`(mobilidade-e-logistica) · `cerimonial`(servicos)

**4 folhas REUSADAS** (subjects neutros já vivos — `fotografia`/`musica`/`decoracao` + `servicos-pessoais-beleza`):
referenciadas, **não recriadas nem movidas**. **6 NOVAS** (incl. a raiz). **SEM `suggests`.** Arestas
**cross-domain** são legítimas (grafo global pós-0092). **Contexto-festa mora na ARESTA, nunca na folha.**

**Materialização:** migrations `20260620140000_seed_concepts_wedding_pilot.sql` (6 concepts NOVOS, governado
`app.concept_governance`/trigger 0075, guard-pré dos 4 reusados + guard-pós) e
`20260620150000_seed_concept_relations_wedding_pilot.sql` (9 arestas, governado `app.graph_governance`/
trigger 0077, JOIN por `(slug,domain)` explícito, guard de ÁRVORE EXATA). Idempotentes (ON CONFLICT).
**IA-YALA PASS** (árvore exata; reuso preservado; 0075/0077 mordem; idempotência INSERT 0 0; drift=0; ZERO código).

## §B — INVARIANTE FOLHA-SSOT-GLOBAL (vinculante para MACRO 2+)

1. **`concept_id` é a identidade soberana.** A folha é **SSOT GLOBAL context-neutral** — uma `seguranca`, um
   `fotografia` — e serve **N verticais** (casa-noturna/show/festa/obra; casamento/infantil/show). O provider
   vincula-se à **folha 1×** e fica descobrível em **todas** as verticais que tenham aresta até ela.
2. **`concept.domain` é auxiliar/breadcrumb e NÃO limita matching.**
3. **Descoberta/oferta/matching casa por `concept_id`. É PROIBIDO filtrar provider discovery por
   `concept.domain`** (folhas reusadas moram em `educacao-e-conhecimento`; filtrar por domain as esconderia).
4. **role/contexto mora na RELAÇÃO** (interest/need/offer) **e na ARESTA**, nunca na folha.
5. **Uma folha por serviço** — proibido duplicar folha ou embutir vertical no slug da folha. **Só o
   intent-root** é específico da vertical. Profundidade (galhos intermediários via `part_of`) = frente futura.

## §C — Fora de escopo (não promulgado aqui)

Fornecedor · `services` · `service_offerings` · `company_concept_publications` · `tenant_concept_offerings` ·
ranking · RFQ · presença · dinheiro · worker · payout · labels (0107 D12) · profundidade de grafo · outras
verticais. **Próximo passo obrigatório (antes de F-OFFER):** auditoria READ-ONLY
`F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS` — onde PF/PJ/prestador declara "eu faço isso" sem criar verdade
paralela à cadeia `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY`.

**Supera:** — · **Superada por:** — · **Referências:** migrations `20260620140000`/`20260620150000` ·
`graph-governance.service.ts` · triggers `0075`/`0077` · DECISION-0070/0092/0105/0107 · U1.
