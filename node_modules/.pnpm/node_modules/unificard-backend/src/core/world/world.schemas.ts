// src/core/world/world.schemas.ts
import { z } from 'zod';

export const countryCodeSchema = z.string().length(2, 'Código do país deve ter 2 caracteres');
export const stateCodeSchema = z.string().min(1).max(10, 'Código do estado deve ter no máximo 10 caracteres');
export const cityNameSchema = z.string().min(1).max(200, 'Nome da cidade deve ter no máximo 200 caracteres');

export const getStatesByCountryParamsSchema = z.object({
  countryId: z.string().uuid('ID do país inválido'),
});

export const getCitiesByStateParamsSchema = z.object({
  stateId: z.string().uuid('ID do estado inválido'),
});

export const searchCitiesQuerySchema = z.object({
  term: z.string().min(1, 'Termo de busca é obrigatório'),
  countryId: z.string().uuid('ID do país inválido').optional(),
  stateId: z.string().uuid('ID do estado inválido').optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});








