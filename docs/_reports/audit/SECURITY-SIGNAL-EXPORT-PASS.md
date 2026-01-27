# Security Signal Export Pass

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO

## Objetivo

Preparar logs críticos para integração com SIEM/SOC, marcando sinais de segurança e padronizando payload para exportação automatizada.

## Implementação

### 1. Metadados de Segurança Adicionados

**Arquivo:** `backend/src/core/logging/canonical-logger.ts`

**Interfaces criadas:**
```typescript
export type SecuritySignalType = 'AUTH' | 'RBAC' | 'TENANT' | 'ABUSE' | 'SESSION' | 'EVENT';

export interface SecuritySignalMetadata {
  securitySignal: boolean;
  signalType: SecuritySignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}
```

### 2. Logs Críticos Marcados

#### Métodos Semânticos (Sempre Security Signal)

- ✅ `abuse()` → `securitySignal: true`, `signalType: ABUSE|TENANT`, `severity: critical`
- ✅ `invalidation()` → `securitySignal: true`, `signalType: SESSION`, `severity: medium`
- ✅ `authzAllow()` → `securitySignal: true`, `signalType: RBAC`, `severity: low`
- ✅ `authzDeny()` → `securitySignal: true`, `signalType: RBAC`, `severity: medium`

#### Métodos Genéricos (Detecção Automática)

- ✅ `info()` → Detecta eventos de segurança (login, auth) e adiciona `securitySignal: true`, `signalType: AUTH`
- ✅ `warn()` → Detecta eventos de segurança (login failure, token, tenant) e adiciona `securitySignal: true`, `signalType: AUTH|TENANT`
- ✅ `error()` → Detecta eventos de segurança (event rejected, auth errors) e adiciona `securitySignal: true`, `signalType: EVENT|AUTH|TENANT`

### 3. Detecção Automática de Signal Type

**Lógica implementada:**

- **Cross-tenant violations:** Detectado automaticamente em mensagens contendo "cross-tenant" ou "tenant" → `signalType: TENANT`
- **Replay attacks:** Detectado automaticamente em mensagens contendo "replay" → `signalType: ABUSE`
- **Login events:** Detectado automaticamente em mensagens contendo "login" → `signalType: AUTH`
- **Token events:** Detectado automaticamente em mensagens contendo "token" → `signalType: AUTH`
- **Event rejection:** Detectado automaticamente em mensagens contendo "event" → `signalType: EVENT`

## Payload Padronizado

### Formato JSON Estruturado

Todos os logs com `securitySignal: true` seguem este formato:

```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "info|warn|error",
  "message": "[CANONICAL] Descrição do evento",
  "securitySignal": true,
  "signalType": "AUTH|RBAC|TENANT|ABUSE|SESSION|EVENT",
  "severity": "low|medium|high|critical",
  "requestId": "uuid",
  "correlationId": "uuid",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "actorId": "actor-789",
  "context": {
    "additionalData": "value"
  }
}
```

### Exemplos de Payloads

#### Cross-Tenant Violation
```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "warn",
  "message": "[CANONICAL] 🚫 ABUSO: Cross-tenant violation: tenantId do token não corresponde ao recurso",
  "securitySignal": true,
  "signalType": "TENANT",
  "severity": "critical",
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

#### Permission Denied
```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "warn",
  "message": "[CANONICAL] 🚫 AUTHZ DENY: Permissão negada: Cross-tenant access attempt",
  "securitySignal": true,
  "signalType": "RBAC",
  "severity": "medium",
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

#### Login Success
```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "info",
  "message": "[CANONICAL] Login success",
  "securitySignal": true,
  "signalType": "AUTH",
  "severity": "low",
  "requestId": "uuid",
  "correlationId": "uuid",
  "tenantId": "tenant-123",
  "userId": "user-456",
  "email": "use***",
  "tokenVersion": 5
}
```

## Pipeline Recomendado

### 1. Coleta de Logs

**Ferramentas:**
- **Loki** (Grafana) - Log aggregation leve
- **ELK Stack** (Elasticsearch, Logstash, Kibana) - Stack completo
- **Fluentd** - Coleta e encaminhamento
- **Vector** - Pipeline de observabilidade

### 2. Filtragem de Sinais de Segurança

**Query Loki (LogQL):**
```logql
{job="unificard-backend"} 
  | json 
  | securitySignal="true"
  | line_format "{{.timestamp}} [{{.signalType}}] {{.severity}}: {{.message}}"
```

**Query Elasticsearch (KQL):**
```kql
securitySignal: true AND signalType: (ABUSE OR TENANT OR AUTH)
```

### 3. Alertas (Alertmanager)

**Configuração:** Veja `docs/audit/SECURITY-SIGNAL-PIPELINE.md` para configuração completa do Alertmanager.

### 4. Integração com PagerDuty / Slack

**Webhooks:** Veja `docs/audit/SECURITY-SIGNAL-PIPELINE.md` para exemplos de integração.

## Logs Marcados como Security Signals

### AUTH Signals

- ✅ Login success (`info` + detecção automática)
- ✅ Login failure (`warn` + detecção automática)
- ✅ Refresh success (`info` + detecção automática)
- ✅ Refresh failure (`warn` + detecção automática)

### RBAC Signals

- ✅ Permission allow (`authzAllow` + sempre marcado)
- ✅ Permission deny (`authzDeny` + sempre marcado)

### TENANT Signals

- ✅ Cross-tenant violation (`abuse` + detecção automática de "cross-tenant" → `signalType: TENANT`)
- ✅ Tenant mismatch (`warn` + detecção automática de "tenant" → `signalType: TENANT`)

### ABUSE Signals

- ✅ Rate limit excedido (`abuse` + sempre marcado como `ABUSE`)
- ✅ Replay detectado (`abuse` + detecção automática de "replay" → `signalType: ABUSE`)

### SESSION Signals

- ✅ Logout (`invalidation` + sempre marcado)
- ✅ Token invalidation (`invalidation` + sempre marcado)

### EVENT Signals

- ✅ Event rejected (`error` + detecção automática de "event" → `signalType: EVENT`)

## Critérios de Sucesso

### ✅ Logs Prontos para SOC Automatizado

- ✅ Todos os logs críticos incluem `securitySignal: true`
- ✅ Todos os logs críticos incluem `signalType` apropriado
- ✅ Todos os logs críticos incluem `severity` apropriado
- ✅ Payload padronizado para exportação
- ✅ Pipeline documentado (Loki/ELK → Alertmanager → PagerDuty/Slack)

### ✅ Metadados de Segurança

- ✅ `securitySignal: true` em todos os logs críticos
- ✅ `signalType` mapeado corretamente (AUTH, RBAC, TENANT, ABUSE, SESSION, EVENT)
- ✅ `severity` mapeado corretamente (low, medium, high, critical)
- ✅ Detecção automática de signalType baseada em mensagem

### ✅ Pipeline Documentado

- ✅ Coleta de logs (Loki/ELK)
- ✅ Filtragem de sinais (LogQL/KQL)
- ✅ Alertas (Alertmanager)
- ✅ Integração (PagerDuty/Slack)
- ✅ Regras de alerta (Prometheus/Loki)

## Validação

### Teste de Exportação

Execute o script de simulação para verificar que os logs incluem metadados de segurança:

```bash
cd backend
pnpm simulate:forensics-incident
```

**Resultado esperado:**
- Logs incluem `securitySignal: true`
- Logs incluem `signalType` apropriado
- Logs incluem `severity` apropriado
- Logs incluem `timestamp` ISO 8601

## Próximos Passos

1. **Implementar exportação:** Criar serviço que exporta logs com `securitySignal: true` para SIEM
2. **Configurar pipeline:** Implementar pipeline real com Loki/ELK
3. **Configurar alertas:** Implementar regras de alerta no Alertmanager
4. **Integrar com SOC:** Conectar com sistema de SOC existente

## Referências

- **Pipeline Completo:** `docs/audit/SECURITY-SIGNAL-PIPELINE.md`
- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`
- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Log Classification:** `docs/audit/LOG-LEVEL-CLASSIFICATION.md`

