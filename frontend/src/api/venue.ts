// frontend/src/api/venue.ts
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { apiFetch, apiFetchJson } from './client';

export interface Menu {
  id: string;
  tenantId: string;
  actorId: string;
  name: string;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  tenantId: string;
  menuId: string;
  productVariantId: string;
  displayName: string;
  description: string | null;
  isAvailable: boolean;
  sortOrder: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Tab {
  id: string;
  tenantId: string;
  actorId: string;
  openedByContactId: string | null;
  openedByUserId: string | null;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  tableLabel: string | null;
  qrToken: string;
  openedAt: string;
  closedAt: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  status: string;
  totalQuantity: number;
  createdAt: string;
}

export interface TabWithOrders {
  tab: {
    id: string;
    tableLabel: string | null;
    status: string;
    openedAt: string;
  };
  orders: Order[];
}

// Rotas públicas
export async function getPublicMenu(slug: string): Promise<Menu> {
  const response = await apiFetch(`/v/${slug}/menu`);
  return await response.json();
}

export async function openPublicTab(slug: string, input: {
  tableLabel?: string;
  contact?: {
    name: string;
    email?: string;
    phone?: string;
    taxId?: string;
  };
}): Promise<{ qrToken: string; tabId: string }> {
  return await apiFetchJson(`/v/${slug}/tabs/open`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getTabByToken(qrToken: string): Promise<TabWithOrders> {
  const response = await apiFetch(`/t/${qrToken}`);
  return await response.json();
}

export async function createTabOrder(qrToken: string): Promise<{ orderId: string; tabId: string }> {
  return await apiFetchJson(`/t/${qrToken}/orders`, {
    method: 'POST',
  });
}

export async function addItemToTabOrder(
  qrToken: string,
  orderId: string,
  input: {
    productVariantId: string;
    quantity: number;
    unit?: string;
  }
): Promise<any> {
  return await apiFetchJson(`/t/${qrToken}/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function submitTabOrder(qrToken: string, orderId: string): Promise<Order> {
  return await apiFetchJson(`/t/${qrToken}/orders/${orderId}/submit`, {
    method: 'POST',
  });
}

export async function payTabOrder(
  qrToken: string,
  orderId: string,
  input: {
    paymentMethod: 'PIX' | 'UNIFYCARD';
    paymentMethodId?: string;
  }
): Promise<{
  paymentIntentId: string;
  transactionId: string;
  status: string;
  paymentMethod: string;
  pixQrCode: string | null;
  earnedPoints?: number;
}> {
  return await apiFetchJson(`/t/${qrToken}/orders/${orderId}/pay`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}





