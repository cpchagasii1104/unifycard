// backend/src/modules/marketplace/marketplace.service.fund.ts
// Módulo Regional Fund — aprovação de terminal (delegação) e ensure regional fund

import type { MarketplaceService } from './marketplace.service';
import type { PaymentTerminal, RegionalFund } from '@contracts/marketplace';
import { regionalFundService } from './regional-fund.service';

export class MarketplaceFundModule {
  constructor(private readonly facade: MarketplaceService) {}

  generateRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }) {
    return this.facade.payments.generateRevenueSnapshot(region, period);
  }

  getRevenueSnapshot(region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }) {
    return this.facade.payments.getRevenueSnapshot(region, period);
  }

  async getRegionalFinancialFlow(tenantId: string, region: { country: string; state: string; city: string }, period: {
    year: number;
    month: number;
  }) {
    return this.facade.payments.getRegionalFinancialFlow(tenantId, region, period);
  }

  approvePaymentTerminal(terminalId: string): PaymentTerminal {
    return this.facade.company.approvePaymentTerminal(terminalId);
  }

  /**
   * Garantir que exista fundo regional para a região (obter ou criar).
   */
  async ensureRegionalFundForRegion(tenantId: string, region: { country: string; state: string; city: string }): Promise<RegionalFund> {
    let regionalFund = await regionalFundService.getRegionalFundByRegion(tenantId, region);
    if (!regionalFund) {
      regionalFund = await regionalFundService.createRegionalFund(tenantId, {
        region,
        rules: {
          min_reserve: 10000,
          max_monthly_outflow: 50000,
          allowed_uses: ['infrastructure', 'incentives', 'emergency'],
        },
        governance: {
          decision_maker: 'automatic',
          approval_required: false,
        },
      });
    }
    return regionalFund;
  }
}