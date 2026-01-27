// backend/src/modules/automation/automation.types.ts
// SPRINT 50: AUTOMAÇÕES OPERACIONAIS (CANÔNICAS)

export type AlertType =
  | 'INVENTORY_LOW_STOCK'
  | 'INVENTORY_OUT_OF_STOCK'
  | 'PAYMENT_FAILED'
  | 'PAYOUT_FAILED'
  | 'FISCAL_PENDING'
  | 'ORDER_EXPIRED'
  | 'RESERVATION_EXPIRED'
  | 'RISK_SCORE_LOW' // SPRINT 66: Alerta para score baixo
  | 'OTHER';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACK' | 'RESOLVED';

export interface Alert {
  id: string;
  tenantId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  entityType: string | null;
  entityId: string | null;
  status: AlertStatus;
  metadata: Record<string, any> | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  updatedAt: Date;
}

export interface CreateAlertInput {
  type: AlertType;
  severity?: AlertSeverity;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateAlertStatusInput {
  status: AlertStatus;
  reason?: string;
}

export interface AlertFilters {
  type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

export interface AutomationEvent {
  eventType: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  context: Record<string, any>;
}

