// backend/src/modules/marketplace/fiscal-provider.interface.ts
// SPRINT 45: FISCAL ADAPTER - Interface canônica para providers fiscais

import type {
  FiscalDocumentData,
  FiscalIssueResult,
  FiscalCancelResult,
  FiscalStatus,
} from './fiscal-provider.types';

export type { FiscalDocumentData, FiscalIssueResult, FiscalCancelResult, FiscalStatus };

/**
 * Interface canônica para providers fiscais externos
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Provider é opcional e falhável
 * - Core não conhece SEFAZ
 * - Falha externa não derruba sistema
 * - Provider é plugável (mock, SEFAZ real, etc.)
 */
export interface FiscalProvider {
  /**
   * Emite documento fiscal no sistema externo
   * 
   * @param document Dados do documento fiscal
   * @returns Resultado da emissão (sucesso ou falha)
   */
  issue(document: FiscalDocumentData): Promise<FiscalIssueResult>;

  /**
   * Cancela documento fiscal no sistema externo
   * 
   * @param documentId ID do documento fiscal
   * @param chaveAcesso Chave de acesso (se disponível)
   * @param reason Motivo do cancelamento
   * @returns Resultado do cancelamento
   */
  cancel(
    documentId: string,
    chaveAcesso?: string,
    reason?: string
  ): Promise<FiscalCancelResult>;

  /**
   * Consulta status do documento no sistema externo
   * 
   * @param documentId ID do documento fiscal
   * @param chaveAcesso Chave de acesso (se disponível)
   * @returns Status atual do documento
   */
  getStatus(documentId: string, chaveAcesso?: string): Promise<FiscalStatus>;

  /**
   * Verifica se provider está disponível/configurado
   * 
   * @returns true se provider está disponível
   */
  isAvailable(): Promise<boolean>;
}







