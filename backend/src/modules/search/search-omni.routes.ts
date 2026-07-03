// search-omni.routes.ts
// F-GLOBAL-SEARCH-OMNI-SLICE-A — GET /search?q= (omnibox federado). READ-ONLY, money-free.
//
// Nomenclatura canônica §9.3: busca = `?q={termo}` (não `term=`). Piso de autoridade igual ao de
// GET /events/search (a régua de discovery): exige AUTENTICADO (401) + tenant (400); nenhuma
// representação é exercida (nenhum dado actor-privado retorna — só projeções públicas dentro do
// tenant), então actionContext NÃO é exigido. discoveryUserId = req.user.userId server-side
// (DECISION-0113: NUNCA actorId declarado pelo cliente) abre group/followers no piso de eventos.

import type { FastifyPluginAsync } from 'fastify';
import { searchOmniService } from './search-omni.service';

const searchOmniRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /?q=clayton&limit=5 → seções tipadas: people/companies/groups/services/products/events.
   * (montado sob prefix /search → GET /search?q=...)
   */
  fastify.get<{ Querystring: { q?: string; limit?: string; cityId?: string } }>('/', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.tenant?.id) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    const q = String(req.query.q ?? '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? '5', 10) || 5, 1), 10);
    // filtro pós-busca de cidade (aplica às seções com substrato: serviços + eventos)
    const cityId = String(req.query.cityId ?? '').trim() || null;

    try {
      const data = await searchOmniService.searchOmni(req.tenant.id, {
        q,
        perSection: limit,
        discoveryUserId: (req.user as { userId?: string }).userId,
        cityId,
      });
      return reply.send({ ok: true, data });
    } catch (err) {
      fastify.log.error({ err }, 'search-omni');
      return reply.status(500).send({ error: 'Erro na busca' });
    }
  });
};

export default searchOmniRoutes;
