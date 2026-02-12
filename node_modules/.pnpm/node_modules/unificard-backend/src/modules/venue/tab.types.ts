// backend/src/modules/venue/tab.types.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

export type TabStatus = 'OPEN' | 'CLOSED' | 'CANCELLED';

export interface Tab {
  id: string;
  tenantId: string;
  actorId: string;
  openedByContactId: string | null;
  openedByUserId: string | null;
  status: TabStatus;
  tableLabel: string | null;
  qrToken: string;
  openedAt: Date;
  closedAt: Date | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OpenTabInput {
  actorId: string;
  tableLabel?: string;
  contactId?: string;
  metadata?: Record<string, any>;
}

export interface TabFilters {
  actorId?: string;
  status?: TabStatus;
  limit?: number;
  offset?: number;
}

export interface TabWithOrders extends Tab {
  orders: Array<{
    id: string;
    orderId: string;
    createdAt: string;
  }>;
}






