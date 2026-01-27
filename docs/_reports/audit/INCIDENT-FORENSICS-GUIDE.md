# Incident Forensics Guide

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO  
**Dry-Run Validated:** ✅ 2024-12-19

## Objetivo

Garantir que **qualquer incidente pode ser reconstruído completamente usando apenas logs**, permitindo análise forense pós-incidente sem necessidade de reprodução ou acesso ao sistema em tempo real.

## Princípios de Observabilidade

### 1. Correção Completa

Todos os logs canônicos devem incluir:

- **`requestId`**: ID único da requisição HTTP
- **`correlationId`**: ID para correlacionar requisições relacionadas (ex: frontend → backend → eventos)
- **`tenantId`**: ID do tenant (quando disponível)
- **`userId`**: ID do usuário (quando disponível)
- **`actorId`**: ID do actor (quando disponível)

### 2. Logs Canônicos

Logs marcados com `🔴 LOG CANÔNICO` são **obrigatórios** para forensics e devem incluir:

- **Timestamp**: ISO 8601 format
- **Contexto completo**: requestId, tenantId, userId, actorId
- **Ação realizada**: descrição clara do que aconteceu
- **Estado antes/depois**: quando aplicável (ex: tokenVersion antes/depois de logout)

### 3. Rastreabilidade

Cada operação crítica deve ser rastreável através de:

1. **Request → Response**: `requestId` conecta requisição HTTP à resposta
2. **Request → Events**: `correlationId` conecta requisição a eventos assíncronos
3. **User → Actions**: `userId` + `actorId` conectam usuário às ações realizadas
4. **Tenant → Isolation**: `tenantId` garante isolamento e rastreabilidade multi-tenant

## Estrutura de Logs

### Formato Padrão

```json
{
  "level": "info|warn|error",
  "message": "[CANONICAL] Descrição da operação",
  "requestId": "uuid",
  "correlationId": "uuid",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "actorId": "actor-789",
  "timestamp": "2024-12-19T10:00:00.000Z",
  "additionalContext": { ... }
}
```

### Prefixos Canônicos

- `[CANONICAL]`: Log canônico padrão
- `[CANONICAL] ✅ AUTHZ ALLOW`: Autorização concedida
- `[CANONICAL] 🚫 AUTHZ DENY`: Autorização negada
- `[CANONICAL] 🚫 ABUSO`: Tentativa de abuso detectada
- `[CANONICAL] 🔄 INVALIDAÇÃO`: Invalidação de sessão/estado
- `[CANONICAL] 🔍`: Debug (apenas em desenvolvimento)

### Classificação de Níveis de Log

Cada tipo de evento deve usar o nível semanticamente correto:

| Event Type | Log Method | Severity | Expected Action |
|------------|------------|----------|-----------------|
| **Fluxo Normal** |
| Tenant criado, evento publicado, refresh válido | `info` | Low | Rastreabilidade |
| Permissão concedida | `authzAllow` | Low | Auditoria |
| **Tentativa Inválida** |
| Token invalidado, user não encontrado | `warn` | Medium | Monitorar padrões |
| **Falha Sistêmica** |
| Erro ao processar, handler error | `error` | High | Investigar imediatamente |
| **Comportamento Malicioso** |
| Rate limit excedido, replay detectado | `abuse` | Critical | Bloquear/Alertar |
| **Invalidação** |
| Logout, sessão invalidada | `invalidation` | Low | Rastreabilidade |
| **Negação Esperada** |
| Permissão negada | `authzDeny` | Low | Nenhuma ação |
| **Debug** |
| Início de resolução | `debug` | None | Apenas dev |

**Regras:**
- ❌ Nenhum erro logado como `info`
- ❌ Nenhuma violação logada como `debug`
- ❌ Nenhum abuso logado como `warn`
- ❌ Nenhuma negação esperada logada como `error`

**Referência completa:** `docs/audit/LOG-LEVEL-CLASSIFICATION.md`

## Áreas Críticas de Logging

### 1. Autenticação (Auth)

**Localização:** `backend/src/core/auth/`

**Logs Obrigatórios:**

#### Login
```json
{
  "message": "[CANONICAL] Login realizado",
  "requestId": "xxx",
  "tenantId": "yyy",
  "userId": "zzz",
  "email": "use***",
  "success": true,
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Logout
```json
{
  "message": "[CANONICAL] 🔄 INVALIDAÇÃO: Sessão invalidada (logout)",
  "requestId": "xxx",
  "tenantId": "yyy",
  "userId": "zzz",
  "previousTokenVersion": 5,
  "newTokenVersion": 6,
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Token Invalidado
```json
{
  "message": "[CANONICAL] ⚠️ Token invalidado: tokenVersion não corresponde",
  "requestId": "xxx",
  "tenantId": "yyy",
  "userId": "zzz",
  "tokenVersionFromToken": 5,
  "tokenVersionFromDB": 6,
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Rate Limit Excedido
```json
{
  "message": "[CANONICAL] 🚫 ABUSO: Rate limit excedido em /auth/login",
  "requestId": "xxx",
  "ip": "192.168.1.1",
  "tenantId": "yyy",
  "email": "use***",
  "reason": "ip",
  "limit": 5,
  "resetAt": "2024-12-19T10:01:00.000Z",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

### 2. Autorização (RBAC & Permissions)

**Localização:** `backend/src/plugins/rbac.plugin.ts`, `backend/src/core/authorization/`

**Logs Obrigatórios:**

#### Permissão Concedida
```json
{
  "message": "[CANONICAL] ✅ AUTHZ ALLOW: Permissão concedida",
  "requestId": "xxx",
  "tenantId": "yyy",
  "userId": "zzz",
  "actorId": "aaa",
  "permission": "companies:read",
  "authoritySource": "ownership",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Permissão Negada
```json
{
  "message": "[CANONICAL] 🚫 AUTHZ DENY: Permissão negada",
  "requestId": "xxx",
  "tenantId": "yyy",
  "userId": "zzz",
  "actorId": "aaa",
  "permission": "companies:write",
  "reason": "Actor not found",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### RBAC Context Inválido
```json
{
  "message": "[CANONICAL] ❌ RBAC: Contexto inválido",
  "requestId": "xxx",
  "route": "/api/companies",
  "method": "GET",
  "reason": "Tenant ausente no RBAC",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

### 3. Eventos (Event Bus)

**Localização:** `backend/src/core/events/event-bus.ts`

**Logs Obrigatórios:**

#### Evento Publicado
```json
{
  "message": "[CANONICAL] Evento publicado",
  "requestId": "xxx",
  "correlationId": "yyy",
  "tenantId": "zzz",
  "eventId": "event-123",
  "eventType": "core.review.created",
  "userId": "user-456",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Evento Rejeitado (Sem Contexto)
```json
{
  "message": "[CANONICAL] ❌ Evento rejeitado: tenantId ausente",
  "requestId": "xxx",
  "eventId": "event-123",
  "eventType": "core.review.created",
  "reason": "tenantId ausente ou inválido",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Replay Detectado
```json
{
  "message": "[CANONICAL] 🚫 ABUSO: Replay de evento detectado",
  "requestId": "xxx",
  "correlationId": "yyy",
  "tenantId": "zzz",
  "eventId": "event-123",
  "eventType": "core.review.created",
  "idempotencyKey": "key-456",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

### 4. Tenant

**Localização:** `backend/src/plugins/tenant.plugin.ts`

**Logs Obrigatórios:**

#### Tenant Resolvido
```json
{
  "message": "[CANONICAL] Tenant resolvido",
  "requestId": "xxx",
  "tenantId": "yyy",
  "source": "jwt",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

#### Tenant Criado
```json
{
  "message": "[CANONICAL] Tenant criado automaticamente",
  "requestId": "xxx",
  "tenantId": "yyy",
  "email": "use***",
  "tenantSlug": "tenant-slug",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

## Correlação de Requisições

### Fluxo Típico

```
1. Frontend faz requisição → requestId: "req-1", correlationId: "corr-1"
2. Backend processa → requestId: "req-1", correlationId: "corr-1"
3. Backend publica evento → eventId: "evt-1", correlationId: "corr-1"
4. Handler processa evento → correlationId: "corr-1"
5. Handler cria notificação → correlationId: "corr-1"
```

### Busca por Correlação

Para reconstruir um incidente:

1. **Identificar requestId inicial** (ex: do erro reportado)
2. **Buscar correlationId** (mesmo valor ou derivado)
3. **Buscar todos os logs com correlationId**
4. **Ordenar por timestamp**
5. **Reconstruir fluxo completo**

## Queries de Forensics

### 1. Reconstruir Requisição Completa

```bash
# Buscar todos os logs de uma requisição
grep "requestId.*req-123" logs/*.log | sort -k 4

# Buscar todos os logs correlacionados
grep "correlationId.*corr-456" logs/*.log | sort -k 4
```

### 2. Rastrear Usuário

```bash
# Buscar todas as ações de um usuário
grep "userId.*user-789" logs/*.log | sort -k 4

# Buscar todas as ações de um actor
grep "actorId.*actor-012" logs/*.log | sort -k 4
```

### 3. Rastrear Tenant

```bash
# Buscar todas as operações de um tenant
grep "tenantId.*tenant-345" logs/*.log | sort -k 4

# Buscar violações de isolamento
grep "tenantId.*tenant-345" logs/*.log | grep "CROSS_TENANT" | sort -k 4
```

### 4. Detectar Abusos

```bash
# Buscar todos os abusos
grep "🚫 ABUSO" logs/*.log | sort -k 4

# Buscar rate limits excedidos
grep "Rate limit excedido" logs/*.log | sort -k 4

# Buscar replays detectados
grep "Replay de evento detectado" logs/*.log | sort -k 4
```

### 5. Rastrear Invalidações

```bash
# Buscar todas as invalidações de sessão
grep "INVALIDAÇÃO" logs/*.log | sort -k 4

# Buscar invalidações de token
grep "tokenVersion não corresponde" logs/*.log | sort -k 4
```

## Exemplo de Reconstrução de Incidente

### Cenário: Usuário reporta "Não consigo fazer login"

**Passo 1: Identificar requestId do erro**
```json
{
  "message": "[CANONICAL] ❌ Login falhou",
  "requestId": "req-abc123",
  "tenantId": "tenant-xyz",
  "email": "user@example.com",
  "error": "Invalid credentials",
  "timestamp": "2024-12-19T10:00:00.000Z"
}
```

**Passo 2: Buscar logs relacionados**
```bash
grep "req-abc123\|corr-abc123" logs/*.log | sort -k 4
```

**Passo 3: Reconstruir timeline**

```
10:00:00.000 - [CANONICAL] Rate limit check: allowed=true
10:00:00.100 - [CANONICAL] Login iniciado: email=user@example.com
10:00:00.200 - [CANONICAL] Usuário encontrado: userId=user-789
10:00:00.300 - [CANONICAL] Verificação de senha: failed
10:00:00.400 - [CANONICAL] ❌ Login falhou: Invalid credentials
```

**Passo 4: Verificar tentativas anteriores**
```bash
grep "email.*user@example.com" logs/*.log | grep "Login\|Rate limit" | sort -k 4
```

**Resultado:**
- 5 tentativas de login em 1 minuto
- Todas falharam com "Invalid credentials"
- Rate limit não foi excedido (6ª tentativa seria bloqueada)

**Conclusão:** Usuário está usando senha incorreta. Não é um ataque, mas erro legítimo do usuário.

## Checklist de Forensics

### ✅ Logs Incluem Correção Completa

- [ ] Todos os logs canônicos incluem `requestId`
- [ ] Eventos assíncronos incluem `correlationId`
- [ ] Logs de autenticação incluem `tenantId` e `userId`
- [ ] Logs de autorização incluem `tenantId`, `userId` e `actorId`
- [ ] Logs de eventos incluem `tenantId` e `correlationId`

### ✅ Logs São Estruturados

- [ ] Logs usam formato JSON ou estruturado
- [ ] Timestamps são ISO 8601
- [ ] Mensagens são descritivas e consistentes
- [ ] Prefixos canônicos são usados corretamente

### ✅ Logs São Rastreáveis

- [ ] Request → Response é rastreável via `requestId`
- [ ] Request → Events é rastreável via `correlationId`
- [ ] User → Actions é rastreável via `userId` + `actorId`
- [ ] Tenant → Operations é rastreável via `tenantId`

### ✅ Logs Capturam Estado

- [ ] Invalidações logam estado antes/depois
- [ ] Autorizações logam motivo de allow/deny
- [ ] Erros logam contexto completo
- [ ] Abusos logam tentativa e bloqueio

## Ferramentas Recomendadas

### 1. Log Aggregation

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Loki** (Grafana)
- **Datadog**
- **Splunk**

### 2. Query Languages

- **KQL** (Kibana Query Language)
- **LogQL** (Loki Query Language)
- **SQL** (para logs em banco de dados)

### 3. Visualização

- **Grafana**: Dashboards de forensics
- **Kibana**: Análise de logs
- **Custom Tools**: Scripts Python/Node.js para análise

## Retenção de Logs

### Recomendações

- **Logs de Produção**: 90 dias
- **Logs de Segurança**: 1 ano
- **Logs de Auditoria**: 7 anos (conforme regulamentação)

### Arquivos Críticos

- **Auth logs**: 1 ano (para investigação de acessos)
- **RBAC logs**: 1 ano (para auditoria de permissões)
- **Event logs**: 90 dias (para rastreamento de operações)
- **Abuse logs**: 1 ano (para análise de ataques)

## Uso do Logger Canônico

### Em Rotas (com Request)

```typescript
import { canonicalLogger } from '@core/logging/canonical-logger';

fastify.post('/api/companies', async (req, reply) => {
  // Logger extrai automaticamente requestId, tenantId, userId, actorId
  canonicalLogger.info(req, 'Criando empresa', {
    companyName: 'Empresa XYZ',
  });
  
  // Para abusos
  canonicalLogger.abuse(req, 'Rate limit excedido', {
    ip: '192.168.1.1',
    limit: 5,
  });
  
  // Para autorizações
  canonicalLogger.authzAllow(req, 'Permissão concedida', {
    permission: 'companies:write',
    authoritySource: 'ownership',
  });
});
```

### Em Serviços (sem Request)

```typescript
import { canonicalLogger } from '@core/logging/canonical-logger';

class AuthService {
  async logout(tenantId: string, userId: string, requestId?: string) {
    // Passar contexto explícito quando não há request
    canonicalLogger.invalidation(null, 'Sessão invalidada (logout)', {
      requestId,
      tenantId,
      userId,
      previousTokenVersion: 5,
      newTokenVersion: 6,
    });
  }
}
```

### Em Event Handlers

```typescript
import { canonicalLogger } from '@core/logging/canonical-logger';

async function handleEvent(event: UnificardEvent) {
  // Usar correlationId do evento
  canonicalLogger.info(null, 'Evento processado', {
    correlationId: event.correlationId,
    tenantId: event.tenantId,
    eventId: event.eventId,
    eventType: event.eventType,
  });
}
```

## Dry-Run Validated ✅

**Data:** 2024-12-19  
**Status:** ✅ VALIDADO

Um dry-run completo foi executado, simulando um incidente real e reconstruindo-o usando apenas logs. Veja `docs/audit/FORENSICS-DRY-RUN-PASS.md` para detalhes completos.

**Resumo:**
- ✅ Incidente simulado: Cross-tenant access attempt
- ✅ 5 logs canônicos gerados com correlação completa
- ✅ Reconstrução completa usando apenas `requestId` e `correlationId`
- ✅ Nenhum acesso ao banco de dados ou código necessário

**Script de Simulação:**
```bash
cd backend
pnpm simulate:forensics-incident
```

## Referências

- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`
- **Request ID Plugin:** `backend/src/plugins/request-id.plugin.ts`
- **Instrumentation Plugin:** `backend/src/core/instrumentation/instrumentation.plugin.ts`
- **Invariantes:** `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`
- **Rate Limit:** `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md`
- **Dry-Run Pass:** `docs/audit/FORENSICS-DRY-RUN-PASS.md`

