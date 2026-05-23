export type DiscoveryWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export interface DiscoveryAvailabilityBlock {
  weekday: DiscoveryWeekday;
  slots: string[];
}

export type ServiceDiscoveryRequestStatus = 'pending' | 'accepted' | 'rejected';

/** Estado de pagamento (colunas em service_discovery_requests). */
export type ServiceDiscoveryPaymentStatus = 'pending' | 'paid';

export interface ServiceDiscoveryRequestRow {
  id: string;
  tenant_id: string;
  service_id: string;
  customer_actor_id: string;
  requested_start: Date;
  status: string;
  created_at: Date;
  responded_at: Date | null;
  payment_status?: string | null;
  payment_bank_transaction_id?: string | null;
  paid_at?: Date | null;
}