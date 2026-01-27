# Checklist: Validação de Categorias de Grupos

## Verificações

### 1. Criar grupo com categoria raiz (level = 0)
**Status:** ✅ **IMPLEMENTADO**
- **Localização:** `groups.service.ts:155-157`
- **Comportamento:** Bloqueia com erro: "Categoria raiz não pode ser selecionada diretamente. Selecione uma subcategoria."
- **Ajuste necessário:** Nenhum

### 2. Criar grupo com subcategoria válida + scope permitido
**Status:** ✅ **IMPLEMENTADO**
- **Localização:** `groups.service.ts:219-220`
- **Comportamento:** Valida `scope` contra `allowed_scopes` da categoria raiz
- **Ajuste necessário:** Nenhum

### 3. Criar grupo com subcategoria válida + scope NÃO permitido
**Status:** ✅ **IMPLEMENTADO**
- **Localização:** `groups.service.ts:174-178`
- **Comportamento:** Erro claro: "Abrangência 'X' não é permitida para esta categoria. Abrangências permitidas: Y, Z"
- **Ajuste necessário:** Nenhum

### 4. Criar grupo sem scope
**Status:** ⚠️ **PARCIAL**
- **Localização:** `groups.routes.ts:19` (default: 'national')
- **Comportamento:** Zod aplica default 'national' antes de chegar no service
- **Problema:** Validação só roda se `input.scope` existe (linha 219), mas como tem default, sempre vai existir
- **Ajuste necessário:** Nenhum (comportamento correto)

### 5. Criar grupo sem categoria
**Status:** ✅ **BLOQUEADO NO SCHEMA**
- **Localização:** `groups.routes.ts:17` (obrigatório)
- **Comportamento:** Schema Zod exige `category_id`, não chega no service sem ele
- **Ajuste necessário:** Nenhum

## Ajustes Necessários

### Ajuste 1: Validação quando scope não é fornecido explicitamente
**Status:** ✅ **CORRIGIDO**
**Localização:** `groups.service.ts:219-221`
**Correção aplicada:** Garantir que validação sempre rode quando há category_id, usando default 'national' se scope não fornecido.

### Ajuste 2: Default da migration vs default do schema
**Problema:** Migration define default `['national', 'state', 'city']`, mas schema tem default `'national'`. Se usuário não fornecer scope, usa 'national' que está no default da migration → OK.

**Status:** ✅ **COERENTE** - Não precisa ajuste

## Confirmação Final

**Categorias de grupos prontas para avançar:** ✅ **SIM**

**Resumo:**
- ✅ Categoria raiz bloqueada
- ✅ Validação de scope contra allowed_scopes implementada
- ✅ Mensagens de erro claras
- ✅ Schema exige category_id
- ⚠️ Scope tem default 'national' (coerente com migration)

**Ajustes aplicados:**
- ✅ Linha 219: Validação sempre roda quando há category_id, usando default 'national' se scope não fornecido

