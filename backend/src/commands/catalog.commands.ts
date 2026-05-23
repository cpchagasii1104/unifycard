/**
 * Camada de comando explícita — escritas canónicas (single writer incremental).
 * Delega ao serviço existente; ponto único para transação/outbox futuros.
 */

import {
  canonicalProductCreationService,
  type GetOrCreateCanonicalProductInput,
  type GetOrCreateCanonicalProductResult,
} from '@core/catalog/canonical/canonical-product-creation.service';

export async function createCanonicalIndustrialCommand(
  input: GetOrCreateCanonicalProductInput
): Promise<GetOrCreateCanonicalProductResult> {
  return canonicalProductCreationService.getOrCreateIndustrial(input);
}