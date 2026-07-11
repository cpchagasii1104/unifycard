// src/core/location/location.routes.ts
// Location Core - Rotas de API (read-only, públicas)

import { FastifyPluginAsync } from 'fastify';
import { locationService } from './location.service';
import { locationEnrichmentService } from './location-enrichment.service';
import { z } from 'zod';

const locationRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /locations/countries
   * Lista todos os países ativos
   * Público, cacheável
   */
  fastify.get('/countries', async (req, reply) => {
    try {
      const countries = await locationService.getCountries();
      return reply.send({ countries });
    } catch (error) {
      req.log.error({ err: error }, 'Erro ao buscar países');
      return reply.status(500).send({
        error: 'Erro ao buscar países',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  /**
   * GET /locations/states?country_id=UUID
   * Lista estados de um país
   * Público, cacheável
   */
  fastify.get<{
    Querystring: {
      country_id: string;
    };
  }>('/states', async (req, reply) => {
    try {
      const schema = z.object({
        country_id: z.string().uuid('country_id deve ser um UUID válido'),
      });

      const validated = schema.parse(req.query);

      const states = await locationService.getStatesByCountry(validated.country_id);
      return reply.send({ states });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors,
        });
      }

      req.log.error({ err: error }, 'Erro ao buscar estados');
      return reply.status(500).send({
        error: 'Erro ao buscar estados',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  /**
   * GET /locations/cities/search?q=texto
   * Busca cidade por texto (combobox governado). Backend é a autoridade — o front nunca inventa cidade.
   */
  fastify.get<{ Querystring: { q?: string } }>('/cities/search', async (req, reply) => {
    const cities = await locationService.searchCities(req.query.q ?? '');
    return reply.send({ cities });
  });

  /**
   * GET /locations/cities/nearest?lat=&lng=
   * O navegador captura o lat/lng (sensor). O BACKEND resolve qual cidade — a verdade de localização é do
   * backend (haversine sobre as cidades governadas), o front nunca decide proximidade. Retorna a cidade
   * ativa mais próxima; a busca segue por city_id. Sem provider externo (usa as coords das cities).
   */
  /**
   * GET /locations/cep/:cep — AUTOCOMPLETE de CEP (transversal a toda locação). O backend resolve via
   * provider/cache e mapeia para o Location Core (city_id/neighborhoodId). O front só preenche; a verdade
   * territorial é o city_id, nunca o texto. resolved:false quando o provider não resolve (front pede
   * cidade no picker governado).
   */
  fastify.get<{ Params: { cep: string } }>('/cep/:cep', async (req, reply) => {
    const data = await locationService.resolveCep(req.params.cep);
    return reply.send({ ok: true, data });
  });

  fastify.get<{ Querystring: { lat?: string; lng?: string } }>('/cities/nearest', async (req, reply) => {
    const lat = Number(req.query.lat), lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return reply.status(400).send({ error: 'COORDS_INVALID: lat/lng fora do intervalo válido.' });
    }
    const city = await locationService.findNearestCity(lat, lng);
    if (!city) return reply.status(404).send({ error: 'NO_CITY_NEARBY: nenhuma cidade governada com coordenada.' });
    return reply.send({ city });
  });

  /**
   * GET /locations/cities?state_id=UUID
   * Lista cidades de um estado
   * Público, cacheável
   */
  fastify.get<{
    Querystring: {
      state_id: string;
    };
  }>('/cities', async (req, reply) => {
    try {
      const schema = z.object({
        state_id: z.string().uuid('state_id deve ser um UUID válido'),
      });

      const validated = schema.parse(req.query);

      const cities = await locationService.getCitiesByState(validated.state_id);
      return reply.send({ cities });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors,
        });
      }

      req.log.error({ err: error }, 'Erro ao buscar cidades');
      return reply.status(500).send({
        error: 'Erro ao buscar cidades',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  /**
   * GET /locations/neighborhoods?city_id=UUID
   * Lista bairros de uma cidade
   * Público, cacheável
   */
  fastify.get<{
    Querystring: {
      city_id: string;
    };
  }>('/neighborhoods', async (req, reply) => {
    try {
      const schema = z.object({
        city_id: z.string().uuid('city_id deve ser um UUID válido'),
      });

      const validated = schema.parse(req.query);

      const neighborhoods = await locationService.getNeighborhoodsByCity(validated.city_id);
      return reply.send({ neighborhoods });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors,
        });
      }

      req.log.error({ err: error }, 'Erro ao buscar bairros');
      return reply.status(500).send({
        error: 'Erro ao buscar bairros',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });

  /**
   * POST /locations/enrich-from-cep
   * Enriquecer localização a partir de CEP.
   * Público (mas pode ser protegido no futuro).
   *
   * CONTENÇÃO N0 (DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER): esta rota resolve/cria
   * país/estado/cidade a partir do CEP, mas NÃO cria mais bairro por texto livre. O bairro do
   * CEP retorna apenas como rótulo de exibição (`labels.neighborhood`); `neighborhood_id` fica
   * sempre nulo até existir a fundação canônica de bairro (F-NEIGHBORHOOD-CANONICAL-IDENTITY).
   * Ver DECISION-0079 §6 e DECISION-0166 D4.
   */
  fastify.post<{
    Body: {
      cep: string;
    };
  }>('/enrich-from-cep', async (req, reply) => {
    try {
      const schema = z.object({
        cep: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos'),
      });

      const validated = schema.parse(req.body);

      const result = await locationEnrichmentService.enrichFromCEP(validated.cep);
      
      if (!result) {
        return reply.status(404).send({
          error: 'CEP não encontrado',
        });
      }

      return reply.send(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Parâmetros inválidos',
          details: error.errors,
        });
      }

      req.log.error({ err: error }, 'Erro ao enriquecer CEP');
      return reply.status(500).send({
        error: 'Erro ao enriquecer CEP',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  });
};

export default locationRoutes;
