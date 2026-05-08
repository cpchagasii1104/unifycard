# F3-S2 — Arqueologia Arquitetural (Codex)

**Data:** 2026-05-08
**Sessão:** F3-S2
**Origem:** Codex (varredura material em `migrations_archive/`)

## Veredito

Sim: já existiu uma materialização parcial e bem concreta do Location/World Core. Ela está hoje **arquivada**, não ativa no banco vivo.

O plano antigo era:

```
countries → states → cities → neighborhoods → addresses
```

com `root_config`, `tenants.city_id` e `global_user_residence` dependendo dessa hierarquia.

## Evidências principais

Migrations históricas relevantes:

- `migrations_archive/0360_world_geography.sql:40` — Cria `countries`, `states`, `cities`. Header: "referência única de países, estados e cidades".
- `migrations_archive/0361_location_core_neighborhoods.sql:20` — Cria `neighborhoods` e completa a hierarquia "país → estado → cidade → bairro".
- `migrations_archive/0362_location_core_normalization.sql:24` — Adiciona `name_display`, `name_normalized`, função de normalização e triggers.
- `migrations_archive/0363_location_core_addresses.sql:25` — Cria `addresses` genérica para users, companies, groups, events, votings, schools e futuros módulos.
- `migrations_archive/0021_tenants_add_city_id.sql:25` — Versão antiga de `tenants.city_id` com FK real para `cities(city_id)`.
- `migrations_archive/0023_global_user_residence.sql:25` — Cria residência digital global com `country_id`, `state_id`, `city_id`.
- `migrations_archive/0003_root_config.sql:29` — Cria `root_config`, mas a migration arquivada só cria `id`, `created_at`, `updated_at`; o código atual espera mais colunas.

## Estado do banco vivo

Consulta read-only confirmou:

```
countries             ausente
states                ausente
cities                ausente
neighborhoods         ausente
addresses             ausente
root_config           ausente
global_user_residence ausente
rides_cities          presente
regional_funds        presente
services              presente
```

Location Core **não está materializado no banco atual**.

## Código que assume Location Core

- `address.types.ts:2` declara "Location Core - Contrato único de endereço" e diz que CEP é UX, não fonte de verdade.
- `location.repository.ts:20` consulta diretamente `countries`, `states`, `cities`, `neighborhoods`.
- `location-enrichment.service.ts:57` tenta enriquecer CEP criando país/estado/cidade/bairro no Location Core.
- `location.validators.ts:17` valida hierarquia normalizada.
- `residence.service.ts:1` usa `global_user_residence`.
- `root-config.repository.ts:10` espera `root_config.country_id/state_id/city_id`.
- `city-readiness.service.ts:82` tenta usar `worldService` quando `rides_cities` não resolve região.
- `region-account.service.ts:26` usa `tenant.cityId -> worldService -> stateId` como região temporária.

## Código que contorna ausência do core

- `0090_tenants_city_id.sql:6` é explícita: não cria FK para `cities` porque "tabela world pode não existir em instalações mínimas".
- `20260418120000_services_table_core.sql:22` cria `country_id`, `state_id`, `city_id`, mas sem FKs.
- `0122_product_offers.sql:13` usa `location_region_id` e `location_city_id`, também sem FK.
- `20260530360000_rides_requests.sql:3` cria `rides_cities` próprio, separado do World Core.
- `regional_funds` trabalha com `country/state/city` como `TEXT`, não IDs normalizados.

## Documentação técnica confirma abandono parcial

Dois documentos decisivos:

- `docs/03_technical/CORRECAO_LOCATION_CORE_ACTIVE.md:13` — Diz que `/locations/countries` quebrava porque `countries.active` não existia; migration 115 adicionaria, mas não foi executada.
- `docs/03_technical/CORRECAO_LOCATION_CORE_NAME_DISPLAY.md:16` — Diz que `name_display` não existia; migration 116 não foi executada. O código foi simplificado para schema mínimo.

Isso prova que em algum momento havia tabela `countries/states`, mas o banco atual já não tem nem esse mínimo.

## Grau de completude do plano antigo

- **Base geográfica:** madura e reaproveitável.
- **Neighborhoods:** madura, depende da base.
- **Addresses:** conceitualmente madura, mas ainda sem integração com empresas/perfis/eventos.
- **Normalização `name_display/name_normalized`:** existe, mas foi recuada no código. Não retomaria no primeiro passo.
- **Root config/residence:** intenção clara, mas migrations/código estão desalinhados.
- **Regiões econômicas/logísticas:** fragmentadas entre `regional_funds`, `rides_cities`, `rides_regions` arquivado, `services.city_id`, `product_offers.location_city_id`.

## Reaproveitável imediatamente

- `0360_world_geography.sql`, com revisão de numeração e adequação ao padrão atual.
- `0361_location_core_neighborhoods.sql`, depois da base.
- Seeds:
  - `seed-countries-basic.ts:1`
  - `seed-location-brazil-pr-curitiba.ts:1`
- Código atual de `location.repository`, `location-enrichment`, validators e frontend `LocationSelector`.

## NÃO reaproveitar no primeiro passo

- `0362_location_core_normalization.sql` imediatamente. Existe histórico de erro por `name_display`; melhor reativar schema mínimo primeiro.
- `0363_location_core_addresses.sql` junto da base. Endereço é camada seguinte.
- FK imediata em `tenants.city_id`, `services.city_id`, `product_offers.location_city_id`. Hoje esses campos existem justamente como IDs soltos/parciais.

## Recomendação prática para F3-S3

F3-S3 deve ser pequena:

1. Materializar apenas o catálogo mínimo: `countries`, `states`, `cities`.
2. Rodar seed mínimo: Brasil, Paraná, Curitiba, ou países básicos.
3. Validar `/locations/countries`.
4. Só depois decidir `neighborhoods`.
5. `addresses`, `root_config`, `global_user_residence` ficam para fases separadas.

## Resumo

O Location Core antigo existe, é recuperável, mas foi arquivado e o banco vivo não tem as tabelas. O próximo passo não é inventar arquitetura; é ressuscitar a base mínima de forma controlada.
