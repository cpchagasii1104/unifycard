// backend/src/modules/marketplace/fiscal-provider.mock.ts
// SPRINT 45: FISCAL ADAPTER - Provider mock para testes/desenvolvimento

import type {
  FiscalProvider,
  FiscalDocumentData,
  FiscalIssueResult,
  FiscalCancelResult,
  FiscalStatus,
} from './fiscal-provider.interface';

/**
 * Provider mock para emissão fiscal
 * 
 * Simula sucesso/falha baseado em configuração.
 * Útil para desenvolvimento e testes.
 */
class MockFiscalProvider implements FiscalProvider {
  /**
   * Taxa de sucesso (0.0 a 1.0)
   * Por padrão, sempre sucesso
   */
  private successRate: number;

  /**
   * Delay simulado (ms)
   */
  private delayMs: number;

  constructor(successRate: number = 1.0, delayMs: number = 500) {
    this.successRate = successRate;
    this.delayMs = delayMs;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Mock sempre disponível
  }

  async issue(document: FiscalDocumentData): Promise<FiscalIssueResult> {
    // Simular delay de rede
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    // Simular sucesso/falha baseado em taxa
    const shouldSucceed = Math.random() < this.successRate;

    if (shouldSucceed) {
      // Simular sucesso
      const chaveAcesso = `MOCK-${document.documentType}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const protocolo = `MOCK-PROTOCOL-${Date.now()}`;

      return {
        success: true,
        documentId: document.id,
        chaveAcesso,
        protocolo,
        metadata: {
          provider: 'mock',
          issued_at: new Date().toISOString(),
        },
      };
    } else {
      // Simular falha
      return {
        success: false,
        documentId: document.id,
        errorCode: 'MOCK_ERROR',
        errorMessage: 'Erro simulado do provider mock',
        metadata: {
          provider: 'mock',
          failed_at: new Date().toISOString(),
        },
      };
    }
  }

  async cancel(
    documentId: string,
    chaveAcesso?: string,
    reason?: string
  ): Promise<FiscalCancelResult> {
    // Simular delay
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    // Simular sucesso/falha
    const shouldSucceed = Math.random() < this.successRate;

    if (shouldSucceed) {
      return {
        success: true,
        documentId,
        protocoloCancelamento: `MOCK-CANCEL-${Date.now()}`,
        metadata: {
          provider: 'mock',
          cancelled_at: new Date().toISOString(),
          reason,
        },
      };
    } else {
      return {
        success: false,
        documentId,
        errorCode: 'MOCK_CANCEL_ERROR',
        errorMessage: 'Erro simulado ao cancelar',
        metadata: {
          provider: 'mock',
          failed_at: new Date().toISOString(),
        },
      };
    }
  }

  async getStatus(
    documentId: string,
    chaveAcesso?: string
  ): Promise<FiscalStatus> {
    // Simular delay
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    // Mock sempre retorna AUTHORIZED se chaveAcesso existe
    return {
      documentId,
      status: chaveAcesso ? 'AUTHORIZED' : 'UNKNOWN',
      chaveAcesso,
      protocolo: chaveAcesso ? `MOCK-PROTOCOL-${documentId}` : undefined,
      metadata: {
        provider: 'mock',
        checked_at: new Date().toISOString(),
      },
    };
  }
}

export const mockFiscalProvider = new MockFiscalProvider();







