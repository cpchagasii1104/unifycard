// backend/src/core/unifybank/split-engine.types.ts
// Tipos para Split Engine Avançado
// FASE 5: Split Engine Avançado

export type SplitContextType = 'donation' | 'service' | 'event' | 'marketplace';

export type SplitTargetType = 'user' | 'group' | 'project' | 'regional_fund' | 'platform';

export interface SplitRule {
  id: string;
  context: SplitContextType;
  cityId?: string;
  module?: string;
  rules: Array<{
    targetType: SplitTargetType;
    targetId?: string; // Obrigatório para user/group/project, opcional para regional_fund/platform
    percentage: number; // 0.0 a 1.0 (soma total deve ser 1.0)
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplySplitInput {
  baseTransactionId: string;
  amount: number;
  context: SplitContextType;
  metadata?: Record<string, any>;
  splitRuleId?: string; // Se não fornecido, usa regra padrão para o contexto
  tenantId: string;
}

export interface SplitEntry {
  ruleId: string;
  targetType: SplitTargetType;
  targetId?: string;
  percentage: number;
  amount: number;
  accountId: string;
  transactionId: string;
  ledgerEntryId: string;
}

export interface ApplySplitResult {
  splitGroupId: string; // ID único para agrupar todos os splits desta operação
  baseTransactionId: string;
  totalAmount: number;
  entries: SplitEntry[];
  createdAt: Date;
}

export interface CompensateTransactionInput {
  originTransactionId: string;
  reason: string;
  metadata?: Record<string, any>;
  tenantId: string;
}

export interface CompensateTransactionResult {
  compensationTransactionId: string;
  originTransactionId: string;
  reversedEntries: Array<{
    originalEntryId: string;
    compensationEntryId: string;
  }>;
  createdAt: Date;
}















