// backend/src/modules/marketplace/fiscal-provider.sefaz.ts
// SPRINT 53: FISCAL PROVIDER SEFAZ - Provider real (skeleton, sem homologação)

import type {
  FiscalProvider,
  FiscalDocumentData,
  FiscalIssueResult,
  FiscalCancelResult,
  FiscalStatus,
} from './fiscal-provider.interface';

/**
 * Provider SEFAZ para emissão fiscal
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Provider é opcional e falhável
 * - Sem emissão real por padrão (SEFAZ_ENABLED=false)
 * - Valida payload mas não envia para SEFAZ por padrão
 * - Registra tentativas de forma auditável
 * - Sem PKI própria, sem reinventar criptografia
 */
class SefazFiscalProvider implements FiscalProvider {
  /**
   * Verifica se provider está disponível/configurado
   */
  async isAvailable(): Promise<boolean> {
    // Verificar se variáveis de ambiente existem
    const provider = process.env.FISCAL_PROVIDER;
    const enabled = process.env.SEFAZ_ENABLED === 'true';
    const env = process.env.SEFAZ_ENV;
    const uf = process.env.SEFAZ_UF;
    const endpoint = process.env.SEFAZ_ENDPOINT;
    const certPath = process.env.SEFAZ_CERT_PATH;

    // Provider deve ser 'sefaz' e estar habilitado
    if (provider !== 'sefaz' || !enabled) {
      return false;
    }

    // Verificar se variáveis obrigatórias existem
    if (!env || !uf || !endpoint || !certPath) {
      return false;
    }

    // Verificar se certificado existe (se path fornecido)
    if (certPath) {
      try {
        const fs = await import('fs');
        if (!fs.existsSync(certPath)) {
          console.warn(`[SefazFiscalProvider] Certificado não encontrado: ${certPath}`);
          return false;
        }
      } catch (error) {
        console.warn(`[SefazFiscalProvider] Erro ao verificar certificado:`, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Emite documento fiscal no SEFAZ
   * 
   * SPRINT 53: Skeleton - valida payload, gera draft, mas não envia por padrão
   */
  async issue(document: FiscalDocumentData): Promise<FiscalIssueResult> {
    // 1. Validar campos obrigatórios
    this.validateDocumentData(document);

    // 2. Montar payload mínimo (XML/JSON draft)
    const payload = this.buildPayload(document);

    // 3. Verificar se SEFAZ está habilitado
    const sefazEnabled = process.env.SEFAZ_ENABLED === 'true';

    if (!sefazEnabled) {
      // SPRINT 53: Se não habilitado, retornar "not sent" com metadata
      return {
        success: false,
        documentId: document.id,
        errorCode: 'SEFAZ_DISABLED',
        errorMessage: 'SEFAZ não está habilitado (SEFAZ_ENABLED=false). Documento não foi enviado.',
        metadata: {
          provider: 'sefaz',
          enabled: false,
          payload_draft: payload,
          skipped_at: new Date().toISOString(),
        },
      };
    }

    // 4. Preparar request (mas pode apontar endpoint mock local)
    const endpoint = process.env.SEFAZ_ENDPOINT || '';
    const timeout = parseInt(process.env.SEFAZ_TIMEOUT_MS || '30000', 10);

    try {
      // SPRINT 53: Por enquanto, apenas prepara request mas não envia
      // Futuro: enviar para SEFAZ real
      const response = await this.sendRequest(endpoint, payload, timeout);

      if (response.success) {
        return {
          success: true,
          documentId: document.id,
          chaveAcesso: response.chaveAcesso || `SEFAZ-${document.id}-${Date.now()}`,
          protocolo: response.protocolo || `SEFAZ-PROTOCOL-${Date.now()}`,
          xml: response.xml,
          metadata: {
            provider: 'sefaz',
            endpoint,
            issued_at: new Date().toISOString(),
            response_metadata: response.metadata,
          },
        };
      } else {
        return {
          success: false,
          documentId: document.id,
          errorCode: response.errorCode || 'SEFAZ_ERROR',
          errorMessage: response.errorMessage || 'Erro ao emitir documento no SEFAZ',
          metadata: {
            provider: 'sefaz',
            endpoint,
            failed_at: new Date().toISOString(),
            response_metadata: response.metadata,
          },
        };
      }
    } catch (error: any) {
      return {
        success: false,
        documentId: document.id,
        errorCode: 'SEFAZ_EXCEPTION',
        errorMessage: error.message || 'Exceção ao emitir documento no SEFAZ',
        metadata: {
          provider: 'sefaz',
          endpoint,
          exception: error.message,
          failed_at: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Cancela documento fiscal no SEFAZ
   * 
   * SPRINT 53: Stub com validação
   */
  async cancel(
    documentId: string,
    chaveAcesso?: string,
    reason?: string
  ): Promise<FiscalCancelResult> {
    // Validar chave de acesso
    if (!chaveAcesso) {
      return {
        success: false,
        documentId,
        errorCode: 'MISSING_CHAVE_ACESSO',
        errorMessage: 'Chave de acesso é obrigatória para cancelamento',
        metadata: {
          provider: 'sefaz',
          failed_at: new Date().toISOString(),
        },
      };
    }

    // Verificar se SEFAZ está habilitado
    const sefazEnabled = process.env.SEFAZ_ENABLED === 'true';

    if (!sefazEnabled) {
      return {
        success: false,
        documentId,
        errorCode: 'SEFAZ_DISABLED',
        errorMessage: 'SEFAZ não está habilitado (SEFAZ_ENABLED=false). Cancelamento não foi enviado.',
        metadata: {
          provider: 'sefaz',
          enabled: false,
          chaveAcesso,
          reason,
          skipped_at: new Date().toISOString(),
        },
      };
    }

    // SPRINT 53: Stub - por enquanto, apenas valida
    // Futuro: enviar cancelamento para SEFAZ real
    return {
      success: false,
      documentId,
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: 'Cancelamento SEFAZ ainda não implementado (skeleton)',
      metadata: {
        provider: 'sefaz',
        chaveAcesso,
        reason,
        failed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Consulta status do documento no SEFAZ
   * 
   * SPRINT 53: Stub
   */
  async getStatus(documentId: string, chaveAcesso?: string): Promise<FiscalStatus> {
    // Verificar se SEFAZ está habilitado
    const sefazEnabled = process.env.SEFAZ_ENABLED === 'true';

    if (!sefazEnabled || !chaveAcesso) {
      return {
        documentId,
        status: 'UNKNOWN',
        chaveAcesso,
        metadata: {
          provider: 'sefaz',
          enabled: sefazEnabled,
          checked_at: new Date().toISOString(),
        },
      };
    }

    // SPRINT 53: Stub - por enquanto, retorna UNKNOWN
    // Futuro: consultar status no SEFAZ real
    return {
      documentId,
      status: 'UNKNOWN',
      chaveAcesso,
      metadata: {
        provider: 'sefaz',
        not_implemented: true,
        checked_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Valida dados do documento
   */
  private validateDocumentData(document: FiscalDocumentData): void {
    if (!document.id) {
      throw new Error('Document ID é obrigatório');
    }

    if (!document.tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }

    if (!document.orderId) {
      throw new Error('Order ID é obrigatório');
    }

    if (!document.documentType) {
      throw new Error('Document Type é obrigatório');
    }

    if (document.totalAmount <= 0) {
      throw new Error('Total Amount deve ser maior que zero');
    }

    if (!document.items || document.items.length === 0) {
      throw new Error('Document deve ter pelo menos um item');
    }

    // Validar itens
    for (const item of document.items) {
      if (!item.productVariantId) {
        throw new Error('Item Product Variant ID é obrigatório');
      }

      if (item.quantity <= 0) {
        throw new Error('Item Quantity deve ser maior que zero');
      }

      if (!item.unit) {
        throw new Error('Item Unit é obrigatório');
      }
    }
  }

  /**
   * Monta payload mínimo (XML/JSON draft)
   */
  private buildPayload(document: FiscalDocumentData): any {
    const uf = process.env.SEFAZ_UF || 'XX';
    const env = process.env.SEFAZ_ENV || 'homolog';

    // SPRINT 53: Payload mínimo (draft)
    // Futuro: montar XML completo conforme especificação SEFAZ
    return {
      versao: '4.00', // Versão da NFe/NFCe
      id: `NFe${document.id.substring(0, 44)}`, // ID da NFe (44 caracteres)
      ide: {
        cUF: this.getUfCode(uf),
        natOp: 'VENDA', // Natureza da operação
        mod: document.documentType === 'NFCE' ? 65 : 55, // Modelo (65=NFCe, 55=NFe)
        serie: '1',
        nNF: document.id.substring(0, 9), // Número da NF (9 dígitos)
        dhEmi: new Date().toISOString(),
        tpNF: 1, // Tipo de operação (1=Saída)
        idDest: 1, // Identificação do destinatário (1=Operação interna)
        tpImp: 4, // Tipo de impressão (4=DANFE NFCe)
        tpEmis: 1, // Tipo de emissão (1=Normal)
        cDV: this.calculateCheckDigit(document.id), // Dígito verificador
        tpAmb: env === 'prod' ? 1 : 2, // Ambiente (1=Produção, 2=Homologação)
      },
      emit: {
        // Dados do emitente (futuro: buscar de company/actor)
        CNPJ: '00000000000000', // Placeholder
        xNome: 'EMITENTE PLACEHOLDER',
      },
      dest: {
        // Dados do destinatário (futuro: buscar de order)
        CPF: '00000000000', // Placeholder
        xNome: 'DESTINATARIO PLACEHOLDER',
      },
      det: document.items.map((item, index) => ({
        nItem: index + 1,
        prod: {
          cProd: item.productVariantId.substring(0, 60), // Código do produto
          cEAN: 'SEM GTIN', // Código EAN
          xProd: `Produto ${item.productVariantId}`, // Descrição
          NCM: '00000000', // NCM placeholder
          CFOP: '5102', // CFOP placeholder (venda)
          uCom: item.unit,
          qCom: item.quantity,
          vUnCom: (document.totalAmount / document.items.length / item.quantity).toFixed(4),
          vProd: (document.totalAmount / document.items.length).toFixed(2),
          cEANTrib: 'SEM GTIN',
          uTrib: item.unit,
          qTrib: item.quantity,
          vUnTrib: (document.totalAmount / document.items.length / item.quantity).toFixed(4),
          vFrete: '0.00',
          vSeg: '0.00',
          vDesc: '0.00',
          vOutro: '0.00',
          indTot: 1, // Valor total do item
        },
        imposto: {
          ICMS: {
            ICMS00: {
              orig: 0, // Origem (0=Nacional)
              CST: '00', // CST (00=Tributada integralmente)
              modBC: 0, // Modalidade de BC (0=Margem de valor agregado)
              vBC: (document.totalAmount / document.items.length).toFixed(2),
              pICMS: '18.00', // Alíquota ICMS (18%)
              vICMS: ((document.totalAmount / document.items.length) * 0.18).toFixed(2),
            },
          },
          IPI: {
            cEnq: '999',
            IPITrib: {
              CST: '99', // CST IPI (99=Outras)
              vIPI: '0.00',
            },
          },
          PIS: {
            PISAliq: {
              CST: '01', // CST PIS (01=Operação tributável)
              vBC: (document.totalAmount / document.items.length).toFixed(2),
              pPIS: '1.65', // Alíquota PIS (1.65%)
              vPIS: ((document.totalAmount / document.items.length) * 0.0165).toFixed(2),
            },
          },
          COFINS: {
            COFINSAliq: {
              CST: '01', // CST COFINS (01=Operação tributável)
              vBC: (document.totalAmount / document.items.length).toFixed(2),
              pCOFINS: '7.60', // Alíquota COFINS (7.60%)
              vCOFINS: ((document.totalAmount / document.items.length) * 0.076).toFixed(2),
            },
          },
        },
      })),
      total: {
        ICMSTot: {
          vBC: document.totalAmount.toFixed(2),
          vICMS: (document.totalAmount * 0.18).toFixed(2),
          vProd: document.totalAmount.toFixed(2),
          vFrete: '0.00',
          vSeg: '0.00',
          vDesc: '0.00',
          vII: '0.00',
          vIPI: '0.00',
          vPIS: (document.totalAmount * 0.0165).toFixed(2),
          vCOFINS: (document.totalAmount * 0.076).toFixed(2),
          vNF: document.totalAmount.toFixed(2),
          vTotTrib: '0.00',
        },
      },
      infAdic: {
        infCpl: `Documento gerado automaticamente. Order ID: ${document.orderId}`,
      },
    };
  }

  /**
   * Envia request para SEFAZ (skeleton)
   */
  private async sendRequest(
    endpoint: string,
    payload: any,
    timeout: number
  ): Promise<{
    success: boolean;
    chaveAcesso?: string;
    protocolo?: string;
    xml?: string;
    errorCode?: string;
    errorMessage?: string;
    metadata?: any;
  }> {
    // SPRINT 53: Por enquanto, apenas simula envio
    // Futuro: usar biblioteca HTTP (axios, fetch) com certificado
    // Futuro: assinar XML com certificado digital
    // Futuro: enviar para endpoint real

    console.log(`[SefazFiscalProvider] Simulando envio para ${endpoint}`, {
      payload_size: JSON.stringify(payload).length,
      timeout,
    });

    // Simular delay de rede
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // SPRINT 53: Por padrão, retornar erro (não implementado)
    // Se endpoint apontar para mock local, pode retornar sucesso
    if (endpoint.includes('mock') || endpoint.includes('localhost')) {
      return {
        success: true,
        chaveAcesso: `SEFAZ-MOCK-${Date.now()}`,
        protocolo: `SEFAZ-PROTOCOL-MOCK-${Date.now()}`,
        xml: '<xml>mock</xml>',
        metadata: {
          endpoint,
          mock: true,
        },
      };
    }

    return {
      success: false,
      errorCode: 'NOT_IMPLEMENTED',
      errorMessage: 'Envio para SEFAZ real ainda não implementado (skeleton)',
      metadata: {
        endpoint,
        payload_size: JSON.stringify(payload).length,
      },
    };
  }

  /**
   * Obtém código UF (placeholder)
   */
  private getUfCode(uf: string): number {
    const ufCodes: Record<string, number> = {
      AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
      GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
      PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
      SP: 35, SE: 28, TO: 17,
    };
    return ufCodes[uf.toUpperCase()] || 35; // Default: SP
  }

  /**
   * Calcula dígito verificador (placeholder)
   */
  private calculateCheckDigit(id: string): number {
    // SPRINT 53: Placeholder - futuro: calcular dígito verificador real
    return parseInt(id.substring(id.length - 1), 10) % 10;
  }
}

export const sefazFiscalProvider = new SefazFiscalProvider();







