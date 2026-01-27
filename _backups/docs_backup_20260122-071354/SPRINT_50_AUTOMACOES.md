# SPRINT 50: AUTOMAÇÕES OPERACIONAIS (CANÔNICAS)

## RESUMO EXECUTIVO

Implementado sistema de automações operacionais canônicas:
- ✅ Tabela `alerts` para alertas
- ✅ `AutomationService` com motor de eventos
- ✅ `AlertService` para gerenciar alertas
- ✅ Integração com payment-execution e payout quando falham
- ✅ UI com badge no dashboard e página de alertas

## ARQUIVOS CRIADOS/ALTERADOS

### Backend

1. **`backend/migrations/185_create_alerts.sql`** (NOVO)
   - Tabela `alerts`
   - Enums: `alert_type`, `alert_severity`, `alert_status`
   - Campos: `id`, `tenant_id`, `type`, `severity`, `message`, `entity_type`, `entity_id`, `status`, `metadata`, `created_at`, `acknowledged_at`, `resolved_at`, `updated_at`
   - RLS e índices

2. **`backend/src/modules/automation/automation.types.ts`** (NOVO)
   - Tipos TypeScript para automações e alertas
   - `AlertType`, `AlertSeverity`, `AlertStatus`, `Alert`, `CreateAlertInput`, `UpdateAlertStatusInput`, `AlertFilters`, `AutomationEvent`

3. **`backend/src/modules/automation/alert.repository.ts`** (NOVO)
   - Repository para alertas
   - Métodos: `createAlert`, `updateAlertStatus`, `getAlertById`, `listAlerts`, `countOpenAlerts`

4. **`backend/src/modules/automation/alert.service.ts`** (NOVO)
   - Service para gerenciar alertas
   - Métodos: `createAlert`, `updateAlertStatus`, `getAlertById`, `listAlerts`, `countOpenAlerts`

5. **`backend/src/modules/automation/automation.service.ts`** (NOVO)
   - Service principal para automações
   - Método: `processEvent()` que escuta eventos e gera alertas
   - Handlers: `handleInventoryAlert`, `handlePaymentFailed`, `handlePayoutFailed`, `handleFiscalPending`, `handleOrderExpired`, `handleReservationExpired`

6. **`backend/src/modules/automation/automation.routes.ts`** (NOVO)
   - Rotas REST:
     - `GET /automation/alerts` - Lista alertas
     - `GET /automation/alerts/count` - Conta alertas abertos
     - `GET /automation/alerts/:id` - Busca alerta por ID
     - `POST /automation/alerts` - Cria alerta
     - `PATCH /automation/alerts/:id/status` - Atualiza status do alerta

7. **`backend/src/modules/marketplace/payment-execution.service.ts`** (ALTERADO)
   - Integração com `AutomationService` quando pagamento falha
   - Gera alerta `PAYMENT_FAILED` automaticamente

8. **`backend/src/modules/marketplace/payout.service.ts`** (ALTERADO)
   - Integração com `AutomationService` quando payout falha
   - Gera alerta `PAYOUT_FAILED` automaticamente

9. **`backend/src/server.ts`** (ALTERADO)
   - Registrado módulo de automações em `/automation`

### Frontend

10. **`frontend/src/api/automation.ts`** (NOVO)
    - API client para alertas
    - Funções: `listAlerts`, `countOpenAlerts`, `getAlertById`, `updateAlertStatus`

11. **`frontend/src/pages/AlertsPage.tsx`** (NOVO)
    - Página de alertas operacionais
    - Filtros por status (ALL, OPEN, ACK, RESOLVED)
    - Ações: Reconhecer (ACK), Resolver (RESOLVED)

12. **`frontend/src/pages/AlertsPage.css`** (NOVO)
    - Estilos para página de alertas

13. **`frontend/src/pages/DashboardPage.tsx`** (ALTERADO)
    - Badge de alertas no header
    - Contagem de alertas abertos
    - Link para página de alertas

14. **`frontend/src/pages/DashboardPage.css`** (ALTERADO)
    - Estilos para badge de alertas

15. **`frontend/src/App.tsx`** (ALTERADO)
    - Rota `/alerts` adicionada

## REGRAS ARQUITETURAIS

### ✅ Não Executa Economia Automaticamente

- Automações apenas geram alertas
- Não criam pagamentos, cancelam pedidos ou emitem fiscais
- Humano decide o que fazer

### ✅ Não Toma Decisão Irreversível

- Alertas são apenas notificações
- Resolução é manual
- Nenhuma ação automática perigosa

### ✅ Automação Só Alerta, Registra ou Muda Estado Simples

- Gerar alerta (tabela `alerts`)
- Registrar evento institucional (audit)
- Marcar status (ex: ATTENTION_REQUIRED) - não implementado ainda

## EVENTOS MONITORADOS

### 1. Estoque Crítico

- `INVENTORY_LOW_STOCK`: Estoque < 10
- `INVENTORY_OUT_OF_STOCK`: Estoque = 0
- Severidade: MEDIUM (baixo) / HIGH (zerado)

### 2. Pagamento Falho

- `PAYMENT_FAILED`: Quando `payment_execution` falha
- Severidade: HIGH
- Contexto: `orderId`, `errorCode`, `amount`

### 3. Payout Falho

- `PAYOUT_FAILED`: Quando `payout` falha
- Severidade: HIGH
- Contexto: `paymentIntentId`, `recipientActorId`, `errorCode`, `amount`

### 4. Fiscal Pendente

- `FISCAL_PENDING`: Documento fiscal pendente
- Severidade: MEDIUM
- Contexto: `orderId`, `documentType`

### 5. Pedido Expirado

- `ORDER_EXPIRED`: Pedido expirado
- Severidade: LOW
- Contexto: `orderId`

### 6. Reserva Expirada

- `RESERVATION_EXPIRED`: Reserva de estoque expirada
- Severidade: LOW
- Contexto: `orderId`

## FLUXO DE AUTOMAÇÃO

### 1. Evento Ocorre

```typescript
// Exemplo: Pagamento falha
catch (error) {
  // ... tratamento de erro ...
  
  // SPRINT 50: Gerar alerta automático
  await automationService.processEvent(tenantId, {
    eventType: 'PAYMENT_FAILED',
    tenantId,
    entityType: 'payment',
    entityId: paymentTransaction.id,
    context: { orderId, errorCode, amount },
  });
}
```

### 2. AutomationService Processa

```typescript
// AutomationService.processEvent()
if (event.eventType === 'PAYMENT_FAILED') {
  await this.handlePaymentFailed(tenantId, event);
}
```

### 3. Alerta Criado

```typescript
// handlePaymentFailed()
await alertService.createAlert(tenantId, {
  type: 'PAYMENT_FAILED',
  severity: 'HIGH',
  message: 'Pagamento falhou...',
  entityType: 'payment',
  entityId: event.entityId,
  metadata: { ... },
});
```

### 4. Evento Institucional Registrado

```typescript
await auditService.record(tenantId, {
  event_type: 'AUTOMATION_ALERT_CREATED',
  severity: 'HIGH',
  source: 'automation',
  context: { ... },
});
```

## ENDPOINTS

### GET /automation/alerts

Lista alertas com filtros.

**Query params:**
- `type`: Tipo de alerta (opcional)
- `severity`: Severidade (opcional)
- `status`: Status (OPEN, ACK, RESOLVED) (opcional)
- `entityType`: Tipo da entidade (opcional)
- `entityId`: ID da entidade (opcional)
- `limit`: Limite (opcional)
- `offset`: Offset (opcional)

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "type": "PAYMENT_FAILED",
      "severity": "HIGH",
      "message": "Pagamento falhou...",
      "status": "OPEN",
      "entityType": "payment",
      "entityId": "uuid",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### GET /automation/alerts/count

Conta alertas abertos.

**Query params:**
- `severity`: Severidade (opcional)

**Response:**
```json
{
  "count": 5
}
```

### PATCH /automation/alerts/:id/status

Atualiza status do alerta.

**Body:**
```json
{
  "status": "ACK",
  "reason": "Verificado manualmente"
}
```

## FRONTEND

### Badge no Dashboard

- Exibe contagem de alertas abertos
- Clique navega para `/alerts`
- Cor vermelha para destaque

### Página de Alertas

- Filtros: Todos, Abertos, Reconhecidos, Resolvidos
- Lista de alertas com:
  - Severidade (badge colorido)
  - Tipo
  - Mensagem
  - Entidade relacionada
  - Data
- Ações:
  - **Reconhecer** (ACK): Marca como visualizado
  - **Resolver** (RESOLVED): Marca como resolvido

## INTEGRAÇÕES

### Payment Execution

```typescript
// payment-execution.service.ts
catch (error) {
  // ... tratamento ...
  
  // SPRINT 50: Gerar alerta
  await automationService.processEvent(tenantId, {
    eventType: 'PAYMENT_FAILED',
    // ...
  });
}
```

### Payout

```typescript
// payout.service.ts
catch (error) {
  // ... tratamento ...
  
  // SPRINT 50: Gerar alerta
  await automationService.processEvent(tenantId, {
    eventType: 'PAYOUT_FAILED',
    // ...
  });
}
```

## OBSERVAÇÕES

1. **Sistema "grita"**: Alertas são gerados automaticamente quando algo sai do normal
2. **Humano decide**: Resolução é manual, sistema não toma decisões
3. **Nenhuma automação perigosa**: Apenas alertas, sem ações econômicas
4. **Auditável**: Todos os alertas são registrados em `audit_events`
5. **Previsível**: Sem IA, sem heurística, sem decisão implícita

## PRÓXIMOS PASSOS

- [ ] Integrar monitoramento de estoque crítico (cron job ou evento)
- [ ] Integrar monitoramento de fiscal pendente
- [ ] Integrar monitoramento de pedidos/reservas expiradas
- [ ] Adicionar notificações push/email para alertas críticos
- [ ] Adicionar dashboard de alertas por tipo/severidade





