// backend/src/modules/automation/automation.types.ts
// SPRINT 50: AUTOMAÇÕES OPERACIONAIS (CANÔNICAS)

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — convergido para minúsculo em 2026-08-02
// ║ NORMA:   07_NOMENCLATURA §4.77 (emenda ratificada por Clayton): alert_type é TIPO, não
// ║          severity — segue o padrão lowercase de TODAS as seções de tipo. A única exceção
// ║          MAIÚSCULA da norma é a §4.34 (severity/priority), logo abaixo.
// ║ NÃO:     voltar a MAIÚSCULO, nem deduzir o case desta união pelo vizinho AlertSeverity.
// ║ EM VEZ:  minúsculo, igual ao enum físico. pg_get_constraintdef antes de acrescentar valor.
// ╚════════════════════════════════════════════════════════════════
export type AlertType =
  | 'inventory_low_stock'
  | 'inventory_out_of_stock'
  | 'payment_failed'
  | 'payout_failed'
  | 'fiscal_pending'
  | 'order_expired'
  | 'reservation_expired'
  | 'risk_score_low' // SPRINT 66: Alerta para score baixo
  | 'other';

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


