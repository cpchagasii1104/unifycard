# Auditoria — API Client Tenant Invariant Enforcement

**Data:** 2024-12-19  
**Status:** ✅ AUDITORIA COMPLETA E CORREÇÕES APLICADAS

## Objetivo

Transformar `tenantId` em invariante absoluta no `apiFetch`, garantindo que nenhuma request autenticada prossiga sem `tenantId` válido.

## Garantias Implementadas

### 1. tenantId é INVARIANTE ABSOLUTA

**Implementação:**
- `tenantId` é OBRIGATÓRIO após autenticação
- JWT é a fonte única de verdade
- Storage é apenas cache (nunca fonte primária)
- Nenhuma request autenticada pode prosseguir sem `tenantId` válido

**Localização:** `frontend/src/api/client.ts` (linhas 114-170)

### 2. JWT Fallback Ocorre UMA VEZ

**Implementação:**
- FASE 1: Tentar obter do storage (cache)
- FASE 2: Se não estiver no storage E houver token, extrair do JWT (UMA VEZ)
- Após extrair e salvar, nunca re-extrai (storage é atualizado imediatamente)
- Próximas requisições usam storage (cache)

**Localização:** `frontend/src/api/client.ts` (linhas 118-154)

### 3. Erro Explícito em Estado Inválido

**Implementação:**
- Erro fatal se `tenantId` não puder ser extraído do JWT
- Erro fatal se `tenantId` for inválido (não string ou vazio)
- Erro fatal se não houver `tenantId` após tentativas
- Código de erro: `MISSING_TENANT`
- Status HTTP: 400
- Detalhes incluídos no erro para diagnóstico

**Localização:** `frontend/src/api/client.ts` (linhas 141-166)

### 4. Logs Ambíguos Eliminados

**Implementação:**
- Logs apenas em desenvolvimento (`import.meta.env.DEV`)
- Logs apenas para endpoints específicos (diagnóstico)
- Eliminados logs verbosos e ambíguos
- Mensagens de erro claras e explícitas

**Localização:** `frontend/src/api/client.ts` (linhas 137-140, 177-182, 230-238)

## Fluxo de Execução

### Ordem Determinística:

1. **FASE 1: Obter do Storage (Cache)**
   - `tenantId = getTenantId()`
   - Se presente, usar imediatamente

2. **FASE 2: Extrair do JWT (UMA VEZ)**
   - Se `tenantId` ausente E `token` presente:
     - Extrair `tenantId` do JWT
     - Validar (string não vazia)
     - Salvar no storage imediatamente
     - Próximas requisições usam storage

3. **FASE 3: Validação Final**
   - Se `tenantId` ainda ausente após tentativas:
     - Lançar erro fatal `TENANT_ID_REQUIRED`
     - Não continuar requisição

4. **FASE 4: Enviar Header**
   - `headers['x-tenant-id'] = tenantId`
   - Garantido que `tenantId` é válido

## Pontos de Validação

### ✅ apiFetch() - Extração de tenantId

1. **Linha 118:** Tentar obter do storage (cache)
2. **Linha 123-154:** Extrair do JWT se ausente (UMA VEZ)
3. **Linha 129-131:** Validação explícita (string não vazia)
4. **Linha 135-136:** Salvar no storage imediatamente
5. **Linha 141-152:** Erro fatal se extração falhar
6. **Linha 158-166:** Erro fatal se `tenantId` ainda ausente
7. **Linha 170:** Garantia final - sempre enviar header

### ✅ apiFetch() - Tratamento de 401

1. **Linha 285-288:** Validação de autenticação
2. **Comentário explícito:** `tenantId` já validado acima (invariante)

### ✅ Logs

1. **Linha 137-140:** Log apenas em desenvolvimento
2. **Linha 177-182:** Log diagnóstico apenas em desenvolvimento
3. **Linha 230-238:** Log de erro apenas em desenvolvimento

## Proibições Explícitas

### ❌ NÃO permitido:
- Continuar requisição sem `tenantId` válido
- Re-extrair `tenantId` do JWT após salvar no storage
- Logs verbosos em produção
- Fallback silencioso para estado inválido

### ✅ Permitido:
- Extrair `tenantId` do JWT uma vez (se ausente no storage)
- Salvar `tenantId` no storage após extração (cache)
- Logs apenas em desenvolvimento (diagnóstico)
- Erro fatal explícito em estado inválido

## Critérios de Sucesso

### ✅ Nenhuma request autenticada sem tenantId
- Guard explícito antes de enviar header
- Erro fatal se `tenantId` ausente
- Validação em múltiplos pontos

### ✅ JWT fallback só ocorre uma vez
- Extração apenas se `tenantId` ausente no storage
- Salvar imediatamente após extração
- Próximas requisições usam storage (cache)

### ✅ Erro explícito em estado inválido
- Código de erro: `MISSING_TENANT`
- Status HTTP: 400
- Detalhes incluídos para diagnóstico
- Mensagem clara: `TENANT_ID_REQUIRED`

### ✅ Logs ambíguos eliminados
- Logs apenas em desenvolvimento
- Logs apenas para endpoints específicos
- Mensagens de erro claras e explícitas

## Conclusão

**✅ API Client Tenant Invariant Enforcement PASSOU**

Todas as garantias foram implementadas:
- `tenantId` é invariante absoluta (obrigatória após autenticação)
- JWT fallback ocorre apenas uma vez
- Erro explícito em estado inválido
- Logs ambíguos eliminados

**Status Final:** ✅ AUDITORIA PASSOU - `tenantId` é invariante absoluta no `apiFetch`




