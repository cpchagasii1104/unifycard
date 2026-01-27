// backend/src/contracts/marketplace/PluginDefinition.contract.ts
// CONTRATO PÚBLICO CONGELADO - PluginDefinition (Definição de Plugin Canônico)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

/**
 * PluginDefinition - Definição de Plugin Canônico
 * 
 * Define plugins que podem estender o sistema sem alterar o core.
 * Plugins são sandboxed e só podem consumir contratos públicos.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export type PluginCategory = 'pricing_helper' | 'category_specific_ui' | 'compliance_extensions' | 'reports_extensions';

export type PluginHook = 
  | 'before_order_created'
  | 'after_order_created'
  | 'before_checkout_created'
  | 'after_checkout_created'
  | 'before_payment_plan_created'
  | 'after_payment_plan_created'
  | 'before_product_display'
  | 'after_product_display'
  | 'before_service_booking'
  | 'after_service_booking'
  | 'before_report_generation'
  | 'after_report_generation';

export interface PluginDefinition {
  plugin_id: string;
  name: string;
  description: string;
  category: PluginCategory;
  version: string;
  allowed_hooks: PluginHook[];
  allowed_contracts: string[]; // IDs de contratos públicos que o plugin pode consumir
  status: 'active' | 'inactive' | 'deprecated';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>; // Metadados específicos do plugin
}

export interface PluginExecution {
  execution_id: string;
  plugin_id: string;
  hook: PluginHook;
  input_data: Record<string, any>; // Dados de entrada (apenas contratos públicos)
  output_data?: Record<string, any>; // Dados de saída (não pode alterar ledger/trust/payment)
  status: 'pending' | 'executed' | 'failed';
  executed_at?: string;
  error_message?: string;
}





