# F3-S4 — Plano de aplicação

## Resumo

Aplicar migration `20260530516000_create_location_core_administrative.sql` no banco `unificard_dev`. Validar schema. Commitar.

## Etapas

### Etapa 1 — Mover migration para o lugar certo (do download para o repo)

```powershell
# Substituir o caminho de origem se você baixou em outro lugar
$origem = "$env:USERPROFILE\Downloads\20260530516000_create_location_core_administrative.sql"
$destino = "C:\unificard\backend\migrations\20260530516000_create_location_core_administrative.sql"

if (Test-Path $origem) {
  Move-Item $origem $destino -Force
  Write-Host "Migration movida para $destino" -ForegroundColor Green
} else {
  Write-Host "ARQUIVO NAO ENCONTRADO em $origem" -ForegroundColor Red
  Write-Host "Ajuste o caminho `$origem manualmente"
}

# Validar
Get-Item $destino | Select-Object Name, Length, LastWriteTime
```

Esperado: arquivo de ~12 KB no destino.

---

### Etapa 2 — Confirmar contagem antes de aplicar

```powershell
cd C:\unificard
Write-Host "=== Antes de aplicar: total de migrations ==="
(Get-ChildItem C:\unificard\backend\migrations\*.sql).Count
# Esperado: 286 (era 285, adicionamos 1)

Write-Host ""
Write-Host "=== Ultimas 3 migrations (deve mostrar a nova) ==="
Get-ChildItem C:\unificard\backend\migrations\*.sql | Sort-Object Name | Select-Object -Last 3 | Format-Table Name
```

Esperado: a nova `20260530516000_create_location_core_administrative.sql` aparece como ultima.

---

### Etapa 3 — Snapshot do banco ANTES (para comparacao)

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT to_regclass('public.countries')      AS countries,
       to_regclass('public.states')         AS states,
       to_regclass('public.cities')         AS cities,
       to_regclass('public.neighborhoods')  AS neighborhoods;
"
```

Esperado: todas NULL (tabelas ainda nao existem).

---

### Etapa 4 — Aplicar a migration

```powershell
psql -U postgres -d unificard_dev -P pager=off -1 -f C:\unificard\backend\migrations\20260530516000_create_location_core_administrative.sql
```

Flag `-1` força transação única (rollback completo se qualquer comando falhar).

**Esperado:** uma sequência de `CREATE EXTENSION`, `CREATE FUNCTION`, `CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, `COMMENT ON TABLE` — todos retornando `CREATE ...` ou `NOTICE` (idempotente).

**Se aparecer `ERROR:`** — para imediatamente, cola o erro aqui. Não tente seguir.

---

### Etapa 5 — Validação pós-aplicação

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT to_regclass('public.countries')      AS countries,
       to_regclass('public.states')         AS states,
       to_regclass('public.cities')         AS cities,
       to_regclass('public.neighborhoods')  AS neighborhoods;
"
```

Esperado: 4 linhas, todas com nome de tabela (não NULL).

---

### Etapa 6 — Validar funções helper

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT proname, prokind
FROM pg_proc
WHERE proname IN ('update_updated_at_column', 'normalize_name')
ORDER BY proname;
"
```

Esperado: 2 linhas (`normalize_name`, `update_updated_at_column`).

---

### Etapa 7 — Testar normalize_name

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT
  normalize_name('Sao Paulo')   AS sem_acento,
  normalize_name('SAO PAULO')   AS maiusculo,
  normalize_name('sao paulo')   AS minusculo;
"
```

Esperado: as 3 colunas retornam `sao paulo`.

---

### Etapa 8 — Validar estrutura das tabelas

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "\d countries"
psql -U postgres -d unificard_dev -P pager=off -c "\d states"
psql -U postgres -d unificard_dev -P pager=off -c "\d cities"
psql -U postgres -d unificard_dev -P pager=off -c "\d neighborhoods"
```

**Pontos a verificar visualmente em cada saída:**

`countries`:
- 11 colunas (country_id, iso_alpha2, iso_alpha3, name, name_localized, phone_code, currency_code, timezone_default, is_active, created_at, updated_at)
- Trigger `trg_countries_updated_at`
- Constraint `countries_iso_alpha2_format` (CHECK)

`states`:
- Coluna `name_normalized` marcada como `generated always as ... stored`
- FK para `countries(country_id)`
- UNIQUE em `(country_id, name_normalized)`
- Trigger `trg_states_updated_at`

`cities`:
- Colunas `lat`, `lng` como NUMERIC(10,7)
- 4 CHECK constraints (`cities_lat_range`, `cities_lng_range`, `cities_latlng_paired`, mais o UNIQUE)
- Coluna `name_normalized` GENERATED

`neighborhoods`:
- 7 colunas (neighborhood_id, city_id, name, name_normalized, is_active, created_at, updated_at)
- FK para `cities(city_id)`

---

### Etapa 9 — Smoke test (insert + verificar GENERATED COLUMN)

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
-- Cadastrar Brasil de teste
INSERT INTO countries (iso_alpha2, iso_alpha3, name, currency_code, timezone_default)
VALUES ('BR', 'BRA', 'Brasil', 'BRL', 'America/Sao_Paulo')
RETURNING country_id, iso_alpha2, name;

-- Cadastrar PR de teste
INSERT INTO states (country_id, iso_3166_2, external_code, name, abbreviation)
SELECT country_id, 'BR-PR', '41', 'Paraná', 'PR'
FROM countries WHERE iso_alpha2 = 'BR'
RETURNING state_id, name, name_normalized;

-- Validar GENERATED COLUMN: name_normalized deve ser 'parana'
SELECT name, name_normalized FROM states WHERE abbreviation = 'PR';

-- Tentar inserir 'PARANÁ' duplicado (deve falhar com violacao de UNIQUE)
INSERT INTO states (country_id, iso_3166_2, name, abbreviation)
SELECT country_id, 'BR-PR2', 'PARANÁ', 'PR2'
FROM countries WHERE iso_alpha2 = 'BR';
"
```

Esperado:
- Brasil insere com sucesso
- Paraná insere com `name_normalized` = `parana` (auto-gerado)
- Segunda tentativa de Paraná **deve falhar** com `duplicate key value violates unique constraint "states_country_name_unique"` — isso valida que a defesa anti-duplicata funciona.

---

### Etapa 10 — Limpar dados de teste

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
DELETE FROM states WHERE abbreviation = 'PR';
DELETE FROM countries WHERE iso_alpha2 = 'BR';
SELECT COUNT(*) AS countries_count FROM countries;
SELECT COUNT(*) AS states_count FROM states;
"
```

Esperado: zero em ambas. Tabelas limpas, prontas para o seed real em F3-S5.

---

### Etapa 11 — Rodar gates CI

```powershell
cd C:\unificard\backend
pnpm run validate:actor-writer-boundaries 2>&1 | Select-Object -Last 2
pnpm run validate:bank-ledger-boundaries 2>&1 | Select-Object -Last 2
pnpm run validate:regression-guards 2>&1 | Select-Object -Last 2
node C:\unificard\scripts\validate-architectural-patterns.mjs --strict 2>&1 | Select-Object -Last 5
```

Esperado: 4/4 PASS. Migration nova não toca código TS, então gates de boundaries não devem detectar nada novo.

---

### Etapa 12 — Commit

```powershell
cd C:\unificard
git status --short | Where-Object { $_ -match "20260530516000|migrations" }
```

Esperado: 1 linha — `?? backend/migrations/20260530516000_create_location_core_administrative.sql`.

```powershell
git add backend/migrations/20260530516000_create_location_core_administrative.sql
git diff --cached --stat
```

Esperado: 1 file changed, ~290 insertions, 0 deletions.

```powershell
$msg = @"
feat(location-core): F3-S4 cria base administrativa (countries/states/cities/neighborhoods)

Materializa primeira camada de DECISION-0020 (Location Core como infraestrutura
territorial soberana). Resgata plano de migrations_archive/0360-0361 com schema
atualizado para escala planetaria incremental.

Tabelas criadas:
- countries (catalogo global, iso_alpha2 UNIQUE, name_localized JSONB)
- states (FK countries, external_code, name_normalized GENERATED, UNIQUE
  por country)
- cities (FK states, lat/lng NUMERIC(10,7) opcional, CHECK lat-lng paired)
- neighborhoods (FK cities, sem lat/lng - poligono fica para futuro)

Helpers institucionais:
- update_updated_at_column(): trigger function canonica
- normalize_name(text): lower(unaccent()) IMMUTABLE para uso em
  GENERATED COLUMN. Defesa estrutural anti-duplicata
  (Sao Paulo / SAO PAULO / sao paulo -> mesma chave).

Decisoes de design (alem de DECISION-0020):
- name_normalized como GENERATED ALWAYS AS ... STORED
  (impossivel inserir errado, indexavel)
- ON DELETE RESTRICT em FKs (defesa contra delecao acidental)
- Indices parciais WHERE is_active = TRUE (eficiencia)
- CHECK lat-lng range e paired-or-null

Sem RLS: catalogo global, nao multi-tenant.
Sem dados: seed Brasil entra em F3-S5.
Sem codigo TS: integracao via location.repository entra em F3-S6+.

Proxima sessao: F3-S5 (seed Brasil - 27 estados + capitais + IBGE codes).
"@
[System.IO.File]::WriteAllText("$env:TEMP\commit-msg-f3s4.txt", $msg)
git commit -F "$env:TEMP\commit-msg-f3s4.txt"
```

Esperado:
```
[rescue-structural <hash>] feat(location-core): F3-S4 cria base administrativa
 1 file changed, ~290 insertions(+)
 create mode 100644 backend/migrations/20260530516000_create_location_core_administrative.sql
```

---

### Etapa 13 — Validação final

```powershell
git log --oneline -5
```

Esperado:
```
<hash novo>  feat(location-core): F3-S4 cria base administrativa ...
2f7969f0     docs(f3-evidencias): consolida relatorios externos ...
41b02440     docs(decisions+status): DECISION-0020 Location Core ...
8e28a951     docs(status): registra Sessao 3 abortada ...
8a47369c     fix(core/profile): corrige timestamp camelCase ...
```

---

## Tempo estimado

10-15 minutos se tudo correr liso. 30 minutos se houver erro a investigar.

## Se algo der errado

| Sintoma | Diagnóstico provável | Ação |
|---|---|---|
| `extension "unaccent" is not available` | Postgres sem contrib instalado | Instalar `postgresql-contrib` |
| `function gen_random_uuid() does not exist` | pgcrypto não habilitado, mas migration cria | Ignorar — a migration habilita |
| `duplicate_object` em FUNCTION | Função já existe (ok, `CREATE OR REPLACE` resolve) | Ignorar |
| `relation "countries" already exists` | Migration já rodou parcialmente antes | Investigar — pode precisar `DROP TABLE` cascateado |

Em qualquer dúvida, parar e me avisar com o erro exato.

## Próxima sessão (F3-S5)

Seed Brasil:
- 1 país (BR)
- 27 estados (com siglas, IBGE codes, ISO 3166-2)
- 27 capitais (mínimo) ou ~5570 municípios (decisão a tomar em F3-S5)

Decisão pendente para F3-S5: seed completo (5570 cidades BR) ou só capitais inicialmente, expandindo conforme demanda?
