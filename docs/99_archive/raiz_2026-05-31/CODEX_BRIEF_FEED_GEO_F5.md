# Brief Codex — Frontend Feed com Raio Geográfico (F5)

**Data:** 2026-05-19
**Origem:** Plano `PLANO_FEED_RAIO_GEOGRAFICO_2026_05_19.md` — fase F5 (alçada Codex)
**Pré-requisitos:** F1-F4 backend entregues e funcionais (commits abaixo)
**Modo:** Brief para Codex executar — Claude NÃO toca frontend

---

## 1. Contexto institucional

Pilar Localização foi institucionalizado em 2026-05-19 (memória `project_localizacao_pilar_soberano.md`) e DECISION-0030 formalizou contexto espacial soberano como entidade temporal-operacional com 4 projeções distintas. Esta frente materializa a projeção **descoberta** (feed/posts).

### Princípios vinculantes para Codex

1. **Frontend nunca cria verdade** (memória `project_frontend_nunca_cria_verdade.md`):
   - Frontend NÃO calcula distância localmente
   - Frontend NÃO infere localização sem usuário declarar
   - Frontend NÃO cacheia capability/saldo/listas operacionais
   - Toda decisão geo é resolvida server-side

2. **DECISION-0030 anti-padrões**:
   - Frontend NÃO pode confundir "ver mundo todo no feed" com "aceitar delivery de qualquer lugar"
   - Slider/scope é projeção UX da projeção **descoberta**; não afeta outras projeções
   - Lat/lng NUNCA persistidos em localStorage (LGPD)

3. **Backend é fonte:**
   - Lista de cidades vem de `GET /world/countries/:id/states` e `GET /world/states/:id/cities` (worldService)
   - Cálculo de raio é backend
   - Validação é backend

---

## 2. Commits backend entregues

| Fase | Commit | Conteúdo |
|---|---|---|
| Fase 0 | `d2262177` | DECISION-0030 + DT-POSTGIS-MISSING + renomeação proximity→feed-proximity |
| F1 | `5397a724` | Migration: `actor_active_location` + `posts.address_id` + função `haversine_distance_km` |
| F2 | `0a490261` | Backend: `feed-proximity.service` + `actor-active-location.repository` |
| F3 | `193957c2` | `GET /feed?scope=&value=&include_global=` |
| F4 | `8d9a07ac` | `POST/DELETE/GET /me/active-location` |

---

## 3. API Contracts (estáveis)

### 3.1 Localização ativa do user

#### Set localização ativa

```
POST /me/active-location
Auth: Bearer + x-action-context (actorId obrigatório)
Body:
  {
    "address_id"?: UUID,         // opcional
    "lat"?: number,              // -90 a 90; opcional
    "lng"?: number,              // -180 a 180; opcional
    "source": "USER_INPUT_CITY" | "BROWSER_GEOLOCATION" | "IP_ESTIMATE" | "EXPLICIT_TRAVEL_MODE",
    "scope_level"?: "NEIGHBORHOOD" | "CITY" | "STATE" | "COUNTRY",
    "expires_at"?: ISO_DATETIME,
    "metadata"?: object
  }
Regra: address_id OU (lat AND lng) obrigatório (≥1).
Response 201:
  {
    "location": {
      "id", "tenantId", "actorId",
      "addressId", "lat", "lng",
      "source", "scopeLevel",
      "activatedAt", "expiresAt", "isActive",
      "metadata", "createdAt"
    }
  }
Erros: 400 (body inválido), 401 (não autenticado), 500 (interno).
```

#### Get localização ativa

```
GET /me/active-location
Auth: Bearer + x-action-context
Response 200:
  { "location": ActorActiveLocation | null }
```

#### Clear localização ativa

```
DELETE /me/active-location
Auth: Bearer + x-action-context
Response 204 (idempotente)
```

### 3.2 Feed com filtro de proximidade

```
GET /social/feed?actor_type=user|page&scope=&value=&include_global=&...

Querystring (DECISION-0030 — payload polimórfico):
  scope?: "radius_km" | "city" | "state" | "unlimited"
  value?: string (número em km quando scope=radius_km)
  include_global?: "true" | "false"

Outros params (preexistentes, sem mudança):
  cursor, limit, actor_type, actor_id, actor_status,
  user_preferences (JSON), user_location (JSON), group_id

Backward compat: ausência de scope → comportamento atual sem filtro geo.

Erros novos:
  400: "scope=radius_km requer value > 0 (km)"
```

### 3.3 Catálogo geográfico (worldService — preexistente)

```
GET /world/countries                            → lista países
GET /world/countries/:countryId/states          → estados do país
GET /world/states/:stateId/cities               → cidades do estado
GET /world/search/cities?q=...                  → busca cidade por nome
```

---

## 4. UX Guidance (sugestões para Codex)

### 4.1 Componente Slider de Scope

**Componente:** `<FeedScopeSelector value={...} onChange={...} />`

Estados do slider (preset, não free-form):
```
3 km | 10 km | Cidade | Estado | Ilimitado
```

Mapeamento UI → API payload:
```
"3 km"        → { scope: "radius_km", value: 3 }
"10 km"       → { scope: "radius_km", value: 10 }
"Cidade"      → { scope: "city" }
"Estado"      → { scope: "state" }
"Ilimitado"   → { scope: "unlimited" }
```

**Toggle adicional:** "Incluir postagens sem localização" → `include_global=true|false`.

**Persistência da preferência:** OK persistir o **scope escolhido** (não os dados de localização) em localStorage. localStorage NÃO pode persistir `lat/lng` (LGPD).

### 4.2 Componente Set Localização Ativa

**Componente:** `<ActiveLocationManager />`

Dois caminhos UX:

#### A) User escolhe cidade (default seguro)
```
1. Componente de busca de cidade (autocomplete via /world/search/cities)
2. User seleciona cidade → backend resolve address_id ou apenas envia city info
3. POST /me/active-location { source: "USER_INPUT_CITY", scope_level: "CITY", ... }
```

#### B) User permite geolocation API (browser)
```
1. Botão "Usar localização atual" → solicita Geolocation API
2. Browser pede consent
3. Recebe { latitude, longitude, accuracy }
4. POST /me/active-location { lat, lng, source: "BROWSER_GEOLOCATION" }
```

**NUNCA:**
- Coletar localização sem consent explícito
- Auto-set localização ao login (deixar opt-in)
- Persistir lat/lng em localStorage
- Inferir cidade a partir de IP no client (server-side via source=IP_ESTIMATE)

### 4.3 Flow completo do feed

```
1. App carrega → user logado → ActionContext OK
2. UI Feed:
   - Chama GET /me/active-location → exibe estado atual (sem location? mostra CTA "ativar")
   - Aplica scope selecionado (default localStorage ou "unlimited")
   - Chama GET /social/feed?scope=...&value=...&include_global=true
3. User troca scope no slider → chama GET /social/feed novamente com novo scope
4. User clica "ativar localização" → modal:
   - Opção A: search cidade
   - Opção B: usar geolocation API
   - Confirma → POST /me/active-location → recarrega feed
5. User clica "limpar localização" → DELETE /me/active-location → recarrega feed
```

### 4.4 Estados especiais (handled by backend, frontend só renderiza)

| Cenário | Backend behavior | UX sugerido |
|---|---|---|
| User sem localização + scope=radius_km/city/state | Backend retorna posts globais OU empty | Mostrar CTA "Ative sua localização para ver mais posts" |
| User sem localização + scope=unlimited | Sem filtro geo (todos posts do tenant) | Comportamento normal |
| Backend retorna empty + fallbackApplied="NO_LOCATION" | (em logs server-side) | UX: prompt para ativar localização |

### 4.5 Componente "marcar post com localização"

Quando user posta:
- Opt-in explícito: checkbox "Marcar local"
- Default: SEM localização (post global)
- Se marcar: backend resolve address_id da localização ativa OU pede address específico

(POST /posts com address_id é fora do escopo desta frente — pode vir em F7 futuro.)

---

## 5. Patterns existentes para reuso

### Estrutura de feed atual

`src/pages/SocialPage.tsx` ou similar — feed renderiza via `api/social.ts` (provavelmente). Codex deve verificar onde GET /social/feed é chamado hoje e estender o caller para passar `scope/value/include_global` opcionalmente.

### Helpers que JÁ existem (verificar antes de criar)

- W3C Geolocation API wrapper (Codex sabe se existe; auditar)
- Componente de busca de cidade (talvez em CompanyOnboarding ou Address forms)
- localStorage helper (api/client.ts ou config/)

---

## 6. O que NÃO está no escopo de F5

- Marcação de post com localização (POST /posts com address_id) — F7 futuro
- Map view, heatmap, visualização espacial — futuro
- Filtro geo em events, marketplace_listings — projeções distintas (DECISION-0030 anti-padrão #5)
- Inferência de localização por IP no frontend (apenas backend pode usar IP_ESTIMATE como source)
- Persistência de lat/lng em localStorage (LGPD veto)

---

## 7. Critérios de sucesso F5

| Critério | Validação |
|---|---|
| Slider muda scope visualmente | Visual |
| Slider muda payload da query GET /social/feed | DevTools Network |
| Posts retornam diferentes conforme scope (com dados de teste F6) | Visual |
| POST /me/active-location funciona | DevTools + UI confirma |
| DELETE /me/active-location funciona | DevTools + UI confirma |
| Backward compat: sem scope, feed funciona como antes | Visual |
| Estado "sem localização" mostra CTA apropriado | Visual |
| Sem cache de lat/lng em localStorage | Audit localStorage (LGPD) |

---

## 8. Pontos de coordenação com Claude (backend)

Quando Codex encontrar:
- Comportamento backend ambíguo → consultar Claude
- API contract precisa estender → Claude refator backend
- Endpoint quebrado → Claude investiga
- Necessidade de novo endpoint → Claude considera

**NÃO Codex:**
- Modificar backend
- Criar service paralelo de proximidade no frontend
- Calcular Haversine em JS para UX dinâmico (DECISION-0030 anti-padrão #3)

---

## 9. Pré-requisitos para F6 (smoke runtime)

F5 não bloqueia F6. F6 será executado por Claude via script service-direct testando:
- 2 posts (1 sem geo, 1 com geo Curitiba)
- 1 actor com active_location Curitiba
- 4 cenários de scope

F6 valida o backend isoladamente; F5 valida UX via interação humana de Clayton.

---

## 10. Quando F5 estiver pronta para review de Clayton

Codex reporta a Clayton:
- Diff completo dos componentes/hooks/api client
- Screenshots dos 5 estados do slider
- Screenshot do flow "set localização" (cidade + geolocation)
- Audit localStorage (confirmar zero lat/lng persistidos)
- Confirmação backward compat

Claude pode ajudar Codex se backend precisar de ajuste após review.

---

## 11. Memórias relevantes carregadas

| Memória | Aplicação |
|---|---|
| `project_localizacao_pilar_soberano.md` | base institucional do pilar |
| `project_frontend_nunca_cria_verdade.md` | autocontrole permanente |
| `project_coordenacao_claude_codex.md` | divisão de papéis |
| DECISION-0030 (REMEDIATION_DECISIONS_LOG.md) | 4 projeções + anti-padrões |
| DT-PRESSURE-POSTGIS-MISSING-RIDES-WORK-CALLERS | contexto histórico (não afeta F5) |

---

**Brief encerrado.** Codex pode começar quando autorizado por Clayton.
