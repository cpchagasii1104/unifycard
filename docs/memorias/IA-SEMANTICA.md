# IA-06 — Semântica

## 1. Carimbo

- **HEAD:** `aaeb50b5` (branch `rescue-structural`)
- **Data/hora:** 2026-06-21
- **Git status:** limpo no que toca código/cartório/doc-system; dirty só em memórias (`MINHA_MEMORIA_*`), `opus.md` e loose-files de outras frentes (fora do escopo deste raio-X). Nenhuma alteração de produção pendente minha.
- **READ-ONLY confirmado:** SIM — só leitura (psql SELECT/catálogo com colunas explícitas, rg/grep, Read), 0 INSERT/UPDATE/DELETE/migration/commit. Workflow de 14 subagents READ-ONLY.
- **Arquivo criado/atualizado:** `docs/memorias/IA-06-SEMANTICA.md` (este).
- **Memórias/docs lidos:** `docs/memorias/MINHA_MEMORIA_SEMANTICA.md` (própria), `MINHA_MEMORIA_DOCUMENTOS.md`, `MINHA_MEMORIA_DECISOES.md`, `MINHA_MEMORIA_DT.md`, `docs/orquestracao/processo/cadeia-de-oferta/respostas/IA-SEMANTICA.md` e `IA-DESCOBERTA-FRONT.md`, `SSOT_FULL.txt`, `01_NORMATIVE_FULL.txt`, `docs/01_normative/07_NOMENCLATURA_CANONICA.md §18.14/§4254-4286`, `docs/01_normative/18_DOMAIN_ONTOLOGY`, `docs/02_decisions/DECISION_0142..0146`. **Memória não encontrada:** `docs/memorias/IA-SEMANTICA.md` (o conteúdo equivalente vive em `MINHA_MEMORIA_SEMANTICA.md` + a resposta da cadeia-de-oferta).
- **Banco/schema consultado:** `unificard_dev` (live). 400 migrations no disco. Probes: rowcounts, `pg_constraint`, `pg_trigger`, `information_schema.columns`, `to_regclass`.
- **Comandos/probes usados:** `git rev-parse/status`; `psql` (concepts/relations/categories/canonical_services/services/service_offerings/products/canonical_products/declarações — counts, constraints, CHECK, triggers); `rg`/Grep em `services.repository.ts`, `services-discovery.service.ts`, `services.service.ts`, `marketplace-*`, `semantic.adapter.ts`, `graph.adapter.ts`, `concept-offer-refs.adapter.ts`, `category-navigation-bridge.ts`, frontend C1/onboarding; Read das migrations 0069/0073/0074/0075/0076/0077/20260620130000/140000/150000 e DECISIONs 0142-0146.

## 2. Escopo

**Auditado (eixo Semântica):** `concepts`, `concept_relations`/grafo, `categories` (navegação + concept_id), `canonical_services`, `services`/`service_offerings` (vínculo semântico + discovery), `actor_professional_concepts`/`company_concept_publications` (declaração/capability — sem aprofundar autoridade), marketplace search (semântica), vínculo semântico de produto/locação/assinatura, contrato frontend category↔concept, nomenclatura/normas (07 §18.14, 18_DOMAIN_ONTOLOGY, DECISIONs 0142-0146).

**Fora (handoff):** autoridade/representação (`canRepresentActor`/RBAC), dinheiro/ledger/split/payout, tempo/booking detalhado, produto/estoque/locação/assinatura em profundidade, frontend UX completo, cadastro/onboarding/actor model.

## 3. Memória/documento histórico vs estado vivo

| Fonte | Afirmava | Estado vivo | Classificação |
|---|---|---|---|
| `IA-DESCOBERTA-FRONT.md` (HEAD f6c07742) | "discovery casa por category/domain como IDENTIDADE em 3 superfícies; viola 0142" | **REMEDIADO**: `discoverServices` casa por `cs.concept_id` (JOIN canonical_services); superfícies resolvem category→concept (hop de leitura) e passam só `conceptId`; fail-closed `CATEGORY_REQUIRES_LEAF_CONCEPT` | **STALE / CONTRADITA** (a régua F-OFFER-4 que eu mesma propus foi executada) |
| `MINHA_MEMORIA_SEMANTICA.md` (F-OFFER-4) | "PRONTO_PARA_GO; falta executar re-key" | Re-key **executado** em `services-discovery.service.ts:376-388` + `services.repository.ts:213-220` | **CONFIRMADA + avançada** |
| DECISION-0142 | "PROMULGADA/MATERIALIZADA (U1b)" | Banco: root `festa-de-casamento` + 9 arestas (5 requires/4 related_to/0 suggests); CHECK 6 tipos | **CONFIRMADA** (prova-viva bate texto) |
| DECISION-0143/0144/0145 "DOCS-ONLY" | "não toca runtime" | 0144/0145 **já materializadas** (services.canonical_service_id NOT NULL; service_offerings.service_id NOT NULL+FK; runtime popula) | **PARCIAL** (header docs-only subestima estado real — materialização posterior F-OFFER-2A/3A ocorreu) |
| DECISION-0146 | "promulgação condicional NÃO autorizada (MODO C)" | `service_offerings=0`/`services=0`; overlap-guard fantasma; `detect_availability_conflicts` STUB | **CONFIRMADA** (substrato virgem; gap conhecido) |
| `canonical_services.category_id` (citado p/ produtos) | (readiness predicate de produtos) | `canonical_services` **não tem** category_id; é de `canonical_products` | **CORRIGIDA** |

## 4. Mapa macro semântico

```
CONCEPT (concepts.concept_id, 150 rows, global, PK+17 FKs entrantes)         → FECHA
  └ name/label fora de concepts (concept_labels, D1/0107)                    → FECHA
CATEGORY como navegação (categories.concept_id nullable; non-leaf/root=0)    → FECHA_COM_RISCO (45 leaf s/ concept; enforce por level=2 não topológica)
CANONICAL_SERVICE (canonical_services.concept_id NOT NULL + FK RESTRICT)     → FECHA
SERVICE (services.canonical_service_id NOT NULL + FK RESTRICT; sem concept_id direto) → FECHA
SERVICE_OFFERING (service_id NOT NULL + canonical_service_id NOT NULL)       → FECHA
DISCOVERY de serviço (casa por cs.concept_id; fail-closed sem concept)       → FECHA (gap de DADOS: services=0)
MARKETPLACE  /contextual = concept-first                                     → FECHA
             /search     = category-tree (stale)                            → FECHA_COM_RISCO
PRODUTO (via canonical_products.concept_id 35/35; products só category_id)   → FECHA_COM_RISCO (assimetria de obrigatoriedade)
LOCAÇÃO (tabela inexistente; bookings sem concept)                          → NÃO_FECHA (greenfield, handoff)
ASSINATURA (organizer_subscriptions sem concept; plan_id dangling)          → NÃO_FECHA (órfão, handoff)
```

## 5. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| concepts | FECHA_COM_RISCO | `concepts`=150; PK+17 FKs; UNIQUE(domain,slug); kebab-case 0 violações | não | domains 21>13 N0; 6 concepts vertical/root; dup semântica refrigerante | IA-SEMANTICA/IA-DINHEIRO | DECISION |
| concept_relations | FECHA | 9 arestas piloto; sem tenant_id (0092); `concept_relations_edge_uq` | não | — | — | FAST-PATH |
| relation_type | FECHA | CHECK 6 tipos exatos, sem `suggests`; code espelha (graph.adapter:9-15) | não | — | — | FAST-PATH |
| leaf concepts | FECHA | wedding pilot reusa fotografia/musica/decoracao cross-domain; metadata vazio 9/9 | não | — | — | FAST-PATH |
| categories | FECHA_COM_RISCO | 147 rows; non-leaf-com-filhos com concept=0; root com concept=0 | não | enforce concept por level=2, não topológica | IA-SEMANTICA/IA-BANCO | DECISION |
| category.concept_id | FECHA_COM_RISCO | 77/147 com concept; 45 leaf (level1 global/prof) sem concept | não | invariante "todo leaf tem concept" FALHA (45) | IA-SEMANTICA | DECISION |
| category.metadata | FECHA_COM_RISCO | `service-category-guard` lê `metadata->>'domain'='servicos'` na CRIAÇÃO | parcial | domain-as-authority na criação de service (0109) | IA-DINHEIRO/Clayton | DECISION |
| canonical_services | FECHA | concept_id NOT NULL + FK RESTRICT; scope CHECK; 1 row/0 null | não | — | — | FAST-PATH |
| services.canonical_service_id | FECHA | NOT NULL + FK RESTRICT (20260621100000:45) | não | — | — | FAST-PATH |
| service_offerings.service_id | FECHA | NOT NULL + FK RESTRICT + canonical_service_id NOT NULL (0145) | não | — | — | FAST-PATH |
| actor_professional_concepts | FECHA | concept_id NOT NULL + FK RESTRICT; createService exige ACTIVE mesmo concept | não | PF por actor_type='user' literal (cobertura) | IA-ACTOR | MODO B |
| company_concept_publications | FECHA | concept_id FK RESTRICT; unique ativa company×concept; KYB-gated | não | — | IA-AUTORIDADE (enforcement) | FAST-PATH |
| discovery service | FECHA | `services.repository.ts:216-220` cs.concept_id; fail-closed | não | gap de DADOS (services=0) | IA-BANCO/IA-OFERTA (backfill) | DECISION |
| marketplace search | FECHA_COM_RISCO | `/search` 100% category-tree (marketplace-search.service.ts:23-49); `/contextual` concept-first | não | `/search` casaria por category quando houver services | IA-SEMANTICA (re-key) | MODO B |
| product semantic field | FECHA_COM_RISCO | `canonical_products.concept_id` 35/35 (nullable+CHECK); `products` só category_id | não | assimetria vs canonical_services NOT NULL | IA-PRODUTOS | MODO B |
| rental semantic field | NÃO_FECHA | tabela rental/locacao inexistente; bookings sem concept | não (greenfield) | nasce órfão se materializar sem ponte | IA-LOCACOES | DECISION |
| subscription semantic field | NÃO_FECHA | organizer_subscriptions sem concept; plan_id dangling (sem FK, sem tabela plans) | não | identidade do "plano" inexistente | IA-ASSINATURAS | DECISION |
| frontend category/concept contract | FECHA_COM_RISCO | C1 escreve por concept_id; trava non-leaf; sem mapa category→concept | não | onboarding PJ deriva trilho por concept.domain (apresentacional) | IA-FRONTEND-UX-CONTRATOS | DECISION |
| tests/guards semânticos | FECHA | trigger 0075 (concept) + 0077 (graph) fail-closed ativos; bridge test; guard ghost-containment | não | — | — | FAST-PATH |
| docs normativos/DECISIONs | FECHA_COM_RISCO | 0142-0146 em disco; 07 §4262/4278 honrado | não | colisão numérica 0142-0146 em migrations_archive (pix) cosmética | IA-DOCUMENTOS | INCONCLUSIVE |

## 6. Achados críticos

**SEM-01 / DISC-ID-1 — Discovery de serviço casa por concept_id (alegação prévia REFUTADA).** `services.repository.ts:213-220` filtra por `cs.concept_id` via `INNER JOIN canonical_services`; `services-discovery.service.ts:376-388` e `services.service.ts:312-335` resolvem category→concept (hop de leitura) e passam só `conceptId`, com `CATEGORY_REQUIRES_LEAF_CONCEPT` fail-closed. concept_id **não** fica inerte: é o único predicado de matching. Impacto: positivo (invariante respeitado). Bloqueia MTP? NÃO. Bloqueia dinheiro? NÃO. DECISION? NÃO. YALA? não. Modo: FAST-PATH. *Minha régua F-OFFER-4 foi executada.*

**CONCEPT-01 / CII-1 — concept_id É a identidade semântica material.** PK + 17 FKs entrantes (inclui `bank_transactions.concept_id` NOT NULL). slug/domain/label/name só como navegação/breadcrumb resolvidos na borda (resolver canônico fail-closed `concept-slug-resolve.service.ts:55-86`), nunca persistidos como chave de casamento. Bloqueia? NÃO. Modo: FAST-PATH.

**CATEGORY-01 / CAT-4 — Uso material de category_id/slug/domain como AUTORIDADE de elegibilidade vendor (governado, conflita com invariante).** `product-concept-guard.ts:70,112` (DECISION-0108, match por slug de ramo) e `service-category-guard.ts:36,45,77` (DECISION-0109, `metadata->>'domain'='servicos'`) gateiam *quem pode ofertar* por category_id/slug/domain, não por concept. `economic_policies` casa por category_id. **Não é drift acidental** — é desenho soberano (0105/0108/0109) coexistindo com o invariante concept. Conflito real a reconciliar. Bloqueia MTP? PARCIAL. Bloqueia dinheiro? PARCIAL (economic_policies=0 rows hoje → HOLD). DECISION? SIM. YALA? sim (quando executar). Modo: DECISION. Handoff: IA-DINHEIRO/Clayton.

**CATEGORY-02 / CAT-1+LBN-3 — 45 categorias leaf ativas sem concept_id; enforcement por level=2, não topológica.** `chk_n2_requires_concept` exige concept só em level=2; `concept_id` nullable. Banco vivo: non-leaf-com-filhos com concept=0 e root com concept=0 (limpo, **emergente**), mas 45 leaf (24 global + 21 professional, level 1, active) sem concept — barradas pelo bridge no attach (`category-navigation-bridge.ts:103-108`), não pelo DB. Invariante "todo leaf tem concept" FALHA. Bloqueia? NÃO (fail-closed na ponta). DECISION? SIM (enforce topológica vs backfill vs marcar navegação-pura). Modo: DECISION. Handoff: IA-SEMANTICA/IA-BANCO.

**CANONICAL-01 / CS-1..CS-4 — Cadeia CONCEPT→CANONICAL_SERVICE→SERVICE→SERVICE_OFFERING selada no schema.** `canonical_services.concept_id` NOT NULL+FK RESTRICT; `services.canonical_service_id` NOT NULL+FK RESTRICT; `service_offerings` exige AMBOS `service_id` E `canonical_service_id` NOT NULL (não bypassa o service — DECISION-0145). canonical é PONTE, não identidade. Bloqueia? NÃO. Modo: FAST-PATH.

**MARKETPLACE-01 / MKT-1+MKT-3 — `/marketplace/search` 100% category-tree (stale); dois tracks de discovery coexistem.** `/marketplace/search` resolve por categoryPath→categoryId→`discoverServices({categoryId})` (category como identidade de busca); `/marketplace/contextual` é concept-first canônico. Fragmentação de superfície (mesma pergunta material, chaves diferentes). Bloqueia? NÃO (services=0 → não vaza dado hoje). DECISION? SIM (unificar vs deprecar /search). Modo: MODO B (re-key) + DECISION (unificação). Handoff: IA-SEMANTICA (re-key) / IA-DINHEIRO+Clayton (arquitetura).

**CONC-01 — `domains` extrapolou a lista N0 fechada (21 vivos vs 13 normados).** 7 `financeiro-*` + `item-comercial` semeados depois; `financas-e-economia` (N0 canônico) tem 0 concepts. domain virou sub-vertical operacional. Não quebra runtime (matching por concept_id), mas corrói a invariante domain=breadcrumb-N0 e o 18_DOMAIN_ONTOLOGY (lista fechada). Bloqueia? NÃO. DECISION? SIM (revisar ontologia OU colapsar). Handoff: IA-SEMANTICA/IA-DINHEIRO.

**PRODUCT-SEM-01 / PRS-1 — Assimetria de obrigatoriedade concept entre os dois canônicos.** `canonical_products.concept_id` nullable (NOT NULL só condicionado a `status='confirmed'` via CHECK; 35/35 OK) vs `canonical_services.concept_id` NOT NULL incondicional. `products` operacional não tem concept_id (só transitivo via canonical_product_id). Bloqueia? NÃO. Modo: MODO B. Handoff: IA-PRODUTOS.

**RENTAL-SEM-01 / PRS-2 — Locação sem domínio e sem ponte semântica.** Nenhuma tabela rental/locacao; `bookings` é operacional puro (availability_id/requester_actor_id/status), sem concept. Se materializar, nasce órfão. Bloqueia? NÃO (greenfield). DECISION? SIM (definir ponte antes de materializar). Handoff: IA-LOCACOES.

**SUBSCRIPTION-SEM-01 / PRS-3 — Assinatura órfã + plan_id dangling.** `organizer_subscriptions` sem concept_id/canonical_id; `plan_id` uuid sem FK e **sem tabela `plans`/`subscription_plans`** (referência fantasma). O "o que se assina" não tem identidade material nem semântica. Bloqueia? NÃO. Bloqueia dinheiro? PARCIAL (antes de cobrança recorrente). DECISION? SIM. Handoff: IA-ASSINATURAS.

**DOC-SEM-01 / VF (07 §4262/4278) — Proibição concept_ref transacional honrada.** `concept-offer-refs.adapter.ts` resolve concept_ref só de `canonical_products.concept_id`; `categories.concept_id` lido só em resolução read-only de discovery (filtro efêmero, nunca persistido); write path resolve de canonical/declarações; intents/orders/offers sem coluna concept; NULL é fail-closed. **NAO_VIOLA.** Modo: FAST-PATH. (Resíduo cosmético: colisão de numeração 0142-0146 com série pix em `migrations_archive`.)

## 7. Gaps de conexão

1. **Discovery por concept funcional-vazia (dados):** `services` com `canonical_service_id`=0; `canonical_services`=1; 70/147 categorias sem concept_id. Código correto, sem dados → backfill (IA-BANCO/IA-OFERTA).
2. **Superfícies de busca fragmentadas:** services (category-tree em `/search` vs concept em `/contextual`), products (adapter `canonical_products.concept_id`), stores (templateId/category_id) — sem pipeline de discovery concept-keyed unificado.
3. **Produto↔serviço convergem em concept (assimétrico); locação e assinatura ficam FORA do grafo concept** — sem primitiva única "item comercial → concept" atravessando os 4 domínios.
4. **`category_id` ainda é chave material em gates de elegibilidade vendor e economic_policies** (governado por 0105/0108/0109) — coexistência com o invariante concept a reconciliar.
5. **45 categorias leaf sem concept_id** — visíveis na navegação, não ancoram significado; enforcement só no bridge (runtime), não no DB.
6. **availability legada:** 24/48 `purpose_concept_id` NULL (bookável legado) — higiene, sem identidade-por-slug.
7. **Resíduo `s.category_id` no repo de discovery** (`services.repository.ts:224-227`) — branch de navegação por árvore, não acionado pelas rotas de discovery; DT-candidato de convergência.

## 8. Handoffs para outras IAs

- **IA-AUTORIDADE:** enforcement de representação (declaração/publicação é INSUMO somado a `canRepresentActor`, `services.service.ts:110`); KYB do publish PJ.
- **IA-DINHEIRO:** CAT-4/CAT-6 (gates de elegibilidade e economic_policies por category_id) + CONC-01 (status dos `financeiro-*` domains); `bank_transactions.concept_id` casa por concept (não domain).
- **IA-BANCO:** backfill `services.canonical_service_id` + `categories.concept_id` (discovery vazia hoje); viabilidade de constraint topológica leaf→concept; colisão numérica migrations_archive.
- **IA-OFERTA:** confirmar fatias pós-0145 (draft→active, ativação pública 0145 §B12); F-OFFER-4 discovery/activation.
- **IA-TEMPO:** DECISION-0146 não materializada (overlap-guard fantasma, `detect_availability_conflicts` STUB); backfill `purpose_concept_id`.
- **IA-PRODUTOS:** PRS-1/PRS-4 (assimetria concept; products sem concept local).
- **IA-LOCACOES:** PRS-2 (locação greenfield — definir ponte concept antes de materializar).
- **IA-ASSINATURAS:** PRS-3 (organizer_subscriptions sem concept; plan_id dangling).
- **IA-FRONTEND-UX-CONTRATOS:** FE-5 (trilho onboarding PJ por concept.domain — manter apresentacional); FE-6 (busca global `q` futura = resolução server-side).
- **IA-ACTOR:** ramo PF por `actor_type='user'` literal (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION).
- **IA-DOCUMENTOS / IA-DECISOES-DT:** registrar DT-candidatos (resíduo `s.category_id`; legado `user_skills_categories` ghost contido); colisão numérica.
- **IA-MARKETPLACE-JORNADA:** convergente — IA-10 reportou backend da jornada FECHADO, único blocker MTP = B2 frontend wiring (fora do eixo semântica).

## 9. Riscos para MTP

- **Bloqueia MTP:** NADA pelo eixo semântica. O núcleo concept-keyed está selado (schema+norma+discovery); IA-10 confirma o blocker MTP é B2 frontend wiring (eixo marketplace/jornada).
- **Não bloqueia mas corrigir:** re-key `/marketplace/search` ANTES de semear services (MKT-1, senão cristaliza busca por category-tree); backfill `categories.concept_id` (45 leaves) e `services.canonical_service_id`.
- **V2:** unificar superfícies de discovery (search+contextual+stores) num pipeline concept-keyed; ponte semântica de locação/assinatura.
- **Cleanup:** resíduo `s.category_id` no repo; `purpose_concept_id` NULL legado; legado `user_skills_categories` (ghost contido).
- **Exige decisão de produto/arquitetura:** CAT-4 (category-as-authority vs concept), CONC-01 (`financeiro-*` domains), MKT-3 (unificação de discovery), CONC-02 (concepts vertical/root).

## 10. Riscos para público e dinheiro

- **Antes de público:** re-key `/marketplace/search` (MKT-1) + backfill concept (categorias/services), senão a busca pública casa por category-tree stale.
- **Antes de dinheiro:** `bank_transactions.concept_id` já NOT NULL+FK (casa por concept — OK). PARCIAIS: economic_policies por category_id (CAT-6, HOLD, 0 rows hoje); assinatura sem identidade material (PRS-3, antes de cobrança recorrente); DECISION-0146 temporal não materializada (overlap/conflito de booking — HOLD, offerings=0).
- **Blockers de marketplace:** MKT-1 (search re-key) + MKT-3 (fragmentação).
- **Exige DECISION:** CAT-4, CONC-01, MKT-3, PRS-2/PRS-3, CATEGORY-02.
- **Permanecer HOLD:** DECISION-0146 (tempo/booking, MODO C não autorizado); economic_policies anchoring; fiação financeira (fora do eixo).

## 11. Veredito final

**FECHA_COM_RISCO.**

O eixo semântico está **materialmente ancorado em CONCEPT/concept_id** — é a identidade soberana (PK + 17 FKs, money incluso), global, governada (triggers 0075/0077 fail-closed), com a cadeia `CONCEPT→CANONICAL_SERVICE→SERVICE→SERVICE_OFFERING` selada por NOT NULL+FK RESTRICT, discovery de serviço re-keyada por concept_id (a violação prévia foi remediada), e a proibição 07 §4262/4278 honrada (concept_ref só de canonical, nunca de categories.concept_id). DECISION-0142 promulgada/materializada com prova-viva exata (9 arestas, reuso cross-domain, contexto na aresta).

**Os RISCOS não bloqueiam MTP nem dinheiro pela identidade**, mas são reais: (a) **category/slug/domain ainda é autoridade material** em gates de elegibilidade vendor e economic_policies — coexistência governada (0105/0108/0109) que conflita com o invariante e exige decisão de convergência; (b) **`/marketplace/search` ainda é category-tree stale**; (c) **45 categorias leaf sem concept** + enforcement por level=2 não topológica; (d) **locação e assinatura fora do grafo concept** (greenfield/órfão); (e) **gap de dados** (services=0) torna a discovery por concept vazia hoje. Nenhum é drift acidental crítico; são convergência assintótica + cleanup + decisões de produto.

## 12. Próxima frente recomendada

**MODO_B_MARKETPLACE_REKEY** — re-key do `GET /marketplace/search` para concept_id (resolver `categoryPath→concept_id` na borda e passar `filters.conceptId`; o JOIN `canonical_services.concept_id` já existe em `services.repository.ts:216-220`), generalizando o padrão concept-first de `/marketplace/contextual`. É a execução de maior alavancagem no eixo (fecha a última superfície de discovery que usa category como identidade), **decisão-independente**, MODO B, e deve ocorrer **antes** de semear services para não cristalizar busca por category-tree.

**Em paralelo, escalar como DECISION (Clayton/IA-DINHEIRO, não executora-autônoma):** CAT-4 (category-as-authority vs concept em elegibilidade vendor) e CONC-01 (status dos `financeiro-*` domains) — são as duas tensões soberanas que o eixo não resolve sozinho.

> **Justificativa do modo:** o núcleo é FAST-PATH (já selado); o único re-key concept-keyed que sobra é decisão-independente (MODO B); as reconciliações de autoridade-por-categoria e de ontologia de domínios são DECISION (vácuo de Clayton, não débito técnico).

## 13. Resumo executivo

- **concept_id é a identidade semântica material e soberana** do sistema (PK + 17 FKs, money incluso); slug/domain/label/name são navegação resolvida na borda, nunca identidade persistida. **SIM**, verificado adversarialmente.
- **A violação "discovery casa por category/domain" foi REMEDIADA** no HEAD vivo: discovery de serviço casa por `cs.concept_id` e fail-closa sem concept — a régua F-OFFER-4 que propus foi executada.
- **Cadeia CONCEPT→CANONICAL_SERVICE→SERVICE→SERVICE_OFFERING selada** no schema (NOT NULL+FK RESTRICT); canonical é ponte, não identidade.
- **DECISION-0142 promulgada/materializada** — 9 arestas do piloto festa, CHECK 6 tipos sem `suggests`, reuso cross-domain, contexto na aresta; triggers 0075/0077 fail-closed ativos.
- **07 §4262/4278 honrado:** concept_ref só de `canonical_products.concept_id`; `categories.concept_id` é hop read-only de discovery, nunca persistido.
- **Risco governado nº1 (CAT-4):** elegibilidade vendor e economic_policies ainda casam por category/slug/domain (0105/0108/0109) — conflita com o invariante; exige DECISION.
- **Risco nº2 (MKT-1):** `/marketplace/search` ainda é category-tree stale; re-key MODO B antes de semear services.
- **Risco nº3 (categorias):** 45 leaf sem concept_id; enforcement por level=2 não topológica.
- **Greenfield/órfão:** locação (sem tabela) e assinatura (`organizer_subscriptions` sem concept, `plan_id` dangling) fora do grafo concept; produto ligado assimetricamente via `canonical_products.concept_id`.
- **Gap de dados:** services=0 → discovery por concept correta porém vazia hoje (backfill IA-BANCO/IA-OFERTA).
- **Veredito: FECHA_COM_RISCO. Não bloqueia MTP nem dinheiro pela identidade.** Próxima frente: **MODO_B_MARKETPLACE_REKEY** + escalar CAT-4/CONC-01 como DECISION.

---
*Raio-X READ-ONLY do eixo 06 (Semântica). Insumo para a IA-DIRETORA/Clayton — não é GO, não promulga, não executa. HEAD `aaeb50b5`. Nenhum código/runtime/migration/cartório alterado; nenhum commit. Prova-viva de banco via SELECT/catálogo read-only.*
