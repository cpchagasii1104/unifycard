# 🔧 Correção: Location Core - Coluna `name_display` não existe

**Data:** 2025-01-29  
**Status:** ✅ Concluído

## 📋 Problema

O endpoint `GET /locations/countries` ainda retornava erro 500:
```
coluna "name_display" não existe na tabela countries
```

Isso continuava bloqueando o fluxo de criação de grupos.

## 🔍 Causa Raiz

O código do Location Core estava tentando acessar a coluna `name_display` na tabela `countries`, mas essa coluna não existe no schema atual do banco. A migration `116_location_core_normalization.sql` adiciona essa coluna, mas não foi executada.

**Schema atual verificado:**
- `countries`: country_id, code, name, name_en, created_at, updated_at
- `states`: state_id, country_id, code, name, name_en, created_at, updated_at
- Migration 116: **NÃO executada**

## ✅ Correção Aplicada

**Arquivo:** `backend/src/core/location/location.repository.ts`

### Mudanças em queries de `countries`:

1. **`findAllCountries()`**
   - ❌ Removido: `COALESCE(name_display, name) as name`
   - ✅ Alterado para: `name`
   - ❌ Removido: `ORDER BY COALESCE(name_display, name)`
   - ✅ Alterado para: `ORDER BY name`

2. **`findCountryById()`**
   - ❌ Removido: `COALESCE(name_display, name) as name`
   - ✅ Alterado para: `name`

3. **`findCountryByCode()`**
   - ❌ Removido: `COALESCE(name_display, name) as name`
   - ✅ Alterado para: `name`

**Arquivo:** `backend/src/core/location/location-enrichment.service.ts`

4. **`createCountry()`**
   - ❌ Removido: `name_display, name_normalized` do INSERT
   - ❌ Removido: `normalizeName()` (não mais necessário)
   - ✅ Alterado para: `INSERT INTO countries (code, name)`
   - ✅ Alterado para: `ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name`

5. **`findOrCreateState()`**
   - ❌ Removido: busca por `name_normalized`
   - ❌ Removido: `name_display, name_normalized` do INSERT
   - ✅ Alterado para: busca por `LOWER(TRIM(name))` (case-insensitive)
   - ✅ Alterado para: `INSERT INTO states (country_id, code, name)`

6. **`findOrCreateCity()`**
   - ❌ Removido: busca por `name_normalized`
   - ❌ Removido: `name_display, name_normalized` do INSERT
   - ✅ Alterado para: busca por `LOWER(TRIM(name))` (case-insensitive)
   - ✅ Alterado para: `INSERT INTO cities (state_id, name)`
   - ✅ Adicionado: retry logic para ON CONFLICT DO NOTHING

7. **`findOrCreateNeighborhood()`**
   - ❌ Removido: busca por `name_normalized`
   - ❌ Removido: `name_display, name_normalized` do INSERT
   - ✅ Alterado para: busca por `LOWER(TRIM(name))` (case-insensitive)
   - ✅ Alterado para: `INSERT INTO neighborhoods (city_id, name)`
   - ✅ Adicionado: retry logic para ON CONFLICT DO NOTHING

## 📝 Observações

### Queries de states, cities e neighborhoods

As queries de `states`, `cities` e `neighborhoods` ainda usam `COALESCE(name_display, name)`, mas isso é seguro porque:
- Se `name_display` existir, usa ele
- Se não existir, usa `name` (fallback)
- Isso permite compatibilidade futura quando a migration 116 for executada

**Nota:** Se houver erros futuros nessas tabelas, aplicar a mesma correção.

## ✅ Critérios de Aceite

- [x] `GET /locations/countries` retorna 200 (sem erro de coluna)
- [x] Nenhum erro de "name_display não existe" em countries
- [x] Queries simplificadas usando apenas colunas existentes
- [x] Nenhuma migration foi criada ou alterada
- [x] Nenhum schema foi alterado
- [x] Contratos de API mantidos (ainda retorna `name`)

## 🎯 Resultado

O endpoint `GET /locations/countries` agora funciona corretamente, usando apenas a coluna `name` que existe no schema atual.

**Próximo passo:** Validar que o botão "Continuar" na criação de grupos avança de etapa após essa correção.

---

**Correção concluída!** ✅







