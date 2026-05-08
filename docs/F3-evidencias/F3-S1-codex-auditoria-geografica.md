# F3-S1 — Auditoria Geográfica (Codex)

**Data:** 2026-05-08
**Sessão:** F3-S1
**Origem:** Codex (acesso material ao disco do projeto)

## Conclusão executiva

Hoje não existe SSOT geográfico operacional no banco vivo. Existe uma arquitetura canônica desenhada no código, mas ela não está materializada no schema atual.

O sistema tem três realidades geográficas convivendo:

1. **Location Core / World**: tentativa canônica por IDs (`country_id`, `state_id`, `city_id`, `neighborhood_id`), mas as tabelas `countries`, `states`, `cities`, `neighborhoods`, `addresses` **não existem no banco vivo**.
2. **CEP legado vivo**: `/api/location/cep/:cep` funciona via BrasilAPI/ViaCEP e retorna texto (`logradouro`, `bairro`, `localidade`, `uf`).
3. **Região econômica/logística espalhada**: `regional_funds`, `regional_impact_snapshots`, `regional_activation_rules`, `rides_cities`, `services`, `product_offers`, `profiles.metadata`, `companies` no código, cada um modelando geografia de forma diferente.

Adicionar `companies.cep`, `companies.city`, `companies.state` como `TEXT` **sem decisão institucional** cria risco real de "realidade paralela".

## Evidências principais

- `address.types.ts:7` declara: "Contrato único de endereço", "CEP é UX, não é fonte de verdade" e "Fonte de verdade é o Location Core".
- `location.repository.ts:20` consulta `countries`, `states`, `cities`, `neighborhoods`.
- Banco vivo: `to_regclass` confirmou que `countries`, `states`, `cities`, `neighborhoods`, `addresses` **não existem**.
- HTTP real: `GET /locations/countries` retorna 500: `relação "countries" não existe`.
- HTTP real: `GET /api/location/cep/01001000` funciona e retorna `Praça da Sé`, `Sé`, `São Paulo`, `SP`.
- `0090_tenants_city_id.sql:6` diz explicitamente: "Não FK para cities: tabela world pode não existir em instalações mínimas."
- `0014_regional_fund.sql:9` cria `regional_funds` por `(tenant_id, country, state, city)` em `TEXT`.
- `20260530360000_rides_requests.sql:3` cria `rides_cities` com `name`, `state`, `country` também em `TEXT`.
- `companies.service.ts:462` tenta inserir `cep`, `address`, `neighborhood`, `city`, `state`, `country` em `companies`.
- Banco vivo: `companies` **não tem** essas colunas hoje. Só tem `company_id`, `tenant_id`, `company_name`, `trade_name`, `status`, `global_user_id`, `cnpj`, etc.

## Mapa de fragmentação

- **Endereço pessoal**: `profiles.metadata.address` via `core.service.ts:376`.
- **Endereço empresarial**: código espera colunas diretas em `companies`, mas banco vivo não tem.
- **Serviços**: `services.country_id/state_id/city_id/neighborhood`, sem FK para tabela geográfica.
- **Marketplace/ofertas**: `product_offers.location_region_id/location_city_id`, sem FK geográfica.
- **Rides**: `rides_cities` próprio e `rides_zones.city_id -> rides_cities.id`.
- **Fundo regional**: `regional_funds.country/state/city TEXT`.
- **AI/contexto regional**: tenta usar `residenceService`, `tenant.cityId`, `rootConfig.cityId` e `worldService`, mas as tabelas base não existem.
- **Categorias**: têm `country_code`, mas há comentário explícito para não usar `cities/world` e evitar SSOT paralelo em `categories.service.ts:454`.

## Respostas estruturadas

1. **Existe SSOT geográfico hoje?** Não operacionalmente. Existe intenção canônica (Location Core), mas sem tabelas no banco.
2. **Endereço é entidade própria ou atributo espalhado?** Espalhado. Há `AddressRef` como contrato, mas sem tabela `addresses`.
3. **"Região" é o quê?** Misturada: econômica em `regional_funds`; logística em `rides_cities/rides_zones`; administrativa planejada em `world/location`; contexto de IA em `tenant.cityId/rootConfig/user_residence`; tudo sem uma autoridade única.
4. **Risco de adicionar `companies.cep/city/state TEXT`?** Alto se tratado como fonte de verdade. Menor se declarado como **snapshot jurídico/legado/read model da empresa**, subordinado a uma futura normalização geográfica.
5. **Módulos afetados:** `companies`, `profiles/core`, `services`, `marketplace/catalog`, `rides`, `city-readiness`, `AI/residence/root-config`, `categories`, `events/orchestrator`, `regional fund`.
6. **Existe decisão implícita no código?** Sim: o código aponta para Location Core por IDs como arquitetura desejada. Mas as migrations e o banco vivo contradizem isso.
7. **Para onde o sistema parece caminhar?** Para Location Core/World com IDs normalizados, mas o runtime atual ainda está em modo híbrido: CEP textual vivo, região econômica em `TEXT`, rides com cidade própria, companies tentando texto direto.

## Recomendação

Não criar `companies.city/state/cep TEXT` como "verdade geográfica". Se precisar destravar companies agora, enquadrar essas colunas como **snapshot cadastral da empresa**, não SSOT territorial. A decisão arquitetural real precisa vir antes: ou materializar Location Core no banco, ou declarar formalmente que geografia de produção ficará textual por fase. Hoje, o pior caminho é adicionar campos em companies sem declarar esse papel.
