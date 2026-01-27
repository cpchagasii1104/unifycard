# Rate Limit & Abuse Hardening Pass

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Proteger endpoints de autenticação contra:
- **Brute force attacks**: Tentativas repetidas de login/registro
- **Spam**: Registros em massa ou verificações de CPF excessivas
- **Scraping**: Coleta automatizada de dados via endpoints públicos

## Estratégia Multi-Camada

O sistema de rate limiting aplica **4 camadas de proteção**:

1. **Limite por IP** (sempre aplicado)
   - Protege contra ataques distribuídos
   - Independente de tenantId ou userId

2. **Limite por tenantId** (quando disponível)
   - Protege tenants específicos
   - Previne abuso concentrado em um tenant

3. **Limite por userId** (quando disponível)
   - Protege contas específicas
   - Previne targeting de usuários individuais

4. **Limite por email** (para login/register)
   - Protege contra brute force em contas específicas
   - Previne enumeração de emails

## Endpoints Protegidos

### 1. `/auth/login`
- **Limite padrão:** 5 tentativas/minuto
- **Camadas:** IP, tenantId, email
- **Log canônico:** `🚫 [AUTH] Rate limit excedido em /auth/login`

### 2. `/auth/register`
- **Limite padrão:** 3 tentativas/minuto
- **Camadas:** IP, tenantId, email
- **Log canônico:** `🚫 [AUTH] Rate limit excedido em /auth/register`

### 3. `/auth/check-cpf`
- **Limite padrão:** 10 verificações/minuto
- **Camadas:** IP, tenantId
- **Log canônico:** `🚫 [AUTH] Rate limit excedido em /auth/check-cpf`

### 4. `/auth/webauthn/challenge`
- **Limite padrão:** 10 challenges/minuto
- **Camadas:** IP, tenantId, userId
- **Log canônico:** `🚫 [WEBAUTHN] Rate limit excedido em /auth/webauthn/challenge`

### 5. `/auth/webauthn/verify`
- **Limite padrão:** 5 verificações/minuto
- **Camadas:** IP, tenantId, userId
- **Log canônico:** `🚫 [WEBAUTHN] Rate limit excedido em /auth/webauthn/verify`

### 6. `/auth/refresh`
- **Limite padrão:** 20 refreshes/minuto
- **Camadas:** IP, tenantId, userId
- **Log canônico:** `🚫 [AUTH] Rate limit excedido em /auth/refresh`

## Configuração

Limites são configuráveis via variáveis de ambiente:

```bash
# Login
RATE_LIMIT_AUTH_LOGIN=5
RATE_LIMIT_AUTH_LOGIN_WINDOW_MS=60000

# Register
RATE_LIMIT_AUTH_REGISTER=3
RATE_LIMIT_AUTH_REGISTER_WINDOW_MS=60000

# Check CPF
RATE_LIMIT_AUTH_CHECK_CPF=10
RATE_LIMIT_AUTH_CHECK_CPF_WINDOW_MS=60000

# WebAuthn Challenge
RATE_LIMIT_AUTH_WEBAUTHN_CHALLENGE=10
RATE_LIMIT_AUTH_WEBAUTHN_CHALLENGE_WINDOW_MS=60000

# WebAuthn Verify
RATE_LIMIT_AUTH_WEBAUTHN_VERIFY=5
RATE_LIMIT_AUTH_WEBAUTHN_VERIFY_WINDOW_MS=60000

# Refresh
RATE_LIMIT_AUTH_REFRESH=20
RATE_LIMIT_AUTH_REFRESH_WINDOW_MS=60000
```

## Arquitetura

### Serviço: `auth-rate-limit.service.ts`

**Localização:** `backend/src/core/rate-limiting/auth-rate-limit.service.ts`

**Responsabilidades:**
- Extrair IP do cliente (considera proxies/load balancers)
- Verificar limites por todas as camadas
- Registrar tentativas para tracking
- Retornar resultado com `allowed`, `remaining`, `resetAt`

**Fail-Open Strategy:**
- Em caso de erro no rate limiting, **permitir** a requisição
- Logar erro para diagnóstico
- Não quebrar fluxo de autenticação

### Tabela: `auth_rate_limit_logs`

**Localização:** `backend/migrations/315_auth_rate_limit_logs.sql`

**Estrutura:**
```sql
CREATE TABLE auth_rate_limit_logs (
  id BIGSERIAL PRIMARY KEY,
  key_type VARCHAR(20) NOT NULL, -- 'ip', 'tenant', 'user', 'email'
  action VARCHAR(50) NOT NULL, -- 'auth.login', 'auth.register', etc.
  key_value VARCHAR(512) NOT NULL, -- IP, tenantId, userId, email
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

**Índices:**
- `idx_auth_rate_limit_key_action_time`: Para queries rápidas de contagem
- `idx_auth_rate_limit_attempted_at`: Para cleanup de logs antigos

## Logs Canônicos

### Abuso Detectado

**Formato:**
```json
{
  "level": "warn",
  "message": "🚫 [AUTH] Rate limit excedido em /auth/login",
  "route": "/auth/login",
  "ip": "192.168.1.1",
  "tenantId": "tenant-123",
  "email": "use***",
  "reason": "ip",
  "limit": 5,
  "resetAt": "2024-12-19T10:01:00.000Z"
}
```

**Razões possíveis:**
- `ip`: Limite por IP excedido
- `tenant`: Limite por tenant excedido
- `user`: Limite por usuário excedido
- `email`: Limite por email excedido

### Erro no Rate Limiting (Fail-Open)

**Formato:**
```json
{
  "level": "warn",
  "message": "[AUTH] Erro ao verificar rate limit (fail-open)",
  "err": { ... }
}
```

## Resposta HTTP

### Rate Limit Excedido (429)

```json
{
  "success": false,
  "error": "Limite de tentativas de login excedido. Tente novamente após 2024-12-19T10:01:00.000Z",
  "resetAt": "2024-12-19T10:01:00.000Z",
  "remaining": 0
}
```

## Garantias de Invariantes

### ✅ Rate Limit NUNCA quebra invariantes

1. **Fail-Open**: Em caso de erro, permite requisição (não bloqueia usuários legítimos)
2. **Não interfere com Auth**: Rate limit é verificado **antes** de processar autenticação
3. **Não interfere com Tenant**: Rate limit não depende de `req.tenant` (funciona em `/auth/*`)
4. **Não interfere com RBAC**: Rate limit não depende de permissões

### ✅ Logs Canônicos

- Todos os abusos são logados com contexto completo
- Logs incluem IP, tenantId, userId, email (parcial), reason, limit, resetAt
- Logs são estruturados para análise e auditoria

### ✅ Performance

- Queries usam índices otimizados
- Cleanup de logs antigos (recomendado: 7 dias)
- Rate limiting não adiciona latência significativa

## Manutenção

### Cleanup de Logs Antigos

```typescript
import { authRateLimitService } from '@core/rate-limiting/auth-rate-limit.service';

// Limpar logs com mais de 7 dias
await authRateLimitService.cleanupOldLogs(7);
```

**Recomendação:** Executar via job periódico (cron) ou scheduler.

## Testes Adversariais

### Cenário 1: Brute Force em Login

**Ataque:**
- 10 tentativas de login em 1 minuto
- Mesmo IP, diferentes emails

**Resultado esperado:**
- Primeiras 5 tentativas: sucesso (se credenciais corretas) ou erro de autenticação
- Tentativas 6-10: **429 Rate Limit Exceeded**
- Log canônico: `🚫 [AUTH] Rate limit excedido em /auth/login` com `reason: "ip"`

### Cenário 2: Spam de Registro

**Ataque:**
- 5 tentativas de registro em 1 minuto
- Mesmo IP, diferentes emails

**Resultado esperado:**
- Primeiras 3 tentativas: sucesso (se dados válidos) ou erro de validação
- Tentativas 4-5: **429 Rate Limit Exceeded**
- Log canônico: `🚫 [AUTH] Rate limit excedido em /auth/register` com `reason: "ip"`

### Cenário 3: Scraping de CPF

**Ataque:**
- 15 verificações de CPF em 1 minuto
- Mesmo IP

**Resultado esperado:**
- Primeiras 10 verificações: sucesso
- Verificações 11-15: **429 Rate Limit Exceeded**
- Log canônico: `🚫 [AUTH] Rate limit excedido em /auth/check-cpf` com `reason: "ip"`

### Cenário 4: Ataque Distribuído

**Ataque:**
- 10 tentativas de login em 1 minuto
- IPs diferentes, mesmo email

**Resultado esperado:**
- Primeiras 5 tentativas: sucesso ou erro de autenticação
- Tentativas 6-10: **429 Rate Limit Exceeded**
- Log canônico: `🚫 [AUTH] Rate limit excedido em /auth/login` com `reason: "email"`

## Critérios de Sucesso

✅ **Ataques degradam performance do atacante, não do sistema**

- Rate limiting é eficiente (queries rápidas)
- Sistema não é sobrecarregado por tentativas bloqueadas
- Usuários legítimos não são afetados (fail-open em erros)

✅ **Logs canônicos de abuso**

- Todos os abusos são logados com contexto completo
- Logs são estruturados para análise

✅ **Rate limit nunca quebra invariantes**

- Não interfere com Auth, Tenant, RBAC
- Fail-open garante que erros não bloqueiam usuários legítimos

## Próximos Passos

1. **Monitoramento**: Criar dashboard para visualizar tentativas de abuso
2. **Alertas**: Configurar alertas para picos de rate limit
3. **Análise**: Analisar logs para identificar padrões de ataque
4. **Ajuste**: Ajustar limites baseado em métricas reais

## Referências

- **Migration:** `backend/migrations/315_auth_rate_limit_logs.sql`
- **Serviço:** `backend/src/core/rate-limiting/auth-rate-limit.service.ts`
- **Integração:** `backend/src/core/auth/auth.routes.ts`, `backend/src/core/auth/webauthn.routes.ts`
- **Invariantes:** `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`

