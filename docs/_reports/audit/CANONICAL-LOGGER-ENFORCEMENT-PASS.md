# Canonical Logger Enforcement Pass

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Transformar o `canonicalLogger` em **regra institucional obrigatória**, garantindo que todos os logs críticos usem o logger canônico com correlação completa (requestId, tenantId, userId, actorId).

## Implementação

### 1. Script de Validação

**Arquivo:** `backend/scripts/validate-canonical-logging.ts`

**Funcionalidade:**
- Escaneia todo o código em `src/`
- Detecta uso proibido de `console.log`, `console.warn`, `console.error`, `console.debug`
- Detecta uso proibido de `fastify.log.*` em código de domínio
- Permite exceções apenas em:
  - `src/core/logging/canonical-logger.ts` (usa console internamente)
  - `src/plugins/` (infraestrutura pode usar fastify.log)
  - `scripts/` (scripts podem usar console)

**Uso:**
```bash
pnpm validate:canonical-logging
```

**Resultado:**
- ✅ Se passar: Nenhuma violação encontrada
- ❌ Se falhar: Lista todas as violações com localização (arquivo:linha)

### 2. Integração no CI

**Script adicionado ao `package.json`:**
```json
"validate:canonical-logging": "ts-node -r tsconfig-paths/register scripts/validate-canonical-logging.ts"
```

**Recomendação para CI:**
```yaml
- name: Validate Canonical Logging
  run: pnpm validate:canonical-logging
```

### 3. Arquivos Atualizados

#### Auth Service (`backend/src/core/auth/auth.service.ts`)

**Mudanças:**
- ✅ Substituído `console.log` por `canonicalLogger.info`
- ✅ Substituído `console.warn` por `canonicalLogger.warn`
- ✅ Substituído `console.error` por `canonicalLogger.error`
- ✅ Uso de `canonicalLogger.invalidation` para logs de logout

**Exemplos:**
```typescript
// Antes
console.log('[AUTHZ] Sessão invalidada', { tenantId, userId });

// Depois
canonicalLogger.invalidation(null, 'Sessão invalidada', { tenantId, userId });
```

#### Authorization Service (`backend/src/core/authorization/authorization.service.ts`)

**Mudanças:**
- ✅ Substituído `console.log` por `canonicalLogger.authzAllow` (permissões concedidas)
- ✅ Substituído `console.warn` por `canonicalLogger.authzDeny` (permissões negadas)
- ✅ Uso de `canonicalLogger.debug` para logs de início de resolução

**Exemplos:**
```typescript
// Antes
console.log('[AUTHZ] Permissão concedida: Ownership direto', { ... });

// Depois
canonicalLogger.authzAllow(null, 'Permissão concedida: Ownership direto', { ... });
```

#### Event Bus (`backend/src/core/events/event-bus.ts`)

**Mudanças:**
- ✅ Substituído `console.log` por `canonicalLogger.info`
- ✅ Substituído `console.error` por `canonicalLogger.error`

#### Rate Limiting (`backend/src/core/rate-limiting/auth-rate-limit.service.ts`)

**Mudanças:**
- ✅ Substituído `console.warn` por `canonicalLogger.abuse` (abusos detectados)
- ✅ Substituído `console.error` por `canonicalLogger.error`
- ✅ Substituído `console.log` por `canonicalLogger.info`

**Exemplos:**
```typescript
// Antes
console.warn('[AuthRateLimit] 🚫 ABUSO DETECTADO: Limite excedido por IP', { ... });

// Depois
canonicalLogger.abuse(req, 'Limite excedido por IP', { ... });
```

#### Idempotency Tracker (`backend/src/core/events/idempotency-tracker.ts`)

**Mudanças:**
- ✅ Substituído `console.warn` por `canonicalLogger.abuse` (replay detectado)
- ✅ Substituído `console.warn` por `canonicalLogger.warn` (payload mudou)

**Exemplos:**
```typescript
// Antes
console.warn('[IdempotencyTracker] 🔄 REPLAY DETECTADO: Evento já processado', { ... });

// Depois
canonicalLogger.abuse(null, 'REPLAY DETECTADO: Evento já processado', { ... });
```

#### Reputation Events (`backend/src/core/reputation/reputation.events.ts`)

**Mudanças:**
- ✅ Substituído `console.error` por `canonicalLogger.error`

#### Groups Activity Executors (`backend/src/core/orchestrator/executors/groups-activity.executors.ts`)

**Mudanças:**
- ✅ Substituído `console.error` por `canonicalLogger.error`

## Métodos Semânticos

### Uso Obrigatório

| Método | Quando Usar | Exemplo |
|--------|-------------|---------|
| `authzAllow` | Permissão concedida | `canonicalLogger.authzAllow(req, 'Permissão concedida', { ... })` |
| `authzDeny` | Permissão negada | `canonicalLogger.authzDeny(req, 'Permissão negada', { ... })` |
| `invalidation` | Invalidação de sessão/estado | `canonicalLogger.invalidation(req, 'Sessão invalidada', { ... })` |
| `abuse` | Abuso detectado (rate limit, replay) | `canonicalLogger.abuse(req, 'Rate limit excedido', { ... })` |
| `info` | Informação geral | `canonicalLogger.info(req, 'Operação realizada', { ... })` |
| `warn` | Aviso | `canonicalLogger.warn(req, 'Atenção necessária', { ... })` |
| `error` | Erro | `canonicalLogger.error(req, 'Erro ao processar', { ... })` |
| `debug` | Debug (apenas desenvolvimento) | `canonicalLogger.debug(req, 'Debug info', { ... })` |

## Regras de Uso

### ✅ Permitido

1. **Em rotas (com request):**
   ```typescript
   canonicalLogger.info(req, 'Operação realizada', { additionalData: 'value' });
   ```

2. **Em serviços (sem request):**
   ```typescript
   canonicalLogger.info(null, 'Operação realizada', { tenantId, userId });
   ```

3. **Em event handlers:**
   ```typescript
   canonicalLogger.info(null, 'Evento processado', { 
     correlationId: event.correlationId,
     tenantId: event.tenantId 
   });
   ```

### ❌ Proibido

1. **console.* em código de domínio:**
   ```typescript
   // ❌ PROIBIDO
   console.log('Mensagem', context);
   ```

2. **fastify.log.* em código de domínio:**
   ```typescript
   // ❌ PROIBIDO (exceto em plugins)
   fastify.log.info('Mensagem', context);
   ```

3. **Logs sem correlação:**
   ```typescript
   // ❌ PROIBIDO (não inclui requestId, tenantId, etc.)
   console.log('Mensagem');
   ```

## Validação

### Executar Validação Localmente

```bash
cd backend
pnpm validate:canonical-logging
```

### Integrar no CI

Adicionar ao workflow do GitHub Actions:

```yaml
- name: Validate Canonical Logging
  run: pnpm validate:canonical-logging
```

### Áreas Críticas Validadas

O script valida apenas áreas críticas:
- `src/core/auth` - Autenticação
- `src/core/authorization` - Autorização
- `src/core/events` - Eventos
- `src/core/rate-limiting` - Rate limiting
- `src/core/reputation` - Reputação
- `src/core/orchestrator` - Orquestração
- `src/plugins/rbac` - RBAC
- `src/modules/bank` - Banco/Ledger
- `src/modules/social/actor` - Actors

**Nota:** Outras áreas (scripts, AI, services) não são validadas neste momento, mas podem ser adicionadas no futuro.

### Resultado Esperado

**Se passar:**
```
🔍 Validando uso de canonicalLogger...

✅ Nenhuma violação encontrada. Todos os logs usam canonicalLogger.
```

**Se falhar:**
```
❌ VIOLAÇÕES ENCONTRADAS: Uso proibido de console.* ou fastify.log.*

Violações encontradas:

  src/core/auth/auth.service.ts:130
    console.warn('[AUTHZ] Access token invalidado', { ... });

Total: 1 violação(ões)
```

## Critérios de Sucesso

### ✅ Nenhum Log Crítico Fora do CanonicalLogger

- ✅ Todos os logs em `auth.service.ts` usam `canonicalLogger`
- ✅ Todos os logs em `authorization.service.ts` usam `canonicalLogger`
- ✅ Todos os logs em `event-bus.ts` usam `canonicalLogger`
- ✅ Todos os logs em `auth-rate-limit.service.ts` usam `canonicalLogger`
- ✅ Todos os logs em `idempotency-tracker.ts` usam `canonicalLogger`
- ✅ Todos os logs em `reputation.events.ts` usam `canonicalLogger`
- ✅ Todos os logs em `groups-activity.executors.ts` usam `canonicalLogger`

### ✅ Build Falha se Violado

- ✅ Script de validação retorna código de saída 1 se violações encontradas
- ✅ Script pode ser integrado no CI como gate obrigatório
- ✅ Mensagens de erro são claras e indicam como corrigir

### ✅ Uso de Métodos Semânticos

- ✅ `authzAllow` usado para permissões concedidas
- ✅ `authzDeny` usado para permissões negadas
- ✅ `invalidation` usado para invalidações de sessão
- ✅ `abuse` usado para abusos detectados (rate limit, replay)

## Próximos Passos

1. **Integrar no CI:** Adicionar `pnpm validate:canonical-logging` ao workflow do GitHub Actions
2. **Atualizar outros arquivos:** Continuar migrando logs restantes em outros módulos
3. **Documentar exceções:** Se houver casos legítimos de `console.*`, documentar em exceções do script

## Referências

- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`
- **Script de Validação:** `backend/scripts/validate-canonical-logging.ts`
- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`

