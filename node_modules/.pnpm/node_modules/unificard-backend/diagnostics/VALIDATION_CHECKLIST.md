# Checklist de Validação - Saúde e Aprendizado

## Objetivo
Validar que as correções de rota e a conexão de categorias estão funcionando corretamente.

---

## Pré-requisitos
- Backend rodando e acessível
- Frontend rodando e acessível
- Token de autenticação válido (Bearer token)

---

## PASSO 1: Validar Rotas de Saúde (Fix Principal)

### 1.1 Teste GET /profile/health/declarations

```bash
curl -X GET "http://localhost:3000/profile/health/declarations" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-id: SEU_TENANT_ID_AQUI" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
- Status: `200 OK`
- Body: `{ "ok": true, "data": [] }` (ou array com declarações se houver)

**Se falhar:**
- Verificar se o backend está rodando
- Verificar se o token é válido
- Verificar se o tenant_id está correto
- Verificar logs do backend para erro específico

### 1.2 Teste POST /profile/health/declarations

```bash
curl -X POST "http://localhost:3000/profile/health/declarations" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-id: SEU_TENANT_ID_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "declarationText": "Teste de autodeclaração",
    "notes": "Teste de validação",
    "consent": true
  }'
```

**Resultado esperado:**
- Status: `201 Created`
- Body: `{ "ok": true, "data": { "id": "...", "declarationText": "...", ... } }`

**Validações:**
- Se `consent: false` → deve retornar `400 Bad Request` com mensagem de erro
- Se `declarationText` vazio → deve retornar `400 Bad Request`

### 1.3 Teste DELETE /profile/health/declarations/:id

```bash
# Primeiro, crie uma declaração e anote o ID retornado
# Depois execute:
curl -X DELETE "http://localhost:3000/profile/health/declarations/DECLARATION_ID_AQUI" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-id: SEU_TENANT_ID_AQUI"
```

**Resultado esperado:**
- Status: `200 OK`
- Body: `{ "ok": true, "message": "Declaração removida com sucesso" }`

---

## PASSO 2: Validar Aprendizado (Conexão de Categorias)

### 2.1 Teste GET /categories/tree?context=learning

```bash
curl -X GET "http://localhost:3000/categories/tree?context=learning" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-id: SEU_TENANT_ID_AQUI" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
- Status: `200 OK`
- Body: `{ "ok": true, "data": [...] }` com array de categorias raiz de `scope='learning'`
- Cada categoria deve ter `scope: "learning"` (ou `scope: null` se for categoria antiga)

**Validações:**
- Verificar que TODAS as categorias retornadas têm `scope='learning'` (ou são globais)
- Verificar que NÃO há categorias de `scope='professional'` ou outros scopes
- Verificar que há pelo menos algumas categorias raiz (level 0)

### 2.2 Teste GET /categories/tree?context=professional

```bash
curl -X GET "http://localhost:3000/categories/tree?context=professional" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "x-tenant-id: SEU_TENANT_ID_AQUI" \
  -H "Content-Type: application/json"
```

**Resultado esperado:**
- Status: `200 OK`
- Body com categorias de `scope='professional'` ou `scope='global'`
- NÃO deve conter categorias de `scope='learning'`

### 2.3 Validar Cache (Opcional)

Execute duas vezes o mesmo request com `context=learning` e verifique nos logs do backend:
- Primeira chamada: deve buscar do banco
- Segunda chamada (dentro do TTL): deve retornar do cache
- Cache deve ser chaveado por `(countryCode, context)` - não deve vazar entre contexts

---

## PASSO 3: Auditoria SQL (Detectar Duplicidades)

### 3.1 Executar Scripts de Auditoria

Execute cada query do arquivo `backend/diagnostics/AUDIT_CATEGORIES_DUPLICATES.sql`:

```bash
# Exemplo usando psql:
psql -U seu_usuario -d seu_banco -f backend/diagnostics/AUDIT_CATEGORIES_DUPLICATES.sql
```

**Resultados esperados:**
- Query (1): Deve retornar 0 linhas (sem duplicidade por slug+country_code)
- Query (2): Deve retornar 0 linhas (sem duplicidade semântica)
- Query (3): Pode retornar linhas (slug repetido em scopes diferentes é permitido, mas pode indicar problema)
- Query (4): Deve retornar pelo menos algumas categorias para `learning` e `professional`
- Query (5): Deve retornar pelo menos algumas raízes para cada scope
- Query (6): Deve retornar 0 linhas (sem inconsistência path/level)
- Query (7): Deve retornar 0 linhas (sem vazamento estrutural)
- Query (8): Deve retornar 0 linhas (sem categorias órfãs)
- Query (9): Fornece visão geral (verificar números razoáveis)

### 3.2 Executar Auditoria do Módulo de Saúde

Execute o arquivo `backend/diagnostics/AUDIT_HEALTH_MODULE.sql`:

```bash
psql -U seu_usuario -d seu_banco -f backend/diagnostics/AUDIT_HEALTH_MODULE.sql
```

**Resultados esperados:**
- Query (1): Deve retornar `health_declarations` (tabela existe)
- Query (2): Deve listar todas as colunas esperadas
- Query (3): Deve retornar constraint CHECK para `consent = true`
- Query (4): Deve listar índices criados
- Query (5): Pode retornar 0 ou mais declarações (depende se há dados)

---

## PASSO 4: Validação na UI

### 4.1 Aba Saúde
1. Abrir a aba "Saúde" no frontend
2. Verificar que não aparece erro "Route not found"
3. Verificar que o formulário de autodeclaração aparece
4. Tentar criar uma declaração:
   - Sem consentimento → deve mostrar erro
   - Com consentimento → deve salvar com sucesso
5. Verificar que a declaração aparece na lista
6. Tentar remover a declaração → deve funcionar

### 4.2 Aba Aprendizado
1. Abrir a aba "Aprendizado" no frontend
2. Verificar que a árvore de categorias carrega
3. Verificar que aparecem categorias de aprendizado
4. Verificar que NÃO aparecem categorias de profissional ou outros scopes
5. Verificar que é possível navegar pela árvore
6. Verificar que é possível adicionar aprendizados

---

## Problemas Comuns e Soluções

### Erro: "Route GET:/profiles/health/declarations not found"
**Causa:** Frontend ainda usando `/profiles/` ao invés de `/profile/`
**Solução:** Verificar se `frontend/src/api/health.ts` foi atualizado

### Erro: "Consentimento é obrigatório"
**Causa:** Frontend não está enviando `consent: true`
**Solução:** Verificar se o checkbox de consentimento está marcado

### Categorias vazias ou erradas na aba Aprendizado
**Causa:** 
- Seed não rodou
- Conflito de slug impediu inserts
- Filtro de scope não está funcionando
**Solução:** 
- Executar auditoria SQL (PASSO 3)
- Verificar logs do backend
- Verificar se há categorias no banco com `scope='learning'`

### Cache vazando entre contexts
**Causa:** Cache não está chaveado por context
**Solução:** Verificar `categories.service.ts` - cache deve incluir `context` na chave

---

## Entregáveis Esperados

Após executar este checklist, você deve ter:
1. ✅ Rotas de saúde funcionando (`/profile/health/declarations`)
2. ✅ Categorias de aprendizado filtradas corretamente (`context=learning`)
3. ✅ Relatório SQL de auditoria (resultados das queries)
4. ✅ UI funcionando sem erros

---

## Notas Finais

- Se encontrar duplicidades nas queries SQL, consulte o playbook de remediação
- Se encontrar problemas de cache, verificar TTL e chaveamento
- Se encontrar vazamento estrutural (query 7), corrigir parent_id das categorias afetadas
- Sempre documentar problemas encontrados e soluções aplicadas





