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

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34
// ║ NÃO:     valores lowercase (low/medium/high/critical — vocabulário de priority, não severity)
// ║ EM VEZ:  CRITICAL/ERROR/WARNING/INFO/AUDIT (severity ≠ priority — §4.34)
// ╚════════════════════════════════════════════════════════════════
export type AlertSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO' | 'AUDIT';

export type AlertStatus = 'open' | 'ack' | 'resolved';

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
  createdAt: string;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  updatedAt: string;
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


