// TEMP compatibility layer (post-refactor): stub until B2B module is implemented or restored.

import type { MarketplaceService } from '../../marketplace.service';
import type { B2BCommercialContract, B2BContractExecution } from '@contracts/marketplace';

export type CreateB2BContractInput = {
  supplierId: string;
  supplierType: 'store' | 'hub' | 'industry';
  buyerId: string;
  buyerType: 'store' | 'hub';
  region: { country: string; state: string; city: string };
  products: Array<{
    productId: string;
    name: string;
    unitPrice: number;
    currency: string;
    minimumQuantity: number;
    maximumQuantity?: number;
  }>;
  terms: {
    volumeCommitment: number;
    deliverySchedule: 'weekly' | 'monthly' | 'quarterly';
    paymentTerms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    penaltyRate?: number;
  };
  startDate: string;
  endDate: string;
};

export type ExecuteB2BContractInput = {
  contractId: string;
  products: Array<{ productId: string; quantity: number }>;
  deliveredAt: string;
};

export class MarketplaceB2BService {
  constructor(private readonly _facade: MarketplaceService) {}

  async createB2BContract(_tenantId: string, _input: CreateB2BContractInput): Promise<B2BCommercialContract> {
    throw new Error('MarketplaceB2BService.createB2BContract not implemented');
  }

  signB2BContract(_contractId: string): B2BCommercialContract {
    throw new Error('MarketplaceB2BService.signB2BContract not implemented');
  }

  async executeB2BContract(_input: ExecuteB2BContractInput): Promise<B2BContractExecution> {
    throw new Error('MarketplaceB2BService.executeB2BContract not implemented');
  }

  applyContractPenalty(_executionId: string): B2BContractExecution {
    throw new Error('MarketplaceB2BService.applyContractPenalty not implemented');
  }

  markExecutionDelivered(_executionId: string): void {}

  markExecutionPaid(_executionId: string): void {}

  checkOverdueExecutions(): void {}

  getB2BContractsByActor(_actorId: string, _role: 'supplier' | 'buyer'): B2BCommercialContract[] {
    return [];
  }

  getB2BContractExecutions(_contractId: string): B2BContractExecution[] {
    return [];
  }
}