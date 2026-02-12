// backend/src/modules/pdv/pdv.types.ts
// SPRINT 42.1: PDV CORE - Venda por Peso + Caixa Simples
// Tipos TypeScript para PDV

export type PdvSessionStatus = 'OPEN' | 'CLOSED';

export interface PdvSession {
  id: string;
  tenantId: string;
  actorId: string;
  status: PdvSessionStatus;
  openedAt: Date;
  closedAt: Date | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePdvSessionInput {
  actorId: string;
  metadata?: Record<string, any>;
}

export interface ClosePdvSessionInput {
  metadata?: Record<string, any>;
}

export interface CreateOrderFromPdvInput {
  sessionId: string;
  buyerActorId: string;
  sellerActorId: string;
  metadata?: Record<string, any>;
}

export interface AddItemByVariantInput {
  sessionId: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unit?: string;
}

export interface AddItemByWeightInput {
  sessionId: string;
  orderId: string;
  variantId: string;
  weight: number; // em kg
  unit?: string; // padrão: 'KG'
}

export interface PayOrderFromPdvInput {
  sessionId: string;
  orderId: string;
  amountCents: number;
  currency?: string; // padrão: 'BRL'
  buyerActorId: string;
  sellerActorId: string;
  idempotencyKey?: string;
}

export interface PdvSessionSummary {
  session: PdvSession;
  operator: {
    actorId: string;
  };
  openedAt: Date;
  closedAt: Date | null;
  totalOrders: number;
  totalPaid: number;
  totalFailed: number;
  orders: Array<{
    id: string;
    status: string;
    amountCents: number | null;
    paymentStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'NONE';
    createdAt: string;
  }>;
}



