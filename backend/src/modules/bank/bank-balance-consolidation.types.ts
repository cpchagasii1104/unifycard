// backend/src/modules/bank/bank-balance-consolidation.types.ts
// READ-MODEL: Balanço Financeiro Consolidado
// Status: READ-MODEL PURO (não CORE, não fonte de verdade, não decisório)

/**
 * Filtros opcionais para consolidação de balanço
 */
export interface ConsolidatedBalanceFilters {
  /**
   * Filtrar por moeda específica (ou múltiplas moedas se array)
   */
  currency?: 'BRL' | 'USD' | 'EUR' | 'TEST' | ('BRL' | 'USD' | 'EUR' | 'TEST')[];

  /**
   * Filtrar por tipo de owner
   */
  ownerType?: 'user' | 'company' | 'system' | 'escrow';

  /**
   * Incluir apenas contas ativas (com saldo != 0)
   */
  activeOnly?: boolean;

  /**
   * Data inicial para filtro (opcional)
   */
  startDate?: Date;

  /**
   * Data final para filtro (opcional)
   */
  endDate?: Date;
}

/**
 * Saldo consolidado por tipo de conta (centavos)
 */
export interface BalanceByAccountType {
  userBalanceCents: number;
  companyBalanceCents: number;
  systemBalanceCents: number;
}

/**
 * Saldo consolidado por região (valores em centavos)
 *
 * NOTA: Fundo regional é identificado via:
 * - Contas do sistema com owner_type='system' e owner_id correspondente a 'regional_fund'
 * - Ou via bank_splits com split_type='regional_fund' (agregado por região)
 */
export interface BalanceByRegion {
  [regionId: string]: number;
}

/**
 * Dados de reconciliação (INPUT MANUAL)
 * 
 * NOTA: externalBalance é INPUT MANUAL do administrador.
 * Não é calculado automaticamente.
 */
export interface ReconciliationData {
  /**
   * Saldo interno total (calculado do ledger), centavos
   */
  internalBalanceCents: number;

  /**
   * Saldo bancário externo em centavos (INPUT MANUAL)
   */
  externalBalanceCents?: number | null;

  /**
   * Diferença em centavos (interno − externo) quando externo informado
   */
  differenceCents?: number | null;
}

/**
 * Saldo consolidado por moeda (valores em centavos)
 */
export interface BalanceByCurrency {
  [currency: string]: number;
}

/**
 * Contagem de contas por tipo
 */
export interface AccountCountByType {
  user: number;
  company: number;
  system: number;
}

/**
 * Informações da maior conta
 */
export interface LargestAccount {
  accountId: string;
  ownerId: string;
  ownerType: 'user' | 'company' | 'system' | 'escrow';
  balanceCents: number;
  currency: string;
}

/**
 * Informações da menor conta
 */
export interface SmallestAccount {
  accountId: string;
  ownerId: string;
  ownerType: 'user' | 'company' | 'system' | 'escrow';
  balanceCents: number;
  currency: string;
}

/**
 * Balanço Financeiro Consolidado (READ-MODEL)
 * 
 * REGRAS ABSOLUTAS:
 * - Sempre calculado on-demand (nunca persistido)
 * - Nunca usado para decisões
 * - Nunca substitui o ledger
 * - Ledger é a única fonte da verdade
 * - Este é apenas um READ-MODEL para visualização administrativa
 */
export interface ConsolidatedBalance {
  /**
   * Saldo total do sistema (soma de todas as contas), centavos
   */
  totalSystemBalanceCents: number;

  /**
   * Saldo consolidado por tipo de conta
   */
  byAccountType: BalanceByAccountType;

  /**
   * Saldo consolidado por moeda
   */
  byCurrency: BalanceByCurrency;

  /**
   * Saldo consolidado por região
   * 
   * NOTA: Agregado via contas de sistema regional_fund ou splits regional_fund
   */
  byRegion: BalanceByRegion;

  /**
   * Contagem de contas por tipo
   */
  accountCountByType: AccountCountByType;

  /**
   * Saldo médio por conta (centavos)
   */
  averageBalancePerAccountCents: number;

  /**
   * Maior conta (por saldo)
   */
  largestAccount: LargestAccount | null;

  /**
   * Menor conta (por saldo)
   */
  smallestAccount: SmallestAccount | null;

  /**
   * Dados de reconciliação (INPUT MANUAL)
   */
  reconciliation: ReconciliationData;

  /**
   * Timestamp de cálculo (runtime only, não persistido)
   */
  calculatedAt: string; // ISO 8601

  /**
   * Moeda base da consolidação (ou 'MULTI' se múltiplas moedas)
   */
  currency: string;

  /**
   * Número total de contas consideradas
   */
  totalAccounts: number;
}

