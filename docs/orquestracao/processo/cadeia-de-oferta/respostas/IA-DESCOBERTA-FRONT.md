# IA-DESCOBERTA/FRONT — F-OFFER-4 READ-FIRST (1º elo) · síntese da IA-DIRETORA

> Mapeamento READ-ONLY via 4 Explore agents (workflow `f-offer-4-discovery-readfirst`): A discovery backend · B human-mvp-matching · C frontend/UX · D disponibilidade de concept_id. Nada editado.

## 1. HEAD e preflight
- **HEAD:** `f6c07742` (branch `rescue-structural`). **Preflight:** nosso (código/cartório/doc-system) limpo; dirty só memórias/opus/loose de outras frentes (fora do escopo). **READ-ONLY confirmado** (Explore agents; zero edição/migration/commit).

## 2. Mapa de rotas de descoberta (backend) — casa por quê HOJE
| Rota / função | Casa por | Status |
|---|---|---|
| `GET /services/search` → `services-discovery.service.search` → `services.repository.discoverServices` (`WHERE s.category_id=$`) | **category_id** | VIVO 🔴 |
| `POST /services/offers` → `createOffer` → `assertServicosCategory` (`metadata->>'domain'='servicos'`) | **domain + category_id** | VIVO 🔴 |
| `GET /services/discover` (`services.routes.ts`) → discover por category_id+geo | **category_id** | VIVO 🔴 |
| `human-mvp-matching.findMatches` (`WHERE category_id`) | category_id | **GHOST** (schema ausente; rotas 501) |
| `GET /marketplace/search` → `marketplace-search.service` (categoryPath→tree→discoverServices) | **category_id (árvore)** | VIVO 🔴 (pilar marketplace, adjacente) |
| `tenant_concept_offerings.listTenantsOfferingConcept(conceptId)` | **concept_id** ✅ | VIVO (único concept-bound; cross-tenant) |
| `service-offering.service.listActiveByCanonicalService(canonicalId)` | canonical (→concept) | "listar de um canônico já conhecido", não entrypoint de busca |

## 3. Mapa frontend/UX
- Marketplace/discovery envia **categoryPath (slug '/'-delimitado)** + filtros (location/price/capacity/trust/actorType); service-discovery envia **category_id (UUID)** + geo. **Nenhuma tela envia concept_id** (correto — é navegação). `DomainSelector` = 6 domínios hardcoded. `SearchPage` = texto `q` (ainda não integrado).
- **concept_id NÃO é exposto publicamente** no marketplace (correto). `categories.concept_id` existe no core, mas marcado **"proibido como concept_ref transacional (07 §4262/4278)"**; exposto só p/ seleção profissional C1. ⇒ **a UI deve continuar com category/domain/slug (navegação); o re-key é SERVER-SIDE.** Bate com a régua de Clayton.

## 4. Matching material atual (o problema)
- A descoberta **VIVA** casa por **category_id/domain como IDENTIDADE** em 3 superfícies (`discoverServices`, `assertServicosCategory`, `/services/discover`) → **VIOLA DECISION-0142 §B.2/B.3** (domain auxiliar, NÃO filtra matching; casar por concept_id). `services` seleciona `canonical_service_id` (→concept) mas **NÃO o usa no filtro** — concept-id fica inerte na descoberta. human-mvp = mesma violação, mas ghost (não executa).
- ⚠️ **Discrepância de rowcount a reconfirmar:** agent citou "discoverServices retorna ~200 serviços vivos"; IA-BANCO (F-OFFER-3, `4431b8fc`) provou **services=0**. → IA-BANCO reconfirma no 3º elo (afeta o custo do re-key: vazio = grátis).

## 5. Disponibilidade de concept_id (as 3 CAMADAS de Clayton)
**(1) Entrada humana** (UI, mantém): `category_id`/`categoryPath`/`slug`/`domain` · texto `q` (futuro).
**(2) Resolução semântica** (entrada → concept_id) — **EXISTE**: `semantic.adapter.resolveConceptFromCategory(categoryId)` (via `categories.concept_id`) + `resolveConceptFromSlug`; `category-navigation-bridge.requireCategoriesWithConceptForScope` (toda category tem concept_id, validação estrita C1). **Texto→concept = SEM resolver hoje** (futuro).
**(3) Matching material** (por concept_id) — **disponível**: `canonical_services.concept_id` (NOT NULL), `services.canonical_service_id`→concept, `tenant_concept_offerings.concept_id` (já casa por concept, cross-tenant = o padrão correto vivo). Re-key = `discoverServices` passar a casar por `concept_id` (JOIN via `canonical_service_id`), com category_id virando entrada resolvida (não filtro-identidade).

## 6. Riscos de troca
- **Esconder folhas reusadas** (o risco de Clayton invertido): hoje o domain-filter (`domain='servicos'`) ESCONDERIA folhas reusadas que moram em `educacao-e-conhecimento` (fotografia/musica/decoracao) — re-key por concept_id RESOLVE isso (não é o re-key que quebra; é o estado atual que já está errado).
- **Ambiguidade normativa (→ decisão):** `categories.concept_id` é "proibido como concept_ref transacional (07 §4262/4278)". Discovery é transacional? A régua de resolução (category→concept) precisa de IA-SEMANTICA definir SE/COMO usar `categories.concept_id` na descoberta vs resolver via `canonical_services` — sem virar uso proibido.
- **Texto livre→concept** sem resolver (SearchPage `q`): fora do V1.
- **Marketplace (stores por category)** = pilar adjacente; decidir se entra no escopo de F-OFFER-4 ou é frente própria.
- **UX:** baixo se a UI mantém category/domain (navegação) e o re-key é server-side (entrada resolvida). Não apagar category/domain da tela.

## 7. Recomendação para F-OFFER-4
**PASS_PARA_IA_SEMANTICA** — a discovery viva casa por category/domain como identidade (confirmado, 3 superfícies); o resolver `category→concept` EXISTE; concept_id está disponível (`canonical_services.concept_id`). Falta a **régua de resolução** (camada 2): como entrada humana (category/slug/texto) vira `concept_id` material sem violar 07 §4262/4278 — é o trabalho da IA-SEMANTICA. Pode escalar a **FALTA_DECISAO** se a restrição "concept_id não-transacional" exigir DECISION nova.

## 8. Próximo elo sugerido
**IA-SEMANTICA** (régua de resolução `category/slug/texto → conceito canônico → concept_id → discovery`, respeitando 07 §4262/4278) → depois **IA-BANCO** (reconfirmar rowcount services/offerings; viabilidade do JOIN concept_id; índices). FRONT complementar só se a régua exigir mudar o contrato da rota.

## VEREDITO FINAL: **PASS_PARA_IA_SEMANTICA**
Achado: **a discovery VIVA usa category/domain como IDENTIDADE material (viola DECISION-0142) em 3 superfícies; o re-key para concept_id é viável (resolver + concept_id existem), mas a RÉGUA de resolução (entrada humana→concept_id sem uso transacional proibido de categories.concept_id) é decisão da IA-SEMANTICA.** UI mantém category/domain (navegação); re-key é server-side. human-mvp permanece ghost (não re-keyar código morto). marketplace = adjacente a decidir.

## Carimbo
- **HEAD:** `f6c07742` · **Revalidou código vivo:** sim (4 Explore READ-ONLY, 1ª mão, file:line) · parcial no rowcount (→IA-BANCO).
- **Arquivos/rotas lidos:** services-discovery.{routes,service}.ts · services.repository.ts (discoverServices) · services.service.ts · service-category-guard.ts · canonical-service.service.ts · semantic.adapter.ts · category-navigation-bridge.ts · tenant-concept-offerings.repository.ts · marketplace-{search,discovery,categories}.* · human-mvp-matching.service.ts · human-mvp.routes.ts.
- **Frontend lido:** marketplace-search.ts · service-discovery.ts · ServiceDiscoveryPage/MarketplaceHomePage/CategoryNavigationPage/SearchPage.tsx · SearchFiltersPanel/DomainSelector.tsx.
- **Status:** RESPONDIDO (READ-ONLY, insumo; F-OFFER-4 HOLD para execução).
