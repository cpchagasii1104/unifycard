// backend/src/core/events/aspects/event-aspects.service.ts
// Service de validação de EventAspect contra vocabulário fechado
// EVENT_DOMAIN_MINIMUM_CONTRACT FASE 2

import { EVENT_ASPECTS_V1, EVENT_ASPECTS_VERSION, isValidEventAspectV1 } from './event-aspects.v1';
import { BadRequestError } from '@core/errors';

/**
 * Erro de domínio para aspecto inválido
 */
export class EventAspectInvalidError extends BadRequestError {
  constructor(aspect: string, version: string) {
    super(
      `EventAspect inválido: '${aspect}' não existe no vocabulário fechado ${version}. ` +
      `Aspectos válidos: ${EVENT_ASPECTS_V1.join(', ')}`
    );
    this.name = 'EVENT_ASPECT_INVALID';
  }
}

/**
 * Resultado da validação de aspectos
 */
export interface ValidateAspectsResult {
  version: typeof EVENT_ASPECTS_VERSION;
  normalized: string[];
}

/**
 * Valida e normaliza aspectos contra vocabulário fechado
 * 
 * Regras:
 * - input obrigatório, array não-vazio
 * - cada item deve existir em EVENT_ASPECTS_V1
 * - normalização simples (trim + lowercase)
 * - se inválido: erro de domínio EVENT_ASPECT_INVALID
 * - NÃO aceita texto livre
 */
export function validateAspects(input: string[]): ValidateAspectsResult {
  // 1. Validar que input não é vazio
  if (!input || input.length === 0) {
    throw new BadRequestError('event_aspects é obrigatório e não pode ser vazio');
  }

  // 2. Normalizar e validar cada aspecto
  const normalized: string[] = [];
  const invalidAspects: string[] = [];

  for (const aspect of input) {
    // Normalização: trim + lowercase
    const normalizedAspect = aspect.trim().toLowerCase();

    // Validar contra vocabulário fechado
    if (!isValidEventAspectV1(normalizedAspect)) {
      invalidAspects.push(aspect);
    } else {
      // Evitar duplicatas
      if (!normalized.includes(normalizedAspect)) {
        normalized.push(normalizedAspect);
      }
    }
  }

  // 3. Se houver aspectos inválidos, lançar erro
  if (invalidAspects.length > 0) {
    throw new EventAspectInvalidError(invalidAspects[0], EVENT_ASPECTS_VERSION);
  }

  return {
    version: EVENT_ASPECTS_VERSION,
    normalized,
  };
}

