// backend/src/modules/marketplace/marketplace.service.terminal.ts
// Módulo Payment Terminal — criação, aprovação, ativação, consulta, listagem e desativação

import type { MarketplaceService } from './marketplace.service';
import type { PaymentTerminal } from '@contracts/marketplace';
import { regionalFundService } from './regional-fund.service';
import { marketplaceLogger } from './marketplace.logger';

export class MarketplaceTerminalModule {
  private readonly paymentTerminals: Map<string, PaymentTerminal> = new Map();

  constructor(private readonly facade: MarketplaceService) {}

  getPaymentTerminalsMap(): Map<string, PaymentTerminal> {
    return this.paymentTerminals;
  }

  createPaymentTerminal(input: {
    companyId: string;
    terminalType: 'unified_card' | 'external';
    provider?: string;
  }): PaymentTerminal {
    const terminalId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const transactionFeeStructure = {
      baseRate: input.terminalType === 'unified_card' ? 2.5 : 3.0,
      regionalFundPercentage: 0.5,
      platformPercentage: 1.0,
      referralPercentage: 0.2,
    };

    const terminal: PaymentTerminal = {
      terminalId,
      companyId: input.companyId,
      terminalType: input.terminalType,
      provider: input.provider,
      status: 'requested',
      transactionFeeStructure,
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento solicitada', {
      terminalId,
      companyId: input.companyId,
      terminalType: input.terminalType,
    });

    return terminal;
  }

  approvePaymentTerminal(terminalId: string): PaymentTerminal {
    const terminal = this.paymentTerminals.get(terminalId);
    if (!terminal) {
      throw new Error('Maquininha não encontrada');
    }

    terminal.status = 'approved';
    terminal.approvedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento aprovada', {
      terminalId,
    });

    return terminal;
  }

  async activatePaymentTerminal(tenantId: string, terminalId: string): Promise<PaymentTerminal> {
    const terminal = this.paymentTerminals.get(terminalId);
    if (!terminal) {
      throw new Error('Maquininha não encontrada');
    }

    if (terminal.status !== 'approved') {
      throw new Error('Maquininha deve ser aprovada antes de ser ativada');
    }

    terminal.status = 'active';
    terminal.activatedAt = new Date().toISOString();
    terminal.updatedAt = new Date().toISOString();
    this.paymentTerminals.set(terminalId, terminal);

    try {
      const regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, {
        country: 'BR',
        state: 'PR',
        city: 'Curitiba',
      });
      if (regionalFund) {
        await regionalFundService.recordRegionalFundCredit(tenantId, {
          regional_fund_id: regionalFund.regionalFundId,
          amountCents: 0,
          currency: 'BRL',
          source: 'payment_terminal_setup',
          reference_id: terminalId,
        });
      }
    } catch {
      marketplaceLogger.init('Evento de Fundo Regional não registrado (método não disponível)');
    }

    marketplaceLogger.init('Maquininha de pagamento ativada', {
      terminalId,
    });

    return terminal;
  }

  getPaymentTerminal(terminalId: string): PaymentTerminal | null {
    return this.paymentTerminals.get(terminalId) || null;
  }

  getCompanyPaymentTerminals(companyId: string): PaymentTerminal[] {
    return Array.from(this.paymentTerminals.values()).filter((t) => t.companyId === companyId);
  }

  deactivatePaymentTerminal(terminalId: string): PaymentTerminal {
    const terminal = this.paymentTerminals.get(terminalId);
    if (!terminal) {
      throw new Error('Maquininha não encontrada');
    }

    terminal.status = 'suspended';
    terminal.updatedAt = new Date().toISOString();
    this.paymentTerminals.set(terminalId, terminal);

    marketplaceLogger.init('Maquininha de pagamento desativada', {
      terminalId,
    });

    return terminal;
  }
}