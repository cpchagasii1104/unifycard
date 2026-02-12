// CONTRATO PÚBLICO CONGELADO - ResourceCompensation (Compensação de Recurso)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * Modelo de compensação por recurso
 */
export type CompensationModel = 
  | 'none' // Prestador solo / dono da empresa (100% do valor fica na empresa)
  | 'fixed_percent' // Percentual do valor do serviço
  | 'fixed_value' // Valor fixo por execução
  | 'salary' // Funcionário assalariado (não gera repasse por serviço)
  | 'mixed'; // Salário + variável por execução

/**
 * Configuração de compensação de um recurso
 */
export interface ResourceCompensationConfig {
  resourceId: string;
  compensationModel: CompensationModel;
  
  // Para fixed_percent
  percentValueBps?: number; // Percentual (0-100)
  
  // Para fixed_value
  fixedAmountCents?: number; // Valor fixo em centavos
  currency?: string; // Moeda (padrão: BRL)
  
  // Para salary
  monthlySalaryCents?: number; // Salário mensal em centavos
  
  // Para mixed
  baseSalaryCents?: number; // Salário base mensal
  variablePercentBps?: number; // Percentual variável sobre o valor do serviço
  
  // Regras adicionais
  minCompensationCents?: number; // Compensação mínima por serviço (em centavos)
  maxCompensationCents?: number; // Compensação máxima por serviço (em centavos)
  
  isActive: boolean;
  effectiveFrom: string; // Data de início da vigência
  effectiveUntil?: string; // Data de fim da vigência (opcional)
  
  createdAt: string;
  updatedAt: string;
  immutable: false; // Configuração pode ser atualizada
}

/**
 * Repasse interno registrado após conclusão de serviço
 */
export interface ResourceCompensation {
  compensationId: string;
  resourceId: string;
  serviceOrderId: string; // ServiceOrder que gerou a compensação
  serviceBookingId: string; // ServiceBooking associado
  storeId: string; // Empresa que repassa
  
  // Valor do serviço
  serviceValue: {
    amountCents: number; // Em centavos
    currency: string;
  };
  
  // Compensação calculada
  compensationAmount: {
    amountCents: number; // Em centavos
    currency: string;
  };
  
  // Modelo usado
  compensationModel: CompensationModel;
  calculationDetails: {
    baseValue?: number;
    percentApplied?: number;
    fixedValueApplied?: number;
    adjustments?: Array<{
      type: 'min_limit' | 'max_limit' | 'salary_adjustment';
      amountCents: number;
      reason: string;
    }>;
  };
  
  // Status do repasse
  status: 'calculated' | 'pending' | 'paid' | 'cancelled';
  paidAt?: string;
  
  // Referência ao ledger
  ledgerEntryId?: string; // ID da entrada no ledger (tipo: resource_compensation)
  
  createdAt: string;
  updatedAt: string;
  immutable: true; // Compensação é imutável após criação
}

/**
 * Histórico de compensações por recurso
 */
export interface ResourceCompensationHistory {
  resourceId: string;
  period: {
    start: string;
    end: string;
  };
  
  compensations: ResourceCompensation[];
  
  // Totais agregados
  totalServices: number;
  totalCompensation: {
    amountCents: number; // Em centavos
    currency: string;
  };
  averagePerService: {
    amountCents: number;
    currency: string;
  };
  
  // Por modelo
  byModel: Record<CompensationModel, {
    count: number;
    totalCents: number;
  }>;
  
  generatedAt: string;
  immutable: true; // Histórico é snapshot imutável
}

/**
 * Relatório contábil de compensações por empresa
 */
export interface CompanyCompensationReport {
  companyId: string;
  storeId: string;
  period: {
    start: string;
    end: string;
  };
  
  // Totais
  totalCompensationsPaid: {
    amountCents: number; // Em centavos
    currency: string;
  };
  totalResources: number;
  totalServices: number;
  
  // Por recurso
  byResource: Array<{
    resourceId: string;
    resourceName: string;
    compensationModel: CompensationModel;
    servicesCount: number;
    totalCompensation: {
      amountCents: number;
      currency: string;
    };
  }>;
  
  // Por modelo
  byModel: Record<CompensationModel, {
    resourcesCount: number;
    servicesCount: number;
    totalCompensation: {
      amountCents: number;
      currency: string;
    };
  }>;
  
  generatedAt: string;
  immutable: true; // Relatório é snapshot imutável
}




