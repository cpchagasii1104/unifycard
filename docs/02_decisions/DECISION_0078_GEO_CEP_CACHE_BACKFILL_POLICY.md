# DECISION-0078 — Política de cache/backfill/provider real de CEP (F-GEO-1b)

**Status:** RATIFICADA — DECISÃO OPERACIONAL (D-GEO-1b). **DOCS-ONLY**; implementação não autorizada aqui (2026-06-02).
**Sessão:** 2026-06-02 (pós F-GEO-1a — infra geo compartilhável).
**Decisor:** Clayton.
**Commit âncora:** HEAD origem `30e46ba9`.
**Documento canônico:** este arquivo.
**Subordinada a:** `DECISION-0077` (estratégia geo B+D+C), `DECISION-0074`/`0076` (endereço PF), `DECISION-0020`/`0021`
(Location Core), `SSOT_REGISTRY_UNIFICARD.md`, LGPD (limite material).
**Vinculada a:** `DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE` (OPEN). **Escopo:** frente Location/Geo (compartilhável
PF/PJ); **NÃO** implementa e **NÃO** toca PJ/Companies.

---

## 1. Contexto

- **F-GEO-1a** (commit `30e46ba9`) criou a infra geo **compartilhável**: port `CepProvider` (`BrasilApiCepProvider`
  com `fetch`+timeout; `NullCepProvider` default; `MockCepProvider` p/ testes; `getDefaultCepProvider()` env-gated
  `CEP_PROVIDER=brasilapi`), `geo-enrichment.service` (`resolvePostalCode`/`enrichAddress`, fail-open), e métodos
  de repo (`findCityByExternalCode`/`createCityFromExternal`/`updateAddressGeo`).
- **Provider real é env-gated**; **gates/testes não dependem de rede** (default Null + Mock).
- **Addresses existentes ainda precisam ser enriquecidos** (DEV: 3 com `postal_code`, `state_id`/`city_id` NULL).
- **Cache persistente ainda não existe** (`cep_resolution_cache` = ausente).

## 2. Escolha principal

**F-GEO-1b deve criar (a) um cache persistente de resolução de CEP e (b) um script/job idempotente de
enrichment dos `addresses` existentes**, usando a infra da F-GEO-1a. Sem chamar API externa em migration; sem
depender de rede no CI.

## 3. Cache persistente — modelo recomendado

```text
cep_resolution_cache
  cep_resolution_cache_id  UUID PK
  postal_code              TEXT NOT NULL UNIQUE   -- 8 dígitos normalizados (chave de lookup)
  provider                 TEXT NOT NULL          -- 'BRASIL_API' | 'VIA_CEP' | 'MOCK'
  state_code               TEXT                   -- UF
  city_name                TEXT
  city_external_code       TEXT                   -- IBGE (quando o provider trouxer)
  neighborhood_name        TEXT                   -- texto (NÃO vira FK)
  street                   TEXT
  source                   TEXT NOT NULL          -- 'CEP_RESOLVED' | 'EXTERNAL_API'
  resolved_at              TIMESTAMPTZ NOT NULL
  expires_at               TIMESTAMPTZ            -- TTL controlado (CEP é estável → TTL longo)
  -- raw_response_hash      TEXT                  -- OPCIONAL, só hash; NUNCA raw completo
```

**Vetos do cache:**
- ❌ **NÃO** salvar `raw_response` completa (só campos úteis; `raw_response_hash` opcional para invalidação).
- ❌ **NÃO** armazenar **coordenada precisa de residência** (cache não guarda lat/lng de endereço).
- ❌ **NÃO** usar o cache como **SSOT de endereço** — cache é **insumo técnico**, não verdade final; o SSOT é
  `addresses` + FK (`state_id`/`city_id` por `external_code`/IBGE).
- ❌ **NÃO** tratar o cache como catálogo (catálogo canônico = `states`/`cities` com `external_code`).

## 4. Provider real

- **BrasilAPI** (ou equivalente) como **preferido quando retornar IBGE**; **ViaCEP** só como **fallback** se
  necessário (sem IBGE → resolve no máximo UF; city por IBGE fica indisponível).
- **Sem provider real nos gates** — `NullCepProvider` default + `MockCepProvider` nos testes. Provider real
  **só via env explícita** (`CEP_PROVIDER=brasilapi`).
- **Timeout obrigatório** (AbortController) · **fail-open obrigatório** · **erro externo NÃO pode quebrar a
  escrita de endereço** (já garantido na F-GEO-1a; F-GEO-1b mantém).

## 5. Backfill / enrichment

- **Script/job, NÃO migration SQL** (migration que chama internet é proibido).
- **Idempotente**: processa `addresses` com `postal_code IS NOT NULL` **e** (`state_id IS NULL` OR `city_id IS
  NULL`); re-run não duplica city (reusa por `external_code`).
- **Cache-first**: consulta `cep_resolution_cache` antes do provider; só chama provider em miss; grava o resultado
  no cache.
- **Atualiza** `addresses.state_id`/`city_id`/`source` (`CEP_RESOLVED`); **cria city por `external_code` IBGE sob
  demanda**; **sem IBGE → state-only**.
- **NÃO** toca `neighborhoods` · **NÃO** persiste lat/lng preciso · **NÃO** toca `actor_active_location` · **NÃO**
  limpa o blob.

## 6. PF / PJ

- **PF** se beneficia: com `state_id`/`city_id` populados, o `core.service` poderá **parar de depender do blob**
  para city/state (F-GEO-3).
- **PJ/Companies** devem usar **o mesmo resolver/cache** no futuro (DECISION-0075 §7 / 0077) — **um trilho único**.
- Esta decisão **não implementa nem altera PJ**.

## 7. Sequência futura

```text
D-GEO-1b — esta decisão (docs-only)
F-GEO-1b — migration cep_resolution_cache + script/job idempotente + repo/service usando cache (cache-first)
F-GEO-2  — enrich dos addresses existentes (via script F-GEO-1b)
F-GEO-3  — core.service lê city/state por FK (catálogo), sem blob
F-GEO-4  — decidir bairro/neighborhood + cleanup de profiles.metadata.address
F-GEO-5  — selo / CLOSE da DT, se aplicável
```

## 8. Vetos permanentes

```text
❌ chamar API externa em migration
❌ depender de rede no CI/gates
❌ criar resolver/cache PJ paralelo
❌ armazenar city/state textual em addresses
❌ match frágil por nome sem external_code
❌ salvar raw_response completa no cache; armazenar coord precisa de residência
❌ limpar profiles.metadata.address nesta etapa
❌ geocodificar residência precisamente sem nova decisão LGPD
❌ implementar (código/migration/runtime) nesta fatia
```

## 9. Superada por

(em aberto — decisão vigente)
