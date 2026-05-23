// canonical-product-creation.service.ts
// Fachada de produção: deps reais. Lógica testável em `canonical-product-creation.pipeline.ts`.

import { canonicalConceptResolutionQueueService } from './canonical-concept-resolution-queue.service';
import { canonicalProductRepository } from './canonical-product.repository';
import {
  getOrCreateIndustrialWithDeps,
  type GetOrCreateCanonicalProductInput,
  type GetOrCreateCanonicalProductResult,
} from './canonical-product-creation.pipeline';

export type {
  GetOrCreateCanonicalProductInput,
  GetOrCreateCanonicalProductResult,
} from './canonical-product-creation.pipeline';

export const canonicalProductCreationService = {
  async getOrCreateIndustrial(
    input: GetOrCreateCanonicalProductInput
  ): Promise<GetOrCreateCanonicalProductResult> {
    return getOrCreateIndustrialWithDeps(canonicalProductRepository, input, {
      onIndustrialCreatedUnresolved: async ({ canonicalProductId }) => {
        await canonicalConceptResolutionQueueService.ensurePendingQueueEntryForCanonicalProduct(
          canonicalProductId
        );
      },
    });
  },
};