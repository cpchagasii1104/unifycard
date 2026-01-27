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
  resource_id: string;
  compensation_model: CompensationModel;
  
  // Para fixed_percent
  percent_value?: number; // Percentual (0-100)
  
  // Para fixed_value
  fixed_amount?: number; // Valor fixo em centavos
  currency?: string; // Moeda (padrão: BRL)
  
  // Para salary
  monthly_salary?: number; // Salário mensal em centavos
  
  // Para mixed
  base_salary?: number; // Salário base mensal
  variable_percent?: number; // Percentual variável sobre o valor do serviço
  
  // Regras adicionais
  min_compensation?: number; // Compensação mínima por serviço (em centavos)
  max_compensation?: number; // Compensação máxima por serviço (em centavos)
  
  active: boolean;
  effective_from: string; // Data de início da vigência
  effective_until?: string; // Data de fim da vigência (opcional)
  
  created_at: string;
  updated_at: string;
  immutable: false; // Configuração pode ser atualizada
}

/**
 * Repasse interno registrado após conclusão de serviço
 */
export interface ResourceCompensation {
  compensation_id: string;
  resource_id: string;
  service_order_id: string; // ServiceOrder que gerou a compensação
  service_booking_id: string; // ServiceBooking associado
  store_id: string; // Empresa que repassa
  
  // Valor do serviço
  service_value: {
    amount: number; // Em centavos
    currency: string;
  };
  
  // Compensação calculada
  compensation_amount: {
    amount: number; // Em centavos
    currency: string;
  };
  
  // Modelo usado
  compensation_model: CompensationModel;
  calculation_details: {
    base_value?: number;
    percent_applied?: number;
    fixed_value_applied?: number;
    adjustments?: Array<{
      type: 'min_limit' | 'max_limit' | 'salary_adjustment';
      amount: number;
      reason: string;
    }>;
  };
  
  // Status do repasse
  status: 'calculated' | 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  
  // Referência ao ledger
  ledger_entry_id?: string; // ID da entrada no ledger (tipo: resource_compensation)
  
  created_at: string;
  updated_at: string;
  immutable: true; // Compensação é imutável após criação
}

/**
 * Histórico de compensações por recurso
 */
export interface ResourceCompensationHistory {
  resource_id: string;
  period: {
    start: string;
    end: string;
  };
  
  compensations: ResourceCompensation[];
  
  // Totais agregados
  total_services: number;
  total_compensation: {
    amount: number; // Em centavos
    currency: string;
  };
  average_per_service: {
    amount: number;
    currency: string;
  };
  
  // Por modelo
  by_model: Record<CompensationModel, {
    count: number;
    total: number;
  }>;
  
  generated_at: string;
  immutable: true; // Histórico é snapshot imutável
}

/**
 * Relatório contábil de compensações por empresa
 */
export interface CompanyCompensationReport {
  company_id: string;
  store_id: string;
  period: {
    start: string;
    end: string;
  };
  
  // Totais
  total_compensations_paid: {
    amount: number; // Em centavos
    currency: string;
  };
  total_resources: number;
  total_services: number;
  
  // Por recurso
  by_resource: Array<{
    resource_id: string;
    resource_name: string;
    compensation_model: CompensationModel;
    services_count: number;
    total_compensation: {
      amount: number;
      currency: string;
    };
  }>;
  
  // Por modelo
  by_model: Record<CompensationModel, {
    resources_count: number;
    services_count: number;
    total_compensation: {
      amount: number;
      currency: string;
    };
  }>;
  
  generated_at: string;
  immutable: true; // Relatório é snapshot imutável
}




