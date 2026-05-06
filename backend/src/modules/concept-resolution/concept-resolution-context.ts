/**
 * Mapeamento pragmático contexto → domínio N0 esperado em `concepts.domain`.
 * Ajustar via norma/ontologia; ambientes legados podem usar `item-comercial` só onde a BD ainda o exige.
 */
import type { N0DomainKey } from '@core/ontology/n0-domains';

import type { ConceptResolutionContext } from './concept-resolution.types';

export const DEFAULT_N0_DOMAIN_BY_CONTEXT: Record<ConceptResolutionContext, N0DomainKey> = {
  vehicle: 'mobilidade-e-logistica',
  product: 'produtos-e-comercio',
  service: 'servicos',
};

export function getDefaultConceptDomain(context: ConceptResolutionContext): N0DomainKey {
  return DEFAULT_N0_DOMAIN_BY_CONTEXT[context];
}