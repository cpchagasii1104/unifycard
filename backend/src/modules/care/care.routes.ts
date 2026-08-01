// src/modules/care/care.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { careService } from './care.service';
import { sendMessageSchema } from './care.schemas';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  FORA DO MÍNIMO DE PRODUTO + INALCANÇÁVEL (F-OUT-OF-SCOPE-CONTAINMENT, 2026-08-01)
// ║ NORMA:   decisão de produto de Clayton, 2026-08-01 (cartório REMEDIATION_DT_LOG.md, topo)
// ║ NÃO:     montar este módulo. São 3 endpoints e care.module.ts existe mas NUNCA é importado por ninguém —
// ║          logo NÃO há rota alcançável hoje. Por isso NÃO recebeu contenção 501: 501 em rota
// ║          inalcançável é decoração, e decoração envelhece pior que ausência. NÃO apagar
// ║          arquivo/módulo (ato de Clayton); NÃO materializar substrato.
// ║ EM VEZ:  o guard audit-product-scope-containment.mjs MORDE se este módulo voltar a ser
// ║          registrado sem GATE. Iniciar este escopo = decisão de Clayton + GATE, e aí sim
// ║          materializar substrato do archive.
// ╚════════════════════════════════════════════════════════════════

const careRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /care/send
   * Envia mensagem e processa automaticamente
   */
  fastify.post<{
    Body: {
      text: string;
      targetGlobalUserId?: string | null;
      targetCompanyId?: string | null;
      sessionId?: string | null;
    };
  }>(
    '/send',
    {
      schema: {
        body: {
          type: 'object',
          required: ['text'],
          properties: {
            text: { type: 'string' },
            targetGlobalUserId: { type: ['string', 'null'] },
            targetCompanyId: { type: ['string', 'null'] },
            sessionId: { type: ['string', 'null'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const validated = sendMessageSchema.parse(req.body);
        const response = await careService.processUserMessage(
          req.server,
          req.tenant.id,
          req.user.globalUserId,
          validated
        );
        return reply.status(200).send(response);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        fastify.log.error({ err: error }, 'Erro ao processar mensagem');
        return reply.status(500).send({ error: 'Erro ao processar mensagem' });
      }
    }
  );

  /**
   * GET /care/session/:sessionId
   * Retorna sessão com mensagens
   */
  fastify.get<{
    Params: { sessionId: string };
  }>(
    '/session/:sessionId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const session = await careService.getSession(req.tenant.id, req.params.sessionId);

        if (!session) {
          return reply.status(404).send({ error: 'Sessão não encontrada' });
        }

        return session;
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar sessão');
        return reply.status(500).send({ error: 'Erro ao buscar sessão' });
      }
    }
  );

  /**
   * GET /care/of-user/:globalUserId
   * Lista sessões do usuário
   */
  fastify.get<{
    Params: { globalUserId: string };
  }>(
    '/of-user/:globalUserId',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            globalUserId: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        const sessions = await careService.getSessionsByUser(
          req.tenant.id,
          req.params.globalUserId
        );
        return { sessions, totalCents: sessions.length };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao buscar sessões do usuário');
        return reply.status(500).send({ error: 'Erro ao buscar sessões do usuário' });
      }
    }
  );
};

export default careRoutes;

















