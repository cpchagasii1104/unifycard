# MINHA_MEMORIA_SEMANTICA — IA-SEMANTICA (append-only)

> Memória soberana da instância **IA-SEMANTICA** (semântica, ontologia, grafo de concepts),
> sob coordenação da IA-DIRETORA. READ-ONLY estrito; análise = INSUMO, nunca GO.
> Disco vence narrativa: revalidar HEAD vivo de 1ª mão antes de qualquer veredito.

## Eixo (do que isto se compõe? qual a identidade semântica?)
- `concepts` = identidade semântica, SSOT (Lei 7). Identidade vem de CONCEPT, **nunca** de `categories.concept_id`.
- `concept_relations` = o GRAFO (concept→concept). **GLOBAL** por DECISION-0092 (dropou `tenant_id`).
- `categories` = navegação/breadcrumb, NÃO identidade. `concept_labels` = apresentação.
- needs-graph = projeção read-only intent-concept → need-concepts (servível só com concepts+relations+labels, sem tabela nova).
- Governança do writer: trigger `0077` exige `app.graph_governance='true'` na mesma tx; caminho único = `graph-governance.service.ts`.
- DECISIONs sob meu olhar: 0070 (taxonomia governada, sem runtime/IA/frontend) · 0077 (trigger) · 0092 (grafo global) · 0104 (CNAE→concept) · 0105 (concepts.domain multi-camada) · 0107 (labels) · 0117 (catálogo canônico — fronteira IA-OFERTA) · 0132 (finalidade temporal como concept).

## Fronteiras
- IA-OFERTA = "quem faz / qual pacote" (services/service_offerings; CONSOME `concept_id`). EU = o grafo que a demanda decompõe.
- IA-BANCO = CHECK aplicado no banco vivo + trigger 0077 ativo + contagem de rows (prova-viva que não alcanço read-only).

## STOPs invioláveis
- Taxonomia NÃO nasce de runtime/IA/frontend (0070); writer só pelo caminho governado.
- Identidade vem de CONCEPT, nunca de `categories.concept_id`.
- Grafo é GLOBAL (0092) — não reintroduzir `tenant_id`/override por tenant sem DECISION.
- U1 só é conformidade norma→código se mexer nos 3 pontos JUNTOS + negative-proof que MORDE. Forward-only (0 rows).
- 6 tipos normados = `enables/requires/evolves_to/related_to/part_of/substitutes` — SEM `suggests`.

---

## Baseline 2026-06-20 — HEAD vivo `dd270f41` (branch `rescue-structural`) — RODADA 1 / U1

**Revalidação de 1ª mão (disco):**
- **Os 3 pontos confirmam HOJE exatamente 3 tipos** (`enables`, `evolves_to`, `related_to`):
  1. `backend/migrations/0076_concept_relations.sql:18-24` — CHECK `relation_type IN (enables, evolves_to, related_to)`. ⚠️ Este `.sql` ainda tem `tenant_id` + `UNIQUE(tenant_id,…)` = estado **pré-0092**; CHECK aplicado no banco vivo pode divergir → INCONCLUSIVO (IA-BANCO).
  2. `backend/src/core/semantic/graph.adapter.ts:9` — `type GraphRelationType = 'enables' | 'evolves_to' | 'related_to'`.
  3. `backend/src/core/semantic/graph-governance.service.ts:9-13` — `RELATION_TYPES = new Set([3 tipos])`. *(Drift de citação: plano §5 L109 / §14.9 dizem `:9-17`; real é L9-13.)*
- **Norma soberana dos 6 tipos:** `docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md:510-517` (§6.2) — exatamente 6: `enables, requires, evolves_to, related_to, part_of, substitutes`. **Sem `suggests`.**
- **DECISION governando os 6 tipos?** NÃO há DECISION standalone do widening 3→6. A autoridade é a NORMA `18_DOMAIN_ONTOLOGY §6.2` (precede DECISIONs). Corrobora `SELO_DECISION_0097_ONTOLOGY_FULL_READ.md:31` (full-read selado da LAYER 6 GRAPH). Logo **U1 = conformidade NORMA→código, decisão-independente, NÃO precisa de DECISION nova.**

**Conclusões para U1:**
- Delta = adicionar `requires`, `part_of`, `substitutes` aos 3 pontos juntos. **Nada a remover.**
- "Remoção de `suggests`" é **não-issue** — `suggests` não existe em nenhum dos 3 pontos nem na norma; é guard contra reintrodução.
- U1 (vocabulário) ≠ U1b (seed de árvore curada, depende de Clayton, writer governado). Não misturar.
- Migration do widening deve mirar forma **pós-0092** (sem tenant_id); `0076.sql` é pré-0092, não usar como molde.
- Negative-proof obrigatória: seed sem `set_config('app.graph_governance','true')` → trigger 0077 bloqueia. Prova-viva = IA-BANCO.

**Resposta registrada em:** PLANO_ORQUESTRACAO_SISTEMICA_UNIFICARD.md §14.x (IA-SEMANTICA), carimbada HEAD `dd270f41`.

---

## RODADA 5 (U1b PRÉ-SEED) — 2026-06-20 — HEAD `6c93c648` — PROPOSTA canônica festa-de-casamento

Barramento migrou para `docs/orquestracao/` (METODO.md). Resposta em `docs/orquestracao/respostas/IA-SEMANTICA.md`.

**Substrato:** `concepts(concept_id, slug NOT NULL, domain NOT NULL FK→domains, UNIQUE(domain,slug))` (0069+0074). Convenção = **kebab-case**. Governança concepts = trigger `0075` / `app.concept_governance='true'`. Governança arestas = trigger `0077` / `app.graph_governance='true'` (provado U1). Grafo GLOBAL sem tenant_id (0092). Labels = `concept_labels` (0107) **D12 sem seed** → projeção retorna slug. Domain = N0 multi-camada (0105 §9: services→servicos, events→cultura-lazer-e-eventos).

**Proposta: 10 concepts NOVOS (0 reuso):** `festa-de-casamento`→cultura-lazer-e-eventos · `local-de-evento`/`buffet-alimentacao`/`fotografia-video`/`musica-som`/`decoracao-festa`/`beleza-cabelo-maquiagem`/`locacao-de-traje`/`cerimonial`→servicos · `transporte`→mobilidade-e-logistica.

**Colisões:** `fotografia`/`musica`/`video`/`decoracao` existem em `educacao-e-conhecimento` (LEARNING, `20260601120000`) — NÃO reutilizar (ponto1/0070); evitados por domain+slug distintos. Adjacências em servicos: `servicos-pessoais-beleza`/`alimentacao-servico-preparado` (establishment company_type) — papel distinto, nascer novo. Slugs festa: 0 colisão (grep limpo).

**Juízo de domain (Clayton):** resolvi os "|" para `servicos` (local-de-evento, locacao-de-traje); alternativas cultura-lazer / produtos-e-comercio explícitas.

**Seed (2 migrations governadas, idempotentes, fail-closed):** A=concepts (set_config concept_governance + INSERT VALUES + ON CONFLICT(domain,slug) + guard 10); B=9 arestas (set_config graph_governance + JOIN por (slug,domain) + ON CONFLICT + guard 9). 9 arestas = `requires`×5 + `related_to`×4, SEM suggests. Negative-proofs mordem (0075/0077). Só toca concepts+concept_relations; NÃO toca categories/services/offerings/RFQ/dinheiro. DECISION-0142 HELD até Clayton ratificar.

**INCONCLUSIVO→IA-BANCO:** rowcount vivo dos slugs + nome exato da UNIQUE de concept_relations pós-0092.

---

## RODADA 5b — LENTE DE REUSO (folha = SSOT context-neutral) — 2026-06-20 — HEAD `6c93c648` — SET FINAL

**REVERTE a RODADA 5.** Lente nova: folha = subject context-neutral; provider serve N verticais; **contexto mora na ARESTA, nunca na folha**. Precedente DECISIVO no disco: o seed de interesse (`20260601130000:10,13,170`) **já reutiliza 27 concepts de educacao** (MESMO concept_id, categoria distinta) → `fotografia`/`musica`/`decoracao` NÃO são identidade "curso", são subject neutro. Domain é auxiliar e NÃO limita matching (ADENDO 2026-06-16). Clayton já nomeou as arestas com slugs neutros (`fotografia`, não `fotografia-video`).

**SET FINAL:** raiz `festa-de-casamento`(cultura-lazer-e-eventos, NOVO) + 9 folhas:
- **REUSAR (4):** `fotografia`/`musica`/`decoracao` (educacao-e-conhecimento, já vivos) + `servicos-pessoais-beleza` (servicos, já vivo) para a aresta `beleza`.
- **NOVO (6):** `local-de-evento`, `buffet`, `locacao-de-traje`, `cerimonial` (servicos) + `transporte` (mobilidade) + a raiz.
- Caem `-video`/`-som` (arestas ratificadas = fotografia/musica singular). NÃO mover os reusados (domain auxiliar; mover=DML fora de escopo). Aresta cruza domínio = legítimo.

**Equivalências a Clayton:** `beleza`→reusar `servicos-pessoais-beleza` (recomendo) vs novo `beleza`; `buffet`→novo (recomendo) vs reusar `alimentacao-servico-preparado`. Ambos establishment/company_type — reportados.

**Seed ajustado:** Migration A seedа só os **6 novos** + GUARD fail-closed que os 4 reusados EXISTEM. Migration B = 9 arestas com JOIN por **(slug,domain) explícito** (domínios MISTOS: educacao+servicos+mobilidade) — resolver por slug só erraria. Governança 0075/0077 idêntica.

**Alerta p/ IA-OFERTA/MACRO 2:** descoberta need-concept→provider deve casar por **concept_id**, nunca filtrar por concept.domain (folhas reusadas moram em educacao). DECISION-0142 segue HELD.

> **UPDATE:** DECISION-0142 **PROMULGADA/MATERIALIZADA** (migrations `20260620140000`/`20260620150000`; IA-YALA PASS). Versão-REUSO ratificada (4 reusadas + 6 novas). §B invariante folha-SSOT-global vinculante: casa por concept_id, PROIBIDO filtrar por concept.domain, contexto na aresta.

---

## F-OFFER-4 (2º elo) — RÉGUA DE RESOLUÇÃO SEMÂNTICA — 2026-06-21 — HEAD `f6c07742`

Resposta em `docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-SEMANTICA.md` (seção F-OFFER-4). Estrutura do barramento migrou para `docs/orquestracao/processo/cadeia-de-oferta/`.

**Problema (IA-DESCOBERTA 1º elo):** discovery viva casa por category_id/domain como IDENTIDADE (3 superfícies: `discoverServices`/`assertServicosCategory`/`/services/discover`) → viola 0142 §B. concept_id disponível: `canonical_services.concept_id` (NOT NULL) ← `services.canonical_service_id`; `tenant_concept_offerings` já casa por concept.

**CHAVE da régua:** separar **resolução-de-leitura** (filtro de query efêmero) de **concept_ref-persistido** (linha intent/pedido/oferta). 07 §18.14 `:4262-4286` proíbe derivar o concept_ref PERSISTIDO de `categories.concept_id` (manda `canonical_*.concept_id`) — é sobre IDENTIDADE GRAVADA, não sobre hop de leitura.

**Régua canônica (1 linha):** navegação resolve concept_id para FILTRAR (read, via `semantic.adapter.resolveConceptFromCategory/Slug` = `categories.concept_id` — permitido, efêmero); só `canonical_services.concept_id` carimba concept_ref para GRAVAR (write). `categories.concept_id` nunca gravado nem fallback.

**Matching:** `services JOIN canonical_services ON canonical_service_id WHERE canonical_services.concept_id=:resolved`. PROIBIDO WHERE category_id/domain (0142 §B.3). Reuso cross-domain APARECE (concept_id é domain-agnóstico); é o filtro-por-domain atual que esconde. V1 = single-concept; expansão needs-graph (festa→9 folhas) = motor de composição, elo posterior.

**07 §4262/4278:** NÃO impede discovery-read; REFORÇA (oferta deve bind por canonical_service, não domain — `assertServicosCategory` é a violação a remover). Texto livre `q`→concept = FUTURO, fora do V1.

**VEREDITO: PRONTO_PARA_GO** (régua determinável de 0142 §B + 07 §18.14; sem DECISION nova; só registrar a clarificação read-filter×concept_ref + IA-BANCO 3º elo confirma rowcount/JOIN — discrepância "~200 vs services=0").

---

## RAIO-X EIXO 06 (IA-06-SEMANTICA) — 2026-06-21 — HEAD `aaeb50b5` (branch rescue-structural) — PROVA-VIVA

Relatório completo (em produção via workflow READ-ONLY): `docs/memorias/IA-06-SEMANTICA.md`. Aqui = prova-viva de 1ª mão (DB `unificard_dev` + código vivo). 400 migrations.

**🔑 A RÉGUA F-OFFER-4 FOI EXECUTADA (disco vence memória):** a discovery NÃO viola mais 0142. `services-discovery.service.ts:376-384` resolve `category→concept` via `resolveConceptFromCategory` (hop de LEITURA efêmero, não concept_ref persistido) e casa por `conceptId`; `services.repository.ts:213-220` faz `JOIN canonical_services cs ON cs.id=s.canonical_service_id WHERE cs.concept_id=$` (cita DECISION-0142+0145). Não-leaf/sem-concept → `CATEGORY_REQUIRES_LEAF_CONCEPT` (400). `category_id` no repo só p/ callers de navegação por árvore (marketplace-search), FORA de F-OFFER-4 V1. → IA-DESCOBERTA-FRONT.md (HEAD f6c07742, "viola em 3 superfícies") está **STALE**.

**concept_id = identidade soberana (PROVA-VIVA):**
- `concepts`=150 em 14 domínios (educacao=37, item-comercial=36, cultura-lazer/mobilidade=13, servicos=11, financeiro-*=33, produtos-e-comercio=6, saude=1). UNIQUE(domain,slug); domain FK→domains.
- `concept_relations`=9 = piloto festa-de-casamento (5 requires + 4 related_to); CHECK vivo = 6 tipos exatos (enables/requires/evolves_to/related_to/part_of/substitutes), SEM suggests. Reuso cross-domain VIVO (fotografia/musica/decoracao em educacao; servicos-pessoais-beleza, buffet, local-de-evento, locacao-de-traje, cerimonial em servicos; transporte em mobilidade). 0142 PROMULGADA/MATERIALIZADA.
- `canonical_services`=1, concept_id NOT NULL (0 nulos). `services`=0, `service_offerings`=0 (vazios → re-key sem custo de dados; confirma IA-BANCO F-OFFER-3, refuta "~200"). `services.canonical_service_id` NOT NULL.
- `canonical_products`=35, concept_id 35/35. `products` liga via `canonical_product_id` (+ category_id navegação); SEM concept_id direto. rentals/locacoes/subscriptions/plans = ABSENT (greenfield).
- categories=147: level0=24 (0 concept, correto=raízes), level1=120 (74 com concept, 46 sem), level2=3 (3 com). **non-leaf-com-filhos COM concept_id = 0** (correto). GAP: 46 categorias level-1 sem concept_id (folhas não-associadas / scopes não mapeados).

**Contratos da cadeia (todos PROMULGADOS docs-only):** 0143 (vocabulário CONCEPT→SERVICE→SERVICE_OFFERING→AVAILABILITY) · 0144 (elegibilidade declaração→service: createService concept-keyed, exige actor_professional_concepts/company_concept_publications ACTIVE mesmo concept_id; V1=match EXATO de concept_id, proibido inferir por domain/category/slug/grafo) · 0145 (service→offering binding: service_offerings.service_id OBRIGATÓRIO, concept via canonical, gap "createOffering nunca popula service_id") · 0146 (offer temporal/booking — vínculo com availability).

**Resíduo a vigiar:** `assertServicosCategory` (services-discovery.service.ts:305) ainda valida category por domain='servicos' na CRIAÇÃO — checagem de navegação, não identidade (identidade segue canonical_service_id), mas vigiar p/ não virar domain-as-identity. 46 categorias sem concept_id. createOffering/service_id binding = F-OFFER-3 (a materializar).

**Veredito preliminar do eixo:** semântica NÃO bloqueia MTP nem dinheiro pela identidade (cadeia concept-keyed no schema+norma+discovery). Gaps restantes = execução F-OFFER-2B/3B (declaração→service→offering wiring) + cleanup (46 cats, marketplace tree por category). Handoffs: IA-OFERTA (services/offerings vazios + service_id binding), IA-BANCO (prova-viva), IA-MARKETPLACE (tree por category = navegação a re-key V2), IA-PRODUTOS/IA-LOCACOES/IA-ASSINATURAS (rentals/subs greenfield; produto via canonical_product.concept_id).
