# Security Signal Pipeline

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO  
**Validated:** ✅ 2024-12-19 (Dry-run executado com sucesso)

## Objetivo

Preparar logs críticos para integração com SIEM/SOC, marcando sinais de segurança e padronizando payload para exportação automatizada.

## Metadados de Segurança

### Campos Obrigatórios

Todos os logs críticos de segurança incluem:

```typescript
{
  securitySignal: true,
  signalType: 'AUTH' | 'RBAC' | 'TENANT' | 'ABUSE' | 'SESSION' | 'EVENT',
  severity: 'low' | 'medium' | 'high' | 'critical',
  timestamp: '2024-12-19T10:00:00.000Z'
}
```

### Tipos de Sinais

| Signal Type | Quando Usar | Severity | Exemplos |
|-------------|-------------|----------|----------|
| **AUTH** | Eventos de autenticação | low/medium/high | Login success/failure, refresh, token invalidation |
| **RBAC** | Autorizações (allow/deny) | low/medium | Permission granted/denied |
| **TENANT** | Violações de isolamento | critical | Cross-tenant access attempt |
| **ABUSE** | Comportamento malicioso | critical | Rate limit excedido, replay detectado |
| **SESSION** | Invalidações de sessão | medium | Logout, token invalidation |
| **EVENT** | Eventos rejeitados | high | Event rejected: tenantId ausente |

## Payload Padronizado para Exportação

### Formato JSON Estruturado

```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "info|warn|error",
  "message": "[CANONICAL] Descrição do evento",
  "securitySignal": true,
  "signalType": "AUTH|RBAC|TENANT|ABUSE|SESSION|EVENT",
  "severity": "low|medium|high|critical",
  "correlation": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "tenantId": "tenant-123",
    "userId": "user-456",
    "actorId": "actor-789"
  },
  "context": {
    "additionalData": "value"
  }
}
```

### Exemplo: Cross-Tenant Violation

```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "warn",
  "message": "[CANONICAL] 🚫 ABUSO: Cross-tenant violation: tenantId do token não corresponde ao recurso",
  "securitySignal": true,
  "signalType": "ABUSE",
  "severity": "critical",
  "correlation": {
    "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
    "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
    "tenantId": "tenant-A",
    "userId": "user-123",
    "actorId": "actor-456"
  },
  "context": {
    "tenantIdFromToken": "tenant-A",
    "tenantIdFromResource": "tenant-B",
    "resourceId": "resource-789"
  }
}
```

### Exemplo: Permission Denied

```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "warn",
  "message": "[CANONICAL] 🚫 AUTHZ DENY: Permissão negada: Cross-tenant access attempt",
  "securitySignal": true,
  "signalType": "RBAC",
  "severity": "medium",
  "correlation": {
    "requestId": "9d631593-90cb-4796-9be5-ed12846d7236",
    "correlationId": "11f9c74e-9b35-4247-92ff-8768f5bbec65",
    "tenantId": "tenant-A",
    "userId": "user-123",
    "actorId": "actor-456"
  },
  "context": {
    "permissionKey": "resource:read",
    "resourceId": "resource-789",
    "targetTenantId": "tenant-B",
    "reason": "Cross-tenant access attempt blocked"
  }
}
```

### Exemplo: Login Success

```json
{
  "timestamp": "2024-12-19T10:00:00.000Z",
  "level": "info",
  "message": "[CANONICAL] Login success",
  "securitySignal": true,
  "signalType": "AUTH",
  "severity": "low",
  "correlation": {
    "requestId": "uuid",
    "correlationId": "uuid",
    "tenantId": "tenant-123",
    "userId": "user-456"
  },
  "context": {
    "email": "use***",
    "tokenVersion": 5
  }
}
```

## Pipeline Recomendado

### 1. Coleta de Logs

**Ferramentas:**
- **Loki** (Grafana) - Log aggregation leve
- **ELK Stack** (Elasticsearch, Logstash, Kibana) - Stack completo
- **Fluentd** - Coleta e encaminhamento
- **Vector** - Pipeline de observabilidade

**Configuração Loki:**
```yaml
# loki-config.yaml
clients:
  - url: http://loki:3100/loki/api/v1/push
    tenant_id: unificard

scrape_configs:
  - job_name: unificard-backend
    static_configs:
      - targets:
          - localhost
        labels:
          job: unificard-backend
          environment: production
```

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

**Configuração Alertmanager:**
```yaml
# alertmanager-config.yaml
route:
  group_by: ['signalType', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'security-team'
  routes:
    - match:
        severity: critical
      receiver: 'security-critical'
      continue: true
    - match:
        signalType: ABUSE
      receiver: 'security-abuse'
    - match:
        signalType: TENANT
      receiver: 'security-tenant'

receivers:
  - name: 'security-critical'
    pagerduty_configs:
      - service_key: '<pagerduty-key>'
        severity: 'critical'
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#security-critical'
        title: '🚨 Critical Security Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
  
  - name: 'security-abuse'
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#security-abuse'
        title: '🚫 Abuse Detected'
  
  - name: 'security-tenant'
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#security-tenant'
        title: '🔒 Cross-Tenant Violation'
  
  - name: 'security-team'
    slack_configs:
      - api_url: '<slack-webhook>'
        channel: '#security'
```

### 4. Regras de Alerta (Prometheus/Loki)

**Alert Rules:**
```yaml
# security-alerts.yaml
groups:
  - name: security_signals
    interval: 30s
    rules:
      - alert: CrossTenantViolation
        expr: |
          sum by (tenantId, userId) (
            rate(
              {job="unificard-backend"} 
              | json 
              | securitySignal="true" 
              | signalType="TENANT"
              [5m]
            )
          ) > 0
        for: 1m
        labels:
          severity: critical
          signalType: TENANT
        annotations:
          summary: "Cross-tenant violation detected"
          description: "User {{ $labels.userId }} from tenant {{ $labels.tenantId }} attempted cross-tenant access"
      
      - alert: AbuseDetected
        expr: |
          sum by (ip, tenantId) (
            rate(
              {job="unificard-backend"} 
              | json 
              | securitySignal="true" 
              | signalType="ABUSE"
              [5m]
            )
          ) > 5
        for: 5m
        labels:
          severity: critical
          signalType: ABUSE
        annotations:
          summary: "Abuse pattern detected"
          description: "IP {{ $labels.ip }} exceeded rate limits"
      
      - alert: MultipleAuthFailures
        expr: |
          sum by (userId, tenantId) (
            rate(
              {job="unificard-backend"} 
              | json 
              | securitySignal="true" 
              | signalType="AUTH" 
              | message=~".*failure.*"
              [10m]
            )
          ) > 3
        for: 10m
        labels:
          severity: medium
          signalType: AUTH
        annotations:
          summary: "Multiple authentication failures"
          description: "User {{ $labels.userId }} has {{ $value }} failed login attempts"
```

### 5. Integração com PagerDuty

**Webhook PagerDuty:**
```json
{
  "routing_key": "<pagerduty-integration-key>",
  "event_action": "trigger",
  "payload": {
    "summary": "Critical Security Alert: Cross-tenant violation",
    "severity": "critical",
    "source": "unificard-backend",
    "custom_details": {
      "signalType": "TENANT",
      "tenantId": "tenant-A",
      "userId": "user-123",
      "requestId": "uuid",
      "correlationId": "uuid"
    }
  }
}
```

### 6. Integração com Slack

**Webhook Slack:**
```json
{
  "text": "🚨 Critical Security Alert",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Critical Security Alert"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Signal Type:* ABUSE"
        },
        {
          "type": "mrkdwn",
          "text": "*Severity:* Critical"
        },
        {
          "type": "mrkdwn",
          "text": "*Tenant:* tenant-A"
        },
        {
          "type": "mrkdwn",
          "text": "*User:* user-123"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Request ID:* `9d631593-90cb-4796-9be5-ed12846d7236`\n*Correlation ID:* `11f9c74e-9b35-4247-92ff-8768f5bbec65`"
      }
    }
  ]
}
```

## Logs Marcados como Security Signals

### AUTH Signals

- ✅ Login success (`info` + `securitySignal: true`, `signalType: AUTH`)
- ✅ Login failure (`warn` + `securitySignal: true`, `signalType: AUTH`)
- ✅ Refresh success (`info` + `securitySignal: true`, `signalType: AUTH`)
- ✅ Refresh failure (`warn` + `securitySignal: true`, `signalType: AUTH`)
- ✅ Token invalidation (`invalidation` + `securitySignal: true`, `signalType: SESSION`)

### RBAC Signals

- ✅ Permission allow (`authzAllow` + `securitySignal: true`, `signalType: RBAC`)
- ✅ Permission deny (`authzDeny` + `securitySignal: true`, `signalType: RBAC`)

### TENANT Signals

- ✅ Cross-tenant violation (`abuse` + `securitySignal: true`, `signalType: TENANT`)
- ✅ Tenant mismatch (`warn` + `securitySignal: true`, `signalType: TENANT`)

### ABUSE Signals

- ✅ Rate limit excedido (`abuse` + `securitySignal: true`, `signalType: ABUSE`)
- ✅ Replay detectado (`abuse` + `securitySignal: true`, `signalType: ABUSE`)

### SESSION Signals

- ✅ Logout (`invalidation` + `securitySignal: true`, `signalType: SESSION`)
- ✅ Token invalidation (`invalidation` + `securitySignal: true`, `signalType: SESSION`)

### EVENT Signals

- ✅ Event rejected (`error` + `securitySignal: true`, `signalType: EVENT`)

## Implementação

### Atualização do CanonicalLogger

**Arquivo:** `backend/src/core/logging/canonical-logger.ts`

**Mudanças:**
- ✅ Interface `SecuritySignalMetadata` adicionada
- ✅ Métodos `abuse`, `invalidation`, `authzAllow`, `authzDeny` agora incluem `securitySignal: true`
- ✅ Métodos `info`, `warn`, `error` detectam eventos de segurança e adicionam metadata automaticamente

**Exemplo de uso:**
```typescript
// Automaticamente marca como securitySignal
canonicalLogger.abuse(req, 'Rate limit excedido', { ip, tenantId });
// Output inclui: securitySignal: true, signalType: 'ABUSE', severity: 'critical'
```

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

### ✅ Pipeline Documentado

- ✅ Coleta de logs (Loki/ELK)
- ✅ Filtragem de sinais (LogQL/KQL)
- ✅ Alertas (Alertmanager)
- ✅ Integração (PagerDuty/Slack)
- ✅ Regras de alerta (Prometheus/Loki)

## Próximos Passos

1. **Implementar exportação:** Criar serviço que exporta logs com `securitySignal: true` para SIEM
2. **Configurar pipeline:** Implementar pipeline real com Loki/ELK
3. **Configurar alertas:** Implementar regras de alerta no Alertmanager
4. **Integrar com SOC:** Conectar com sistema de SOC existente

## Referências

- **Logger Canônico:** `backend/src/core/logging/canonical-logger.ts`
- **Forensics Guide:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Log Classification:** `docs/audit/LOG-LEVEL-CLASSIFICATION.md`
- **Loki Documentation:** https://grafana.com/docs/loki/latest/
- **Alertmanager Documentation:** https://prometheus.io/docs/alerting/latest/alertmanager/

