# Forensics Dry-Run Pass

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Provar que o sistema de forensics funciona na prática, executando uma reconstrução real de incidente usando **apenas logs**, sem acesso ao banco de dados ou código.

## Cenário Simulado

**Incidente de Segurança:**
- Usuário `user-123` do tenant `tenant-A` tenta acessar recurso `resource-789` do tenant `tenant-B`
- Sistema detecta violação cross-tenant
- Permission denied
- Token invalidado como medida de segurança

## Script de Simulação

**Arquivo:** `backend/scripts/simulate-forensics-incident.ts`

**Uso:**
```bash
cd backend
pnpm simulate:forensics-incident
```

**Funcionalidade:**
- Simula um incidente completo de segurança
- Gera logs canônicos com todos os IDs de correlação
- Fornece IDs para reconstrução (`requestId`, `correlationId`)

## Logs Gerados

### Log 1: Tentativa de Acesso
```json
{
  "level": "info",
  "message": "[CANONICAL] Tentativa de acesso a recurso",
  "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
  "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
  "tenantId": "tenant-A",
  "userId": "user-123",
  "actorId": "actor-456",
  "resourceId": "resource-789",
  "targetTenantId": "tenant-B"
}
```

### Log 2: Cross-Tenant Violation
```json
{
  "level": "abuse",
  "message": "[CANONICAL] 🚫 ABUSO: Cross-tenant violation: tenantId do token não corresponde ao recurso",
  "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
  "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
  "tenantId": "tenant-A",
  "userId": "user-123",
  "actorId": "actor-456",
  "tenantIdFromToken": "tenant-A",
  "tenantIdFromResource": "tenant-B",
  "resourceId": "resource-789"
}
```

### Log 3: Permission Denied
```json
{
  "level": "authzDeny",
  "message": "[CANONICAL] 🚫 AUTHZ DENY: Permissão negada: Cross-tenant access attempt",
  "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
  "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
  "tenantId": "tenant-A",
  "userId": "user-123",
  "actorId": "actor-456",
  "permissionKey": "resource:read",
  "resourceId": "resource-789",
  "targetTenantId": "tenant-B",
  "reason": "Cross-tenant access attempt blocked"
}
```

### Log 4: Token Invalidation
```json
{
  "level": "invalidation",
  "message": "[CANONICAL] 🔄 INVALIDAÇÃO: Token invalidation: Tentativa suspeita detectada",
  "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
  "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
  "tenantId": "tenant-A",
  "userId": "user-123",
  "actorId": "actor-456",
  "previousTokenVersion": 5,
  "newTokenVersion": 6,
  "reason": "Cross-tenant access attempt - security measure"
}
```

### Log 5: Login Failure
```json
{
  "level": "warn",
  "message": "[CANONICAL] ⚠️ Login failure: Token invalidation detectada",
  "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
  "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
  "tenantId": "tenant-A",
  "userId": "user-123",
  "actorId": "actor-456",
  "tokenVersionFromToken": 5,
  "tokenVersionFromDB": 6,
  "reason": "Token foi invalidado após tentativa suspeita"
}
```

## Reconstrução Passo a Passo

### Passo 1: Identificar o Incidente

**Query:** Buscar todos os logs com `requestId = "9d631593-90cb-4796-9be5-ed12846d7236"`

**Resultado:** 5 logs encontrados, todos relacionados ao mesmo incidente.

### Passo 2: Correlacionar Eventos

**Query:** Buscar todos os logs com `correlationId = "11f9c74e-9b35-4247-92ff-8768f5bbec65"`

**Resultado:** Mesmos 5 logs (confirmando que são parte do mesmo fluxo).

### Passo 3: Reconstruir a Sequência

**Ordem cronológica:**

1. **Tentativa de Acesso** (Log 1 - `info`)
   - Usuário `user-123` do tenant `tenant-A` tentou acessar recurso `resource-789` do tenant `tenant-B`

2. **Cross-Tenant Violation** (Log 2 - `abuse`)
   - Sistema detectou que `tenantIdFromToken` (tenant-A) ≠ `tenantIdFromResource` (tenant-B)
   - Severity: Critical

3. **Permission Denied** (Log 3 - `authzDeny`)
   - Sistema negou permissão `resource:read` devido a tentativa cross-tenant
   - Reason: "Cross-tenant access attempt blocked"

4. **Token Invalidation** (Log 4 - `invalidation`)
   - Sistema invalidou token como medida de segurança
   - `previousTokenVersion: 5` → `newTokenVersion: 6`
   - Reason: "Cross-tenant access attempt - security measure"

5. **Login Failure** (Log 5 - `warn`)
   - Tentativa subsequente de login falhou porque token foi invalidado
   - `tokenVersionFromToken: 5` ≠ `tokenVersionFromDB: 6`
   - Reason: "Token foi invalidado após tentativa suspeita"

### Passo 4: Análise Forense

**O que aconteceu:**
- Usuário `user-123` do tenant `tenant-A` tentou acessar recurso `resource-789` que pertence ao tenant `tenant-B`
- Sistema detectou violação cross-tenant e bloqueou o acesso
- Como medida de segurança, sistema invalidou o token do usuário (incrementou `token_version` de 5 para 6)
- Tentativa subsequente de login falhou porque token estava invalidado

**Quem estava envolvido:**
- `userId: user-123`
- `actorId: actor-456`
- `tenantId: tenant-A` (usuário)
- `tenantId: tenant-B` (recurso alvo)

**Impacto:**
- Acesso negado (esperado)
- Token invalidado (medida de segurança)
- Usuário precisou fazer login novamente

**Severidade:**
- **Critical** (abuse detectado)
- Sistema funcionou corretamente (bloqueou acesso cross-tenant)

## Validação da Reconstrução

### ✅ Validação Completa

- ✅ Todos os eventos foram rastreados usando apenas `requestId` e `correlationId`
- ✅ Sequência de eventos foi reconstruída sem acesso ao banco de dados
- ✅ Contexto completo (tenantId, userId, actorId) estava presente em todos os logs
- ✅ Causa raiz identificada: tentativa de acesso cross-tenant
- ✅ Ações do sistema foram rastreáveis: bloqueio → invalidação → falha de login

### ❌ Não Foi Necessário

- ❌ Acesso ao banco de dados
- ❌ Análise de código
- ❌ Reprodução do incidente
- ❌ Acesso ao sistema em tempo real

## Conclusão

**✅ DRY-RUN VALIDATED**

O incidente foi **completamente reconstruído usando apenas logs**, provando que o sistema de forensics funciona na prática.

**Evidência:**
- 5 logs canônicos gerados
- Todos os logs incluem `requestId`, `correlationId`, `tenantId`, `userId`, `actorId`
- Sequência completa de eventos reconstruída
- Causa raiz identificada
- Impacto avaliado
- Ações do sistema rastreadas

## Próximos Passos

1. **Integrar no CI:** Executar dry-run como parte dos testes de invariantes
2. **Automatizar:** Criar script que valida automaticamente a completude dos logs
3. **Expandir:** Adicionar mais cenários de incidentes (rate limit, replay, etc.)

## Referências

- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Script de Simulação:** `backend/scripts/simulate-forensics-incident.ts`
- **Log Classification:** `docs/audit/LOG-LEVEL-CLASSIFICATION.md`

