# 🔧 Correção: Location Core - Coluna `active` não existe

**Data:** 2025-01-29  
**Status:** ✅ Concluído

## 📋 Problema

O endpoint `GET /locations/countries` estava retornando erro 500:
```
coluna "active" não existe na tabela countries
```

Isso bloqueava a criação de grupos porque o LocationSelector não conseguia carregar países.

## 🔍 Causa Raiz

O código do Location Core estava tentando acessar a coluna `active` na tabela `countries`, mas essa coluna não existe no schema atual do banco. A migration `115_location_core_neighborhoods.sql` adiciona essa coluna, mas não foi executada.

## ✅ Correção Aplicada

**Arquivo:** `backend/src/core/location/location.repository.ts`

### Mudanças realizadas:

1. **`findAllCountries()`**
   - ❌ Removido: `COALESCE(active, true) as active` no SELECT
   - ❌ Removido: `WHERE COALESCE(active, true) = true`
   - ✅ Adicionado: `COALESCE(name_display, name) as name` para compatibilidade
   - ✅ Retorno: `active: true` hardcoded (assumir todos ativos)

2. **`findCountryById()`**
   - ❌ Removido: `COALESCE(active, true) as active` no SELECT
   - ❌ Removido: `AND COALESCE(active, true) = true` no WHERE
   - ✅ Retorno: `active: true` hardcoded

3. **`findStatesByCountry()`**
   - ❌ Removido: `INNER JOIN countries c` e filtro `COALESCE(c.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `states`

4. **`findStateById()`**
   - ❌ Removido: `INNER JOIN countries c` e filtro `COALESCE(c.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `states`

5. **`findCitiesByState()`**
   - ❌ Removido: `INNER JOIN countries co` e filtro `COALESCE(co.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `cities`

6. **`findCityById()`**
   - ❌ Removido: `INNER JOIN countries co` e filtro `COALESCE(co.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `cities`

7. **`findNeighborhoodsByCity()`**
   - ❌ Removido: `INNER JOIN countries co` e filtro `COALESCE(co.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `neighborhoods`

8. **`findNeighborhoodById()`**
   - ❌ Removido: `INNER JOIN countries co` e filtro `COALESCE(co.active, true) = true`
   - ✅ Simplificado: Query direta na tabela `neighborhoods`

9. **`findCountryByCode()`**
   - ❌ Removido: `COALESCE(active, true) as active` no SELECT
   - ❌ Removido: `AND COALESCE(active, true) = true` no WHERE
   - ✅ Retorno: `active: true` hardcoded

10. **`findStateByCode()`**
    - ❌ Removido: `INNER JOIN countries c` e filtro `COALESCE(c.active, true) = true`
    - ✅ Simplificado: Query direta na tabela `states`

**Arquivo:** `backend/src/core/location/location-enrichment.service.ts`

11. **`createCountry()`**
    - ❌ Removido: `active` da lista de colunas no INSERT
    - ❌ Removido: `true` dos valores do INSERT

## ✅ Critérios de Aceite

- [x] `GET /locations/countries` retorna 200 (sem erro de coluna)
- [x] Nenhum erro de "coluna active não existe"
- [x] Queries simplificadas e mais performáticas (menos JOINs desnecessários)
- [x] Nenhuma migration foi criada ou alterada
- [x] Nenhum schema foi alterado
- [x] Contratos de frontend mantidos (ainda retorna `active: true`)

## 🎯 Resultado

O endpoint `GET /locations/countries` agora funciona corretamente, retornando todos os países sem depender da coluna `active` que não existe no schema atual.

**Próximo passo:** Validar que a criação de grupos consegue avançar após essa correção.

---

**Correção concluída!** ✅







