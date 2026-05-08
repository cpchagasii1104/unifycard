# F3-S3 — Validação do Schema (ChatGPT)

**Data:** 2026-05-08
**Sessão:** F3-S3
**Origem:** ChatGPT (validação do schema canônico proposto)

## Validação das 6 dimensões fundacionais

### 1. `lat/lng` obrigatório ou opcional?

**Recomendação: OPCIONAL + `is_geocoded`**

Motivo: geocoding obrigatório quebra onboarding quando API cai, CEP rural falha, endereço parcial falha, eventos temporários quebram, UX degrada, runtime vira dependente de terceiro. Geografia operacional vira gargalo do identity bootstrap.

Modelo correto: address existe primeiro, geo enrichment acontece depois.

Fluxo:
```
cadastro
↓
resolve CEP
↓
persiste IDs
↓
lat/lng opcional
↓
background enrichment
```

Campos: `lat`, `lng`, `is_geocoded`, `geocoded_at`, `geocode_provider`.

### 2. Região econômica vs administrativa

**Recomendação: SEPARADAS**

Crítica. Porque estado ≠ região econômica.

Exemplos:
- "Sul" cruza PR/SC/RS
- logística pode dividir SP capital/interior
- fundo regional pode agrupar cidades
- rides pode usar zonas operacionais
- cultural pode usar territórios sociais

**Administrativo:** country → state → city → neighborhood
**Econômico/operacional:** regions → region_members → region_types

Decisão crítica: NÃO usar stateId como regionId permanentemente. O TODO do código já mostrou isso.

### 3. Tenant — sede única ou multi-localização?

**Recomendação: HQ única + regiões operacionais N:N**

Porque:
- PJ sempre tende a ter sede jurídica
- mas operação cresce regionalmente
- marketplace/ride/logística exige expansão territorial

**Jurídico/civil:** `tenants.headquarters_address_id`
**Operacional:** `tenant_regions`

Compliance usa HQ. Operação usa regiões. Bank usa regiões. Fiscal usa sede.

### 4. Big-bang ou compatibilidade progressiva?

**Recomendação: MATERIALIZAÇÃO + ADAPTERS + MIGRAÇÃO PROGRESSIVA**

NÃO big-bang puro. NÃO dualidade eterna.

**Fase 1:** Materializa countries, states, cities, neighborhoods, addresses
**Fase 2:** Cria adapters: `resolveAddress()`, `resolveCity()`, `resolveRegion()`
**Fase 3:** Novos módulos: PROIBIDO string livre
**Fase 4:** Módulos antigos: migração gradual
**Fase 5:** Remoção do legado

## Avaliação do schema proposto

Schema proposto está MUITO bom. Já resolveu os principais riscos:
- multi-país incremental
- endereço como entidade
- compatibilidade futura
- territorialidade canônica
- CEP como UX
- expansão operacional
- sem overengineering

## 4 ajustes técnicos importantes (incorporados em DECISION-0020)

### Ajuste 1 — `NUMERIC` para coordenadas

`NUMERIC(10,7)` está correto. Não é dinheiro, e precisão geográfica importa.

### Ajuste 2 — `address_assignments`

Excelente ideia. Isso evita:
- duplicação de endereço
- snapshots infinitos
- acoplamento

Muito forte arquiteturalmente.

### Ajuste 3 — `owner_type` deve ter CHECK constraint

Evitar string aberta. Melhor:
```sql
CHECK (owner_type IN (...))
```
ou enum.

Porque "company"/"Company"/"COMPANY" vira inferno rápido.

### Ajuste 4 — `source` rastreável

Aqui existe ouro arquitetural. Isso vira rastreabilidade semântica.

Exemplo:
- `UX_INPUT`
- `CEP_RESOLVED`
- `GEOCODED`
- `MANUAL_OVERRIDE`
- `IMPORT_LEGACY`

Isso vai salvar vocês no futuro.

## 5 observações finais

### 1. `name_normalized`

Excelente. Mas `lower(unaccent(name))` precisa virar **padrão institucional**.

Porque "São Paulo"/"Sao Paulo"/"são paulo" não podem gerar 3 cidades.

Então:
- normalization helper único
- mesma regra em todos writers
- idealmente trigger ou service central

### 2. `external_code`

Muito importante NÃO chamar de `ibge_code`. Isso congelaria Brasil na ontologia. `external_code` foi a decisão certa.

### 3. `economic_region_members.CHECK`

Muito elegante. Principalmente o CHECK que impede:
- state + city simultâneo
- linhas semanticamente inválidas

Excelente defesa estrutural.

### 4. `address_assignments.valid_to`

Muito mais poderoso do que parece. Ganha-se:
- histórico territorial
- auditoria
- versionamento
- compliance
- reconstrução temporal

Na prática: event sourcing leve de endereço, sem precisar virar sistema temporal completo.

### 5. Insight mais importante

Vocês acabaram de transformar:
```
endereço
```
em:
```
infraestrutura territorial soberana
```

Isso provavelmente vai impactar:
- risk engine
- AML
- logística
- governança regional
- fundos
- matching
- pricing
- tributação
- elegibilidade

Esta sessão foi MUITO maior do que parecia no começo. Começou com `c.cep does not exist` e terminou definindo como o sistema entende território.

Arquitetura de verdade costuma começar assim mesmo.

## Leitura final

Desenho está maduro o suficiente para DECISION-NNNN. Sem mais debate ontológico infinito.

Eixo correto encontrado:
- território por IDs
- CEP como UX
- address entity
- região econômica separada
- Brasil-first expansível
- materialização progressiva

Agora virou engenharia.
