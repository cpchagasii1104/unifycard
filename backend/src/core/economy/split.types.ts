// src/core/economy/split.types.ts
//
// Tipos para o sistema de splits econômicos do Unificard

export type SplitTargetType =
  | 'WORKER'
  | 'TENANT'
  | 'PLATFORM'
  | 'REGION'
  | 'GROUP'
  | 'EVENT_ORGANIZER';

export interface SplitRule {
  targetType: SplitTargetType;
  targetIdKey?: 'workerUserId' | 'tenantId' | 'regionId' | 'groupId';
  percentage: number; // 0–1
  description?: string;
}

export interface SplitConfig {
  tenantId: string;
  rules: SplitRule[];
  currency: string;
}

export interface SplitContext {
  tenantId: string;
  amount: number;
  currency: string;
  source: string; // ex: 'work', 'work_instant', 'event_ticket', 'event_consumption'
  customerAccountId: string;
  workerAccountId?: string;
  tenantAccountId?: string;
  regionAccountId?: string;
  groupAccountIds?: string[];
  eventOrganizerAccountId?: string; // Para contexto EVENT
  metadata?: Record<string, any>;
}

export interface SplitResult {
  totalAmount: number;
  splits: Array<{
    rule: SplitRule;
    amount: number;
    transactionId?: string;
  }>;
}








