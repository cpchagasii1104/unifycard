// backend/src/core/location/address-territorial-errors.ts
// F-NEIGHBORHOOD-CANONICAL-IDENTITY / N2-F — mapeamento CANÔNICO das constraints territoriais da coerência
// composta de addresses para erros de domínio. Reutiliza HttpError (não inventa sistema de erros).
//
// Barreira MATERIAL final = as constraints físicas (ck_addresses_neighborhood_requires_city +
// fk_addresses_city_neighborhood). Estas funções só (a) rejeitam ANTECIPADAMENTE o caso ESTRUTURAL
// neighborhood-sem-city (clareza antes do INSERT, sem duplicar a coerência city×neighborhood nem criar
// TOCTOU), e (b) traduzem POR NOME EXATO DE CONSTRAINT as violações territoriais conhecidas. Qualquer
// outra constraint (FK não-territorial) ou erro de infraestrutura é REPROPAGADO INTACTO — nunca engolido,
// nunca convertido em sucesso, nunca reclassificado.

import { HttpError } from '@core/errors/http-error';

/**
 * Validação ANTECIPADA apenas estrutural (M-2): neighborhood_id preenchido com city_id ausente → rejeição
 * de domínio ANTES do INSERT. A coerência real city×neighborhood permanece garantida pela FK composta.
 */
export function assertNeighborhoodRequiresCity(
  cityId: string | null | undefined,
  neighborhoodId: string | null | undefined
): void {
  if (neighborhoodId && !cityId) {
    throw HttpError.badRequest('NEIGHBORHOOD_REQUIRES_CITY: bairro exige cidade (validação antecipada N2-F).');
  }
}

/**
 * Traduz SOMENTE as constraints territoriais conhecidas para o contrato canônico de erro; qualquer outro
 * erro (FK não-territorial, CHECK alheio, infra/DB inesperado) PROPAGA intacto. Sempre relança.
 */
export function mapAddressTerritorialConstraintError(error: any): never {
  const constraint = error?.constraint;
  if (constraint === 'ck_addresses_neighborhood_requires_city') {
    throw HttpError.badRequest('NEIGHBORHOOD_REQUIRES_CITY: bairro exige cidade.');
  }
  if (constraint === 'fk_addresses_city_neighborhood') {
    throw HttpError.conflict('ADDRESS_NEIGHBORHOOD_CITY_MISMATCH: bairro não pertence à cidade informada.');
  }
  throw error; // FK não-territorial / infra / DB inesperado: PROPAGA sem mascarar
}
