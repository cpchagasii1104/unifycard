# 🔴 DIAGNÓSTICO: Erro 500 em /bank/regional-fund

**Data:** 26/12/2025  
**Endpoint:** `GET /bank/regional-fund?limit=1&offset=0`  
**Status:** 500 Internal Server Error

---

## ✅ O QUE ESTÁ FUNCIONANDO

| Componente | Status |
|------------|--------|
| Schema Guard | ✅ OK |
| Login/Auth | ✅ OK |
| Session Bootstrap | ✅ OK |
| JWT | ✅ OK |
| token_version | ✅ OK |

---

## 🔴 CAUSA RAIZ IDENTIFICADA

### Cadeia de Chamadas

```
GET /bank/regional-fund
    │
    └── transparency.routes.ts (linha 164)
        │
        └── transparencyService.getUserRegionalFund()
            │
            └── regionAccountService.resolveRegionAccountId()
                │
                ├── tenantService.getTenantById(tenantId)
                │   └── tenant.cityId → NULL (não configurado)
                │
                └── Se cityId não existe:
                    │
                    └── ERRO: "Region not found for tenant ${tenantId}.
                              Configure cityId in tenant or provide 
                              userId/jobId with location."
```

### Código que Lança o Erro

**Arquivo:** `backend/src/core/economy/region-account.service.ts`  
**Linhas:** 91-118

```typescript
if (!regionId) {
  if (process.env.NODE_ENV === 'test') {
    return undefined; // OK em teste
  }
  
  // EM PRODUÇÃO: ERRO EXPLÍCITO
  const error = new Error(
    `Region not found for tenant ${tenantId}. Configure cityId in tenant...`
  );
  throw error;  // ← CAUSA DO 500
}
```

---

## 🧩 DEPENDÊNCIAS NECESSÁRIAS

Para o endpoint `/bank/regional-fund` funcionar, é necessário:

### 1. Tabelas de Geografia Populadas

```sql
-- Essas tabelas precisam ter dados:
countries   → pelo menos 1 país (ex: Brasil)
states      → pelo menos 1 estado (ex: Paraná)
cities      → pelo menos 1 cidade (ex: Curitiba)
```

### 2. Tenant com city_id Configurado

```sql
-- O tenant precisa ter city_id definido:
UPDATE tenants 
SET city_id = '<uuid-da-cidade>'
WHERE tenant_id = '<seu-tenant-id>';
```

---

## 🛠️ SOLUÇÕES

### Opção A: Popular Dados de Geografia (RECOMENDADA)

Criar uma migration ou script que:
1. Insere país Brasil
2. Insere estado Paraná  
3. Insere cidade Curitiba
4. Atualiza o tenant com o city_id

### Opção B: Tornar Regional Fund Opcional

Modificar o código para retornar resposta vazia em vez de erro quando não há região configurada:

**Arquivo:** `region-account.service.ts`

```typescript
// ANTES (quebra)
if (!regionId) {
  throw new Error(`Region not found...`);
}

// DEPOIS (gracioso)
if (!regionId) {
  return undefined; // Permite continuar sem região
}
```

**Arquivo:** `transparency.routes.ts`

```typescript
// ANTES
if (!result) {
  return reply.status(404).send({ error: 'Regional fund not found' });
}

// DEPOIS (mais informativo)
if (!result) {
  return reply.status(200).send({
    success: true,
    regionalFund: null,
    message: 'No regional fund configured for this user',
  });
}
```

---

## 📋 PROMPT PARA CURSOR (Opção A - Popular Dados)

```markdown
CONTEXTO
O endpoint GET /bank/regional-fund está retornando erro 500 porque:
1. O tenant não tem city_id configurado
2. As tabelas de geografia (countries, states, cities) estão vazias

OBJETIVO
Criar migration para popular dados de geografia e configurar o tenant padrão.

TAREFAS

1️⃣ Criar arquivo:
backend/migrations/090_seed_world_geography_brazil.sql

Conteúdo:
- Inserir país Brasil (code: 'BR')
- Inserir estado Paraná (code: 'PR')  
- Inserir cidade Curitiba
- Usar INSERT ... ON CONFLICT DO NOTHING para idempotência

2️⃣ Criar arquivo:
backend/migrations/091_configure_tenant_city.sql

Conteúdo:
- Atualizar tenant principal com city_id da cidade criada
- Usar subquery para buscar city_id dinamicamente

RESULTADO ESPERADO
- Após executar npm run migrate
- GET /bank/regional-fund deve retornar dados (ou array vazio) sem erro 500
```

---

## 📋 PROMPT PARA CURSOR (Opção B - Tornar Opcional)

```markdown
CONTEXTO
O endpoint GET /bank/regional-fund está retornando erro 500 porque o sistema
exige configuração de região, mas isso é opcional para muitos casos de uso.

OBJETIVO  
Tornar a configuração de região opcional, retornando resposta vazia em vez de erro.

TAREFAS

1️⃣ Modificar arquivo:
backend/src/core/economy/region-account.service.ts

Na função resolveRegionAccountId(), linhas ~91-118:
- REMOVER o throw new Error quando regionId não existe
- RETORNAR undefined (como já faz em modo test)
- Manter apenas o log de warning

2️⃣ Modificar arquivo:
backend/src/core/unifybank/transparency.routes.ts

No handler GET /regional-fund (linha ~164):
- Quando result for null, retornar 200 com mensagem informativa
- NÃO retornar 404 ou 500

REGRAS
- NÃO alterar outras partes do código
- NÃO criar novas migrations
- Manter compatibilidade com casos onde região ESTÁ configurada

RESULTADO ESPERADO
- GET /bank/regional-fund sem região → 200 com { regionalFund: null }
- GET /bank/regional-fund com região → 200 com dados normais
```

---

## ⚡ COMANDO RÁPIDO DE DIAGNÓSTICO

Execute no PostgreSQL para verificar o estado atual:

```sql
-- 1. Verificar se tabelas de geografia existem
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('countries', 'states', 'cities');

-- 2. Verificar se têm dados
SELECT 'countries' as table_name, COUNT(*) FROM countries
UNION ALL
SELECT 'states', COUNT(*) FROM states
UNION ALL
SELECT 'cities', COUNT(*) FROM cities;

-- 3. Verificar city_id do tenant
SELECT tenant_id, name, slug, city_id FROM tenants LIMIT 5;
```

---

## 🎯 CONCLUSÃO

| Item | Status |
|------|--------|
| Tipo de erro | Dependência de dados não populados |
| Causa raiz | Tenant sem city_id + tabelas geography vazias |
| Impacto | Apenas endpoint /bank/regional-fund |
| Solução recomendada | Opção A (popular dados) OU Opção B (tornar opcional) |

**Este erro NÃO tem relação com:**
- Schema Guard ✅
- token_version ✅
- Login/Auth ✅
- Migrations estruturais ✅

É puramente um problema de **dados de configuração** ausentes.
