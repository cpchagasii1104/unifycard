# Plano Completo — Feed com Raio Geográfico

**Data:** 2026-05-19
**Operador:** Claude Code (Opus 4.7) em piloto automático autorizado por Clayton
**Estado:** **RELATÓRIO DE PLANO — NENHUMA AÇÃO EXECUTADA.** Aguarda autorização explícita por fase.
**Branch:** `rescue-structural` · **HEAD:** `31cca643`

---

## 0. Sumário executivo

Adicionar capacidade de filtrar feed por proximidade geográfica usando um payload polimórfico (`{scope, value}`) que cobre raio em km, cidade, estado, ou ilimitado. Frente cross-layer (DDL → service → endpoint → UX) materializando o pilar Localização institucionalizado em 2026-05-19 (memória `project_localizacao_pilar_soberano.md`) e formalizado em DECISION-0020 (2026-05-08).

**Aderência institucional:**
- Frontend NÃO calcula raio (princípio "Frontend nunca cria verdade")
- Hierarquia administrativa é SSOT (countries→states→cities→neighborhoods)
- Localização contextual ≠ residência fiscal (camadas distintas)
- Isolamento por tenant_id em qualquer query geo
- LGPD: localização ativa user-only, queries server-side

---

## 1. Contexto institucional

### 1.1 Origem da frente

Pergunta Clayton 2026-05-19: "tem como ter alguma coisa do usuário conseguir visualizar postagens através de um raio de distância, e aí ele pode calibrar esse raio... ele pode colocar ilimitado, daí conecta tudo?"

Reconhecimento Clayton mesma data: "Isso aqui já saiu da fase 'ideia legal' e entrou na fase 'arquitetura coerente emergindo naturalmente'. Vocês resolveram actor, depois authority, depois temporalidade, depois causalidade financeira; agora localização começou a se encaixar sozinha."

### 1.2 Pilares já estabelecidos (memórias institucionais)

| Pilar | Memória âncora | Status |
|---|---|---|
| Identidade | `project_actor_unidade_operacional_soberana.md` | ✅ ativo |
| Autoridade | `project_coordenacao_claude_codex.md` (permissions + delegations) | ✅ ativo |
| Tempo | `feedback_runtime_soberano.md` (unified-availability) | ✅ ativo |
| Dinheiro/Ledger | LEI §4.6 | ✅ ativo |
| Capability | `project_actor_unidade_operacional_soberana.md` (capability-additive) | ✅ ativo |
| **Localização** | **`project_localizacao_pilar_soberano.md`** → DECISION-0020 | ✅ **institucionalizado 2026-05-19** |

### 1.3 Princípios vinculantes para esta frente

1. **"Frontend nunca cria verdade"** (memória 2026-05-19) — backend resolve raio; frontend envia payload e renderiza
2. **Localização contextual ≠ residência fiscal** (refinamento Clayton 2026-05-19) — tabela própria para localização ativa, não polui `address_assignments`
3. **DECISION-0020 §1** — `addresses.lat/lng` OPCIONAL + `is_geocoded`; geocoding não é pré-requisito
4. **DECISION-0020 §3** — hierarquia administrativa fixa `country→state→city→neighborhood`
5. **§6 fronteira de parada** — migration DDL exige autorização explícita
6. **§4 padrão cognitivo** — cruzar com material antes de afirmar; NÃO criar verdade paralela

---

## 2. Audit material consolidado (READ-ONLY executado 2026-05-19)

### 2.1 Estado das tabelas relevantes

| Tabela | Status | Geo? |
|---|---|---|
| `countries` (1 row) | ✅ existe | n/a |
| `states` (27 rows) | ✅ existe | — |
| `cities` (27 rows) | ✅ existe | tem `lat`, `lng` |
| `neighborhoods` (0 rows) | ✅ existe | — |
| `addresses` (4 rows) | ✅ existe | tem `lat`, `lng`, `is_geocoded` (DECISION-0020 §1) |
| `address_assignments` | ✅ existe | modelo temporal-contextual ATIVO |
| `tenants.headquarters_address_id` | ✅ coluna existe | — |
| **`posts`** | ✅ existe | ❌ **SEM coluna geo** (gap material) |
| `events` | ✅ existe | ❌ sem geo direto |
| `services` | ✅ existe | ✅ tem `city_id`, `state_id`, `country_id` |
| `economic_regions` | ❌ AUSENTE | (DT registrada: DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING) |
| PostGIS extension | ❌ **NÃO instalado** | — |

### 2.2 Helpers geo existentes

| Local | Tipo | Status |
|---|---|---|
| `social-2.0.service.ts:302` | `calculateHaversineDistance` (JS puro, reusável) | ✅ funcional |
| `worker-status.service.ts:241` | Haversine JS | ✅ funcional |
| `rides/location.service.ts:92`, `rides/demand:83`, `rides/pricing:183,207,253`, `work/worker:446`, `work/job:246` | `ST_DWithin`/`ST_Distance` PostGIS | ❌ **QUEBRADO em runtime** (PostGIS ausente) |

**Achado paradoxal:** 5+ callers de PostGIS em código que QUEBRA quando rodado. Verdade paralela pré-existente em rides/work (aspiracionais). **NÃO bloqueia esta frente** mas é DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS candidata (não registrada nesta sessão — fora do escopo).

### 2.3 `address_assignments.role` é CHECK constraint

```sql
CHECK (role = ANY (ARRAY['BILLING','DELIVERY','RESIDENCE','HQ','OPERATIONAL','PICKUP','DROPOFF']))
```

Adicionar `'USER_CURRENT_LOCATION'` exigiria DROP+ADD constraint. Mas refinamento Clayton 2026-05-19 já vetou — tabela própria é correto (role é estável fiscal/logístico).

### 2.4 Endpoint principal candidato

`social-2.0.routes.ts:80` — GET `/feed`. Service por trás (`social-2.0.service.ts`) já tem Haversine integrado. **Reuso material existe** sem criar service paralelo.

---

## 3. Defaults endossados + refinamentos Clayton 2026-05-19

| # | Default proposto | Refinamento Clayton | Status |
|---|---|---|---|
| 1 | Privacidade: localização ativa user-only, server-side queries | Tabela própria `actor_active_location`, separada de residência fiscal | ENDOSSADO + refinado |
| 2 | Post novo opt-in (não auto-marca) | ENDOSSO DIRETO. "Auto-marca é trap LGPD." | ENDOSSADO |
| 3 | "Ilimitado" = sem filtro geo, só isolamento tenant_id | ENDOSSO. "Posts de SP e Curitiba aparecem juntos no mesmo tenant." | ENDOSSADO |
| 4 | Fallback quando user sem localização: mostra só globais | "Post global no MVP = address_id IS NULL. Campanha nacional explícita vira flag própria depois — não confundir." | ENDOSSADO + nota futura |
| 5 | Granularidade híbrida (km / cidade / estado / ilimitado) | Payload `{scope, value}` polimórfico; backend roteia por scope | ENDOSSADO + estrutura técnica |

---

## 4. Modelo arquitetural proposto

### 4.1 Nova tabela: `actor_active_location`

```sql
CREATE TABLE actor_active_location (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,

  -- Coexistem (sub-decisão pendente):
  address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),

  source TEXT NOT NULL CHECK (source IN (
    'USER_INPUT_CITY',
    'BROWSER_GEOLOCATION',
    'IP_ESTIMATE',
    'EXPLICIT_TRAVEL_MODE'
  )),

  scope_level TEXT CHECK (scope_level IN (
    'NEIGHBORHOOD','CITY','STATE','COUNTRY'
  )),

  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,            -- NULL = explicit clear (default)
  is_active BOOLEAN NOT NULL DEFAULT true,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (address_id IS NOT NULL OR (lat IS NOT NULL AND lng IS NOT NULL))
);

CREATE UNIQUE INDEX uniq_active_actor_location
  ON actor_active_location (tenant_id, actor_id)
  WHERE is_active = true;

CREATE INDEX idx_actor_active_location_actor
  ON actor_active_location (tenant_id, actor_id, is_active);

ALTER TABLE actor_active_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY active_location_rls ON actor_active_location
  USING (tenant_id::text = current_setting('app.current_tenant', true));
```

**Características:**
- Append-only por design (nova localização desativa anterior via UPDATE `is_active=false` + INSERT)
- UNIQUE parcial garante apenas 1 ativa por actor
- TTL opcional (`expires_at` NULL = explicit clear)
- Coexistência address_id (preciso, hierárquico) + lat/lng (preciso, geolocation API)
- CHECK garante que ao menos uma forma de localização está presente

### 4.2 Adição em `posts`

```sql
ALTER TABLE posts
  ADD COLUMN address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL;

CREATE INDEX idx_posts_address ON posts (tenant_id, address_id)
  WHERE address_id IS NOT NULL;
```

**Características:**
- NULL = post global (sem geo) — default
- NOT NULL = post com origem geográfica (opt-in user)
- ON DELETE SET NULL preserva post se address for apagado
- Index parcial otimiza queries por proximidade (NULL posts não entram no índice)

### 4.3 Endpoint refatorado

```
GET /feed?scope=radius_km&value=10
GET /feed?scope=city
GET /feed?scope=state
GET /feed?scope=unlimited

Query opcional:
  &include_global=true   // inclui posts com address_id IS NULL
  &limit=N&offset=M       // paginação existente
```

**Resposta:** schema idêntico ao GET `/feed` atual (não quebra clients existentes). Apenas o filtro muda.

### 4.4 Novo service: `feed-proximity.service.ts`

**Naming canônico (DECISION-0030 anti-padrão #1):** prefixo `feed-` cria fricção semântica protetora contra reuso indevido por módulos operacionais (rides/delivery/marketplace). Cada projeção tem service próprio (`ride-coverage.service`, `delivery-zone.service`, `marketplace-shipping.service`) consumindo `actor_active_location` como fonte mas com regras próprias.

```ts
async resolveFeedScope(
  tenantId: string,
  actorId: string,
  scope: 'radius_km' | 'city' | 'state' | 'unlimited',
  value: number | undefined,
  includeGlobal: boolean
): Promise<FeedQueryFilter> {
  const userLoc = await actorActiveLocationRepo.getActive(tenantId, actorId);

  switch (scope) {
    case 'radius_km':
      if (!userLoc?.lat || !userLoc?.lng) {
        return includeGlobal
          ? { filter: 'address_id IS NULL' }
          : { fallback: 'NO_LOCATION', empty: true };
      }
      return haversineFilter(userLoc.lat, userLoc.lng, value!, includeGlobal);

    case 'city':
      const cityId = userLoc?.address?.city_id;
      if (!cityId) return { fallback: 'NO_LOCATION', empty: true };
      return cityFilter(cityId, includeGlobal);

    case 'state':
      const stateId = userLoc?.address?.state_id;
      if (!stateId) return { fallback: 'NO_LOCATION', empty: true };
      return stateFilter(stateId, includeGlobal);

    case 'unlimited':
      return { filter: 'TRUE' };  // só tenant isolation, sem geo
  }
}
```

### 4.5 Haversine SQL puro (pattern proposto, NÃO PostGIS)

```sql
-- Bounding box pre-filter (rápido, usa index)
WHERE address.lat BETWEEN $userLat - $deltaLat AND $userLat + $deltaLat
  AND address.lng BETWEEN $userLng - $deltaLng AND $userLng + $deltaLng
  -- Haversine fino (preciso)
  AND (2 * 6371 * asin(sqrt(
        power(sin(radians(address.lat - $userLat) / 2), 2)
        + cos(radians($userLat)) * cos(radians(address.lat))
        * power(sin(radians(address.lng - $userLng) / 2), 2)
      ))) <= $radius_km
```

deltaLat/deltaLng calculados como ~`radius_km / 111` para pré-filtro grosseiro.

---

## 5. Sub-decisões pendentes

| # | Sub-decisão | Recomendação minha | Aguarda você |
|---|---|---|---|
| A | Haversine SQL puro vs PostGIS | **Haversine SQL puro** (reuso JS existe, baixo risco, sem instalação extension) | ✅ |
| B | `actor_active_location`: address_id OU lat/lng obrigatórios? | **Ambos opcionais, ao menos um obrigatório via CHECK** | ✅ |
| C | TTL default em `expires_at` | **NULL = explicit clear** (sem TTL automático no MVP) | ✅ |
| D | DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS | **Registrar agora OU frente própria?** | ✅ |
| E | `posts.address_id` ON DELETE behavior | **SET NULL** (preserva post) | ✅ |

---

## 6. Plano de fases (cada uma exige autorização sua)

### F1 — Migration DDL aditiva
**Custo:** ~50 LOC SQL.
**Conteúdo:**
- CREATE TABLE `actor_active_location` (4.1)
- ALTER TABLE `posts` ADD COLUMN `address_id` (4.2)
- Indexes parciais
- RLS + policy

**Pré-requisitos:** sub-decisões A-E resolvidas.
**Validação:** migration aplicada idempotente; schema verificável via `information_schema`.
**Commit:** `migration(geo-feed): actor_active_location + posts.address_id`

### F2 — Service backend `feed-proximity.service.ts` + repos
**Custo:** ~150-200 LOC TypeScript.
**Conteúdo:**
- `actor-active-location.repository.ts` (CRUD)
- `feed-proximity.service.ts` (resolveFeedScope + haversineFilter + cityFilter + stateFilter)
- Reuso de `calculateHaversineDistance` de `social-2.0.service.ts:302` (ou tradução para SQL helper)
- Tipos em `proximity.types.ts`

**Pré-requisitos:** F1 aplicada.
**Validação:** TSC + 4 gates + smoke local unit (chamadas isoladas com mock locations).
**Commit:** `feat(proximity): service de filtro geográfico para feed`

### F3 — Endpoint GET `/feed?scope=&value=` (refator)
**Custo:** ~30-50 LOC.
**Conteúdo:**
- Refator `social-2.0.routes.ts:80` para aceitar `{scope, value, include_global}`
- Validação Zod do payload
- Delegação ao `feed-proximity.service`
- Backward compat: ausência de `scope` → comportamento atual

**Pré-requisitos:** F2 aplicada.
**Validação:** TSC + 4 gates + smoke via curl (4 cenários: radius_km / city / state / unlimited).
**Commit:** `feat(feed): payload polimórfico scope/value para filtro geo`

### F4 — Endpoint user `/me/active-location` (set/clear)
**Custo:** ~50-80 LOC.
**Conteúdo:**
- POST `/me/active-location` (body: `{address_id?, lat?, lng?, source, scope_level?, expires_at?}`)
- DELETE `/me/active-location` (desativa atual)
- GET `/me/active-location` (lê)
- Validação RLS via session

**Pré-requisitos:** F1 aplicada.
**Validação:** TSC + 4 gates + smoke curl.
**Commit:** `feat(api): endpoints de localização ativa do user`

### F5 — Frontend (alçada Codex — não meu escopo direto)
**Custo:** ~80-100 LOC TSX.
**Conteúdo (sob Codex):**
- API client `setActiveLocation`, `clearActiveLocation`, `getFeed({scope, value})`
- UI slider/select de scope (3km / 10km / cidade / estado / ilimitado)
- Toggle "incluir postagens globais"
- Component de set localização (busca cidade via worldService, ou geolocation API)

**Pré-requisitos:** F4 endpoint exposto.
**Validação:** integração visual sua + Codex.
**Commit:** sob alçada Codex.

### F6 — Smoke runtime end-to-end
**Custo:** ~50 LOC script (`smoke-geo-feed-2026-05-19.ts`).
**Conteúdo:**
- Pattern service-direct (precedente `energize-circuit-2026-05-17.ts`)
- 2 posts: 1 sem geo (global), 1 com address_id em Curitiba
- 1 user com active_location em Curitiba
- Query GET /feed?scope=city → deve retornar post Curitiba + global (se include_global)
- Query GET /feed?scope=radius_km&value=5 → deve retornar só Curitiba se user está perto
- Marker `metadata.test_geo='smoke_geo_feed_2026_05_19'` em todas as rows

**Pré-requisitos:** F1, F2, F3 aplicadas.
**Validação:** todos elos passam; saldo de rows verificável.
**Commit:** `smoke(geo-feed): validação end-to-end raio + city + state`

---

## 7. Trade-offs explícitos

| Decisão | Trade-off |
|---|---|
| Haversine SQL puro (não PostGIS) | Performance OK até ~50-100k posts; depois precisa index espacial (decisão futura) |
| `address_id` em posts opcional | Posts antigos sem geo: aparecem em "unlimited", podem aparecer em outros scopes se `include_global=true` |
| `actor_active_location` tabela própria | Mais uma tabela; mas separação contextual ≠ fiscal é princípio explícito Clayton |
| Bounding box + Haversine fino | Bom balance perf/precisão; alternativa (só Haversine sem bbox) é mais lento |
| Refator `social-2.0.routes.ts:80` | Risco de impactar callers existentes — mitigado por backward compat (ausência de scope = comportamento atual) |

---

## 8. Riscos identificados

| Risco | Mitigação |
|---|---|
| `social-2.0.service.ts` já tem Haversine — duplicação se eu criar `feed-proximity.service` paralelo | Reusar helper existente (importar) ou mover para `feed-proximity.service` e re-exportar |
| Posts antigos sem geo viram "invisíveis" em scopes geo | Toggle `include_global=true` default `true` no MVP |
| User browser nega geolocation API | UX fallback: dropdown de cidade (`USER_INPUT_CITY`) |
| LGPD: localização ativa é dado sensível | RLS por tenant_id + queries server-side only + nunca expor em response público |
| PostGIS code paths em rides/work continuam quebrados | Fora do escopo desta frente; DT separada |
| Multi-país no futuro | Schema já suporta (DECISION-0020 §2); seed BR-first; não bloqueia |

---

## 9. O que NÃO está no escopo (limites explícitos)

- ❌ Implementar PostGIS extension (decisão arquitetural ampla)
- ❌ Migrar callers PostGIS quebrados em rides/work (DT separada futura)
- ❌ Materializar `economic_regions` / `economic_region_members` / `tenant_operational_regions` (DT-PRESSURE-LOCATION-CORE-ECONOMIC-REGIONS-MISSING — frente própria)
- ❌ Filtro geo em `events` ou `marketplace_listings` (escopo desta frente é `posts`; aplicar a outros vem depois)
- ❌ Geocoding automático de addresses (DECISION-0020 §1 já decidiu: opcional)
- ❌ Sub-frente B P2P UX (gatilho humano separado)
- ❌ DECISIONs A1-A5 do mapa 2026-05-18 (UX/produto separado)

---

## 10. Critérios de sucesso por fase

| Fase | Critério material objetivo |
|---|---|
| F1 | Migration aplicada idempotente; `information_schema.tables` confirma 2 mudanças; RLS ativa |
| F2 | `feed-proximity.service.ts` exportado; TSC verde; 4 gates verdes; unit-test mental dos 4 ramos do switch |
| F3 | GET `/feed` aceita `?scope=` sem regressão; payload Zod validado; backward compat (sem `scope` = comportamento original) |
| F4 | POST/DELETE/GET `/me/active-location` respondem; RLS força tenant isolation |
| F5 | (Codex) UX testada visualmente por Clayton |
| F6 | Smoke passa 4 cenários: radius_km, city, state, unlimited; rows marcadas com `test_geo` |

---

## 11. Pontos de parada obrigatórios

Cada fase exige autorização explícita ANTES da próxima:

- **Antes de F1:** sub-decisões A-E resolvidas
- **Antes de F2:** F1 commitada + você confirma migration aplicou sem warnings
- **Antes de F3:** F2 commitada + você confirma reuso de Haversine OK
- **Antes de F4:** F3 commitada
- **Antes de F5:** F4 commitada + Codex notificado da nova API
- **Antes de F6:** F5 ou indicação sua para smoke parcial sem UX

§6 fronteira: **migration DDL** (F1) é soberania — exige autorização explícita por fase mesmo em piloto automático.

---

## 12. Princípios institucionais aplicados

Esta frente codifica explicitamente os princípios já estabelecidos:

| Princípio | Como esta frente aplica |
|---|---|
| Frontend nunca cria verdade | Frontend envia `{scope, value}`; backend resolve raio inteiro |
| Localização contextual ≠ residência fiscal | `actor_active_location` separada de `address_assignments`/`tenants.headquarters_address_id` |
| Hierarquia administrativa SSOT | scope=city/state usa city_id/state_id existentes; lat/lng só p/ radius_km |
| Isolamento por tenant | RLS em `actor_active_location` + tenant_id em todos os queries |
| DECISION-0020 vale | Esta frente ESTENDE (não substitui) — `posts.address_id` referencia hierarquia canônica |
| Não criar SSOT paralela | Reuso de Haversine existente; sem duplicar lógica geo |
| §4 padrão cognitivo | Audit material precedeu proposta; sub-decisões explicitadas; nada inferido |
| §6 fronteira de parada | DDL marcada como exigindo autorização |
| Capability-additive | Filtro geo é nova capability, não substitui feed existente |

---

## 13. Estado atual

### Fase 0 executada (2026-05-19)

3 ajustes Clayton aplicados:
- **Ajuste 1:** Renomeação `proximity.service.ts` → `feed-proximity.service.ts` (anti-padrão #1 de DECISION-0030)
- **Ajuste 2:** DECISION-0030 formalizada em `REMEDIATION_DECISIONS_LOG.md`
- **Ajuste 3:** `DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS` registrada em `REMEDIATION_DT_LOG.md`

5 sub-decisões resolvidas:
- **A:** Haversine SQL puro via function `haversine_distance_km(lat1, lng1, lat2, lng2)`
- **B:** address_id OU lat/lng (ambos opcionais, ≥1 obrigatório via CHECK)
- **C:** TTL default NULL no schema; service layer aplica 30 dias default (user override = NULL persistente)
- **D:** DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS registrada agora (Fase 0)
- **E:** ON DELETE SET NULL em `posts.address_id` E `actor_active_location.address_id`

### MODO

**Fase 0 commitada → AGUARDANDO_AUTORIZACAO para F1 (migration DDL).**

Após autorização F1: executo F1, reporto, paro, aguardo F2. Sequência por fase, commits isolados, gates por commit. Pontos de parada da seção 11 mantidos integralmente.
