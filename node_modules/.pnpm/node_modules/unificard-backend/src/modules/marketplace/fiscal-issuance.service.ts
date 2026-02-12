// backend/src/modules/marketplace/fiscal-issuance.service.ts
// SPRINT 45: FISCAL ADAPTER - Service para emissão fiscal externa

import { fiscalDocumentRepository } from './fiscal-document.repository';
import { fiscalProviderAttemptRepository } from './fiscal-provider-attempt.repository';
import type {
  FiscalProvider,
  FiscalDocumentData,
} from './fiscal-provider.interface';
import type { FiscalDocument } from './fiscal-document.types';

/**
 * Service para emissão fiscal externa
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Core não conhece SEFAZ
 * - Provider é opcional e falhável
 * - Falha externa não derruba sistema
 * - Provider é plugável (mock, SEFAZ real, etc.)
 */
class FiscalIssuanceService {
  private provider: FiscalProvider | null = null;

  /**
   * Resolve provider baseado em configuração
   * 
   * Por padrão, usa MockFiscalProvider.
   * Futuro: pode usar SEFAZ real baseado em env.
   */
  private async resolveProvider(): Promise<FiscalProvider | null> {
    // Se já resolvido, retornar
    if (this.provider) {
      return this.provider;
    }

    // SPRINT 45: Por padrão, usar mock
    // Futuro: verificar env/config para usar provider real
    const providerType = process.env.FISCAL_PROVIDER || 'mock';

    if (providerType === 'mock') {
      const { mockFiscalProvider } = await import('./fiscal-provider.mock');
      this.provider = mockFiscalProvider;
      return this.provider;
    }

    // SPRINT 53: Provider SEFAZ
    if (providerType === 'sefaz') {
      const { sefazFiscalProvider } = await import('./fiscal-provider.sefaz');
      this.provider = sefazFiscalProvider;
      return this.provider;
    }

    // Se não configurado, retornar null (não falha)
    console.warn(`[FiscalIssuance] Provider fiscal não configurado: ${providerType}`);
    return null;
  }

  /**
   * Emite documento fiscal no sistema externo
   * 
   * Regras:
   * - Se provider não disponível → não falha, apenas log
   * - Se provider falhar → registrar erro, não quebrar venda
   */
  async issueDocument(
    tenantId: string,
    documentId: string
  ): Promise<void> {
    // 1. Buscar documento
    const document = await fiscalDocumentRepository.getDocumentById(tenantId, documentId);
    if (!document) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    // Aceitar documentos em DRAFT ou ISSUED (que acabaram de ser emitidos internamente)
    // Se já tem chave_acesso, não precisa emitir novamente
    if (document.status === 'CANCELLED') {
      // Documento cancelado, não pode emitir
      return;
    }

    if (document.metadata?.chave_acesso) {
      // Documento já foi emitido externamente (tem chave_acesso)
      return;
    }

    // 2. Resolver provider
    const provider = await this.resolveProvider();
    if (!provider) {
      console.warn(`[FiscalIssuance] Provider não disponível. Documento ${documentId} não será emitido externamente.`);
      return;
    }

    // 3. Verificar se provider está disponível
    const isAvailable = await provider.isAvailable();
    if (!isAvailable) {
      console.warn(`[FiscalIssuance] Provider não está disponível. Documento ${documentId} não será emitido externamente.`);
      return;
    }

    // 4. Buscar itens do documento
    const items = await fiscalDocumentRepository.listItemsByDocument(tenantId, documentId);

    // 5. Preparar dados para provider
    const documentData: FiscalDocumentData = {
      id: document.id,
      tenantId: document.tenantId,
      orderId: document.orderId,
      paymentIntentId: document.paymentIntentId,
      documentType: document.documentType,
      totalAmount: document.totalAmount,
      items: items.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unit: item.unit,
        metadata: item.metadata || undefined,
      })),
      metadata: document.metadata || undefined,
    };

    // 6. Chamar provider (não bloqueia se falhar)
    let attemptId: string | null = null;
    try {
      const result = await provider.issue(documentData);

      // SPRINT 53: Registrar tentativa
      const attempt = await fiscalProviderAttemptRepository.createAttempt(tenantId, {
        fiscalDocumentId: documentId,
        provider: (process.env.FISCAL_PROVIDER || 'mock') as 'mock' | 'sefaz',
        action: 'ISSUE',
        status: result.success ? 'SUCCESS' : result.errorCode === 'SEFAZ_DISABLED' ? 'SKIPPED' : 'FAILED',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        metadata: {
          payload_size: JSON.stringify(documentData).length,
          result_metadata: result.metadata,
        },
      });
      attemptId = attempt.id;

      if (result.success) {
        // Atualizar documento com dados do provider
        await fiscalDocumentRepository.updateDocumentStatus(
          tenantId,
          documentId,
          'ISSUED',
          {
            chave_acesso: result.chaveAcesso,
            protocolo: result.protocolo,
            xml: result.xml,
            provider_metadata: result.metadata,
            issued_externallyAt: new Date().toISOString(),
            attempt_id: attemptId, // SPRINT 53: Referência à tentativa
          }
        );
      } else {
        // SPRINT 53: Tentativa já registrada acima, apenas atualizar documento
        // Falha na emissão externa
        // Registrar erro mas não quebrar venda
        await fiscalDocumentRepository.updateDocumentStatus(
          tenantId,
          documentId,
          'DRAFT', // Mantém DRAFT se falhar
          {
            provider_error: result.errorCode,
            provider_error_message: result.errorMessage,
            provider_metadata: result.metadata,
            failedAt: new Date().toISOString(),
            attempt_id: attemptId, // SPRINT 53: Referência à tentativa
          }
        );

        console.error(
          `[FiscalIssuance] Falha ao emitir documento ${documentId} no provider externo:`,
          result.errorCode,
          result.errorMessage
        );
      }
    } catch (error: any) {
      // SPRINT 53: Registrar tentativa com erro
      try {
        await fiscalProviderAttemptRepository.createAttempt(tenantId, {
          fiscalDocumentId: documentId,
          provider: (process.env.FISCAL_PROVIDER || 'mock') as 'mock' | 'sefaz',
          action: 'ISSUE',
          status: 'FAILED',
          errorCode: 'PROVIDER_EXCEPTION',
          errorMessage: error.message || 'Erro inesperado no provider',
          metadata: {
            exception: error.message,
            stack: error.stack,
          },
        });
      } catch (attemptError) {
        // Se falhar ao registrar tentativa, apenas log (não quebrar)
        console.warn(`[FiscalIssuance] Erro ao registrar tentativa:`, attemptError);
      }

      // Erro inesperado do provider
      // Registrar mas não quebrar venda
      await fiscalDocumentRepository.updateDocumentStatus(
        tenantId,
        documentId,
        'DRAFT', // Mantém DRAFT se falhar
        {
          provider_error: 'PROVIDER_EXCEPTION',
          provider_error_message: error.message || 'Erro inesperado no provider',
          failedAt: new Date().toISOString(),
        }
      );

      console.error(
        `[FiscalIssuance] Exceção ao emitir documento ${documentId} no provider externo:`,
        error
      );
    }
  }

  /**
   * Cancela documento fiscal no sistema externo
   */
  async cancelDocument(
    tenantId: string,
    documentId: string,
    reason?: string
  ): Promise<void> {
    // 1. Buscar documento
    const document = await fiscalDocumentRepository.getDocumentById(tenantId, documentId);
    if (!document) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    if (document.status !== 'ISSUED') {
      // Documento não está emitido, não precisa cancelar externamente
      return;
    }

    // 2. Resolver provider
    const provider = await this.resolveProvider();
    if (!provider) {
      console.warn(`[FiscalIssuance] Provider não disponível. Documento ${documentId} não será cancelado externamente.`);
      return;
    }

    // 3. Buscar chave de acesso do metadata
    const chaveAcesso = document.metadata?.chave_acesso as string | undefined;

    // 4. Chamar provider (não bloqueia se falhar)
    try {
      const result = await provider.cancel(documentId, chaveAcesso, reason);

      // SPRINT 53: Registrar tentativa
      await fiscalProviderAttemptRepository.createAttempt(tenantId, {
        fiscalDocumentId: documentId,
        provider: (process.env.FISCAL_PROVIDER || 'mock') as 'mock' | 'sefaz',
        action: 'CANCEL',
        status: result.success ? 'SUCCESS' : result.errorCode === 'SEFAZ_DISABLED' ? 'SKIPPED' : 'FAILED',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        metadata: {
          chaveAcesso,
          reason,
          result_metadata: result.metadata,
        },
      });

      if (result.success) {
        // Atualizar documento com protocolo de cancelamento
        await fiscalDocumentRepository.updateDocumentStatus(
          tenantId,
          documentId,
          'CANCELLED',
          {
            protocolo_cancelamento: result.protocoloCancelamento,
            provider_metadata: result.metadata,
            cancelled_externallyAt: new Date().toISOString(),
          }
        );
      } else {
        // Falha no cancelamento externo
        // Registrar erro mas não quebrar
        console.error(
          `[FiscalIssuance] Falha ao cancelar documento ${documentId} no provider externo:`,
          result.errorCode,
          result.errorMessage
        );
      }
    } catch (error: any) {
      // Erro inesperado do provider
      console.error(
        `[FiscalIssuance] Exceção ao cancelar documento ${documentId} no provider externo:`,
        error
      );
    }
  }

  /**
   * Consulta status do documento no sistema externo
   */
  async getDocumentStatus(
    tenantId: string,
    documentId: string
  ): Promise<void> {
    // 1. Buscar documento
    const document = await fiscalDocumentRepository.getDocumentById(tenantId, documentId);
    if (!document) {
      throw new Error(`Documento fiscal não encontrado: ${documentId}`);
    }

    // 2. Resolver provider
    const provider = await this.resolveProvider();
    if (!provider) {
      return; // Provider não disponível, não consultar
    }

    // 3. Buscar chave de acesso
    const chaveAcesso = document.metadata?.chave_acesso as string | undefined;

    // 4. Consultar status (não bloqueia se falhar)
    try {
      const status = await provider.getStatus(documentId, chaveAcesso);

      // SPRINT 53: Registrar tentativa
      await fiscalProviderAttemptRepository.createAttempt(tenantId, {
        fiscalDocumentId: documentId,
        provider: (process.env.FISCAL_PROVIDER || 'mock') as 'mock' | 'sefaz',
        action: 'STATUS',
        status: status.status === 'UNKNOWN' ? 'SKIPPED' : 'SUCCESS',
        errorCode: status.errorCode,
        errorMessage: status.errorMessage,
        metadata: {
          chaveAcesso,
          status: status.status,
          result_metadata: status.metadata,
        },
      });

      // Atualizar metadata com status consultado
      await fiscalDocumentRepository.updateDocumentStatus(
        tenantId,
        documentId,
        document.status, // Não muda status, apenas atualiza metadata
        {
          external_status: status.status,
          external_status_checkedAt: new Date().toISOString(),
          provider_metadata: status.metadata,
        }
      );
    } catch (error: any) {
      // Erro ao consultar status (não bloqueia)
      console.warn(
        `[FiscalIssuance] Erro ao consultar status do documento ${documentId}:`,
        error
      );
    }
  }
}

export const fiscalIssuanceService = new FiscalIssuanceService();


